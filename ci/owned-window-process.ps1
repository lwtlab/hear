param([uint32]$WindowId, [uint32]$LauncherPid)
$ErrorActionPreference = 'Stop'
if ($WindowId -eq 0 -or $LauncherPid -eq 0) { throw 'Owned window and launcher required' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OwnedWindowProcess {
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
}
'@
[uint32]$ownerPid = 0
$thread = [OwnedWindowProcess]::GetWindowThreadProcessId([IntPtr][int64]$WindowId, [ref]$ownerPid)
if ($thread -eq 0 -or $ownerPid -eq 0) { throw 'Owned window disappeared' }
$chain = @()
[uint32]$currentPid = $ownerPid
for ($index = 0; $index -lt 16; $index++) {
  if ($currentPid -eq 0 -or $chain -contains $currentPid) { break }
  $chain += $currentPid
  if ($currentPid -eq $LauncherPid) { break }
  $entry = Get-CimInstance Win32_Process -Filter "ProcessId = $currentPid"
  if (-not $entry) { throw 'Owned process disappeared' }
  $currentPid = [uint32]$entry.ParentProcessId
}
if ($chain[-1] -ne $LauncherPid) { throw 'Window owner is outside the newly launched process tree' }
@{ windowId = $WindowId; processId = $ownerPid; processChain = @($chain) } | ConvertTo-Json -Compress
