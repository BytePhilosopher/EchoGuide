# ADR 001: React Native Shell with Kotlin Pipeline Split

## Status
Accepted (Blocking — first code written)

## Context
The application requires an Android `AccessibilityService` to drive other applications via gestures on behalf of blind users. Wake word detection, audio capture, Voice Activity Detection (VAD), upload retry, action execution, and TTS announcements are latency-critical or run in the background when the app UI is destroyed.

## Decision
We split the mobile client into a React Native UI shell and a Kotlin native execution layer:
1. **React Native**: Owns onboarding, settings, consent, history, and account screens.
2. **Kotlin Native**: Owns wake word, VAD, audio capture, AccessibilityService gesture execution, allowlist validation, and TTS announcement queue.
3. **Bridge Contract**: The pipeline **NEVER** crosses the JavaScript bridge.

## Consequences
- **Positive**: Command pipeline survives React Native UI destruction and JS garbage collection.
- **Negative**: Requires maintaining Kotlin native code alongside TypeScript React Native code.
