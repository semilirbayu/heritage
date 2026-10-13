// Pure view-model for the List view: surname filter + sorting.
// Birth/death years come from BIRT/DEAT dateRaw (last 4-digit group wins).

import { preferredEvent, preferredName } from "../domain/tree";
import type { Tree } from "../domain/types";

export interface ListQuery {
  surname?: string;
  sort?: "surname" | "given" | "birth" | "death";
}

export interface ListRow {
  personId: string;
  display: string;
  surname?: string;
  birthYear?: string;
  deathYear?: string;
  birthPlace?: string;
}

export function yearOf(dateRaw: string | undefined): string | undefined {
  if (!dateRaw) return undefined;
  // First 4-digit group = onset year (ranges sort by their start).
  const m = dateRaw.match(/\d{3,4}/);
  return m ? m[0] : undefined;
}

export function listPeople(tree: Tree, query: ListQuery = {}): ListRow[] {
  const filter = query.surname?.trim().toLowerCase();
  const rows: ListRow[] = [];
  for (const p of tree.persons) {
    const surname = p.names[0]?.surname;
    const display = preferredName(p) || "(no name)";
    if (filter && !(surname?.toLowerCase().includes(filter) || display.toLowerCase().includes(filter))) {
      continue;
    }
    const birth = preferredEvent(p.events, "BIRT");
    const death = preferredEvent(p.events, "DEAT");
    const birthYear = yearOf(birth?.dateRaw);
    const deathYear = yearOf(death?.dateRaw);
    rows.push({
      personId: p.id,
      display,
      ...(surname ? { surname } : {}),
      ...(birthYear ? { birthYear } : {}),
      ...(deathYear ? { deathYear } : {}),
      ...(birth?.place ? { birthPlace: birth.place.raw } : {}),
    });
  }
  const sort = query.sort ?? "surname";
  const key = (r: ListRow): string => {
    switch (sort) {
      case "given":
        return r.display.toLowerCase();
      case "birth":
        return `${r.birthYear ?? "~~~~"} ${r.display.toLowerCase()}`;
      case "death":
        return `${r.deathYear ?? "~~~~"} ${r.display.toLowerCase()}`;
      default:
        return `${r.surname?.toLowerCase() ?? "~~~~"} ${r.display.toLowerCase()}`;
    }
  };
  return rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
