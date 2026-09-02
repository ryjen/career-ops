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

## Toolchain

The repository flake is the only project toolchain definition. Hosted runners bootstrap a fixed Nix 2.35.2 installer through an immutable action reference; they do not bootstrap Node, npm, Git, GitHub CLI, or `mise` independently.

`flake.lock` pins nixpkgs, and project commands run through `nix develop --no-update-lock-file`. CI evaluates the flake with `nix flake check --no-build --no-update-lock-file` before package verification. This prevents CI from silently changing either the Nix evaluator or project toolchain inputs while preserving the hosted-runner boundary required for untrusted public pull requests.

## Dependency review

Public pull requests first invoke GitHub's pinned official dependency-review action. Some new repositories do not yet have the GitHub dependency graph enabled. The workflow may tolerate failure from that one exact action only when all of these safeguards are present:

- the action has the approved immutable commit identity and `id: dependency-review`;
- checkout fetched full history without persisting credentials;
- a later step runs only when `steps.dependency-review.outcome == 'failure'`;
- the fallback base ref comes only from `github.base_ref`;
- `scripts/dependency-diff.mjs` validates both package/lock states and reports the deterministic dependency delta.

The fallback rejects package/lock drift, local, Git, workspace, URL, SSH, and other non-registry dependency sources, non-npm registry lock resolutions, and missing lockfile integrity metadata. It does **not** replace GitHub advisory or license analysis. A supported release therefore still requires the complete dependency and license report tracked by the disclosure and release gates.

Any other `continue-on-error` setting is rejected by policy.

## Dependency updates

Dependabot opens grouped weekly GitHub Actions and npm update pull requests. Updates receive the same CI and dependency-review checks as other pull requests. `flake.lock` updates are explicit repository changes and receive the same review and CI gates. No workflow has permission or commands to auto-merge them.
