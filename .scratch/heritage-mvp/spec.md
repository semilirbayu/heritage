# Spec: Heritage MVP — tree maker + GED import/export

**Status:** ready-for-agent

Source research: `docs/research/heritage-requirements.md`.

## Problem Statement

Family historians with MyHeritage-style trees have no minimal, local-first clone for the core job: build/edit a family tree (people, relationships, facts, media), import an existing `.ged` file, and export it back out (GEDCOM + printable charts). Existing tools tie this to subscriptions, desktop apps, or lossy GED handling (dropped NOTEs, broken encodings, lost `_` tags, no living filter).

## Solution

A bun-based web app that delivers the P0 loop: create/edit people and typed relationships with facts/events and photo links, view Family + List, import GEDCOM 5.5/5.5.1/7.x leniently with an ImportReport, and export GEDCOM 5.5.1 with round-trip fidelity plus living-person redaction. Pedigree/Fan/Timeline, PDF/PNG/SVG charts, and consistency checks follow in P1.

## User Stories

1. As a tree owner, I want to create a person with names/gender/birth/death, so that they appear in my tree.
2. As a tree owner, I want to add a parent/spouse/child/sibling to a person, so that relationships grow the tree.
3. As a tree owner, I want to add a second partner and set relationship status/divorce, so that remarriage is modeled.
4. As a tree owner, I want to attach/detach existing people (spouse/parent/child), so that I fix wrong links without duplicating.
5. As a tree owner, I want to set parent type (biological/adoptive/foster), so that non-bio relations are explicit.
6. As a tree owner, I want to mark someone deceased with date/cause/place, so that living logic and ribbons are correct.
7. As a tree owner, I want to add facts (birth/marriage/death/divorce/burial + custom) with date/place, so that life events are recorded.
8. As a tree owner, I want to add/edit/delete a fact's notes, citations, and photos, so that evidence stays with the event.
9. As a tree owner, I want a biography + research notes per person, so that narrative context survives.
10. As a tree owner, I want name pieces (given/surname/prefix/suffix/nick/alternates), so that GEDCOM names round-trip.
11. As a tree owner, I want to set a personal photo per person, so that cards are recognizable.
12. As a tree owner, I want media stored as links with a sidecar folder, so that GEDCOM text-only limits are respected.
13. As a tree owner, I want a Family view (cards + lines, zoom/pan), so that I can navigate and edit in place.
14. As a tree owner, I want a List view (filter by surname, sort by name/birth/death), so that I can find anyone.
15. As a tree owner, I want to import a `.ged` file (5.5/5.5.1/7.x) via upload/drag-drop, so that existing trees come in.
16. As a tree owner, I want an ImportReport (version/encoding/counts/warnings), so that I trust what imported.
17. As a tree owner, I want malformed/legacy files to import leniently (bad levels, unknown tags, ANSEL/UTF-16, missing TRLR), so that real-world files don't fail.
18. As a tree owner, I want NOTEs (CONC/CONT), SOUR/REPO, and `_` extensions preserved, so that nothing silently drops.
19. As a tree owner, I want to export the full tree or a branch to GEDCOM 5.5.1 UTF-8, so that other tools can read it.
20. As a tree owner, I want export to include photo links on request, so that media references survive.
21. As a tree owner, I want a living-person filter (Living/surname-only/exclude + drop private facts/media) on export, so that sharing is safe.
22. As a tree owner, I want round-trip counts to verify (individuals/relationships/dates), so that I know export is faithful.

## Implementation Decisions

- Modules: domain model (Person/Family/Event/Place/Note/Source/Media + ExternalId/Extension/ImportReport), tree editor, GED importer, GED exporter, Family/List views. No file paths in this spec.
- Person shape: ids internal (XREFs transient, never exposed as stable IDs); names[] with display/given/surname/prefix/suffix/nick + alternates (first preferred); sex enum M/F/X/U with unknown default, never inferred from HUSB/WIFE; events[] 1:M (first preferred on conflicts); famc[]/fams[] mirroring FAM links; isLiving + private flags from day one.
- Family shape: partners[] (0-2+, any gender), children[], marriage/divorce date+place; single-parent valid; divorce is a couple fact reflected on both partners.
- Event shape: type + dateRaw + normalized {qualifier, range, calendar} + place + notes[] + sources[]; DATE grammar `D MMM YYYY` + partials + modifiers (ABT/CAL/EST/BEF/AFT/BET/ FROM/TO, dual dates); PLAC free-text low→high + optional parts, no geocoding on import.
- Import: detect version from HEAD.GEDC.VERS, forward-tolerate 7.x extensions; encoding sniff BOM → UTF-8 strict → ANSEL/Windows-1252 fallback, store Unicode normalized + rawEncoding/hadBOM; three phases lex → build → resolve; clamp level jumps, skip blanks, cap nesting, join bare NOTE continuations; reconcile FAMC/FAMS ↔ HUSB/WIFE/CHIL; deduplicate XREFs (first wins); stream for 100k+ INDI; never reject on warnings unless strict mode.
- Export: emit 5.5.1 + LINEAGE-LINKED by default, UTF-8 with BOM option; HEAD with SOUR/VERS/NAME/CORP/DEST/DATE/CHAR/GEDC/SUBM/FILE/LANG/PLAC.FORM; record order HEAD → records → TRLR; DATE upper-month formatting; PLAC obeying PLAC.FORM blanks; media as FILE path + FORM + TITL (sidecar folder, rewritten paths); `_` tags preserved with SCHMA documentation path for 7.0; 7.0/GEDZIP as P1 option.
- Views v1: Family (cards + lines, zoom/pan, in-place add/edit) + List (filter/sort). Pedigree/Fan/Timeline deferred to P1.
- Stack: bun + `bun test`; web framework undecided — first ticket picks minimal harness and records it in an ADR.
- Privacy: default no-evidence → living; redaction retains family links.

## Testing Decisions

- Good tests assert external behavior (person created, relationship linked, GED round-trips, list filters), not implementation details or snapshots.
- Seams (agreed with user):
  1. Pure domain functions (createPerson, addRelationship, parseGEDCOM, emitGEDCOM) via `bun test` — highest seam, most coverage here.
  2. Importer → model → exporter round-trip (file in → counts match → file out parses) with fixture `.ged` files.
  3. UI behavior for Family/List (add/edit/filter flows), not snapshot tests.
- Prior art: none yet (empty repo); first ticket establishes `bun test` harness + fixture convention.
- Round-trip gate: individuals/relationships/dates/NOTEs/`_` tags survive import→export; validator warnings recorded in ImportReport.

## Out of Scope

- Pedigree/Fan/Timeline views, PDF/PNG/SVG chart export, GEDZIP/7.0 emit (P1).
- Consistency checker, hints/SmartMatch, DNA, search, invites/collaboration, multi-user ACLs, mobile.
- Geocoding places, record matching, photo bytes inside GEDCOM.

## Further Notes

- MyHeritage UX precedents (async import/export with email, branch vs full export, `include photos` toggle) inform flows but async/email is P1; v1 may be synchronous with progress for large files.
- Compat targets for round-trip testing: MyHeritage, Ancestry, FamilySearch (≤100MB/100-name compare limits noted in research).
- Vendor tags (`_RTLSAVE`, `_APID`, `_FSID`, …) preserved but not interpreted in v1.

## Comments

- 2026-10-12: spec synthesized from conversation + docs/research/heritage-requirements.md; seams + 4-ticket split approved by user (merged from 7).
