-- CreateIndex
CREATE INDEX "Agent_leagueId_status_idx" ON "Agent"("leagueId", "status");

-- CreateIndex
CREATE INDEX "Agent_leagueId_department_idx" ON "Agent"("leagueId", "department");

-- CreateIndex
CREATE INDEX "Approval_leagueId_status_tier_idx" ON "Approval"("leagueId", "status", "tier");

-- CreateIndex
CREATE INDEX "EventLog_leagueId_createdAt_idx" ON "EventLog"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_leagueId_agentId_createdAt_idx" ON "EventLog"("leagueId", "agentId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_leagueId_type_createdAt_idx" ON "EventLog"("leagueId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Post_leagueId_createdAt_idx" ON "Post"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_leagueId_isHidden_createdAt_idx" ON "Post"("leagueId", "isHidden", "createdAt");

-- CreateIndex
CREATE INDEX "Proposal_leagueId_status_createdAt_idx" ON "Proposal"("leagueId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Task_leagueId_status_idx" ON "Task"("leagueId", "status");
