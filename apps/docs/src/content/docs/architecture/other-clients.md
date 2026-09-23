---
title: Admin and docs clients
description: The admin portal has no privileged database path. The docs site has a voice agent. The admin portal does not, yet — and why.
---

| Client | Stack | Talks to | Auth |
| --- | --- | --- | --- |
| Admin portal | Next.js, separate deployment | Backend API | Session plus permission rows |
| Docs site | Astro + Starlight, static output | CDN only | Public |

## Admin portal

A separate frontend against the same backend, with **no privileged database path**. Every feature
maps to a permission.

| Feature | Permission | Audited |
| --- | --- | --- |
| User lookup | `users.read` | Yes |
| Suspend account | `users.suspend` | Yes |
| View consent history | `consent.read` | Yes |
| Revoke consent on request | `consent.revoke` | Yes |
| Latency and failure dashboards | `telemetry.read` | No — aggregate only |
| Refund | `billing.refund` | Yes |

**Support staff never see command content, because the system does not store it.** That is a
property of the architecture, not a limit of the tooling.

## Voice navigation on this site

Voxide is a browser voice SDK. It exposes client-side JavaScript functions to a live voice model,
and ships a React widget plus a headless client. It runs in the browser only, so it has no
relationship to the mobile pipeline.

It belongs on the docs site for two reasons:

- **The audience includes blind developers.** Docs for an accessibility product that cannot be navigated by voice would be an obvious miss.
- **It is dogfooding with no risk surface.** Public docs contain nothing confidential. If the agent misbehaves, nothing is exposed.

| Exposed capability | Does |
| --- | --- |
| `searchDocs(query)` | Full-text search across the documentation |
| `navigateTo(section)` | Jump to a page |
| `readSection()` | Read the current section aloud |
| `showExample(language)` | Switch a code sample's language |

How to use it, and how it is wired, is on [Voice on this site](/guides/docs-voice/).

## Voxide in the admin portal — not yet

The same widget in the admin portal is a different proposition. An admin screen holds user
records, consent history and support context. Voxide runs in the browser against a third-party
model.

That conflicts with the [security model](/architecture/security/), which treats screen content
reaching an external model as a threat.

| Condition | Decision |
| --- | --- |
| Public documentation | **Adopt** — no confidential content on screen |
| Admin portal, user data on screen | **Deferred** — needs a verified redaction boundary first |
| Admin portal, aggregate dashboards only | **Candidate** — no personal data; revisit after the docs rollout |

Dashboards first is the sensible order. It proves the integration on a surface where a mistake
costs nothing.

## ScholarXiv

ScholarXiv is a separate product in the same portfolio, working on autonomous research. It has
**no runtime role** in EchoGuide.

It fits the evaluation work: model comparison, Amharic word-error-rate methodology, and the
literature behind the accuracy corpus. Nothing in the mobile client, the backend or the admin
portal calls it.
