import type {
  Family,
  FamcLink,
  ParentType,
  Person,
  PersonalName,
  Sex,
  Tree,
  TreeEvent,
} from "./types";

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function emptyTree(): Tree {
  return { persons: [], families: [], notes: [], sources: [], media: [] };
}

export function newEvent(input: {
  type: string;
  dateRaw?: string;
  placeRaw?: string;
}): TreeEvent {
  return {
    id: newId("e"),
    type: input.type,
    dateRaw: input.dateRaw,
    place: input.placeRaw ? { raw: input.placeRaw } : undefined,
    noteIds: [],
    mediaIds: [],
    sources: [],
    extensions: {},
  };
}

function displayName(input: {
  given?: string;
  surname?: string;
  display?: string;
}): string {
  if (input.display) return input.display;
  return [input.given, input.surname].filter(Boolean).join(" ");
}

export function createPerson(input: {
  given?: string;
  surname?: string;
  display?: string;
  sex?: Sex;
  isLiving?: boolean;
}): Person {
  const names: PersonalName[] = [
    {
      display: displayName(input),
      given: input.given,
      surname: input.surname,
    },
  ];
  return {
    id: newId("p"),
    names,
    sex: input.sex ?? "U",
    events: [],
    biography: "",
    researchNotes: [],
    famc: [],
    fams: [],
    // Spec: default no-evidence → living (privacy-safe until inference lands).
    isLiving: input.isLiving ?? true,
    private: false,
    mediaIds: [],
    sources: [],
    externalIds: [],
    extensions: {},
  };
}

export function createFamily(input: { partners?: string[] }): Family {
  return {
    id: newId("f"),
    partners: input.partners ?? [],
    children: [],
    extensions: {},
  };
}

/**
 * Link a child into a family, mirroring FAMC/FAMS the way
 * GEDCOM requires (FAM.CHIL ↔ INDI.FAMC, HUSB/WIFE ↔ INDI.FAMS).
 * Pure — returns updated copies, never mutates inputs.
 */
export function addChild(input: {
  family: Family;
  childId: string;
  parent: Person;
  child?: Person;
}): {
  family: Family;
  updatedParent: Person;
  updatedChild?: Person;
} {
  const { family, childId, parent, child } = input;
  const nextFamily: Family = {
    ...family,
    children: family.children.includes(childId)
      ? family.children
      : [...family.children, childId],
  };
  const updatedParent: Person = {
    ...parent,
    fams: parent.fams.includes(family.id)
      ? parent.fams
      : [...parent.fams, family.id],
  };
  const updatedChild = child
    ? {
        ...child,
        famc: child.famc.some((l) => l.familyId === family.id)
          ? child.famc
          : [...child.famc, { familyId: family.id }],
      }
    : undefined;
  return { family: nextFamily, updatedParent, updatedChild };
}

export function updatePerson(
  person: Person,
  patch: {
    given?: string;
    surname?: string;
    display?: string;
    prefix?: string;
    suffix?: string;
    nick?: string;
    sex?: Sex;
    biography?: string;
    private?: boolean;
  },
): Person {
  const primary = person.names[0] ?? { display: "" };
  const given = patch.given ?? primary.given;
  const surname = patch.surname ?? primary.surname;
  const touchesName =
    patch.given !== undefined ||
    patch.surname !== undefined ||
    patch.display !== undefined;
  const nextPrimary: PersonalName = {
    ...primary,
    given,
    surname,
    prefix: patch.prefix ?? primary.prefix,
    suffix: patch.suffix ?? primary.suffix,
    nick: patch.nick ?? primary.nick,
    display: touchesName
      ? (patch.display ?? [given, surname].filter(Boolean).join(" "))
      : primary.display,
  };
  return {
    ...person,
    names: [nextPrimary, ...person.names.slice(1)],
    sex: patch.sex ?? person.sex,
    biography: patch.biography ?? person.biography,
    private: patch.private ?? person.private,
  };
}

export function setDeceased(
  person: Person,
  input: { dateRaw?: string; placeRaw?: string; cause?: string },
): Person {
  const hasDeat = person.events.some((e) => e.type === "DEAT");
  const death = newEvent({ type: "DEAT", ...input });
  if (input.cause !== undefined) death.cause = input.cause;
  return {
    ...person,
    isLiving: false,
    events: hasDeat ? person.events : [...person.events, death],
  };
}

