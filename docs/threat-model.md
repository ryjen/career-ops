# Threat model

## Assets

- integrity of public contracts and release artifacts;
- privacy of users and downstream consumer data;
- separation from credentials and private infrastructure;
- deterministic, reviewable behavior;
- package namespace and dependency-chain integrity.

## Untrusted inputs

- pull requests and workflow changes;
- opportunity, resume, prompt, issue, and model-generated text;
- fixtures, snapshots, archives, and generated documentation;
- dependencies, package scripts, release inputs, and provenance metadata.

## Threats and controls

| Threat | Required control |
|---|---|
| Source text selects a command, path, repository, provider, or destination | Explicit bounded adapter arguments; core treats source text only as data |
| Public PR reaches credentials or persistent infrastructure | Hosted read-only PR CI with no secrets, environments, or private checkout |
| Path traversal, overwrite, or unsafe archive behavior | Canonical relative paths, new-file writes, bounds, archive inventory |
| Real or re-identifiable private material enters history | Independently synthetic fixtures, identifier scanning, human disclosure review |
| Mutable or compromised build dependency | Lockfile, immutable workflow references, human-reviewed updates, no lifecycle hooks |
| Silent contract downgrade | Explicit contract/schema versions and visible incompatibility errors |
| Nondeterministic canonical output | Injected time/policy/taxonomy and byte-stability tests |
| Accidental overclaim in documentation | Release scope tied to tested supported contracts |

## Non-goals

The public core does not authenticate provider accounts, schedule jobs, send messages, apply to opportunities, mutate trackers, or store canonical personal evidence.
