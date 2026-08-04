# Contributing

## Before changing code

1. Use or create a focused issue describing the contract, trust boundary, and definition of done.
2. Keep one bounded behavior change per pull request.
3. Do not copy private source, history, fixtures, prompts, logs, screenshots, or generated artifacts into this repository.

## Development

```bash
mise run setup
mise run verify
```

Use the pinned toolchain and committed lockfile. Do not add install or postinstall lifecycle scripts. New dependencies require a documented need, license review, and supply-chain review.

## Contracts

- version machine-readable contracts explicitly;
- reject unknown fields unless extensibility is deliberately documented;
- keep observed, inferred, unresolved, proposed, and canonical values distinct;
- define deterministic ordering, hashing, warnings, errors, and provenance;
- keep domain behavior callable through the library API rather than only through the CLI.

## Fixtures

Fixtures must be independently invented. Renaming or perturbing a real person, employer, role, URL, date, compensation range, or application record is not sufficient. Every future domain fixture must state its synthetic purpose and review status.

## Pull-request checklist

- tests cover success, ambiguity, invalid input, bounds, and capability-injection attempts;
- no network, credential, provider, private-path, or implicit repository dependency entered the core;
- public documentation describes only implemented behavior;
- `mise run verify` passes from a clean checkout;
- the packed archive contains only intended files.
