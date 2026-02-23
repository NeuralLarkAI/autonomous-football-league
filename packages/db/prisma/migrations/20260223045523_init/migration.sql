-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "League_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "requestedScopes" TEXT NOT NULL DEFAULT '[]',
    "mode" TEXT NOT NULL DEFAULT 'SANDBOX',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "registrationToken" TEXT NOT NULL,
    "claimCode" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRegistration_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "claimCode" TEXT NOT NULL,
    "proofType" TEXT NOT NULL DEFAULT 'NONE',
    "proofValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" DATETIME,
    CONSTRAINT "AgentClaim_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentClaim_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgentClaim_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScopeGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apiKeyId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScopeGrant_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT NOT NULL,
    "roleCardMd" TEXT NOT NULL DEFAULT '',
    "permissionScopes" TEXT NOT NULL DEFAULT '[]',
    "kpis" TEXT NOT NULL DEFAULT '{}',
    "ownerUserId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'SANDBOX',
    "externalEndpointUrl" TEXT,
    "externalSharedSecretHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Agent_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Agent_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("createdAt", "department", "id", "kpis", "name", "permissionScopes", "permissions", "role", "roleCardMd", "status", "updatedAt") SELECT "createdAt", "department", "id", "kpis", "name", "permissionScopes", "permissions", "role", "roleCardMd", "status", "updatedAt" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
CREATE TABLE "new_AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "outputsCreated" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT NOT NULL DEFAULT '',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentRun_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AgentRun" ("agentId", "durationMs", "error", "finishedAt", "id", "outputsCreated", "startedAt", "status") SELECT "agentId", "durationMs", "error", "finishedAt", "id", "outputsCreated", "startedAt", "status" FROM "AgentRun";
DROP TABLE "AgentRun";
ALTER TABLE "new_AgentRun" RENAME TO "AgentRun";
CREATE TABLE "new_Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "taskId" TEXT,
    "proposalId" TEXT,
    "agentId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signoffs" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Approval_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Approval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Approval_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Approval_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Approval" ("agentId", "createdAt", "id", "proposalId", "signoffs", "status", "summary", "taskId", "tier", "updatedAt") SELECT "agentId", "createdAt", "id", "proposalId", "signoffs", "status", "summary", "taskId", "tier", "updatedAt" FROM "Approval";
DROP TABLE "Approval";
ALTER TABLE "new_Approval" RENAME TO "Approval";
CREATE TABLE "new_CombineRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "seed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "scoreOverall" REAL NOT NULL DEFAULT 0,
    "scoreLatency" REAL NOT NULL DEFAULT 0,
    "scoreReliability" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CombineRun_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CombineRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CombineRun" ("agentId", "createdAt", "durationMs", "finishedAt", "id", "notes", "runType", "scoreLatency", "scoreOverall", "scoreReliability", "seed", "startedAt", "status") SELECT "agentId", "createdAt", "durationMs", "finishedAt", "id", "notes", "runType", "scoreLatency", "scoreOverall", "scoreReliability", "seed", "startedAt", "status" FROM "CombineRun";
DROP TABLE "CombineRun";
ALTER TABLE "new_CombineRun" RENAME TO "CombineRun";
CREATE TABLE "new_CombineScenarioResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "combineRunId" TEXT NOT NULL,
    "scenarioKey" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "outputJson" TEXT NOT NULL DEFAULT '{}',
    "score" REAL NOT NULL DEFAULT 0,
    "errorText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CombineScenarioResult_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CombineScenarioResult_combineRunId_fkey" FOREIGN KEY ("combineRunId") REFERENCES "CombineRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CombineScenarioResult" ("combineRunId", "createdAt", "errorText", "id", "latencyMs", "outputJson", "passed", "scenarioKey", "score") SELECT "combineRunId", "createdAt", "errorText", "id", "latencyMs", "outputJson", "passed", "scenarioKey", "score" FROM "CombineScenarioResult";
