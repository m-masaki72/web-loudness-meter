# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smartphone-targeted web acoustic measurement app — no install required, runs entirely in-browser. Covers mic recording, oscilloscope waveform display, dB/LUFS metering, and A/C-weighted SPL measurement. Must run over HTTPS (secure context required for all audio APIs).

## Tech Stack

Vanilla HTML/CSS/JS + Web Audio API. No framework has been chosen yet; this is a greenfield project starting from the architecture design document (`Webプラットフォームにおける音響計測・分析アプリケーションのアーキテクチャ設計.txt`).

## Audio Pipeline Architecture

Two parallel pipelines fed from the same `getUserMedia` stream:

**AnalyserNode pipeline** — real-time waveform + basic dBFS
- `getFloatTimeDomainData()` → RMS → `20 * log10(rms)` = dBFS
- Driven by `requestAnimationFrame` for canvas rendering
- Not suitable for LUFS (frame drops break integration)

**AudioWorklet pipeline** — sample-accurate DSP
- Receives uninterrupted 128-sample blocks on the audio render thread
- Implements LUFS (ITU-R BS.1770-4 / EBU R128): K-weighting filter → mean-square → 400 ms momentary / 3 s short-term / integrated with −10 LU relative gate
- A-weighting (dBA) and C-weighting (dBC) via cascaded BiquadFilterNodes
- Results posted to main thread via `MessagePort`

## Critical Constraints

**Disable browser audio processing on getUserMedia:**
```js
{ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } }
```
Without this, AGC invalidates all SPL measurements.

**Biquad coefficients are sample-rate-dependent.** Always read `audioContext.sampleRate` at init and select/recalculate the coefficient set for the actual rate (commonly 44100 or 48000 Hz). Hard-coding 48 kHz coefficients causes A-weighting errors at high frequencies on 44.1 kHz devices.

**No background audio on mobile.** Screen Wake Lock (`navigator.wakeLock.request('screen')`) must be held to prevent the OS from suspending the audio context. Listen for `visibilitychange` and re-request the lock + resume `AudioContext` when the app returns to foreground.

**iOS PWA file saving.** The anchor-tag download trick fails silently in standalone PWA mode on iOS. Use `navigator.share({ files: [file] })` to invoke the native share sheet. Fallback: encode Blob as Base64 data URI and open in a new tab for manual save.

**dBSPL calibration.** The Web Audio API exposes no hardware mic sensitivity. Implement a user-driven pseudo-calibration: measure known reference source (94 dBSPL calibrator), compute `offset = knownSPL − measuredDBFS`, persist offset in `localStorage`/`IndexedDB`, add it to all subsequent dBFS readings.
