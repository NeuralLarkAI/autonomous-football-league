-- CreateIndex
CREATE INDEX "Runbook_leagueId_isEnabled_triggerType_nextRunAt_idx" ON "Runbook"("leagueId", "isEnabled", "triggerType", "nextRunAt");

-- CreateIndex
CREATE INDEX "Runbook_lockedAt_idx" ON "Runbook"("lockedAt");
