import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
];

async function ensureProposalWithApproval(input: {
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
  console.log("Seeding AFL Season 0 v2...");

  for (const a of AGENTS) {
    await prisma.agent.upsert({
      where: { id: a.id },
      update: {
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
    update: {},
    create: {
      id: "singleton",
      season: 0,
      seasonLock: false,
      phase: "PRE_SEASON",
    },
  });
  console.log("LeagueState ready.");

  await ensureProposalWithApproval({
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
      type: "SEED",
      summary: "Season 0 v2 seed complete. Agents, proposals, and signoff requests ready.",
      meta: JSON.stringify({ agentCount: AGENTS.length }),
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
