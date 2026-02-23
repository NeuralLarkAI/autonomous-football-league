-- CreateTable
CREATE TABLE "AgentSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "entryFile" TEXT NOT NULL DEFAULT 'index.js',
    "checksum" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentSubmission_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentSubmission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubmissionArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "submissionId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "contentBlob" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubmissionArtifact_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubmissionArtifact_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AgentSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "submissionId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "errorsJson" TEXT NOT NULL DEFAULT '[]',
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationResult_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ValidationResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AgentSubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankedRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RankedRating_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RankedRating_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankedMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentAId" TEXT NOT NULL,
    "agentBId" TEXT NOT NULL,
    "submissionAId" TEXT,
    "submissionBId" TEXT,
    "matchType" TEXT NOT NULL DEFAULT 'COMBINE_DUEL',
    "seed" INTEGER NOT NULL DEFAULT 0,
    "scoreA" REAL NOT NULL DEFAULT 0,
    "scoreB" REAL NOT NULL DEFAULT 0,
    "winnerAgentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankedMatch_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RankedMatch_agentAId_fkey" FOREIGN KEY ("agentAId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RankedMatch_agentBId_fkey" FOREIGN KEY ("agentBId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RankedMatch_submissionAId_fkey" FOREIGN KEY ("submissionAId") REFERENCES "AgentSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RankedMatch_submissionBId_fkey" FOREIGN KEY ("submissionBId") REFERENCES "AgentSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RankedMatch_winnerAgentId_fkey" FOREIGN KEY ("winnerAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "apiKeyId" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RateLimitBucket_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RateLimitBucket_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbuseEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "apiKeyId" TEXT,
    "agentId" TEXT,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbuseEvent_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AbuseEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AbuseEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeagueSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicName" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeagueSettings_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "submissionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CombineRun_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CombineRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CombineRun_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AgentSubmission" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CombineRun" ("agentId", "createdAt", "durationMs", "finishedAt", "id", "leagueId", "notes", "runType", "scoreLatency", "scoreOverall", "scoreReliability", "seed", "startedAt", "status") SELECT "agentId", "createdAt", "durationMs", "finishedAt", "id", "leagueId", "notes", "runType", "scoreLatency", "scoreOverall", "scoreReliability", "seed", "startedAt", "status" FROM "CombineRun";
DROP TABLE "CombineRun";
ALTER TABLE "new_CombineRun" RENAME TO "CombineRun";
CREATE TABLE "new_EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "agentId" TEXT,
    "type" TEXT NOT NULL,
    "tier" INTEGER,
    "visibility" TEXT NOT NULL DEFAULT 'LEAGUE_ONLY',
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
INSERT INTO "new_EventLog" ("agentId", "approvalId", "combineRunId", "createdAt", "entityId", "entityType", "id", "incidentId", "leagueId", "meta", "postId", "proposalId", "runbookId", "runbookRunId", "seasonPhaseId", "summary", "taskId", "tier", "type") SELECT "agentId", "approvalId", "combineRunId", "createdAt", "entityId", "entityType", "id", "incidentId", "leagueId", "meta", "postId", "proposalId", "runbookId", "runbookRunId", "seasonPhaseId", "summary", "taskId", "tier", "type" FROM "EventLog";
DROP TABLE "EventLog";
ALTER TABLE "new_EventLog" RENAME TO "EventLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AgentSubmission_leagueId_status_idx" ON "AgentSubmission"("leagueId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSubmission_agentId_version_key" ON "AgentSubmission"("agentId", "version");

-- CreateIndex
CREATE INDEX "SubmissionArtifact_submissionId_idx" ON "SubmissionArtifact"("submissionId");

-- CreateIndex
CREATE INDEX "ValidationResult_submissionId_createdAt_idx" ON "ValidationResult"("submissionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RankedRating_leagueId_agentId_key" ON "RankedRating"("leagueId", "agentId");

-- CreateIndex
CREATE INDEX "RankedMatch_leagueId_createdAt_idx" ON "RankedMatch"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_leagueId_windowStart_idx" ON "RateLimitBucket"("leagueId", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_apiKeyId_windowStart_windowSeconds_key" ON "RateLimitBucket"("apiKeyId", "windowStart", "windowSeconds");

-- CreateIndex
CREATE INDEX "AbuseEvent_leagueId_createdAt_idx" ON "AbuseEvent"("leagueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSettings_leagueId_key" ON "LeagueSettings"("leagueId");
