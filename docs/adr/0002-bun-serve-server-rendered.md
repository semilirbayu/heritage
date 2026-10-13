# ADR-0002: Bun.serve + server-rendered HTML, no client framework

**Status:** accepted (2026-10-12, ticket 03)

## Context

Ticket 03 needs Family/List views with in-place add/edit entry points plus the
upload/download wiring the GEDCOM layer (ticket 04) is waiting for. ADR-0001
deferred the web-framework choice here. Constraints: bun-only, zero new
dependencies if possible, seam-3 behavior tests without snapshots.

## Decision

- **Runtime:** `Bun.serve`, entry `src/main.ts` (`bun dev` serves it; `src/index.ts` stays the library entry for `bun run build`).
- **Rendering:** server-side HTML strings (`src/app/pages.ts`) plus a small inline vanilla-JS viewer; no client framework or new dependency. Family, Pedigree, and Fan share an SVG canvas backed by JSON endpoints; List remains a table. The Family view supports drag-pan, wheel/button zoom, fit, focused-person search, branch navigation, sibling visibility, collapsible descendant families, and a person-details drawer. Pedigree and Fan show ancestor-only paths. The layout indexes family links once, wraps cards into four-column rows, and caps requests at 500 visible people.
- **View logic stays pure** (`src/views/family.ts` layout, `src/views/list.ts` filter/sort) so seam-3 tests assert geometry/rows, never markup snapshots.
- **HTTP behavior tests** call the router's `fetch` directly (`createApp(store).fetch`), no listening socket.
- **State:** in-memory singleton Tree. Persistence = GEDCOM import/export files (multi-user/store deferred, as specced).
- **Media:** links only; relative paths resolve under `media/` sidecar (`SIDECAR_DIR`); personal photo = `mediaIds[0]`; prior photo kept as a regular link on replace.

## Consequences

- `bun dev` serves the app (verified 200 on `/`, `/list`); `bun test` covers view models and HTTP behavior; no new dependencies.
- Full person CRUD (edit/facts/relations/detach/photo/notes), GEDCOM upload with ImportReport, and option-driven `.ged` download all work end to end.
- Large Family trees start as a focused one-generation branch, can reveal siblings and additional generations, collapse spouse-family branches together, and cap at 500 rendered people per request. The focused-person selector searches on demand rather than rendering every person as an HTML option.
- P1 leaves: Timeline, color-coded lineage, persistent/multi-user store, poster PDF/PNG/SVG export.
