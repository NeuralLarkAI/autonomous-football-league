import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AGENTS = [
  {
    name: "Commissioner",
    department: "COMMISSIONER",
    role: "League Commissioner",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 3,
      canApprove: true, canViewFinancials: true, canModifyRules: true,
    },
  },
  {
    name: "Architect",
    department: "TECHNOLOGY",
    role: "Systems Architect",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 3,
      canApprove: false, canViewFinancials: false, canModifyRules: false,
    },
  },
  {
    name: "Security",
    department: "SECURITY",
    role: "Security Officer",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 2,
      canApprove: false, canViewFinancials: false, canModifyRules: false,
    },
  },
  {
    name: "Integrity",
    department: "LEGAL_COMPLIANCE",
    role: "Integrity & Compliance Officer",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 2,
      canApprove: false, canViewFinancials: false, canModifyRules: true,
    },
  },
  {
    name: "Program Manager",
    department: "FOOTBALL_OPS",
    role: "Program / Project Manager",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 1,
      canApprove: false, canViewFinancials: false, canModifyRules: false,
    },
  },
  {
    name: "Backend Engineer",
    department: "TECHNOLOGY",
    role: "Backend Engineer",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 1,
      canApprove: false, canViewFinancials: false, canModifyRules: false,
    },
  },
  {
    name: "QA Engineer",
    department: "TECHNOLOGY",
    role: "QA Engineer",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 1,
      canApprove: false, canViewFinancials: false, canModifyRules: false,
    },
  },
  {
    name: "SRE",
    department: "TECHNOLOGY",
    role: "Site Reliability Engineer",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 2,
      canApprove: false, canViewFinancials: false, canModifyRules: false,
    },
  },
  {
    name: "Rules Committee",
    department: "LEGAL_COMPLIANCE",
    role: "Rules Committee Chair",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 3,
      canApprove: false, canViewFinancials: false, canModifyRules: true,
    },
  },
  {
    name: "Scheduler",
    department: "FOOTBALL_OPS",
    role: "Schedule & Logistics Manager",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 1,
      canApprove: false, canViewFinancials: false, canModifyRules: false,
    },
  },
  {
    name: "Rankings",
    department: "FOOTBALL_OPS",
    role: "Rankings & Analytics Officer",
    permissions: {
      canCreateTasks: true, canCreateProposals: true, maxProposalTier: 2,
      canApprove: false, canViewFinancials: false, canModifyRules: false,
    },
  },
];

async function main() {
  console.log("Seeding AFL Season 0...");

  // Upsert agents
  const created: { id: string }[] = [];
  for (const a of AGENTS) {
    const agent = await prisma.agent.upsert({
      where: { id: a.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: a.name.toLowerCase().replace(/\s+/g, "-"),
        name: a.name,
        department: a.department,
        role: a.role,
        status: "ACTIVE",
        permissions: JSON.stringify(a.permissions),
      },
    });
    created.push(agent);
  }
  console.log(`Upserted ${created.length} agents.`);

  // Upsert LeagueState singleton
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

  // Initial EventLog entry
  await prisma.eventLog.create({
    data: {
      type: "SEED",
      summary: "Season 0 seed complete. League ready for kickoff.",
      meta: JSON.stringify({ agentCount: created.length }),
    },
  });
  console.log("EventLog seeded.");
  console.log("Done! Run pnpm dev to start the control room.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
