# Release disclosure review

A supported release requires both the automated disclosure scan and an explicit human review of surfaces that repository content scanning cannot prove safe by itself.

This process applies to the exact release candidate commit and package archive. A prior review does not automatically approve a later candidate.

## Required sequence

1. Run `npm run disclosure:scan` from a complete-history checkout.
2. Build or pack the exact release candidate without lifecycle hooks.
3. Record the source commit, package version, archive SHA-256, fixture counts, and automated scan result.
4. Review every human surface below.
5. Review every disclosure exception and confirm it remains narrow and justified.
6. Complete a release disclosure record using the v1 schema.
7. Validate the record before publication.

```bash
node scripts/validate-release-disclosure.mjs /path/to/release-disclosure.json
```

A release is blocked unless the validator returns `valid: true`.

## Human review surfaces

Each surface must be recorded as `reviewed` or `not-applicable` with bounded notes explaining the result.

| Surface ID | Review requirement |
| --- | --- |
| `collaboration-history` | Review public issues, pull requests, reviews, comments, and discussion history for private, operational, or re-identifiable material. |
| `attachments-and-discussions` | Review uploaded images/files and discussion attachments; absence must be explicitly recorded. |
| `actions-logs-and-summaries` | Review workflow logs and job summaries for secrets, local paths, private identifiers, or raw source content. |
| `actions-artifacts-and-caches` | Review retained artifacts/caches and confirm release-relevant outputs contain only approved public material. |
| `environments-and-workflow-metadata` | Review environment names, workflow metadata, and release permissions for unintended operational disclosure. |
| `tags-releases-and-packages` | Review tags, releases, package metadata, release notes, and attached files. |
| `sbom-provenance-and-attestations` | Review SBOM, provenance, attestations, source references, and builder metadata. |
| `dependency-license-and-mpl` | Review dependency/license output, notices, and MPL-2.0 obligations. |
| `generated-docs-and-source-maps` | Review generated documentation, coverage output, snapshots, and source maps when present. |
| `synthetic-reidentification` | Review fixture combinations for re-identification risk beyond regex or exact-marker checks. |
| `package-archive-contents` | Inspect the exact package archive/file inventory and verify only intended public files are present. |

Human review is not satisfied by an automated scan result or by marking every surface `not-applicable` without evidence-based notes.

## Safe evidence record

The public release record contains only bounded evidence:

- exact source commit;
- package name/version and archive digest;
- automated disclosure command/status and aggregate counts;
- reviewer/date and surface dispositions;
- reviewed exception IDs;
- final approve/block decision and bounded rationale.

Do not place raw matches, private allowlists, secret values, private screenshots, source records, full logs, or private audit narratives into the release record.

## Blocking conditions

Block publication when any of the following is true:

- automated scan has an unresolved or unknown finding;
- any fixture origin/review state is incomplete;
- any human review surface is missing or unresolved;
- any exception is unreviewed or overly broad;
- package/archive/checksum identity is not exact;
- collaboration, Actions, cache, attachment, release, or package material cannot be shown to be public-safe;
- license or attribution requirements are incomplete;
- synthetic combinations remain plausibly re-identifiable.

## Accidental-disclosure response

When sensitive public content is discovered or cannot be proven removed:

1. freeze release publication and dependency promotion;
2. remove or revoke affected releases, packages, artifacts, caches, and attachments where the platform permits;
3. rotate potentially exposed credentials or sensitive identifiers where applicable;
4. assess forks, clones, mirrors, package downloads, and downstream consumers;
5. retain the detailed incident record privately and publish only a bounded public status if needed;
6. recreate the public repository from a clean history when complete purging cannot be demonstrated;
7. rerun the complete automated and human disclosure gates before resuming publication.

Deleting a file or force-pushing history alone is not proof that disclosure has been remediated.

## Relationship to release publishing

This runbook defines the disclosure approval artifact. The release workflow should consume a validated record rather than recreate a second checklist with different semantics.
