---
name: career-ops
description: AI job search command center for the career-ops repo. Use when the user asks to run career-ops, evaluate a job URL or job description, scan portals, process the pipeline, generate a tailored CV/PDF, inspect the tracker, compare offers, prepare outreach, research a company, review training or project ideas, analyze patterns, manage follow-ups, or help with an application without submitting it.
metadata:
  short-description: Route Career-Ops job search workflows
---

# Career-Ops for Codex

This skill is the Codex entrypoint for the Career-Ops project. It mirrors the
Claude/OpenCode/Gemini command set while reusing the checked-in `modes/*`
files, scripts, templates, and tracker flow.

## First Steps

1. Confirm the current workspace is the `career-ops` repo. If not, ask the user
   to open Codex in that repo.
2. Read `AGENTS.md`, then `CLAUDE.md`.
3. Run `node update-system.mjs check` silently. Only mention the result when it
   reports `update-available`.
4. Check onboarding files before executing workflows:
   - `cv.md`
   - `config/profile.yml`
   - `modes/_profile.md`
   - `portals.yml`
5. If `modes/_profile.md` is missing and `modes/_profile.template.md` exists,
   create it from the template. If required setup files are missing, follow the
   onboarding flow in `CLAUDE.md`.

## Routing

Treat `$career-ops <mode>` the same as `/career-ops <mode>` in the original
docs. If the user invokes this skill without a mode, show the command menu.

| User input | Mode |
| --- | --- |
| no args | discovery |
| job URL or JD text | auto-pipeline |
| `pipeline` | pipeline |
| `oferta`, `evaluate` | oferta |
| `ofertas`, `compare` | ofertas |
| `contacto`, `contact` | contacto |
| `deep` | deep |
| `pdf` | pdf |
| `latex` | latex |
| `training` | training |
| `project` | project |
| `tracker` | tracker |
| `apply` | apply |
| `scan` | scan |
| `batch` | batch |
| `patterns` | patterns |
| `followup` | followup |

Auto-pipeline detection: if the input is not a known mode and includes a URL or
JD language such as "responsibilities", "requirements", "qualifications",
"about the role", or "we're looking for", run `auto-pipeline`.

## Context Loading

For these modes, read `modes/_shared.md` plus the mode file:

- `auto-pipeline` -> `modes/auto-pipeline.md`
- `oferta` -> `modes/oferta.md`
- `ofertas` -> `modes/ofertas.md`
- `pdf` -> `modes/pdf.md`
- `latex` -> `modes/latex.md`
- `contacto` -> `modes/contacto.md`
- `apply` -> `modes/apply.md`
- `pipeline` -> `modes/pipeline.md`
- `scan` -> `modes/scan.md`
- `batch` -> `modes/batch.md`

For these standalone modes, read only the mode file:

- `tracker` -> `modes/tracker.md`
- `deep` -> `modes/deep.md`
- `training` -> `modes/training.md`
- `project` -> `modes/project.md`
- `patterns` -> `modes/patterns.md`
- `followup` -> `modes/followup.md`

Execute the instructions from the loaded mode file. Do not create parallel
logic.

## Discovery Menu

When no mode is provided, show:

```text
career-ops -- Codex Command Center

Use these with the Codex skill syntax:
  $career-ops {JD or URL}   -> AUTO-PIPELINE: evaluate + report + PDF + tracker
  $career-ops pipeline      -> Process pending URLs from data/pipeline.md
  $career-ops oferta        -> Evaluation only, no auto PDF
  $career-ops ofertas       -> Compare and rank multiple offers
  $career-ops contacto      -> LinkedIn outreach: find contacts + draft message
  $career-ops deep          -> Deep company research
  $career-ops pdf           -> Generate ATS-optimized CV PDF
  $career-ops latex         -> Export CV as LaTeX/Overleaf .tex
  $career-ops training      -> Evaluate course/cert against goals
  $career-ops project       -> Evaluate portfolio project idea
  $career-ops tracker       -> Application status overview
  $career-ops apply         -> Application assistant; never submit
  $career-ops scan          -> Scan portals and discover roles
  $career-ops batch         -> Batch processing
  $career-ops patterns      -> Analyze rejection patterns
  $career-ops followup      -> Follow-up cadence tracker

Tip: You can also ask in plain English, e.g. "scan my portals with Career-Ops".
```

## Guardrails

- Never submit an application on the user's behalf.
- Never add tracker rows directly to `data/applications.md`; use the TSV
  addition and `merge-tracker.mjs` flow.
- Store user customization only in `config/profile.yml`, `modes/_profile.md`,
  `article-digest.md`, or `portals.yml`.
- Do not put personalization in `modes/_shared.md`.
- For liveness checks, use the repo's Playwright/liveness flow when available.
