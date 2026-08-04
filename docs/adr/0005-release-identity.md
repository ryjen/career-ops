# ADR 0005: Package and release identity

- Status: accepted
- Date: 2026-08-04

## Decision

Use package name `@ryjen/career-ops` and target the public npm registry. Keep `private: true` during bootstrap so publication is impossible until the release issue verifies namespace ownership, trusted-tag automation, provenance, and disclosure controls.

After the first supported release, package versions use semantic versioning. Contract/schema versions remain explicit and independent where required.
