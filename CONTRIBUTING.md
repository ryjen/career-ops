# Contributing

## Before changing code

1. Use or create a focused issue describing the contract, trust boundary, and definition of done.
2. Keep one bounded behavior change per pull request.
3. Do not copy private source, history, fixtures, prompts, logs, screenshots, or generated artifacts into this repository.

## Development

```bash
nix develop
mise run setup
mise run verify
```

`flake.nix` plus `flake.lock` is the canonical toolchain definition. `mise` is a task interface only and must not install its own language runtimes. CI and release workflows may bootstrap Nix on their fixed hosted runner, but project tools and versions come from the locked flake.

Do not add install or postinstall lifecycle scripts. New package or toolchain dependencies require a documented need, license review, supply-chain review, and an update to the appropriate lockfile.

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
- `nix develop --no-update-lock-file --command mise run verify` passes from a clean checkout;
- the packed archive contains only intended files.
