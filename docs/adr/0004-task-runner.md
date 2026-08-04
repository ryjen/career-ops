# ADR 0004: mise and npm task entrypoints

- Status: accepted
- Date: 2026-08-04

## Decision

Use `mise` as the maintainer-facing toolchain and task interface. Keep minimal npm scripts for ecosystem portability and CI.

Do not add a Makefile without a concrete use case that `mise` and package scripts cannot support. Installation uses the committed lockfile and ignores lifecycle scripts.
