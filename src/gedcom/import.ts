// Lenient GEDCOM → Tree importer. Strategy: lex → nest → two-pass build.
// Pass 1 creates every record with a local id and remembers xref→id.
// Pass 2 resolves pointers (dangling → warning, first duplicate wins).
// Unknown and `_` tags are kept in `extensions`, never dropped.

import { decodeGedcom } from "./decode";
import { parseGEDCOMDate } from "./date";
import { parseLines, type GedLine } from "./lines";
import { emptyTree, newEvent, newId } from "../domain/tree";
import type {
  Family,
  ImportReport,
  ImportWarning,
  Media,
  Note,
  ParentType,
  Person,
  PersonalName,
  Source,
  SourceRef,
  Tree,
  TreeEvent,
} from "../domain/types";

interface Node {
  line: GedLine;
  kids: Node[];
}

interface LevelRecord {
  xref?: string;
  tag: string;
  /** Level-0 value (CONT/CONC-joined by the lexer). */
  value: string;
  kids: Node[];
}

const EVENT_TAGS = new Set([
  "BIRT", "CHR", "DEAT", "BURI", "CREM", "ADOP",
  "BAPM", "BARM", "BASM", "BLES", "CHRA", "CONF", "FCOM", "ORDN", "NATU",
  "EMIG", "IMMI", "CENS", "PROB", "WILL", "GRAD", "RETI", "OCCU", "EDUC",
  "RELI", "DSCR", "IDNO", "NATI", "CAST", "EVEN", "FACT",
]);

const DEATH_TAGS = new Set(["DEAT", "BURI", "CREM"]);

const FORM_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  wav: "audio/wav",
};

function nest(lines: GedLine[], from: number, level: number): { nodes: Node[]; next: number } {
  const nodes: Node[] = [];
  let i = from;
  while (i < lines.length && lines[i]!.level > level) {
    if (lines[i]!.level !== level + 1) {
      // Shouldn't happen post-clamp; skip defensively rather than looping.
      i++;
      continue;
    }
    const inner = nest(lines, i + 1, level + 1);
    nodes.push({ line: lines[i]!, kids: inner.nodes });
    i = inner.next;
  }
  return { nodes, next: i };
}

function ptr(value: string): string | undefined {
  const m = /^@([^@]+)@$/.exec(value.trim());
  return m ? m[1] : undefined;
}

function kidValue(kids: Node[], tag: string): string | undefined {
  return kids.find((k) => k.line.tag === tag)?.line.value;
}

function foldUnknown(prefix: string, kids: Node[], extensions: Record<string, string>): void {
  for (const k of kids) {
    extensions[`${prefix}.${k.line.tag}`] = k.line.value;
    if (k.kids.length > 0) foldUnknown(`${prefix}.${k.line.tag}`, k.kids, extensions);
  }
}

function mapPedi(raw: string | undefined): ParentType | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toUpperCase();
  if (v === "ADOPTED") return "adoptive";
  if (v === "FOSTER") return "foster";
  if (v === "BIRTH") return "biological";
  return undefined;
}

