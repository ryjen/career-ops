# Release policy

## Target

The planned package name is `@ryjen/career-ops`, published to the public npm registry after namespace ownership and release controls are verified. The package remains marked private during bootstrap to prevent accidental publication.

## Release gate

A supported release requires:

- trusted-tag, least-privilege release execution;
- clean lockfile-backed build and downstream install test;
- complete tests, architecture checks, disclosure review, and package-content inventory;
- checksums, SBOM, dependency/license report, and provenance;
- accurate release notes listing supported contracts and limitations;
- no unresolved security, privacy, licensing, determinism, or namespace finding.

## Versioning

Package releases use semantic versioning. Contract and schema versions remain explicit and may evolve independently when compatibility permits.
