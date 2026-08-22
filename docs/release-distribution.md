# Initial distribution

CareerOps v0.1.0 is distributed first as a GitHub Release from this repository.

The release contains the exact reviewed npm-compatible archive plus checksum, archive inventory, CycloneDX SBOM, dependency/license report, bounded provenance, automated disclosure summary, and candidate-bound release disclosure record.

The repository source manifest remains `private: true`; the release candidate builder creates the publishable `0.1.0` package manifest only in a temporary staging tree. This keeps accidental `npm publish` disabled from a normal checkout.

Public npm publication is not part of v0.1.0. It may be added later only after the intended npm namespace and package write authority are independently verified and the release policy is intentionally updated.

## Install from the GitHub Release

Download `ryjen-career-ops-0.1.0.tgz` and `SHA256SUMS` from the `v0.1.0` release, verify the SHA-256 entry, then install the local archive with package lifecycle scripts disabled.

Consumers should pin the exact release tag and archive checksum. Private adapters, policy, provider credentials, migration evidence, and application state remain outside this repository.

## Rollback and revocation

A consumer rollback means pinning a previously approved immutable archive/checksum or removing the package from the consumer. Because v0.1.0 is the first supported release, there is no earlier supported CareerOps package version.

If v0.1.0 must be revoked, publication is frozen, the release is clearly marked or removed as appropriate, affected credentials or identifiers are rotated if relevant, downstream exposure is assessed, and a corrected version receives the complete release/disclosure process. Reusing or silently moving the `v0.1.0` tag is prohibited.
