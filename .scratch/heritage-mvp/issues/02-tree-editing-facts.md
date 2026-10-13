# 02: Tree editing + facts/events/notes/citations

**What to build:** End-to-end person and relationship editing with facts: add/edit people (names/gender/deceased/bio), typed relationships (parent/spouse/child/sibling), multi-partner + divorce couple-fact, attach/detach without dupes, bio/adoptive/foster + step flows, and facts (BIRT/MARR/DEAT/DIV + custom) with DATE/PLAC/NOTE/SOUR — verifiable through the app UI/API plus domain tests.

**Blocked by:** 01 (scaffold + model + harness).

**Status:** done

- [x] Person CRUD with name pieces, sex, deceased flag, biography + research notes
- [x] Typed add + attach/detach + multi-partner + divorce reflected on both partners + parent types
- [x] Facts with date/place/notes/citations/photos; per-fact edit/delete; custom-type fallback
- [x] Seam 1 tests: relationship ops, divorce coupling, first-preferred conflicts, no-dupe attach

## Comments

- 2026-10-12: implemented in src/domain/{types,tree}.ts — updatePerson/setDeceased/setLiving/addResearchNote; addParent(pedi)/addSibling/addPartner/detachChild/detachPartner/setDivorce (couple-mirrored DIV); addFact/updateFact/deleteFact + preferredEvent/preferredName. Person.famc evolved string[] → FamcLink[] (ticket-01 test updated). Verified: 21 pass / typecheck / build green.
- 2026-10-12 review fixes: updatePerson no longer clobbers custom display on non-name patches + prefix/suffix/nick editable; addPartner preserves existing partners (idempotent); setDivorce shares one event id + idempotent; setMarriage added (mirrors MARR); TreeEvent.cause added (setDeceased/updateFact); updateFact patches noteIds/mediaIds/sources. Verified: 28 pass / typecheck / build green.
- Deferred with reason: deletePerson needs a store module (no store yet — drop the reference; removal with link cleanup lands with the store in 03+); dateNorm parsing lands with the GED importer (04); step-relations derive from addParent/addSibling primitives, no new API.
