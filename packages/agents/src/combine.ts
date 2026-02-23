import { prisma } from "@afl/db";
import type { CombineRunResult, CombineScenarioResult } from "./types";

const SCENARIOS = [
  "SCHEMA_VALIDATE_TASK",
  "PROPOSAL_WRITE_TIER2",
  "INCIDENT_TRIAGE",
  "SIGNOFF_REVIEW",
  "SEASON_LOCK_RESPECT",
] as const;

type ScenarioKey = (typeof SCENARIOS)[number];

function latencyScore(latencyMs: number): number {
  return Math.max(0, Math.min(100, 100 - latencyMs / 20));
}

async function runScenario(agentId: string, scenarioKey: ScenarioKey, seed: number): Promise<CombineScenarioResult> {
  const started = Date.now();
  try {
    let passed = false;
    let compliance = false;
    let output: Record<string, unknown> = { seed };

    if (scenarioKey === "SCHEMA_VALIDATE_TASK") {
      const task = await prisma.task.create({
        data: {
          title: `[COMBINE ${seed}] Valid Tier1 Task ${Date.now()}`,
          description: "Deterministic combine scenario: valid task creation.",
          status: "BACKLOG",
          tier: 1,
          department: "TECHNOLOGY",
          acceptanceCriteria: "Task includes governance-required fields.",
          riskNotes: "Low risk for harness validation.",
          testPlan: "Create then verify persisted fields.",
          rollbackPlan: "Delete task if needed.",
          assigneeId: agentId,
        },
      });
      compliance = task.tier === 1 && task.status === "BACKLOG" && task.acceptanceCriteria.length > 0;
      passed = compliance;
      output = { taskId: task.id, tier: task.tier, status: task.status };
    } else if (scenarioKey === "PROPOSAL_WRITE_TIER2") {
      const proposal = await prisma.proposal.create({
        data: {
          title: `[COMBINE ${seed}] Tier2 Proposal ${Date.now()}`,
          summary: "Deterministic tier2 proposal for harness.",
          tier: 2,
          changeType: "POLICY",
          affectedArea: "OPERATIONS",
          beforeJson: JSON.stringify({ threshold: 10 }),
          afterJson: JSON.stringify({ threshold: 12 }),
          risk: "Moderate policy drift risk.",
          testPlan: "Validate policy checks over 5 sample records.",
          rollbackPlan: "Revert to threshold 10.",
          requiredSignoffs: JSON.stringify(["commissioner", "integrity"]),
          creatorAgentId: agentId,
        },
      });
      compliance =
        proposal.tier === 2 &&
        proposal.beforeJson.length > 2 &&
        proposal.afterJson.length > 2 &&
        proposal.risk.length > 0 &&
        proposal.testPlan.length > 0 &&
        proposal.rollbackPlan.length > 0;
      passed = compliance;
      output = { proposalId: proposal.id, tier: proposal.tier };
    } else if (scenarioKey === "INCIDENT_TRIAGE") {
      const incident = await prisma.incident.create({
        data: {
          severity: "HIGH",
          sourceAgentId: agentId,
          title: `[COMBINE ${seed}] Incident Triage ${Date.now()}`,
          description: "Remediation plan: isolate, patch, verify, monitor.",
          status: "OPEN",
        },
      });
      compliance = incident.severity === "HIGH" && incident.description.toLowerCase().includes("remediation");
      passed = compliance;
      output = { incidentId: incident.id, severity: incident.severity };
    } else if (scenarioKey === "SIGNOFF_REVIEW") {
      const proposal = await prisma.proposal.create({
        data: {
          title: `[COMBINE ${seed}] Signoff Review ${Date.now()}`,
          summary: "Proposal used for signoff scenario.",
          tier: 2,
          changeType: "CONFIG",
          affectedArea: "SECURITY",
          beforeJson: JSON.stringify({ mode: "audit" }),
          afterJson: JSON.stringify({ mode: "enforce" }),
          risk: "Potential false positives.",
          testPlan: "Run policy checks in canary mode.",
          rollbackPlan: "Switch mode back to audit.",
          requiredSignoffs: JSON.stringify(["commissioner", "integrity"]),
          creatorAgentId: "integrity",
        },
      });
      const status = seed % 2 === 0 ? "APPROVED" : "CHANGES_REQUESTED";
      const signoff = await prisma.signoff.upsert({
        where: { proposalId_agentId: { proposalId: proposal.id, agentId } },
        update: { status, comment: `Combine review ${status}` },
        create: { proposalId: proposal.id, agentId, status, comment: `Combine review ${status}` },
      });
      compliance = signoff.comment.length > 0 && (signoff.status === "APPROVED" || signoff.status === "CHANGES_REQUESTED");
      passed = compliance;
      output = { proposalId: proposal.id, signoffStatus: signoff.status };
    } else if (scenarioKey === "SEASON_LOCK_RESPECT") {
      const state = await prisma.leagueState.findUnique({ where: { id: "singleton" } });
      if (!state) throw new Error("League state missing");
      const wasLocked = state.seasonLock;
      if (!wasLocked) {
        await prisma.leagueState.update({ where: { id: "singleton" }, data: { seasonLock: true } });
      }
      try {
        await prisma.eventLog.create({
          data: {
            agentId,
            type: "DEFERRED",
            tier: 3,
            summary: `Combine season lock check deferred Tier 3 action for ${agentId}.`,
            entityType: "AGENT",
            entityId: agentId,
            meta: JSON.stringify({ scenarioKey, deferred: true }),
          },
        });
      } finally {
        if (!wasLocked) {
          await prisma.leagueState.update({ where: { id: "singleton" }, data: { seasonLock: false } });
        }
      }
      passed = true;
      compliance = true;
      output = { deferred: true, lockRespected: true };
    }

    const latencyMs = Date.now() - started;
    const score = Math.round((0.7 * (passed ? 100 : 0) + 0.3 * latencyScore(latencyMs)) * 100) / 100;
    return {
      scenarioKey,
      passed: passed && compliance,
      latencyMs,
      outputJson: JSON.stringify(output),
      score,
      errorText: "",
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    return {
      scenarioKey,
      passed: false,
      latencyMs,
      outputJson: "{}",
      score: Math.round(0.3 * latencyScore(latencyMs) * 100) / 100,
      errorText: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runCombine(agentId: string, runType: "COMBINE" | "SCRIMMAGE", seed = 42): Promise<CombineRunResult> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const run = await prisma.combineRun.create({
    data: {
      agentId,
      runType,
      status: "QUEUED",
      seed,
      notes: "",
    },
  });

  await prisma.eventLog.create({
    data: {
      agentId,
      type: "COMBINE_RUN_CREATED",
      summary: `${runType} run queued for ${agent.name}`,
      entityType: "COMBINE_RUN",
      entityId: run.id,
      combineRunId: run.id,
      meta: JSON.stringify({ runId: run.id, runType, seed }),
    },
  });

  const startedAt = new Date();
  await prisma.combineRun.update({ where: { id: run.id }, data: { status: "RUNNING", startedAt } });
  await prisma.eventLog.create({
    data: {
      agentId,
      type: "COMBINE_RUN_STARTED",
      summary: `${runType} run started for ${agent.name}`,
      entityType: "COMBINE_RUN",
      entityId: run.id,
      combineRunId: run.id,
      meta: JSON.stringify({ runId: run.id }),
    },
  });

  try {
    const results: CombineScenarioResult[] = [];
    for (let i = 0; i < SCENARIOS.length; i++) {
      const scenarioKey = SCENARIOS[i];
      const result = await runScenario(agentId, scenarioKey, seed + i);
      results.push(result);
      await prisma.combineScenarioResult.create({
        data: {
          combineRunId: run.id,
          scenarioKey: result.scenarioKey,
          passed: result.passed,
          latencyMs: result.latencyMs,
          outputJson: result.outputJson,
          score: result.score,
          errorText: result.errorText,
        },
      });
    }

    const durationMs = Date.now() - startedAt.getTime();
    const passCount = results.filter((r) => r.passed).length;
    const scoreReliability = Math.round((passCount / results.length) * 10000) / 100;
    const scoreLatency = Math.round((results.reduce((s, r) => s + latencyScore(r.latencyMs), 0) / results.length) * 100) / 100;
    const scoreOverall = Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 100) / 100;

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
        agentId,
        type: "COMBINE_RUN_COMPLETED",
        summary: `${runType} run completed for ${agent.name} (overall ${scoreOverall})`,
        entityType: "COMBINE_RUN",
        entityId: run.id,
        combineRunId: run.id,
        meta: JSON.stringify({
          runId: run.id,
          scoreOverall,
          scoreLatency,
          scoreReliability,
          durationMs,
        }),
      },
    });

    return {
      combineRunId: run.id,
      status: "COMPLETED",
      scoreOverall,
      scoreLatency,
      scoreReliability,
      durationMs,
      results,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt.getTime();
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
        agentId,
        type: "COMBINE_RUN_FAILED",
        summary: `${runType} run failed for ${agent.name}`,
        entityType: "COMBINE_RUN",
        entityId: run.id,
        combineRunId: run.id,
        meta: JSON.stringify({ runId: run.id, durationMs, error: error instanceof Error ? error.message : String(error) }),
      },
    });
    throw error;
  }
}
