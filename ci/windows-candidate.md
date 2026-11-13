# Original unsigned Windows CI candidate

Dispatch `desktop-candidates.yml` with an exact monorepo `source_ref`,
`target=win32-x64`, `mode=candidate`. This builds the original AIHear application,
source-bound N-API, Whisper/SenseVoice, shared Reader Qwen CPU runtime and LGPL
FFmpeg. It does not run a WASAPI or microphone probe.

The adapter retains the original product identity, exclusions, production afterPack
privacy gate and fuses. Windows-specific changes select x64 hotkey prebuilds and a
per-user NSIS target/output; publication is disabled. The actual packaged executable
fuses, PE architectures, NSIS embedded payload hashes, complete Qwen adapter/library
inventory and source/native identities are checked before retaining a receipt.
The NSIS bootstrap may be x86 while the application/native payload must be x64.

This produces an **unsigned CI candidate**, not a signed final release. It does not
establish installer interaction, installed launch, upgrade/uninstall, model recovery,
system audio or physical-device acceptance. Those need new independently recorded
observations using these exact bytes. Windows10 System Audio and Windows11 process
capture remain separate deferred tasks. No application GitHub Release is created.
