$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $project 'package.json') -Raw | ConvertFrom-Json
$releaseName = "$($package.name)-$($package.version)"
$output = Join-Path $project 'dist'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('dsh-release-' + [guid]::NewGuid().ToString('N'))
$content = Join-Path $stage $releaseName
New-Item -ItemType Directory -Path $content -Force | Out-Null
foreach ($directory in @('src', 'scripts', 'test')) {
    Copy-Item -LiteralPath (Join-Path $project $directory) -Destination $content -Recurse
}
foreach ($file in @('package.json', 'bridge-package.json', 'cordis.patch.yml', 'gemini.ps1', 'install.ps1', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md')) {
    Copy-Item -LiteralPath (Join-Path $project $file) -Destination $content
}
$zip = Join-Path $output "$releaseName-windows-x64.zip"
Compress-Archive -LiteralPath $content -DestinationPath $zip -Force
Write-Host "Built $zip"
