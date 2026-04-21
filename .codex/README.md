# Codex Integration

This directory contains Codex-native support for Career-Ops.

Codex CLI currently has built-in slash commands for controlling the session.
Project-defined Career-Ops commands are provided as a Codex skill instead:

```text
$career-ops
$career-ops scan
$career-ops tracker
$career-ops pdf
$career-ops https://example.com/job
```

In Codex surfaces that show enabled skills in the slash menu, the Career-Ops
skill appears there after installation.

## Install Locally

From the repo root:

```bash
mkdir -p ~/.codex/skills
cp -R .codex/skills/career-ops ~/.codex/skills/
```

Restart Codex after installing so the skill metadata is reloaded.
