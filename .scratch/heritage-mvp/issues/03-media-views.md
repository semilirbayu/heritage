# 03: Media links + Family/List views

**What to build:** Photo/media handling plus the two v1 views: personal photo per person, media as links with sidecar-folder convention, Family view (cards + lines, zoom/pan, in-place add/edit) and List view (surname filter, name/birth/death sort) — demoable by opening a tree, seeing photos, and navigating.

**Blocked by:** 02 (tree editing + facts).

**Status:** done

- [x] Personal photo set/replaced per person with title/date/place; media links (never bytes in GED path)
- [x] Family view renders cards + relationship lines with zoom/pan and in-place add/edit entry points
- [x] List view lists all individuals with surname filter + sorting by name/birth/death
- [x] Seam 3 behavior tests for view flows (no snapshots); media-link round-trip stub ready for ticket 04

## Comments

- 2026-10-12: implemented src/domain/media.ts (addMedia/setPersonalPhoto/personalPhoto/sidecar), src/views/{family,list}.ts (pure layout + filter/sort), src/app/{app,pages}.ts + src/main.ts (Bun.serve, zero new deps). Full person CRUD, GED upload with ImportReport, option-driven .ged download. Media round-trip needed no stub — 04 already covers links end to end. Zoom is server-side ?zoom= (client canvas P1). ADR-0002 recorded. Verified: 69 pass / typecheck / build green, dev server 200 on / and /list.
- 2026-10-12 review fixes: photo form + handler carry date/place; server-side pan (?dx/?dy + links) + root Focus selector; URL media renders <image> thumbnails on cards; private checkbox saves; sidecar wired into export FILE (idempotent); year sort uses onset year; str() + personOptions + node-lookup dups removed. Verified: 71 pass / typecheck / build green.
- 2026-10-12 viewer review fixes: parseDepth shared + validated (NaN/negative → full tree); kinOf() domain helper replaces duplicated kin derivations in API + person page; per-card ＋ add-kin links + drawer Add-kin/Refocus actions restore in-viewer entry points; URL-photo <image> thumbnails on cards; root/depth URL-synced via replaceState; nodeById rename. Verified: 77 pass / typecheck / build green, live Kikuyu-town-tested API + viewer JS syntax OK.
- 2026-10-12 UX redo (user feedback): redesigned shared shell, tree canvas/cards/drawer, People table, person record, and Import/Export screens; viewer now lays out ancestors above, siblings alongside, and descendants below the focus. Added initials avatars, focused-person search/highlighting, fit/zoom/pan, mobile layouts, clearer forms and empty states. ADR-0002 updated. Visual checked at desktop + iPhone-sized viewport; 77 tests/typecheck/build pass.
- Earlier pushbacks (kept): import/export UI is the deferred-04 wiring landing here as planned; list display-fallback + birth-place column are MyHeritage parity; prior descendant-only layout decision was superseded by the UX redo; placeRaw→place matches addFact/setDeceased convention.
- 2026-10-13 tree-correctness pass on supplied file (screenshots): fixed single-child buses rendering as disconnected stubs (bus bar now always spans anchor→kids); fixed name-wrapper splitting on the letter "s" from a template-literal escape collapse (two-line names now render); verified every on-screen couple is a real couple (incl. Saridjan+Tanirah) with zero false partner bars; per-person sibling expansion (aunts/uncles via drawer) + siblingCount API; taller cards. 91 tests/typecheck/build pass, live-verified with Playwright screenshots.
- 2026-10-13 card/layout pass: cards now size to content (84 px one-line, 104 px two-line, rows take tallest so padding/wires stay consistent); drop lines start on the couple bar itself; focus card emphasized; server-side name wrapping (single source, client helper deleted). 94 tests/typecheck/build pass, re-verified live on supplied file.
- 2026-10-13 density pass: photos off by default (monograms stay; toggle in settings), gaps widened (56 px horizontal, 80 px vertical), family default is 5 generations with siblings shown (22 cards on the supplied file vs 5 before), unchecking siblings now sticks via explicit param. 94 tests/typecheck/build pass, Playwright-verified.
- 2026-10-13 MH-reference pass: photos fully off by default (no avatar at all); full-bleed canvas (no max-width contain, taller viewport); family default is the whole branch with aunts/uncles everywhere (50 cards on supplied file); sibling groups separated by extra gaps + gold highlight on select; every decision per MyHeritage help (couple bars + bus drops, left panel, bottom-right zoom, 5+ generations, branch focus). 96 tests/typecheck/build pass, Playwright-verified (deviation noted: MH shows photos by default; user override).
