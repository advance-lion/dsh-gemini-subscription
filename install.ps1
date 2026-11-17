$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw 'Node.js not found. Install DSH Desktop or Node.js 24.9+.' }
& (Join-Path $PSScriptRoot 'scripts\ensure-agy.ps1')
& $nodePath (Join-Path $PSScriptRoot 'scripts\install.mjs')
exit $LASTEXITCODE
