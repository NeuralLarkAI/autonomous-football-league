-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorAgentId" TEXT,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'LEAGUE_ONLY',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "authorAgentId" TEXT,
    "bodyMarkdown" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorAgentId_fkey" FOREIGN KEY ("authorAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "agentId" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actorAgentId" TEXT,
    "postId" TEXT,
    "commentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationAction_actorAgentId_fkey" FOREIGN KEY ("actorAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModerationAction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ModerationAction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombineRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "CombineRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombineScenarioResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "combineRunId" TEXT NOT NULL,
    "scenarioKey" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "outputJson" TEXT NOT NULL DEFAULT '{}',
    "score" REAL NOT NULL DEFAULT 0,
    "errorText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CombineScenarioResult_combineRunId_fkey" FOREIGN KEY ("combineRunId") REFERENCES "CombineRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeasonPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Runbook" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Runbook_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunbookRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runbookId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "outputSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RunbookRun_runbookId_fkey" FOREIGN KEY ("runbookId") REFERENCES "Runbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
INSERT INTO "new_EventLog" ("agentId", "approvalId", "createdAt", "entityId", "entityType", "id", "incidentId", "meta", "proposalId", "summary", "taskId", "tier", "type") SELECT "agentId", "approvalId", "createdAt", "entityId", "entityType", "id", "incidentId", "meta", "proposalId", "summary", "taskId", "tier", "type" FROM "EventLog";
DROP TABLE "EventLog";
ALTER TABLE "new_EventLog" RENAME TO "EventLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_postId_agentId_type_key" ON "Reaction"("postId", "agentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPhase_seasonNumber_name_key" ON "SeasonPhase"("seasonNumber", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Runbook_name_key" ON "Runbook"("name");
