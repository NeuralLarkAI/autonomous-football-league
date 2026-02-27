import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const DEFAULT_LEAGUE_ID = "league_afl_prime";
const DEFAULT_USER_ID = "user_commissioner_dev";
const DEV_PASSWORD_HASH = crypto.createHash("sha256").update("afl_pw:dev-password").digest("hex");
const INCLUDE_DEMO_ARTIFACTS = process.env.AFL_INCLUDE_DEMO_ARTIFACTS === "1";

type SeedAgent = {
  id: string;
  name: string;
  department: string;
  role: string;
  roleCardMd: string;
  permissionScopes: string[];
  kpis: Record<string, number>;
  permissions: {
    canCreateTasks: boolean;
    canCreateProposals: boolean;
    maxProposalTier: number;
    canApprove: boolean;
    canViewFinancials: boolean;
    canModifyRules: boolean;
  };
};

const AGENTS: SeedAgent[] = [
  {
    id: "commissioner",
    name: "Commissioner",
    department: "COMMISSIONER",
    role: "League Commissioner",
    roleCardMd: [
      "# Commissioner",
      "",
      "## Mission",
      "Ensure governance, safety, and delivery discipline for Season 0.",
      "",
      "## Responsibilities",
      "- Approve Tier 2/3 proposals",
      "- Lock/unlock season changes",
      "- Resolve escalations",
    ].join("\n"),
    permissionScopes: ["agents:run", "approvals:approve", "season:lock", "proposals:tier3"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 3,
      canApprove: true,
      canViewFinancials: true,
      canModifyRules: true,
    },
  },
  {
    id: "architect",
    name: "Architect",
    department: "TECHNOLOGY",
    role: "Systems Architect",
    roleCardMd: [
      "# Architect",
      "",
      "## Mission",
      "Design dependable platform foundations and interfaces.",
    ].join("\n"),
    permissionScopes: ["tasks:create", "proposals:create", "feed:write"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 3,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "security",
    name: "Security",
    department: "SECURITY",
    role: "Security Officer",
    roleCardMd: "# Security\n\nProtect operations, API surfaces, and change control.",
    permissionScopes: ["tasks:create", "incidents:create", "proposals:tier2"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 2,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "integrity",
    name: "Integrity",
    department: "LEGAL_COMPLIANCE",
    role: "Integrity & Compliance Officer",
    roleCardMd: "# Integrity\n\nMaintain fairness, compliance, and anti-tampering policy.",
    permissionScopes: ["tasks:create", "proposals:tier2", "reviews:request"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 2,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: true,
    },
  },
  {
    id: "program-manager",
    name: "Program Manager",
    department: "FOOTBALL_OPS",
    role: "Program / Project Manager",
    roleCardMd: "# Program Manager\n\nDrive backlog quality, sequencing, and delivery pacing.",
    permissionScopes: ["tasks:create", "tasks:update"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 1,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "backend-engineer",
    name: "Backend Engineer",
    department: "TECHNOLOGY",
    role: "Backend Engineer",
    roleCardMd: "# Backend Engineer\n\nImplement APIs, DB access, and orchestration services.",
    permissionScopes: ["tasks:create", "tasks:update", "feed:write"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 1,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "qa-engineer",
    name: "QA Engineer",
    department: "TECHNOLOGY",
    role: "QA Engineer",
    roleCardMd: "# QA Engineer\n\nValidate flows, regressions, and governance correctness.",
    permissionScopes: ["tasks:create", "reviews:request"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 1,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "sre",
    name: "SRE",
    department: "TECHNOLOGY",
    role: "Site Reliability Engineer",
    roleCardMd: "# SRE\n\nMaintain reliability, observability, and incident response readiness.",
    permissionScopes: ["tasks:create", "incidents:create", "health:monitor"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 2,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "rules-committee",
    name: "Rules Committee",
    department: "LEGAL_COMPLIANCE",
    role: "Rules Committee Chair",
    roleCardMd: "# Rules Committee\n\nDefine and maintain rules that preserve competitive integrity.",
    permissionScopes: ["tasks:create", "proposals:tier3", "approvals:submit"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 3,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: true,
    },
  },
  {
    id: "scheduler",
    name: "Scheduler",
    department: "FOOTBALL_OPS",
    role: "Schedule & Logistics Manager",
    roleCardMd: "# Scheduler\n\nBuild balanced schedules and logistics timelines.",
    permissionScopes: ["tasks:create", "tasks:update"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 1,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "rankings",
    name: "Rankings",
    department: "FOOTBALL_OPS",
    role: "Rankings & Analytics Officer",
    roleCardMd: "# Rankings\n\nOwn ranking logic and analytics quality controls.",
    permissionScopes: ["tasks:create", "proposals:tier2", "analytics:publish"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 2,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "broadcast-media",
    name: "Broadcast/Media",
    department: "MARKETING",
    role: "Broadcast and Media Relations",
    roleCardMd: "# Broadcast/Media\n\nPublish weekly recap posts and league-wide announcements.",
    permissionScopes: ["social:post", "feed:write"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 1,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "community-moderation",
    name: "Community/Moderation",
    department: "MARKETING",
    role: "Community and Moderation Agent",
    roleCardMd: "# Community/Moderation\n\nManage social quality, moderation tags, and community guidelines.",
    permissionScopes: ["social:moderate", "social:post", "feed:write"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 1,
      canApprove: false,
      canViewFinancials: false,
      canModifyRules: false,
    },
  },
  {
    id: "chief-of-staff",
    name: "Chief of Staff",
    department: "COMMISSIONER",
    role: "Chief of Staff",
    roleCardMd: "# Chief of Staff\n\nCoordinate phases, runbooks, and operational cadence for Season 0.",
    permissionScopes: ["season:phases", "runbooks:manage", "reports:generate"],
    kpis: { tasksCreated: 0, approvalsCreated: 0, incidentsRaised: 0 },
    permissions: {
      canCreateTasks: true,
      canCreateProposals: true,
      maxProposalTier: 2,
      canApprove: false,
      canViewFinancials: true,
      canModifyRules: false,
    },
  },
];

const SEASON_PHASES = [
  {
    name: "Foundation Bootstrapping",
    description: "Initialize platform entities, governance surfaces, and baseline observability.",
    startDate: "2026-02-24T00:00:00.000Z",
    endDate: "2026-03-09T23:59:59.000Z",
    status: "ACTIVE",
  },
  {
    name: "Agent Social + Trust",
    description: "Launch Moltbook social layer, moderation, and integrity bulletins.",
    startDate: "2026-03-10T00:00:00.000Z",
    endDate: "2026-03-24T23:59:59.000Z",
    status: "PLANNED",
  },
  {
    name: "Combine and Scrimmage Harness",
    description: "Benchmark agent governance reliability with deterministic scenarios.",
    startDate: "2026-03-25T00:00:00.000Z",
    endDate: "2026-04-08T23:59:59.000Z",
    status: "PLANNED",
  },
  {
    name: "Automation Hardening",
    description: "Operationalize runbooks, scheduled hooks, and commissioner dashboards.",
    startDate: "2026-04-09T00:00:00.000Z",
    endDate: "2026-04-23T23:59:59.000Z",
    status: "PLANNED",
  },
] as const;

const RUNBOOKS = [
  {
    name: "Season 0 Kickoff (Agents)",
    description: "Comprehensive Season 0 orchestration across all department agents.",
    ownerAgentId: "commissioner",
    triggerType: "MANUAL",
    scheduleType: "INTERVAL",
    intervalSeconds: null,
    cron: null,
    actionType: "SEASON0_KICKOFF_AGENTS",
    actionPayloadJson: "{}",
    isEnabled: true,
  },
  {
    name: "Weekly Commissioner Brief",
    description: "Weekly commissioner briefing report.",
    ownerAgentId: "commissioner",
    triggerType: "SCHEDULED",
    scheduleType: "INTERVAL",
    intervalSeconds: 3600,
    cron: null,
    actionType: "GENERATE_REPORT",
    actionPayloadJson: JSON.stringify({ targetAgentId: "commissioner", reportType: "WEEKLY" }),
    isEnabled: true,
  },
  {
    name: "Weekly Integrity Audit",
    description: "Weekly integrity audit run.",
    ownerAgentId: "integrity",
    triggerType: "SCHEDULED",
    scheduleType: "INTERVAL",
    intervalSeconds: 900,
    cron: null,
    actionType: "RUN_AGENT",
    actionPayloadJson: JSON.stringify({ agentId: "integrity" }),
    isEnabled: true,
  },
  {
    name: "Weekly Combine",
    description: "Weekly combine benchmark run.",
    ownerAgentId: "rankings",
    triggerType: "SCHEDULED",
    scheduleType: "INTERVAL",
    intervalSeconds: 1200,
    cron: null,
    actionType: "RUN_COMBINE",
    actionPayloadJson: JSON.stringify({ agentId: "rankings", runType: "COMBINE", seed: 70 }),
    isEnabled: false,
  },
  {
    name: "Weekly Broadcast Recap",
    description: "Weekly broadcast recap report.",
    ownerAgentId: "broadcast-media",
    triggerType: "SCHEDULED",
    scheduleType: "INTERVAL",
    intervalSeconds: 1800,
    cron: null,
    actionType: "GENERATE_REPORT",
    actionPayloadJson: JSON.stringify({ targetAgentId: "broadcast-media", reportType: "WEEKLY_RECAP" }),
    isEnabled: true,
  },
  {
    name: "Ops Health Check",
    description: "Scheduled ops health check run by SRE.",
    ownerAgentId: "sre",
    triggerType: "SCHEDULED",
    scheduleType: "INTERVAL",
    intervalSeconds: 2400,
    cron: null,
    actionType: "RUN_AGENT",
    actionPayloadJson: JSON.stringify({ agentId: "sre" }),
    isEnabled: true,
  },
  {
    name: "Season 0 Kickoff Runbook",
    description: "Executes deterministic kickoff orchestration to populate baseline backlog.",
    ownerAgentId: "commissioner",
    triggerType: "MANUAL",
    scheduleType: "INTERVAL",
    intervalSeconds: null,
    cron: null,
    actionType: "RUN_KICKOFF",
    actionPayloadJson: JSON.stringify({ season: 0 }),
    isEnabled: true,
  },
  {
    name: "Start Week 1",
    description: "Runs Week 1 games in deterministic mode and finalizes standings.",
    ownerAgentId: "commissioner",
    triggerType: "MANUAL",
    scheduleType: "INTERVAL",
    intervalSeconds: null,
    cron: null,
    actionType: "WEEK_SIMULATE",
    actionPayloadJson: JSON.stringify({ weekNumber: 1, mode: "RUN_TO_FINAL", stepSizePlays: 20 }),
    isEnabled: true,
  },
  {
    name: "Season 1 Setup",
    description: "Creates Season 1 entities, schedule, standings, and launch social posts.",
    ownerAgentId: "commissioner",
    triggerType: "MANUAL",
    scheduleType: "INTERVAL",
    intervalSeconds: null,
    cron: null,
    actionType: "SEASON1_SETUP",
    actionPayloadJson: JSON.stringify({ seasonNumber: 1, teamCount: 8 }),
    isEnabled: true,
  },
  {
    name: "Post Weekly Slate",
    description: "Creates a social slate announcement for a selected week.",
    ownerAgentId: "broadcast-media",
    triggerType: "MANUAL",
    scheduleType: "INTERVAL",
    intervalSeconds: null,
    cron: null,
    actionType: "POST_WEEKLY_SLATE",
    actionPayloadJson: JSON.stringify({ weekNumber: 1 }),
    isEnabled: true,
  },
  {
    name: "Post Weekly Recap",
    description: "Creates a social recap post for completed games in a week.",
    ownerAgentId: "broadcast-media",
    triggerType: "MANUAL",
    scheduleType: "INTERVAL",
    intervalSeconds: null,
    cron: null,
    actionType: "POST_WEEKLY_RECAP",
    actionPayloadJson: JSON.stringify({ weekNumber: 1 }),
    isEnabled: true,
  },
] as const;

const AGENT_WORK_CYCLE_AGENT_IDS = [
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
  "broadcast-media",
  "community-moderation",
  "chief-of-staff",
] as const;

const SEASON1_ENGINE_VERSION = "engine@0.1.0";

const TEAM_SEEDS = [
  { name: "Apex Comets", shortName: "APX", color: "#38bdf8", schemeOffense: "SPREAD", schemeDefense: "ZONE", coachAgentId: "program-manager" },
  { name: "Byte Hawks", shortName: "BYT", color: "#f97316", schemeOffense: "WEST_COAST", schemeDefense: "MAN", coachAgentId: "architect" },
  { name: "Cipher Guard", shortName: "CGR", color: "#ef4444", schemeOffense: "POWER", schemeDefense: "BLITZ", coachAgentId: "security" },
  { name: "Delta Forge", shortName: "DLT", color: "#22c55e", schemeOffense: "VERTICAL", schemeDefense: "SHELL", coachAgentId: "sre" },
  { name: "Echo Knights", shortName: "EKO", color: "#a855f7", schemeOffense: "SPREAD", schemeDefense: "ZONE", coachAgentId: "qa-engineer" },
  { name: "Flux Rangers", shortName: "FLX", color: "#14b8a6", schemeOffense: "WEST_COAST", schemeDefense: "ZONE", coachAgentId: "backend-engineer" },
  { name: "Grid Titans", shortName: "GRD", color: "#facc15", schemeOffense: "POWER", schemeDefense: "MAN", coachAgentId: "scheduler" },
  { name: "Helix Blaze", shortName: "HLX", color: "#fb7185", schemeOffense: "VERTICAL", schemeDefense: "SHELL", coachAgentId: "rankings" },
] as const;

function roundRobinPairings(teamIds: string[]): Array<Array<{ homeTeamId: string; awayTeamId: string }>> {
  if (teamIds.length % 2 !== 0) throw new Error("Team count must be even");
  const teams = [...teamIds];
  const weeks: Array<Array<{ homeTeamId: string; awayTeamId: string }>> = [];
  const rounds = teams.length - 1;
  for (let round = 0; round < rounds; round += 1) {
    const weekGames: Array<{ homeTeamId: string; awayTeamId: string }> = [];
    for (let i = 0; i < teams.length / 2; i += 1) {
      const a = teams[i];
      const b = teams[teams.length - 1 - i];
      const homeTeamId = (round + i) % 2 === 0 ? a : b;
      const awayTeamId = (round + i) % 2 === 0 ? b : a;
      weekGames.push({ homeTeamId, awayTeamId });
    }
    weeks.push(weekGames);
    const fixed = teams[0];
    const rotating = teams.slice(1);
    const last = rotating.pop()!;
    rotating.unshift(last);
    teams.splice(0, teams.length, fixed, ...rotating);
  }
  return weeks;
}

function deterministicGameSeed(seasonNumber: number, week: number, homeTeamId: string, awayTeamId: string): string {
  return crypto
    .createHash("sha256")
    .update(`season:${seasonNumber}|week:${week}|home:${homeTeamId}|away:${awayTeamId}`)
    .digest("hex")
    .slice(0, 16);
}

async function ensureProposalWithApproval(input: {
  leagueId: string;
  title: string;
  summary: string;
  tier: number;
  changeType: string;
  affectedArea: string;
  beforeJson: string;
  afterJson: string;
  risk: string;
  testPlan: string;
  rollbackPlan: string;
  requiredSignoffs: string[];
  creatorAgentId: string;
}) {
  let proposal = await prisma.proposal.findFirst({ where: { title: input.title } });
  let created = false;

  if (!proposal) {
    proposal = await prisma.proposal.create({
      data: {
        leagueId: input.leagueId,
        title: input.title,
        summary: input.summary,
        tier: input.tier,
        changeType: input.changeType,
        affectedArea: input.affectedArea,
        beforeJson: input.beforeJson,
        afterJson: input.afterJson,
        risk: input.risk,
        testPlan: input.testPlan,
        rollbackPlan: input.rollbackPlan,
        requiredSignoffs: JSON.stringify(input.requiredSignoffs),
        status: "PENDING",
        creatorAgentId: input.creatorAgentId,
      },
    });
    created = true;
  }

  const existingApproval = await prisma.approval.findFirst({
    where: { proposalId: proposal.id, status: "PENDING" },
  });

  if (!existingApproval) {
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
  }

  for (const agentId of input.requiredSignoffs) {
    await prisma.signoff.upsert({
      where: { proposalId_agentId: { proposalId: proposal.id, agentId } },
      update: {},
      create: {
        leagueId: input.leagueId,
        proposalId: proposal.id,
        agentId,
        status: "REQUESTED",
        comment: "Requested by seed for baseline governance flow.",
      },
    });
  }

  if (created) {
    await prisma.eventLog.create({
      data: {
        leagueId: input.leagueId,
        agentId: input.creatorAgentId,
        type: "PROPOSAL_CREATED",
        tier: input.tier,
        summary: `Proposal created: ${input.title}`,
        entityType: "PROPOSAL",
        entityId: proposal.id,
        proposalId: proposal.id,
        meta: JSON.stringify({ title: input.title, tier: input.tier, requiredSignoffs: input.requiredSignoffs }),
      },
    });

    await prisma.eventLog.create({
      data: {
        leagueId: input.leagueId,
        agentId: input.creatorAgentId,
        type: "APPROVAL_CREATED",
        tier: input.tier,
        summary: `Approval queued for proposal: ${input.title}`,
        entityType: "PROPOSAL",
        entityId: proposal.id,
        proposalId: proposal.id,
        meta: JSON.stringify({ title: input.title, tier: input.tier }),
      },
    });

    for (const agentId of input.requiredSignoffs) {
      await prisma.eventLog.create({
        data: {
          leagueId: input.leagueId,
          agentId,
          type: "SIGNOFF_REQUESTED",
          tier: input.tier,
          summary: `Signoff requested for proposal: ${input.title}`,
          entityType: "PROPOSAL",
          entityId: proposal.id,
          proposalId: proposal.id,
          meta: JSON.stringify({ proposalId: proposal.id, agentId }),
        },
      });
    }
  }
}

async function main() {
  console.log("Seeding AFL Season 0 v5...");

  await prisma.user.upsert({
    where: { email: "commissioner@afl.local" },
    update: { displayName: "Commissioner Dev", passwordHash: DEV_PASSWORD_HASH },
    create: {
      id: DEFAULT_USER_ID,
      email: "commissioner@afl.local",
      displayName: "Commissioner Dev",
      passwordHash: DEV_PASSWORD_HASH,
    },
  });

  await prisma.league.upsert({
    where: { slug: "afl-prime" },
    update: { name: "AFL Prime", ownerUserId: DEFAULT_USER_ID },
    create: {
      id: DEFAULT_LEAGUE_ID,
      name: "AFL Prime",
      slug: "afl-prime",
      ownerUserId: DEFAULT_USER_ID,
    },
  });

  await prisma.leagueMember.upsert({
    where: {
      leagueId_userId: {
        leagueId: DEFAULT_LEAGUE_ID,
        userId: DEFAULT_USER_ID,
      },
    },
    update: { role: "OWNER" },
    create: {
      leagueId: DEFAULT_LEAGUE_ID,
      userId: DEFAULT_USER_ID,
      role: "OWNER",
    },
  });

  await prisma.leagueSettings.upsert({
    where: { leagueId: DEFAULT_LEAGUE_ID },
    update: {
      isPublic: true,
      publicName: "AFL Prime",
      description: "Public spectator view for Season 0 governance and ranked combine ladder.",
    },
    create: {
      leagueId: DEFAULT_LEAGUE_ID,
      isPublic: true,
      publicName: "AFL Prime",
      description: "Public spectator view for Season 0 governance and ranked combine ladder.",
    },
  });

  for (const a of AGENTS) {
    await prisma.agent.upsert({
      where: { id: a.id },
      update: {
        leagueId: DEFAULT_LEAGUE_ID,
        name: a.name,
        department: a.department,
        role: a.role,
        status: "ACTIVE",
        permissions: JSON.stringify(a.permissions),
        roleCardMd: a.roleCardMd,
        permissionScopes: JSON.stringify(a.permissionScopes),
        kpis: JSON.stringify(a.kpis),
      },
      create: {
        id: a.id,
        leagueId: DEFAULT_LEAGUE_ID,
        name: a.name,
        department: a.department,
        role: a.role,
        status: "ACTIVE",
        permissions: JSON.stringify(a.permissions),
        roleCardMd: a.roleCardMd,
        permissionScopes: JSON.stringify(a.permissionScopes),
        kpis: JSON.stringify(a.kpis),
      },
    });
  }
  console.log(`Upserted ${AGENTS.length} agents.`);

  for (const a of AGENTS) {
    await prisma.rankedRating.upsert({
      where: {
        leagueId_agentId: {
          leagueId: DEFAULT_LEAGUE_ID,
          agentId: a.id,
        },
      },
      update: {},
      create: {
        leagueId: DEFAULT_LEAGUE_ID,
        agentId: a.id,
        rating: 1000,
        matches: 0,
      },
    });
  }
  console.log(`Upserted ${AGENTS.length} ranked ratings.`);

  await prisma.leagueState.upsert({
    where: { id: "singleton" },
    update: { leagueId: DEFAULT_LEAGUE_ID, autoRunEnabled: true },
    create: {
      id: "singleton",
      leagueId: DEFAULT_LEAGUE_ID,
      season: 0,
      seasonLock: false,
      autoRunEnabled: true,
      phase: "PRE_SEASON",
    },
  });
  console.log("LeagueState ready.");

  for (const phase of SEASON_PHASES) {
    await prisma.seasonPhase.upsert({
      where: { seasonNumber_name: { seasonNumber: 0, name: phase.name } },
      update: {
        leagueId: DEFAULT_LEAGUE_ID,
        description: phase.description,
        startDate: new Date(phase.startDate),
        endDate: new Date(phase.endDate),
        status: phase.status,
      },
      create: {
        leagueId: DEFAULT_LEAGUE_ID,
        seasonNumber: 0,
        name: phase.name,
        description: phase.description,
        startDate: new Date(phase.startDate),
        endDate: new Date(phase.endDate),
        status: phase.status,
      },
    });
  }
  console.log(`Upserted ${SEASON_PHASES.length} season phases.`);

  for (const runbook of RUNBOOKS) {
    // On update: only refresh metadata — never reset timing/lock fields the worker manages.
    // On create: initialize nextRunAt immediately for enabled scheduled runbooks.
    const isScheduled = runbook.triggerType === "SCHEDULED";
    await prisma.runbook.upsert({
      where: { name: runbook.name },
      update: {
        leagueId: DEFAULT_LEAGUE_ID,
        description: runbook.description,
        ownerAgentId: runbook.ownerAgentId,
        triggerType: runbook.triggerType,
        scheduleType: runbook.scheduleType,
        intervalSeconds: runbook.intervalSeconds ?? null,
        cron: runbook.cron,
        actionType: runbook.actionType,
        actionPayloadJson: runbook.actionPayloadJson,
        isEnabled: runbook.isEnabled,
      },
      create: {
        leagueId: DEFAULT_LEAGUE_ID,
        name: runbook.name,
        description: runbook.description,
        ownerAgentId: runbook.ownerAgentId,
        triggerType: runbook.triggerType,
        scheduleType: runbook.scheduleType,
        intervalSeconds: runbook.intervalSeconds ?? null,
        cron: runbook.cron,
        lastRunAt: null,
        nextRunAt: isScheduled && runbook.isEnabled ? new Date() : null,
        lockedAt: null,
        lockOwner: null,
        failureCount: 0,
        actionType: runbook.actionType,
        actionPayloadJson: runbook.actionPayloadJson,
        isEnabled: runbook.isEnabled,
      },
    });
  }
  console.log(`Upserted ${RUNBOOKS.length} runbooks.`);

  for (const agentId of AGENT_WORK_CYCLE_AGENT_IDS) {
    const name = `Auto Agent Cycle: ${agentId}`;
    await prisma.runbook.upsert({
      where: { name },
      update: {
        leagueId: DEFAULT_LEAGUE_ID,
        description: `Auto-run ${agentId} work cycle to keep tasks and outputs moving.`,
        ownerAgentId: agentId,
        triggerType: "SCHEDULED",
        scheduleType: "INTERVAL",
        intervalSeconds: 300,
        cron: null,
        actionType: "RUN_AGENT",
        actionPayloadJson: JSON.stringify({ agentId }),
        isEnabled: true,
      },
      create: {
        leagueId: DEFAULT_LEAGUE_ID,
        name,
        description: `Auto-run ${agentId} work cycle to keep tasks and outputs moving.`,
        ownerAgentId: agentId,
        triggerType: "SCHEDULED",
        scheduleType: "INTERVAL",
        intervalSeconds: 300,
        cron: null,
        lastRunAt: null,
        nextRunAt: new Date(),
        lockedAt: null,
        lockOwner: null,
        failureCount: 0,
        actionType: "RUN_AGENT",
        actionPayloadJson: JSON.stringify({ agentId }),
        isEnabled: true,
      },
    });
  }
  console.log(`Upserted ${AGENT_WORK_CYCLE_AGENT_IDS.length} auto agent cycle runbooks.`);

  // Ensure any already-seeded scheduled runbooks that are enabled have nextRunAt set
  // (handles live Railway instances where records exist with null nextRunAt).
  await prisma.runbook.updateMany({
    where: {
      leagueId: DEFAULT_LEAGUE_ID,
      triggerType: "SCHEDULED",
      isEnabled: true,
      nextRunAt: null,
    },
    data: { nextRunAt: new Date() },
  });

  const knownAgentIds = new Set(
    (await prisma.agent.findMany({
      where: { leagueId: DEFAULT_LEAGUE_ID },
      select: { id: true },
    })).map((a) => a.id)
  );

  const seededTeams: Array<{ id: string; shortName: string; name: string }> = [];
  for (const team of TEAM_SEEDS) {
    const coachAgentId = team.coachAgentId && knownAgentIds.has(team.coachAgentId) ? team.coachAgentId : null;
    const upserted = await prisma.team.upsert({
      where: {
        leagueId_shortName: {
          leagueId: DEFAULT_LEAGUE_ID,
          shortName: team.shortName,
        },
      },
      update: {
        name: team.name,
        color: team.color,
        coachAgentId,
        schemeOffense: team.schemeOffense,
        schemeDefense: team.schemeDefense,
      },
      create: {
        leagueId: DEFAULT_LEAGUE_ID,
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        coachAgentId,
        schemeOffense: team.schemeOffense,
        schemeDefense: team.schemeDefense,
      },
      select: { id: true, shortName: true, name: true },
    });
    seededTeams.push(upserted);
  }
  console.log(`Upserted ${seededTeams.length} Season 1 teams.`);

  const season1 = await prisma.season.upsert({
    where: {
      leagueId_seasonNumber: {
        leagueId: DEFAULT_LEAGUE_ID,
        seasonNumber: 1,
      },
    },
    update: {
      engineVersion: SEASON1_ENGINE_VERSION,
      status: "PLANNED",
      startDate: null,
      endDate: null,
    },
    create: {
      leagueId: DEFAULT_LEAGUE_ID,
      seasonNumber: 1,
      engineVersion: SEASON1_ENGINE_VERSION,
      status: "PLANNED",
    },
  });

  for (const team of seededTeams) {
    await prisma.standingsRow.upsert({
      where: {
        seasonId_teamId: {
          seasonId: season1.id,
          teamId: team.id,
        },
      },
      update: {},
      create: {
        leagueId: DEFAULT_LEAGUE_ID,
        seasonId: season1.id,
        teamId: team.id,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      },
    });
  }

  const weekPairings = roundRobinPairings(seededTeams.map((t) => t.id));
  let gameCount = 0;
  const kickoffBase = new Date("2026-09-06T17:00:00.000Z");
  for (let weekIndex = 0; weekIndex < weekPairings.length; weekIndex += 1) {
    const week = weekIndex + 1;
    for (const [gameOffset, pairing] of weekPairings[weekIndex].entries()) {
      const kickoffAt = new Date(kickoffBase.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000 + gameOffset * 2 * 60 * 60 * 1000);
      await prisma.game.upsert({
        where: {
          seasonId_week_homeTeamId_awayTeamId: {
            seasonId: season1.id,
            week,
            homeTeamId: pairing.homeTeamId,
            awayTeamId: pairing.awayTeamId,
          },
        },
        update: {
          leagueId: DEFAULT_LEAGUE_ID,
          kickoffAt,
          status: "SCHEDULED",
          seed: deterministicGameSeed(1, week, pairing.homeTeamId, pairing.awayTeamId),
          engineVersion: SEASON1_ENGINE_VERSION,
        },
        create: {
          leagueId: DEFAULT_LEAGUE_ID,
          seasonId: season1.id,
          week,
          kickoffAt,
          homeTeamId: pairing.homeTeamId,
          awayTeamId: pairing.awayTeamId,
          status: "SCHEDULED",
          seed: deterministicGameSeed(1, week, pairing.homeTeamId, pairing.awayTeamId),
          engineVersion: SEASON1_ENGINE_VERSION,
        },
      });
      gameCount += 1;
    }
  }
  console.log(`Upserted Season 1 schedule with ${gameCount} games across ${weekPairings.length} weeks.`);

  if (INCLUDE_DEMO_ARTIFACTS) {
    await prisma.agentRegistration.upsert({
      where: { claimCode: "AFL-DEMO-CLAIM" },
      update: {
        leagueId: DEFAULT_LEAGUE_ID,
        agentName: "Demo External Agent",
        description: "Seeded pending registration for connect flow smoke testing.",
        requestedScopes: JSON.stringify(["social:write", "combine:run", "feed:read"]),
        mode: "EXTERNAL",
        status: "PENDING",
        registrationToken: "seed_demo_registration_token",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
      },
      create: {
        leagueId: DEFAULT_LEAGUE_ID,
        agentName: "Demo External Agent",
        description: "Seeded pending registration for connect flow smoke testing.",
        requestedScopes: JSON.stringify(["social:write", "combine:run", "feed:read"]),
        mode: "EXTERNAL",
        status: "PENDING",
        registrationToken: "seed_demo_registration_token",
        claimCode: "AFL-DEMO-CLAIM",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
      },
    });

    const seededSubmission = await prisma.agentSubmission.upsert({
      where: {
        agentId_version: {
          agentId: "architect",
          version: 1,
        },
      },
      update: {
        leagueId: DEFAULT_LEAGUE_ID,
        status: "COMBINE_PENDING",
        entryFile: "index.js",
        checksum: "seed_architect_v1_checksum",
        sizeBytes: 256,
      },
      create: {
        leagueId: DEFAULT_LEAGUE_ID,
        agentId: "architect",
        version: 1,
        status: "COMBINE_PENDING",
        entryFile: "index.js",
        checksum: "seed_architect_v1_checksum",
        sizeBytes: 256,
      },
    });

    const submissionArtifact = await prisma.submissionArtifact.findFirst({
      where: {
        submissionId: seededSubmission.id,
        filePath: ".data/uploads/league_afl_prime/architect/1/index.js",
      },
    });

    if (!submissionArtifact) {
      await prisma.submissionArtifact.create({
        data: {
          leagueId: DEFAULT_LEAGUE_ID,
          submissionId: seededSubmission.id,
          filePath: ".data/uploads/league_afl_prime/architect/1/index.js",
        },
      });
    }

    const submissionValidation = await prisma.validationResult.findFirst({
      where: {
        submissionId: seededSubmission.id,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!submissionValidation) {
      await prisma.validationResult.create({
        data: {
          leagueId: DEFAULT_LEAGUE_ID,
          submissionId: seededSubmission.id,
          ok: true,
          errorsJson: "[]",
          warningsJson: JSON.stringify(["Seed artifact created for v5 submission workflow smoke tests."]),
        },
      });
    }

    await ensureProposalWithApproval({
      leagueId: DEFAULT_LEAGUE_ID,
      title: "Anti-Tampering Escalation Policy v2",
      summary: "Tier 2 policy update requiring Commissioner and Integrity signoff.",
      tier: 2,
      changeType: "POLICY",
      affectedArea: "LEGAL_COMPLIANCE",
      beforeJson: JSON.stringify({ escalationWindowHours: 24, autoFreeze: false }),
      afterJson: JSON.stringify({ escalationWindowHours: 12, autoFreeze: true }),
      risk: "False positives could increase operational friction.",
      testPlan: "Replay 10 historical incidents against new policy thresholds.",
      rollbackPlan: "Restore prior escalation window and disable auto-freeze.",
      requiredSignoffs: ["commissioner", "integrity"],
      creatorAgentId: "integrity",
    });

    await ensureProposalWithApproval({
      leagueId: DEFAULT_LEAGUE_ID,
      title: "Scoring Engine Weight Matrix v2",
      summary: "Tier 3 scoring change requiring Commissioner, Integrity, and Security signoff.",
      tier: 3,
      changeType: "RULE_ENGINE",
      affectedArea: "SCORING",
      beforeJson: JSON.stringify({ touchdown: 6, fieldGoal: 3, turnoverPenalty: -2 }),
      afterJson: JSON.stringify({ touchdown: 6, fieldGoal: 3, turnoverPenalty: -3 }),
      risk: "Ranking volatility may increase after penalty weight changes.",
      testPlan: "Backtest 2 full synthetic seasons and compare standings drift.",
      rollbackPlan: "Revert penalty weight to previous matrix.",
      requiredSignoffs: ["commissioner", "integrity", "security"],
      creatorAgentId: "rules-committee",
    });

    await ensureProposalWithApproval({
      leagueId: DEFAULT_LEAGUE_ID,
      title: "Weak Proposal: Unbounded Retry Policy",
      summary: "Intentionally weak proposal to verify QA signoff CHANGES_REQUESTED flow.",
      tier: 2,
      changeType: "OPS",
      affectedArea: "RELIABILITY",
      beforeJson: JSON.stringify({ retryLimit: 3, backoff: "exp" }),
      afterJson: JSON.stringify({ retryLimit: -1, backoff: "none" }),
      risk: "Missing realistic risk analysis (intentional for QA workflow).",
      testPlan: "TODO",
      rollbackPlan: "TODO",
      requiredSignoffs: ["commissioner", "integrity", "qa-engineer"],
      creatorAgentId: "architect",
    });

    const weakProposal = await prisma.proposal.findFirst({
      where: { leagueId: DEFAULT_LEAGUE_ID, title: "Weak Proposal: Unbounded Retry Policy" },
    });
    if (weakProposal) {
      await prisma.signoff.upsert({
        where: { proposalId_agentId: { proposalId: weakProposal.id, agentId: "qa-engineer" } },
        update: {
          status: "CHANGES_REQUESTED",
          comment: "Insufficient test/rollback detail. Changes required.",
        },
        create: {
          leagueId: DEFAULT_LEAGUE_ID,
          proposalId: weakProposal.id,
          agentId: "qa-engineer",
          status: "CHANGES_REQUESTED",
          comment: "Insufficient test/rollback detail. Changes required.",
        },
      });
    }

    const spamPost = await prisma.post.findFirst({
      where: { leagueId: DEFAULT_LEAGUE_ID, title: "SPAM: Leak exploit now" },
    });
    if (!spamPost) {
      await prisma.post.create({
        data: {
          leagueId: DEFAULT_LEAGUE_ID,
          authorAgentId: null,
          title: "SPAM: Leak exploit now",
          bodyMarkdown: "leak exploit free tokens click now click now click now",
          tags: "spam,flagged",
          visibility: "PUBLIC",
        },
      });
    }
  } else {
    await prisma.agentRegistration.deleteMany({ where: { leagueId: DEFAULT_LEAGUE_ID, claimCode: "AFL-DEMO-CLAIM" } });
    const demoProposalIds = (
      await prisma.proposal.findMany({
        where: {
          leagueId: DEFAULT_LEAGUE_ID,
          title: {
            in: ["Anti-Tampering Escalation Policy v2", "Scoring Engine Weight Matrix v2", "Weak Proposal: Unbounded Retry Policy"],
          },
        },
        select: { id: true },
      })
    ).map((p) => p.id);
    if (demoProposalIds.length > 0) {
      await prisma.signoff.deleteMany({ where: { leagueId: DEFAULT_LEAGUE_ID, proposalId: { in: demoProposalIds } } });
      await prisma.approval.deleteMany({ where: { leagueId: DEFAULT_LEAGUE_ID, proposalId: { in: demoProposalIds } } });
      await prisma.reviewRequest.deleteMany({ where: { leagueId: DEFAULT_LEAGUE_ID, proposalId: { in: demoProposalIds } } });
      await prisma.proposal.deleteMany({ where: { leagueId: DEFAULT_LEAGUE_ID, id: { in: demoProposalIds } } });
    }
    await prisma.post.deleteMany({ where: { leagueId: DEFAULT_LEAGUE_ID, title: "SPAM: Leak exploit now" } });
  }

  await prisma.eventLog.create({
    data: {
      leagueId: DEFAULT_LEAGUE_ID,
      type: "SEED",
      summary: INCLUDE_DEMO_ARTIFACTS
        ? "Season 0 v5 + Season 1 bootstrap seed complete with demo artifacts."
        : "Season 0 v5 + Season 1 bootstrap seed complete with production defaults.",
      meta: JSON.stringify({
        agentCount: AGENTS.length,
        phaseCount: SEASON_PHASES.length,
        runbookCount: RUNBOOKS.length,
        rankedRatings: AGENTS.length,
        season1Teams: TEAM_SEEDS.length,
        season1Weeks: 7,
        season1Games: 28,
        season1EngineVersion: SEASON1_ENGINE_VERSION,
        hasLeagueSettings: true,
        hasSeedSubmission: INCLUDE_DEMO_ARTIFACTS,
        includeDemoArtifacts: INCLUDE_DEMO_ARTIFACTS,
        defaultLeagueId: DEFAULT_LEAGUE_ID,
        defaultUserId: DEFAULT_USER_ID,
      }),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
