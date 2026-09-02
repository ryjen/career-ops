# ADR 0001: Node.js and ESM JavaScript

- Status: accepted
- Date: 2026-08-04
- Amended: 2026-09-01

## Decision

Use dependency-light JavaScript with ESM package exports and Node.js 20 as the minimum supported consumer runtime. Development and CI use the Node.js release supplied by the repository's locked Nix flake rather than a separate Node version manager. The current flake selects Node.js 22 from the pinned nixpkgs revision, including its bundled npm.

Use JSDoc for public signatures until demonstrated type-generation needs justify a TypeScript build step. CommonJS consumers use dynamic `import()` from their adapter boundary.

## Rationale

This matches the existing migration environment, avoids a compiler and install-time build during bootstrap, keeps package artifacts directly inspectable, and preserves a path to generated declarations or TypeScript later.

Keeping the supported runtime contract (`engines.node >=20`) separate from the reproducible development/CI toolchain avoids coupling package compatibility to an end-of-life CI baseline. `flake.lock` is the single version authority for repository tooling.
