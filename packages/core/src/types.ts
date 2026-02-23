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
