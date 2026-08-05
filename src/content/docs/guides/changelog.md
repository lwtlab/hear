---
title: What's new
description: What changed in AI Hear 2.0, compared to 1.x.
---

## 2.0.0

**AI Hear 2.0 is a complete rewrite of 1.x.** The original app focused on a live-caption overlay.
2.0 keeps that experience and turns it into a private, local-first transcription workspace where
live sessions, files, and dictation can be saved, searched, edited, replayed, translated, and
summarized.

### New in 2.0

**A local library.** Live-caption sessions, dictations, and file transcriptions are saved on your
Mac. Search across transcripts, browse by source and date, rename recordings, and export or delete
items in bulk.

**File transcription.** Drop in common audio or video formats and transcribe them offline. Live
captions and file transcription remember separate models, languages, and prompts, so a fast meeting
setup does not overwrite a more accurate file workflow.

**Dictation.** Start from anywhere with a global shortcut and optionally polish or translate the
result with AI. The direct-download build can paste automatically after you grant Accessibility
permission; the Mac App Store build copies the result to the clipboard for you to paste.

**Local AI and follow-up questions.** Generate summaries, key points, action items, meeting minutes,
or polished text, then continue with follow-up questions in the same saved conversation. The
built-in local model works without an API key or uploading your transcript; you can also connect an
OpenAI-compatible provider of your choice.

### Upgraded from 1.x

**Live captions.** The floating, always-on-top caption window now supports partial captions as you
speak, sentence-sized final captions, bilingual display, per-scenario language and prompt controls,
and faster model startup.

**Microphone and system audio together.** 1.x captured one source at a time. 2.0 can mix microphone
and system audio simultaneously with independent gain, and can narrow system capture to an app,
window, or display.

**More local speech engines.** Alongside Whisper, 2.0 adds SenseVoice, Qwen3-ASR, and Parakeet models,
including low-latency streaming options on supported macOS versions. The first-run guide recommends,
downloads, and checks a suitable model before your first real session.

**Translation.** The unofficial Microsoft, Bing, and Google integrations from 1.x are replaced by
Apple on-device translation where available, the built-in local model, or a user-configured
OpenAI-compatible provider. The searchable target list covers more than 60 languages and also
supports custom entries and same-language polishing.

**Editing and close listening.** Correct original text or translations, split and merge sentences,
adjust timestamps, undo changes, and restore the model output. Playback supports sentence jumps,
single-sentence and A–B loops, speed control, in-transcript search, and TXT/VTT/SRT export.

**A more native Mac app.** 2.0 adds a guided setup, light and dark themes, the system accent color,
native menus and dialogs, local storage management, and interfaces in English, Simplified Chinese,
Traditional Chinese, Japanese, and Korean.

**Privacy by default.** Audio, recordings, transcripts, and speech recognition stay on your Mac.
Text is sent off-device only when you choose and use a cloud AI provider. There are no accounts or
usage analytics. Optional crash reporting is off by default and never includes audio, transcript
content, or API keys. See the [privacy policy](/guides/privacy/).

### Requirements and compatibility

AI Hear 2.0 requires an Apple silicon Mac running macOS 13 Ventura or later. Intel Mac and Windows
users should remain on AI Hear 1.x.

The following specialized 1.x features are not yet available in 2.0: custom caption text colors,
Windows GPU selection, the LAN/SSE caption server, and SOCKS proxy support. If one is essential to
your workflow, [tell us](/guides/feedback/).
