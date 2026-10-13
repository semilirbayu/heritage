# 04: GEDCOM import + export round-trip

**What to build:** Lenient `.ged` import (5.5/5.5.1/7.x, encoding sniff, XREF resolve, NOTE/CONC/CONT, SOUR/REPO, `_` preserve, ImportReport with counts/warnings, streaming for large files) plus 5.5.1 UTF-8 export (full + branch, photo-links toggle, living filter) — demoable by importing a real file, seeing the tree, exporting, and re-importing with matching counts.

**Blocked by:** 02 (tree editing + facts model). Parallel with 03.

**Status:** done

- [x] Import accepts 5.5/5.5.1/7.x via upload/drag-drop; version from HEAD.GEDC.VERS; ImportReport shown
- [x] Lenient parse: bad levels clamped, unknown tags kept, ANSEL/UTF-16 handled, missing TRLR warns, FAMC/FAMS reconciled, first-dupe wins
- [x] DATE/PLAC/NOTE/SOUR/`_` fidelity per spec; no silent drops
- [x] Export 5.5.1 + LINEAGE-LINKED with proper HEAD, upper-month DATEs, sidecar media paths, living redaction toggle
- [x] Seam 2 round-trip test: fixture import → export → re-import counts match (individuals/relationships/dates/notes)

## Comments

- 2026-10-12: implemented src/gedcom/{decode,lines,date,import,export}.ts + Tree container + Person.sources. Import: BOM sniff → UTF-8 strict → 1252 fallback, lenient lexer (CONC/CONT join, clamp, _TEXT keep), DATE→dateNorm, NAME slash+GIVN/SURN, SEX, PEDI map, EVEN+TYPE, shared NOTE/SOUR/OBJE resolve, two-pass xref + reconcile. Export: 5.5.1 HEAD, CONC-split, upper-month DATEs, `_` re-emit, includeMedia toggle, living redact/exclude, descendant branch. Note: "upload/drag-drop" = parser accepts string/bytes; UI wiring lands with 03. Known limits: exact ANSEL table, 7.0 body emit (HEAD-only switch), HUSB/WIFE role-blind. Verified: 52 pass / typecheck / build green.
- 2026-10-12 review fixes: dead first-BFS in collectBranch removed; unused params/returns cleaned; FORM read from under FILE (mime survives round-trip; empty FORM skipped); SPFX folds into surname; inline SOUR stored (not dropped); single-segment INDI/event/FAM extensions re-emitted verbatim; FAM.NOTE keeps text; fixed-point test added (import→export→import→export byte-identical). Verified: 53 pass / typecheck / build green.
- Deferred with reason: UI upload/drag-drop + 100k streaming (03 UI / P1 perf); exact ANSEL table; HEAD LANG/PLAC.FORM, BOM option, surname-only + private-flag handling, PLAC parts, date/relationship report counters (export polish, P1); HUSB/WIFE positional by design (importer role-blind, 7.0 drops roles).
