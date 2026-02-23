import { prisma } from "@afl/db";
import { TASK_TEMPLATES } from "./tasks";
import type { AgentRunResult } from "./types";

type SeasonOneChecklistItem = {
  key: string;
  title: string;
  description: string;
  dependsOn: string[];
};

const SEASON_ONE_CHECKLIST: SeasonOneChecklistItem[] = [
  {
    key: "teams",
    title: "Season 1 Launch: Verify 8 Teams",
    description: "Confirm exactly 8 teams are present with valid offense/defense schemes.",
    dependsOn: [],
  },
  {
    key: "coach-assignments",
    title: "Season 1 Launch: Assign Coach Agents",
    description: "Assign coach agents or deterministic baseline coaches to every team.",
    dependsOn: ["teams"],
  },
  {
    key: "engine-version",
    title: "Season 1 Launch: Lock Engine Version",
    description: "Pin engine version and deterministic seed rules for full replayability.",
    dependsOn: ["teams"],
  },
  {
    key: "schedule",
    title: "Season 1 Launch: Build Round-Robin Schedule",
    description: "Generate week-by-week round-robin schedule with deterministic game seeds.",
    dependsOn: ["coach-assignments", "engine-version"],
  },
  {
    key: "standings-init",
    title: "Season 1 Launch: Initialize Standings",
    description: "Initialize standings rows for every team before kickoff.",
    dependsOn: ["schedule"],
  },
  {
    key: "week-runner",
    title: "Season 1 Launch: Configure Week Runner",
    description: "Validate WEEK_SIMULATE runbook payload defaults and enable it.",
    dependsOn: ["schedule"],
  },
  {
    key: "slate-post",
    title: "Season 1 Launch: Publish Week 1 Slate",
    description: "Publish the Week 1 slate to social and log public event visibility.",
    dependsOn: ["schedule"],
  },
  {
    key: "dry-run",
    title: "Season 1 Launch: Dry-Run Deterministic Game",
    description: "Step a game in non-final mode to verify deterministic play generation.",
    dependsOn: ["schedule"],
  },
  {
    key: "week1-sim",
    title: "Season 1 Launch: Simulate Week 1",
    description: "Run all Week 1 games to final and persist play-by-play/box scores.",
    dependsOn: ["standings-init", "week-runner", "dry-run"],
  },
  {
    key: "rankings-audit",
    title: "Season 1 Launch: Rankings Audit",
    description: "Verify standings integrity against final game outcomes and point totals.",
    dependsOn: ["week1-sim"],
  },
  {
    key: "recap-post",
    title: "Season 1 Launch: Publish Week 1 Recap",
    description: "Publish recap summary with scores and highlights after finals.",
    dependsOn: ["week1-sim"],
  },
  {
    key: "postmortem",
    title: "Season 1 Launch: Ops Postmortem",
    description: "Capture launch risks, regressions, and runbook adjustments for Week 2.",
    dependsOn: ["rankings-audit", "recap-post"],
  },
];

async function ensureTaskDependency(leagueId: string, taskId: string, dependsOnTaskId: string) {
  await prisma.taskDependency.upsert({
    where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    update: {},
    create: {
      leagueId,
      taskId,
      dependsOnTaskId,
    },
  });
}

