# ADR 002: Modular Monolith Architecture over Separate Microservices

## Status
Accepted

## Context
At launch scale (10,000 active users, ~3.5 rps average, ~15 rps peak), microservices introduce unnecessary operational overhead and network latency across boundaries without providing scaling advantages.

## Decision
We organize the backend as a single **Modular Monolith** organized strictly by business domain (`auth`, `users`, `commands`, `vocabulary`, `consent`, `telemetry`, `billing`, `admin`), enforcing clean 4-layer dependency boundaries (presentation, application, domain, infrastructure).

## Consequences
- **Positive**: Simple deployment, single codebase, zero inter-service network latency.
- **Negative**: Requires strict linting rules to prevent modules from cross-importing infrastructure layers.
