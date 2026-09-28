# Puts the production build online from this computer through a free Cloudflare quick tunnel,
# for letting other people try the app. TESTING ONLY: the address changes on every start, and
# the site is reachable only while this computer is on. Never print real shirts with it.
#
#   powershell -ExecutionPolicy Bypass -File deploy\try-online.ps1          start (or restart)
#   powershell -ExecutionPolicy Bypass -File deploy\try-online.ps1 -Stop    stop
#
# Needs Docker Desktop running and cloudflared (winget install Cloudflare.cloudflared).
# Data lives in Docker volumes and survives restarts. Secrets are generated once into
# deploy/production.env (git-ignored).
param([switch]$Stop)
$ErrorActionPreference = 'Stop'

$deployDir = $PSScriptRoot
$envFile = Join-Path $deployDir 'production.env'
$composeFile = Join-Path $deployDir 'compose.yml'
$stateDir = Join-Path $env:LOCALAPPDATA 'qrcare-try-online'
$pidFile = Join-Path $stateDir 'cloudflared.pid'
$logFile = Join-Path $stateDir 'cloudflared.log'
$port = 4800
New-Item -ItemType Directory -Force $stateDir | Out-Null

function Invoke-Compose { docker compose --env-file $envFile -f $composeFile @args }

function Stop-Tunnel {
  if (Test-Path $pidFile) {
    $old = Get-Process -Id (Get-Content $pidFile) -ErrorAction SilentlyContinue
    if ($old -and $old.ProcessName -eq 'cloudflared') { Stop-Process -Id $old.Id -Force }
    Remove-Item $pidFile
  }
}

if ($Stop) {
  Stop-Tunnel
  if (Test-Path $envFile) { Invoke-Compose stop }
  Write-Host 'Stopped. Data is kept; run the script again to go back online.'
  exit 0
}

$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) { $cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
if (-not (Test-Path $cloudflared)) { throw 'cloudflared not found: winget install Cloudflare.cloudflared' }
docker info --format '{{.ServerVersion}}' > $null 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running. Start it and try again.' }

function New-Secret {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}

# 1. Secrets: created once and reused, so logins and the database keep working across restarts.
if (-not (Test-Path $envFile)) {
  @(
    'NODE_ENV=production',
    'APP_ORIGIN=https://placeholder.trycloudflare.com',
    'PUBLIC_QR_BASE_URL=https://placeholder.trycloudflare.com',
    'TRUST_PROXY=1',
    "APP_PORT=$port",
    "POSTGRES_PASSWORD=$(New-Secret)",
    "JWT_ACCESS_SECRET=$(New-Secret)",
    "OTP_SECRET=$(New-Secret)",
    'EMAIL_PROVIDER=disabled',
    'SMS_PROVIDER=disabled'
  ) -join "`n" | ForEach-Object { [IO.File]::WriteAllText($envFile, "$_`n", (New-Object Text.UTF8Encoding $false)) }
  Write-Host 'Created deploy/production.env with new random secrets.'
}

# 2. Tunnel: a new public https address each time.
Stop-Tunnel
if (Test-Path $logFile) { Remove-Item $logFile }
# Both streams go to files so the tunnel does not hold on to this terminal's output.
$tunnel = Start-Process $cloudflared -ArgumentList "tunnel --no-autoupdate --url http://127.0.0.1:$port" `
  -RedirectStandardError $logFile -RedirectStandardOutput "$logFile.out" -PassThru -WindowStyle Hidden
Set-Content $pidFile $tunnel.Id
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep 1
  $match = Select-String -Path $logFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($match) { $url = $match.Matches[0].Value }
}
if (-not $url) { throw "Tunnel did not start; see $logFile" }

# 3. App: point it at the new address and (re)start the production containers.
$content = [IO.File]::ReadAllText($envFile)
$content = $content -replace '(?m)^APP_ORIGIN=.*$', "APP_ORIGIN=$url" -replace '(?m)^PUBLIC_QR_BASE_URL=.*$', "PUBLIC_QR_BASE_URL=$url"
[IO.File]::WriteAllText($envFile, $content, (New-Object Text.UTF8Encoding $false))
Invoke-Compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'docker compose failed' }

# 4. Wait until the site answers through the public address.
$ok = $false
for ($i = 0; $i -lt 60 -and -not $ok; $i++) {
  Start-Sleep 2
  try { $ok = (Invoke-WebRequest -UseBasicParsing "$url/api/health" -TimeoutSec 10).StatusCode -eq 200 } catch { }
}
if (-not $ok) { throw "The site is not answering at $url yet; check: docker compose --env-file deploy/production.env -f deploy/compose.yml logs app" }

Write-Host ''
Write-Host "ONLINE: $url" -ForegroundColor Green
Write-Host 'Keep this computer on and awake. QR codes made now only work until the next restart of this script.'
Write-Host 'First admin (once): docker compose --env-file deploy/production.env -f deploy/compose.yml exec app node dist/scripts/seed-admin.js <email>'