export function setLiving(person: Person): Person {
  return {
    ...person,
    isLiving: true,
    events: person.events.filter((e) => e.type !== "DEAT"),
  };
}

export function addResearchNote(person: Person, text: string): Person {
  return { ...person, researchNotes: [...person.researchNotes, text] };
}

function linkFams(person: Person, familyId: string): Person {
  return {
    ...person,
    fams: person.fams.includes(familyId)
      ? person.fams
      : [...person.fams, familyId],
  };
}

function linkFamc(
  person: Person,
  link: FamcLink,
): Person {
  const existing = person.famc.find((l) => l.familyId === link.familyId);
  if (!existing) return { ...person, famc: [...person.famc, link] };
  if (existing.pedi === link.pedi) return person;
  return {
    ...person,
    famc: person.famc.map((l) =>
      l.familyId === link.familyId ? { ...l, pedi: link.pedi } : l,
    ),
  };
}

/**
 * Attach a parent to a child. Creates a single-parent family when none is
 * given. Re-attaching the same person is a no-op (no dupes).
 */
export function addParent(input: {
  child: Person;
  parent: Person;
  family?: Family;
  pedi?: ParentType;
}): { family: Family; updatedChild: Person; updatedParent: Person } {
  const base = input.family ?? createFamily({ partners: [] });
  const family: Family = {
    ...base,
    partners: base.partners.includes(input.parent.id)
      ? base.partners
      : [...base.partners, input.parent.id],
    children: base.children.includes(input.child.id)
      ? base.children
      : [...base.children, input.child.id],
  };
  return {
    family,
    updatedChild: linkFamc(input.child, {
      familyId: family.id,
      pedi: input.pedi,
    }),
    updatedParent: linkFams(input.parent, family.id),
  };
}

/** Attach an existing sibling (or any child) to a family — no dupes. */
export function addSibling(input: {
  family: Family;
  siblingId: string;
  sibling?: Person;
  pedi?: ParentType;
}): { family: Family; updatedSibling?: Person } {
  const family: Family = {
    ...input.family,
    children: input.family.children.includes(input.siblingId)
      ? input.family.children
      : [...input.family.children, input.siblingId],
  };
  const updatedSibling = input.sibling
    ? linkFamc(input.sibling, { familyId: family.id, pedi: input.pedi })
    : undefined;
  return { family, updatedSibling };
}

/**
 * Couple two people. Always a new family (so multi-partner = multiple
 * FAMS entries); pass an existing family to attach into it instead.
 */
export function addPartner(input: {
  a: Person;
  b: Person;
  family?: Family;
}): { family: Family; updatedA: Person; updatedB: Person } {
  const base = input.family ?? createFamily({ partners: [] });
  const partners = [...base.partners];
  for (const id of [input.a.id, input.b.id]) {
    if (!partners.includes(id)) partners.push(id);
  }
  const family: Family = { ...base, partners };
  return {
    family,
    updatedA: linkFams(input.a, family.id),
    updatedB: linkFams(input.b, family.id),
  };
}

export function detachChild(input: {
  family: Family;
  childId: string;
  child?: Person;
}): { family: Family; updatedChild?: Person } {
  const family: Family = {
    ...input.family,
    children: input.family.children.filter((c) => c !== input.childId),
  };
  const updatedChild = input.child
    ? {
        ...input.child,
        famc: input.child.famc.filter((l) => l.familyId !== family.id),
      }
    : undefined;
  return { family, updatedChild };
}

export function detachPartner(input: {
  family: Family;
  partnerId: string;
  partner?: Person;
}): { family: Family; updatedPartner?: Person } {
  const family: Family = {
    ...input.family,
    partners: input.family.partners.filter((p) => p !== input.partnerId),
  };
  const updatedPartner = input.partner
    ? {
        ...input.partner,
        fams: input.partner.fams.filter((f) => f !== family.id),
      }
    : undefined;
  return { family, updatedPartner };
}

/**
 * Divorce is a couple fact: recorded on the family and mirrored as a DIV
 * event on both partners. One shared event id; repeat calls are no-ops.
 */
