# ADR 0001: Node.js and ESM JavaScript

- Status: accepted
- Date: 2026-08-04

## Decision

Use dependency-light JavaScript with ESM package exports and Node.js 20 as the minimum supported runtime. Pin Node 20.20.2 for bootstrap development and CI reproducibility. Use JSDoc for public signatures until demonstrated type-generation needs justify a TypeScript build step.

CommonJS consumers use dynamic `import()` from their adapter boundary.

## Rationale

This matches the existing migration environment, avoids a compiler and install-time build during bootstrap, keeps package artifacts directly inspectable, and preserves a path to generated declarations or TypeScript later.
