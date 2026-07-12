---
title: Privacy policy
description: What AI Hear sends over the network, and what it never does.
---

Last updated: 12 July 2026 · Applies to AI Hear 2.0

## In one line

**Your audio never leaves your device.** Speech recognition runs entirely on your machine, and recordings are stored only on your own disk.

## What we don't do

- **We don't upload audio.** Microphone and system sound are processed locally.
- **We don't collect telemetry.** No analytics, no usage tracking, no crash reporting.
- **There are no accounts.** No sign-up, no user profile on our side.
- **We don't sell or share** any of your content.

## Where your data lives

Recordings, transcripts, translations, AI results, and settings are plain files in the app's data folder on your computer. Delete a recording and its files are deleted. Uninstall the app and everything goes with it.

## When anything does leave your device

These cases, and no others:

### 1. A cloud AI provider you configured — the only case where your content is sent anywhere

If you enter an API key for an AI provider (OpenAI, DeepSeek, Moonshot, OpenRouter, and so on) in Settings, then using **translation** or an **AI action** sends the relevant **transcript text** to **the provider you chose**.

- We only forward the request to the endpoint you configured. **We never receive or store that text ourselves.**
- What is sent is text, **not audio**.
- What that provider does with it is governed by their privacy policy, not ours.
- **Want nothing to leave at all?** Use the built-in local AI model, or (on macOS) Apple's on-device translation. Both are fully offline. The settings page says so where it matters.

### 2. Model downloads

Model weights are downloaded from Hugging Face (`huggingface.co`) or its mirror (`hf-mirror.com`). This is an ordinary file download and **carries none of your data**.

### 3. License checks

If you buy a license, your activation key and a device identifier are sent to our licensing server (`l.thucydides.net`) to validate it and to bind or release the device. No audio or transcript text is involved.

If you buy through the App Store, Apple handles the transaction and we never see your payment details.

### 4. System translation language packs (macOS)

Turning on Apple's on-device translation may cause macOS to download a language pack from Apple. That is the operating system's behaviour and Apple's privacy policy applies; **the translation itself happens on your device**.

## Local connections

The built-in local AI model runs behind a server bound to `127.0.0.1`. It accepts no outside connections and no data leaves the machine.

## Proxy

You can set an HTTP proxy under Settings → Advanced. Model downloads, translation, and AI requests will then go through it. Localhost is never proxied.

## This website

This website (hear.thucydides.net) is separate from the app. **The website** uses Google Analytics and Microsoft Clarity to understand visits — ordinary web analytics, unrelated to and not linked with anything you do inside the app.

## Children

This product is not directed at children under 13, and we do not knowingly collect information from them.

## Changes

If this policy changes materially, we'll update the date on this page and note it in the app's changelog.

## Contact

Questions: [contact@thucydides.net](mailto:contact@thucydides.net).
