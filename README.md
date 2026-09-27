<div align="center">

<img src="./assets/logo.jpg" alt="EchoGuide logo" width="240" />

# EchoGuide

**A bilingual voice assistant that lets blind and low-vision users operate the Android apps already on their phone.**

The user speaks a request in Amharic or English. EchoGuide plans the on-screen steps, validates them, performs them through Android's accessibility service and reports every outcome by voice.

![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)
![Languages](https://img.shields.io/badge/languages-Amharic%20%7C%20English-4B5563)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%7C%20Kotlin-3178C6)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

[How it works](#how-it-works) · [Repository layout](#repository-layout) · [Getting started](#getting-started) · [Development](#development) · [Architecture](#architecture) · [Privacy](#privacy-and-safety)

</div>

---

## Overview

Screen readers read the screen aloud, but the user still has to find and operate each control. EchoGuide lets the user state the goal and performs the taps, scrolls and text entry on their behalf.

- **Natural speech, not fixed phrases.** Requests are transcribed and planned against whatever is on screen right now, so there is no command list to memorise.
- **Amharic first.** Amharic (`am-ET`) and English (`en-US`) are both supported. Speech recognition, planning and speech output run on [Addis AI](https://addisassistant.com).
- **Every state is spoken.** Every acknowledgement, retry prompt, confirmation and error has a voice prompt, because the user cannot see the screen.
- **Safe by construction.** Plans can only use five action types (`TAP`, `SCROLL`, `TEXT_INPUT`, `BACK`, `HOME`). Plans are validated on the server and again on the phone. Destructive steps only run after a spoken "yes".
- **Private by default.** No audio or transcript is stored unless the user opts in.

---

## How it works

```
User ─────speech─────▶ Mobile client ──audio + screen context──▶ API ──▶ Addis AI (STT · LLM · TTS)
                       (RN UI + Kotlin pipeline)                  │
                              ▲                                   ├──▶ Postgres (source of truth)
                              └────── validated action plan ──────┘──▶ Redis (limits, queues)
```

| # | Stage | Where | What happens |
|---|---|---|---|
| 1 | **Capture** | Phone (Kotlin) | On-device wake word, voice activity detection and 16 kHz audio capture. Audio is never streamed continuously. |
| 2 | **Transcribe & gate** | API | Addis AI turns the speech into text. A confidence gate (`avg_logprob`, `no_speech_prob`, `compression_ratio`) asks the user to repeat themselves instead of acting on a guess. |
| 3 | **Plan & validate** | API | Addis AI plans actions against a summary of the current screen. The plan is checked against the OpenAPI contract and the user's per-app grants. |
| 4 | **Execute & speak** | Phone (Kotlin) | The plan is checked again on the phone, then the accessibility service runs it. Every command ends in one of four spoken outcomes: `ACCEPTED`, `CONFIRMATION_REQUIRED`, `REPROMPT` or `REJECTED`. |

These requirements shaped the design:

- The executor must be native Kotlin, because it drives other apps.
- Every state must be spoken.
- The voice pipeline never crosses the React Native JS bridge.

---

## Repository layout

The repository is a monorepo built with **npm workspaces** and **Turborepo**.

| Path | Purpose | Stack | Docs |
| --- | --- | --- | --- |
| [`apps/api`](apps/api) | Backend: auth, command pipeline, consent, billing, telemetry, admin | Express · TypeScript · Drizzle · Postgres · Redis | [README](apps/api/README.md) |
| [`apps/mobile`](apps/mobile) | Android client: React Native UI, plus the Kotlin voice pipeline and accessibility executor | Expo SDK 57 · React Native 0.86 · Kotlin | [Architecture](apps/docs/src/content/docs/architecture/mobile-client.md) |
| [`apps/admin`](apps/admin) | Support portal (UI prototype, not yet connected to the API) | Next.js 14 | — |
| [`apps/docs`](apps/docs) | Documentation site and API reference | Astro · Starlight | [README](apps/docs/README.md) |
| [`packages/openapi`](packages/openapi) | **The API contract.** Zod schemas and TypeScript types are generated from it. | OpenAPI 3.0 | [ADR 003](docs/adr/003-openapi-contract.md) |
| [`packages/config`](packages/config) | Shared TypeScript configuration | — | — |
| [`docs/adr`](docs/adr) | Architecture decision records | — | — |
| [`docs/runbooks`](docs/runbooks) | Operational runbooks | — | — |

> [!NOTE]
> `apps/mobile` is **not** an npm workspace. It has its own lockfile and is installed separately.

---

## Getting started

### Prerequisites

- **Node.js** ≥ 20.11 and **npm** ≥ 9
- **Docker** (runs Postgres 16 and Redis 7)
- **Android SDK** and a physical Android device or emulator (needed for the Kotlin layer)

### 1. Install dependencies and build the contract

```bash
npm install
npm run build --workspace=@echoguide/openapi
```

### 2. Start Postgres and Redis

```bash
docker compose up -d
```

### 3. Run the API

```bash
cp apps/api/.env.example apps/api/.env      # then set AUTH_TOKEN_SECRET (openssl rand -hex 32)
npm run db:migrate:dev --workspace=@echoguide/api
npm run start:api                            # → http://localhost:4000
```

### 4. Run the mobile app (in a separate terminal)

```bash
(cd apps/mobile && npm install)
npm run start:mobile
```

Next, on the device, turn on **Settings → Accessibility → EchoGuide**. Android does not let an app grant itself this permission, and EchoGuide cannot touch anything on screen without it. The app includes a guided setup screen for this step.

### Other apps

| App | Command | Port |
| --- | --- | --- |
| Admin portal | `npm run start:admin` | 3001 |
| Docs site | `npm run start:docs` | Astro default |

> [!TIP]
> If port `5432` or `6379` is already in use, change the host ports in `docker-compose.yml` and in `apps/api/.env`.

---

## Development

| Task | Command |
| --- | --- |
| Build everything | `npm run build` |
| Run all tests | `npm run test:infra:up --workspace=@echoguide/api && npm test` |
| API unit tests only | `npm run test:unit --workspace=@echoguide/api` |
| API integration tests | `npm run test:integration --workspace=@echoguide/api` |
| Lint the API contract | `npm run lint` |
| Change the API contract | Edit `packages/openapi/openapi.yaml`, then run `npm run build --workspace=@echoguide/openapi` |
| Create a database migration | Edit `apps/api/src/shared/database/schema.ts`, then run `npm run db:generate --workspace=@echoguide/api` |
| Roll back a migration (dev) | `npm run db:rollback:dev --workspace=@echoguide/api` |
| Deploy the API | See [`docs/runbooks/production-operations.md`](docs/runbooks/production-operations.md) |

**Testing approach.** The API has unit tests and integration tests against real Postgres and Redis. Addis AI fixtures cover malformed and low-confidence speech-to-text responses. A golden-audio suite tracks word error rate (WER). The Kotlin pipeline has JVM unit tests for the wake word detector, voice activity detection, plan validator, circuit breaker, session handling and the command state machine.

---

## Architecture

### Decision records

| ADR | Decision |
| --- | --- |
| [001](docs/adr/001-react-native-kotlin-split.md) | React Native for the app shell and Kotlin for the pipeline. The pipeline never crosses the JS bridge. |
| [002](docs/adr/002-modular-monolith.md) | A modular monolith rather than microservices |
| [003](docs/adr/003-openapi-contract.md) | OpenAPI YAML is the single source for the API contract |
| [005](docs/adr/005-device-bound-opaque-sessions.md) | Opaque, device-bound sessions rather than JWTs |

The [docs site](apps/docs/src/content/docs/architecture/decisions.md) has the decisions not yet written up as ADRs, the risk register and open questions.

### Quality targets

| Attribute | Target |
| --- | --- |
| Time to first audio | p50 < 3.5 s · p95 < 6 s |
| Time to acknowledgement | < 400 ms |
| Command success rate | > 90% (English, at launch) |
| API availability | 99.5% monthly |
| Executor safety | **Zero** unintended destructive actions |

---

## Privacy and safety

- **No audio or transcript is stored by default.**
- Logs never contain what a user said, credentials or phone hashes.
- Users can delete all of their data with `DELETE /v1/consent/user-data`. A deletion is only reported as complete once every copy is gone.
- Each app needs its own grant. EchoGuide acts only inside apps the user has allowed.

Read the full [privacy reference](apps/docs/src/content/docs/reference/privacy.md) and the [security architecture](apps/docs/src/content/docs/architecture/security.md) for details.

---

## Documentation

The Astro site in [`apps/docs`](apps/docs) has the full documentation. Run it locally with `npm run start:docs`.

- [Quickstart](apps/docs/src/content/docs/guides/quickstart.md)
- [Using EchoGuide](apps/docs/src/content/docs/guides/using-echoguide.md)
- [Voice commands](apps/docs/src/content/docs/guides/voice-commands.mdx)
- [Architecture overview](apps/docs/src/content/docs/architecture/overview.mdx)
- [API reference](apps/docs/src/content/docs/reference/api.mdx)

---

## License

Proprietary. © EchoGuide Team. All rights reserved.
