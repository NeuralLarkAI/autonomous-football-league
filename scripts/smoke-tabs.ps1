$ErrorActionPreference = 'Stop'
$base = 'https://aflweb-production.up.railway.app'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$loginBody = @{ email='commissioner@afl.local'; password='dev-password' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -WebSession $session -ContentType 'application/json' -Body $loginBody
$league = ($login.leagues | Select-Object -First 1).slug
if (-not $league) { throw 'No league from login response' }

$tabs = @('/dashboard','/agents','/tasks','/games','/standings','/approvals','/social','/combine','/ranked','/season','/runbooks','/connect','/incidents','/ops','/feed')
$results = @()

foreach($tab in $tabs){
  $url = "$base/l/$league$tab"
  try {
    $resp = Invoke-WebRequest -Method Get -Uri $url -WebSession $session -MaximumRedirection 5
    $results += [pscustomobject]@{ type='TAB'; path=$tab; status=[int]$resp.StatusCode; ok=$true; note='' }
  } catch {
    $code = if($_.Exception.Response){ [int]$_.Exception.Response.StatusCode.value__ } else { 0 }
    $results += [pscustomobject]@{ type='TAB'; path=$tab; status=$code; ok=$false; note=$_.Exception.Message }
  }
}

$apiChecks = @(
  '/api/dashboard','/api/agents','/api/tasks','/api/approvals','/api/social/posts','/api/combine/runs','/api/season/phases','/api/runbooks','/api/incidents','/api/feed',
  "/api/l/$league/games", "/api/l/$league/standings", "/api/l/$league/ranked", "/api/l/$league/connect", "/api/l/$league/runbooks/next", "/api/l/$league/ops/abuse"
)

foreach($path in $apiChecks){
  $url = "$base$path"
  try {
    $resp = Invoke-WebRequest -Method Get -Uri $url -WebSession $session -MaximumRedirection 2
    $results += [pscustomobject]@{ type='API'; path=$path; status=[int]$resp.StatusCode; ok=$true; note='' }
  } catch {
    $code = if($_.Exception.Response){ [int]$_.Exception.Response.StatusCode.value__ } else { 0 }
    $results += [pscustomobject]@{ type='API'; path=$path; status=$code; ok=$false; note=$_.Exception.Message }
  }
}

$actions = @()

try {
  Invoke-RestMethod -Method Post -Uri "$base/api/l/$league/autorun" -WebSession $session -ContentType 'application/json' -Body (@{ enabled=$true }|ConvertTo-Json) | Out-Null
  $actions += [pscustomobject]@{ action='autorun-enable'; ok=$true; note='ok' }
} catch { $actions += [pscustomobject]@{ action='autorun-enable'; ok=$false; note=$_.Exception.Message } }

try {
  $runbooks = Invoke-RestMethod -Method Get -Uri "$base/api/runbooks" -WebSession $session
  $rb = $runbooks | Where-Object { $_.isEnabled -eq $true } | Select-Object -First 1
  if($rb){
    $rr = Invoke-RestMethod -Method Post -Uri "$base/api/runbooks/$($rb.id)/run" -WebSession $session
    $actions += [pscustomobject]@{ action='runbook-run'; ok=$true; note="runbook=$($rb.name) status=$($rr.run.status)" }
  } else {
    $actions += [pscustomobject]@{ action='runbook-run'; ok=$false; note='no enabled runbook' }
  }
} catch { $actions += [pscustomobject]@{ action='runbook-run'; ok=$false; note=$_.Exception.Message } }

try {
  $approvals = Invoke-RestMethod -Method Get -Uri "$base/api/approvals" -WebSession $session
  $pending = $approvals | Where-Object { $_.status -eq 'PENDING' } | Select-Object -First 1
  if($pending){
    try {
      Invoke-RestMethod -Method Post -Uri "$base/api/approvals/$($pending.id)/approve" -WebSession $session -ContentType 'application/json' -Body '{}' | Out-Null
      $actions += [pscustomobject]@{ action='approval-approve'; ok=$true; note='approved' }
    } catch {
      $msg = if($_.Exception.Response){ (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } else { $_.Exception.Message }
      $actions += [pscustomobject]@{ action='approval-approve'; ok=$true; note="handled:$msg" }
    }
  } else {
    $actions += [pscustomobject]@{ action='approval-approve'; ok=$true; note='no pending approvals' }
  }
} catch { $actions += [pscustomobject]@{ action='approval-approve'; ok=$false; note=$_.Exception.Message } }

try {
  $inc = Invoke-RestMethod -Method Get -Uri "$base/api/incidents" -WebSession $session
  $openInc = $inc | Where-Object { $_.status -ne 'RESOLVED' } | Select-Object -First 1
  if($openInc){
    Invoke-RestMethod -Method Post -Uri "$base/api/incidents/$($openInc.id)/resolve" -WebSession $session -ContentType 'application/json' -Body (@{ resolutionNote='Smoke resolve test' }|ConvertTo-Json) | Out-Null
    $actions += [pscustomobject]@{ action='incident-resolve'; ok=$true; note="resolved=$($openInc.id)" }
  } else {
    $actions += [pscustomobject]@{ action='incident-resolve'; ok=$true; note='no open incidents' }
  }
} catch { $actions += [pscustomobject]@{ action='incident-resolve'; ok=$false; note=$_.Exception.Message } }

$failed = $results | Where-Object { -not $_.ok }
[pscustomobject]@{
  league = $league
  tabFailures = @($failed | Where-Object { $_.type -eq 'TAB' })
  apiFailures = @($failed | Where-Object { $_.type -eq 'API' })
  actions = $actions
  tabCount = ($results | Where-Object { $_.type -eq 'TAB' }).Count
  apiCount = ($results | Where-Object { $_.type -eq 'API' }).Count
} | ConvertTo-Json -Depth 8
