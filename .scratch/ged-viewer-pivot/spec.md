# Spec: GED viewer and explorer pivot

**Status:** ready-for-agent

Source: grilling session of 2026-10-14. Decisions recorded in `docs/adr/0004-pivot-viewer-and-explorer-first.md` and `docs/adr/0005-browser-holds-the-file.md`.

## Problem Statement

Someone downloads a `.ged` file from Ancestry, MyHeritage, or FamilySearch. They want to understand it: who is in it, which branches connect, what the importer could not read, and which chart they can print for relatives. Today's tools bury the file inside accounts, subscriptions, or editors. The file is also fragile: the server holds one tree in memory, and a host sleep wipes it. The user loses the file and must upload it again.

## Solution

Heritage becomes a `.ged` viewer and explorer. The first screen asks for a file. The browser stores that file and restores it on every visit; the server keeps nothing durable. The user explores a readable tree: collapse and expand branches with counts, navigate with an outline panel, and always see a permanent file health panel (version, encoding, record counts, warnings). The viewer exports exactly what is on screen: "Print / Save as PDF" and "Download SVG", both vector, both sharp when zoomed. Editing stays available behind a settings toggle but does not grow. Export GEDCOM keeps its current options.

## User Stories

### File intake

1. As a visitor, I want the first screen to ask for a `.ged` file, so that I start with my own file.
2. As a visitor, I want drag-and-drop and a file picker, so that import takes one action.
3. As a user, I want my file stored in my browser, so that the server never saves it and a host sleep cannot lose it.
4. As a returning user, I want the app to restore my file automatically on every visit, so that I never re-upload by hand.
5. As a user, I want to load a new file that replaces the old one, so that one session holds one tree.
6. As a user, I want a clear message when my browser storage is full, so that I know why restore fails.
7. As a user, I want the import to work without an account, so that nothing stands between me and my file.

### Exploration

8. As an explorer, I want the family view with zoom, pan, and a fit-to-view control, so that I see the whole tree or one branch.
9. As an explorer, I want pedigree and fan views, so that I study ancestry in different shapes.
10. As an explorer, I want placeholder cards for collapsed branches with a name and hidden counts, so that dense trees stay readable.
11. As an explorer, I want to expand or collapse a branch to a chosen depth in one action, so that I control how much I see.
12. As an explorer, I want an outline panel beside the canvas, so that I navigate the tree like a file explorer.
13. As an explorer, I want to click any outline entry to refocus the canvas on that person, so that I follow a branch without searching.
14. As an explorer, I want person search that highlights matches and dims the rest, so that I find a person fast.
15. As an explorer, I want double-click on a person to refocus the branch there, so that exploration stays in one place.
16. As an explorer, I want a detail drawer with parents, partners, and children, so that I understand one person in context.
17. As an explorer, I want keyboard access to every person card, so that I can explore without a mouse.
18. As an explorer, I want the view to open centered on the focus person, so that I never start lost in a corner.
19. As an explorer, I want sibling and depth controls, so that I trade completeness for clarity.

### File health

20. As a user, I want a permanent file health panel with GEDCOM version, encoding, record counts, and warnings, so that I always know what the app read.
21. As a user, I want the health panel one click away from every view, so that I never hunt for it.
22. As a user, I want the same report right after import, so that I see problems at the moment they matter.
23. As a user, I want lenient import of real-world files (bad encodings, malformed lines, unknown tags, GEDCOM 5.5 to 7), so that my file loads anyway.
24. As a user, I want every warning to name the record and the problem, so that I can fix the file elsewhere.
25. As a user, I want a truncated-view notice that states the limit and offers controls, so that I know the view is partial and why.

### Export

26. As an explorer, I want a "Print / Save as PDF" button on the viewer, so that I get a vector PDF of the current view.
27. As an explorer, I want the printed page to fit the chart and carry a title with the focus person and date, so that the chart is presentable.
28. As an explorer, I want a "Download SVG" button, so that I get a scalable copy of the same view.
29. As an explorer, I want both exports to show exactly what is on screen, so that nothing surprises me.
30. As an explorer, I want the export to stay sharp when zoomed, so that names remain readable at any size.
31. As a user, I want GEDCOM export to keep its current options (living redaction, media links, branch), so that I can share files safely.
32. As an editor, I want to keep my work by exporting GEDCOM and loading that file again, so that edits become permanent without a server database.

### Positioning and editing

33. As a visitor, I want primary navigation to show Explore, Import, and Export only, so that the app reads as an explorer.
34. As an editor, I want editing behind a settings toggle, so that editing stays available but out of the way.
35. As an editor, I want editing to keep working within a session, so that small fixes are possible before export.
36. As an editor, I understand that edits live only until the server sleeps, so that I export GEDCOM when I want to keep them.

