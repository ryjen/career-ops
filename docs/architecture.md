# Architecture

## Context

CareerOps provides deterministic public contracts and algorithms. Consumers own policy, storage, scheduling, providers, authentication, and mutation authority.

```text
explicit input -> contract validation -> deterministic core -> versioned output
                       ^                       |
                       |                       v
             injected policy/time       warnings/provenance
```

## Initial package boundary

The project starts as one package with internal modules:

- `contracts`: versioned validators and public data shapes;
- `core`: deterministic functions that accept data and return data;
- `cli`: bounded explicit filesystem/stdin/stdout composition;
- `schemas`: JSON Schema 2020-12 interchange documents.

The core has no provider SDK, credential, environment, network, implicit filesystem, or repository-discovery dependency.

## Dependency direction

- CLI may depend on contracts and core.
- Core may depend on contracts and narrow deterministic utilities.
- Contracts do not depend on CLI, providers, or consumer code.
- Tests and synthetic fixtures may depend on public package exports.

A package split requires evidence that a module needs independent versioning, dependencies, release cadence, runtime support, or ownership.

## Determinism

Time, taxonomy, policy, identifier generation, and repository inputs are explicit when they affect behavior. Canonical output defines ordering, normalization, and hashing. The same explicit inputs produce the same canonical result.
