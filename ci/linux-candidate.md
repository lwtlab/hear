# Linux original-application candidate

`desktop-candidates.yml` accepts `target=linux-x64`, `mode=candidate` and an explicit
40-character monorepo `source_ref`. It rejects legacy source pairs. Omitting target
retains the existing macOS workflow; the diagnostic cross-platform workflow is unchanged.

The Linux job rebuilds native core, Whisper/SenseVoice, LGPL FFmpeg and the scoped
PulseAudio helper from pinned sources, and restores the verified shared Reader
Qwen3 CUDA runtime. Staging is strict.
The original application is compiled without diagnostic preferences, product identity,
profile overrides, model/audio injection or sandbox switches.

The adapter preserves the source direct configuration's application ID, product name,
file exclusions, `afterPack` privacy gate, native unpacking, resource policy and Electron
fuses. It selects the Linux hotkey prebuild and a standard `aihear` deb, adds the same OS
font/PulseAudio dependencies used in Linux diagnostics, and disables publication. Its
derived configuration is separately hashed. This is a Linux candidate packaging
adaptation, not an assertion that the Mac source configuration itself supports Linux.

Before upload, the collector binds clean private source, independent public workflow,
run/attempt, ELF x64 native origin, all staged Qwen libraries and native engine hashes.
It reads the actual deb ar/tar streams without extraction or execution and checks its
package/version/architecture, native/engine/ASAR/executable payloads and Linux hotkey
presence. Swapped, linked, duplicate, missing or foreign-platform payloads fail.
Only explicit deb bytes and the small candidate receipt are uploaded for 14 days;
private command output remains encrypted for 7 days.

Every installed/UI/model/audio/signing acceptance field begins NOT_RUN. Build success
does not establish ordinary installation/launch, upgrade/uninstall, native dialogs,
model recovery, physical audio, signing or repository trust. Unsigned deb integrity
is source/workflow/run/checksum-bound, not a signed apt repository or formal release.
Mac-only engines are not built on Linux; local-LLM feature acceptance is not claimed.
No application Release, website deployment or default product-selection policy changes.

Deb artifacts use the Debian ABI name `amd64`; native targets remain `linux-x64`.
The filename is explicit, so electron-builder cannot substitute a different arch alias.
