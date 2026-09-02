# ADR 0004: mise and npm task entrypoints

- Status: accepted
- Date: 2026-08-04
- Amended: 2026-09-01

## Decision

Use the repository Nix flake as the sole development and CI toolchain definition. Use `mise` as the maintainer-facing task interface, supplied by that flake rather than as a language/runtime installer. Keep minimal npm scripts for ecosystem portability and direct package operations.

CI and release workflows may bootstrap Nix on a fixed hosted runner, but project commands execute through `nix develop --no-update-lock-file`. Installation uses the committed npm lockfile and ignores lifecycle scripts.

Do not add a Makefile or a second toolchain/version manager without a concrete need that the flake, `mise`, and package scripts cannot support.
