# ADR 003: OpenAPI Specification as Single Source of Truth

## Status
Accepted

## Context
The system requires type safety and validation across 3 client platforms: Kotlin native pipeline, React Native UI, Next.js Admin portal, and public API documentation.

## Decision
We define the API contract once using OpenAPI 3.0 YAML and Zod schemas in `packages/openapi/`. Code generators produce:
- Kotlin HTTP client for mobile pipeline
- TypeScript types for React Native & Next.js
- Redocly API reference documentation

## Consequences
- **Positive**: Contract breaking changes fail client builds automatically at compile time.
- **Negative**: Schema generation step required in build pipeline.
