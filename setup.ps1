param(
  [switch]$SkipInstall,
  [switch]$SkipStart
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$BackendDir = Join-Path $RepoRoot 'backend'
$FrontendDir = Join-Path $RepoRoot 'frontend'

function Get-PowerShellExe {
  $candidates = @('pwsh.exe', 'powershell.exe')
  foreach ($candidate in $candidates) {
    $command = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
  }
  throw 'Unable to find pwsh.exe or powershell.exe on PATH.'
}

function Get-ListeningPort([int]$port) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
    return $conn -ne $null
  } catch {
    return $false
  }
}

function Run-NpmInstall([string]$dir) {
  if (-not (Test-Path (Join-Path $dir 'node_modules'))) {
    Write-Host "Installing dependencies in $dir"
    Push-Location $dir
    npm install
    Pop-Location
  } else {
    Write-Host "Dependencies already installed in $dir"
  }
}

if (-not $SkipInstall) {
  Run-NpmInstall $BackendDir
  Run-NpmInstall $FrontendDir
}

if (-not $SkipStart) {
  $shell = Get-PowerShellExe

  if (Get-ListeningPort 5000) {
    Write-Host 'Backend port 5000 is already in use, so the backend startup will be skipped.'
    Write-Host 'If this is not your backend, stop the other process or change the PORT environment variable.'
  } else {
    Write-Host 'Starting backend in a new PowerShell window...'
    $backendCmd = "cd `"$BackendDir`"; npm run dev"
    Start-Process -FilePath $shell -ArgumentList '-NoExit', '-Command', $backendCmd
  }

  Write-Host 'Starting frontend in a new PowerShell window...'
  $frontendCmd = "cd `"$FrontendDir`"; npm run dev -- --host 0.0.0.0"
  Start-Process -FilePath $shell -ArgumentList '-NoExit', '-Command', $frontendCmd

  Write-Host ''
  Write-Host 'TenderIQ is starting...'
  Write-Host 'Backend: http://localhost:5000'
  Write-Host 'Frontend: http://localhost:5173 (or the next available port if 5173 is already used)'
}
