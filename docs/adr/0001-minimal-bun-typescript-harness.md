# ADR-0001: Minimal bun + TypeScript harness, no web framework yet

**Status:** accepted (2026-10-12, ticket 01)

## Context

Ticket 01 needs a runnable project with a domain model and a green test seam, before any UI or GED parsing. Repo was empty (bun-only per AGENTS.md, no framework chosen).

## Decision

- Runtime + toolchain: **bun** (install/dev/build/test/typecheck via `bunx tsc`).
- Language: **TypeScript strict**, `moduleResolution: Bundler`, pure domain functions (no I/O in `src/domain/`).
- Entry: `src/index.ts` re-exports domain; `src/domain/types.ts` (shapes) + `src/domain/tree.ts` (ops).
- Tests: `bun test`, files under `tests/*.test.ts`, behavior through public ops only (seam 1).
- No web framework in ticket 01 — deferred to ticket 03, which will record its own ADR.

## Fixture convention (for ticket 04 and beyond)

- GED fixtures live under `tests/fixtures/*.ged`, one minimal file per case (e.g. `minimal-551.ged`, `couple-divorce.ged`, `ansel-notes.ged`).
- Each fixture gets a matching test asserting parse counts + ImportReport warnings, then round-trip (import → export → re-import).
- Real-world samples stay out of git; only hand-built minimal fixtures are committed.

## Consequences

- `bun install / bun dev / bun run build / bun test / bun run typecheck` all green from a fresh clone (verified 2026-10-12, bun 1.3.14).
- Later slices (editor, views, importer/exporter) land on `Person/Family/Event` shapes defined here; XREFs stay transient.
