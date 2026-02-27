$ErrorActionPreference='Stop'
$base='https://aflweb-production.up.railway.app'
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
$approval = (Invoke-RestMethod -Method Get -Uri "$base/api/approvals" -WebSession $session | Where-Object { $_.proposalId -eq $proposal.id } | Select-Object -First 1)
$review = Invoke-RestMethod -Method Post -Uri "$base/api/approvals/$($approval.id)/request-review" -WebSession $session -ContentType 'application/json' -Body (@{requesterAgentId='commissioner';targetAgentId='integrity';note='smoke request'}|ConvertTo-Json)
$signoff1 = Invoke-RestMethod -Method Post -Uri "$base/api/proposals/$($proposal.id)/signoffs" -WebSession $session -ContentType 'application/json' -Body (@{agentId='commissioner';status='APPROVED';comment='ok'}|ConvertTo-Json)
$signoff2 = Invoke-RestMethod -Method Post -Uri "$base/api/proposals/$($proposal.id)/signoffs" -WebSession $session -ContentType 'application/json' -Body (@{agentId='integrity';status='APPROVED';comment='ok'}|ConvertTo-Json)
$approved = Invoke-RestMethod -Method Post -Uri "$base/api/approvals/$($approval.id)/approve" -WebSession $session -ContentType 'application/json' -Body '{}'
[pscustomobject]@{proposalId=$proposal.id;approvalId=$approval.id;reviewRequestId=$review.id;signoffA=$signoff1.status;signoffB=$signoff2.status;finalApprovalStatus=$approved.status} | ConvertTo-Json -Depth 6
