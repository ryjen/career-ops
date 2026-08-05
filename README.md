# CareerOps

CareerOps is a deterministic, evidence-driven framework for career operations. It is designed for developers who need versioned contracts and reusable algorithms without built-in access to email, trackers, private repositories, hosted services, or personal policy.

## Project status

The first public domain slice is opportunity normalization and validation. It converts explicit bounded source text into structured observed, normalized, inferred, and unresolved values with deterministic provenance.

The package remains private until the release, namespace, disclosure, and provenance gates are complete.

## Design principles

- explicit bounded input rather than implicit discovery;
- deterministic output for equivalent input, time, taxonomy, and policy;
- observed, inferred, unresolved, proposed, and canonical values remain distinct;
- library APIs own behavior and the CLI remains thin composition glue;
- policies, clocks, taxonomies, repositories, and identifiers are injected when they affect behavior;
- local and read-only by default;
- independently invented synthetic fixtures only;
- no provider credentials, private infrastructure, or mutation authority in the public core.

## Opportunity normalization

```bash
mise run setup
node src/cli.js normalize-opportunity \
  --input fixtures/synthetic/opportunity-normalization-input.v1.json
```

The v1 slice provides:

- versioned input and output JSON schemas;
- matching runtime validators;
- deterministic text normalization, identity, and content hashing;
- explicit observation time and taxonomy identity;
- separated observed, normalized, inferred, and unresolved values;
- evidence, confidence, rule identity, warnings, and provenance;
- stable CLI error JSON and exit codes;
- no URL fetching, provider access, implicit discovery, or mutation.

See [opportunity normalization](docs/opportunity-normalization.md).

## Bootstrap smoke path

```bash
mise run verify
printf '%s\n' '{"contract_name":"career-ops.smoke","contract_version":1,"message":"hello"}' \
  | node src/cli.js smoke
```

The CLI reads only explicit stdin or `--input`, writes only stdout or a new `--output` file, and performs no network access.

## Package architecture

CareerOps starts as one ESM JavaScript package:

```text
src/contracts/   versioned runtime contract validators
src/core/        deterministic domain behavior
src/cli.js       explicit I/O adapter
schemas/         JSON Schema 2020-12 interchange contracts
fixtures/        independently synthetic scenarios
docs/adr/        architectural decisions
```

A package split requires demonstrated independent versioning, dependency, release-cadence, ownership, or runtime needs.

## Compatibility

- Node.js 20 or newer;
- ESM package exports;
- CommonJS consumers use dynamic `import()` at their adapter boundary;
- package semantic versions and contract/schema versions evolve independently when necessary.

See [architecture](docs/architecture.md), [compatibility](docs/compatibility.md), and the [ADR index](docs/adr/README.md).

## Security and privacy

Do not submit real resumes, applications, correspondence, contact details, credentials, private paths, or transformed private fixtures. See [SECURITY.md](SECURITY.md), the [threat model](docs/threat-model.md), and the [synthetic-data policy](docs/synthetic-data-policy.md).

## License

CareerOps is licensed under MPL-2.0. Separate consumer adapters may use other licenses when they remain in separate files and comply with applicable MPL obligations. See [MPL adapter guidance](docs/mpl-adapters.md).
