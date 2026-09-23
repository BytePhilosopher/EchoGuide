# ADR 003: OpenAPI Specification as Single Source of Truth

## Status
Accepted. Amended 2026-09-23: the direction is YAML-first.

## Context
The system requires type safety and validation across 3 client platforms: Kotlin native pipeline, React Native UI, Next.js Admin portal, and public API documentation.

## Decision
We write the API contract once, by hand, in `packages/openapi/openapi.yaml` (OpenAPI 3.0). Everything else is generated from it:
- Zod schemas for backend runtime validation (`@hey-api/openapi-ts`)
- TypeScript types for React Native & Next.js (`openapi-typescript`)
- API reference for the docs site (`redocly`)

Generated output is not committed; the YAML is the only file reviewed.

A generated Kotlin client for the mobile pipeline is deferred; it is not part of this pipeline yet.

### Why YAML-first rather than Zod-first
The original architecture drew Zod as the source that emits the YAML. We reversed it: the YAML is language-neutral, so the Kotlin pipeline reads the same contract as the TypeScript side without depending on a TypeScript file.

## Consequences
- **Positive**: Contract breaking changes fail client builds automatically at compile time.
- **Positive**: One reviewable file for every contract change.
- **Negative**: Schema generation step required in build pipeline.
- **Negative**: Rules OpenAPI cannot express (such as the transcription confidence gate) stay as hand-written Zod in the backend module that owns them.
