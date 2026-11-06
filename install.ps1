param([switch]$PanelOnly)
$ErrorActionPreference = 'Stop'
$pulsePython = Get-Command python -ErrorAction SilentlyContinue
if (-not $pulsePython) { throw 'Python 3.10+ is required. Install Python, then run this script again.' }

$localManage = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'manage.py' } else { $null }
if ($localManage -and (Test-Path $localManage)) {
    $pulseArguments = @($localManage, 'install')
    if ($PanelOnly) { $pulseArguments += '--panel-only' }
    & $pulsePython.Source @pulseArguments
} else {
    $installUrl = 'https://raw.githubusercontent.com/moumouye/antigrative-dashboard/main/install.py'
    $tempInstaller = Join-Path ([System.IO.Path]::GetTempPath()) 'ag_install.py'
    Invoke-RestMethod -Uri $installUrl -OutFile $tempInstaller
    $pulseArguments = @($tempInstaller)
    if ($PanelOnly) { $pulseArguments += '--panel-only' }
    & $pulsePython.Source @pulseArguments
    Remove-Item $tempInstaller -Force -ErrorAction SilentlyContinue
}
if ($LASTEXITCODE -ne 0) { throw 'Antigrative Dashboard installation failed. See the error above.' }
