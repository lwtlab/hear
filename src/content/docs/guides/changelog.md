---
title: What's new
description: What changed in AI Hear 2.0, compared to 1.x.
---

## 2.0.0-beta.9

**Edit your transcripts.** Double-click any line in a recording to fix a word, correct a translation,
split a line in two, merge it with the next one, or nudge its start and end times. Undo and redo work
throughout, and "Restore original transcript" always brings back exactly what the model produced —
your edits live alongside the original rather than replacing it, so re-translating never overwrites
wording you fixed by hand.

**A setup wizard on first launch.** New installs now start with a short guided setup: it recommends a
transcription model for your language and machine, downloads it, then checks it by transcribing a
short built-in clip — so you find out the model works before you rely on it, not during your first
real recording. It asks only for the permissions the things you picked actually need; if you only
transcribe files, it asks for nothing.

**More accurate file transcription and dictation.** Audio is no longer chopped up before being sent
to the model when the model can segment it itself. Measured on meeting audio, this improves accuracy
by roughly 3–6 points across every engine we ship, and it's faster too. Dictation gains the most:
short phrases that previously came back empty now transcribe correctly.

**A much better Japanese model.** A dedicated Japanese model is now available and recommended for
Japanese, roughly halving the error rate compared with the previous suggestion.

**Fixed: Parakeet TDT v3 was listed as supporting Japanese.** It doesn't — feeding it Japanese
produced nonsense. It's now listed for the languages it actually handles.

**Smaller download, wider compatibility.** The Whisper/SenseVoice helper is now built from source:
about half the size, and no longer the component forcing a newer macOS than the rest of the app.

## 2.0.0-beta.8

**Smaller download.** A packaging cleanup removed a large amount of unused code that did not need to ship, so the download and on-disk size are noticeably smaller — with no change to features.

**Security hardening (under the hood).** The interface now loads over a private, self-contained scheme
instead of local files, and the app runs with tighter system privileges. Nothing looks different; this
just reduces the app's attack surface.

**One-time reset of a few display preferences.** As a side effect of the change above, a handful of
on-device interface preferences — caption text size, background opacity, bilingual vs. translation-only
mode, interface language, and the library's reading-panel layout — return to their defaults once, the
first time you open this version. Your recordings, transcripts, models, and settings are not affected.

## 2.0.0-beta.7

**Now requires macOS 13 (Ventura) or later.** The Whisper transcription models moved to a newer,
faster engine that needs macOS 13. If you're on macOS 12, stay on beta.6 until you can update macOS —
you won't be offered this update automatically.

**Whisper transcription runs on a newer engine.** The built-in Whisper models now use the same
up-to-date engine as the other speech models, replacing an older in-app version.

**Fixed: the app could freeze with a busy cursor right at launch.** Startup no longer does heavy work
on the main thread, so the window is responsive immediately.

**Fixed: "Restart & Install" for an update now installs on the first try.** It used to sometimes leave
the app running without installing, so you had to quit it by hand first.

**Real-time captions stay a readable length.** During long, continuous speech, Parakeet Realtime now
wraps up a caption after a bit instead of letting one line grow indefinitely — easier to read and to
translate. You can adjust this (or turn it off) under Settings → Advanced, alongside a low-latency
toggle for Apple Speech on macOS 26.

**Menu tidy-up.** "About AIHear" and "Check for Updates" now open the in-app About page (version,
licenses, and update controls) instead of doing nothing visible.

## 2.0.0-beta.6

**Fixed: the new real-time model wouldn't download.** In beta.5 the Parakeet Realtime model
reported a checksum error and couldn't be installed — so real-time captions couldn't be used at
all. It downloads and runs correctly now.

**Fixed: the app felt busy for a moment right after launch.** Startup no longer blocks on a
background task, so the window is responsive right away.

**Fixed: checking for updates failed behind a proxy.** Update checks now go through your configured
proxy, the same one the in-app connection test uses.

**Added: "Check for Updates" in the menu bar.** You can now check from the AIHear menu, not only from
Settings → About.

**All speech models are now listed — even ones your Mac can't run yet.** Each shows the macOS version
it needs (for example, Apple's built-in real-time engine shows "Requires macOS 26"), so you can see
what's available and what it takes to use it. Models your system supports work exactly as before.

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
