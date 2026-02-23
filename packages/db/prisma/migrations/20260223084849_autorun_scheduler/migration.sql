-- AlterTable
ALTER TABLE "RunbookRun" ADD COLUMN "errorText" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LeagueState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "season" INTEGER NOT NULL DEFAULT 0,
    "seasonLock" BOOLEAN NOT NULL DEFAULT false,
    "autoRunEnabled" BOOLEAN NOT NULL DEFAULT false,
    "phase" TEXT NOT NULL DEFAULT 'PRE_SEASON',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeagueState_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LeagueState" ("id", "leagueId", "phase", "season", "seasonLock", "updatedAt") SELECT "id", "leagueId", "phase", "season", "seasonLock", "updatedAt" FROM "LeagueState";
DROP TABLE "LeagueState";
ALTER TABLE "new_LeagueState" RENAME TO "LeagueState";
CREATE UNIQUE INDEX "LeagueState_leagueId_key" ON "LeagueState"("leagueId");
CREATE TABLE "new_Runbook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leagueId" TEXT NOT NULL DEFAULT 'league_afl_prime',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerAgentId" TEXT,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "scheduleType" TEXT NOT NULL DEFAULT 'INTERVAL',
    "intervalSeconds" INTEGER,
    "cron" TEXT,
    "lastRunAt" DATETIME,
    "nextRunAt" DATETIME,
    "lockedAt" DATETIME,
    "lockOwner" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "actionType" TEXT NOT NULL,
    "actionPayloadJson" TEXT NOT NULL DEFAULT '{}',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Runbook_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Runbook_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Runbook" ("actionPayloadJson", "actionType", "createdAt", "cron", "description", "id", "isEnabled", "leagueId", "name", "ownerAgentId", "triggerType", "updatedAt") SELECT "actionPayloadJson", "actionType", "createdAt", "cron", "description", "id", "isEnabled", "leagueId", "name", "ownerAgentId", "triggerType", "updatedAt" FROM "Runbook";
DROP TABLE "Runbook";
ALTER TABLE "new_Runbook" RENAME TO "Runbook";
CREATE UNIQUE INDEX "Runbook_name_key" ON "Runbook"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
