$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseInfo = Get-Content -LiteralPath (Join-Path $projectRoot 'release\latest.json') -Raw | ConvertFrom-Json
$executablePath = [System.IO.Path]::GetFullPath($releaseInfo.executable)
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'release')) + [System.IO.Path]::DirectorySeparatorChar
if (-not $executablePath.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'A csomag elérési útja érvénytelen.' }
if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) { throw 'Előbb készítsd el az asztali alkalmazás csomagját.' }
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath 'VietLingo HU.lnk'
if (Test-Path -LiteralPath $shortcutPath) {
  $shortcutPath = Join-Path $desktopPath ('VietLingo HU ' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.lnk')
}
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $executablePath
$shortcut.WorkingDirectory = Split-Path -Parent $executablePath
$shortcut.IconLocation = (Join-Path $shortcut.WorkingDirectory 'VietLingo.ico') + ',0'
$shortcut.Description = 'Vietnámi tanulás magyarul'
$shortcut.Save()
Write-Output $shortcutPath
