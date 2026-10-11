# Locat Docker first-run configuration
# Run once: powershell -ExecutionPolicy Bypass -File scripts/setup-docker.ps1
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
$envFile = Join-Path (Get-Location) ".env"
if (Test-Path $envFile) {
  $existing = Get-Content -Raw $envFile
  if ($existing -notmatch "(?m)^LOCAT_DB_PASSWORD=\\S+" -or $existing -notmatch "(?m)^LOCAT_DB_ROOT_PASSWORD=\\S+") {
    throw "Existing .env is missing Docker database credentials. Refusing to overwrite it; add LOCAT_DB_PASSWORD and LOCAT_DB_ROOT_PASSWORD manually."
  }
  Write-Host "Existing Docker credentials preserved."
  exit 0
}
function New-Secret {
  $bytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToHexString($bytes).ToLowerInvariant()
}
$dbPassword = New-Secret
$rootPassword = New-Secret
# Avoid placing generated credentials in terminal output or source control.
$lines = @(
  "# Locat Docker credentials - keep private",
  "LOCAT_DB_PASSWORD=$dbPassword",
  "LOCAT_DB_ROOT_PASSWORD=$rootPassword",
  "# Optional: set to your public HTTPS origin (Tailscale Serve or reverse proxy)",
  "PUBLIC_ORIGIN=",
  "VAPID_SUBJECT=",
  "VAPID_PUBLIC_KEY=",
  "VAPID_PRIVATE_KEY="
)
try {
  $stream = [System.IO.File]::Open($envFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $writer = [System.IO.StreamWriter]::new($stream, [System.Text.UTF8Encoding]::new($false))
    try { $writer.Write(($lines -join [Environment]::NewLine) + [Environment]::NewLine) }
    finally { $writer.Dispose() }
  } finally { $stream.Dispose() }
} catch {
  if (Test-Path $envFile) { Write-Host "Existing .env preserved." }
  else { throw }
}
Write-Host "Docker credentials created in .env. Keep this file private."
Write-Host "Start Locat: docker compose up -d --build --wait"
