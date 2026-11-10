param([string]$Sample, [string]$Output)
$ErrorActionPreference = 'Stop'
$result = @{ diagnostic = $true; releaseAcceptance = $false; status = 'FAIL' }
function Save-Result {
  [IO.File]::WriteAllText($Output, ($result | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
}
try {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Sample).Hash.ToLowerInvariant()
  if ($hash -ne '1577c1b3a7b62d24513c94bacca2e431555b5a1e0f4d43af235bf3296db87c67') { throw 'Only the approved sample may be played' }
  $result.sampleSha256 = $hash
  Add-Type -TypeDefinition @'
using System;
using System.Media;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
public static class OwnedWaveOut {
  [DllImport("winmm.dll")] public static extern uint waveOutGetNumDevs();
  public static bool PlayBounded(string path) {
    var task = Task.Run(() => {
      using (var player = new SoundPlayer(path)) {
        player.Load();
        if (!player.IsLoadCompleted) throw new InvalidOperationException("Approved sample did not load");
        player.PlaySync();
      }
    });
    return task.Wait(9000);
  }
}
'@
  $result.waveOutDeviceCount = [OwnedWaveOut]::waveOutGetNumDevs()
  $result.audioService = [string](Get-Service Audiosrv).Status
  $result.status = 'RUNNING'; Save-Result
  if ($result.waveOutDeviceCount -eq 0) { throw 'No waveOut playback device is available' }
  if (-not [OwnedWaveOut]::PlayBounded($Sample)) { throw 'Owned playback timeout' }
  $result.status = 'PASS'
} catch { $result.status = 'FAIL'; $result.error = [string]$_ }
finally { Save-Result }
# Self-bounded even if the Electron parent is terminated before its cleanup runs.
if ($result.status -ne 'PASS') { [Environment]::Exit(1) }
