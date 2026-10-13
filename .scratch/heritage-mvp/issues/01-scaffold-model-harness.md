# 01: Scaffold + core domain model + test harness

**What to build:** A runnable bun project with the Heritage domain model (Person/Family/Event/Place/Note/Source/Media, ExternalId/Extension/ImportReport) and a green `bun test` harness, so every later slice has somewhere to land and a seam to test at.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `bun install` / `bun dev` / `bun run build` / `bun test` all work from a fresh clone
- [x] Domain types match spec §Implementation Decisions (internal ids, XREFs transient, sex M/F/X/U, first-preferred on multiples, isLiving/private flags)
- [x] One demoable vertical path: create a person + child relationship in code/API and assert it via `bun test` (seam 1)
- [x] Web/ADR decision recorded: minimal harness choice + fixture convention for `.ged` fixtures

## Comments

- 2026-10-12: implemented — package.json/tsconfig, src/domain/{types,tree}.ts, src/index.ts, tests/domain.test.ts (3 pass), docs/adr/0001. Verified: bun install / bun test (3 pass) / bun run typecheck / bun run build / bun src/index.ts all green on bun 1.3.14.
