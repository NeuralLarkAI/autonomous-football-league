import { prisma } from "@afl/db";
import { runAgent, runKickoff, runCombine, stepGame } from "@afl/agents";
import { ensureSeasonOne } from "./season1";
import { refreshGameBoxScore, refreshStandingsForFinal } from "./game-stats";
import { runSeasonZeroKickoffAgents } from "./season0-kickoff-agents";

type RunbookLike = {
  id: string;
  leagueId: string;
  name: string;
  ownerAgentId: string | null;
  actionType: string;
  actionPayloadJson: string;
};

function parsePayload(input: string): Record<string, unknown> {
  try {
    return JSON.parse(input || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function logStep(input: {
  leagueId: string;
  ownerAgentId?: string | null;
  runbookId: string;
  runbookRunId: string;
  type: string;
  summary: string;
  meta?: Record<string, unknown>;
  visibility?: "PUBLIC" | "LEAGUE_ONLY" | "PRIVATE";
}) {
  await prisma.eventLog.create({
    data: {
      leagueId: input.leagueId,
      agentId: input.ownerAgentId ?? undefined,
      type: input.type,
      summary: input.summary,
      visibility: input.visibility ?? "LEAGUE_ONLY",
      entityType: "RUNBOOK",
      entityId: input.runbookId,
      runbookId: input.runbookId,
      runbookRunId: input.runbookRunId,
      meta: JSON.stringify(input.meta ?? {}),
    },
  });
}

async function ensureSocialPost(input: {
  leagueId: string;
  ownerAgentId?: string | null;
  runbookId: string;
  runbookRunId: string;
  title: string;
  bodyMarkdown: string;
  tags: string[];
  visibility: "PUBLIC" | "LEAGUE_ONLY";
}) {
  const existing = await prisma.post.findFirst({
    where: { leagueId: input.leagueId, title: input.title },
  });
  if (existing) {
    return { created: false, post: existing };
  }
  const post = await prisma.post.create({
    data: {
      leagueId: input.leagueId,
      authorAgentId: input.ownerAgentId ?? null,
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      tags: input.tags.join(","),
      visibility: input.visibility,
    },
  });
  await prisma.eventLog.create({
    data: {
      leagueId: input.leagueId,
      agentId: input.ownerAgentId ?? undefined,
      type: "SOCIAL_POST_CREATED",
      summary: `Social post created: ${post.title}`,
      visibility: input.visibility,
      entityType: "POST",
      entityId: post.id,
      postId: post.id,
      runbookId: input.runbookId,
      runbookRunId: input.runbookRunId,
      meta: JSON.stringify({ tags: input.tags }),
    },
  });
  return { created: true, post };
}

async function assignSeasonOneCoaches(leagueId: string) {
  const teams = await prisma.team.findMany({
    where: { leagueId },
    orderBy: { shortName: "asc" },
  });
  const eligibleAgents = await prisma.agent.findMany({
    where: {
      leagueId,
      ownerUserId: { not: null },
      mode: "SANDBOX",
      submissions: { some: { status: "RANKED_APPROVED" } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  if (eligibleAgents.length === 0) {
    return { updatedTeams: 0, assignedAgentIds: [] as string[] };
  }

  let updatedTeams = 0;
  const assignedAgentIds: string[] = [];
  for (const [index, team] of teams.entries()) {
    if (team.coachAgentId) continue;
    const selected = eligibleAgents[index % eligibleAgents.length];
    await prisma.team.update({
      where: { id: team.id },
      data: { coachAgentId: selected.id },
    });
    updatedTeams += 1;
    assignedAgentIds.push(selected.id);
  }
  return { updatedTeams, assignedAgentIds };
}

async function runSeasonOneSetup(input: {
  leagueId: string;
  runbookId: string;
  runbookRunId: string;
  ownerAgentId?: string | null;
}) {
  const [existingSeasonCount, existingTeamCount, existingGameCount, existingStandingsCount] = await Promise.all([
    prisma.season.count({ where: { leagueId: input.leagueId, seasonNumber: 1 } }),
    prisma.team.count({ where: { leagueId: input.leagueId } }),
    prisma.game.count({ where: { leagueId: input.leagueId } }),
    prisma.standingsRow.count({ where: { leagueId: input.leagueId } }),
  ]);

  const ensured = await ensureSeasonOne(input.leagueId, 8);
  await logStep({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    type: "SEASON1_CREATED",
    summary: existingSeasonCount > 0 ? "Season 1 already exists; validated setup." : "Season 1 created.",
    meta: { seasonId: ensured.season.id, seasonNumber: ensured.season.seasonNumber, engineVersion: ensured.season.engineVersion },
  });

  await logStep({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    type: "TEAMS_CREATED",
    summary:
      ensured.teams.length > existingTeamCount
        ? `Teams created: ${ensured.teams.length - existingTeamCount}.`
        : "Teams already present; no new teams created.",
    meta: { teamCount: ensured.teams.length },
  });

  const coachAssignment = await assignSeasonOneCoaches(input.leagueId);
  await logStep({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    type: "TEAMS_CREATED",
    summary:
      coachAssignment.updatedTeams > 0
        ? `Assigned coaches to ${coachAssignment.updatedTeams} team(s).`
        : "Coach assignments already satisfied or no claimed ranked coaches available.",
    meta: { updatedTeams: coachAssignment.updatedTeams, assignedAgentIds: coachAssignment.assignedAgentIds },
  });

  const gameCount = await prisma.game.count({ where: { leagueId: input.leagueId, seasonId: ensured.season.id } });
  await logStep({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    type: "SCHEDULE_CREATED",
    summary:
      gameCount > existingGameCount
        ? `Schedule ensured: ${gameCount - existingGameCount} new game(s) created.`
        : "Schedule already complete; no new games created.",
    meta: { gameCount, weeks: ensured.weeks },
  });

  const standingsCount = await prisma.standingsRow.count({ where: { leagueId: input.leagueId, seasonId: ensured.season.id } });
  await logStep({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    type: "STANDINGS_INITIALIZED",
    summary:
      standingsCount > existingStandingsCount
        ? `Standings initialized for ${standingsCount - existingStandingsCount} team(s).`
        : "Standings already initialized.",
    meta: { standingsCount },
  });

  const weekOneGames = await prisma.game.findMany({
    where: { leagueId: input.leagueId, seasonId: ensured.season.id, week: 1 },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffAt: "asc" },
  });

  await ensureSocialPost({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    title: "Season 1 Launch Announcement",
    bodyMarkdown: `Season 1 is ready with ${ensured.teams.length} teams and ${gameCount} scheduled games.`,
    tags: ["season1", "launch", "announcement"],
    visibility: "PUBLIC",
  });
  await ensureSocialPost({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    title: "Week 1 Slate",
    bodyMarkdown: weekOneGames.length
      ? weekOneGames.map((g) => `- ${g.awayTeam.shortName} @ ${g.homeTeam.shortName}`).join("\n")
      : "Week 1 games not available yet.",
    tags: ["season1", "week1", "slate"],
    visibility: "PUBLIC",
  });

  return {
    seasonId: ensured.season.id,
    teams: ensured.teams.length,
    games: gameCount,
    weekOneGames: weekOneGames.length,
  };
}

async function runWeekSimulate(input: {
  leagueId: string;
  runbookId: string;
  runbookRunId: string;
  ownerAgentId?: string | null;
  weekNumber: number;
  mode: "STEP" | "RUN_TO_FINAL";
  stepSizePlays: number;
}) {
  const season = await prisma.season.findFirst({
    where: { leagueId: input.leagueId, seasonNumber: 1 },
    orderBy: { createdAt: "desc" },
  });
  if (!season) throw new Error("Season 1 not found. Run SEASON1_SETUP first.");

  const games = await prisma.game.findMany({
    where: { leagueId: input.leagueId, seasonId: season.id, week: input.weekNumber },
    orderBy: { kickoffAt: "asc" },
  });
  if (games.length === 0) throw new Error(`No games found for week ${input.weekNumber}.`);

  await logStep({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    type: "WEEK_SIM_STARTED",
    summary: `Week ${input.weekNumber} simulation started (${input.mode}).`,
    meta: { weekNumber: input.weekNumber, mode: input.mode, games: games.length },
  });

  let finalized = 0;
  for (const game of games) {
    if (input.mode === "STEP") {
      await stepGame(game.id, input.stepSizePlays);
      await refreshGameBoxScore(game.id);
      await refreshStandingsForFinal(game.id);
    } else {
      let guard = 0;
      let status = game.status;
      while (status !== "FINAL" && guard < 400) {
        const stepped = await stepGame(game.id, input.stepSizePlays);
        await refreshGameBoxScore(game.id);
        await refreshStandingsForFinal(game.id);
        status = String(stepped.status) as "LIVE" | "FINAL" | "SCHEDULED";
        guard += 1;
      }
    }
    const updated = await prisma.game.findUnique({ where: { id: game.id } });
    if (updated?.status === "FINAL") finalized += 1;
  }

  const finalGames = await prisma.game.findMany({
    where: { leagueId: input.leagueId, seasonId: season.id, week: input.weekNumber, status: "FINAL" },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoffAt: "asc" },
  });

  await ensureSocialPost({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    title: `Week ${input.weekNumber} Recap`,
    bodyMarkdown: finalGames.length
      ? finalGames
          .map((g) => `- ${g.awayTeam.shortName} ${g.scoreAway} - ${g.homeTeam.shortName} ${g.scoreHome}`)
          .join("\n")
      : `Week ${input.weekNumber} simulation is in progress.`,
    tags: ["season1", `week${input.weekNumber}`, "recap"],
    visibility: "PUBLIC",
  });

  await logStep({
    leagueId: input.leagueId,
    ownerAgentId: input.ownerAgentId,
    runbookId: input.runbookId,
    runbookRunId: input.runbookRunId,
    type: "WEEK_SIM_COMPLETED",
    summary: `Week ${input.weekNumber} simulation completed (${finalized}/${games.length} final).`,
    meta: { weekNumber: input.weekNumber, finalized, total: games.length },
  });

  return { weekNumber: input.weekNumber, finalized, total: games.length };
}

export async function executeRunbookAction(runbook: RunbookLike, runbookRunId: string): Promise<string> {
  const payload = parsePayload(runbook.actionPayloadJson);
  let outputSummary = "";

  if (runbook.actionType === "RUN_AGENT") {
    const agentId = String(payload.agentId ?? "");
    if (!agentId) throw new Error("RUN_AGENT requires payload.agentId");
    const result = await runAgent(agentId, runbook.leagueId);
    outputSummary = result.summary;
  } else if (runbook.actionType === "RUN_KICKOFF") {
    const result = await runKickoff(runbook.leagueId);
    outputSummary = `Kickoff: ${result.totalTasks} tasks, ${result.totalApprovals} approvals`;
  } else if (runbook.actionType === "RUN_COMBINE") {
    const agentId = String(payload.agentId ?? "");
    const runType = String(payload.runType ?? "COMBINE") as "COMBINE" | "SCRIMMAGE";
    if (!agentId) throw new Error("RUN_COMBINE requires payload.agentId");
    const result = await runCombine(agentId, runType, Number(payload.seed ?? 42), runbook.leagueId);
    outputSummary = `Combine ${result.combineRunId}: overall ${result.scoreOverall}`;
  } else if (runbook.actionType === "GENERATE_REPORT") {
    const targetAgentId = String(payload.targetAgentId ?? "commissioner");
    const agent = await prisma.agent.findFirst({ where: { id: targetAgentId, leagueId: runbook.leagueId } });
    if (!agent) throw new Error("Report target agent not found");
    const message = await prisma.message.create({
      data: {
        leagueId: runbook.leagueId,
        agentId: agent.id,
        type: "REPORT",
        title: `${agent.name} Runbook Report`,
        body: `Generated by runbook ${runbook.name} at ${new Date().toISOString()}`,
        meta: JSON.stringify({ runbookId: runbook.id, runbookRunId }),
      },
    });
    await prisma.eventLog.create({
      data: {
        leagueId: runbook.leagueId,
        agentId: agent.id,
        type: "AGENT_WEEKLY_REPORT",
        summary: `${agent.name} report generated via runbook.`,
        entityType: "AGENT",
        entityId: agent.id,
        meta: JSON.stringify({ messageId: message.id, runbookId: runbook.id }),
      },
    });
    outputSummary = `Report generated for ${agent.name}`;
  } else if (runbook.actionType === "SEASON1_SETUP") {
    const result = await runSeasonOneSetup({
      leagueId: runbook.leagueId,
      runbookId: runbook.id,
      runbookRunId,
      ownerAgentId: runbook.ownerAgentId,
    });
    outputSummary = `Season 1 setup complete: ${result.teams} teams, ${result.games} games, ${result.weekOneGames} Week 1 matchups.`;
  } else if (runbook.actionType === "SEASON0_KICKOFF_AGENTS") {
    const result = await runSeasonZeroKickoffAgents(runbook.leagueId);
    outputSummary = `Season 0 kickoff agents complete: tasks=${result.tasksTotal}, proposals=${result.proposalsTotal}, incidents=${result.incidentsTotal}, posts=${result.socialPostsTotal}, combines=${result.combineRunsTotal}.`;
  } else if (runbook.actionType === "WEEK_SIMULATE" || runbook.actionType === "RUN_WEEK") {
    const weekNumber = Math.max(1, Number(payload.weekNumber ?? payload.week ?? 1));
    const mode = String(payload.mode ?? "RUN_TO_FINAL") === "STEP" ? "STEP" : "RUN_TO_FINAL";
    const stepSizePlays = Math.max(1, Math.min(50, Number(payload.stepSizePlays ?? 20)));
    const result = await runWeekSimulate({
      leagueId: runbook.leagueId,
      runbookId: runbook.id,
      runbookRunId,
      ownerAgentId: runbook.ownerAgentId,
      weekNumber,
      mode,
      stepSizePlays,
    });
    outputSummary = `Week ${result.weekNumber} simulation: ${result.finalized}/${result.total} final.`;
  } else if (runbook.actionType === "POST_WEEKLY_SLATE") {
    const weekNumber = Math.max(1, Number(payload.weekNumber ?? 1));
    const season = await prisma.season.findFirst({ where: { leagueId: runbook.leagueId, seasonNumber: 1 } });
    if (!season) throw new Error("Season 1 not found");
    const games = await prisma.game.findMany({
      where: { leagueId: runbook.leagueId, seasonId: season.id, week: weekNumber },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { kickoffAt: "asc" },
    });
    const post = await ensureSocialPost({
      leagueId: runbook.leagueId,
      ownerAgentId: runbook.ownerAgentId,
      runbookId: runbook.id,
      runbookRunId,
      title: `Week ${weekNumber} Slate`,
      bodyMarkdown: games.map((g) => `- ${g.awayTeam.shortName} @ ${g.homeTeam.shortName}`).join("\n") || "No games scheduled.",
      tags: ["season1", `week${weekNumber}`, "slate"],
      visibility: "PUBLIC",
    });
    outputSummary = post.created ? `Week ${weekNumber} slate posted.` : `Week ${weekNumber} slate already posted.`;
  } else if (runbook.actionType === "POST_WEEKLY_RECAP") {
    const weekNumber = Math.max(1, Number(payload.weekNumber ?? 1));
    const season = await prisma.season.findFirst({ where: { leagueId: runbook.leagueId, seasonNumber: 1 } });
    if (!season) throw new Error("Season 1 not found");
    const games = await prisma.game.findMany({
      where: { leagueId: runbook.leagueId, seasonId: season.id, week: weekNumber, status: "FINAL" },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { kickoffAt: "asc" },
    });
    const post = await ensureSocialPost({
      leagueId: runbook.leagueId,
      ownerAgentId: runbook.ownerAgentId,
      runbookId: runbook.id,
      runbookRunId,
      title: `Week ${weekNumber} Recap`,
      bodyMarkdown:
        games.map((g) => `- ${g.awayTeam.shortName} ${g.scoreAway} - ${g.homeTeam.shortName} ${g.scoreHome}`).join("\n") ||
        "No final games for this week yet.",
      tags: ["season1", `week${weekNumber}`, "recap"],
      visibility: "PUBLIC",
    });
    outputSummary = post.created ? `Week ${weekNumber} recap posted.` : `Week ${weekNumber} recap already posted.`;
  } else if (runbook.actionType === "SIM_ALL_GAMES") {
    const season = await prisma.season.findFirst({ where: { leagueId: runbook.leagueId, seasonNumber: 1 } });
    if (!season) throw new Error("Season 1 not found");
    const remainingWeeks = await prisma.game.findMany({
      where: { leagueId: runbook.leagueId, seasonId: season.id, status: { not: "FINAL" } },
      select: { week: true },
      distinct: ["week"],
    });
    for (const w of remainingWeeks) {
      await runWeekSimulate({
        leagueId: runbook.leagueId,
        runbookId: runbook.id,
        runbookRunId,
        ownerAgentId: runbook.ownerAgentId,
        weekNumber: w.week,
        mode: "RUN_TO_FINAL",
        stepSizePlays: 20,
      });
    }
    outputSummary = `Simulated remaining weeks: ${remainingWeeks.map((w) => w.week).sort((a, b) => a - b).join(", ") || "none"}.`;
  } else {
    throw new Error(`Unsupported action type: ${runbook.actionType}`);
  }

  return outputSummary;
}
