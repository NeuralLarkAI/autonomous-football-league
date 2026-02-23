import { prisma } from "@afl/db";
import { runAgent, runCombine, SEASON0_DELIVERABLE_AGENT_ORDER } from "@afl/agents";

type KickoffSummary = {
  agentRuns: number;
  tasksTotal: number;
  proposalsTotal: number;
  incidentsTotal: number;
  incidentsResolved: number;
  socialPostsTotal: number;
  combineRunsTotal: number;
  approvalsPendingTier23: number;
  signoffsRequested: number;
  signoffsChangesRequested: number;
};

const MINIMUMS = {
  tasks: 50,
  proposals: 8,
  incidents: 3,
  socialPosts: 10,
  combineRuns: 5,
};

const PHASES = [
  {
    name: "Season 0 Foundation",
    description: "Agent onboarding, governance wiring, and baseline controls.",
    startDate: "2026-02-24T00:00:00.000Z",
    endDate: "2026-03-10T00:00:00.000Z",
    status: "ACTIVE",
  },
  {
    name: "Season 0 Compliance Hardening",
    description: "Approval tiers, signoffs, and incident escalation policy.",
    startDate: "2026-03-11T00:00:00.000Z",
    endDate: "2026-03-25T00:00:00.000Z",
    status: "PLANNED",
  },
  {
    name: "Season 0 Combine Readiness",
    description: "Agent benchmark cadence and ranked-safe gating.",
    startDate: "2026-03-26T00:00:00.000Z",
    endDate: "2026-04-10T00:00:00.000Z",
    status: "PLANNED",
  },
] as const;

const RUNBOOKS = [
  {
    name: "Season 0 Kickoff (Agents)",
    description: "Runs all departmental agents and tops up Season 0 outputs.",
    ownerAgentId: "commissioner",
    triggerType: "MANUAL",
    actionType: "SEASON0_KICKOFF_AGENTS",
    actionPayloadJson: "{}",
    isEnabled: true,
  },
  {
    name: "Weekly Commissioner Brief",
    description: "Generate weekly commissioner report.",
    ownerAgentId: "commissioner",
    triggerType: "MANUAL",
    actionType: "GENERATE_REPORT",
    actionPayloadJson: JSON.stringify({ targetAgentId: "commissioner", reportType: "WEEKLY" }),
    isEnabled: true,
  },
  {
    name: "Weekly Integrity Audit",
    description: "Run integrity agent weekly audit cycle.",
    ownerAgentId: "integrity",
    triggerType: "MANUAL",
    actionType: "RUN_AGENT",
    actionPayloadJson: JSON.stringify({ agentId: "integrity" }),
    isEnabled: true,
  },
  {
    name: "Weekly Combine",
    description: "Run combine for ranked readiness tracking.",
    ownerAgentId: "rankings",
    triggerType: "MANUAL",
    actionType: "RUN_COMBINE",
    actionPayloadJson: JSON.stringify({ agentId: "rankings", runType: "COMBINE", seed: 70 }),
    isEnabled: true,
  },
  {
    name: "Weekly Broadcast Recap",
    description: "Generate weekly recap report for social publication.",
    ownerAgentId: "broadcast-media",
    triggerType: "MANUAL",
    actionType: "GENERATE_REPORT",
    actionPayloadJson: JSON.stringify({ targetAgentId: "broadcast-media", reportType: "WEEKLY_RECAP" }),
    isEnabled: true,
  },
] as const;

async function logEvent(input: {
  leagueId: string;
  type: string;
  summary: string;
  agentId?: string;
  tier?: number;
  entityType?: string;
  entityId?: string;
  proposalId?: string;
  taskId?: string;
  incidentId?: string;
  postId?: string;
  combineRunId?: string;
  runbookId?: string;
  visibility?: "PUBLIC" | "LEAGUE_ONLY" | "PRIVATE";
  meta?: Record<string, unknown>;
}) {
  await prisma.eventLog.create({
    data: {
      leagueId: input.leagueId,
      type: input.type,
      summary: input.summary,
      agentId: input.agentId,
      tier: input.tier,
      entityType: input.entityType,
      entityId: input.entityId,
      proposalId: input.proposalId,
      taskId: input.taskId,
      incidentId: input.incidentId,
      postId: input.postId,
      combineRunId: input.combineRunId,
      runbookId: input.runbookId,
      visibility: input.visibility ?? "LEAGUE_ONLY",
      meta: JSON.stringify(input.meta ?? {}),
    },
  });
}

