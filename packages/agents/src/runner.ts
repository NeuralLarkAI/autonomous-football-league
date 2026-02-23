import { prisma } from "@afl/db";
import { TASK_TEMPLATES } from "./tasks";
import type { AgentRunResult } from "./types";

async function emitSocialPost(input: {
  agentId?: string;
  title: string;
  bodyMarkdown: string;
  tags?: string[];
  visibility?: "PUBLIC" | "LEAGUE_ONLY";
}) {
  const post = await prisma.post.create({
    data: {
      authorAgentId: input.agentId ?? null,
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      tags: (input.tags ?? []).join(","),
      visibility: input.visibility ?? "LEAGUE_ONLY",
    },
  });
  await prisma.eventLog.create({
    data: {
      agentId: input.agentId,
      type: "SOCIAL_POST_CREATED",
      summary: `Social post created: ${post.title}`,
      entityType: "POST",
      entityId: post.id,
      postId: post.id,
      meta: JSON.stringify({ postId: post.id, visibility: post.visibility, tags: input.tags ?? [] }),
    },
  });
  return post;
}

async function runSocialBehaviors(agentId: string, tasksCreated: number, approvalsCreated: number) {
  if (agentId === "broadcast-media") {
    await emitSocialPost({
      agentId,
      title: `Weekly Recap Draft - ${new Date().toISOString().slice(0, 10)}`,
      bodyMarkdown: [
        "## League Weekly Recap Draft",
        `- Tasks created this cycle: ${tasksCreated}`,
        `- Approvals queued this cycle: ${approvalsCreated}`,
        "- Focus: delivery pacing, governance clarity, and reliability hardening.",
      ].join("\n"),
      tags: ["weekly", "recap", "media"],
      visibility: "PUBLIC",
    });
  }

  if (agentId === "integrity") {
    const openIncidents = await prisma.incident.findMany({
      where: { status: { not: "RESOLVED" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (openIncidents.length > 0) {
      await emitSocialPost({
        agentId,
        title: `Integrity Bulletin - ${new Date().toISOString().slice(0, 10)}`,
        bodyMarkdown: [
          "## Integrity Bulletin",
          `Open incidents: ${openIncidents.length}`,
          ...openIncidents.map((inc) => `- [${inc.severity}] ${inc.title} (${inc.status})`),
        ].join("\n"),
        tags: ["integrity", "bulletin", "incidents"],
        visibility: "LEAGUE_ONLY",
      });
    }
  }

  if (agentId === "rules-committee") {
    const proposals = await prisma.proposal.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (proposals.length > 0) {
      await emitSocialPost({
        agentId,
        title: `Rule Proposal Summary - ${new Date().toISOString().slice(0, 10)}`,
        bodyMarkdown: [
          "## Pending Rule Proposals",
          ...proposals.map((p) => `- [Tier ${p.tier}] ${p.title}: ${p.summary}`),
        ].join("\n"),
        tags: ["rules", "proposal-summary"],
        visibility: "LEAGUE_ONLY",
      });
    }
  }

  if (agentId === "community-moderation") {
    const existing = await prisma.post.findFirst({
      where: { title: "Community Guidelines", authorAgentId: agentId },
    });
    if (!existing) {
      await emitSocialPost({
        agentId,
        title: "Community Guidelines",
        bodyMarkdown: [
          "## Community Guidelines",
          "1. Respect operational confidentiality.",
          "2. Use evidence when challenging proposals.",
          "3. Escalate incidents through official channels.",
        ].join("\n"),
        tags: ["community", "guidelines"],
        visibility: "PUBLIC",
      });
    }

    const flagged = await prisma.post.findMany({
      where: {
        isHidden: false,
        OR: [{ bodyMarkdown: { contains: "leak" } }, { bodyMarkdown: { contains: "exploit" } }],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    for (const post of flagged) {
      await prisma.post.update({ where: { id: post.id }, data: { isHidden: true, isLocked: true } });
      await prisma.moderationAction.create({
        data: {
          targetType: "POST",
          targetId: post.id,
          action: "HIDE",
          reason: "Auto-moderation: flagged potentially sensitive content.",
          actorAgentId: agentId,
          postId: post.id,
        },
      });
      await prisma.eventLog.create({
        data: {
          agentId,
          type: "SOCIAL_MODERATION_ACTION",
          summary: `Auto-moderated post ${post.id.slice(-6)} by community moderation agent.`,
          entityType: "POST",
          entityId: post.id,
          postId: post.id,
          meta: JSON.stringify({ targetType: "POST", action: "HIDE", reason: "flagged content" }),
        },
      });
    }
  }
}

export async function runAgent(agentId: string): Promise<AgentRunResult> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const startedAt = new Date();
  const runRecord = await prisma.agentRun.create({
    data: {
      agentId: agent.id,
      status: "SUCCESS",
      startedAt,
      finishedAt: startedAt,
      outputsCreated: 0,
      durationMs: 0,
      error: "",
    },
  });

  await prisma.eventLog.create({
    data: {
      agentId: agent.id,
      type: "AGENT_RUN_START",
      summary: `${agent.name} run started.`,
      entityType: "AGENT",
      entityId: agent.id,
      meta: JSON.stringify({ runId: runRecord.id, agentId: agent.id }),
    },
  });

  const league = await prisma.leagueState.findUnique({ where: { id: "singleton" } });
  const seasonLocked = league?.seasonLock ?? false;

  const templates = TASK_TEMPLATES[agentId] ?? [];
  let tasksCreated = 0;
  let approvalsCreated = 0;
  let eventsCreated = 0;

  try {
    for (const tmpl of templates) {
      const existing = await prisma.task.findFirst({ where: { title: tmpl.title } });
      if (existing) continue;

      if (seasonLocked && tmpl.tier >= 2) {
        await prisma.eventLog.create({
          data: {
            agentId: agent.id,
            type: "AGENT_RUN",
            tier: tmpl.tier,
            summary: `[DEFERRED] ${agent.name} deferred Tier ${tmpl.tier} task \"${tmpl.title}\" - season locked.`,
            entityType: "AGENT",
            entityId: agent.id,
            meta: JSON.stringify({ runId: runRecord.id, agentId, task: tmpl.title, tier: tmpl.tier }),
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
            tier: tmpl.tier,
            summary: `${agent.name} created Tier ${tmpl.tier} approval: \"${tmpl.approvalSummary}\"`,
            entityType: "TASK",
            entityId: task.id,
            taskId: task.id,
            meta: JSON.stringify({ runId: runRecord.id, taskId: task.id, tier: tmpl.tier }),
          },
        });
        eventsCreated++;
      }

      await prisma.eventLog.create({
        data: {
          agentId: agent.id,
          type: "TASK_CREATED",
          tier: tmpl.tier,
          summary: `${agent.name} created task \"${tmpl.title}\" [Tier ${tmpl.tier}]`,
          entityType: "TASK",
          entityId: task.id,
          taskId: task.id,
          meta: JSON.stringify({ runId: runRecord.id, taskId: task.id, tier: tmpl.tier, department: tmpl.department }),
        },
      });
      eventsCreated++;
    }

    const durationMs = Date.now() - startedAt.getTime();
    await prisma.agentRun.update({
      where: { id: runRecord.id },
      data: {
        status: "SUCCESS",
        outputsCreated: tasksCreated + approvalsCreated,
        durationMs,
        finishedAt: new Date(),
        error: "",
      },
    });

    await prisma.eventLog.create({
      data: {
        agentId: agent.id,
        type: "AGENT_RUN",
        summary: `${agent.name} run complete - ${tasksCreated} task(s) created, ${approvalsCreated} approval(s) queued.`,
        entityType: "AGENT",
        entityId: agent.id,
        meta: JSON.stringify({ runId: runRecord.id, agentId, tasksCreated, approvalsCreated, durationMs }),
      },
    });
    eventsCreated++;

    await runSocialBehaviors(agentId, tasksCreated, approvalsCreated);

    return {
      tasksCreated,
      approvalsCreated,
      eventsCreated,
      summary: `${agent.name}: ${tasksCreated} tasks, ${approvalsCreated} approvals`,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt.getTime();
    await prisma.agentRun.update({
      where: { id: runRecord.id },
      data: {
        status: "FAILED",
        durationMs,
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      },
    });

    await prisma.eventLog.create({
      data: {
        agentId: agent.id,
        type: "AGENT_RUN_FAILED",
        summary: `${agent.name} run failed.`,
        entityType: "AGENT",
        entityId: agent.id,
        meta: JSON.stringify({
          runId: runRecord.id,
          agentId,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        }),
      },
    });

    throw error;
  }
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