export function setDivorce(input: {
  family: Family;
  partnerA: Person;
  partnerB: Person;
  dateRaw?: string;
  placeRaw?: string;
}): { family: Family; updatedA: Person; updatedB: Person } {
  if (input.family.divorce) {
    return {
      family: input.family,
      updatedA: input.partnerA,
      updatedB: input.partnerB,
    };
  }
  const divorce = newEvent({ type: "DIV", ...input });
  const mirror = (p: Person): Person =>
    p.events.some((e) => e.id === divorce.id || e.type === "DIV")
      ? p
      : { ...p, events: [...p.events, { ...divorce }] };
  return {
    family: { ...input.family, divorce },
    updatedA: mirror(input.partnerA),
    updatedB: mirror(input.partnerB),
  };
}

/** Marriage mirrors setDivorce: family record + MARR on both partners. */
export function setMarriage(input: {
  family: Family;
  partnerA: Person;
  partnerB: Person;
  dateRaw?: string;
  placeRaw?: string;
}): { family: Family; updatedA: Person; updatedB: Person } {
  if (input.family.marriage) {
    return {
      family: input.family,
      updatedA: input.partnerA,
      updatedB: input.partnerB,
    };
  }
  const marriage = newEvent({ type: "MARR", ...input });
  const mirror = (p: Person): Person =>
    p.events.some((e) => e.id === marriage.id || e.type === "MARR")
      ? p
      : { ...p, events: [...p.events, { ...marriage }] };
  return {
    family: { ...input.family, marriage },
    updatedA: mirror(input.partnerA),
    updatedB: mirror(input.partnerB),
  };
}

/** First instance wins: multiples are conflicting opinions, all kept. */
export function preferredEvent(
  events: TreeEvent[],
  type: string,
): TreeEvent | undefined {
  return events.find((e) => e.type === type);
}

export function preferredName(person: Person | undefined): string {
  return person?.names[0]?.display ?? "";
}

export interface Kin {
  parents: Person[];
  partners: Person[];
  children: Person[];
}

/** The people directly linked to one person, de-duplicated, in tree order. */
export function kinOf(tree: { persons: Person[]; families: Family[] }, person: Person): Kin {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const mine = tree.families.filter((f) => person.fams.includes(f.id));
  const fromFamc = tree.families.filter((f) => person.famc.some((l) => l.familyId === f.id));
  const pick = (ids: string[]): Person[] => {
    const seen = new Set<string>();
    const out: Person[] = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (p && !seen.has(id)) {
        seen.add(id);
        out.push(p);
      }
    }
    return out;
  };
  return {
    parents: pick(fromFamc.flatMap((f) => f.partners)),
    partners: pick(mine.flatMap((f) => f.partners).filter((id) => id !== person.id)),
    children: pick(mine.flatMap((f) => f.children)),
  };
}

export function addFact(
  person: Person,
  input: {
    type: string;
    dateRaw?: string;
    placeRaw?: string;
    noteIds?: string[];
    mediaIds?: string[];
    sources?: TreeEvent["sources"];
  },
): { person: Person; fact: TreeEvent } {
  const fact: TreeEvent = {
    ...newEvent({ type: input.type, dateRaw: input.dateRaw }),
    place: input.placeRaw ? { raw: input.placeRaw } : undefined,
    noteIds: input.noteIds ?? [],
    mediaIds: input.mediaIds ?? [],
    sources: input.sources ?? [],
  };
  return { person: { ...person, events: [...person.events, fact] }, fact };
}

export function updateFact(
  person: Person,
  factId: string,
  patch: {
    dateRaw?: string;
    placeRaw?: string;
    type?: string;
    cause?: string;
    noteIds?: string[];
    mediaIds?: string[];
    sources?: TreeEvent["sources"];
  },
): Person {
  return {
    ...person,
    events: person.events.map((e) =>
      e.id !== factId
        ? e
        : {
            ...e,
            type: patch.type ?? e.type,
            dateRaw: patch.dateRaw ?? e.dateRaw,
            cause: patch.cause ?? e.cause,
            place:
              patch.placeRaw !== undefined ? { raw: patch.placeRaw } : e.place,
            noteIds: patch.noteIds ?? e.noteIds,
            mediaIds: patch.mediaIds ?? e.mediaIds,
            sources: patch.sources ?? e.sources,
          },
    ),
  };
}

export function deleteFact(person: Person, factId: string): Person {
  return { ...person, events: person.events.filter((e) => e.id !== factId) };
}