async function ensureTask(input: {
  leagueId: string;
  title: string;
  description: string;
  department: string;
  tier: number;
  assigneeId: string;
}) {
  const existing = await prisma.task.findFirst({ where: { leagueId: input.leagueId, title: input.title } });
  if (existing) return existing;
  const task = await prisma.task.create({
    data: {
      leagueId: input.leagueId,
      title: input.title,
      description: input.description,
      department: input.department,
      tier: input.tier,
      assigneeId: input.assigneeId,
      status: "BACKLOG",
      acceptanceCriteria: "Task output is completed and linked to feed evidence.",
      riskNotes: "Missing output reduces Season 0 launch readiness.",
      testPlan: "Validate linked entity state and EventLog entries.",
      rollbackPlan: "Move task back to BACKLOG and rerun responsible agent.",
    },
  });
  await logEvent({
    leagueId: input.leagueId,
    agentId: input.assigneeId,
    type: "TASK_CREATED",
    summary: `Kickoff task created: ${task.title}`,
    entityType: "TASK",
    entityId: task.id,
    taskId: task.id,
    tier: input.tier,
  });
  return task;
}

async function ensureDependency(leagueId: string, taskId: string, dependsOnTaskId: string) {
  if (taskId === dependsOnTaskId) return;
  await prisma.taskDependency.upsert({
    where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    update: {},
    create: { leagueId, taskId, dependsOnTaskId },
  });
}

async function ensureProposal(input: {
  leagueId: string;
  title: string;
  summary: string;
  tier: number;
  creatorAgentId: string;
  changeType: string;
  affectedArea: string;
  requiredSignoffs: string[];
  weak?: boolean;
}) {
  let proposal = await prisma.proposal.findFirst({ where: { leagueId: input.leagueId, title: input.title } });
  if (!proposal) {
    proposal = await prisma.proposal.create({
      data: {
        leagueId: input.leagueId,
        title: input.title,
        summary: input.summary,
        tier: input.tier,
        changeType: input.changeType,
        affectedArea: input.affectedArea,
        beforeJson: JSON.stringify({ version: "before" }),
        afterJson: JSON.stringify({ version: "after" }),
        risk: input.weak ? "Intentionally weak risk section for QA challenge." : "Managed risk with staged rollout.",
        testPlan: input.weak ? "TODO" : "Run integration tests plus policy checks.",
        rollbackPlan: input.weak ? "N/A" : "Revert proposal changes and restore prior state.",
        requiredSignoffs: JSON.stringify(input.requiredSignoffs),
        status: "PENDING",
        creatorAgentId: input.creatorAgentId,
      },
    });
    await logEvent({
      leagueId: input.leagueId,
      agentId: input.creatorAgentId,
      type: "PROPOSAL_CREATED",
      summary: `Kickoff proposal created: ${proposal.title}`,
      tier: input.tier,
      entityType: "PROPOSAL",
      entityId: proposal.id,
      proposalId: proposal.id,
    });
  }

  const approval = await prisma.approval.findFirst({
    where: { leagueId: input.leagueId, proposalId: proposal.id },
  });
  if (!approval) {
    await prisma.approval.create({
      data: {
        leagueId: input.leagueId,
        proposalId: proposal.id,
        agentId: input.creatorAgentId,
        tier: input.tier,
        summary: input.summary,
        status: "PENDING",
        signoffs: JSON.stringify(input.requiredSignoffs),
      },
    });
    await logEvent({
      leagueId: input.leagueId,
      agentId: input.creatorAgentId,
      type: "APPROVAL_CREATED",
      summary: `Approval queued for kickoff proposal: ${proposal.title}`,
      tier: input.tier,
      entityType: "PROPOSAL",
      entityId: proposal.id,
      proposalId: proposal.id,
    });
  }

  for (const signoffAgentId of input.requiredSignoffs) {
    const signoff = await prisma.signoff.upsert({
      where: { proposalId_agentId: { proposalId: proposal.id, agentId: signoffAgentId } },
      update: {},
      create: {
        leagueId: input.leagueId,
        proposalId: proposal.id,
        agentId: signoffAgentId,
        status: "REQUESTED",
        comment: "Requested by Season 0 kickoff orchestration.",
      },
    });
    await logEvent({
      leagueId: input.leagueId,
      agentId: signoffAgentId,
      type: "SIGNOFF_REQUESTED",
      summary: `Signoff requested for proposal: ${proposal.title}`,
      tier: input.tier,
      entityType: "PROPOSAL",
      entityId: proposal.id,
      proposalId: proposal.id,
      meta: { signoffId: signoff.id },
    });
  }

  return proposal;
}

