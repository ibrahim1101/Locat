# Locat: install the latest successful signed Android release into an ADB emulator.
# Requirements: GitHub CLI (gh auth login), Android platform-tools (adb), running emulator.
param(
  [string]$Device = "emulator-5554",
  [string]$Repo = "ibrahim1101/Locat",
  [string]$Branch = "feat/locat-1.0",
  [string]$Adb = "C:\platform-tools\adb.exe"
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

foreach ($exe in @("gh", $Adb)) {
  if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) {
    throw "Required executable not found: $exe"
  }
}
& gh auth status
if ($LASTEXITCODE -ne 0) { throw "Run 'gh auth login' first." }
& $Adb -s $Device get-state
if ($LASTEXITCODE -ne 0) { throw "ADB device '$Device' is not available." }

$runsJson = & gh run list -R $Repo -w "android-apk.yml" -b $Branch -s success -L 10 --json databaseId,headSha,createdAt
if ($LASTEXITCODE -ne 0) { throw "Could not list GitHub Actions runs." }
$runs = @($runsJson | ConvertFrom-Json)
if ($runs.Count -eq 0) { throw "No successful Android build found on $Branch." }
$run = $runs | Sort-Object createdAt -Descending | Select-Object -First 1
$work = Join-Path $env:TEMP ("locat-emulator-" + $run.databaseId)
New-Item -ItemType Directory -Path $work -Force | Out-Null
Write-Host "Downloading run $($run.databaseId) (commit $($run.headSha))..."
& gh run download $run.databaseId -R $Repo -n "locat-android-release" -D $work
if ($LASTEXITCODE -ne 0) { throw "APK artifact download failed." }
$apk = Get-ChildItem -Path $work -Filter "locat-release.apk" -Recurse -File | Select-Object -First 1
if (-not $apk) { throw "Artifact contains no locat-release.apk." }
$checksum = Get-ChildItem -Path $work -Filter "locat-release.apk.sha256" -Recurse -File | Select-Object -First 1
if (-not $checksum) { throw "Missing APK checksum." }
$expected = ((Get-Content $checksum.FullName -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash $apk.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expected -ne $actual) { throw "APK SHA256 mismatch. Installation aborted." }
Write-Host "Checksum verified. Installing on $Device..."
& $Adb -s $Device install -r $apk.FullName
if ($LASTEXITCODE -ne 0) {
  throw "Install failed. If the signing key changed, do not uninstall without backing up app data."
}
Write-Host "Locat updated successfully on $Device. App data should be retained."
