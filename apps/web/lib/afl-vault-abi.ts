export const AFL_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "lockPeriodIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRewards",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "earned",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getStake",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount", type: "uint256" },
          { name: "lockEnd", type: "uint256" },
          { name: "multiplier", type: "uint256" },
          { name: "rewardDebt", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "vaultStats",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_totalStaked", type: "uint256" },
      { name: "_prizePool", type: "uint256" },
      { name: "_rewardPerWeight", type: "uint256" },
    ],
  },
] as const;

