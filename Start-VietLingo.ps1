$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw 'A Node.js nem található. Telepíts Node.js-t, majd futtasd: npm install; npm run dev.' }
if (-not (Test-Path -LiteralPath 'node_modules\vite\bin\vite.js')) { throw 'A függőségek hiányoznak. Futtasd: npm install.' }
& $nodeExecutable 'node_modules\vite\bin\vite.js' --host 127.0.0.1 --port 5173 --strictPort
exit $LASTEXITCODE
