# Public CI trust boundary

Public pull requests are untrusted. Validation runs only on fixed GitHub-hosted runners with read-only token permissions, no secrets, no protected environments, no alternate repository checkout, and no persistent credentials.

## Required controls

- every workflow declares explicit read-only or disabled permissions;
- every concrete job uses an approved fixed hosted runner and a timeout of at most 60 minutes;
- workflow concurrency cancels superseded runs;
- external actions and reusable workflows use full commit SHAs;
- Docker actions and job containers use immutable SHA-256 digests;
- checkout cannot select another repository and sets `persist-credentials: false`;
- `pull_request_target`, pull-request secrets, protected environments, workflow-driven auto-merge, and install lifecycle scripts are prohibited;
- untrusted issue, discussion, comment, review, or pull-request text cannot be interpolated into shell commands;
- release commands require trusted push-tag triggers and explicit job-level tag guards.

`scripts/workflow-policy.mjs` parses the workflow YAML into a structured model before applying these rules. Unsupported YAML directives, aliases, anchors, tags, and merge keys fail closed rather than bypassing the policy model.

## Dependency updates

Dependabot opens grouped weekly GitHub Actions and npm update pull requests. Updates receive the same CI and dependency-review checks as other pull requests. No workflow has permission or commands to auto-merge them.
