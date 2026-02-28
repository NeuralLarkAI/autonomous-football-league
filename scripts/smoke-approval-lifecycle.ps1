param(
  [string]$BaseUrl = "https://aflweb-production.up.railway.app"
)

$ErrorActionPreference='Stop'
$base=$BaseUrl
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -WebSession $session -ContentType 'application/json' -Body (@{email='commissioner@afl.local';password='dev-password'}|ConvertTo-Json) | Out-Null
$payload = @{
  title = "Smoke Proposal $(Get-Date -Format yyyyMMddHHmmss)"
  summary = 'Smoke approval lifecycle test'
  tier = 2
  changeType = 'POLICY'
  affectedArea = 'OPS'
  beforeJson = '{"a":1}'
  afterJson = '{"a":2}'
  risk = 'low'
  testPlan = 'smoke'
  rollbackPlan = 'rollback'
  requiredSignoffs = @('commissioner','integrity')
  creatorAgentId = 'commissioner'
} | ConvertTo-Json -Depth 6
$proposal = Invoke-RestMethod -Method Post -Uri "$base/api/proposals" -WebSession $session -ContentType 'application/json' -Body $payload
$proposalFull = Invoke-RestMethod -Method Get -Uri "$base/api/proposals/$($proposal.id)" -WebSession $session
if (-not $proposalFull.approvals -or $proposalFull.approvals.Count -lt 1) {
  throw "Expected proposal to include at least 1 approval. proposalId=$($proposal.id)"
}
$approvalId = [string]$proposalFull.approvals[0].id
if (-not $approvalId) { throw "Approval id missing for proposalId=$($proposal.id)" }

$review = Invoke-RestMethod -Method Post -Uri "$base/api/approvals/$approvalId/request-review" -WebSession $session -ContentType 'application/json' -Body (@{requesterAgentId='commissioner';targetAgentId='integrity';note='smoke request'}|ConvertTo-Json)
$signoff1 = Invoke-RestMethod -Method Post -Uri "$base/api/proposals/$($proposal.id)/signoffs" -WebSession $session -ContentType 'application/json' -Body (@{agentId='commissioner';status='APPROVED';comment='ok'}|ConvertTo-Json)
$signoff2 = Invoke-RestMethod -Method Post -Uri "$base/api/proposals/$($proposal.id)/signoffs" -WebSession $session -ContentType 'application/json' -Body (@{agentId='integrity';status='APPROVED';comment='ok'}|ConvertTo-Json)
$approved = Invoke-RestMethod -Method Post -Uri "$base/api/approvals/$approvalId/approve" -WebSession $session -ContentType 'application/json' -Body '{}'
[pscustomobject]@{proposalId=$proposal.id;approvalId=$approvalId;reviewRequestId=$review.id;signoffA=$signoff1.status;signoffB=$signoff2.status;finalApprovalStatus=$approved.status} | ConvertTo-Json -Depth 6
