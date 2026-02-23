-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "logoUrl" TEXT,
    "coachAgentId" TEXT,
    "schemeOffense" TEXT NOT NULL,
    "schemeDefense" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_coachAgentId_fkey" FOREIGN KEY ("coachAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "seasonNumber" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "seasonId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "kickoffAt" DATETIME,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "seed" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "scoreHome" INTEGER NOT NULL DEFAULT 0,
    "scoreAway" INTEGER NOT NULL DEFAULT 0,
    "winnerTeamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Game_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Drive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "gameId" TEXT NOT NULL,
    "driveNumber" INTEGER NOT NULL,
    "offenseTeamId" TEXT NOT NULL,
    "defenseTeamId" TEXT NOT NULL,
    "startQtr" INTEGER NOT NULL,
    "startTimeSeconds" INTEGER NOT NULL,
    "startYardLine" INTEGER NOT NULL,
    "endReason" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Drive_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Drive_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Drive_offenseTeamId_fkey" FOREIGN KEY ("offenseTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Drive_defenseTeamId_fkey" FOREIGN KEY ("defenseTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Play" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "gameId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "playNumber" INTEGER NOT NULL,
    "qtr" INTEGER NOT NULL,
    "timeSeconds" INTEGER NOT NULL,
    "down" INTEGER NOT NULL,
    "distance" INTEGER NOT NULL,
    "yardLine" INTEGER NOT NULL,
    "offenseTeamId" TEXT NOT NULL,
    "defenseTeamId" TEXT NOT NULL,
    "offenseCallJson" TEXT NOT NULL,
    "defenseCallJson" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Play_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Play_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Play_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Play_offenseTeamId_fkey" FOREIGN KEY ("offenseTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Play_defenseTeamId_fkey" FOREIGN KEY ("defenseTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoxScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "gameId" TEXT NOT NULL,
    "statsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BoxScore_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoxScore_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StandingsRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "pointsFor" INTEGER NOT NULL DEFAULT 0,
    "pointsAgainst" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StandingsRow_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandingsRow_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandingsRow_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "gameId" TEXT,
    "driveId" TEXT,
    "playId" TEXT,
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
    CONSTRAINT "EventLog_seasonPhaseId_fkey" FOREIGN KEY ("seasonPhaseId") REFERENCES "SeasonPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_playId_fkey" FOREIGN KEY ("playId") REFERENCES "Play" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EventLog" ("agentId", "approvalId", "combineRunId", "createdAt", "entityId", "entityType", "id", "incidentId", "leagueId", "meta", "postId", "proposalId", "runbookId", "runbookRunId", "seasonPhaseId", "summary", "taskId", "tier", "type", "visibility") SELECT "agentId", "approvalId", "combineRunId", "createdAt", "entityId", "entityType", "id", "incidentId", "leagueId", "meta", "postId", "proposalId", "runbookId", "runbookRunId", "seasonPhaseId", "summary", "taskId", "tier", "type", "visibility" FROM "EventLog";
DROP TABLE "EventLog";
ALTER TABLE "new_EventLog" RENAME TO "EventLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Team_leagueId_name_idx" ON "Team"("leagueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_leagueId_shortName_key" ON "Team"("leagueId", "shortName");

-- CreateIndex
CREATE INDEX "Season_leagueId_status_idx" ON "Season"("leagueId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Season_leagueId_seasonNumber_key" ON "Season"("leagueId", "seasonNumber");

-- CreateIndex
CREATE INDEX "Game_leagueId_week_status_idx" ON "Game"("leagueId", "week", "status");

-- CreateIndex
CREATE INDEX "Game_seasonId_status_idx" ON "Game"("seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Game_seasonId_week_homeTeamId_awayTeamId_key" ON "Game"("seasonId", "week", "homeTeamId", "awayTeamId");

-- CreateIndex
CREATE INDEX "Drive_gameId_createdAt_idx" ON "Drive"("gameId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Drive_gameId_driveNumber_key" ON "Drive"("gameId", "driveNumber");

-- CreateIndex
CREATE INDEX "Play_gameId_driveId_playNumber_idx" ON "Play"("gameId", "driveId", "playNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Play_gameId_playNumber_key" ON "Play"("gameId", "playNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BoxScore_gameId_key" ON "BoxScore"("gameId");

-- CreateIndex
CREATE INDEX "BoxScore_leagueId_createdAt_idx" ON "BoxScore"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "StandingsRow_leagueId_seasonId_idx" ON "StandingsRow"("leagueId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "StandingsRow_seasonId_teamId_key" ON "StandingsRow"("seasonId", "teamId");
