# ADR 003: OpenAPI Specification as Single Source of Truth

## Status
Accepted. Amended 2026-09-23: the direction is YAML-first.

## Context
The system requires type safety and validation across 3 client platforms: Kotlin native pipeline, React Native UI, Next.js Admin portal, and public API documentation.

## Decision
We write the API contract once, by hand, in `packages/openapi/openapi.yaml` (OpenAPI 3.0). Everything else is generated from it:
- Zod schemas for backend runtime validation (`@hey-api/openapi-ts`)
- TypeScript types for React Native & Next.js (`openapi-typescript`)
- Kotlin HTTP client for the mobile pipeline (`openapi-generator`)
- API reference for the docs site (`redocly`)

Generated output is not committed; the YAML is the only file reviewed.

### Why YAML-first rather than Zod-first
The original architecture drew Zod as the source that emits the spec. We flipped it because openapi-generator-cli (Kotlin) and redocly (docs) both prefer canonical OpenAPI 3.0 YAML, and keeping all 3 clients (especially Kotlin) in sync is easier when the OpenAPI spec is the root artifact.

## Consequences
- OK: Contract breaking changes fail all 3 client builds automatically
- OK: No manual duplication of request/response types
