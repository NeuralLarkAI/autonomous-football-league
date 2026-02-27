$ErrorActionPreference='Stop'
$base='https://aflweb-production.up.railway.app'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -WebSession $session -ContentType 'application/json' -Body (@{email='commissioner@afl.local';password='dev-password'}|ConvertTo-Json) | Out-Null
$checks=@()

# season lock toggle roundtrip
$state = Invoke-RestMethod -Method Get -Uri "$base/api/dashboard" -WebSession $session
$origLock = [bool]$state.seasonLock
Invoke-RestMethod -Method Post -Uri "$base/api/league/season-lock" -WebSession $session -ContentType 'application/json' -Body (@{locked = (-not $origLock)}|ConvertTo-Json) | Out-Null
Invoke-RestMethod -Method Post -Uri "$base/api/league/season-lock" -WebSession $session -ContentType 'application/json' -Body (@{locked = $origLock}|ConvertTo-Json) | Out-Null
$checks += [pscustomobject]@{ action='season-lock-toggle'; ok=$true; note='roundtrip ok' }

# weekly report endpoint
$r1 = Invoke-RestMethod -Method Post -Uri "$base/api/agents/commissioner/weekly-report" -WebSession $session
$checks += [pscustomobject]@{ action='weekly-report'; ok=$true; note=($r1.summary | Out-String).Trim() }

# run integrity
$r2 = Invoke-RestMethod -Method Post -Uri "$base/api/agents/run" -WebSession $session -ContentType 'application/json' -Body (@{agentId='integrity'}|ConvertTo-Json)
$checks += [pscustomobject]@{ action='run-integrity'; ok=$true; note=($r2.summary | Out-String).Trim() }

# season0 kickoff
$r3 = Invoke-RestMethod -Method Post -Uri "$base/api/season0/kickoff" -WebSession $session
$checks += [pscustomobject]@{ action='season0-kickoff'; ok=$true; note="tasks=$($r3.tasksTotal) proposals=$($r3.proposalsTotal)" }

# week simulate via runbook route if exists
$runbooks = Invoke-RestMethod -Method Get -Uri "$base/api/runbooks" -WebSession $session
$wk = $runbooks | ? { $_.actionType -eq 'WEEK_SIMULATE' -and $_.isEnabled } | Select-Object -First 1
if($wk){
  $rr = Invoke-RestMethod -Method Post -Uri "$base/api/runbooks/$($wk.id)/run" -WebSession $session
  $checks += [pscustomobject]@{ action='week-simulate-runbook'; ok=$true; note=($rr.run.outputSummary | Out-String).Trim() }
} else {
  $checks += [pscustomobject]@{ action='week-simulate-runbook'; ok=$false; note='missing runbook' }
}

$checks | ConvertTo-Json -Depth 5
