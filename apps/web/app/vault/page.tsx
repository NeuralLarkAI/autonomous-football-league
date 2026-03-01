"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ConnectKitButton } from "connectkit";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi, formatUnits, isAddress, maxUint256, parseUnits } from "viem";
import { AFL_TOKEN_ADDRESS, AFL_VAULT_ADDRESS } from "@/lib/contracts";
import { AFL_VAULT_ABI } from "@/lib/afl-vault-abi";

const LOCKS = [
  { label: "30 days", index: 0, multiplierLabel: "1.0x" },
  { label: "90 days", index: 1, multiplierLabel: "1.2x" },
  { label: "180 days", index: 2, multiplierLabel: "1.5x" },
] as const;

function fmtAfl(amount: bigint | undefined, decimals = 2) {
  if (amount == null) return "—";
  const s = formatUnits(amount, 18);
  const [whole, frac = ""] = s.split(".");
  const fracTrimmed = frac.slice(0, decimals).padEnd(decimals, "0");
  return decimals > 0 ? `${whole}.${fracTrimmed}` : whole;
}

function secondsToHms(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function VaultPage() {
  const { address, isConnected, chain } = useAccount();
  const [amountText, setAmountText] = useState("1000");
  const [lockIndex, setLockIndex] = useState<(typeof LOCKS)[number]["index"]>(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const configured = useMemo(
    () => isAddress(AFL_VAULT_ADDRESS) && isAddress(AFL_TOKEN_ADDRESS),
    []
  );

  const depositAmount = useMemo(() => {
    try {
      if (!amountText.trim()) return 0n;
      return parseUnits(amountText, 18);
    } catch {
      return 0n;
    }
  }, [amountText]);

  const feeAmount = useMemo(() => (depositAmount * 250n) / 10000n, [depositAmount]);
  const netStaked = useMemo(() => (depositAmount > feeAmount ? depositAmount - feeAmount : 0n), [depositAmount, feeAmount]);

  const { data: vaultStats } = useReadContract({
    address: AFL_VAULT_ADDRESS,
    abi: AFL_VAULT_ABI,
    functionName: "vaultStats",
    query: { enabled: configured },
  });

  const { data: stake } = useReadContract({
    address: AFL_VAULT_ADDRESS,
    abi: AFL_VAULT_ABI,
    functionName: "getStake",
    args: address ? [address] : undefined,
    query: { enabled: configured && Boolean(address) },
  });

  const { data: earned } = useReadContract({
    address: AFL_VAULT_ADDRESS,
    abi: AFL_VAULT_ABI,
    functionName: "earned",
    args: address ? [address] : undefined,
    query: { enabled: configured && Boolean(address) },
  });

  const { data: allowance } = useReadContract({
    address: AFL_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, AFL_VAULT_ADDRESS] : undefined,
    query: { enabled: configured && Boolean(address) },
  });

  const { data: balance } = useReadContract({
    address: AFL_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: configured && Boolean(address) },
  });

  const needsApproval = useMemo(() => {
    if (!isConnected) return false;
    if (!configured) return false;
    if (depositAmount <= 0n) return false;
    const a = allowance ?? 0n;
    return a < depositAmount;
  }, [allowance, configured, depositAmount, isConnected]);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: waiting, isSuccess: mined } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (txHash) toast.success(`Transaction submitted: ${txHash.slice(0, 10)}…`);
  }, [txHash]);

  useEffect(() => {
    if (mined) toast.success("Transaction confirmed.");
  }, [mined]);

  const onApprove = async () => {
    try {
      writeContract({
        address: AFL_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [AFL_VAULT_ADDRESS, maxUint256],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    }
  };

  const onStake = async () => {
    try {
      if (depositAmount <= 0n) {
        toast.error("Enter an amount to stake.");
        return;
      }
      writeContract({
        address: AFL_VAULT_ADDRESS,
        abi: AFL_VAULT_ABI,
        functionName: "deposit",
        args: [depositAmount, BigInt(lockIndex)],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stake failed");
    }
  };

  const onClaimRewards = async () => {
    try {
      writeContract({
        address: AFL_VAULT_ADDRESS,
        abi: AFL_VAULT_ABI,
        functionName: "claimRewards",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    }
  };

  const onWithdraw = async () => {
    try {
      writeContract({
        address: AFL_VAULT_ADDRESS,
        abi: AFL_VAULT_ABI,
        functionName: "withdraw",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdraw failed");
    }
  };

  const totalStaked = (vaultStats as readonly [bigint, bigint, bigint] | undefined)?.[0];
  const prizePool = (vaultStats as readonly [bigint, bigint, bigint] | undefined)?.[1];

  const stakeAmount = (stake as { amount: bigint; lockEnd: bigint; multiplier: bigint; rewardDebt: bigint } | undefined)?.amount ?? 0n;
  const lockEnd = (stake as { lockEnd: bigint } | undefined)?.lockEnd ?? 0n;
  const lockEndMs = Number(lockEnd) * 1000;
  const remainingSeconds = lockEnd > 0n ? Math.max(0, Math.floor((lockEndMs - now) / 1000)) : 0;

  const hasStake = stakeAmount > 0n;
  const rewards = (earned as bigint | undefined) ?? 0n;

  const actionBusy = isPending || waiting;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:py-10">
      <header className="rounded-3xl border border-cyan-300/20 bg-slate-950/55 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">AFL Vault</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">
              Lock $AFL. Earn yield. Fund the playoffs.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              2.5% fee on deposit &amp; withdraw. 25% of fees accrue to the on-chain prize pool for the season winner.
            </p>
          </div>
          <div className="shrink-0">
            <ConnectKitButton />
            {chain?.name && <p className="mt-2 text-xs text-slate-500">Network: {chain.name}</p>}
          </div>
        </div>
      </header>

      {!configured && (
        <div className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
          Vault not configured. Set <code className="font-mono">NEXT_PUBLIC_AFL_VAULT_ADDRESS</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_AFL_TOKEN_ADDRESS</code>.
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Total Staked</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{fmtAfl(totalStaked)} $AFL</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Prize Pool</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{fmtAfl(prizePool)} $AFL</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Your Stake</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">
            {isConnected ? `${fmtAfl(stakeAmount)} $AFL` : "—"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 md:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Deposit &amp; Lock
          </h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Amount ($AFL)
              </label>
              <input
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                inputMode="decimal"
                placeholder="1000"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-200 focus:border-cyan-400/70 focus:outline-none"
              />
              {isConnected && (
                <p className="text-xs text-slate-500">
                  Balance: <span className="font-mono">{fmtAfl(balance as bigint | undefined, 4)}</span> $AFL
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Lock Period</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {LOCKS.map((l) => {
                  const active = lockIndex === l.index;
                  return (
                    <button
                      key={l.index}
                      type="button"
                      onClick={() => setLockIndex(l.index)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-cyan-400/70 bg-cyan-500/10"
                          : "border-white/10 bg-slate-950/40 hover:bg-slate-900/50"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-100">{l.label}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Multiplier: {l.multiplierLabel}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
              <p>
                Deposit fee (2.5%):{" "}
                <span className="font-mono text-slate-100">{fmtAfl(feeAmount, 6)}</span> $AFL
              </p>
              <p className="mt-1">
                You will stake:{" "}
                <span className="font-mono text-slate-100">{fmtAfl(netStaked, 6)}</span> $AFL
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!isConnected || !needsApproval || actionBusy}
                onClick={onApprove}
                className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
              >
                {actionBusy ? "Pending..." : "Approve $AFL"}
              </button>
              <button
                type="button"
                disabled={!isConnected || needsApproval || depositAmount <= 0n || actionBusy || !configured}
                onClick={onStake}
                className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
              >
                {actionBusy ? "Pending..." : "Stake"}
              </button>
            </div>
            {!isConnected && <p className="text-xs text-slate-500">Connect your wallet to approve and stake.</p>}
            {isConnected && needsApproval && (
              <p className="text-xs text-slate-500">
                Approval needed: allowance{" "}
                <span className="font-mono">{fmtAfl((allowance as bigint | undefined) ?? 0n, 6)}</span> $AFL
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {hasStake && (
            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 md:p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
                Your Position
              </h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>
                  Staked: <span className="font-mono text-slate-100">{fmtAfl(stakeAmount, 6)}</span> $AFL
                </p>
                <p>
                  Lock ends:{" "}
                  <span className="font-mono text-slate-100">
                    {lockEnd > 0n ? new Date(lockEndMs).toLocaleString() : "—"}
                  </span>
                </p>
                <p>
                  Time remaining:{" "}
                  <span className="font-mono text-slate-100">
                    {lockEnd > 0n ? secondsToHms(remainingSeconds) : "—"}
                  </span>
                </p>
                <p>
                  Pending rewards:{" "}
                  <span className="font-mono text-slate-100">{fmtAfl(rewards, 6)}</span> $AFL
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!isConnected || rewards <= 0n || actionBusy}
                  onClick={onClaimRewards}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                >
                  Claim Rewards
                </button>
                <button
                  type="button"
                  disabled={!isConnected || remainingSeconds > 0 || actionBusy}
                  onClick={onWithdraw}
                  className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
                >
                  Withdraw
                </button>
              </div>
              {remainingSeconds > 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  Withdraw is disabled until the lock expires.
                </p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 md:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Fee Breakdown
            </h2>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
              <p className="font-semibold text-slate-100">2.5% transaction fee</p>
              <div className="mt-3 space-y-1">
                <p>50% → Token Buyback (strengthens $AFL price)</p>
                <p>25% → Treasury (league operations)</p>
                <p>25% → Playoff Prize Pool (season winner takes all)</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 md:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
              Safety Notes
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-400">
              <li>Do not deposit on mainnet until the contract is audited.</li>
              <li>Deposits are locked for the full period and cannot be withdrawn early.</li>
              <li>Rewards must be funded separately by the commissioner (not from fees).</li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}