DROP TABLE "CombineScenarioResult";
ALTER TABLE "new_CombineScenarioResult" RENAME TO "CombineScenarioResult";
CREATE TABLE "new_Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "postId" TEXT NOT NULL,
    "authorAgentId" TEXT,
    "bodyMarkdown" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Comment" ("authorAgentId", "bodyMarkdown", "createdAt", "id", "postId") SELECT "authorAgentId", "bodyMarkdown", "createdAt", "id", "postId" FROM "Comment";
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
CREATE TABLE "new_EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT,
    "type" TEXT NOT NULL,
    "tier" INTEGER,
    "summary" TEXT NOT NULL,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "entityType" TEXT,
    "entityId" TEXT,
    "taskId" TEXT,
    "approvalId" TEXT,
    "proposalId" TEXT,
    "incidentId" TEXT,
    "postId" TEXT,
    "combineRunId" TEXT,
    "runbookId" TEXT,
    "runbookRunId" TEXT,
    "seasonPhaseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_combineRunId_fkey" FOREIGN KEY ("combineRunId") REFERENCES "CombineRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_runbookId_fkey" FOREIGN KEY ("runbookId") REFERENCES "Runbook" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_runbookRunId_fkey" FOREIGN KEY ("runbookRunId") REFERENCES "RunbookRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_seasonPhaseId_fkey" FOREIGN KEY ("seasonPhaseId") REFERENCES "SeasonPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EventLog" ("agentId", "approvalId", "combineRunId", "createdAt", "entityId", "entityType", "id", "incidentId", "meta", "postId", "proposalId", "runbookId", "runbookRunId", "seasonPhaseId", "summary", "taskId", "tier", "type") SELECT "agentId", "approvalId", "combineRunId", "createdAt", "entityId", "entityType", "id", "incidentId", "meta", "postId", "proposalId", "runbookId", "runbookRunId", "seasonPhaseId", "summary", "taskId", "tier", "type" FROM "EventLog";
