param(
  [Parameter(Mandatory)][string]$ReferencePayload,
  [string]$ProjectDirectory = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
$ReferencePayload = (Resolve-Path -LiteralPath $ReferencePayload).Path
$ProjectDirectory = (Resolve-Path -LiteralPath $ProjectDirectory).Path
$assets = @(
  @{ name = 'libmpv-2.dll'; target = 'src-tauri/libmpv/libmpv-2.dll'; hash = 'e9c87d19055bc5a82771b2b48e9fbae047bd5180603f5a1aaae10c90ca690467' },
  @{ name = 'mpv.exe'; target = 'src-tauri/binaries/mpv-x86_64-pc-windows-msvc.exe'; hash = 'df5c50556c10450101eecd76c5c77a1ae256eaaec83b496596bb3495d459a23c' },
  @{ name = 'ffmpeg.exe'; target = 'src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe'; hash = '72a489eccd008c2ec2c0a5856c5c75bc3d8bbfa90166c4566865c246445e6aa3' },
  @{ name = 'ffprobe.exe'; target = 'src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe'; hash = '19202b23c0043f15ad1b7bce2344f406fd52bd6efd8f995ce02e7392a1cec52f' },
  @{ name = 'yt-dlp.exe'; target = 'src-tauri/binaries/yt-dlp-x86_64-pc-windows-msvc.exe'; hash = '66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a' }
)

# Validate the complete input before replacing any staged build component.
foreach ($asset in $assets) {
  $source = Join-Path $ReferencePayload $asset.name
  if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.hash) {
    throw "Not the supplied 0.9.127 media component: $($asset.name)"
  }
}
foreach ($asset in $assets) {
  $target = Join-Path $ProjectDirectory $asset.target
  New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
  Copy-Item -LiteralPath (Join-Path $ReferencePayload $asset.name) -Destination $target -Force
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.hash) {
    throw "Reference media staging failed: $($asset.name)"
  }
  Write-Output "Reference media retained: $($asset.name) $($asset.hash)"
}
