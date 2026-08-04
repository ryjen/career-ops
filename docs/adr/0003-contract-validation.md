# ADR 0003: Versioned JSON Schema contracts

- Status: accepted
- Date: 2026-08-04

## Decision

Use JSON Schema 2020-12 for interchange contracts. Each domain also provides a package-owned runtime validator with matching fixtures and explicit error semantics.

The bootstrap does not add a generic schema-validator dependency for one trivial contract. Reconsider a maintained validator library when additional schemas make duplicate validator logic material.

## Rules

- contract and schema versions are explicit;
- object contracts reject unknown fields by default;
- schema IDs are unique and stable;
- canonical serialization, ordering, hashing, and provenance are defined per domain;
- schema and runtime-validator conformance is tested.
