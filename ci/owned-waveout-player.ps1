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
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
public static class OwnedWaveOut {
  [DllImport("winmm.dll")] public static extern uint waveOutGetNumDevs();
  [DllImport("winmm.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool PlaySoundW(string sound, IntPtr module, uint flags);
  public static bool ApiSucceeded { get; private set; }
  public static long PlaybackElapsedMs { get; private set; }
  public static void PlayBounded(string path) {
    var watch = Stopwatch.StartNew();
    // SND_FILENAME | SND_NODEFAULT | SND_SYNC. Check the native BOOL directly;
    // SoundPlayer.PlaySync discards it and can silently return on failure.
    var task = Task.Run(() => PlaySoundW(path, IntPtr.Zero, 0x00020002));
    if (!task.Wait(9000)) throw new TimeoutException("Owned playback timeout");
    PlaybackElapsedMs = watch.ElapsedMilliseconds;
    ApiSucceeded = task.Result;
    if (!ApiSucceeded) throw new InvalidOperationException("PlaySoundW rejected approved-sample playback");
    if (PlaybackElapsedMs < 6000) throw new InvalidOperationException("Approved 6.54-second sample did not play for its duration");
  }
}
'@
  $result.waveOutDeviceCount = [OwnedWaveOut]::waveOutGetNumDevs()
  $result.audioService = [string](Get-Service Audiosrv).Status
  $result.status = 'RUNNING'; Save-Result
  if ($result.waveOutDeviceCount -eq 0) { throw 'No waveOut playback device is available' }
  [OwnedWaveOut]::PlayBounded($Sample)
  $result.status = 'PASS'
} catch { $result.status = 'FAIL'; $result.error = [string]$_ }
finally {
  if ('OwnedWaveOut' -as [type]) {
    $result.playSoundSucceeded = [OwnedWaveOut]::ApiSucceeded
    $result.playbackElapsedMs = [OwnedWaveOut]::PlaybackElapsedMs
  }
  Save-Result
}
# Self-bounded even if the Electron parent is terminated before its cleanup runs.
if ($result.status -ne 'PASS') { [Environment]::Exit(1) }
