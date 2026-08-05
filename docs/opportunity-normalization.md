# Opportunity normalization v1

Opportunity normalization converts one explicit, bounded source document into deterministic structured output. It does not fetch URLs, inspect repositories, discover local files, or perform mutations.

## Contract

Input and output use independent version fields:

- input contract: `career-ops.opportunity-normalization` version `1`;
- output contract: `career-ops.opportunity-normalization-result` version `1`;
- schema version: `1`;
- taxonomy: `career-ops.opportunity-taxonomy` version `1`.

Schemas:

- `schemas/opportunity-normalization-input.v1.schema.json`
- `schemas/opportunity-normalization-output.v1.schema.json`

Runtime validators are exported from `src/contracts/opportunity-normalization.js`.

## Input

The caller supplies:

- source type and optional stable source identifier;
- canonical UTC observation time;
- optional canonical HTTP or HTTPS URL;
- bounded source text;
- optional explicit company and title hints;
- the exact taxonomy identity and version.

The source text limit is 131,072 UTF-8 bytes. Unknown fields, NUL characters, unsupported versions, credential-bearing URLs, and noncanonical observation times fail closed.

## Output semantics

The output keeps different knowledge states separate:

- `observed`: explicit caller-supplied hints and URL;
- `normalized`: resolved company, title, URL, and requirement candidates;
- `inferred`: location, compensation, seniority, and domain signals with evidence, confidence, and rule identity;
- `unresolved`: facts that could not be established safely;
- `warnings`: ambiguity or bounded-output conditions requiring review;
- `provenance`: source identity, observation time, canonical content hash, implementation identity, and taxonomy identity.

The raw source text is not copied into output. Evidence uses bounded rule and line references rather than source excerpts.

`status: ok` means no unresolved fields or warnings were produced. `status: review` means a consumer should review ambiguity before treating the result as authoritative.

## Determinism

Before hashing or inference, source text is normalized by:

1. Unicode NFC normalization;
2. CRLF and CR conversion to LF;
3. removal of trailing whitespace on each line;
4. removal of leading and trailing blank lines.

Equivalent explicit input, observation time, taxonomy, and implementation version produce byte-equivalent JavaScript objects and stable canonical hashes. The domain function does not read the wall clock.

## Library usage

```js
import { normalizeOpportunity } from '@ryjen/career-ops';

const result = normalizeOpportunity(input);
```

The library throws errors with stable codes:

- `ERR_CONTRACT_VALIDATION`: invalid or unknown input fields;
- `ERR_CONTRACT_VERSION`: unsupported contract or schema version;
- `ERR_INPUT_BOUNDS`: source text exceeds the byte limit;
- `ERR_INTERNAL_CONTRACT`: generated output violated its own runtime contract.

## CLI usage

```bash
node src/cli.js normalize-opportunity \
  --input fixtures/synthetic/opportunity-normalization-input.v1.json
```

The CLI reads only stdin or an explicit `--input` path and writes only stdout or a new explicit `--output` path. Existing output files are not overwritten.

Exit codes:

- `0`: success;
- `1`: execution, JSON, I/O, or unknown-command failure;
- `2`: contract validation failure;
- `3`: incompatible contract or schema version;
- `4`: bounded-input rejection.

CLI failures are emitted as one JSON object on stderr with contract name `career-ops.error`.

## Security boundary

Source text is untrusted data. Text that names commands, paths, repositories, providers, destinations, credentials, or capabilities does not authorize or configure execution. The v1 slice has no network access, provider integration, plugin execution, tracker mutation, application submission, or outbound communication.

## Known limitations

The v1 taxonomy and extraction rules are intentionally small and versioned. Requirement selection, location signals, compensation parsing, seniority, and domains are heuristic outputs with evidence and confidence—not canonical facts. Unsupported currencies, periods, ambiguous location modes, missing identity fields, and absent URLs remain explicit review items.
