# Heritage — Requirements Research

Researched 2026-10-12 against primary sources (MyHeritage help/education, GEDCOM specs at gedcom.io / FamilySearch, vendor export docs). This is the input for spec/tickets, not the spec itself.

## 0. Goal / scope

Heritage clones MyHeritage's **family tree maker tools + export**, plus **`.ged` import**.

- Build / edit trees: people, relationships, events/facts, notes/citations, media
- Views: family / pedigree / fan / list (+ timeline later)
- Import: GEDCOM 5.5 / 5.5.1 / 7.x, lenient
- Export: GEDCOM 5.5.1 by default (+ 7.0 option), PDF charts, PNG/SVG
- Privacy: living-person redaction on export/share

Out of scope for v1: record hints / SmartMatch, DNA, collaboration/invites, search.

## 1. Tree maker (MyHeritage parity)

### 1.1 People CRUD
- Add via `+` on person card, pick relation (son/daughter/mother/father/partner); guided close-family setup
  - https://www.myheritage.com/help/en/articles/12851666-how-do-i-add-family-members-to-my-online-tree
  - https://www.myheritage.com/help/en/articles/12851667-how-do-i-add-family-members-to-the-tree-in-family-tree-builder
- Quick edit (pencil / Details Panel) for name/birth/death/marriage; full profile editor for everything else
  - https://www.myheritage.com/help/en/articles/12879527-how-can-i-edit-details-on-my-family-tree-from-the-pedigree-view
  - https://www.myheritage.com/help/en/articles/12851885-how-do-i-edit-someone-s-details-in-family-tree-builder
- Profile fields required: gender, first/middle/maiden/married/prefix/suffix + additional names (religious/former/nickname/named-after); birth date/place + baptism date/place/godparents; death details; deceased flag + death date/cause/place (black ribbon on card)
  - https://education.myheritage.com/article/editing-enriching-profiles-in-your-family-tree-on-myheritage/
  - https://www.myheritage.com/help/en/articles/12851991-how-do-i-mark-a-person-as-deceased-in-my-online-family-tree
- Biography = free-form life story + `Add another note` for research notes
  - https://education.myheritage.com/article/editing-enriching-profiles-in-your-family-tree-on-myheritage/

### 1.2 Relationships
- Typed add: parents / spouses / children / siblings; FTB `Edit > Parents, Spouses, Children`, right-click add
  - https://www.myheritage.com/help/en/articles/12851667-how-do-i-add-family-members-to-the-tree-in-family-tree-builder
- Multiple partners: `+ > Add another Partner`, relationship status; divorce = couple fact (adds to both, dotted line online; FTB `Status > Divorce`)
  - https://www.myheritage.com/help/en/articles/12851670-how-do-i-add-more-than-one-partner-to-my-online-tree
  - https://www.myheritage.com/help/en/articles/12852059-how-do-i-show-a-divorce-in-my-online-tree
  - https://www.myheritage.com/help/en/articles/12880588-how-do-i-add-a-divorce-in-my-tree-in-family-tree-builder
- Reuse, don't duplicate: Attach / Detach spouses / parents / children (cousin marriage, wrong-parent fix, move branch)
  - https://www.myheritage.com/help/en/articles/12851697-how-do-i-attach-and-detach-people-in-my-family-tree-builder-tree
  - https://www.myheritage.com/help/en/articles/12851349-how-can-i-attach-and-detach-spouses-in-family-tree-builder
- Parent type: biological / adoptive / foster; marriage witnesses; stepchildren / step-siblings as distinct ops
  - https://education.myheritage.com/article/editing-enriching-profiles-in-your-family-tree-on-myheritage/
  - https://www.myheritage.com/help/en/articles/12851332-how-can-i-add-a-stepbrother-stepsister-to-my-tree-in-family-tree-builder

### 1.3 Facts / events, citations
- Facts = life events (birth/marriage/death/divorce/burial/military/immigration/awards/retirement…); category + type picker + custom-type fallback; per-type date/place/photo/notes
  - https://www.myheritage.com/help/en/articles/12851888-how-do-i-enter-a-fact-in-my-family-tree-builder-tree
  - https://www.myheritage.com/help/en/articles/12879527-how-can-i-edit-details-on-my-family-tree-from-the-pedigree-view
