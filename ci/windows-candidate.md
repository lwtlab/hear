# Original unsigned Windows CI candidate

Dispatch `desktop-candidates.yml` with an exact monorepo `source_ref`,
`target=win32-x64`, `mode=candidate`. This builds the original AIHear application,
source-bound N-API, Whisper/SenseVoice and LGPL FFmpeg, and restores the verified
shared Reader Qwen CUDA runtime. It does not run a WASAPI or microphone probe.

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


Only the shared Qwen upstream submodule is checked out with explicit
`core.autocrlf=false` and `core.eol=lf`. Whisper retains native Windows checkout
bytes to match its CMake-generated tracked JavaScript package metadata. The pinned build-only mtmd overlay matches exact LF anchors;
Windows' default CRLF checkout failed that anchor in run43380351891/attempt1
(workflow4e5407376191834ad11716dbe1a0a41800d79d9b). That failed build produced no
installer. A same-revision LF/CRLF control reproduces the overlay difference, and
real Git submodule controls verify that the canonical checkout overrides an
inherited autocrlf=true. This changes preparation only; product source stays frozen.


Run43382113251/attempt1 (workflowbdf71be2bcac66ca9cd644540f7ac7de437c9c60)
compiled/staged all engines and loaded Qwen, then stopped before packaging because
the pinned Whisper submodule was dirty. No installer was created and no reset is
used to manufacture a clean provenance record. `target=win32-x64, mode=checks`
now runs a separate bounded source-only diagnostic: fixed vendor checkout and
Whisper/SenseVoice compilation with private before/after Git metadata. Its small
receipt is always NOT_QUALIFIED and all product gates remain NOT_RUN. It cannot
run the candidate job or generate installer/native/product acceptance.


Source diagnostic43387059514/attempt1, workflow0d3e9f5f6f8ddd5be9c581c8aa4382d42c8bc89c,
observed clean checkout followed by one rewritten Whisper JavaScript package JSON
(LF toCRLF); all nested sources stayed clean and normalized diff was empty. The
subsequent preparation splits native Whisper checkout from Qwen-only LF checkout.
A new focused diagnostic must establish clean before/after state before a full new
candidate build. All earlier failures and diagnostic NOT_QUALIFIED outcomes remain.


Private product-source fix #305 changes the shared ASAR scanner. BC run43388609406
at workflow2326abaa33a200d98d3ea6eafef9484b3e7ba3d5 passed source protection and
reached production afterPack, then failed `Unsafe ASAR entry`; no installer exists.
A subsequent product SHA must be built independently and cannot inherit BC results.
Use `target=win32-x64, mode=privacy-checks` for cheap shared controls first: Linux
runs the full privacy suite; Windows runs ASAR controls with real Windows paths and
the pinned scanner. Separate runners check out checksum-reviewed fixture bytes as
canonical LF. No native compilation, model/app/audio execution or candidate gate
runs; public counts/digests are bounded and diagnostics remain encrypted. The
receipt is always NOT_QUALIFIED. Full native/installer builds remain separate.


Focusedrun43397239000/1 at7c6fc133be5925c3a8d7f63c0fd8add6216d7f3a passed the
nine actual Windows ASAR controls. Linux reported28PASS/1FAIL/1conditional skip:
the required7zz command was absent after package installation.
Preparation now resolves a genuine existing7zz or creates an owned runner-local
7zz alias to the installed7z, verifies its real execution and propagates failures.
No assertion, format control, source SHA or scanner policy is relaxed. The failed
Linux run and the separately successful Windows result remain independently bound.
