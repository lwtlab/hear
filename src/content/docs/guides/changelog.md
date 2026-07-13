---
title: What's new
description: What changed in AI Hear 2.0, compared to 1.x.
---

## 2.0.0-beta.2

**Requires macOS 12 (Monterey) or later.** The browser engine inside AI Hear was updated to a
current, security-supported version, and it no longer runs on macOS 11. If you are on macOS 11,
stay on beta.1 until you can update macOS.

**Your API keys are now write-only.** A saved key is shown masked (`••••••1234`) and can be
replaced, but never read back — not by the settings page, and not by anything else running in the
interface. Keys stay encrypted in the system keychain and never leave the app's core.

**Security hardening.** A round of fixes from a security audit: the interface can no longer reach
past the app's own boundary, outbound requests are restricted (plain `http://` is now allowed only
to your own machine, for local model servers), and the packaged app ignores developer overrides.

**Fixed: API keys could be permanently lost.** If macOS ever asked for keychain permission and you
declined — which can happen after moving to a new Mac — every saved provider key was silently
erased. They are now preserved; declining just means that provider is unavailable until you allow
access and restart.

## 2.0

2.0 is a rewrite, not an upgrade. 1.x was a live-caption overlay. 2.0 adds **dictation**, **file transcription**, a **library**, and **local AI** — what you capture no longer disappears when the window closes.

### New

**Library.** Every live-caption session, dictation, and file transcription is saved. Search it, browse it by date, export or delete in bulk. The detail view is built for close listening: jump to any sentence, loop a sentence, loop between two points, change speed, find within the transcript.

**Dictation.** A global hotkey (or a double-tap of Shift) records you anywhere and pastes the text at your cursor. You can give dictation its own model, and attach an AI action to it — pick "Polish" or "Polish & translate" and what lands at your cursor is the processed text.

**File transcription.** Drop an audio or video file in and transcribe it offline. Decoding uses the bundled ffmpeg, so the usual formats just work.

**AI actions and follow-up.** Run summary, key points, action items, meeting minutes, or polish over any recording. Results and your follow-up questions share one conversation, streamed and rendered as Markdown, saved with the recording.

**Local AI (offline translation and summaries).** llama.cpp and Qwen3 weights ship inside the app, so translation and AI actions work with **no API key and no network**.

**Apple on-device translation** (macOS), via the system translation framework — also entirely offline.

### Changed

**Speech engines.** 1.x had whisper.cpp only. 2.0 adds SenseVoice, Qwen3-ASR (MLX-accelerated on Apple silicon), and Parakeet — and **live captions and file transcription each remember their own active model**, so you can keep a small fast model for live and a large accurate one for files.

**Audio.** 1.x let you pick one source. In 2.0 the microphone and system audio are **two tracks you can run at once**, each with its own gain, genuinely mixed. System audio can also be narrowed to a single app window or display.

**Translation.** The Microsoft / Bing / Google engines from 1.x are gone, replaced by Apple on-device translation, the built-in local model, or any OpenAI-compatible provider. Target languages went from a short list to 60+, the picker is searchable, and you can type a language that isn't in the list. New: **Polish** — when the target language matches the source, it fixes punctuation and removes filler instead of translating.

**Interface.** Light and dark themes, system accent color, native menu bar and tray, native confirmation dialogs. The UI is now available in **English, 简体中文, 繁體中文, 日本語, and 한국어**.

**Storage.** Recordings are stored as Opus — roughly an eighth the size of WAV. Settings shows what models, recordings, logs, and caches each cost you, and clears logs and caches in one click.

**Privacy.** 2.0 collects no telemetry. Audio never leaves your device, and transcript text is sent out only if you configure a cloud AI provider yourself — to that provider. Crash reporting is **off by default**; you can opt in under Settings → Advanced (it then sends the error stack and version info on a crash — never audio, transcripts, or API keys). See the [privacy policy](/guides/privacy/).

### Not back yet

Things 1.x had that 2.0 doesn't — noted, just not built:

- **Subtitle font color** — 2.0 exposes font size and background opacity only
- **Choosing the spoken language** — 2.0 lets the engine auto-detect it
- **Picking a GPU** (the Windows multi-GPU option in 1.x)
- **LAN caption server** (the SSE endpoint and QR code in the 1.x custom build)
- **SOCKS proxies** — 2.0's proxy setting is HTTP(S) only

If one of these is a blocker for you, [tell us](/guides/feedback/) and it moves up.
