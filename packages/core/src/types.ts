import { z } from "zod";

export type Tier = 0 | 1 | 2 | 3;
export type TaskStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "DEFERRED";
export type AgentDepartment =
  | "COMMISSIONER" | "FOOTBALL_OPS" | "PLAYER_PERSONNEL"
  | "FINANCE" | "MARKETING" | "LEGAL_COMPLIANCE" | "TECHNOLOGY" | "SECURITY";

export interface AgentPermissions {
  canCreateTasks: boolean;
  canCreateProposals: boolean;
  maxProposalTier: Tier;
  canApprove: boolean;
  canViewFinancials: boolean;
  canModifyRules: boolean;
}

// ---- Zod schemas for API validation ----

export const RunAgentSchema = z.object({
  agentId: z.string().min(1),
});

export const PatchTaskSchema = z.object({
  status: z.enum(["BACKLOG", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"]).optional(),
  assigneeId: z.string().optional(),
  tier: z.number().int().min(0).max(3).optional(),
});

export const SeasonLockSchema = z.object({
  locked: z.boolean(),
});

export const RejectSchema = z.object({
  reason: z.string().optional(),
});

export const AddTaskDependencySchema = z.object({
  dependsOnTaskId: z.string().min(1),
});

export const RemoveTaskDependencySchema = z.object({
  dependsOnTaskId: z.string().min(1),
});

export const CreateProposalSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  tier: z.number().int().min(0).max(3),
  changeType: z.string().min(1),
  affectedArea: z.string().min(1),
  beforeJson: z.string().optional(),
  afterJson: z.string().optional(),
  risk: z.string().optional(),
  testPlan: z.string().optional(),
  rollbackPlan: z.string().optional(),
  requiredSignoffs: z.array(z.string().min(1)).default([]),
  taskId: z.string().optional(),
  creatorAgentId: z.string().optional(),
});

export const PatchProposalSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  tier: z.number().int().min(0).max(3).optional(),
  changeType: z.string().min(1).optional(),
  affectedArea: z.string().min(1).optional(),
  beforeJson: z.string().optional(),
  afterJson: z.string().optional(),
  risk: z.string().optional(),
  testPlan: z.string().optional(),
  rollbackPlan: z.string().optional(),
  requiredSignoffs: z.array(z.string().min(1)).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "DEFERRED"]).optional(),
});

export const RequestReviewSchema = z.object({
  requesterAgentId: z.string().optional(),
  targetAgentId: z.string().optional(),
  note: z.string().optional(),
});

export const SetSignoffSchema = z.object({
  agentId: z.string().min(1),
  status: z.enum(["REQUESTED", "APPROVED", "CHANGES_REQUESTED"]),
  comment: z.string().optional(),
});

export const CreateIncidentSchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  sourceAgentId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const ResolveIncidentSchema = z.object({
  resolutionNote: z.string().optional(),
});

export const CreateSocialPostSchema = z.object({
  authorAgentId: z.string().optional(),
  title: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
  visibility: z.enum(["PUBLIC", "LEAGUE_ONLY"]).default("LEAGUE_ONLY"),
});

export const CreateSocialCommentSchema = z.object({
  authorAgentId: z.string().optional(),
  bodyMarkdown: z.string().min(1),
});

export const CreateSocialReactionSchema = z.object({
  agentId: z.string().optional(),
  type: z.enum(["UPVOTE", "DOWNVOTE", "STAR"]),
});

export const ModerateSocialSchema = z.object({
  targetType: z.enum(["POST", "COMMENT"]),
  targetId: z.string().min(1),
  action: z.enum(["HIDE", "UNHIDE", "LOCK", "UNLOCK", "TAG"]),
  reason: z.string().optional(),
  actorAgentId: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const RunCombineSchema = z.object({
  agentId: z.string().min(1),
  runType: z.enum(["COMBINE", "SCRIMMAGE"]).default("COMBINE"),
});

export const ScrimmageRequestSchema = z.object({
  agentAId: z.string().min(1),
  agentBId: z.string().min(1),
  seed: z.number().int().optional(),
});

export const CreateSeasonPhaseSchema = z.object({
  seasonNumber: z.number().int().min(0),
  name: z.string().min(1),
  description: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["PLANNED", "ACTIVE", "DONE"]).default("PLANNED"),
});

export const CreateRunbookSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  ownerAgentId: z.string().optional(),
  triggerType: z.enum(["MANUAL", "SCHEDULED"]).default("MANUAL"),
  cron: z.string().optional(),
  actionType: z.enum([
    "RUN_AGENT",
    "RUN_KICKOFF",
    "RUN_COMBINE",
    "GENERATE_REPORT",
    "SEASON0_KICKOFF_AGENTS",
    "SEASON1_SETUP",
    "WEEK_SIMULATE",
    "POST_WEEKLY_SLATE",
    "POST_WEEKLY_RECAP",
  ]),
  actionPayloadJson: z.string().optional(),
  isEnabled: z.boolean().default(true),
});

export const PatchRunbookSchema = z.object({
  isEnabled: z.boolean().optional(),
  cron: z.string().nullable().optional(),
  description: z.string().optional(),
  actionPayloadJson: z.string().optional(),
});

export const UpdateSubmissionStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "UPLOADED",
    "VALIDATING",
    "VALID",
    "INVALID",
    "COMBINE_PENDING",
    "COMBINE_PASSED",
    "COMBINE_FAILED",
    "RANKED_APPROVED",
    "RETIRED",
  ]),
});

export const RunSubmissionCombineSchema = z.object({
  seed: z.number().int().optional(),
});

export const RequestRankedSubmissionSchema = z.object({
  note: z.string().optional(),
});

export const ApproveRankedSubmissionSchema = z.object({
  approved: z.boolean().default(true),
  signoffAgentIds: z.array(z.string().min(1)).default([]),
  note: z.string().optional(),
});

export const RunRankedDuelSchema = z.object({
  agentAId: z.string().min(1),
  agentBId: z.string().min(1),
  seed: z.number().int().optional(),
});

export const CreateLeagueSettingsSchema = z.object({
  isPublic: z.boolean().optional(),
  publicName: z.string().optional(),
  description: z.string().optional(),
});

export const OffenseCallSchema = z.object({
  personnel: z.enum(["11", "12", "21"]),
  concept: z.enum([
    "INSIDE_ZONE",
    "OUTSIDE_ZONE",
    "POWER",
    "COUNTER",
    "SLANTS",
    "MESH",
    "STICK",
    "FLOOD",
    "PA_SHOT",
    "FOUR_VERTS",
    "POST_DIG",
    "RB_SCREEN",
    "BUBBLE",
  ]),
  aggression: z.number().min(0).max(1),
  tempo: z.enum(["NORMAL", "HURRY"]),
});

export const DefenseCallSchema = z.object({
  front: z.enum(["BASE", "NICKEL", "DIME"]),
  coverage: z.enum(["C1", "C2", "C3", "C4", "MATCH"]),
  pressure: z.enum(["NONE", "SIM", "BLITZ"]),
  contain: z.number().min(0).max(1),
});

export const CreateSeasonOneSchema = z.object({
  seasonNumber: z.number().int().min(1).default(1),
  teamCount: z.number().int().min(2).max(32).default(8),
});

export const StartGameSchema = z.object({
  forceRestart: z.boolean().optional(),
});

export const StepGameSchema = z.object({
  plays: z.number().int().min(1).max(200).default(5),
});

export const ListGamesSchema = z.object({
  week: z.coerce.number().int().min(1).optional(),
  status: z.enum(["SCHEDULED", "LIVE", "FINAL"]).optional(),
});
