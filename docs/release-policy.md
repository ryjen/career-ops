# Release policy

## Supported v0.1 distribution

The initial supported distribution for CareerOps v0.1 is a **GitHub Release in `ryjen/career-ops`**, tagged `v0.1.0`, with the exact verified package archive and bounded release evidence attached as assets.

Public npm publication is **not** part of v0.1 until ownership/control of the intended `@ryjen` npm namespace is independently verified. GitHub repository ownership is not evidence of npm namespace ownership.

The source `package.json` therefore remains:

- `version: 0.0.0-development`;
- `private: true`.

The release candidate builder creates the temporary publishable `0.1.0` manifest used inside the exact `.tgz`; it does not arm normal repository checkouts for accidental `npm publish`.

## Release identity

v0.1 has fixed identity:

- tag: `v0.1.0`;
- package: `@ryjen/career-ops`;
- package version inside the archive: `0.1.0`;
- supported domain: `career-ops.opportunity-normalization@1`;
- diagnostic contract: `career-ops.smoke@1`.

A release record is valid only when its human review, source commit, candidate archive SHA-256, package name/version, and automated disclosure evidence all refer to the same exact source commit and archive bytes.

## Required release assets

The GitHub Release must attach exactly the reviewed public evidence needed to verify the candidate:

- `ryjen-career-ops-0.1.0.tgz`;
- `SHA256SUMS`;
- `archive-inventory.json`;
- `sbom.cdx.json`;
- `licenses.json`;
- `provenance.json`;
- `disclosure-scan.json`;
- `release-disclosure.json`.

Raw private marker lists, secret matches, private audit notes, screenshots, environment dumps, and private regression evidence must never be release assets.

## Publication workflow

Publication is intentionally manual and narrowly scoped:

1. A maintainer reviews the exact current `main` commit using `docs/release-disclosure-review.md`.
2. The maintainer supplies only the bounded human-review declaration to the manual release workflow.
3. The workflow checks out exact `main`, rebuilds the candidate, assembles and validates the candidate-bound disclosure record, and refuses any identity mismatch.
4. The release job uses only `contents: write`; normal CI remains read-only.
5. The workflow creates fixed tag/release `v0.1.0` targeting the validated `main` SHA and uploads the fixed asset set.
6. It downloads the released archive and checksum from GitHub Release, verifies their bytes, installs the downloaded archive into a clean temporary consumer with lifecycle scripts disabled, and reruns library/CLI smoke tests.

Release source text or workflow input cannot choose another repository, package, tag, release name, registry, or destination.

## Release gates

A supported release requires:

- clean lockfile-backed build from the exact reviewed source commit;
- complete normal tests, architecture/workflow policy, disclosure scan, and package-content checks;
- reproducible package bytes across repeated packing;
- checksum, archive inventory, CycloneDX SBOM, dependency/license report, and bounded provenance;
- valid candidate-bound human disclosure record;
- clean downstream installation and CLI/library verification before and after GitHub Release publication;
- accurate release notes listing supported scope and limitations;
- no unresolved security, privacy, licensing, determinism, provenance, or disclosure finding.

## Failure and rollback policy

Do not silently replace or rewrite a published `v0.1.0` release when its bytes or evidence are suspect.

If publication is partial or a disclosure/integrity problem is discovered:

1. freeze further release promotion;
2. remove/revoke the affected GitHub Release assets/release when necessary;
3. assess downstream downloads/forks/clones and rotate exposed credentials if relevant;
4. record the incident privately where sensitive evidence belongs;
5. fix the source and publish a new SemVer patch such as `v0.1.1` rather than reusing `v0.1.0`;
6. recreate the public repository from clean history if complete disclosure remediation cannot be proven.

Consumers should pin both release version/tag and the published archive SHA-256. A private consumer migration must retain rollback to its previous implementation until its own parity/stabilization gates pass.

## Future npm publication

npm may become an additional supported distribution only through a separate reviewed change that verifies:

- namespace/package ownership;
- trusted-publishing or least-privilege publication credentials;
- published-byte equivalence or a documented deterministic transformation;
- provenance and downstream install verification from the actual npm registry.

Until then, GitHub Release is the supported v0.1 distribution authority.

## Versioning

Package releases use semantic versioning. Contract and schema versions remain explicit and may evolve independently when compatibility permits.