- Per-fact notes / citations / photos; person-level `Source citations > Add new source` with upload
  - https://www.myheritage.com/help/en/articles/12878760-how-can-i-add-a-citation-note-or-photo-to-a-fact-in-my-family-tree-on-my-family-site
  - https://education.myheritage.com/article/editing-enriching-profiles-in-your-family-tree-on-myheritage/
- Full profile has 10 sections (Essentials, Family, Biography, Contact, Work, Education, Favorites, Personal, Source citations, All facts); save per section
  - https://education.myheritage.com/article/editing-enriching-profiles-in-your-family-tree-on-myheritage/

### 1.4 Media
- Personal photo per person (card thumbnail): camera icon / drag-drop / `Set as Personal Photo`, title/date/place, center in view
  - https://www.myheritage.com/help/en/articles/12851657-how-do-i-add-a-personal-photo-to-someone-in-my-online-tree
  - https://www.myheritage.com/help/en/articles/12851652-how-do-i-add-a-personal-photo-in-family-tree-builder
- Library/albums: tag people, sync to share; site accepts photos + videos (`mp4/mov/avi…`) + docs (`pdf/doc/xls/ppt/txt/zip`); scanned-doc flag
  - https://www.myheritage.com/help/en/articles/12851677-how-do-i-add-photos-to-family-tree-builder
  - https://www.myheritage.com/help/en/articles/12851269-can-i-upload-videos-or-documents-to-my-family-site
  - https://www.myheritage.com/help/en/articles/12851505-how-can-i-mark-a-scanned-photo-as-a-document-in-family-tree-builder
- GEDCOM is text-only (links, not bytes); round-trip photo links, sidecar folder for bytes
  - https://www.myheritage.com/help/en/articles/12851303-do-my-photos-transfer-with-a-gedcom-file

### 1.5 Views
- 4 views: Family, Pedigree, List, Fan (icons top-right)
  - https://www.myheritage.com/help/en/articles/12852432-what-are-the-myheritage-tree-views-and-how-can-they-be-useful-for-me
- Family: cards + lines, zoom + pan navigator
  - Large trees split across navigable branches; branch icons above cards focus the view on a person, and zoom controls remain available. Source: https://www.myheritage.com/help/en/articles/12852221-how-do-i-view-the-entire-family-tree-on-my-family-site
- Pedigree: root + direct ancestors only, 6 gens default, arrows expand
  - https://www.myheritage.com/help/en/articles/12852559-what-is-the-pedigree-view-for-family-trees
- Fan: root + ancestors, 4–10 gens (default 6), gaps show missing, surname colors
  - https://www.myheritage.com/help/en/articles/12852495-what-is-fan-view-for-family-trees
- List: all individuals, filter by last name, sort by first/last/birth/death date/place; bio basics + match column
  - https://www.myheritage.com/help/en/articles/12851616-how-can-i-view-the-list-of-names-of-the-people-in-my-tree
- Timeline (v2): lifespans on shared axis, branch colors, parent age at birth, living vs deceased bars, estimated-date fading, historical periods, 3–9 gens, PDF download + share, per-bar edit/view/research
  - https://www.myheritage.com/help/en/articles/12889322-what-is-the-family-tree-timeline-and-how-do-i-use-it
- Pedigree in-place editing: Details Panel + `Add` menu for parents/siblings/spouses/children
  - https://www.myheritage.com/help/en/articles/12879527-how-can-i-edit-details-on-my-family-tree-from-the-pedigree-view

### 1.6 Validation / consistency (v2)
- Consistency Checker precedent: dozens of checks (born before parent, photo before birth, bad year `22` vs `1922`, surname swap, place spelling) with ignore/recalc/print/settings
  - https://www.myheritage.com/help/en/articles/12852554-what-is-the-online-tree-consistency-checker

### 1.7 Collaboration / privacy (deferred, model impact only)
- Invites, site members (max 250/site), member↔person association, tree edit permissions, no per-tree per-member ACL, living-data hidden from guests, consent for living/minors
  - https://www.myheritage.com/help/en/articles/12851982-how-do-i-invite-members-to-my-family-site
  - https://www.myheritage.com/help/en/articles/12851472-how-can-i-enable-my-site-members-to-edit-my-family-tree-online
  - https://www.myheritage.com/help/en/articles/12852442-what-are-the-privacy-options-for-my-family-site