async function runSeasonOneAgentBehaviors(leagueId: string, agentId: string): Promise<{ tasksCreated: number; eventsCreated: number }> {
  let tasksCreated = 0;
  let eventsCreated = 0;

  if (agentId === "chief-of-staff") {
    const checklistTasks = new Map<string, string>();

    for (const item of SEASON_ONE_CHECKLIST) {
      const existing = await prisma.task.findFirst({
        where: { leagueId, title: item.title },
      });

      const task =
        existing ??
        (await prisma.task.create({
          data: {
            leagueId,
            title: item.title,
            description: item.description,
            department: "COMMISSIONER",
            tier: 1,
            status: "BACKLOG",
            assigneeId: agentId,
            acceptanceCriteria: "Checklist item is completed and validated by feed events.",
            riskNotes: "Skipping this item can block deterministic Season 1 operations.",
            testPlan: "Run related runbook and verify DB state and EventLog trail.",
            rollbackPlan: "Return item to BACKLOG and rerun setup/week orchestration.",
          },
        }));

      if (!existing) {
        tasksCreated += 1;
      }
      checklistTasks.set(item.key, task.id);
    }

    for (const item of SEASON_ONE_CHECKLIST) {
      const taskId = checklistTasks.get(item.key);
      if (!taskId) continue;
      for (const depKey of item.dependsOn) {
        const depTaskId = checklistTasks.get(depKey);
        if (!depTaskId) continue;
        await ensureTaskDependency(leagueId, taskId, depTaskId);
      }
    }

    await prisma.eventLog.create({
      data: {
        leagueId,
        agentId,
        type: "TASK_CREATED",
        summary: "Chief of Staff refreshed Season 1 launch checklist with dependency graph.",
        entityType: "AGENT",
        entityId: agentId,
        meta: JSON.stringify({ checklistItems: SEASON_ONE_CHECKLIST.length, tasksCreated }),
      },
    });
    eventsCreated += 1;
  }

  if (agentId === "scheduler") {
    const season = await prisma.season.findFirst({
      where: { leagueId, seasonNumber: 1 },
      orderBy: { createdAt: "desc" },
    });
    const gameCount = season
      ? await prisma.game.count({
          where: {
            leagueId,
            seasonId: season.id,
          },
        })
      : 0;

    const scheduleTaskTitle = "Scheduler: Ensure Season 1 Schedule Coverage";
    const scheduleTask = await prisma.task.findFirst({
      where: { leagueId, title: scheduleTaskTitle },
    });
    if (!scheduleTask) {
      await prisma.task.create({
        data: {
          leagueId,
          title: scheduleTaskTitle,
          description:
            "Validate Season 1 schedule exists for all teams and weeks. If absent, escalate setup runbook execution.",
          department: "FOOTBALL_OPS",
          tier: 1,
          status: "BACKLOG",
          assigneeId: agentId,
          acceptanceCriteria: "All expected week rows exist; no duplicate home/away pairings.",
          riskNotes: "Missing schedule rows block week simulations and standings updates.",
          testPlan: "Count expected games and verify every team appears once per week.",
          rollbackPlan: "Trigger Season 1 Setup runbook and regenerate schedule.",
        },
      });
      tasksCreated += 1;
    }

    if (!season || gameCount === 0) {
      await prisma.eventLog.create({
        data: {
          leagueId,
          agentId,
          type: "SCHEDULE_CREATED",
          summary: "Scheduler detected missing Season 1 schedule and flagged setup runbook requirement.",
          entityType: "AGENT",
          entityId: agentId,
          meta: JSON.stringify({ seasonFound: Boolean(season), gameCount }),
        },
      });
    } else {
      await prisma.eventLog.create({
        data: {
          leagueId,
          agentId,
          type: "SCHEDULE_CREATED",
          summary: `Scheduler validated Season 1 schedule coverage (${gameCount} games).`,
          entityType: "SEASON",
          entityId: season.id,
          meta: JSON.stringify({ seasonId: season.id, gameCount }),
        },
      });
    }
    eventsCreated += 1;
  }

  if (agentId === "rankings") {
    const season = await prisma.season.findFirst({
      where: { leagueId, seasonNumber: 1 },
      orderBy: { createdAt: "desc" },
    });
    const [teamCount, standingsCount, finalGames] = await Promise.all([
      prisma.team.count({ where: { leagueId } }),
      season ? prisma.standingsRow.count({ where: { leagueId, seasonId: season.id } }) : Promise.resolve(0),
      season ? prisma.game.count({ where: { leagueId, seasonId: season.id, status: "FINAL" } }) : Promise.resolve(0),
    ]);
    const mismatch = Boolean(season) && standingsCount !== teamCount;

    if (mismatch) {
      const title = "Rankings: Standings Mismatch Incident Review";
      const existing = await prisma.task.findFirst({ where: { leagueId, title } });
      if (!existing) {
        await prisma.task.create({
          data: {
            leagueId,
            title,
            description: "Standings row count mismatch detected against team count.",
            department: "FOOTBALL_OPS",
            tier: 2,
            status: "BLOCKED",
            assigneeId: agentId,
            acceptanceCriteria: "Standings row count equals team count and final game deltas reconcile.",
            riskNotes: "Incorrect standings break rankings and public credibility.",
            testPlan: "Recompute standings from final games and compare with persisted rows.",
            rollbackPlan: "Reset standings rows and replay standings refresh from final games.",
          },
        });
        tasksCreated += 1;
      }
    }

    await prisma.eventLog.create({
      data: {
        leagueId,
        agentId,
        type: "STANDINGS_UPDATED",
        summary: mismatch
          ? "Rankings audit detected standings mismatch and raised remediation task."
          : "Rankings audit validated standings consistency.",
        entityType: season ? "SEASON" : "AGENT",
        entityId: season?.id ?? agentId,
        meta: JSON.stringify({
          seasonId: season?.id ?? null,
          teamCount,
          standingsCount,
          finalGames,
          mismatch,
        }),
      },
    });
    eventsCreated += 1;
  }

  if (agentId === "broadcast-media") {
    const season = await prisma.season.findFirst({
      where: { leagueId, seasonNumber: 1 },
      orderBy: { createdAt: "desc" },
    });
    if (season) {
      const nextWeekGame = await prisma.game.findFirst({
        where: { leagueId, seasonId: season.id, status: { in: ["SCHEDULED", "LIVE"] } },
        orderBy: [{ week: "asc" }, { kickoffAt: "asc" }],
      });
      if (nextWeekGame) {
        await emitSocialPost({
          leagueId,
          agentId,
          title: `Broadcast Slate Preview - Week ${nextWeekGame.week}`,
          bodyMarkdown: `Broadcast preparing coverage package for Week ${nextWeekGame.week}.`,
          tags: ["season1", "slate", `week${nextWeekGame.week}`],
          visibility: "PUBLIC",
        });
        eventsCreated += 1;
      }

      const recapWeekGame = await prisma.game.findFirst({
        where: { leagueId, seasonId: season.id, status: "FINAL" },
        orderBy: [{ week: "desc" }, { finishedAt: "desc" }],
      });
      if (recapWeekGame) {
        await emitSocialPost({
          leagueId,
          agentId,
          title: `Broadcast Recap Draft - Week ${recapWeekGame.week}`,
          bodyMarkdown: `Recap draft queued for Week ${recapWeekGame.week}. Final box scores are available in Game Center.`,
          tags: ["season1", "recap", `week${recapWeekGame.week}`],
          visibility: "PUBLIC",
        });
        eventsCreated += 1;
      }
    }
  }

  if (agentId === "commissioner") {
    const setupRunbook = await prisma.runbook.findFirst({
      where: { leagueId, actionType: "SEASON1_SETUP" },
      orderBy: { createdAt: "asc" },
    });
    const season = await prisma.season.findFirst({
      where: { leagueId, seasonNumber: 1 },
      orderBy: { createdAt: "desc" },
    });
    if (!setupRunbook) {
      await prisma.runbook.create({
        data: {
          leagueId,
          name: "Season 1 Setup",
          description: "Agent-driven Season 1 bootstrap for teams, schedule, standings, and launch posts.",
          ownerAgentId: "commissioner",
          triggerType: "MANUAL",
          actionType: "SEASON1_SETUP",
          actionPayloadJson: JSON.stringify({ seasonNumber: 1, teamCount: 8 }),
          isEnabled: true,
        },
      });
      await prisma.eventLog.create({
        data: {
          leagueId,
          agentId,
          type: "RUNBOOK_CREATED",
          summary: "Commissioner created missing Season 1 Setup runbook.",
          entityType: "AGENT",
          entityId: agentId,
          meta: JSON.stringify({ actionType: "SEASON1_SETUP" }),
        },
      });
      eventsCreated += 1;
    } else if (!season) {
      await prisma.eventLog.create({
        data: {
          leagueId,
          agentId,
          type: "SEASON1_CREATED",
          summary: "Commissioner detected missing Season 1 and requested setup runbook execution.",
          entityType: "RUNBOOK",
          entityId: setupRunbook.id,
          runbookId: setupRunbook.id,
          meta: JSON.stringify({ actionType: setupRunbook.actionType }),
        },
      });
      eventsCreated += 1;
    }

    if (season) {
      await emitSocialPost({
        leagueId,
        agentId,
        title: `Commissioner Notice - Season ${season.seasonNumber} Operations`,
        bodyMarkdown:
          "Season 1 operations are active. Use runbooks for setup validation and weekly simulations to preserve deterministic replayability.",
        tags: ["commissioner", "season1", "operations"],
        visibility: "PUBLIC",
      });
      eventsCreated += 1;
    }
  }

  return { tasksCreated, eventsCreated };
}

