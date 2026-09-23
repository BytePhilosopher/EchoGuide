---
title: Quickstart
description: Run the EchoGuide API, mobile client, and supporting services locally in about ten minutes.
---

This gets the full stack running on your machine: Postgres and Redis in Docker, the Node
API, and the Expo mobile client.

## Before you start

You need all four of these. The Android SDK is only optional if you never touch the
native Kotlin layer — and the accessibility executor lives there, so in practice you need it.

| Requirement | Version |
| --- | --- |
| Node.js | 18.x or newer |
| npm | 9.x or newer |
| Android SDK | Required for the native Kotlin build |
| Docker + Docker Compose | Required for local Postgres and Redis |

## Install and run

```bash
npm install
docker-compose up -d
npm run build --workspace=@echoguide/openapi
```

Build the OpenAPI package before either app starts. Both the API and the mobile client
import their types from it, so a stale build surfaces as confusing type errors somewhere
unrelated.

Then start the two processes in separate terminals:

```bash
npm run dev --workspace=@echoguide/api
npm run start --workspace=@echoguide/mobile
```

## Grant the accessibility permission

This is the step people skip, and nothing works without it.

EchoGuide operates other apps through Android's `AccessibilityService`. Android will not
let an app grant itself that permission — you enable it by hand, once, in
**Settings → Accessibility → EchoGuide**.

Until you do, speech recognition still runs and the assistant still answers. It simply
cannot touch anything. If commands are transcribed correctly but no tap ever happens,
check this first.

## Confirm it is working

Say a command and listen. A healthy round trip speaks an acknowledgement within
**400 ms** of you finishing your sentence, then speaks the result.

If the acknowledgement never arrives, the phone is not reaching the API. If the
acknowledgement arrives but nothing happens on screen, the accessibility permission is
missing.

## Next

- [Voice commands](/guides/voice-commands/) — what EchoGuide accepts and how it decides
- [Architecture overview](/architecture/overview/) — why the executor has to be native Kotlin
- [API reference](/reference/api/) — the full `/v1/commands` contract