- Implication: `isLiving` + `private` flags on Person/Fact/Media from day one, even if multi-user ships later.

## 2. GEDCOM import (.ged)

### 2.1 Versions
- Accept 5.5 + 5.5.1 + 7.x; 5.5.1 mandatory, 7.x current. 5.5/5.5.1 still standard in market, 7.0 (now 7.0.18) is modernization; 7.0 imports old, not vice versa
  - https://gedcom.io/specs/
  - https://en.wikipedia.org/wiki/GEDCOM
  - https://www.familysearch.org/en/help/helpcenter/article/what-is-the-familysearch-gedcom-7-0-standard
- Detect from `HEAD.GEDC.VERS` (`5.5`/`5.5.1`/`7.0`, `FORM LINEAGE-LINKED` in 5.x); tolerate `5.5.5`/`5.5EL`; 7.x forward-tolerate unknown structs/enums as extensions
  - https://github.com/FamilySearch/Gedcom/blob/main/version-detection/version-detection.md
  - https://gedcom.io/specifications/FamilySearchGEDCOMv7.html

### 2.2 File structure
- Grammar `Level [Xref] Tag [LineVal]` e.g. `0 @I1@ INDI`; level 0 = `HEAD/TRLR/INDI/FAM/SOUR/OBJE/NOTE/SNOTE/REPO/SUBM`; single-space delimiter
  - https://gedcom.io/specifications/FamilySearchGEDCOMv7.html
  - https://gedcom.io/specifications/ged551.pdf
- Pointers `@XREF@` (`HUSB/WIFE/CHIL/FAMC/FAMS/SOUR/NOTE/OBJE/REPO`); `@VOID@` null in 7.0 only; XREFs transient, not stable IDs; `@@` escape
  - https://github.com/FamilySearch/GEDCOM/blob/main/extracted-files/grammar.abnf
- `0 HEAD` + `0 TRLR` envelope; HEAD minimal: `1 SOUR`, `1 GEDC {VERS+FORM}`, `1 CHAR` (5.x), `1 SUBM`; 7.0: `VERS 7.0`, no `FORM`/`CHAR`, optional `SCHMA`
- Line endings `CR/LF/CRLF`; 5.x ≤255 chars via `CONC/CONT`, leading whitespace ignored; 7.0 no limit, `CONT` only, no leading WS
  - https://www.gedfile.com/gedcom-format
- Encodings: 5.x `CHAR ANSEL|ASCII|UNICODE|UTF-8` (ANSEL default, accents before letter); wild `ANSI/MACINTOSH/Windows-1252`, UTF-16 BOMs, wrong `CHAR`; 7.0 UTF-8 only + optional BOM. Store Unicode normalized; keep `rawEncoding + hadBOM`. Sniff BOM, try UTF-8 strict, fall back ANSEL/1252
  - https://www.gedsite.com/en/character-encoding.htm
  - https://webtrees.net/downloads/gedcom-l-r1.pdf

### 2.3 Records
- `INDI`: `1 NAME` with `/surname/` slashes primary (`John /Smith/` → GIVN/SURN); no line-breaks; multiple `NAME` = alternates, first preferred; pieces `GIVN/SURN/NPFX/NSFX/SPFX/NICK` (+`TYPE/PHRASE/TRAN/LANG` 7.0); 5.5 nick `"Chalky"` in NAME → 5.5.1+ `2 NICK`; `FONE/ROMN` → 7.0 `TRAN+LANG`
  - https://gedcom.io/specifications/FamilySearchGEDCOMv7.html
  - https://gedcom.io/migrate
