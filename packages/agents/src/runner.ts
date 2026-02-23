import { prisma } from "@afl/db";
import { TASK_TEMPLATES } from "./tasks";
import type { AgentRunResult } from "./types";

export async function runAgent(agentId: string): Promise<AgentRunResult> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const league = await prisma.leagueState.findUnique({ where: { id: "singleton" } });
  const seasonLocked = league?.seasonLock ?? false;

  const templates = TASK_TEMPLATES[agentId] ?? [];
  let tasksCreated = 0;
  let approvalsCreated = 0;
  let eventsCreated = 0;

  for (const tmpl of templates) {
    const existing = await prisma.task.findFirst({ where: { title: tmpl.title } });
    if (existing) continue;

    if (seasonLocked && tmpl.tier >= 2) {
      await prisma.eventLog.create({
        data: {
          agentId: agent.id,
          type: "AGENT_RUN",
          summary: `[DEFERRED] ${agent.name} deferred Tier ${tmpl.tier} task \"${tmpl.title}\" - season locked.`,
          meta: JSON.stringify({ agentId, task: tmpl.title, tier: tmpl.tier }),
        },
      });
      eventsCreated++;
      continue;
    }

    const task = await prisma.task.create({
      data: {
        title: tmpl.title,
        description: tmpl.description,
        department: tmpl.department,
        tier: tmpl.tier,
        status: "BACKLOG",
        assigneeId: agent.id,
        acceptanceCriteria: tmpl.acceptanceCriteria,
        riskNotes: tmpl.riskNotes,
        testPlan: tmpl.testPlan,
        rollbackPlan: tmpl.rollbackPlan,
      },
    });
    tasksCreated++;

    if (tmpl.requiresApproval && tmpl.approvalSummary) {
      await prisma.approval.create({
        data: {
          taskId: task.id,
          agentId: agent.id,
          tier: tmpl.tier,
          summary: tmpl.approvalSummary,
          status: "PENDING",
        },
      });
      approvalsCreated++;

      await prisma.eventLog.create({
        data: {
          agentId: agent.id,
          type: "APPROVAL_CREATED",
          summary: `${agent.name} created Tier ${tmpl.tier} approval: \"${tmpl.approvalSummary}\"`,
          meta: JSON.stringify({ taskId: task.id, tier: tmpl.tier }),
        },
      });
      eventsCreated++;
    }

    await prisma.eventLog.create({
      data: {
        agentId: agent.id,
        type: "TASK_CREATED",
        summary: `${agent.name} created task \"${tmpl.title}\" [Tier ${tmpl.tier}]`,
        meta: JSON.stringify({ taskId: task.id, tier: tmpl.tier, department: tmpl.department }),
      },
    });
    eventsCreated++;
  }

  await prisma.eventLog.create({
    data: {
      agentId: agent.id,
      type: "AGENT_RUN",
      summary: `${agent.name} run complete - ${tasksCreated} task(s) created, ${approvalsCreated} approval(s) queued.`,
      meta: JSON.stringify({ agentId, tasksCreated, approvalsCreated }),
    },
  });
  eventsCreated++;

  return {
    tasksCreated,
    approvalsCreated,
    eventsCreated,
    summary: `${agent.name}: ${tasksCreated} tasks, ${approvalsCreated} approvals`,
  };
}

export async function runKickoff(): Promise<{
  totalTasks: number;
  totalApprovals: number;
  agentResults: AgentRunResult[];
}> {
  const KICKOFF_ORDER = [
    "commissioner",
    "architect",
    "security",
    "integrity",
    "program-manager",
    "backend-engineer",
    "qa-engineer",
    "sre",
    "rules-committee",
    "scheduler",
    "rankings",
  ];

  const league = await prisma.leagueState.findUnique({ where: { id: "singleton" } });
  if (league?.seasonLock) {
    await prisma.eventLog.create({
      data: {
        type: "KICKOFF",
        summary: "Season 0 Kickoff blocked: season is locked.",
        meta: JSON.stringify({ seasonLock: true }),
      },
    });
    throw new Error("Season is locked. Unlock season before kickoff.");
  }

  await prisma.eventLog.create({
    data: {
      type: "KICKOFF",
      summary: "Season 0 Kickoff initiated - running all department agents.",
      meta: JSON.stringify({ agents: KICKOFF_ORDER }),
    },
  });

  const results: AgentRunResult[] = [];
  for (const agentId of KICKOFF_ORDER) {
    try {
      const result = await runAgent(agentId);
      results.push(result);
    } catch (error) {
      console.error(`Agent ${agentId} failed:`, error);
    }
  }

  const totalTasks = results.reduce((sum, result) => sum + result.tasksCreated, 0);
  const totalApprovals = results.reduce((sum, result) => sum + result.approvalsCreated, 0);
  const [taskCount, tier23Approvals] = await Promise.all([
    prisma.task.count(),
    prisma.approval.count({ where: { tier: { gte: 2 } } }),
  ]);

  if (taskCount < 30 || tier23Approvals === 0) {
    await prisma.eventLog.create({
      data: {
        type: "KICKOFF",
        summary: "Season 0 Kickoff incomplete - expected >=30 tasks and Tier 2/3 approvals.",
        meta: JSON.stringify({ totalTasks, totalApprovals, taskCount, tier23Approvals }),
      },
    });
    throw new Error("Kickoff did not meet baseline: >=30 tasks and Tier 2/3 approvals.");
  }

  await prisma.eventLog.create({
    data: {
      type: "KICKOFF",
      summary: `Season 0 Kickoff complete - ${taskCount} total tasks, ${tier23Approvals} Tier 2/3 approvals present.`,
      meta: JSON.stringify({ totalTasks, totalApprovals, taskCount, tier23Approvals }),
    },
  });

  return { totalTasks, totalApprovals, agentResults: results };
}
