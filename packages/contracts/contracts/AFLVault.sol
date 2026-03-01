// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AFLVault
 * @notice Lock $AFL tokens to earn yield. 2.5% fee on deposit + withdraw.
 *         Fee split: 50% buyback, 25% treasury, 25% prize pool.
 *         Prize pool held in contract until commissioner distributes to playoff winner.
 *
 *         Rewards are funded explicitly via `fundRewards()` (not from the 2.5% fee),
 *         and distributed by stake weight = amount * lockMultiplier.
 *
 *         ⚠️  This contract is intended for local/testing and testnet only until audited.
 */
contract AFLVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable aflToken;

    address public buybackWallet;
    address public treasuryWallet;

    uint256 public constant FEE_BPS = 250; // 2.5%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    uint256 public constant BUYBACK_SHARE = 50;
    uint256 public constant TREASURY_SHARE = 25;
    uint256 public constant PRIZE_SHARE = 25;

    uint256 public prizePool;
    uint256 public totalStaked;
    uint256 public totalWeightedStaked;

    uint256 public rewardPerWeightStored; // scaled by 1e18
    uint256 public unallocatedRewards;

    // Lock period options in seconds
    uint256[] public lockPeriods = [30 days, 90 days, 180 days];
    // Yield multipliers for each lock period (in BPS, 10000 = 1x, 12000 = 1.2x)
    uint256[] public lockMultipliers = [10_000, 12_000, 15_000];

    struct Stake {
        uint256 amount; // tokens staked (after fee)
        uint256 lockEnd; // timestamp when unlockable
        uint256 multiplier; // yield multiplier in BPS
        uint256 rewardDebt; // rewardPerWeightStored at last update
    }

    mapping(address => Stake) public stakes;
    mapping(address => uint256) public pendingRewards;

    event Deposited(address indexed user, uint256 amount, uint256 fee, uint256 lockPeriodIndex);
    event Withdrawn(address indexed user, uint256 amount, uint256 fee);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardsFunded(uint256 amount);
    event PrizeDistributed(address indexed winner, uint256 amount);
    event FeeDistributed(uint256 buyback, uint256 treasury, uint256 prize);
    event WalletsUpdated(address buyback, address treasury);

    constructor(address _aflToken, address _buybackWallet, address _treasuryWallet) Ownable(msg.sender) {
        require(_aflToken != address(0), "Token addr required");
        require(_buybackWallet != address(0) && _treasuryWallet != address(0), "Zero address");
        aflToken = IERC20(_aflToken);
        buybackWallet = _buybackWallet;
        treasuryWallet = _treasuryWallet;
    }

    // ─── Modifiers ────────────────────────────────────────────────────

    modifier updateReward(address account) {
        if (account != address(0)) {
            pendingRewards[account] = earned(account);
            if (stakes[account].amount > 0) {
                stakes[account].rewardDebt = rewardPerWeightStored;
            }
        }
        _;
    }

    // ─── View Functions ───────────────────────────────────────────────

    function stakeWeight(address account) public view returns (uint256) {
        Stake memory s = stakes[account];
        if (s.amount == 0) return 0;
        return (s.amount * s.multiplier) / BPS_DENOMINATOR;
    }

    function earned(address account) public view returns (uint256) {
        Stake memory s = stakes[account];
        uint256 acc = pendingRewards[account];
        if (s.amount == 0) return acc;

        uint256 weight = (s.amount * s.multiplier) / BPS_DENOMINATOR;
        uint256 delta = rewardPerWeightStored - s.rewardDebt;
        uint256 reward = (weight * delta) / 1e18;
        return acc + reward;
    }

    function getStake(address user) external view returns (Stake memory) {
        return stakes[user];
    }

    function vaultStats() external view returns (uint256 _totalStaked, uint256 _prizePool, uint256 _rewardPerWeight) {
        return (totalStaked, prizePool, rewardPerWeightStored);
    }

    // ─── User Actions ─────────────────────────────────────────────────

    /**
     * @param amount Token amount to deposit (gross, fee deducted from this)
     * @param lockPeriodIndex 0=30d, 1=90d, 2=180d
     */
    function deposit(uint256 amount, uint256 lockPeriodIndex)
        external
        nonReentrant
        updateReward(msg.sender)
    {
        require(amount > 0, "Amount must be > 0");
        require(lockPeriodIndex < lockPeriods.length, "Invalid lock period");
        require(stakes[msg.sender].amount == 0, "Already staking: withdraw first");

        aflToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 fee = (amount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 staked = amount - fee;

        _distributeFee(fee);

        uint256 multiplier = lockMultipliers[lockPeriodIndex];
        uint256 weight = (staked * multiplier) / BPS_DENOMINATOR;

        stakes[msg.sender] = Stake({
            amount: staked,
            lockEnd: block.timestamp + lockPeriods[lockPeriodIndex],
            multiplier: multiplier,
            rewardDebt: rewardPerWeightStored
        });

        totalStaked += staked;
        totalWeightedStaked += weight;

        _allocateUnallocatedRewards();

        emit Deposited(msg.sender, staked, fee, lockPeriodIndex);
    }

    function withdraw() external nonReentrant updateReward(msg.sender) {
        Stake memory s = stakes[msg.sender];
        require(s.amount > 0, "Nothing staked");
        require(block.timestamp >= s.lockEnd, "Still locked");

        uint256 gross = s.amount;
        uint256 fee = (gross * FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = gross - fee;

        uint256 weight = (gross * s.multiplier) / BPS_DENOMINATOR;

        totalStaked -= gross;
        totalWeightedStaked -= weight;
        delete stakes[msg.sender];

        _distributeFee(fee);

        uint256 reward = pendingRewards[msg.sender];
        if (reward > 0) {
            pendingRewards[msg.sender] = 0;
            aflToken.safeTransfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }

        aflToken.safeTransfer(msg.sender, payout);
        emit Withdrawn(msg.sender, payout, fee);
    }

    function claimRewards() external nonReentrant updateReward(msg.sender) {
        uint256 reward = pendingRewards[msg.sender];
        require(reward > 0, "No rewards");
        pendingRewards[msg.sender] = 0;
        aflToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    // ─── Commissioner Actions ─────────────────────────────────────────

    /**
     * @notice Funds staking rewards (separate from the 2.5% fee split).
     * @dev Owner must approve this contract for `amount` first.
     */
    function fundRewards(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        aflToken.safeTransferFrom(msg.sender, address(this), amount);
        if (totalWeightedStaked == 0) {
            unallocatedRewards += amount;
        } else {
            rewardPerWeightStored += (amount * 1e18) / totalWeightedStaked;
        }
        emit RewardsFunded(amount);
    }

    /**
     * @notice Called by owner at season end to send prize pool to playoff winner.
     * @param winner Wallet address of the winning agent's owner.
     */
    function distributePrize(address winner) external onlyOwner nonReentrant {
        require(winner != address(0), "Invalid winner address");
        uint256 amount = prizePool;
        require(amount > 0, "Prize pool empty");
        prizePool = 0;
        aflToken.safeTransfer(winner, amount);
        emit PrizeDistributed(winner, amount);
    }

    function updateWallets(address _buyback, address _treasury) external onlyOwner {
        require(_buyback != address(0) && _treasury != address(0), "Zero address");
        buybackWallet = _buyback;
        treasuryWallet = _treasury;
        emit WalletsUpdated(_buyback, _treasury);
    }

    // ─── Internal ─────────────────────────────────────────────────────

    function _allocateUnallocatedRewards() internal {
        uint256 amount = unallocatedRewards;
        if (amount == 0 || totalWeightedStaked == 0) return;
        unallocatedRewards = 0;
        rewardPerWeightStored += (amount * 1e18) / totalWeightedStaked;
    }

    function _distributeFee(uint256 fee) internal {
        if (fee == 0) return;
        uint256 buybackAmt = (fee * BUYBACK_SHARE) / 100;
        uint256 treasuryAmt = (fee * TREASURY_SHARE) / 100;
        uint256 prizeAmt = fee - buybackAmt - treasuryAmt; // includes rounding remainder

        aflToken.safeTransfer(buybackWallet, buybackAmt);
        aflToken.safeTransfer(treasuryWallet, treasuryAmt);

        prizePool += prizeAmt;

        emit FeeDistributed(buybackAmt, treasuryAmt, prizeAmt);
    }
}