### Scale

37. As a user with a large file, I want import to succeed under the visible-people cap, so that big trees still open.
38. As a user with a large file, I want expand and collapse to page through the tree under the cap, so that I still reach everyone.

## Implementation Decisions

- **Explore is the main job.** No new editing features. Editing routes keep working and stay behind a settings toggle. Primary navigation: Explore, Import, Export.
- **The browser holds the raw `.ged` file** in browser storage. On each visit, if the server has no tree, the browser re-sends the stored file to the import route. The server keeps only a transient RAM copy. No disk, no database (ADR-0005).
- **No mirror.** The stored file is the file the user imported. Edits mutate the RAM copy only. The user keeps edits by exporting GEDCOM and loading that file again. This decision was made today to avoid per-navigation cost on a demoted feature.
- **One file at a time.** A new import replaces the stored file and the RAM tree.
- **Session status endpoint.** A small JSON endpoint reports whether the server holds a tree, so the restore script knows when to re-send the stored file.
- **First screen.** The home route renders a drop zone. After import, the app opens the explorer. With a live tree in RAM, the home route goes straight to the explorer.
- **File health page.** A dedicated page renders version, encoding, record counts, and the full warning list from the import report. It is linked from the viewer and reachable without query parameters. The post-import report panel stays.
- **Placeholder cards.** The layout engine emits placeholder nodes for collapsed branches. Each placeholder carries a display name and hidden descendant and ancestor counts.
- **Collapse to depth.** The existing depth, sibling, and per-branch expand controls gain one action: collapse or expand a branch to a chosen depth.
- **Outline panel.** The viewer gains a side panel with a hierarchical list of the focused branch, with hidden counts, click to refocus. The server returns outline data from the same layout pipeline that feeds the canvas.
- **PDF by print stylesheet.** The viewer gains a print stylesheet and a print button. The browser Print dialog produces the vector PDF. The print page fits the current view and carries a title (focus person, view mode, date). Zero new dependencies (ADR-0001).
- **SVG download.** The viewer serializes the current on-screen SVG and triggers a download. Filename carries the focus person and the date.
- **Scale caps stay.** Visible-people, sibling, and depth caps stay as they are. The truncation notice improves and offers the existing controls.
- **No front-end build step.** Client behavior stays small vanilla scripts served with the page, as today.
- **Deferred, as future tickets, not forgotten.** Outline panel polish beyond click-to-refocus; GEDCOM 7 body export; streaming import for 100k+ records; PDF export options (living redaction, branch limit); a browser file library; shareable links; a direct "Download PDF" button behind a client library.

## Testing Decisions

- **Good tests check external behavior only:** HTTP status, response body markers, JSON shapes, layout geometry numbers, and export fixed points. No assertions on internals.
- **Primary seam (existing): the HTTP app seam.** Tests call the app's fetch handler and inspect responses. Prior art: the app behavior test suite. New assertions: drop zone on home, restore script markers, session status JSON, file health page content without query parameters, outline JSON shape, print and SVG button markers, navigation without edit links, edit routes still working behind the toggle.
- **Layout seam (existing, pure):** tests call the layout function and check geometry. Prior art: the views test suite. New assertions: placeholder nodes exist for collapsed branches with correct counts, collapse-to-depth produces the expected node set, caps still hold.
- **Import/export seam (existing, unchanged):** the round-trip fixed-point tests stay green. The mirror rejection means no new export behavior.
- **One new seam (pure helpers):** the client decision logic (has stored file, needs restore, storage full) is extracted as pure functions and tested with a mock storage object under the standard test runner. No browser automation.
- **Manual verification, noted in the ticket:** the print dialog output and SVG file open correctly in a browser. This is visual and stays out of automated tests.

## Out of Scope

- Mirroring edits back into browser storage (rejected today: cost on every navigation, protects a demoted feature).
- Any new editing feature, and any removal of existing editing code.
- GEDCOM 7 body export.
- Streaming or chunked import for 100k+ records.
- PDF export options such as living redaction or branch limits.
- A browser file library or multiple concurrent trees.
- Shareable or durable URLs.
- A direct "Download PDF" button behind a client PDF library.
- Databases and any durable server storage of user files.
- Browser automation test harness.
- Accounts, authentication, and multi-user features.

## Further Notes

- ADR-0004 records the pivot; ADR-0005 records the persistence model. Read both before changing positioning or storage.
- `GLOSSARY.md` defines **File health**. Use that term in code, UI copy, and tickets.
- All responses and explanations in this repo follow ASD-STE100 Simplified Technical English (rule added to `AGENTS.md`).
- The deferred list in Implementation Decisions becomes future tickets after this pivot ships.
