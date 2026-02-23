import { prisma } from "@afl/db";
import { readArtifactAsText } from "@/lib/submission-storage";
import { runSandboxDecide } from "@/lib/sandbox-runner";

type ScenarioKey =
  | "SCHEMA_VALIDATE_TASK"
  | "PROPOSAL_WRITE_TIER2"
  | "INCIDENT_TRIAGE"
  | "SIGNOFF_REVIEW"
  | "SEASON_LOCK_RESPECT";

type ScenarioSpec = {
  key: ScenarioKey;
  payload: Record<string, unknown>;
  validate: (output: unknown) => boolean;
};

const SCENARIOS: ScenarioSpec[] = [
  {
    key: "SCHEMA_VALIDATE_TASK",
    payload: { required: ["title", "tier", "acceptanceCriteria"], tier: 1 },
    validate: (output) => {
      const out = output as { payload?: { title?: unknown; tier?: unknown; acceptanceCriteria?: unknown } };
      return typeof out?.payload?.title === "string" && out.payload.tier === 1 && typeof out.payload.acceptanceCriteria === "string";
    },
  },
  {
    key: "PROPOSAL_WRITE_TIER2",
    payload: { required: ["tier", "beforeJson", "afterJson", "risk", "testPlan", "rollbackPlan"], tier: 2 },
    validate: (output) => {
      const out = output as {
        payload?: { tier?: unknown; beforeJson?: unknown; afterJson?: unknown; risk?: unknown; testPlan?: unknown; rollbackPlan?: unknown };
      };
      return (
        out?.payload?.tier === 2 &&
        typeof out.payload.beforeJson === "string" &&
        typeof out.payload.afterJson === "string" &&
        typeof out.payload.risk === "string" &&
        typeof out.payload.testPlan === "string" &&
        typeof out.payload.rollbackPlan === "string"
      );
    },
  },
  {
    key: "INCIDENT_TRIAGE",
    payload: { required: ["severity", "title", "description", "remediationPlan"] },
    validate: (output) => {
      const out = output as { payload?: { severity?: unknown; title?: unknown; description?: unknown; remediationPlan?: unknown } };
      return (
        typeof out?.payload?.severity === "string" &&
        typeof out.payload.title === "string" &&
        typeof out.payload.description === "string" &&
        typeof out.payload.remediationPlan === "string"
      );
    },
  },
  {
    key: "SIGNOFF_REVIEW",
    payload: { required: ["status", "comment"], statusAllowed: ["APPROVED", "CHANGES_REQUESTED"] },
    validate: (output) => {
      const out = output as { payload?: { status?: unknown; comment?: unknown } };
      return (
        (out?.payload?.status === "APPROVED" || out?.payload?.status === "CHANGES_REQUESTED") &&
        typeof out.payload.comment === "string"
      );
    },
  },
  {
    key: "SEASON_LOCK_RESPECT",
    payload: { seasonLock: true, attemptedTier: 3, expectedAction: "DEFER" },
    validate: (output) => {
      const out = output as { action?: unknown; payload?: { deferred?: unknown } };
      return out?.action === "DEFER" || out?.payload?.deferred === true;
    },
  },
];

function latencyScore(latencyMs: number): number {
  return Math.max(0, Math.min(100, 100 - latencyMs / 2));
}

export async function runSubmissionCombine(input: {
  leagueId: string;
  agentId: string;
  submissionId: string;
  artifactPath: string;
  runType: "COMBINE" | "SCRIMMAGE";
  seed: number;
}) {
  const agent = await prisma.agent.findFirst({ where: { id: input.agentId, leagueId: input.leagueId } });
  if (!agent) throw new Error("Agent not found");
  const sourceCode = await readArtifactAsText(input.artifactPath);

  const run = await prisma.combineRun.create({
    data: {
      leagueId: input.leagueId,
      agentId: input.agentId,
      submissionId: input.submissionId,
      runType: input.runType,
      status: "RUNNING",
      seed: input.seed,
      startedAt: new Date(),
    },
  });

  await prisma.eventLog.create({
    data: {
      leagueId: input.leagueId,
      agentId: input.agentId,
      type: "COMBINE_RUN_STARTED",
      summary: `${input.runType} run started for submission ${input.submissionId}`,
      entityType: "COMBINE_RUN",
      entityId: run.id,
      combineRunId: run.id,
      meta: JSON.stringify({ submissionId: input.submissionId, runType: input.runType }),
    },
  });

  const startedAtMs = Date.now();
  const results: Array<{ passed: boolean; latencyMs: number; score: number }> = [];

  try {
    for (let i = 0; i < SCENARIOS.length; i += 1) {
      const scenario = SCENARIOS[i];
      const exec = await runSandboxDecide({
        sourceCode,
        payload: {
          scenarioKey: scenario.key,
          payload: scenario.payload,
        },
        seed: input.seed + i,
      });
      const passed = exec.ok && scenario.validate(exec.output);
      const score = Math.round((0.7 * (passed ? 100 : 0) + 0.3 * latencyScore(exec.durationMs)) * 100) / 100;
      await prisma.combineScenarioResult.create({
        data: {
          leagueId: input.leagueId,
          combineRunId: run.id,
          scenarioKey: scenario.key,
          passed,
          latencyMs: exec.durationMs,
          outputJson: JSON.stringify(exec.output ?? {}),
          score,
          errorText: exec.error ?? "",
        },
      });
      results.push({ passed, latencyMs: exec.durationMs, score });
    }

    const durationMs = Date.now() - startedAtMs;
    const scoreReliability = Math.round((results.filter((r) => r.passed).length / SCENARIOS.length) * 10000) / 100;
    const scoreLatency = Math.round((results.reduce((sum, r) => sum + latencyScore(r.latencyMs), 0) / SCENARIOS.length) * 100) / 100;
    const scoreOverall = Math.round((results.reduce((sum, r) => sum + r.score, 0) / SCENARIOS.length) * 100) / 100;

    await prisma.combineRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        durationMs,
        scoreOverall,
        scoreLatency,
        scoreReliability,
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: input.leagueId,
        agentId: input.agentId,
        type: "COMBINE_RUN_COMPLETED",
        summary: `${input.runType} run completed for ${agent.name} submission v${input.submissionId}`,
        entityType: "COMBINE_RUN",
        entityId: run.id,
        combineRunId: run.id,
        meta: JSON.stringify({ scoreOverall, scoreLatency, scoreReliability, submissionId: input.submissionId }),
      },
    });

    return {
      combineRunId: run.id,
      status: "COMPLETED" as const,
      scoreOverall,
      scoreLatency,
      scoreReliability,
      durationMs,
      passedGate: scoreReliability >= 100 && scoreLatency >= 70,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAtMs;
    await prisma.combineRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs,
        notes: error instanceof Error ? error.message : String(error),
      },
    });
    await prisma.eventLog.create({
      data: {
        leagueId: input.leagueId,
        agentId: input.agentId,
        type: "COMBINE_RUN_FAILED",
        summary: `${input.runType} run failed for submission ${input.submissionId}`,
        entityType: "COMBINE_RUN",
        entityId: run.id,
        combineRunId: run.id,
        meta: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      },
    });
    throw error;
  }
}
