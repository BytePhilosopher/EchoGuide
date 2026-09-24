---
title: Testing and repository layout
description: Which tests gate a merge, which gate a release, which gate the bilingual launch — and the one repository they all live in.
---

## Test gates

| Layer | Approach | Gate |
| --- | --- | --- |
| Domain and application | Unit tests, no database, no network | Merge |
| Confidence gate | Golden audio corpus, asserted thresholds | Merge |
| Plan validation | Adversarial plans — injected, malformed, destructive | Merge |
| API contract | Generated clients compiled against the schema | Merge |
| Kotlin pipeline | Instrumented tests, no React Native present | Merge |
| Bridge | Contract tests against the TurboModule specification | Merge |
| Executor | Instrumented tests against fixture apps | Release |
| React Native screens | TalkBack traversal of every screen | Release |
| Amharic accuracy | 200-utterance corpus, word error rate | Bilingual launch |

Two entries matter most.

**The Kotlin pipeline is tested with React Native absent.** If it cannot be, the
[bridge rule](/architecture/mobile-client/#the-rule) has been broken — and the break is now a
test failure rather than a production incident.

**Adversarial plan tests are not optional.** They are the regression suite for
[plan validation](/architecture/security/#plan-validation), which is what stands between a
planning model and a user's banking app.

## Repository layout

One repository. Clients and backend change together at this stage, and a contract change should
be one reviewable commit.

```
.
├── apps/
│   ├── mobile/         Expo / React Native + Kotlin
│   ├── api/            Node backend
│   ├── admin/          Next.js admin portal
│   └── docs/           this site
├── packages/
│   ├── openapi/        Zod schemas, OpenAPI spec, generated types
│   └── config/         shared lint, tsconfig, formatter
└── docs/
    ├── adr/            architecture decision records
    └── runbooks/       operational runbooks
```

The generated Kotlin client is built as an artefact consumed by `apps/mobile/android`. **A
schema change breaks the build loudly** rather than failing silently at runtime.

To run it locally, see the [Developer quickstart](/guides/quickstart/).
