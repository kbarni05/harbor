param([string]$Compiled, [string]$Packaged)

$ErrorActionPreference = 'Stop'
if (-not ('TauriNsisPayload' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Text;

public static class TauriNsisPayload {
  public static bool Matches(byte[] compiled, byte[] packaged) {
    if (compiled == null || packaged == null || compiled.Length != packaged.Length) return false;
    int firstDifference = -1;
    for (int i = 0; i < compiled.Length; i++) {
      if (compiled[i] != packaged[i]) { firstDifference = i; break; }
    }
    if (firstDifference < 0) return true;

    // Tauri rewrites UNK to NSS while creating the NSIS package, then restores
    // the standalone executable. No other packaged-byte difference is allowed.
    byte[] before = Encoding.ASCII.GetBytes("__TAURI_BUNDLE_TYPE_VAR_UNK");
    byte[] after = Encoding.ASCII.GetBytes("__TAURI_BUNDLE_TYPE_VAR_NSS");
    int start = firstDifference - (before.Length - 3);
    if (start < 0 || start > compiled.Length - before.Length) return false;
    for (int i = 0; i < before.Length; i++) {
      if (compiled[start + i] != before[i] || packaged[start + i] != after[i]) return false;
    }
    for (int i = start + before.Length; i < compiled.Length; i++) {
      if (compiled[i] != packaged[i]) return false;
    }
    return true;
  }
}
'@
}

function Assert-NsisPayload([string]$Compiled, [string]$Packaged) {
  $compiledBytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Compiled).Path)
  $packagedBytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $Packaged).Path)
  if (-not [TauriNsisPayload]::Matches($compiledBytes, $packagedBytes)) {
    throw 'NSIS application payload differs from compiled source beyond the Tauri bundle marker'
  }
  [pscustomobject]@{
    compiledSha256 = (Get-FileHash -LiteralPath $Compiled -Algorithm SHA256).Hash.ToLowerInvariant()
    packagedSha256 = (Get-FileHash -LiteralPath $Packaged -Algorithm SHA256).Hash.ToLowerInvariant()
    allowedDifference = 'Only __TAURI_BUNDLE_TYPE_VAR_UNK -> __TAURI_BUNDLE_TYPE_VAR_NSS'
  }
}

if ($Compiled -or $Packaged) {
  if (-not $Compiled -or -not $Packaged) { throw 'Both compiled and packaged paths are required' }
  Assert-NsisPayload $Compiled $Packaged
}
