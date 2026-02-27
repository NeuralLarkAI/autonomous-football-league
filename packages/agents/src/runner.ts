import { prisma } from "@afl/db";
import { TASK_TEMPLATES } from "./tasks";
import { SEASON0_AGENT_DELIVERABLES } from "./season0-deliverables";
import type { AgentRunObservedCounts, AgentRunOutputRefs, AgentRunResult } from "./types";
import { generateAgentNarrative, generateCommissionerDecision, hasClaudeAgentBrain } from "./ai";

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

    // Commissioner AI decision-making runs for ALL seasons (0 and 1+), not just Season 1.
    const [openTasks, pendingApprovals, openIncidents, scheduledRunbooks, pendingProposals, recentIncidents, pendingApprovalItems] =
      await Promise.all([
        prisma.task.count({
          where: { leagueId, status: { in: ["BACKLOG", "IN_PROGRESS", "REVIEW", "BLOCKED"] } },
        }),
        prisma.approval.count({ where: { leagueId, status: "PENDING" } }),
        prisma.incident.count({ where: { leagueId, status: { not: "RESOLVED" } } }),
        prisma.runbook.count({ where: { leagueId, triggerType: "SCHEDULED", isEnabled: true } }),
        prisma.proposal.findMany({
          where: { leagueId, status: "PENDING" },
          select: { id: true, title: true, tier: true, summary: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.incident.findMany({
          where: { leagueId, status: { not: "RESOLVED" } },
          select: { id: true, title: true, severity: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.approval.findMany({
          where: { leagueId, status: "PENDING", tier: { lte: 1 } },
          select: { id: true, summary: true, tier: true },
          orderBy: { createdAt: "asc" },
          take: 5,
        }),
      ]);

    const seasonNumber = season?.seasonNumber ?? 0;

    const decision = await generateCommissionerDecision({
      season: seasonNumber,
      openTasks,
      pendingApprovals,
      openIncidents,
      scheduledRunbooks,
      pendingProposals,
      recentIncidents,
      pendingApprovalItems,
    });

    if (decision) {
      await prisma.eventLog.create({
        data: {
          leagueId,
          agentId,
          type: "AGENT_AI_THOUGHT",
          summary: `Commissioner AI decision: health=${decision.leagueHealthScore}/100. ${decision.summary}`,
          entityType: "AGENT",
          entityId: agentId,
          meta: JSON.stringify({
            provider: "anthropic",
            mode: "commissioner_decision",
            seasonNumber,
            leagueHealthScore: decision.leagueHealthScore,
            actionCount: decision.recommendedActions.length,
          }),
        },
      });
      eventsCreated += 1;

      // Act on recommended actions from Claude
      for (const rec of decision.recommendedActions) {
        if (rec.action === "APPROVE_APPROVAL" && rec.targetId) {
          // Auto-approve Tier 0/1 items the commissioner decides are safe
          const approval = await prisma.approval.findUnique({ where: { id: rec.targetId } });
          if (approval && approval.status === "PENDING" && approval.tier <= 1) {
            await prisma.approval.update({
              where: { id: rec.targetId },
              data: { status: "APPROVED" },
            });
            await prisma.eventLog.create({
              data: {
                leagueId,
                agentId,
                type: "APPROVAL_CREATED",
                tier: approval.tier,
                summary: `Commissioner AI auto-approved Tier ${approval.tier} item: ${approval.summary}`,
                entityType: "APPROVAL",
                entityId: rec.targetId,
                meta: JSON.stringify({ aiReason: rec.reason, priority: rec.priority }),
              },
            });
            eventsCreated += 1;
          }
        }

        if (rec.action === "FLAG_INCIDENT" && rec.targetId) {
          // Log a flag event for incidents the commissioner highlights
          await prisma.eventLog.create({
            data: {
              leagueId,
              agentId,
              type: "INCIDENT_CREATED",
              summary: `Commissioner AI flagged incident for review: ${rec.reason}`,
              entityType: "INCIDENT",
              entityId: rec.targetId,
              meta: JSON.stringify({ aiReason: rec.reason, priority: rec.priority }),
            },
          });
          eventsCreated += 1;
        }
      }

      // Publish commissioner operational notice powered by Claude's narrative
      await emitSocialPost({
        leagueId,
        agentId,
        title: `Commissioner Notice - Season ${seasonNumber} Operations`,
        bodyMarkdown: decision.narrative,
        tags: ["commissioner", `season${seasonNumber}`, "operations"],
        visibility: "PUBLIC",
      });
      eventsCreated += 1;
    } else {
      // Fallback: no Claude API or call failed
      if (hasClaudeAgentBrain()) {
        await prisma.eventLog.create({
          data: {
            leagueId,
            agentId,
            type: "AGENT_AI_FALLBACK",
            summary: "Commissioner AI call failed; used deterministic fallback notice.",
            entityType: "AGENT",
            entityId: agentId,
            meta: JSON.stringify({ provider: "anthropic", mode: "commissioner_decision" }),
          },
        });
        eventsCreated += 1;
      }

      const fallbackBody = season
        ? `Season ${season.seasonNumber} operations active. Open tasks: ${openTasks}. Pending approvals: ${pendingApprovals}. Open incidents: ${openIncidents}. Use runbooks for setup validation and weekly simulations.`
        : `Season 0 governance in progress. Open tasks: ${openTasks}. Pending approvals: ${pendingApprovals}. Open incidents: ${openIncidents}. Run the Season 0 Kickoff runbook to populate the baseline backlog.`;

      await emitSocialPost({
        leagueId,
        agentId,
        title: `Commissioner Notice - Season ${seasonNumber} Operations`,
        bodyMarkdown: fallbackBody,
        tags: ["commissioner", `season${seasonNumber}`, "operations"],
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
  const eventLog = await prisma.eventLog.create({
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
  return { post, eventLog };
}

type TaskLifecycleStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";

async function transitionTaskStatus(input: {
  leagueId: string;
  agentId: string;
  runId: string;
  taskId: string;
  from: TaskLifecycleStatus;
  to: TaskLifecycleStatus;
  reason: string;
}) {
  if (input.from === input.to) return false;
  await prisma.task.update({
    where: { id: input.taskId },
    data: { status: input.to },
  });
  await prisma.eventLog.create({
    data: {
      leagueId: input.leagueId,
      agentId: input.agentId,
      type: "TASK_UPDATED",
      summary: `Task status moved ${input.from} -> ${input.to} (${input.reason}).`,
      entityType: "TASK",
      entityId: input.taskId,
      taskId: input.taskId,
      meta: JSON.stringify({ runId: input.runId, from: input.from, to: input.to, reason: input.reason }),
    },
  });
  return true;
}

async function advanceAssignedTasks(leagueId: string, agentId: string, runId: string): Promise<number> {
  const tasks = await prisma.task.findMany({
    where: { leagueId, assigneeId: agentId, status: { in: ["BACKLOG", "IN_PROGRESS", "REVIEW", "BLOCKED"] } },
    orderBy: [{ tier: "desc" }, { createdAt: "asc" }],
    take: 8,
    select: { id: true, status: true },
  });
  let moved = 0;

  for (const task of tasks) {
    if (moved >= 3) break;

    const [unmetDeps, pendingApprovals] = await Promise.all([
      prisma.taskDependency.count({
        where: { taskId: task.id, dependsOnTask: { status: { not: "DONE" } } },
      }),
      prisma.approval.count({ where: { taskId: task.id, status: "PENDING" } }),
    ]);

    let next: TaskLifecycleStatus | null = null;
    let reason = "";
    if (task.status === "BACKLOG" && unmetDeps === 0) {
      next = "IN_PROGRESS";
      reason = "dependencies satisfied";
    } else if (task.status === "BLOCKED" && unmetDeps === 0) {
      next = "IN_PROGRESS";
      reason = "unblocked";
    } else if (task.status === "IN_PROGRESS" && unmetDeps === 0) {
      next = "REVIEW";
      reason = pendingApprovals > 0 ? "awaiting approvals" : "implementation complete";
    } else if (task.status === "REVIEW" && unmetDeps === 0 && pendingApprovals === 0) {
      next = "DONE";
      reason = "review checks passed";
    } else if ((task.status === "BACKLOG" || task.status === "IN_PROGRESS") && unmetDeps > 0) {
      next = "BLOCKED";
      reason = "dependency not done";
    }

    if (next) {
      const didMove = await transitionTaskStatus({
        leagueId,
        agentId,
        runId,
        taskId: task.id,
        from: task.status as TaskLifecycleStatus,
        to: next,
        reason,
      });
      if (didMove) moved += 1;
    }
  }

  return moved;
}

async function runSocialBehaviors(
  leagueId: string,
  agentId: string,
  tasksCreated: number,
  approvalsCreated: number
): Promise<{ postsCreated: number; eventsCreated: number; postIds: string[]; eventLogIds: string[]; moderationActionIds: string[] }> {
  let postsCreated = 0;
  let eventsCreated = 0;
  const postIds: string[] = [];
  const eventLogIds: string[] = [];
  const moderationActionIds: string[] = [];

  if (agentId === "broadcast-media") {
    const created = await emitSocialPost({
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
    postsCreated += 1;
    eventsCreated += 1;
    postIds.push(created.post.id);
    eventLogIds.push(created.eventLog.id);
  }

  if (agentId === "integrity") {
    const openIncidents = await prisma.incident.findMany({
      where: { leagueId, status: { not: "RESOLVED" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (openIncidents.length > 0) {
      const created = await emitSocialPost({
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
      postsCreated += 1;
      eventsCreated += 1;
      postIds.push(created.post.id);
      eventLogIds.push(created.eventLog.id);
    }
  }

  if (agentId === "rules-committee") {
    const proposals = await prisma.proposal.findMany({
      where: { leagueId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (proposals.length > 0) {
      const created = await emitSocialPost({
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
      postsCreated += 1;
      eventsCreated += 1;
      postIds.push(created.post.id);
      eventLogIds.push(created.eventLog.id);
    }
  }

  if (agentId === "community-moderation") {
    const existing = await prisma.post.findFirst({
      where: { leagueId, title: "Community Guidelines", authorAgentId: agentId },
    });
    if (!existing) {
      const created = await emitSocialPost({
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
      postsCreated += 1;
      eventsCreated += 1;
      postIds.push(created.post.id);
      eventLogIds.push(created.eventLog.id);
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
      const moderationAction = await prisma.moderationAction.create({
        data: {
          targetType: "POST",
          targetId: post.id,
          action: "HIDE",
          reason: "Auto-moderation: flagged potentially sensitive content.",
          actorAgentId: agentId,
          postId: post.id,
        },
      });
      moderationActionIds.push(moderationAction.id);
      const moderationEvent = await prisma.eventLog.create({
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
      eventsCreated += 1;
      eventLogIds.push(moderationEvent.id);
    }
  }

  return { postsCreated, eventsCreated, postIds, eventLogIds, moderationActionIds };
}

export async function runAgent(agentId: string, leagueId?: string): Promise<AgentRunResult> {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, leagueId: leagueId ?? undefined } });
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  const activeLeagueId = leagueId ?? agent.leagueId;
  const deliverablesPlan = SEASON0_AGENT_DELIVERABLES[agentId];

  const outputs: AgentRunOutputRefs = {
    taskIds: [],
    approvalIds: [],
    proposalIds: [],
    incidentIds: [],
    combineRunIds: [],
    postIds: [],
    runbookIds: [],
    signoffIds: [],
    moderationActionIds: [],
    eventLogIds: [],
  };
  const observed: AgentRunObservedCounts = {
    tasksCreated: 0,
    approvalsCreated: 0,
    proposalsCreated: 0,
    incidentsCreated: 0,
    combineRunsCreated: 0,
    socialPostsCreated: 0,
    runbooksCreated: 0,
    signoffRequestsCreated: 0,
    moderationActionsCreated: 0,
    eventsCreated: 0,
  };

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

  const startEvent = await prisma.eventLog.create({
    data: {
      leagueId: activeLeagueId,
      agentId: agent.id,
      type: "AGENT_RUN_START",
      summary: `${agent.name} run started.`,
      entityType: "AGENT",
      entityId: agent.id,
      meta: JSON.stringify({ runId: runRecord.id, agentId: agent.id, deliverablesPlan }),
    },
  });
  outputs.eventLogIds.push(startEvent.id);

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
        const deferredEvent = await prisma.eventLog.create({
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
        outputs.eventLogIds.push(deferredEvent.id);
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
      outputs.taskIds.push(task.id);

      if (tmpl.requiresApproval && tmpl.approvalSummary) {
        const approval = await prisma.approval.create({
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
        outputs.approvalIds.push(approval.id);

        const approvalEvent = await prisma.eventLog.create({
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
        outputs.eventLogIds.push(approvalEvent.id);
      }

      const taskEvent = await prisma.eventLog.create({
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
      outputs.eventLogIds.push(taskEvent.id);
    }

    const seasonOneBehavior = await runSeasonOneAgentBehaviors(activeLeagueId, agentId);
    tasksCreated += seasonOneBehavior.tasksCreated;
    eventsCreated += seasonOneBehavior.eventsCreated;
    const taskTransitions = await advanceAssignedTasks(activeLeagueId, agentId, runRecord.id);
    eventsCreated += taskTransitions;
    const assigneeOpenTasks = await prisma.task.count({
      where: {
        leagueId: activeLeagueId,
        assigneeId: agent.id,
        status: { in: ["BACKLOG", "IN_PROGRESS", "REVIEW", "BLOCKED"] },
      },
    });

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

    const completedEvent = await prisma.eventLog.create({
      data: {
        leagueId: activeLeagueId,
        agentId: agent.id,
        type: "AGENT_RUN",
        summary: `${agent.name} run complete - ${tasksCreated} task(s) created, ${approvalsCreated} approval(s) queued, ${taskTransitions} task transition(s), ${assigneeOpenTasks} assignee open task(s).`,
        entityType: "AGENT",
        entityId: agent.id,
        meta: JSON.stringify({ runId: runRecord.id, agentId, tasksCreated, approvalsCreated, taskTransitions, assigneeOpenTasks, durationMs }),
      },
    });
    eventsCreated++;
    outputs.eventLogIds.push(completedEvent.id);

    const socialBehavior = await runSocialBehaviors(activeLeagueId, agentId, tasksCreated, approvalsCreated);
    outputs.postIds.push(...socialBehavior.postIds);
    outputs.eventLogIds.push(...socialBehavior.eventLogIds);
    outputs.moderationActionIds.push(...socialBehavior.moderationActionIds);
    eventsCreated += socialBehavior.eventsCreated;

    observed.tasksCreated = tasksCreated;
    observed.approvalsCreated = approvalsCreated;
    observed.proposalsCreated = outputs.proposalIds.length;
    observed.incidentsCreated = outputs.incidentIds.length;
    observed.combineRunsCreated = outputs.combineRunIds.length;
    observed.socialPostsCreated = socialBehavior.postsCreated;
    observed.runbooksCreated = outputs.runbookIds.length;
    observed.signoffRequestsCreated = outputs.signoffIds.length;
    observed.moderationActionsCreated = outputs.moderationActionIds.length;
    observed.eventsCreated = eventsCreated;

    return {
      tasksCreated,
      approvalsCreated,
      eventsCreated,
      summary: `${agent.name}: ${tasksCreated} tasks created, ${approvalsCreated} approvals queued, ${taskTransitions} task transitions, ${assigneeOpenTasks} open assigned`,
      outputs,
      observed,
      deliverablesPlan,
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

    const failedEvent = await prisma.eventLog.create({
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
    outputs.eventLogIds.push(failedEvent.id);

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
