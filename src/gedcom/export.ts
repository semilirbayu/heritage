// GEDCOM 5.5.1 exporter (UTF-8). Emits HEAD → records → TRLR with CONC/CONT
// long-line splitting, upper-month DATEs, and `_` extension tags.
// `version: "7.0"` adjusts the HEAD only (full 7.0 body emit is P1).
// Person MARR/DIV events export as-is alongside family marriage/divorce,
// so domain-mirrored couple facts survive; the importer does not mirror,
// which keeps import → export → import a stable fixed point.

import type {
  Family,
  Media,
  Person,
  Tree,
  TreeEvent,
} from "../domain/types";
import { resolveMediaPath } from "../domain/media";

export interface ExportOptions {
  version?: "5.5.1" | "7.0";
  /** Emit OBJE links + media records. Default true (MyHeritage "include photos"). */
  includeMedia?: boolean;
  /** Privacy gate on every export. Default "none" (faithful); "redact" or "exclude" living. */
  livingFilter?: "none" | "redact" | "exclude";
  /** Descendant branch (root + descendants + their partners) instead of the whole tree. */
  branchRootId?: string;
  submitterName?: string;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function exportDateForGedcom(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi,
    (m) => m.toUpperCase(),
  );
}

const MIME_FORM: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tif",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "video/mp4": "mp4",
  "audio/wav": "wav",
};

const PEDI_EXPORT: Record<string, string> = {
  adoptive: "ADOPTED",
  foster: "FOSTER",
  biological: "BIRTH",
};

class Emitter {
  lines: string[] = [];

  /** Emit one logical line, CONC-splitting values past the 5.5.1 255-char limit. */
  at(level: number, tag: string, value = ""): void {
    const chunks = splitGedValue(value);
    this.lines.push(`${level} ${tag}${chunks[0] ? ` ${chunks[0]}` : ""}`);
    for (const c of chunks.slice(1)) this.lines.push(`${level + 1} CONC${c ? ` ${c}` : ""}`);
  }

  /** Emit a possibly multi-line value as CONT lines. */
  text(level: number, tag: string, value: string): void {
    const [first, ...rest] = value.split("\n");
    this.at(level, tag, first ?? "");
    for (const r of rest) this.at(level + 1, "CONT", r);
  }
}

function splitGedValue(value: string, limit = 240): string[] {
  if (value.length <= limit) return [value];
  const out: string[] = [];
  let rest = value;
  while (rest.length > limit) {
    out.push(rest.slice(0, limit));
    rest = rest.slice(limit);
  }
  out.push(rest);
  return out;
}

function exportHead(e: Emitter, o: Required<Pick<ExportOptions, "version" | "submitterName">>): void {
  const now = new Date();
  const stamp = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  e.at(0, "HEAD");
  e.at(1, "SOUR HERITAGE");
  e.at(2, "VERS 0.1.0");
  e.at(2, "NAME Heritage");
  e.at(2, "CORP Heritage");
  e.at(1, "DEST HERITAGE");
  e.at(1, "DATE", stamp);
  if (o.version === "5.5.1") e.at(1, "CHAR UTF-8");
  e.at(1, "GEDC");
  e.at(2, "VERS", o.version);
  if (o.version === "5.5.1") e.at(2, "FORM LINEAGE-LINKED");
  e.at(1, "SUBM @U1@");
  e.at(1, "FILE heritage.ged");
  e.at(0, "@U1@ SUBM");
  e.at(1, "NAME", o.submitterName);
}

function redact(p: Person): Person {
  return {
    ...p,
    names: [{ display: "Living" }],
    events: [],
    biography: "",
    researchNotes: [],
    mediaIds: [],
    sources: [],
    externalIds: [],
    extensions: {},
  };
}

function collectBranch(tree: Tree, rootId: string): { persons: Person[]; families: Family[] } {
  if (!tree.persons.some((p) => p.id === rootId)) throw new Error(`branch root ${rootId} not in tree`);
  // Descendant branch: the root, its descendant families, and partners of
  // those families. Ancestors and side branches are excluded.
  const downPersons = new Set<string>([rootId]);
  const downFamilies = new Set<string>();
  const todo = [rootId];
  while (todo.length > 0) {
    const pid = todo.pop()!;
    for (const f of tree.families) {
      if (!f.partners.includes(pid) || downFamilies.has(f.id)) continue;
      downFamilies.add(f.id);
      for (const other of [...f.partners, ...f.children]) {
        if (!downPersons.has(other)) {
          downPersons.add(other);
          todo.push(other);
        }
      }
    }
  }
  return {
    persons: tree.persons.filter((p) => downPersons.has(p.id)),
    families: tree.families.filter((f) => downFamilies.has(f.id)),
  };
}

