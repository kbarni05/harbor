param(
  [Parameter(Mandatory)][string]$Installer,
  [Parameter(Mandatory)][string]$ReferenceInstaller,
  [Parameter(Mandatory)][string]$ExpectedPayload,
  [Parameter(Mandatory)][string]$TestDirectory,
  [Parameter(Mandatory)][string]$ReportPath
)

$ErrorActionPreference = 'Stop'
$Installer = (Resolve-Path -LiteralPath $Installer).Path
$ReferenceInstaller = (Resolve-Path -LiteralPath $ReferenceInstaller).Path
$ExpectedPayload = (Resolve-Path -LiteralPath $ExpectedPayload).Path
$TestDirectory = [IO.Path]::GetFullPath($TestDirectory)
if (Test-Path -LiteralPath $TestDirectory) { throw 'Use a new, empty test directory' }
$results = [Collections.Generic.List[object]]::new()

function Invoke-Setup([string]$Path, [string]$Scenario) {
  $start = [Diagnostics.ProcessStartInfo]::new($Path)
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.Arguments = "/S /D=$TestDirectory"
  $process = [Diagnostics.Process]::Start($start)
  if (-not $process.WaitForExit(180000)) {
    Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
    throw "$Scenario timed out"
  }
  if ($process.ExitCode -ne 0) { throw "$Scenario failed: exit $($process.ExitCode)" }
  $results.Add([pscustomobject]@{ scenario = $Scenario; exitCode = $process.ExitCode })
}

function Assert-Payload {
  $files = @(Get-ChildItem -LiteralPath $ExpectedPayload -Recurse -Force -File | Where-Object {
    $_.Name -ne 'uninstall.exe' -and
    -not $_.FullName.StartsWith((Join-Path $ExpectedPayload '$PLUGINSDIR') + [IO.Path]::DirectorySeparatorChar) -and
    $_.Name -ne 'MicrosoftEdgeWebView2RuntimeInstaller.exe'
  })
  foreach ($file in $files) {
    $relative = [IO.Path]::GetRelativePath($ExpectedPayload, $file.FullName)
    $installed = Join-Path $TestDirectory $relative
    if (-not (Test-Path -LiteralPath $installed -PathType Leaf)) { throw "Missing installed file: $relative" }
    if ((Get-FileHash -LiteralPath $installed).Hash -ne (Get-FileHash -LiteralPath $file.FullName).Hash) {
      throw "Installed file differs: $relative"
    }
  }
  $version = (Get-Item -LiteralPath (Join-Path $TestDirectory 'harbor.exe')).VersionInfo.FileVersion
  if ($version -ne '0.9.128' -and $version -ne '0.9.128.0') { throw "Wrong installed version: $version" }
  $results.Add([pscustomobject]@{ scenario = 'installed payload'; files = $files.Count; version = $version })
}

function Invoke-Uninstall {
  $uninstaller = Join-Path $TestDirectory 'uninstall.exe'
  $process = Start-Process -FilePath $uninstaller -ArgumentList @('/S', "_?=$TestDirectory") -WindowStyle Hidden -PassThru
  if (-not $process.WaitForExit(180000)) { throw 'Uninstall timed out' }
  if ($process.ExitCode -ne 0) { throw "Uninstall failed: exit $($process.ExitCode)" }
  if (Test-Path -LiteralPath (Join-Path $TestDirectory 'harbor.exe')) { throw 'Uninstall left the app executable' }
  $results.Add([pscustomobject]@{ scenario = 'uninstall'; exitCode = $process.ExitCode })
}

try {
  Invoke-Setup $ReferenceInstaller 'reference 0.9.127 install'
  $referenceVersion = (Get-Item -LiteralPath (Join-Path $TestDirectory 'harbor.exe')).VersionInfo.FileVersion
  if ($referenceVersion -ne '0.9.127' -and $referenceVersion -ne '0.9.127.0') { throw 'Wrong reference version' }
  Invoke-Setup $Installer 'upgrade from 0.9.127'
  Assert-Payload
  Invoke-Setup $Installer 'reinstall 0.9.128'
  Assert-Payload
  Invoke-Uninstall
  Invoke-Setup $Installer 'fresh 0.9.128 install after uninstall'
  Assert-Payload
  Invoke-Uninstall
} finally {
  $results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ReportPath -Encoding utf8
}