async function emitSocialPost(input: {
  leagueId: string;
  agentId?: string;
  title: string;
  bodyMarkdown: string;
  tags?: string[];
  visibility?: "PUBLIC" | "LEAGUE_ONLY";
}) {
  const post = await prisma.post.create({
    data: {
      leagueId: input.leagueId,
      authorAgentId: input.agentId ?? null,
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      tags: (input.tags ?? []).join(","),
      visibility: input.visibility ?? "LEAGUE_ONLY",
    },
  });
  await prisma.eventLog.create({
    data: {
      leagueId: input.leagueId,
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

async function runSocialBehaviors(leagueId: string, agentId: string, tasksCreated: number, approvalsCreated: number) {
  if (agentId === "broadcast-media") {
    await emitSocialPost({
      leagueId,
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
      where: { leagueId, status: { not: "RESOLVED" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (openIncidents.length > 0) {
      await emitSocialPost({
        leagueId,
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
      where: { leagueId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (proposals.length > 0) {
      await emitSocialPost({
        leagueId,
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
      where: { leagueId, title: "Community Guidelines", authorAgentId: agentId },
    });
    if (!existing) {
      await emitSocialPost({
        leagueId,
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
        leagueId,
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
          leagueId,
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

export async function runAgent(agentId: string, leagueId?: string): Promise<AgentRunResult> {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, leagueId: leagueId ?? undefined } });
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  const activeLeagueId = leagueId ?? agent.leagueId;

  const startedAt = new Date();
  const runRecord = await prisma.agentRun.create({
    data: {
      leagueId: activeLeagueId,
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
      leagueId: activeLeagueId,
      agentId: agent.id,
      type: "AGENT_RUN_START",
      summary: `${agent.name} run started.`,
      entityType: "AGENT",
      entityId: agent.id,
      meta: JSON.stringify({ runId: runRecord.id, agentId: agent.id }),
    },
  });

  const leagueState = await prisma.leagueState.findUnique({ where: { leagueId: activeLeagueId } });
  const seasonLocked = leagueState?.seasonLock ?? false;

  const templates = TASK_TEMPLATES[agentId] ?? [];
  let tasksCreated = 0;
  let approvalsCreated = 0;
  let eventsCreated = 0;

  try {
    for (const tmpl of templates) {
      const existing = await prisma.task.findFirst({ where: { leagueId: activeLeagueId, title: tmpl.title } });
      if (existing) continue;

      if (seasonLocked && tmpl.tier >= 2) {
        await prisma.eventLog.create({
          data: {
            leagueId: activeLeagueId,
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
          leagueId: activeLeagueId,
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
            leagueId: activeLeagueId,
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
            leagueId: activeLeagueId,
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
          leagueId: activeLeagueId,
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

    const seasonOneBehavior = await runSeasonOneAgentBehaviors(activeLeagueId, agentId);
    tasksCreated += seasonOneBehavior.tasksCreated;
    eventsCreated += seasonOneBehavior.eventsCreated;

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
        leagueId: activeLeagueId,
        agentId: agent.id,
        type: "AGENT_RUN",
        summary: `${agent.name} run complete - ${tasksCreated} task(s) created, ${approvalsCreated} approval(s) queued.`,
        entityType: "AGENT",
        entityId: agent.id,
        meta: JSON.stringify({ runId: runRecord.id, agentId, tasksCreated, approvalsCreated, durationMs }),
      },
    });
    eventsCreated++;

    await runSocialBehaviors(activeLeagueId, agentId, tasksCreated, approvalsCreated);

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
        leagueId: activeLeagueId,
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
}>;
export async function runKickoff(leagueId: string): Promise<{
  totalTasks: number;
  totalApprovals: number;
  agentResults: AgentRunResult[];
}>;
export async function runKickoff(leagueId = "league_afl_prime"): Promise<{
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

  const league = await prisma.leagueState.findUnique({ where: { leagueId } });
  if (league?.seasonLock) {
    await prisma.eventLog.create({
      data: {
        leagueId,
        type: "KICKOFF",
        summary: "Season 0 Kickoff blocked: season is locked.",
        meta: JSON.stringify({ seasonLock: true }),
      },
    });
    throw new Error("Season is locked. Unlock season before kickoff.");
  }

  await prisma.eventLog.create({
    data: {
      leagueId,
      type: "KICKOFF",
      summary: "Season 0 Kickoff initiated - running all department agents.",
      meta: JSON.stringify({ agents: KICKOFF_ORDER }),
    },
  });

  const results: AgentRunResult[] = [];
  for (const agentId of KICKOFF_ORDER) {
    try {
      const result = await runAgent(agentId, leagueId);
      results.push(result);
    } catch (error) {
      console.error(`Agent ${agentId} failed:`, error);
    }
  }

  const totalTasks = results.reduce((sum, result) => sum + result.tasksCreated, 0);
  const totalApprovals = results.reduce((sum, result) => sum + result.approvalsCreated, 0);
  const [taskCount, tier23Approvals] = await Promise.all([
    prisma.task.count({ where: { leagueId } }),
    prisma.approval.count({ where: { leagueId, tier: { gte: 2 } } }),
  ]);

  if (taskCount < 30 || tier23Approvals === 0) {
    await prisma.eventLog.create({
      data: {
        leagueId,
        type: "KICKOFF",
        summary: "Season 0 Kickoff incomplete - expected >=30 tasks and Tier 2/3 approvals.",
        meta: JSON.stringify({ totalTasks, totalApprovals, taskCount, tier23Approvals }),
      },
    });
    throw new Error("Kickoff did not meet baseline: >=30 tasks and Tier 2/3 approvals.");
  }

  await prisma.eventLog.create({
    data: {
      leagueId,
      type: "KICKOFF",
      summary: `Season 0 Kickoff complete - ${taskCount} total tasks, ${tier23Approvals} Tier 2/3 approvals present.`,
      meta: JSON.stringify({ totalTasks, totalApprovals, taskCount, tier23Approvals }),
    },
  });

  return { totalTasks, totalApprovals, agentResults: results };
}
