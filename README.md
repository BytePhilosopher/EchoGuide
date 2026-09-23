# Voice Accessibility Assistant — System Architecture

![System Architecture Diagram](./assets/system_architecture_diagram.png)

> **Bilingual (Amharic & English) Voice Accessibility Assistant for Android**
> High-performance accessibility framework designed to enable blind and low-vision users to control third-party Android applications via spoken voice commands.

---

## 📐 High-Level Context Architecture

```
                       +-----------------------------+
                       |         Blind User          |
                       +--------------+--------------+
                                      |
                                      | Spoken Commands
                                      v
+--------------------------------------------------------------------------+
|  Mobile Client (React Native + Kotlin Native Layer)                      |
|                                                                          |
|  +-----------------------+              +-----------------------------+  |
|  | React Native UI       |              | Kotlin Native Core          |  |
|  | - Onboarding & Consent|              | - Wake Word & VAD           |  |
|  | - Settings & History  |  TurboModule | - Audio Capture & Upload    |  |
|  | - Account State       | <----------> | - AccessibilityService Exec |  |
|  +-----------------------+              | - TTS Announcement Queue    |  |
|                                         +--------------+--------------+  |
+--------------------------------------------------------|-----------------+
                                                         |
                                                         | HTTPS (Audio, Context)
                                                         v
                                          +------------------------------+
                                          | Backend API Monolith (Node)  |
                                          | - Auth, Users, Commands      |
                                          | - Consent, Telemetry, Admin  |
                                          +------+---------------+-------+
                                                 |               |
                                     Audio/Text  |               | SQL Queries
                                     Payloads    v               v
                                   +---------------+   +-------------------+
                                   | Addis AI Platform | Postgres Database |
                                   | STT / LLM / TTS|  +-------------------+
                                   +---------------+
```

---

## ⚡ Key Architectural Drivers & Constraints

| # | Driver | Consequence / Architecture Constraint |
|---|--------|----------------------------------------|
| **D1** | **Executor drives third-party apps** | Android `AccessibilityService` must be Kotlin native and **cannot** cross JavaScript bridge. |
| **D2** | **Users cannot see the screen** | Every state must be announceable; silence is treated as a crash. |
| **D3** | **Network round-trip requirement** | Server-side planning via Addis AI model (`Addis-፩-አሌፍ`). |
| **D4** | **Privacy & Intimacy of Audio** | Data retention is strictly opt-in; no audio or transcripts stored by default. |
| **D5** | **Amharic as primary language** | Purpose-built speech models from Addis AI (3% WER on Amharic). |

---

## 📂 Repository Layout (Monorepo)

This repository is structured as a monorepo using **npm workspaces** and **Expo SDK 57**:

```
.
├── apps/
│   ├── mobile/                # Expo / React Native App + Kotlin Native Layer
│   │   ├── app.json           # Expo Application Configuration & Permissions
│   │   ├── package.json       # Expo SDK dependencies
│   │   ├── src/
│   │   │   ├── features/      # React Native UI (Onboarding, Settings, History, Account)
│   │   │   ├── native/        # TurboModule specifications
│   │   │   └── navigation/    # App Navigation Stack
│   │   └── android/src/main/kotlin/com/echoguide/
│   │       ├── pipeline/      # VAD, Audio Capture, Upload
│   │       ├── executor/      # Android AccessibilityService & Allowlist Executor
│   │       ├── accessibility/ # View-Tree reduction & node matching
│   │       ├── speech/        # On-device TTS & Addis AI TTS queue
│   │       ├── network/       # HTTP Client & Trace ID propagation
│   │       └── bridge/        # TurboModule Kotlin implementation
│   ├── api/                   # Backend API (Modular Monolith - Express/Node)
│   │   └── src/
│   │       ├── modules/       # Domain modules (auth, users, commands, consent, etc.)
│   │       ├── shared/        # Database schema, Redis cache, logger
│   │       └── app/           # Express routes and middleware
│   ├── admin/                 # Next.js Admin Portal (Support, Audits, Refunds)
│   └── docs/                  # Astro/Next.js Docs Site with Voxide Voice Navigation SDK
├── packages/
│   ├── openapi/               # Zod Schemas & OpenAPI Specification (Single source of truth)
│   └── config/                # Shared ESLint, TSConfig, and Formatter configs
└── docs/
    ├── adr/                   # Architecture Decision Records (ADR 001 - 011)
    └── runbooks/              # Production Runbooks
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- Android SDK (for native Kotlin build)
- Docker & Docker Compose (for local Postgres & Redis)

### Installation

```bash
# Install all monorepo dependencies
npm install

# Start Postgres & Redis dependencies
docker-compose up -d

# Run shared OpenAPI codegen
npm run build --workspace=@echoguide/openapi

# Create the database schema (copy apps/api/.env.example to apps/api/.env first)
npm run db:migrate --workspace=@echoguide/api

# Start API Backend Server in development mode
npm run dev --workspace=@echoguide/api

# Start Expo Mobile App
npm run start --workspace=@echoguide/mobile
```

---

## 🎯 Quality Attributes & Latency Budget

- **Time to First Audio**: P50 < 3.5 s, P95 < 6.0 s
- **Time to Acknowledgement**: < 400 ms (spoken confirmation when VAD closes buffer)
- **Command Success Rate**: > 90%
- **Executor Safety**: **Zero** unintended destructive actions (enforced via allowlist validation)

---

## 📄 License
Internal Proprietary — EchoGuide Team.
