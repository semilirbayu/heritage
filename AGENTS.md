# AGENTS.md

## Project

Heritage — a `.ged` (GEDCOM) viewer and explorer.
- Explore imported family trees (people, relationships, events, media)
- Import GEDCOM (`.ged`) files; show file health and import warnings
- Export the tree view (PDF, SVG) and export GEDCOM
- Editing exists but does not grow

## Stack / Commands

- Package manager: `bun` (do not use npm/yarn/pnpm for this repo)
- Install: `bun install`
- Dev: `bun dev`
- Build: `bun run build`
- Test: `bun test`
- Lint/format: `bun run lint` / `bun run format` (if defined)

If `package.json` scripts differ, follow `package.json`.

## Conventions

- Write every response and every explanation in ASD-STE100 Simplified Technical English: short sentences (max 20 words), one idea per sentence, active voice, present tense, approved words only, no idioms.
- Keep changes minimal and focused.
- Prefer editing existing files over creating new ones.
- Do not commit secrets or `.env` files.
- Verify with `bun test` / `bun run build` when touching code.

## Agent skills

### Issue tracker

Issues tracked as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context with `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.
