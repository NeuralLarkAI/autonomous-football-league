// Shared enums and lightweight types for AFL

export type Tier = 0 | 1 | 2 | 3;

export type TaskStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AgentDepartment =
  | "COMMISSIONER"
  | "FOOTBALL_OPS"
  | "PLAYER_PERSONNEL"
  | "FINANCE"
  | "MARKETING"
  | "LEGAL_COMPLIANCE"
  | "TECHNOLOGY"
  | "SECURITY";

export interface AgentPermissions {
  canCreateTasks: boolean;
  canCreateProposals: boolean;
  maxProposalTier: Tier;
  canApprove: boolean;
  canViewFinancials: boolean;
  canModifyRules: boolean;
}
