---
title: Architecture
description: The five constraints that shaped EchoGuide, and the system layout that follows from them.
---

EchoGuide's structure is not a matter of taste. Five hard constraints determine almost
every boundary in the system.

## The five drivers

**The executor drives third-party apps.** Android's `AccessibilityService` cannot cross the
JavaScript bridge. The executor must therefore be native Kotlin — this is the reason the
mobile app is split rather than pure React Native.

**Users cannot see the screen.** Every state must be announceable. Silence is treated as a
crash.

**Planning needs a network round trip.** Action sequences are planned server-side by the
Addis AI model (`Addis-፩-አሌፍ`).

**Audio is intimate.** Retention is strictly opt-in. No audio or transcripts are stored by
default.

**Amharic is the primary language.** Addis AI's purpose-built speech models reach roughly
3% word error rate on Amharic — retrofitted English models do not come close.

## Layout

The mobile client is two halves that talk over a TurboModule bridge. React Native owns
onboarding, consent, settings, history, and account state. Kotlin owns wake word and voice
activity detection, audio capture and upload, the accessibility executor, and the
text-to-speech announcement queue.

The backend is a modular monolith in Express, organised by domain: auth, users, commands,
consent, telemetry, admin. It talks to Postgres for persistence and Addis AI for speech
and planning.

Schemas live in one place. `packages/openapi` holds the Zod schemas and the generated
OpenAPI specification, and both the API and the mobile client import their types from it.
That package is the single source of truth for the contract — build it before either app.

## Request pipeline

A command moves through five stages, and any one of them can stop it:

1. Transcribe the audio via Addis AI
2. Apply the confidence gate
3. Plan an action sequence against the current screen context
4. Validate that plan against the action allowlist
5. Execute on device, announcing each state

Audio payloads and transcripts are held in memory for the lifetime of the request only.
They are never written to disk.

## Latency and quality budget

| Measure | Target |
| --- | --- |
| Time to first audio | P50 under 3.5 s, P95 under 6.0 s |
| Time to acknowledgement | Under 400 ms |
| Command success rate | Above 90% |
| Unintended destructive actions | Zero |

Time to acknowledgement is the one users feel most directly — it is the gap between
finishing a sentence and hearing that they were heard.