function exportEvent(e: Emitter, level: number, event: TreeEvent, xrefOf: (kind: string, id: string) => string | undefined): void {
  e.at(level, event.type);
  const date = exportDateForGedcom(event.dateRaw);
  if (date) e.at(level + 1, "DATE", date);
  if (event.place) e.at(level + 1, "PLAC", event.place.raw);
  if (event.cause) e.at(level + 1, "CAUS", event.cause);
  for (const n of event.noteIds ?? []) {
    const x = xrefOf("note", n);
    if (x) e.at(level + 1, `NOTE @${x}@`);
  }
  for (const s of event.sources ?? []) {
    const x = xrefOf("source", s.sourceId);
    if (x) {
      e.at(level + 1, `SOUR @${x}@`);
      if (s.page) e.at(level + 2, "PAGE", s.page);
    }
  }
  const inlineSour = event.extensions[`${event.type}.SOUR.inline`];
  if (inlineSour !== undefined) e.at(level + 1, "SOUR", inlineSour);
  for (const m of event.mediaIds ?? []) {
    const x = xrefOf("media", m);
    if (x) e.at(level + 1, `OBJE @${x}@`);
  }
  for (const [k, v] of Object.entries(event.extensions)) {
    const prefix = `${event.type}.`;
    if (!k.startsWith(prefix) || k === `${event.type}.SOUR.inline`) continue;
    const sub = k.slice(prefix.length);
    if (sub.includes(".")) continue; // importer-local nested paths
    e.at(level + 1, sub, v);
  }
}

