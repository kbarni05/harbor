$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'verify-nsis-payload.ps1')
$plain = [Text.Encoding]::ASCII.GetBytes('prefix__TAURI_BUNDLE_TYPE_VAR_UNKsuffix')
$nsis = [Text.Encoding]::ASCII.GetBytes('prefix__TAURI_BUNDLE_TYPE_VAR_NSSsuffix')
if (-not [TauriNsisPayload]::Matches($plain, $plain)) { throw 'Identical binaries must pass' }
if (-not [TauriNsisPayload]::Matches($plain, $nsis)) { throw 'The exact NSIS marker patch must pass' }
foreach ($bad in @('Prefix__TAURI_BUNDLE_TYPE_VAR_NSSsuffix', 'prefix__TAURI_BUNDLE_TYPE_VAR_NSSsuffiX', 'prefix__TAURI_BUNDLE_TYPE_VAR_MSIsuffix', 'prefix__TAURI_BUNDLE_TYPE_VAR_NSSsuffixX')) {
  if ([TauriNsisPayload]::Matches($plain, [Text.Encoding]::ASCII.GetBytes($bad))) { throw 'Unexpected binary modification was accepted' }
}
$twoMarkers = [Text.Encoding]::ASCII.GetBytes('prefix__TAURI_BUNDLE_TYPE_VAR_UNK__TAURI_BUNDLE_TYPE_VAR_UNKsuffix')
$twoPatches = [Text.Encoding]::ASCII.GetBytes('prefix__TAURI_BUNDLE_TYPE_VAR_NSS__TAURI_BUNDLE_TYPE_VAR_NSSsuffix')
if ([TauriNsisPayload]::Matches($twoMarkers, $twoPatches)) { throw 'Multiple marker modifications must fail' }
Write-Output 'NSIS payload validation: 7 cases passed'
