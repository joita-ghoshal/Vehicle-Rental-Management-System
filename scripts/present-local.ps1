# ZELVORA local presentation server: one process, one URL, no internet required.
# Free, isolated synthetic demo database, safe fallback for the live Render site.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-PortBusy([int]$candidate) {
    try {
        return [bool](Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue)
    } catch {
        return $false
    }
}

# Pick the first free port so a leftover server cannot block the presentation.
$port = 0
foreach ($candidate in 8000, 8010, 8020, 8030) {
    if (-not (Test-PortBusy $candidate)) { $port = $candidate; break }
}
if ($port -eq 0) { throw 'Ports 8000-8030 are all busy. Close the other servers and run this again.' }

# Build the frontend with root-relative assets for single-origin serving.
$html = Get-Content 'frontend\dist\index.html' -Raw -ErrorAction SilentlyContinue
if (-not $html -or $html -notmatch 'src="/assets/') {
    if (-not (Test-Path 'frontend\node_modules')) {
        Write-Host 'Installing frontend dependencies (first run only)...'
        Push-Location frontend
        if (Test-Path 'package-lock.json') { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
        $installCode = $LASTEXITCODE
        Pop-Location
        if ($installCode -ne 0) { throw 'Frontend dependency install failed.' }
    }
    Write-Host 'Building the frontend for local single-origin use...'
    Push-Location frontend
    $env:VITE_BASE = '/'
    npm run build
    $buildCode = $LASTEXITCODE
    Pop-Location
    if ($buildCode -ne 0) { throw 'Frontend build failed.' }
}

# The isolated demo database must be reachable before the server starts.
Push-Location backend
python -c "from database import get_connection; get_connection().close(); print('MySQL reachable')"
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'MySQL is not reachable. Start the MySQL service, then run this again.' }

python demo.py setup
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Demo database setup failed.' }

# Start each presentation from a clean local booking list, so a rehearsal can never
# block the real demo with overlapping dates. The safety guard refuses any non-demo DB.
$env:ZELVORA_DEMO_MODE = '1'
$env:ZELVORA_DB_NAME = 'zelvora_demo_db'
python -c "from demo_safety import require_demo_database; from database import run_write; require_demo_database(); run_write('DELETE FROM bookings WHERE id > 0'); run_write('ALTER TABLE bookings AUTO_INCREMENT = 1'); print('Local demo bookings cleared')"
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Could not reset local demo bookings.' }

# PORT would override our chosen port; remove any inherited value.
Remove-Item Env:PORT -ErrorAction SilentlyContinue

$env:ZELVORA_DEMO_MODE = '1'
$env:ZELVORA_DB_NAME = 'zelvora_demo_db'
$env:ZELVORA_STATIC_DIR = '../frontend/dist'
$env:ZELVORA_SESSION_STORE = 'db'
$env:ZELVORA_AUTO_MIGRATE = '1'
$env:ZELVORA_API_HOST = '127.0.0.1'
$env:ZELVORA_API_PORT = "$port"
$env:ZELVORA_COOKIE_SECURE = '0'
$env:ZELVORA_ENV = 'development'
$env:ZELVORA_PROVISION_DEMO = '0'

$url = "http://127.0.0.1:$port/"
# Open the browser only after the server answers, so the first page is never a connection error.
Start-Job -ScriptBlock {
    param($u)
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $r = Invoke-WebRequest "$u/api/health" -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200) { break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    try { Start-Process $u } catch { }
} -ArgumentList $url | Out-Null

Write-Host ''
Write-Host "ZELVORA local presentation server: $url"
Write-Host 'Demo customer: demo.customer@zelvora.example / ZelvoraDemo#2026'
Write-Host 'Demo admin:    demo.admin@zelvora.example / ZelvoraAdmin#2026'
Write-Host 'Press Ctrl+C in this window to stop.'
python start.py
Pop-Location