async function ensureSocialPost(input: {
  leagueId: string;
  authorAgentId?: string;
  title: string;
  bodyMarkdown: string;
  tags: string[];
  visibility: "PUBLIC" | "LEAGUE_ONLY";
}) {
  const existing = await prisma.post.findFirst({
    where: { leagueId: input.leagueId, title: input.title },
  });
  if (existing) return existing;
  const post = await prisma.post.create({
    data: {
      leagueId: input.leagueId,
      authorAgentId: input.authorAgentId ?? null,
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      tags: input.tags.join(","),
      visibility: input.visibility,
    },
  });
  await logEvent({
    leagueId: input.leagueId,
    agentId: input.authorAgentId,
    type: "SOCIAL_POST_CREATED",
    summary: `Kickoff social post created: ${post.title}`,
    entityType: "POST",
    entityId: post.id,
    postId: post.id,
    visibility: input.visibility,
  });
  return post;
}

async function ensureIncident(input: {
  leagueId: string;
  sourceAgentId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  resolve?: boolean;
}) {
  let incident = await prisma.incident.findFirst({ where: { leagueId: input.leagueId, title: input.title } });
  if (!incident) {
    incident = await prisma.incident.create({
      data: {
        leagueId: input.leagueId,
        sourceAgentId: input.sourceAgentId,
        severity: input.severity,
        title: input.title,
        description: input.description,
        status: "OPEN",
      },
    });
    await logEvent({
      leagueId: input.leagueId,
      agentId: input.sourceAgentId,
      type: "INCIDENT_CREATED",
      summary: `Kickoff incident created: ${incident.title}`,
      entityType: "INCIDENT",
      entityId: incident.id,
      incidentId: incident.id,
    });
  }

  if (input.resolve && incident.status !== "RESOLVED") {
    incident = await prisma.incident.update({
      where: { id: incident.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    await logEvent({
      leagueId: input.leagueId,
      agentId: input.sourceAgentId,
      type: "INCIDENT_RESOLVED",
      summary: `Kickoff incident resolved: ${incident.title}`,
      entityType: "INCIDENT",
      entityId: incident.id,
      incidentId: incident.id,
    });
  }

  return incident;
}

async function ensureSeasonPhases(leagueId: string) {
  for (const phase of PHASES) {
    await prisma.seasonPhase.upsert({
      where: { seasonNumber_name: { seasonNumber: 0, name: phase.name } },
      update: {
        leagueId,
        description: phase.description,
        startDate: new Date(phase.startDate),
        endDate: new Date(phase.endDate),
        status: phase.status,
      },
      create: {
        leagueId,
        seasonNumber: 0,
        name: phase.name,
        description: phase.description,
        startDate: new Date(phase.startDate),
        endDate: new Date(phase.endDate),
        status: phase.status,
      },
    });
  }
  await prisma.seasonPhase.updateMany({
    where: { leagueId, seasonNumber: 0, name: { not: PHASES[0].name } },
    data: { status: "PLANNED" },
  });
  await prisma.seasonPhase.updateMany({
    where: { leagueId, seasonNumber: 0, name: PHASES[0].name },
    data: { status: "ACTIVE" },
  });
}

async function ensureSeasonRunbooks(leagueId: string) {
  for (const runbook of RUNBOOKS) {
    const existing = await prisma.runbook.findFirst({
      where: { leagueId, name: runbook.name },
    });
    if (existing) {
      await prisma.runbook.update({
        where: { id: existing.id },
        data: {
          description: runbook.description,
          ownerAgentId: runbook.ownerAgentId,
          triggerType: runbook.triggerType,
          actionType: runbook.actionType,
          actionPayloadJson: runbook.actionPayloadJson,
          isEnabled: runbook.isEnabled,
        },
      });
      continue;
    }

    const created = await prisma.runbook.create({
      data: {
        leagueId,
        name: runbook.name,
        description: runbook.description,
        ownerAgentId: runbook.ownerAgentId,
        triggerType: runbook.triggerType,
        actionType: runbook.actionType,
        actionPayloadJson: runbook.actionPayloadJson,
        isEnabled: runbook.isEnabled,
      },
    });
    await logEvent({
      leagueId,
      agentId: runbook.ownerAgentId,
      type: "RUNBOOK_CREATED",
      summary: `Runbook ensured: ${created.name}`,
      entityType: "RUNBOOK",
      entityId: created.id,
      runbookId: created.id,
    });
  }
}

function tierSignoffs(tier: number) {
  if (tier >= 3) return ["commissioner", "integrity", "security"];
  if (tier >= 2) return ["commissioner", "integrity"];
  return ["qa-engineer"];
}

export async function runSeasonZeroKickoffAgents(leagueId: string): Promise<KickoffSummary> {
  const existing = await Promise.all([
    prisma.task.count({ where: { leagueId } }),
    prisma.proposal.count({ where: { leagueId } }),
    prisma.incident.count({ where: { leagueId } }),
    prisma.post.count({ where: { leagueId } }),
    prisma.combineRun.count({ where: { leagueId } }),
    prisma.incident.count({ where: { leagueId, status: "RESOLVED" } }),
    prisma.approval.count({ where: { leagueId, status: "PENDING", tier: { gte: 2 } } }),
    prisma.signoff.count({ where: { leagueId, status: "REQUESTED" } }),
    prisma.signoff.count({ where: { leagueId, status: "CHANGES_REQUESTED" } }),
  ]);
  const alreadyComplete =
    existing[0] >= MINIMUMS.tasks &&
    existing[1] >= MINIMUMS.proposals &&
    existing[2] >= MINIMUMS.incidents &&
    existing[3] >= MINIMUMS.socialPosts &&
    existing[4] >= MINIMUMS.combineRuns;

  if (alreadyComplete) {
    await ensureSeasonPhases(leagueId);
    await ensureSeasonRunbooks(leagueId);
    await logEvent({
      leagueId,
      type: "KICKOFF",
      summary: "Season 0 Kickoff (Agents) already complete; no duplicate artifacts created.",
      entityType: "LEAGUE",
      entityId: leagueId,
      meta: {
        tasks: existing[0],
        proposals: existing[1],
        incidents: existing[2],
        posts: existing[3],
        combineRuns: existing[4],
      },
    });
    return {
      agentRuns: 0,
      tasksTotal: existing[0],
      proposalsTotal: existing[1],
      incidentsTotal: existing[2],
      incidentsResolved: existing[5],
      socialPostsTotal: existing[3],
      combineRunsTotal: existing[4],
      approvalsPendingTier23: existing[6],
      signoffsRequested: existing[7],
      signoffsChangesRequested: existing[8],
    };
  }

  await logEvent({
    leagueId,
    type: "KICKOFF",
    summary: "Season 0 Kickoff (Agents) started.",
    entityType: "LEAGUE",
    entityId: leagueId,
  });

  let agentRuns = 0;
  for (const agentId of SEASON0_DELIVERABLE_AGENT_ORDER) {
    try {
      await runAgent(agentId, leagueId);
      agentRuns += 1;
    } catch (error) {
      await logEvent({
        leagueId,
        agentId,
        type: "AGENT_RUN_FAILED",
        summary: `Kickoff sequence failure on ${agentId}`,
        entityType: "AGENT",
        entityId: agentId,
        meta: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  const topUpDepartments = ["COMMISSIONER", "TECHNOLOGY", "SECURITY", "LEGAL_COMPLIANCE", "FOOTBALL_OPS", "MARKETING"];
  const topUpAgents = ["chief-of-staff", "architect", "security", "integrity", "program-manager", "broadcast-media"];

  const currentTaskCount = await prisma.task.count({ where: { leagueId } });
  if (currentTaskCount < MINIMUMS.tasks) {
    const needed = MINIMUMS.tasks - currentTaskCount;
    const topUpTasks: { id: string; assigneeId: string }[] = [];
    for (let i = 0; i < needed; i += 1) {
      const idx = i + 1;
      const assigneeId = topUpAgents[i % topUpAgents.length];
      const task = await ensureTask({
        leagueId,
        assigneeId,
        title: `Season 0 Backlog Top-up ${idx.toString().padStart(2, "0")}`,
        description: "Generated by kickoff top-up to satisfy cross-department Season 0 backlog minimum.",
        department: topUpDepartments[i % topUpDepartments.length],
        tier: idx % 7 === 0 ? 2 : 1,
      });
      topUpTasks.push({ id: task.id, assigneeId });
    }
    for (let i = 1; i < topUpTasks.length; i += 1) {
      if (i % 3 === 0) {
        await ensureDependency(leagueId, topUpTasks[i].id, topUpTasks[i - 1].id);
      }
    }
  }

  const proposalSpecs = [
    { title: "Season 0 Interface Stability Contract", tier: 2, creatorAgentId: "architect", changeType: "API", affectedArea: "TECHNOLOGY" },
    { title: "Season 0 Determinism and Replay Policy", tier: 3, creatorAgentId: "architect", changeType: "POLICY", affectedArea: "GAMEPLAY" },
    { title: "Agent Permissions Matrix Update", tier: 2, creatorAgentId: "architect", changeType: "SECURITY", affectedArea: "AUTH" },
    { title: "API Scope Tightening Baseline", tier: 2, creatorAgentId: "security", changeType: "SECURITY", affectedArea: "AUTHZ" },
    { title: "Key Rotation Cadence Policy", tier: 2, creatorAgentId: "security", changeType: "SECURITY", affectedArea: "KEYS" },
    { title: "Ruleset Alignment v1", tier: 2, creatorAgentId: "rules-committee", changeType: "RULES", affectedArea: "COMPETITION" },
    { title: "Approval Queue SLA Controls", tier: 1, creatorAgentId: "chief-of-staff", changeType: "OPS", affectedArea: "GOVERNANCE" },
    { title: "Weak Proposal: Unbounded Retry Policy", tier: 2, creatorAgentId: "architect", changeType: "OPS", affectedArea: "RELIABILITY", weak: true },
  ] as const;
  for (const spec of proposalSpecs) {
    await ensureProposal({
      leagueId,
      title: spec.title,
      summary: `Kickoff proposal for ${spec.affectedArea}.`,
      tier: spec.tier,
      creatorAgentId: spec.creatorAgentId,
      changeType: spec.changeType,
      affectedArea: spec.affectedArea,
      requiredSignoffs: tierSignoffs(spec.tier),
      weak: "weak" in spec ? spec.weak : false,
    });
  }

  const weakProposal = await prisma.proposal.findFirst({
    where: { leagueId, title: "Weak Proposal: Unbounded Retry Policy" },
  });
  if (weakProposal) {
    const qaSignoff = await prisma.signoff.upsert({
      where: { proposalId_agentId: { proposalId: weakProposal.id, agentId: "qa-engineer" } },
      update: { status: "CHANGES_REQUESTED", comment: "Insufficient rollback/test depth. Please revise." },
      create: {
        leagueId,
        proposalId: weakProposal.id,
        agentId: "qa-engineer",
        status: "CHANGES_REQUESTED",
        comment: "Insufficient rollback/test depth. Please revise.",
      },
    });
    await logEvent({
      leagueId,
      agentId: "qa-engineer",
      type: "SIGNOFF_CHANGES_REQUESTED",
      summary: "QA requested changes on weak kickoff proposal.",
      entityType: "PROPOSAL",
      entityId: weakProposal.id,
      proposalId: weakProposal.id,
      meta: { signoffId: qaSignoff.id },
    });
  }

  await ensureIncident({
    leagueId,
    sourceAgentId: "security",
    severity: "HIGH",
    title: "Authz denied spike detected",
    description: "Security observed repeated AUTHZ_DENIED events beyond threshold.",
  });
  await ensureIncident({
    leagueId,
    sourceAgentId: "integrity",
    severity: "MEDIUM",
    title: "Potential rule violation in approval flow",
    description: "Integrity flagged proposal path without full signoff chain.",
  });
  await ensureIncident({
    leagueId,
    sourceAgentId: "sre",
    severity: "HIGH",
    title: "Elevated API error rate on runbook execution",
    description: "SRE observed elevated runbook API error rates during kickoff burst.",
    resolve: true,
  });

  const combineAgents = ["commissioner", "architect", "security", "integrity", "qa-engineer", "rankings"];
  for (const [idx, agentId] of combineAgents.entries()) {
    const existing = await prisma.combineRun.findFirst({
      where: {
        leagueId,
        agentId,
        runType: "COMBINE",
        notes: `season0-kickoff-agents:${agentId}`,
      },
    });
    if (existing) continue;
    const result = await runCombine(agentId, "COMBINE", 90 + idx, leagueId);
    await prisma.combineRun.update({
      where: { id: result.combineRunId },
      data: { notes: `season0-kickoff-agents:${agentId}` },
    });
  }

  const combineLeaders = await prisma.combineRun.findMany({
    where: { leagueId, status: "COMPLETED" },
    include: { agent: { select: { name: true } } },
    orderBy: [{ scoreOverall: "desc" }, { createdAt: "desc" }],
    take: 5,
  });
  await ensureSocialPost({
    leagueId,
    authorAgentId: "rankings",
    title: "Season 0 Combine Leaderboard",
    bodyMarkdown:
      combineLeaders.length > 0
        ? combineLeaders
            .map((row, i) => `${i + 1}. ${row.agent.name} - ${row.scoreOverall.toFixed(2)} (${row.scoreReliability.toFixed(2)} rel)`)
            .join("\n")
        : "No combine results available yet.",
    tags: ["season0", "combine", "leaderboard"],
    visibility: "PUBLIC",
  });

  const socialSpecs = [
    { authorAgentId: "commissioner", title: "Season 0 Kickoff Announcement", body: "Season 0 kickoff initiated across all departments." },
    { authorAgentId: "commissioner", title: "Season 0 League Announcement", body: "Governance and operations are now fully agent-driven." },
    { authorAgentId: "commissioner", title: "Season 0 Approval Queue Summary", body: "Tier 2/3 approvals are staged for review and signoff." },
    { authorAgentId: "rules-committee", title: "Rules Bulletin: Tiering Primer", body: "Rules bulletin covering Tier 0-3 governance boundaries." },
    { authorAgentId: "rules-committee", title: "Rules Bulletin: Signoff Expectations", body: "Required signoffs and review SLA expectations." },
    { authorAgentId: "broadcast-media", title: "Season 0 Roadmap", body: "Weekly roadmap spanning governance, ops, and combine benchmarks." },
    { authorAgentId: "broadcast-media", title: "This Week in AFL", body: "Weekly recap across tasks, incidents, and proposals." },
    { authorAgentId: "broadcast-media", title: "Storyline: Integrity vs Velocity", body: "Balancing release speed with policy rigor." },
    { authorAgentId: "broadcast-media", title: "Storyline: Ops Reliability", body: "Runbook improvements after kickoff load test." },
    { authorAgentId: "integrity", title: "Integrity Bulletin", body: "Integrity observations and incident posture update." },
  ] as const;
  for (const spec of socialSpecs) {
    await ensureSocialPost({
      leagueId,
      authorAgentId: spec.authorAgentId,
      title: spec.title,
      bodyMarkdown: spec.body,
      tags: ["season0", "agents"],
      visibility: "PUBLIC",
    });
  }

  await ensureSeasonPhases(leagueId);
  await ensureSeasonRunbooks(leagueId);

  const [tasksTotal, proposalsTotal, incidentsTotal, incidentsResolved, socialPostsTotal, combineRunsTotal, approvalsPendingTier23, signoffsRequested, signoffsChangesRequested] =
    await Promise.all([
      prisma.task.count({ where: { leagueId } }),
      prisma.proposal.count({ where: { leagueId } }),
      prisma.incident.count({ where: { leagueId } }),
      prisma.incident.count({ where: { leagueId, status: "RESOLVED" } }),
      prisma.post.count({ where: { leagueId } }),
      prisma.combineRun.count({ where: { leagueId } }),
      prisma.approval.count({ where: { leagueId, status: "PENDING", tier: { gte: 2 } } }),
      prisma.signoff.count({ where: { leagueId, status: "REQUESTED" } }),
      prisma.signoff.count({ where: { leagueId, status: "CHANGES_REQUESTED" } }),
    ]);

  await logEvent({
    leagueId,
    type: "KICKOFF",
    summary: "Season 0 Kickoff (Agents) completed.",
    entityType: "LEAGUE",
    entityId: leagueId,
    meta: {
      agentRuns,
      tasksTotal,
      proposalsTotal,
      incidentsTotal,
      incidentsResolved,
      socialPostsTotal,
      combineRunsTotal,
      approvalsPendingTier23,
      signoffsRequested,
      signoffsChangesRequested,
      minimums: MINIMUMS,
    },
  });

  return {
    agentRuns,
    tasksTotal,
    proposalsTotal,
    incidentsTotal,
    incidentsResolved,
    socialPostsTotal,
    combineRunsTotal,
    approvalsPendingTier23,
    signoffsRequested,
    signoffsChangesRequested,
  };
}