- `SEX M|F` (+`X|U` 7.0); normalize `M*→M, F*→F, X*→X else U`; never infer from `HUSB/WIFE`
- Vitals/attributes: `BIRT/CHR/DEAT/BURI/CREM/ADOP…` + `DATE/PLAC/SOUR/NOTE`, `Y` flag asserts occurrence, never `N`; multiples = conflicting opinions (keep all, first preferred); 7.0 adds `NO`, `SDATE`, `AGE`
- Links: `1 FAMC @F@` (+`PEDI/STAT`) + `1 FAMS @F@`, must mirror `FAM.HUSB/WIFE/CHIL`; `0:M` allowed; order = preference
- `FAM`: `HUSB {0:1} / WIFE {0:1} / CHIL {0:M}`; 7.0 = any partners/parents regardless of gender; missing partner = single-parent, valid; family events `MARR/DIV/ENGA/MARB/DIVF/ANUL…` + `DATE/PLAC`
- `DATE` exact `D MMM YYYY` (`2 JUN 1985`), partials valid, `JAN…DEC` upper, calendars `[GREGORIAN|JULIAN|…]`, dual `1750/51`; modifiers `ABT|CAL|EST/BEF|AFT/BET…AND/FROM…TO`, 7.0 `PHRASE`; store `dateRaw + qualifier + range + calendar`
  - https://gedcom.io/specifications/ged551.pdf
  - https://gedcom.io/techfaqs
- `PLAC` = free-text comma low→high (`Springfield, Sangamon, Illinois, USA`); hierarchy via `HEAD.PLAC.FORM`; 7.0 adds `TRAN/LANG/MAP/LATI/LONG`; store string + optional parts, no geocode on import
  - https://gedcom.io/terms/v7/PLAC.html
- `NOTE`: inline vs pointer; `CONC`=join, `CONT`=newline (7.0 `CONT` only); inline `NOTE` + shared `SNOTE` in 7.0; attachable anywhere; #1 data-loss cause is skipping NOTE levels
- Media 5.x: `OBJE {FILE+FORM+TITL}`, path only, `BLOB` removed; 7.0: `FILE` URI + MIME + `CROP` + GEDZIP `.gdz` bundle; `FORM` enum (`jpg`) → MIME (`image/jpeg`); store `Media{url/path,mime,title}` unresolved
  - https://help.heredis.com/en/what-is-a-gedcom-file
- Sources/repos: `SOUR +DATA/EVEN/DATE/PLAC+AUTH/TITL/PUBL/TEXT+QUAY`, `REPO`; event link `2 SOUR @S@ {PAGE/QUAY/DATA/TEXT}`; keep for provenance even if hidden v1
- `_` tags = vendor extensions, must retain never drop; 7.0 `HEAD.SCHMA {TAG _TAG URI}`; common `_UID/_UPD/_APID/_FSID/_MARNM/POSITION`; rule: also emit synced standard tag; store `extensions: Map<path,raw>` + `externalIds[]`
  - https://webtrees.net/downloads/gedcom-l-r1.pdf

### 2.4 Robustness
- Lenient by default, diagnostics collected, never trash file; precedents `gedcom-typescript` (`parseErrors`), `gedcom-go` lenient (empty lines, bad levels, unknown tags, `1 BIRT→4 DATE` clamp to `prev+1` + warn); strict flag only for validation
  - https://github.com/tonycheal/gedcom-typescript
  - https://pkg.go.dev/github.com/cacack/gedcom-go/v2@v2.4.0/decoder
- Clamp level jumps, skip blanks, trim 5.x leading WS, cap nesting (~100), keep record on bad XREF + error
- Scanner joins bare continuation lines into NOTE (Ancestry quirk); fold non-standard subs into string
  - https://github.com/iand/gedcom