DROP TABLE "EventLog";
ALTER TABLE "new_EventLog" RENAME TO "EventLog";
CREATE TABLE "new_Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "severity" TEXT NOT NULL,
    "sourceAgentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Incident_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Incident_sourceAgentId_fkey" FOREIGN KEY ("sourceAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Incident" ("createdAt", "description", "id", "resolvedAt", "severity", "sourceAgentId", "status", "title") SELECT "createdAt", "description", "id", "resolvedAt", "severity", "sourceAgentId", "status", "title" FROM "Incident";
DROP TABLE "Incident";
ALTER TABLE "new_Incident" RENAME TO "Incident";
CREATE TABLE "new_LeagueState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "season" INTEGER NOT NULL DEFAULT 0,
    "seasonLock" BOOLEAN NOT NULL DEFAULT false,
    "phase" TEXT NOT NULL DEFAULT 'PRE_SEASON',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeagueState_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LeagueState" ("id", "phase", "season", "seasonLock", "updatedAt") SELECT "id", "phase", "season", "seasonLock", "updatedAt" FROM "LeagueState";
DROP TABLE "LeagueState";
ALTER TABLE "new_LeagueState" RENAME TO "LeagueState";
CREATE UNIQUE INDEX "LeagueState_leagueId_key" ON "LeagueState"("leagueId");
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REPORT',
    "meta" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("agentId", "body", "createdAt", "id", "meta", "title", "type") SELECT "agentId", "body", "createdAt", "id", "meta", "title", "type" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE TABLE "new_ModerationAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actorAgentId" TEXT,
    "postId" TEXT,
    "commentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationAction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ModerationAction_actorAgentId_fkey" FOREIGN KEY ("actorAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModerationAction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModerationAction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ModerationAction" ("action", "actorAgentId", "commentId", "createdAt", "id", "postId", "reason", "targetId", "targetType") SELECT "action", "actorAgentId", "commentId", "createdAt", "id", "postId", "reason", "targetId", "targetType" FROM "ModerationAction";
DROP TABLE "ModerationAction";
ALTER TABLE "new_ModerationAction" RENAME TO "ModerationAction";
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "authorAgentId" TEXT,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'LEAGUE_ONLY',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("authorAgentId", "bodyMarkdown", "createdAt", "id", "isHidden", "isLocked", "tags", "title", "updatedAt", "visibility") SELECT "authorAgentId", "bodyMarkdown", "createdAt", "id", "isHidden", "isLocked", "tags", "title", "updatedAt", "visibility" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE TABLE "new_Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "affectedArea" TEXT NOT NULL,
    "beforeJson" TEXT NOT NULL DEFAULT '{}',
    "afterJson" TEXT NOT NULL DEFAULT '{}',
    "risk" TEXT NOT NULL DEFAULT '',
    "testPlan" TEXT NOT NULL DEFAULT '',
    "rollbackPlan" TEXT NOT NULL DEFAULT '',
    "requiredSignoffs" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "taskId" TEXT,
    "creatorAgentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proposal_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Proposal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Proposal_creatorAgentId_fkey" FOREIGN KEY ("creatorAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Proposal" ("affectedArea", "afterJson", "beforeJson", "changeType", "createdAt", "creatorAgentId", "id", "requiredSignoffs", "risk", "rollbackPlan", "status", "summary", "taskId", "testPlan", "tier", "title", "updatedAt") SELECT "affectedArea", "afterJson", "beforeJson", "changeType", "createdAt", "creatorAgentId", "id", "requiredSignoffs", "risk", "rollbackPlan", "status", "summary", "taskId", "testPlan", "tier", "title", "updatedAt" FROM "Proposal";
DROP TABLE "Proposal";
ALTER TABLE "new_Proposal" RENAME TO "Proposal";
CREATE TABLE "new_Reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "postId" TEXT NOT NULL,
    "agentId" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Reaction" ("agentId", "createdAt", "id", "postId", "type") SELECT "agentId", "createdAt", "id", "postId", "type" FROM "Reaction";
DROP TABLE "Reaction";
ALTER TABLE "new_Reaction" RENAME TO "Reaction";
CREATE UNIQUE INDEX "Reaction_postId_agentId_type_key" ON "Reaction"("postId", "agentId", "type");
CREATE TABLE "new_ReviewRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "proposalId" TEXT NOT NULL,
    "requesterAgentId" TEXT,
    "targetAgentId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewRequest_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewRequest_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewRequest_requesterAgentId_fkey" FOREIGN KEY ("requesterAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewRequest_targetAgentId_fkey" FOREIGN KEY ("targetAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReviewRequest" ("createdAt", "id", "note", "proposalId", "requesterAgentId", "status", "targetAgentId", "updatedAt") SELECT "createdAt", "id", "note", "proposalId", "requesterAgentId", "status", "targetAgentId", "updatedAt" FROM "ReviewRequest";
DROP TABLE "ReviewRequest";
ALTER TABLE "new_ReviewRequest" RENAME TO "ReviewRequest";
CREATE TABLE "new_Runbook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerAgentId" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "cron" TEXT,
    "actionType" TEXT NOT NULL,
    "actionPayloadJson" TEXT NOT NULL DEFAULT '{}',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Runbook_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Runbook_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Runbook" ("actionPayloadJson", "actionType", "createdAt", "cron", "description", "id", "isEnabled", "name", "ownerAgentId", "triggerType", "updatedAt") SELECT "actionPayloadJson", "actionType", "createdAt", "cron", "description", "id", "isEnabled", "name", "ownerAgentId", "triggerType", "updatedAt" FROM "Runbook";
DROP TABLE "Runbook";
ALTER TABLE "new_Runbook" RENAME TO "Runbook";
CREATE UNIQUE INDEX "Runbook_name_key" ON "Runbook"("name");
CREATE TABLE "new_RunbookRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "runbookId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "outputSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunbookRun_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RunbookRun_runbookId_fkey" FOREIGN KEY ("runbookId") REFERENCES "Runbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RunbookRun" ("createdAt", "finishedAt", "id", "outputSummary", "runbookId", "startedAt", "status") SELECT "createdAt", "finishedAt", "id", "outputSummary", "runbookId", "startedAt", "status" FROM "RunbookRun";
DROP TABLE "RunbookRun";
ALTER TABLE "new_RunbookRun" RENAME TO "RunbookRun";
CREATE TABLE "new_SeasonPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonPhase_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SeasonPhase" ("createdAt", "description", "endDate", "id", "name", "seasonNumber", "startDate", "status") SELECT "createdAt", "description", "endDate", "id", "name", "seasonNumber", "startDate", "status" FROM "SeasonPhase";
DROP TABLE "SeasonPhase";
ALTER TABLE "new_SeasonPhase" RENAME TO "SeasonPhase";
CREATE UNIQUE INDEX "SeasonPhase_seasonNumber_name_key" ON "SeasonPhase"("seasonNumber", "name");
CREATE TABLE "new_Signoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "proposalId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Signoff_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signoff_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signoff_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Signoff" ("agentId", "comment", "createdAt", "id", "proposalId", "status", "updatedAt") SELECT "agentId", "comment", "createdAt", "id", "proposalId", "status", "updatedAt" FROM "Signoff";
DROP TABLE "Signoff";
ALTER TABLE "new_Signoff" RENAME TO "Signoff";
CREATE UNIQUE INDEX "Signoff_proposalId_agentId_key" ON "Signoff"("proposalId", "agentId");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "tier" INTEGER NOT NULL DEFAULT 1,
    "department" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL DEFAULT '',
    "riskNotes" TEXT NOT NULL DEFAULT '',
    "testPlan" TEXT NOT NULL DEFAULT '',
    "rollbackPlan" TEXT NOT NULL DEFAULT '',
    "signoffs" TEXT NOT NULL DEFAULT '[]',
    "assigneeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("acceptanceCriteria", "assigneeId", "createdAt", "department", "description", "id", "riskNotes", "rollbackPlan", "signoffs", "status", "testPlan", "tier", "title", "updatedAt") SELECT "acceptanceCriteria", "assigneeId", "createdAt", "department", "description", "id", "riskNotes", "rollbackPlan", "signoffs", "status", "testPlan", "tier", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE TABLE "new_TaskDependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,
    CONSTRAINT "TaskDependency_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaskDependency" ("dependsOnTaskId", "id", "taskId") SELECT "dependsOnTaskId", "id", "taskId" FROM "TaskDependency";
DROP TABLE "TaskDependency";
ALTER TABLE "new_TaskDependency" RENAME TO "TaskDependency";
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON "TaskDependency"("taskId", "dependsOnTaskId");

-- Bootstrap default user and league for legacy single-league data.
INSERT OR IGNORE INTO "User" ("id", "email", "passwordHash", "displayName", "createdAt")
VALUES ('user_commissioner_dev', 'commissioner@afl.local', 'dev-only-change-me', 'Commissioner Dev', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO "League" ("id", "name", "slug", "ownerUserId", "createdAt")
VALUES ('league_afl_prime', 'AFL Prime', 'afl-prime', 'user_commissioner_dev', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO "LeagueMember" ("id", "leagueId", "userId", "role", "createdAt")
VALUES ('member_commissioner_owner', 'league_afl_prime', 'user_commissioner_dev', 'OWNER', CURRENT_TIMESTAMP);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_leagueId_userId_key" ON "LeagueMember"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistration_registrationToken_key" ON "AgentRegistration"("registrationToken");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistration_claimCode_key" ON "AgentRegistration"("claimCode");

-- CreateIndex
CREATE INDEX "AgentClaim_claimCode_idx" ON "AgentClaim"("claimCode");

-- CreateIndex
CREATE UNIQUE INDEX "ScopeGrant_apiKeyId_scope_key" ON "ScopeGrant"("apiKeyId", "scope");
