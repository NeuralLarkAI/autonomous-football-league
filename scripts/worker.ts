import os from "node:os";
import crypto from "node:crypto";
import { prisma } from "@afl/db";
import { executeRunbookAction } from "../apps/web/lib/runbook-actions";

const POLL_MS = Number(process.env.AFL_WORKER_POLL_MS ?? 3000);
const STALE_LOCK_MS = 2 * 60 * 1000;
const MAX_GLOBAL_CONCURRENCY = 2;
const RUNBOOK_TIMEOUT_MS = Number(process.env.AFL_WORKER_RUNBOOK_TIMEOUT_MS ?? 60_000);

const instanceId = `${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
const runningLeagues = new Set<string>();
let activeExecutions = 0;
let stopped = false;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timer));
  });
}

async function scheduleNextOnSuccess(runbookId: string, intervalSeconds: number | null) {
  const now = new Date();
  const seconds = Math.max(5, intervalSeconds ?? 60);
  await prisma.runbook.update({
    where: { id: runbookId },
    data: {
      lastRunAt: now,
      nextRunAt: new Date(now.getTime() + seconds * 1000),
      lockedAt: null,
      lockOwner: null,
      failureCount: 0,
    },
  });
}

async function scheduleNextOnFailure(runbookId: string, intervalSeconds: number | null) {
  const latest = await prisma.runbook.findUnique({
    where: { id: runbookId },
    select: { failureCount: true, intervalSeconds: true },
  });
  const failureCount = (latest?.failureCount ?? 0) + 1;
  const base = Math.max(5, latest?.intervalSeconds ?? intervalSeconds ?? 60);
  const backoffSeconds = Math.min(base * Math.pow(2, failureCount), 3600);
  const now = Date.now();
  await prisma.runbook.update({
    where: { id: runbookId },
    data: {
      failureCount,
      nextRunAt: new Date(now + backoffSeconds * 1000),
      lockedAt: null,
      lockOwner: null,
    },
  });
}

async function runLockedRunbook(runbook: {
  id: string;
  leagueId: string;
  name: string;
  ownerAgentId: string | null;
  actionType: string;
  actionPayloadJson: string;
  intervalSeconds: number | null;
  nextRunAt: Date | null;
}) {
  const runbookRun = await prisma.runbookRun.create({
    data: {
      leagueId: runbook.leagueId,
      runbookId: runbook.id,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: runbook.leagueId,
      agentId: runbook.ownerAgentId ?? undefined,
      type: "RUNBOOK_DUE",
      summary: `Scheduled runbook due: ${runbook.name}`,
      entityType: "RUNBOOK",
      entityId: runbook.id,
      runbookId: runbook.id,
      runbookRunId: runbookRun.id,
      meta: JSON.stringify({ mode: "worker", nextRunAt: runbook.nextRunAt }),
    },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: runbook.leagueId,
      agentId: runbook.ownerAgentId ?? undefined,
      type: "RUNBOOK_STARTED",
      summary: `Scheduled runbook started: ${runbook.name}`,
      entityType: "RUNBOOK",
      entityId: runbook.id,
      runbookId: runbook.id,
      runbookRunId: runbookRun.id,
      meta: JSON.stringify({ mode: "worker", actionType: runbook.actionType }),
    },
  });

  try {
    const outputSummary = await withTimeout(
      executeRunbookAction(
        {
          id: runbook.id,
          leagueId: runbook.leagueId,
          name: runbook.name,
          ownerAgentId: runbook.ownerAgentId,
          actionType: runbook.actionType,
          actionPayloadJson: runbook.actionPayloadJson,
        },
        runbookRun.id
      ),
      RUNBOOK_TIMEOUT_MS,
      `Runbook ${runbook.name}`
    );

    await prisma.runbookRun.update({
      where: { id: runbookRun.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        outputSummary,
        errorText: null,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: runbook.leagueId,
        agentId: runbook.ownerAgentId ?? undefined,
        type: "RUNBOOK_COMPLETED",
        summary: `Scheduled runbook completed: ${runbook.name}`,
        entityType: "RUNBOOK",
        entityId: runbook.id,
        runbookId: runbook.id,
        runbookRunId: runbookRun.id,
        meta: JSON.stringify({ outputSummary, mode: "worker" }),
      },
    });

    await scheduleNextOnSuccess(runbook.id, runbook.intervalSeconds);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.runbookRun.update({
      where: { id: runbookRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        outputSummary: message,
        errorText: message,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: runbook.leagueId,
        agentId: runbook.ownerAgentId ?? undefined,
        type: "RUNBOOK_FAILED",
        summary: `Scheduled runbook failed: ${runbook.name}`,
        entityType: "RUNBOOK",
        entityId: runbook.id,
        runbookId: runbook.id,
        runbookRunId: runbookRun.id,
        meta: JSON.stringify({ error: message, mode: "worker" }),
      },
    });

    await scheduleNextOnFailure(runbook.id, runbook.intervalSeconds);
  }
}

async function tryAcquireDueRunbook(leagueId: string) {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_LOCK_MS);
  const due = await prisma.runbook.findFirst({
    where: {
      leagueId,
      isEnabled: true,
      triggerType: "SCHEDULED",
      nextRunAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleCutoff } }],
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      leagueId: true,
      name: true,
      ownerAgentId: true,
      actionType: true,
      actionPayloadJson: true,
      intervalSeconds: true,
      nextRunAt: true,
    },
  });
  if (!due) return null;

  const locked = await prisma.$transaction(async (tx) => {
    const result = await tx.runbook.updateMany({
      where: {
        id: due.id,
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleCutoff } }],
      },
      data: { lockedAt: now, lockOwner: instanceId },
    });
    if (result.count !== 1) return null;
    return due;
  });

  return locked;
}

async function tick() {
  if (stopped || activeExecutions >= MAX_GLOBAL_CONCURRENCY) return;

  const leagues = await prisma.leagueState.findMany({
    where: { autoRunEnabled: true },
    select: { leagueId: true },
  });
  if (leagues.length === 0) return;

  for (const league of leagues) {
    if (stopped || activeExecutions >= MAX_GLOBAL_CONCURRENCY) break;
    if (runningLeagues.has(league.leagueId)) continue;

    const dueRunbook = await tryAcquireDueRunbook(league.leagueId);
    if (!dueRunbook) continue;

    runningLeagues.add(league.leagueId);
    activeExecutions += 1;

    void (async () => {
      try {
        await runLockedRunbook(dueRunbook);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[worker] fatal runbook error for ${dueRunbook.id}: ${message}`);
        await scheduleNextOnFailure(dueRunbook.id, dueRunbook.intervalSeconds);
      } finally {
        activeExecutions = Math.max(0, activeExecutions - 1);
        runningLeagues.delete(league.leagueId);
      }
    })();
  }
}

function installSignalHandlers() {
  const shutdown = async () => {
    stopped = true;
    console.log("[worker] shutdown requested");
    const deadline = Date.now() + 20_000;
    while (activeExecutions > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

async function main() {
  installSignalHandlers();
  console.log(`[worker] started instance=${instanceId} pollMs=${POLL_MS}`);
  await tick();
  setInterval(() => void tick(), POLL_MS);
}

void main();
