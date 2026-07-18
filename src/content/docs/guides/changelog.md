---
title: What's new
description: What changed in AI Hear 2.0, compared to 1.x.
---

## 2.0.0-beta.5

**Live captions that appear as you speak.** A new real-time recognition mode shows each word the
moment it's spoken and stops rewriting it once the sentence is finished — no more flicker as it
second-guesses itself. Parakeet Realtime (English) runs on macOS 14 and later; on macOS 26 a
built-in Apple engine brings the same real-time feel to more languages, including Chinese, with no
model to download. The existing speech models are unchanged and stay available.

**Tell recognition what language you're speaking — and steer it.** For Whisper and Qwen3-ASR you can
now set the audio language and add a short prompt to guide how it hears you — for example, to prefer
Simplified or Traditional Chinese. One-click suggestions fill in a sensible prompt for you, and the
full prompt lives in Settings. Engines that don't use these options simply don't show them.

**Check for updates when you want, and install on your terms.** There's now a "Check for updates"
button, and when one is ready you choose when to install it instead of having it applied on quit.
This also fixes a case where an update could finish downloading but never actually install.

**Playback and search fixes.** Seeking inside a recording now works reliably; the floating caption
window first appears centered along the bottom of the screen; and following playback no longer pulls
the view away from a search result you're reading.

Everything else in this release is under the hood.

## 2.0.0-beta.4

**Fixed: offline translation and AI summaries never worked on macOS 12, 13, and 14.** The built-in
local model server died the instant it started, so every translation and every AI action failed —
and all you saw was "translation failed", with no way to tell why. It had been built against a newer
macOS than AI Hear supports. It is now built correctly and runs on every supported version. If
you're on macOS 15 or later, this never affected you and nothing changes.

**Speech models that need a newer macOS are no longer offered on systems that can't run them.**
Parakeet and Qwen3-ASR need macOS 14; SenseVoice needs macOS 13. Until now you could download one —
between 483 MB and 1.6 GB — and only then find out it wouldn't start. They're now hidden where they
won't run. The Whisper models are unaffected and stay available on every supported version.

Everything else in this release is under the hood — no changes to how you use it.

## 2.0.0-beta.3

**Automatic updates now work.** From this version on, AI Hear checks for new releases on its own and
installs them quietly on quit — no more coming back here to download by hand. (beta.1 users: you'll
still need to grab this one manually, one last time.)

**More security hardening.** A second security-audit pass: internal source and build paths no longer
ship inside the app; a saved API key can't be redirected to another server even by hostile in-app
code; file transcription only accepts real media files, not arbitrary paths; and the app no longer
declares camera or Bluetooth permissions it never uses.

Everything else in this release is under the hood — no changes to how you use it.

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
