# Security policy

## Supported versions

Security fixes target the latest supported release. Before the first supported release, fixes apply to `main`.

## Reporting a vulnerability or accidental disclosure

Use GitHub private vulnerability reporting when it is available. Otherwise, open a minimal issue requesting a private contact channel without including exploit details, personal data, credentials, private paths, or sensitive attachments.

Do not place secrets or private evidence in issues, pull requests, comments, Actions logs, fixtures, or screenshots.

## Security boundaries

- public pull-request code must run without secrets or private infrastructure;
- source text cannot select commands, capabilities, paths, repositories, providers, or destinations;
- package lifecycle scripts are prohibited by default;
- provider integrations and mutation authority are outside the public core;
- unknown contract fields and unresolved disclosure findings fail closed.

See `docs/threat-model.md` for the maintained threat model.