function parseName(value: string, kids: Node[]): PersonalName {
  const display = value.replace(/\//g, "").replace(/\s+/g, " ").trim();
  const slash = /^(.*?)\/([^/]*)\/?(.*)$/.exec(value);
  const givn = kidValue(kids, "GIVN");
  const surn = kidValue(kids, "SURN");
  const spfx = kidValue(kids, "SPFX");
  let given = givn;
  let surname = surn;
  if (slash) {
    given ??= slash[1]!.trim() || undefined;
    surname ??= slash[2]!.trim() || undefined;
  } else if (!givn && !surn) {
    given = display || undefined;
  }
  // SPFX is a surname prefix ("van", "de"): fold into the surname so the
  // full surname survives even though the model has no separate slot.
  if (spfx && surname && !surname.startsWith(spfx)) surname = `${spfx} ${surname}`;
  else if (spfx && !surname) surname = spfx;
  const primary: PersonalName = {
    display: display || [given, surname].filter(Boolean).join(" "),
    ...(given ? { given } : {}),
    ...(surname ? { surname } : {}),
    ...(['NPFX', 'NSFX', 'NICK'] as const).reduce<Record<string, string>>((acc, t) => {
      const v = kidValue(kids, t);
      if (v !== undefined) acc[t === 'NPFX' ? 'prefix' : t === 'NSFX' ? 'suffix' : 'nick'] = v;
      return acc;
    }, {}),
  };
  return primary;
}

function normalizeSex(value: string): Person["sex"] {
  const c = value.trim().toUpperCase().charAt(0);
  if (c === "M") return "M";
  if (c === "F") return "F";
  if (c === "X") return "X";
  return "U";
}

export function importGedcom(input: string | Uint8Array): { tree: Tree; report: ImportReport } {
  const warnings: ImportWarning[] = [];
  const warn = (code: string, message: string): void => {
    warnings.push({ code, message });
  };

  let text: string;
  let encoding: ImportReport["encoding"];
  let hadBom: boolean;
  if (typeof input === "string") {
    text = input;
    encoding = "UTF-8";
    hadBom = false;
  } else {
    ({ text, encoding, hadBom } = decodeGedcom(input));
  }

  const lines = parseLines(text);
  for (const l of lines) {
    if (l.clamped) warn("level-clamp", `Clamped level for ${l.tag} "${l.value.slice(0, 40)}"`);
  }

  // Split into level-0 records.
  const records: LevelRecord[] = [];
  let current: LevelRecord | null = null;
  let body: GedLine[] = [];
  const flush = (): void => {
    if (current) records.push({ ...current, kids: nest(body, 0, 0).nodes });
  };
  for (const l of lines) {
    if (l.level === 0) {
      flush();
      current = { tag: l.tag, kids: [], value: l.value };
      if (l.xref) current.xref = l.xref;
      if (l.value && l.tag !== "NOTE" && l.tag !== "SNOTE") {
        warn("level0-value", `Level-0 ${l.tag} carries a value, kept as extension`);
      }
      body = [];
    } else if (current) {
      body.push(l);
    } else {
      current = { tag: "_LEAD", kids: [], value: "" };
      body = [l];
    }
  }
  flush();

  if (records.length === 0 || records[records.length - 1]!.tag !== "TRLR") {
    warn("missing-trailer", "No trailing 0 TRLR record; imported anyway");
  }

  // HEAD: version + charset.
  let version: string = "unknown";
  const head = records.find((r) => r.tag === "HEAD");
  if (head) {
    const gedc = head.kids.find((k) => k.line.tag === "GEDC");
    const vers = gedc ? kidValue(gedc.kids, "VERS") : undefined;
    if (vers) {
      version = vers.trim();
    } else {
      warn("missing-version", "HEAD.GEDC.VERS missing; version unknown");
    }
    const char = kidValue(head.kids, "CHAR");
    if (char && encoding === "WINDOWS-1252" && char.toUpperCase().includes("UTF")) {
      warn("encoding-fallback", `HEAD.CHAR says ${char} but bytes are not valid UTF-8; fell back to WINDOWS-1252`);
    }
  } else {
    warn("missing-header", "No 0 HEAD record");
  }

  const tree = emptyTree();
  const personsByXref = new Map<string, Person>();
  const familiesByXref = new Map<string, Family>();
  const notesByXref = new Map<string, Note>();
  const sourcesByXref = new Map<string, Source>();
  const mediaByXref = new Map<string, Media>();

  const claimXref = (kind: string, xref: string | undefined): boolean => {
    if (!xref) return true;
    const exists =
      personsByXref.has(xref) || familiesByXref.has(xref) ||
      notesByXref.has(xref) || sourcesByXref.has(xref) || mediaByXref.has(xref);
    if (exists) {
      warn("duplicate-xref", `Duplicate @${xref}@ (${kind}); first record wins`);
      return false;
    }
    return true;
  };

  const addNote = (text: string, shared: boolean): Note => {
    const note: Note = { id: newId("n"), text, shared };
    tree.notes.push(note);
    return note;
  };

  // Pass 1a: shared NOTE / SNOTE / SOUR / REPO / OBJE records.
  for (const r of records) {
    if (!r.xref) continue;
    if (r.tag === "NOTE" || r.tag === "SNOTE") {
      if (!claimXref(r.tag, r.xref)) continue;
      // The lexer already CONT/CONC-joined the record value.
      const note: Note = { id: newId("n"), text: r.value, shared: true };
      notesByXref.set(r.xref, note);
      tree.notes.push(note);
    } else if (r.tag === "SOUR") {
      if (!claimXref("SOUR", r.xref)) continue;
      const source: Source = { id: newId("s"), title: kidValue(r.kids, "TITL") ?? "" };
      sourcesByXref.set(r.xref, source);
      tree.sources.push(source);
    } else if (r.tag === "REPO") {
      if (!claimXref("REPO", r.xref)) continue;
      // Repositories have no dedicated shape in v1; keep them as sources so
      // provenance survives and citations still resolve.
      const source: Source = { id: newId("s"), title: kidValue(r.kids, "NAME") ?? "" };
      sourcesByXref.set(r.xref, source);
      tree.sources.push(source);
    } else if (r.tag === "OBJE") {
      if (!claimXref("OBJE", r.xref)) continue;
      const media = mediaFromKids(r.kids, r.xref);
      mediaByXref.set(r.xref!, media);
      tree.media.push(media);
    }
  }

  function mediaFromKids(kids: Node[], context: string | undefined): Media {
    // 5.5.1 nests FORM under FILE (`1 FILE / 2 FORM`); accept a sibling FORM too.
    const fileNode = kids.find((k) => k.line.tag === "FILE");
    const file = fileNode?.line.value ?? "";
    const form = (
      (fileNode && kidValue(fileNode.kids, "FORM")) ?? kidValue(kids, "FORM") ?? ""
    ).toLowerCase();
    if (file === "") warn("empty-obje", `OBJE${context ? ` @${context}@` : ""} without FILE path`);
    return {
      id: newId("m"),
      path: file,
      mime: FORM_MIME[form] ?? (form || undefined),
      title: kidValue(kids, "TITL"),
    };
  }

  const resolveNote = (node: Node, owner: { noteIds: string[] }): void => {
    const target = ptr(node.line.value);
    if (target) {
      const note = notesByXref.get(target);
      if (note) owner.noteIds.push(note.id);
      else warn("dangling-pointer", `NOTE @${target}@ not found`);
    } else {
      owner.noteIds.push(addNote(node.line.value, false).id);
    }
  };

  // Person has no note-id list in v1: person-level notes live in
  // researchNotes as text (single home — the exporter re-emits them inline,
  // which keeps import → export → import counts stable).
  const resolvePersonNote = (node: Node, person: Person): void => {
    const target = ptr(node.line.value);
    if (target) {
      const note = notesByXref.get(target);
      if (note) person.researchNotes.push(note.text);
      else warn("dangling-pointer", `NOTE @${target}@ not found`);
    } else {
      person.researchNotes.push(node.line.value);
    }
  };

  const resolveSource = (node: Node, owner: { sources: SourceRef[]; extensions: Record<string, string> }, extKey: string): void => {
    const target = ptr(node.line.value);
    if (!target) {
      // Inline SOUR text (no pointer): keep the raw text in extensions so it
      // survives the round trip instead of being dropped.
      owner.extensions[extKey] = node.line.value;
      return;
    }
    const source = sourcesByXref.get(target);
    if (!source) {
      warn("dangling-pointer", `SOUR @${target}@ not found`);
      return;
    }
    owner.sources.push({
      sourceId: source.id,
      ...(kidValue(node.kids, "PAGE") ? { page: kidValue(node.kids, "PAGE")! } : {}),
    });
  };

  const resolveMedia = (node: Node, owner: { mediaIds: string[] }): void => {
    const target = ptr(node.line.value);
    if (target) {
      const media = mediaByXref.get(target);
      if (media) owner.mediaIds.push(media.id);
      else warn("dangling-pointer", `OBJE @${target}@ not found`);
      return;
    }
    // Inline OBJE: FILE + FORM + TITL describe the link.
    if (node.kids.every((k) => k.line.tag !== "FILE")) {
      warn("empty-obje", "OBJE without pointer or FILE; skipped");
      return;
    }
    const media = mediaFromKids(node.kids, undefined);
    tree.media.push(media);
    owner.mediaIds.push(media.id);
  };

  const buildEvent = (node: Node): TreeEvent => {
    const tag = node.line.tag;
    const type = (tag === "EVEN" || tag === "FACT" ? kidValue(node.kids, "TYPE") : undefined) ?? tag;
    const event = newEvent({ type });
    for (const k of node.kids) {
      const t = k.line.tag;
      if (t === "DATE") {
        event.dateRaw = k.line.value;
        const norm = parseGEDCOMDate(k.line.value);
        if (Object.keys(norm).length > 0) event.dateNorm = norm;
      } else if (t === "PLAC") {
        event.place = { raw: k.line.value };
      } else if (t === "CAUS") {
        event.cause = k.line.value;
      } else if (t === "TYPE" && (tag === "EVEN" || tag === "FACT")) {
        continue; // already folded into the event type
      } else if (t === "NOTE") {
        resolveNote(k, event);
      } else if (t === "SOUR") {
        resolveSource(k, event, `${type}.SOUR.inline`);
      } else if (t === "OBJE") {
        resolveMedia(k, event);
      } else {
        event.extensions[`${type}.${t}`] = k.line.value;
        if (k.kids.length > 0) foldUnknown(`${type}.${t}`, k.kids, event.extensions);
      }
    }
    return event;
  };

  // Pass 1b: INDI records (people). Family links resolve in pass 2.
  const KNOWN_TOP = new Set(["HEAD", "TRLR", "INDI", "FAM", "NOTE", "SNOTE", "SOUR", "REPO", "OBJE", "SUBM", "SUBN"]);
  const pendingFamLinks: { person: Person; famc: { xref: string; pedi?: string }[]; fams: string[] }[] = [];
  for (const r of records) {
    if (r.tag !== "INDI" || !r.xref) {
      if (!KNOWN_TOP.has(r.tag)) {
        warn("unknown-record", `Level-0 ${r.tag}${r.xref ? ` @${r.xref}@` : ""} is not modeled; skipped`);
      } else if (r.tag === "INDI" && !r.xref) {
        warn("missing-xref", "INDI without a pointer; skipped");
      }
      continue;
    }
    if (!claimXref("INDI", r.xref)) continue;
    const person: Person = {
      id: newId("p"),
      xref: r.xref,
      names: [],
      sex: "U",
      events: [],
      biography: "",
      researchNotes: [],
      famc: [],
      fams: [],
      isLiving: true,
      private: false,
      mediaIds: [],
      sources: [],
      externalIds: [],
      extensions: {},
    };
    personsByXref.set(r.xref, person);
    tree.persons.push(person);
    const famc: { xref: string; pedi?: string }[] = [];
    const fams: string[] = [];
    for (const n of r.kids) {
      const t = n.line.tag;
      if (t === "NAME") {
        const primary = parseName(n.line.value, n.kids);
        if (person.names.length === 0) person.names.push(primary);
        else person.names[0]!.alternates = [...(person.names[0]!.alternates ?? []), primary.display];
      } else if (t === "SEX") {
        person.sex = normalizeSex(n.line.value);
      } else if (t === "FAMC") {
        const target = ptr(n.line.value);
        if (target) {
          const pediRaw = kidValue(n.kids, "PEDI");
          famc.push({ xref: target, ...(pediRaw ? { pedi: pediRaw } : {}) });
          for (const k of n.kids) {
            if (k.line.tag !== "PEDI") {
              person.extensions[`INDI.FAMC.${k.line.tag}`] = k.line.value;
            }
          }
        } else {
          warn("bad-pointer", `FAMC value "${n.line.value}" is not a pointer; skipped`);
        }
      } else if (t === "FAMS") {
        const target = ptr(n.line.value);
        if (target) fams.push(target);
        else warn("bad-pointer", `FAMS value "${n.line.value}" is not a pointer; skipped`);
      } else if (t === "NOTE") {
        resolvePersonNote(n, person);
      } else if (t === "SOUR") {
        resolveSource(n, person, "INDI.SOUR.inline");
      } else if (t === "OBJE") {
        resolveMedia(n, person);
      } else if (t === "CHAN") {
        person.extensions["INDI.CHAN"] = kidValue(n.kids, "DATE") ?? n.line.value;
      } else if (["RIN", "RFN", "AFN", "REFN"].includes(t)) {
        person.externalIds.push({ type: t, value: n.line.value });
      } else if (EVENT_TAGS.has(t)) {
        person.events.push(buildEvent(n));
      } else {
        person.extensions[`INDI.${t}`] = n.line.value;
        if (n.kids.length > 0) foldUnknown(`INDI.${t}`, n.kids, person.extensions);
      }
    }
    if (person.names.length === 0) person.names.push({ display: "" });
    if (person.events.some((e) => DEATH_TAGS.has(e.type))) person.isLiving = false;
    pendingFamLinks.push({ person, famc, fams });
  }

  // Pass 1c: FAM records.
  const pendingFamMembers: { family: Family; partners: string[]; children: string[] }[] = [];
  for (const r of records) {
    if (r.tag !== "FAM" || !r.xref) {
      if (r.tag === "FAM" && !r.xref) warn("missing-xref", "FAM without a pointer; skipped");
      continue;
    }
    if (!claimXref("FAM", r.xref)) continue;
    const family: Family = { id: newId("f"), xref: r.xref, partners: [], children: [], extensions: {} };
    familiesByXref.set(r.xref, family);
    tree.families.push(family);
    const partners: string[] = [];
    const children: string[] = [];
    for (const n of r.kids) {
      const t = n.line.tag;
      if (t === "HUSB" || t === "WIFE") {
        const target = ptr(n.line.value);
        if (target) partners.push(target);
        else warn("bad-pointer", `${t} value "${n.line.value}" is not a pointer; skipped`);
      } else if (t === "CHIL") {
        const target = ptr(n.line.value);
        if (target) children.push(target);
        else warn("bad-pointer", `CHIL value "${n.line.value}" is not a pointer; skipped`);
      } else if (t === "MARR") {
        family.marriage = buildEvent(n);
      } else if (t === "DIV") {
        family.divorce = buildEvent(n);
      } else if (EVENT_TAGS.has(t)) {
        family.extensions[`FAM.${t}`] = n.line.value;
        if (n.kids.length > 0) foldUnknown(`FAM.${t}`, n.kids, family.extensions);
      } else if (t === "NOTE") {
        // Keep note text (shared pointers resolved) so the exporter can
        // re-emit it; newline-joined when several are present.
        const target = ptr(n.line.value);
        const text = target ? (notesByXref.get(target)?.text ?? "") : n.line.value;
        if (target && !notesByXref.has(target)) {
          warn("dangling-pointer", `NOTE @${target}@ not found`);
        } else if (text !== "") {
          const prev = family.extensions["FAM.NOTE"];
          family.extensions["FAM.NOTE"] = prev ? `${prev}\n${text}` : text;
        }
      } else if (t === "SOUR" || t === "OBJE" || t === "CHAN") {
        family.extensions[`FAM.${t}`] = n.line.value;
      } else {
        family.extensions[`FAM.${t}`] = n.line.value;
        if (n.kids.length > 0) foldUnknown(`FAM.${t}`, n.kids, family.extensions);
      }
    }
    pendingFamMembers.push({ family, partners, children });
  }

  // Pass 2: resolve pointers (dangling → warning + drop) and reconcile.
  for (const { family, partners, children } of pendingFamMembers) {
    for (const xref of partners) {
      const p = personsByXref.get(xref);
      if (!p) {
        warn("dangling-pointer", `Family @${family.xref}@ partner @${xref}@ not found`);
        continue;
      }
      family.partners.push(p.id);
    }
    for (const xref of children) {
      const p = personsByXref.get(xref);
      if (!p) {
        warn("dangling-pointer", `Family @${family.xref}@ child @${xref}@ not found`);
        continue;
      }
      family.children.push(p.id);
    }
  }
  for (const { person, famc, fams } of pendingFamLinks) {
    for (const link of famc) {
      const f = familiesByXref.get(link.xref);
      if (!f) {
        warn("dangling-pointer", `Person @${person.xref}@ FAMC @${link.xref}@ not found`);
        continue;
      }
      const pedi = mapPedi(link.pedi);
      person.famc.push({ familyId: f.id, ...(pedi ? { pedi } : {}) });
      if (link.pedi && !pedi) {
        person.extensions[`INDI.FAMC.${f.id}.PEDI`] = link.pedi;
      }
      if (!f.children.includes(person.id)) f.children.push(person.id);
    }
    for (const xref of fams) {
      const f = familiesByXref.get(xref);
      if (!f) {
        warn("dangling-pointer", `Person @${person.xref}@ FAMS @${xref}@ not found`);
        continue;
      }
      person.fams.push(f.id);
      if (!f.partners.includes(person.id)) f.partners.push(person.id);
    }
  }
  // One-sided family links declared only on the FAM side still link back.
  for (const family of tree.families) {
    for (const pid of family.partners) {
      const p = tree.persons.find((q) => q.id === pid);
      if (p && !p.fams.includes(family.id)) p.fams.push(family.id);
    }
    for (const cid of family.children) {
      const c = tree.persons.find((q) => q.id === cid);
      if (c && !c.famc.some((l) => l.familyId === family.id)) {
        c.famc.push({ familyId: family.id });
      }
    }
  }

  return {
    tree,
    report: {
      version,
      encoding,
      hadBom,
      counts: {
        individuals: tree.persons.length,
        families: tree.families.length,
        notes: tree.notes.length,
        sources: tree.sources.length,
        media: tree.media.length,
      },
      warnings,
    },
  };
}
