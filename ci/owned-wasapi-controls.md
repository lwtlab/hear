# Owned Windows PCM diagnosis

`owned-wasapi-controls.yml` is a manual, diagnostic-only feedback loop for #270.
It reuses the reviewed Windows native artifact for the exact private source in
`manifests/native-probes.json`; artifact expiry requires another source-bound build.
It never creates an application Release or deploys the website.

Dispatch the existing `cross-platform-probe.yml` workflow at the reviewed controls
branch with `owned_signal_only=true` and the exact `source_ref`. Its normal probe
jobs remain the default; this explicit diagnostic mode calls the reusable controls
workflow and cannot establish file inference or release acceptance.

The original source-bound observation remains **FAIL**: run
42833844254/attempt 1, source `6254636e50575e46dec19956744dd74642fede32`,
workflow `665c9ef5668f9fcabcce6055b1e6776f87d8f5ce`, native digest
`6bfadd327856a79ad4e6df3fb9715e4058b5afe9950a987d3537e8f27d9a2867`.
Real packaged file inference passed; the owned player yielded 274,560 zero PCM
samples. Its receipt ZIP digest and encrypted PCM authentication were checked.
Updating the native reuse selector does not promote this signal result to PASS.

The matrix repeats the unchanged private probe with the default Electron player
and with the diagnostic `AudioServiceOutOfProcess` feature override. The override
is a hypothesis control, not proof that the Chromium feature changed behavior.
Both runs also compile the Microsoft ApplicationLoopback sample at exact public
revision `434f6002bdf9cf9829406c3ff2b33387982d6168`, using its pinned WIL dependency.
The reference receives only the PID of the newly launched player and the literal
`includetree` mode. It cannot select another process or capture a default output.
The player remains alive until the bounded reference capture finishes.

The first controls run `42839130553/1` stopped before capture on an overstrict PID
equality assertion. That tooling failure is separate from the original silent
capture. The reference target now comes from `GetWindowThreadProcessId` for the
new player's HWND, with a bounded, cycle-free parent chain back to the launcher's
still-running process. A different window or process tree is rejected.

Only fixed identity, playback and independently measured signal fields are public.
Owned sample PCM, reference WAV, command output and detailed errors are encrypted
with seven-day retention. Reference signal and production-native signal remain
separate outcomes. A reference PASS cannot satisfy the final native signal gate;
neither result establishes live ASR, physical listening or signed release acceptance.
