# Governance

CareerOps currently uses a maintainer-led model.

## Decisions

- irreversible or cross-cutting decisions require an ADR;
- public contracts require explicit compatibility and deprecation analysis;
- security, privacy, licensing, and deterministic behavior are release gates;
- issues and pull requests remain narrowly scoped and independently reviewable.

## Changes

Maintainers may merge changes after implementation, tests, review, and required CI pass. Contract-breaking changes require a versioned migration path. Dependency updates require human review and never merge automatically.

## Releases

Only trusted tags may publish supported releases. Release artifacts must be reproducible, provenance-verifiable, disclosure-reviewed, and accurately scoped. See `docs/release-policy.md`.