- Referential integrity: filter invalid XREFs but log; reconcile `FAMC/FAMS ↔ HUSB/WIFE/CHIL` mismatches; first duplicate wins; missing `TRLR` = warn + import
- Large files: stream, 100k+ INDI; two-pass (index XREFs → resolve)
- Minimal validator (warn, don't reject): `HEAD.GEDC.VERS` known, `HEAD.CHAR` in 5.x, `TRLR` last, XREFs unique, pointers resolve, bidirectional family links, `DATE` grammar else `raw+INVALID`, `SEX` in set
- Import report required: `ImportReport{version,encoding,counts,warnings[]}`

MyHeritage import UX precedent: `Family Tree > Import GEDCOM`, upload/drag-drop, async minutes + email when ready; new-user `Import tree (GEDCOM)` on registration
- https://www.myheritage.com/help/en/articles/12852096-how-do-i-upload-import-a-gedcom-file-to-my-family-site-on-myheritage

## 3. Export

### 3.1 GEDCOM export
- Emit **5.5.1 default** (MyHeritage still emits `2 VERS 5.5.1` + `FORM LINEAGE-LINKED`); offer 7.0 / GEDZIP option. 7.0 not backward-compatible
  - https://www.myheritage.com/wiki/How_to_work_with_GEDCOM_files
  - https://www.familysearch.org/en/gedcom
- Round-trip fidelity: INDI/FAM + NAME/GIVN/SURN/SEX, events, DATE/PLAC, FAMC/FAMS/PEDI, NOTE/SNOTE, SOUR+REPO, OBJE links, SUBM, CHAN dates; verify counts post-import
- HEAD required: `0 HEAD / 1 SOUR +VERS/NAME/CORP / 1 DEST / 1 DATE / 1 CHAR / 1 GEDC +VERS/FORM / 1 SUBM / 1 FILE / 1 LANG / 1 PLAC+FORM`; ex. `1 SOUR MYHERITAGE / 2 NAME … / 1 CHAR UTF-8 / 1 GEDC / 2 VERS 5.5.1`; 7.0: UTF-8+BOM, no CHAR/FORM, `VERS 7.0`, `SCHMA`, BCP-47 `LANG`
  - https://gedcom.io/specifications/FamilySearchGEDCOMv7.html
- Ordering: `0 HEAD … 0 <records> … 0 TRLR`; equal-level tag order not significant; `SUBM/SUBN` after HEAD
- `CHAR UTF-8` on emit (normalize ANSEL→UTF-8); BOM option for broken readers
  - https://help.geni.com/hc/en-us/articles/229705167-How-can-I-export-my-GEDCOM
- DATE: `DD MMM YYYY` upper (`05 SEP 2024`), partials, `ABT/CAL/EST/BEF/AFT/BET…AND/FROM…TO`, dual `1750/51`, `BC`; 7.0 `PHRASE+SDATE`
- PLAC: comma smallest→largest (`Cove, Cache, Utah`); obey `HEAD.PLAC.FORM` blanks; 7.0 `TRAN/LANG/EXID`
- Media: text-only `n OBJE @O@` or inline `FILE <path> +FORM +MEDI/TYPE +TITL`; never bytes; sidecar folder + rewritten paths; 7.0 `FILE` URL/local + `.gdz` zip, percent-escape non-ASCII
- Custom: non-standard must start `_` (`_PRIM/_APID/_RTLSAVE…`); 7.0 requires `HEAD.SCHMA TAG URI`; preserve unknown `_` on round-trip, never misinterpret; expect lossy interop (`ROMN/FONE` vs `TRAN/LANG`, `AFN/RFN/RIN` vs `EXID`, `RELA` vs `ROLE`, Ahnentafel) — map or warn
  - https://gedcom.io/migrate
  - https://help.heredis.com/en/export-a-gedcom
- MyHeritage flows: online `Family Tree > Manage Trees > Export to GEDCOM` (+`include photos`); FTB `File > Export GEDCOM` (+author/language, whole vs branch `Include only selected people`)
  - https://www.myheritage.com/help/en/articles/12851866-how-do-i-download-export-a-gedcom-file-of-my-family-tree-from-my-family-site
  - https://www.myheritage.com/help/en/articles/12851975-how-do-i-export-a-gedcom-file-from-the-family-tree-builder

### 3.2 PDF / print
- Chart types: pedigree/ancestor, descendant, all-in-one, hourglass, fan/sun/bowtie, family-group (+sources), family book
  - https://www.myheritage.com/wiki/Printing_family_tree_charts
  - https://help.heredis.com/en/windows-print-the-tree-chart
- Category conventions: FS 4-gen pedigree / 5-gen portrait / 7-gen fan; MyHeritage All-in-one + Ancestors/Descendants Fan/Horizontal/Vertical + books
- Card minimum: full name, birth/death year or full DATE + PLAC, photo; optional marriage date, IDs
- Controls: root person, generations (All vs N), facts level + custom, style/font/color/bg, title, portrait/landscape
  - https://www.myheritage.com/help/en/articles/12852009-how-do-i-print-my-entire-family-tree-on-one-page-online
- Flow: `Print charts & books > Generate > My charts > View PDF`; async email when ready
  - https://www.myheritage.com/help/en/articles/12852041-how-do-i-save-a-chart-as-a-pdf-file
- Pagination: single-page poster vs multi-page tiled; page breaks, scale %, paper A4/A3/…/custom, no split boxes; PDF cap `200″×200″` else roll paper / split / prune; home multi-page assemble vs poster single-page to print shop (MyHeritage poster service ended 2023-01-01, now download-then-print)
  - https://blog.myheritage.com/2022/12/sunset-notice-for-printing-posters-of-family-tree-charts/

### 3.3 Image (PNG/SVG)
- SVG = vector master for print/poster/edit (infinite zoom, Inkscape-editable); use for posters/banners
  - https://github.com/bver/ged2svg
- PNG/JPG = raster for sharing (fixed DPI, email/web/slides); transparent PNG for slides; JPG smaller lossy
- Charts saved via PDF keep vectors; PDF→SVG via Inkscape; Gramps precedent ODD/PDF/PS/SVG
- Pre-checks: 100% readability, margins, uncut lines, landscape/poster sizes, branch-scoped exports for oversize

### 3.4 Privacy (every export/share)
- Living filter expected: privatize to `Living` / surname-only / exclude, retain links; default no-evidence → living
  - https://gedcom.tools/how-to/remove-living-people-before-sharing-your-family-tree
- Precedents: FamilySearch hides living / blocks copy; Geni obscure private; Heredis exclude-confidential/surname-only/blur; FTM/TNG privatize + exclude private FACTS/NOTES + no media
- Toggles: living, media links, sources; warn PII hides in free-text NOTE/PLAC/ADDR/PHON; MyHeritage hides living from guests
  - https://education.myheritage.com/article/managing-your-privacy-on-myheritage
- Audit: keep backup, document settings, spot-check in viewer/validator; `1 COPR`, `1 SUBM`

### 3.5 Compat caps
- Ancestry: owner-only export, upload `<500MB`, text-only
  - https://help.ancestry.com/hc/en-us/articles/53933352542867-Uploading-and-Downloading-Trees
- FamilySearch Genealogies: share ≤`100MB` (~30 min), compare-copy ≤100 names; notes/sources/media/living don't auto-copy
- GEDCOM Library `50MB`; Geni Basic 5k / Pro 50k, forest export days; UTF-8+BOM preferred, ANSEL/UTF-16 legacy test; `_RTLSAVE/_PROJECT_GUID` safe preserve
  - https://gedcomlibrary.com/form.html
  - https://help.geni.com/hc/en-us/articles/229705167-How-can-I-export-my-GEDCOM

## 4. Data-model implications

```
Person { id, xref?, names[] {display,given,surname,prefix,suffix,nick,alternates[]},
  sex {M/F/X/U}, events[] {type,dateRaw,dateNorm{qualifier,range,calendar},place,notes,sources},
  famc[], fams[], isLiving, private, media[], externalIds[], extensions{} }
Family { id, partners[], children[], marriage{date,place}, divorce{date}, extensions{} }
Event { type, dateRaw, place, notes[], sources[] }  // 1:M per person/family, first = preferred
Place { raw, normalized? }
Note { id, text, shared? }
Source/Repo/Media stubs { id, title, file/path, mime }
ImportReport { version, encoding, counts, warnings[] }
```

- XREFs transient (don't expose as stable IDs); first instance preferred where multiples exist
- `_` extensions retained in `Map<path,raw>`; sync standard tag when emitting custom
- `isLiving/private` from day one for export redaction

## 5. MVP proposal

**P0 — tree + GED import + GED export:**
1. Person CRUD + typed relationships (parents/spouse/children/sibling) + attach/detach + multi-partner + divorce couple-fact
2. Facts/events (BIRT/MARR/DEAT/DIV + custom) with DATE/PLAC/NOTE/SOUR; name pieces; SEX; deceased flag; biography/notes
3. Personal photo + media links (no bytes v1, sidecar on export)
4. Views: Family + List v1; Pedigree + Fan v2
5. GED import: 5.5.1 lenient + 7.0 read, encoding sniff, diagnostics + ImportReport, XREF resolve, NOTE/CONC/CONT, `_` preserve, 100k streaming
6. GED export: 5.5.1 UTF-8, HEAD/SOUR, round-trip verify, branch/full, include-photo-links toggle, living filter

**P1:** Pedigree/Fan/Timeline views, PDF charts (pedigree/descendant/fan, single/multi-page), PNG/SVG, consistency checks, branch export, GEDZIP/7.0 emit.

**Deferred:** invites/collab, hints/matching, search, mobile.