function exportName(e: Emitter, p: Person): void {
  const primary = p.names[0] ?? { display: "" };
  const core = [
    primary.given ?? "",
    primary.surname ? `/${primary.surname}/` : "",
    primary.suffix ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  e.at(1, "NAME", core || primary.display);
  if (primary.given) e.at(2, "GIVN", primary.given);
  if (primary.surname) e.at(2, "SURN", primary.surname);
  if (primary.prefix) e.at(2, "NPFX", primary.prefix);
  if (primary.suffix) e.at(2, "NSFX", primary.suffix);
  if (primary.nick) e.at(2, "NICK", primary.nick);
  for (const alt of primary.alternates ?? []) e.at(1, "NAME", alt);
}

export function exportGedcom(tree: Tree, options: ExportOptions = {}): string {
  const version = options.version ?? "5.5.1";
  const includeMedia = options.includeMedia ?? true;
  const livingFilter = options.livingFilter ?? "none";
  const submitterName = options.submitterName ?? "Heritage";

  let persons = tree.persons;
  let families = tree.families;
  if (options.branchRootId) {
    ({ persons, families } = collectBranch(tree, options.branchRootId));
  }
  if (livingFilter === "exclude") {
    const living = new Set(persons.filter((p) => p.isLiving).map((p) => p.id));
    persons = persons.filter((p) => !living.has(p.id));
    families = families
      .map((f) => ({
        ...f,
        partners: f.partners.filter((p) => !living.has(p)),
        children: f.children.filter((p) => !living.has(p)),
      }))
      .filter((f) => f.partners.length > 0 || f.children.length > 0);
  }
  const shown = (p: Person): Person => (livingFilter === "redact" && p.isLiving ? redact(p) : p);
  persons = persons.map(shown);
  const personIds = new Set(persons.map((p) => p.id));

  // Prune dangling refs left by filters/branching.
  families = families.map((f) => ({
    ...f,
    partners: f.partners.filter((p) => personIds.has(p)),
    children: f.children.filter((p) => personIds.has(p)),
  }));

  const e = new Emitter();
  exportHead(e, { version, submitterName });

  // Deterministic xref assignment in tree order.
  const noteX = new Map<string, string>();
  const sourceX = new Map<string, string>();
  const mediaX = new Map<string, string>();
  const personX = new Map<string, string>();
  const familyX = new Map<string, string>();
  persons.forEach((p, i) => personX.set(p.id, `I${i + 1}`));
  families.forEach((f, i) => familyX.set(f.id, `F${i + 1}`));

  const notes = tree.notes.filter((n) =>
    persons.some(
      (p) =>
        p.researchNotes.includes(n.text) ||
        p.events.some((ev) => ev.noteIds?.includes(n.id)),
    ) || options.branchRootId === undefined,
  );
  notes.forEach((n, i) => noteX.set(n.id, `N${i + 1}`));
  const usedSources = new Set<string>();
  const usedMedia = new Set<string>();
  for (const p of persons) {
    for (const ev of p.events) {
      for (const s of ev.sources ?? []) usedSources.add(s.sourceId);
      if (includeMedia) for (const m of ev.mediaIds ?? []) usedMedia.add(m);
    }
    for (const s of p.sources) usedSources.add(s.sourceId);
    if (includeMedia) for (const m of p.mediaIds) usedMedia.add(m);
  }
  tree.sources.filter((s) => usedSources.has(s.id)).forEach((s, i) => sourceX.set(s.id, `S${i + 1}`));
  if (includeMedia) {
    tree.media.filter((m) => usedMedia.has(m.id)).forEach((m, i) => mediaX.set(m.id, `O${i + 1}`));
  }

  const xrefOf = (kind: string, id: string): string | undefined =>
    kind === "note" ? noteX.get(id) : kind === "source" ? sourceX.get(id) : mediaX.get(id);

  for (const n of notes) {
    if (n.text) e.text(0, `@${noteX.get(n.id)}@ NOTE`, n.text);
    else e.at(0, `@${noteX.get(n.id)}@ NOTE`);
  }
  for (const s of tree.sources) {
    const x = sourceX.get(s.id);
    if (!x) continue;
    e.at(0, `@${x}@ SOUR`);
    if (s.title) e.at(1, "TITL", s.title);
  }
  if (includeMedia) {
    const byId = new Map(tree.media.map((m) => [m.id, m]));
    for (const [id, x] of mediaX) {
      const m = byId.get(id)!;
      e.at(0, `@${x}@ OBJE`);
      // Sidecar convention: relative links resolve under media/ on export.
      e.at(1, "FILE", resolveMediaPath(m.path));
      const form = mimeToForm(m);
      if (form) e.at(2, "FORM", form);
      if (m.title) e.at(1, "TITL", m.title);
    }
  }

  for (const p of persons) {
    e.at(0, `@${personX.get(p.id)}@ INDI`);
    exportName(e, p);
    e.at(1, "SEX", p.sex);
    for (const ev of p.events) exportEvent(e, 1, ev, xrefOf);
    for (const l of p.famc) {
      const x = familyX.get(l.familyId);
      if (x) {
        e.at(1, `FAMC @${x}@`);
        if (l.pedi && l.pedi !== "biological") e.at(2, "PEDI", PEDI_EXPORT[l.pedi] ?? l.pedi);
      }
    }
    for (const f of p.fams) {
      const x = familyX.get(f);
      if (x) e.at(1, `FAMS @${x}@`);
    }
    for (const t of p.researchNotes) e.text(1, "NOTE", t);
    for (const s of p.sources) {
      const x = sourceX.get(s.sourceId);
      if (x) {
        e.at(1, `SOUR @${x}@`);
        if (s.page) e.at(2, "PAGE", s.page);
      }
    }
    if (includeMedia) {
      for (const m of p.mediaIds) {
        const x = mediaX.get(m);
        if (x) e.at(1, `OBJE @${x}@`);
      }
    }
    for (const [k, v] of Object.entries(p.extensions)) {
      if (!k.startsWith("INDI.")) continue;
      const tag = k.slice("INDI.".length);
      if (tag === "SOUR.inline") {
        e.at(1, "SOUR", v);
        continue;
      }
      if (tag.includes(".")) continue; // importer-local paths (e.g. FAMC links)
      e.at(1, tag, v);
    }
    for (const xid of p.externalIds) e.at(1, xid.type, xid.value);
  }

  for (const f of families) {
    e.at(0, `@${familyX.get(f.id)}@ FAM`);
    // 5.5.1 only knows HUSB/WIFE; roles are positional here (first partner
    // is HUSB) and the importer is role-blind, so links survive even though
    // original roles don't. GEDCOM 7 drops gendered roles entirely (P1).
    for (const partner of f.partners.slice(0, 2)) {
      const isFirst = f.partners[0] === partner;
      e.at(1, `${isFirst ? "HUSB" : "WIFE"} @${personX.get(partner)}@`);
    }
    for (const extra of f.partners.slice(2)) e.at(1, `HUSB @${personX.get(extra)}@`);
    for (const c of f.children) e.at(1, `CHIL @${personX.get(c)}@`);
    if (f.marriage) exportEvent(e, 1, { ...f.marriage, type: "MARR" }, xrefOf);
    if (f.divorce) exportEvent(e, 1, { ...f.divorce, type: "DIV" }, xrefOf);
    const famNote = f.extensions["FAM.NOTE"];
    if (famNote !== undefined) e.text(1, "NOTE", famNote);
    for (const [k, v] of Object.entries(f.extensions)) {
      if (!k.startsWith("FAM.") || k === "FAM.NOTE") continue;
      const tag = k.slice("FAM.".length);
      if (!tag.includes(".")) e.at(1, tag, v);
    }
  }

  e.at(0, "TRLR");
  return `${e.lines.join("\n")}\n`;
}

function mimeToForm(m: Media): string {
  if (!m.mime) return "";
  const lower = m.mime.toLowerCase();
  if (MIME_FORM[lower]) return MIME_FORM[lower]!;
  if (!lower.includes("/")) return m.mime;
  return lower.split("/")[1]!;
}
