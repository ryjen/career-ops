# Reproducible v0.1 release candidate

The v0.1 candidate can be built and verified without registry credentials or external publication.

```bash
npm ci --ignore-scripts
npm run release:candidate
```

The command requires:

- a clean Git worktree;
- the exact Node version in `.nvmrc`;
- the exact npm version in `package.json#packageManager`;
- the checked-in `release/release-plan.v1.json`;
- complete Git history for the disclosure gate.

## Safety model

The repository `package.json` remains `private: true`. The candidate builder creates a temporary staging manifest for version `0.1.0` with public package metadata, packs that staging tree, and then removes the staging directory. No `npm publish`, tag, GitHub Release, registry credential, or external mutation is performed.

This preserves accidental-publication protection while producing the exact `.tgz` that a later approved publication workflow can publish directly.

## Candidate verification

The builder:

1. runs the complete `npm run verify` gate;
2. runs the bounded disclosure scanner and requires `pass`;
3. copies only the declared public package surface to a temporary staging tree;
4. scans the staged package for secret/local-path markers;
5. packs the same staging tree twice and requires identical SHA-256 digests;
6. rejects unexpected archive paths and source maps;
7. derives a CycloneDX SBOM from the locked dependency graph;
8. produces a dependency/license report and fails on missing dependency license metadata;
9. installs the exact local archive into a fresh temporary downstream project using `--ignore-scripts --offline`;
10. verifies ESM import and CLI execution from that installed archive;
11. writes bounded candidate evidence under `.release-candidate/`.

## Outputs

`.release-candidate/` contains:

- the v0.1 `.tgz` archive;
- `SHA256SUMS`;
- `archive-inventory.json`;
- `sbom.cdx.json`;
- `licenses.json`;
- `disclosure-scan.json`;
- `provenance.json`;
- `candidate.json`.

The output directory is ignored by Git and should not be committed as normal source history.

## Provenance boundary

The candidate provenance records only bounded public data: repository URL, exact commit/tree identity, package/version/archive digest, reviewed Node/npm toolchain versions, evidence-file digests, downstream verification status, and the fact that publication was not performed.

It does not record credentials, runner names, host paths, environment dumps, provider state, or private topology.

## Distribution

Candidate construction is not publication approval. The external destination and namespace must be verified separately before publication. The candidate plan records publication issue `#18`, and the source package remains private until that publication path is explicitly approved.
