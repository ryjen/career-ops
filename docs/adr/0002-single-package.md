# ADR 0002: One package initially

- Status: accepted
- Date: 2026-08-04

## Decision

Start with one `@ryjen/career-ops` package containing internal contracts, core, and CLI modules.

Split a package only when independent versioning, dependencies, release cadence, runtime support, ownership, or distribution requirements are demonstrated by implemented behavior.

## Consequences

The first slice avoids empty packages and cross-package release coordination. Internal modules remain separated by directory and import rules.
