# Synthetic data and automated disclosure scanning

Public examples must be independently invented. Renaming, perturbing, or partially redacting a private record does not make it synthetic when the combination remains distinctive or re-identifiable.

## Fixture metadata

Every file under `fixtures/synthetic/` except the manifest itself must appear in `fixtures/synthetic/manifest.v1.json` with:

- a stable fixture ID;
- the exact repository-relative path;
- `origin: independently-invented`;
- a bounded purpose statement;
- an explicit reviewed state and review date.

Missing, unknown, transformed-private, or unreviewed fixture origins fail the disclosure gate.

## Automated gate

Run:

```bash
npm run disclosure:scan
```

The command scans three surfaces:

1. the current tracked tree;
2. every reachable Git blob in complete repository history;
3. the exact file set reported by `npm pack --dry-run --json --ignore-scripts`.

The scanner fails when the checkout is shallow because that cannot prove complete-history coverage. CI therefore checks out full history for the quality job.

Findings contain only rule ID, scope, path, and disposition. Matched secret or private values are never written to the report.

## Private marker input

A maintainer may provide an additional local marker file without committing its contents:

```bash
node scripts/disclosure-scan.mjs --private-markers /private/path/markers.txt
```

Each non-comment line is treated as an exact prohibited marker. The public report records only a hash-derived rule ID and marker count, never marker values. This allows a trusted release review to compare against private identifiers without publishing the allowlist or source evidence.

## Reviewed exceptions

`docs/disclosure-exceptions.v1.json` is empty by default. Any exception must bind an exact rule ID, scope, and path and include a rationale and review date. Broad wildcards are not supported. Reports expose only the exception ID.

Exceptions are for demonstrated false positives only. They are not a mechanism for accepting real private or credential material.

## Release boundary

This scanner is the mechanical gate for release disclosure. It does not replace human review of public issues, pull requests, comments, attachments, Actions metadata, caches, releases, packages, license obligations, or re-identification risk. Those remain part of the separate human release-review gate.
