# Compatibility policy

## Runtime

The package supports Node.js 20 or newer and publishes ESM exports. CommonJS consumers use dynamic `import()` from an adapter boundary.

## Version dimensions

- package version follows semantic versioning after the first supported release;
- each public contract carries its own contract and schema version;
- taxonomy or policy versions are explicit when they affect output;
- implementation provenance identifies the code release separately from data-contract identity.

## Breaking changes

A breaking contract change requires a new contract/schema version, migration documentation, and a deprecation window when an earlier supported version exists. Package-major changes do not silently rewrite stored data.

## Deprecation

Deprecated exports or contracts remain documented until their announced removal release. Security fixes may shorten a deprecation window when retaining behavior creates material risk.
