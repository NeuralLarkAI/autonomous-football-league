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
