---
title: Evolution
description: The planned architectural moves after launch, why realtime audio is deliberately not first, and what would justify pulling a module out into a service.
---

```mermaid
timeline
    accTitle: Planned architectural moves
    accDescr: Launch brings the request-response pipeline, pre-synthesised phrases and a single region. Measured brings Amharic corpus verification, real latency percentiles and real cost per user. Realtime brings a duplex audio WebSocket, screen-context caching and prompt trimming. Offline brings on-device transcription and local intent shortcuts. Scale brings a read replica, regional deployment and a vendor fine-tune.
    Launch : Request-response pipeline : Pre-synthesised phrases : Single region
    Measured : Amharic corpus verification : Real latency percentiles : Real cost per user
    Realtime : Duplex audio WebSocket : Screen-context caching : Prompt trimming
    Offline : On-device transcription : Local intent shortcuts
    Scale : Read replica : Regional deployment : Vendor fine-tune
```

## Realtime is the big move

The vendor exposes speech in and speech out over a single WebSocket, in beta. Collapsing capture,
transcription, planning and synthesis into one duplex stream removes the sequential round trips
that make up most of the [5.8 s budget](/architecture/performance/#latency-budget).

**It is deliberately not the launch architecture.** A duplex stream replaces request-response
with a stateful connection. That changes the confidence gate, the failure table and the
idempotency model all at once.

Ship the boring version, measure it, then take the streaming win against a known baseline.

The [dependency rule](/architecture/backend/#the-dependency-rule) is what makes that a change of
adapter rather than a rewrite. This is the payoff for that rule.

## Honest partial offline

**Local intent shortcuts** are the honest path to partial offline. A small on-device classifier
handling the twenty most common commands covers most daily use without a local planning model.

Full offline needs a local planner, which is a different project.

## What would force a service extraction

Nothing today. Extract one module when one of these becomes true — not everything at once.

| Trigger | Extract |
| --- | --- |
| Transcription needs GPU instances | The transcription adapter, as a worker pool |
| Planning needs scaling independent of the API | The planner proxy |
| A second product reuses accounts | `auth` and `users` |
