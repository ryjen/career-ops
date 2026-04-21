# Resume Overlay System

This folder stores local, machine-readable resume overlays for Career-Ops.

The model is:

```text
BASE = cv.md truth source + neutral framing
OVERLAY = reusable emphasis layer
CUSTOM = single-company output in reports/ and output/
```

Overlays are not Google Docs and should not be full resume copies. They are
instructions for how to tailor `cv.md` without drift.

## Invariants

Do not change these facts through an overlay:

- Name, contact, and links
- Companies, dates, and roles
- Core experience scope
- Technologies actually used
- Metrics and proof points

Allowed changes:

- Title and strategic axes
- Summary framing
- Competency ordering
- Bullet ordering and emphasis
- Minor wording shifts that preserve meaning
- Project ordering

## Drift Rules

Every tailored resume must pass these checks:

- No fabricated skills
- No direct mirroring of job-description language
- No ownership inflation
- No contradiction between title, axes, summary, competencies, and bullets
- Keep the generated PDF to 2 pages when possible

## Overlay Selection

Use `resolve-resume-overlay.mjs` with a saved JD:

```bash
node resolve-resume-overlay.mjs jds/example.md
node resolve-resume-overlay.mjs --json jds/example.md
```

The resolver scores overlays using `match_keywords`. The top overlay should be
used as the primary content layer. A second overlay may influence wording, but
do not stack many overlays unless the JD genuinely requires it.

## Promotion Rules

- Promote custom wording into an overlay only when it is reusable across several
  materially different roles.
- Promote overlay wording into `cv.md` only when it improves the general resume
  without role-specific bias.
- Never edit `cv.md` to satisfy one posting.
