---
title: Privacy and data
description: What EchoGuide records, what it does not, and why voice assistants need a stricter default than most software.
---

A voice assistant for blind users hears more than a normal app. It is active in kitchens,
clinics, and conversations that have nothing to do with it. EchoGuide's default is
therefore to keep nothing.

## The default

**No audio is stored. No transcripts are stored.**

Audio payloads and derived transcripts exist in memory for the lifetime of a single
request and are discarded when it completes. They are not written to disk, not queued, and
not logged.

## What opting in changes

Retention is opt-in, per user, and reversible. Turning it on lets EchoGuide keep command
history so that failures can be investigated and recognition can be improved on your
actual speech rather than on a benchmark.

Turning it off stops collection from that point. It does not by itself erase what was
already kept — request deletion for that.

## What is always recorded

Some data is structural and cannot be switched off without breaking the product:

- **Install identity** — an `X-Install-ID` header identifying the installation, not you
- **Idempotency keys** — so a retried command does not execute twice
- **Trace identifiers** — propagated across services so one command can be followed end to end
- **Telemetry** — latency and success counters, not content

None of this includes what you said.

## Consent is a module, not a checkbox

Consent state is a first-class domain on the backend alongside auth and commands, and it
is surfaced in the mobile app's onboarding flow. The design intent is that consent is
auditable and revocable rather than a one-time dialog nobody can revisit.

## Third parties

Speech recognition, planning, and synthesis run on the Addis AI platform. Audio leaves the
device to reach it — that round trip is what makes server-side planning possible, and it
is the main privacy trade-off in the system. It is stated here rather than buried because
it is the thing a cautious user most needs to know.
