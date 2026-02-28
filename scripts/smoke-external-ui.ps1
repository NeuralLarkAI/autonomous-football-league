param(
  [string]$BaseUrl = "https://afl-web-production-c5fe.up.railway.app",
  [string]$LeagueSlug = "afl-prime"
)

$ErrorActionPreference = "Stop"

$tokenAddress = "0x488beccc840a09f2934f6a6290edd6b277e93ba3"
$tokenExplorer = "https://basescan.org/token/$tokenAddress"

function Assert-Contains {
  param(
    [string]$Content,
    [string]$Needle,
    [string]$Message
  )

  if (-not $Content.Contains($Needle)) {
    throw "FAILED: $Message"
  }
}

function Get-Url {
  param([string]$Path)
  return "$BaseUrl$Path"
}

Write-Host "[smoke-external-ui] BaseUrl=$BaseUrl LeagueSlug=$LeagueSlug"

$watchUrl = Get-Url "/watch"
$leagueUrl = Get-Url "/p/$LeagueSlug"
$joinUrl = Get-Url "/p/$LeagueSlug/join"
$registerUrl = Get-Url "/api/p/$LeagueSlug/agent/register"

$watch = Invoke-WebRequest -UseBasicParsing $watchUrl
if ($watch.StatusCode -ne 200) { throw "FAILED: /watch returned $($watch.StatusCode)" }
Assert-Contains -Content $watch.Content -Needle "AISPN Watch Center" -Message "/watch missing AISPN watch center heading"
Assert-Contains -Content $watch.Content -Needle '$AFL' -Message "/watch missing token symbol"
Assert-Contains -Content $watch.Content -Needle $tokenAddress -Message "/watch missing token address"
Assert-Contains -Content $watch.Content -Needle $tokenExplorer -Message "/watch missing BaseScan link"
Write-Host "[ok] /watch"

$league = Invoke-WebRequest -UseBasicParsing $leagueUrl
if ($league.StatusCode -ne 200) { throw "FAILED: /p/$LeagueSlug returned $($league.StatusCode)" }
Assert-Contains -Content $league.Content -Needle "Add Agent" -Message "/p/$LeagueSlug missing Add Agent entry"
Assert-Contains -Content $league.Content -Needle $tokenAddress -Message "/p/$LeagueSlug missing token address"
Write-Host "[ok] /p/$LeagueSlug"

$join = Invoke-WebRequest -UseBasicParsing $joinUrl
if ($join.StatusCode -ne 200) { throw "FAILED: /p/$LeagueSlug/join returned $($join.StatusCode)" }
Assert-Contains -Content $join.Content -Needle "Submit Registration" -Message "/p/$LeagueSlug/join missing form CTA"
Assert-Contains -Content $join.Content -Needle $tokenAddress -Message "/p/$LeagueSlug/join missing token address"
Write-Host "[ok] /p/$LeagueSlug/join"

$payload = @{
  agentName = "Smoke Bot $(Get-Date -Format 'yyyyMMddHHmmss')"
  description = "Automated external registration smoke check"
  mode = "SANDBOX"
  requestedScopes = @("agent:self:read", "agent:self:run", "feed:read")
} | ConvertTo-Json

$register = Invoke-WebRequest -UseBasicParsing -Uri $registerUrl -Method POST -ContentType "application/json" -Body $payload
if ($register.StatusCode -ne 200) { throw "FAILED: register endpoint returned $($register.StatusCode)" }
$json = $register.Content | ConvertFrom-Json
if (-not $json.claimCode) { throw "FAILED: register response missing claimCode" }
if (-not $json.claimUrl) { throw "FAILED: register response missing claimUrl" }
Write-Host "[ok] register endpoint claimCode=$($json.claimCode)"

Write-Host "[smoke-external-ui] PASS"
