$ErrorActionPreference = 'Stop'
$expectedVersion = '1.5.10'
$targetDir = Join-Path $env:LOCALAPPDATA 'agy\bin'
$target = Join-Path $targetDir 'agy.exe'
if (Test-Path -LiteralPath $target) {
    $actualVersion = (& $target --version | Out-String).Trim()
    if ($actualVersion -ne $expectedVersion) { throw "This release was verified with agy $expectedVersion; installed version is $actualVersion. Check the plugin release notes before upgrading." }
    return
}
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'This release supports Windows x64 only.' }
$manifestUrl = 'https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json'
$manifest = (Invoke-WebRequest -UseBasicParsing $manifestUrl).Content | ConvertFrom-Json
if ($manifest.version -ne $expectedVersion) { throw "Google now distributes agy $($manifest.version). Use a plugin release verified against that version." }
if (-not $manifest.url.StartsWith('https://storage.googleapis.com/antigravity-public/antigravity-cli/')) { throw 'Unexpected official CLI download URL.' }
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
$partial = Join-Path $targetDir 'agy.exe.download'
Invoke-WebRequest -UseBasicParsing $manifest.url -OutFile $partial
if ((Get-FileHash -LiteralPath $partial -Algorithm SHA512).Hash.ToLower() -ne $manifest.sha512.ToLower()) { throw 'Official CLI SHA-512 verification failed.' }
Move-Item -LiteralPath $partial -Destination $target
Write-Host "Installed official Antigravity CLI $expectedVersion (SHA-512 verified)."
