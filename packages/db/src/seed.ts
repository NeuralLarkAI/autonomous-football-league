import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_LEAGUE_ID = "league_afl_prime";
const DEFAULT_USER_ID = "user_commissioner_dev";

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
    name: "Run Weekly Commissioner Report",
    description: "Generates the commissioner weekly report and posts a feed entry.",
    ownerAgentId: "chief-of-staff",
    triggerType: "SCHEDULED",
    cron: "0 14 * * 1",
    actionType: "GENERATE_REPORT",
    actionPayloadJson: JSON.stringify({ targetAgentId: "commissioner", reportType: "WEEKLY" }),
    isEnabled: true,
  },
  {
    name: "Integrity Audit Sweep",
    description: "Runs integrity agent to evaluate active incidents and compliance drift.",
    ownerAgentId: "integrity",
    triggerType: "MANUAL",
    cron: null,
    actionType: "RUN_AGENT",
    actionPayloadJson: JSON.stringify({ agentId: "integrity" }),
    isEnabled: true,
  },
  {
    name: "Season 0 Kickoff Runbook",
    description: "Executes deterministic kickoff orchestration to populate baseline backlog.",
    ownerAgentId: "commissioner",
    triggerType: "MANUAL",
    cron: null,
    actionType: "RUN_KICKOFF",
    actionPayloadJson: JSON.stringify({ season: 0 }),
    isEnabled: true,
  },
] as const;

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
  console.log("Seeding AFL Season 0 v4...");

  await prisma.user.upsert({
    where: { email: "commissioner@afl.local" },
    update: { displayName: "Commissioner Dev", passwordHash: "dev-only-change-me" },
    create: {
      id: DEFAULT_USER_ID,
      email: "commissioner@afl.local",
      displayName: "Commissioner Dev",
      passwordHash: "dev-only-change-me",
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

  await prisma.leagueState.upsert({
    where: { id: "singleton" },
    update: { leagueId: DEFAULT_LEAGUE_ID },
    create: {
      id: "singleton",
      leagueId: DEFAULT_LEAGUE_ID,
      season: 0,
      seasonLock: false,
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
    await prisma.runbook.upsert({
      where: { name: runbook.name },
      update: {
        leagueId: DEFAULT_LEAGUE_ID,
        description: runbook.description,
        ownerAgentId: runbook.ownerAgentId,
        triggerType: runbook.triggerType,
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
        cron: runbook.cron,
        actionType: runbook.actionType,
        actionPayloadJson: runbook.actionPayloadJson,
        isEnabled: runbook.isEnabled,
      },
    });
  }
  console.log(`Upserted ${RUNBOOKS.length} runbooks.`);

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

  await prisma.eventLog.create({
    data: {
      leagueId: DEFAULT_LEAGUE_ID,
      type: "SEED",
      summary: "Season 0 v4 seed complete. League, users, agents, governance records, phases, and runbooks ready.",
      meta: JSON.stringify({
        agentCount: AGENTS.length,
        phaseCount: SEASON_PHASES.length,
        runbookCount: RUNBOOKS.length,
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
