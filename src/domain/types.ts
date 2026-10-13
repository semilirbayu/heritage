// Heritage core domain types (spec: .scratch/heritage-mvp/spec.md).
// XREFs from GEDCOM are transient import hints, never stable ids.

export type Sex = "M" | "F" | "X" | "U";

export interface PersonalName {
  display: string;
  given?: string;
  surname?: string;
  prefix?: string;
  suffix?: string;
  nick?: string;
  alternates?: string[];
}

export interface DateNorm {
  qualifier?: "ABT" | "CAL" | "EST" | "BEF" | "AFT" | "BET" | "FROM" | "TO";
  range?: { from?: string; to?: string };
  calendar?: string;
}

export interface Place {
  raw: string;
  normalized?: string[];
}

export interface Note {
  id: string;
  text: string;
  shared?: boolean;
}

export interface SourceRef {
  sourceId: string;
  page?: string;
}

export interface Source {
  id: string;
  title: string;
}

export interface Media {
  id: string;
  /** Link only — GEDCOM is text-only, bytes live in a sidecar folder. */
  path: string;
  mime?: string;
  title?: string;
  dateRaw?: string;
  place?: Place;
}

export interface TreeEvent {
  id: string;
  type: string;
  dateRaw?: string;
  dateNorm?: DateNorm;
  place?: Place;
  /** e.g. DEAT cause. Free text, GEDCOM CAUS. */
  cause?: string;
  noteIds: string[];
  mediaIds: string[];
  sources: SourceRef[];
  extensions: Record<string, string>;
}

export interface ExternalId {
  type: string;
  value: string;
}

export type ParentType = "biological" | "adoptive" | "foster";

export interface FamcLink {
  familyId: string;
  /** PEDI — how the child belongs to the family. Absent = unspecified. */
  pedi?: ParentType;
}

export interface Person {
  id: string;
  /** Transient GEDCOM pointer (e.g. @I1@). Never expose as a stable id. */
  xref?: string;
  names: PersonalName[];
  sex: Sex;
  events: TreeEvent[];
  biography: string;
  researchNotes: string[];
  famc: FamcLink[];
  fams: string[];
  isLiving: boolean;
  private: boolean;
  mediaIds: string[];
  /** Person-level source citations (provenance, even if not displayed). */
  sources: SourceRef[];
  externalIds: ExternalId[];
  extensions: Record<string, string>;
}

export interface Family {
  id: string;
  xref?: string;
  partners: string[];
  children: string[];
  marriage?: TreeEvent;
  divorce?: TreeEvent;
  extensions: Record<string, string>;
}

/** Open version string; known literals kept for autocomplete, anything accepted (forward-tolerate 7.x). */
export type GedcomVersion = "5.5" | "5.5.1" | "7.0" | (string & {});

export interface ImportWarning {
  code: string;
  message: string;
}

export interface ImportReport {
  version: GedcomVersion;
  encoding: string;
  hadBom: boolean;
  counts: {
    individuals: number;
    families: number;
    notes: number;
    sources: number;
    media: number;
  };
  warnings: ImportWarning[];
}

/** A whole tree: the unit the importer returns and the exporter consumes. */
export interface Tree {
  persons: Person[];
  families: Family[];
  notes: Note[];
  sources: Source[];
  media: Media[];
}
