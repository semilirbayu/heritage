// Heritage web app: Bun.serve router over the pure domain + gedcom layers.
// State is an in-memory Tree (multi-user/persistence deferred). All renders
// are server-side strings (see pages.ts); handlers mutate by replacing
// store.tree with updated copies since domain ops are pure.

import { addMedia, setPersonalPhoto, personalPhoto } from "../domain/media";
import {
  addChild,
  addFact,
  addParent,
  addPartner,
  addResearchNote,
  addSibling,
  createFamily,
  createPerson,
  deleteFact,
  detachChild,
  detachPartner,
  updatePerson,
} from "../domain/tree";
import type { Family, ImportReport, Person, Tree } from "../domain/types";
import { exportGedcom } from "../gedcom/export";
import { importGedcom } from "../gedcom/import";
import {
  BUILD_ID,
  exportPage,
  familyPage,
  importPage,
  listPage,
  newPersonPage,
  notFound,
  personPage,
} from "./pages";
import { familyLayout, type TreeViewMode, wrapDisplayName } from "../views/family";
import { kinOf, preferredEvent, preferredName } from "../domain/tree";
import { yearOf } from "../views/list";

export interface AppStore {
  tree: Tree;
  lastReport?: ImportReport;
}

const html = (body: string, status = 200): Response =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-heritage-build": BUILD_ID,
      // Never cache app HTML: geometry and viewer JS change often in dev,
      // and a stale cached page renders new API data with old wire code
      // (sharp corners + doubled elbows) — exactly the reported artifact.
      "cache-control": "no-store",
    },
  });
const seeOther = (location: string): Response =>
  new Response(null, { status: 303, headers: { location } });

function replacePerson(tree: Tree, updated: Person): Tree {
  return { ...tree, persons: tree.persons.map((p) => (p.id === updated.id ? updated : p)) };
}

function replaceFamily(tree: Tree, updated: Family): Tree {
  return { ...tree, families: tree.families.map((f) => (f.id === updated.id ? updated : f)) };
}

export function createApp(store: AppStore): { fetch: (req: Request) => Response | Promise<Response> } {
  return {
    fetch: async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const path = url.pathname;
      try {
        return await route(store, req, url, path);
      } catch (err) {
        return html(notFound(err instanceof Error ? err.message : "page"), 404);
      }
    },
  };
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "x-heritage-build": BUILD_ID,
      "cache-control": "no-store",
    },
  });

function parseView(url: URL): TreeViewMode {
  const view = url.searchParams.get("view");
  return view === "pedigree" || view === "fan" ? view : "family";
}

function parseDepth(url: URL, view: TreeViewMode): { depth: number } {
  const raw = url.searchParams.get("depth");
  if (raw === null) return { depth: view === "family" ? Number.POSITIVE_INFINITY : 5 };
  if (raw === "") return { depth: view === "family" ? Number.POSITIVE_INFINITY : 5 };
  if (raw === "all") return { depth: Number.POSITIVE_INFINITY };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { depth: view === "family" ? Number.POSITIVE_INFINITY : 5 };
  return { depth: Math.min(12, Math.floor(n)) };
}

function parseSiblings(url: URL): boolean {
  return parseFlag(url, "siblings", true);
}

function parseFlag(url: URL, param: string, fallback: boolean): boolean {
  const raw = url.searchParams.get(param);
  if (raw === null) return fallback;
  return raw !== "0" && raw.toLowerCase() !== "false";
}

function parseIdSet(url: URL, param: string): Set<string> {
  return new Set(
    (url.searchParams.get(param) ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 500),
  );
}

function personSummary(tree: Tree, p: Person): Record<string, unknown> {
  const birth = preferredEvent(p.events, "BIRT");
  const death = preferredEvent(p.events, "DEAT");
  return {
    id: p.id,
    name: preferredName(p) || "(no name)",
    nameLines: wrapDisplayName(preferredName(p) || "(no name)"),
    sex: p.sex,
    living: p.isLiving,
    birthYear: yearOf(birth?.dateRaw),
    deathYear: yearOf(death?.dateRaw),
    photo: personalPhoto(p, tree)?.path,
  };
}

async function route(store: AppStore, req: Request, url: URL, path: string): Promise<Response> {
  if (req.method === "GET" && path === "/api/people") {
    const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    if (query.length < 2) return json({ people: [], total: 0 });
    const matches = store.tree.persons.filter((person) => {
      const name = preferredName(person).toLowerCase();
      return name.includes(query);
    });
    return json({
      total: matches.length,
      people: matches.slice(0, 20).map((person) => ({ id: person.id, name: preferredName(person) || "(no name)" })),
    });
  }
  if (req.method === "GET" && path === "/api/tree") {
    if (store.tree.persons.length === 0) return json({ root: null, nodes: [], edges: [], width: 0, height: 0 });
    const root = url.searchParams.get("root") ?? store.tree.persons[0]!.id;
    const view = parseView(url);
    try {
      const layout = familyLayout(store.tree, root, {
        ...parseDepth(url, view),
        collapsedFamilyIds: parseIdSet(url, "collapsed"),
        expandedAncestorIds: parseIdSet(url, "expand"),
        minimizedAncestorIds: parseIdSet(url, "min"),
        showSiblings: parseSiblings(url),
        siblingPersonIds: parseIdSet(url, "siblingsOf"),
        showYears: parseFlag(url, "years", true),
        showPhotos: parseFlag(url, "photos", false),
        view,
      });
      const summaries = new Map(store.tree.persons.map((p) => [p.id, personSummary(store.tree, p)]));
      return json({
        root,
        totalPeople: store.tree.persons.length,
        width: layout.width,
        height: layout.height,
        siblingCount: layout.siblingCount,
        showSiblings: layout.showSiblings,
        truncatedCount: layout.truncatedCount,
        nodeWidth: layout.nodeWidth,
        nodeHeight: layout.nodeHeight,
        view: layout.view,
        nodes: layout.nodes.map((n) => ({ ...n, ...summaries.get(n.personId) })),
        edges: layout.edges,
        buses: layout.buses,
      });
    } catch {
      return json({ error: "person not found" }, 404);
    }
  }
  const apiPerson = /^\/api\/person\/([^/]+)$/.exec(path);
  if (req.method === "GET" && apiPerson) {
    const p = store.tree.persons.find((q) => q.id === apiPerson![1]);
    if (!p) return json({ error: "person not found" }, 404);
    const nameOf = (q: Person): string => preferredName(q) || "(no name)";
    const kin = kinOf(store.tree, p);
    const brief = (q: Person): { id: string; name: string } => ({ id: q.id, name: nameOf(q) });
    const siblingIds = new Set<string>();
    for (const link of p.famc) {
      const fam = store.tree.families.find((f) => f.id === link.familyId);
      for (const child of fam?.children ?? []) if (child !== p.id) siblingIds.add(child);
    }
    return json({
      ...personSummary(store.tree, p),
      facts: p.events.map((e) => ({ type: e.type, date: e.dateRaw, place: e.place?.raw })),
      parents: kin.parents.map(brief),
      partners: kin.partners.map(brief),
      children: kin.children.map(brief),
      notes: p.researchNotes,
      siblingCount: siblingIds.size,
    });
  }
  if (req.method === "GET" && path === "/") {
    const view = parseView(url);
    return html(
      familyPage(
        store.tree,
        url.searchParams.get("root") ?? undefined,
        url.searchParams.has("depth") ? parseDepth(url, view).depth : undefined,
        parseIdSet(url, "collapsed"),
        parseIdSet(url, "expand"),
        parseSiblings(url),
        parseIdSet(url, "siblingsOf"),
        view,
        parseIdSet(url, "min"),
      ),
    );
  }
  if (req.method === "GET" && path === "/list") {
    return html(
      listPage(store.tree, {
        surname: url.searchParams.get("surname") ?? undefined,
        sort: (url.searchParams.get("sort") as "surname" | "given" | "birth" | "death" | null) ?? undefined,
      }),
    );
  }
  if (req.method === "GET" && path === "/person/new") return html(newPersonPage());
  if (req.method === "POST" && path === "/person/new") {
    const form = await req.formData();
    const p = createPerson({
      given: String(form.get("given") ?? ""),
      surname: String(form.get("surname") ?? "") || undefined,
    });
    store.tree = { ...store.tree, persons: [...store.tree.persons, p] };
    return seeOther(`/person/${p.id}`);
  }
  const personMatch = /^\/person\/([^/]+)(\/.*)?$/.exec(path);
  if (personMatch) {
    const person = store.tree.persons.find((p) => p.id === personMatch![1]);
    if (!person) return html(notFound("person"), 404);
    const sub = personMatch![2] ?? "";
    if (req.method === "GET" && sub === "") return html(personPage(store.tree, person));
    if (req.method === "POST") {
      const form = await req.formData();
      return mutatePerson(store, person, sub, form);
    }
    return html(notFound("page"), 404);
  }
  if (req.method === "GET" && path === "/import") {
    return html(importPage(url.searchParams.get("report") ? store.lastReport : undefined));
  }
  if (req.method === "POST" && path === "/import") {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return html(notFound("file"), 400);
    const { tree, report } = importGedcom(new Uint8Array(await file.arrayBuffer()));
    store.tree = tree;
    store.lastReport = report;
    return seeOther("/import?report=1");
  }
  if (req.method === "GET" && path === "/export") return html(exportPage(store.tree));
  if (req.method === "GET" && path === "/export.ged") {
    const ged = exportGedcom(store.tree, {
      livingFilter: (url.searchParams.get("living") as "none" | "redact" | "exclude" | null) ?? "none",
      includeMedia: url.searchParams.get("media") !== "0",
      branchRootId: url.searchParams.get("branch") ?? undefined,
    });
    return new Response(ged, {
      headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": 'attachment; filename="heritage.ged"' },
    });
  }
  return html(notFound("page"), 404);
}

function str(form: FormData, k: string): string | undefined {
  const v = form.get(k);
  return v === null || v === "" ? undefined : String(v);
}

async function mutatePerson(store: AppStore, person: Person, sub: string, form: FormData): Promise<Response> {
  switch (sub) {
    case "/edit": {
      let updated = updatePerson(person, {
        given: str(form, "given"),
        surname: str(form, "surname"),
        display: str(form, "display"),
        sex: (str(form, "sex") as Person["sex"] | undefined) ?? undefined,
        private: form.get("private") === "1",
        biography: str(form, "biography"),
      });
      const living = form.get("living") === "1";
      updated = { ...updated, isLiving: living };
      store.tree = replacePerson(store.tree, updated);
      return seeOther(`/person/${person.id}`);
    }
    case "/fact": {
      const type = str(form, "type");
      if (!type) return seeOther(`/person/${person.id}`);
      const { person: updated } = addFact(person, { type, dateRaw: str(form, "date"), placeRaw: str(form, "place") });
      store.tree = replacePerson(store.tree, updated);
      return seeOther(`/person/${person.id}`);
    }
    case "/fact/delete": {
      const id = str(form, "id");
      if (id) store.tree = replacePerson(store.tree, deleteFact(person, id));
      return seeOther(`/person/${person.id}`);
    }
    case "/relation":
      return addRelation(store, person, form);
    case "/detach": {
      const fid = str(form, "family");
      const family = store.tree.families.find((f) => f.id === fid);
      if (!family) return seeOther(`/person/${person.id}`);
      if (str(form, "role") === "partner") {
        const { family: nf, updatedPartner } = detachPartner({ family, partnerId: person.id, partner: person });
        store.tree = replacePerson(replaceFamily(store.tree, nf), updatedPartner ?? person);
      } else {
        const { family: nf, updatedChild } = detachChild({ family, childId: person.id, child: person });
        store.tree = replacePerson(replaceFamily(store.tree, nf), updatedChild ?? person);
      }
      return seeOther(`/person/${person.id}`);
    }
    case "/photo": {
      const path = str(form, "path");
      if (!path) return seeOther(`/person/${person.id}`);
      const { tree: t1, media } = addMedia(store.tree, {
        path,
        title: str(form, "title"),
        dateRaw: str(form, "date"),
        placeRaw: str(form, "place"),
      });
      store.tree = replacePerson(t1, setPersonalPhoto(person, media.id));
      return seeOther(`/person/${person.id}`);
    }
    case "/note": {
      const text = str(form, "text");
      if (text) store.tree = replacePerson(store.tree, addResearchNote(person, text));
      return seeOther(`/person/${person.id}`);
    }
    default:
      return html(notFound("action"), 404);
  }
}

async function addRelation(store: AppStore, person: Person, form: FormData): Promise<Response> {
  const kind = str(form, "kind") ?? "child";
  const pedi = (str(form, "pedi") ?? undefined) as "adoptive" | "foster" | undefined;
  const existingId = str(form, "existing");
  const other: Person = existingId
    ? store.tree.persons.find((p) => p.id === existingId) ?? person
    : createPerson({ given: str(form, "given") ?? "Unknown", surname: str(form, "surname") });
  let tree = store.tree;
  if (!existingId) tree = { ...tree, persons: [...tree.persons, other] };
  const savePerson = (p: Person): void => {
    tree = replacePerson(tree, p);
  };
  const saveFamily = (f: Family): void => {
    tree = tree.families.some((x) => x.id === f.id) ? replaceFamily(tree, f) : { ...tree, families: [...tree.families, f] };
  };
  if (kind === "spouse") {
    const { family, updatedA, updatedB } = addPartner({ a: person, b: other });
    saveFamily(family);
    savePerson(updatedA);
    savePerson(updatedB);
  } else if (kind === "parent") {
    const { family, updatedChild, updatedParent } = addParent({ child: person, parent: other, pedi });
    saveFamily(family);
    savePerson(updatedChild);
    savePerson(updatedParent);
  } else if (kind === "sibling") {
    const host =
      tree.families.find((f) => person.famc.some((l) => l.familyId === f.id)) ?? createFamily({ partners: [] });
    const withSelf = addSibling({ family: host, siblingId: person.id });
    const withOther = addSibling({ family: withSelf.family, siblingId: other.id, sibling: other, pedi });
    saveFamily(withOther.family);
    const cur = tree.persons.find((p) => p.id === person.id)!;
    if (!cur.famc.some((l) => l.familyId === host.id)) {
      savePerson({ ...cur, famc: [...cur.famc, { familyId: host.id }] });
    }
    if (withOther.updatedSibling) savePerson(withOther.updatedSibling);
  } else {
    // child of this person (needs a family; reuse first fams or create)
    const host =
      tree.families.find((f) => person.fams.includes(f.id)) ?? createFamily({ partners: [person.id] });
    const withHost: Family = host.partners.includes(person.id)
      ? host
      : { ...host, partners: [...host.partners, person.id] };
    const { family, updatedParent, updatedChild } = addChild({ family: withHost, childId: other.id, parent: person, child: other });
    void updatedParent;
    saveFamily(family);
    const cur = tree.persons.find((p) => p.id === person.id)!;
    if (!cur.fams.includes(family.id)) savePerson({ ...cur, fams: [...cur.fams, family.id] });
    if (updatedChild) savePerson(updatedChild);
  }
  store.tree = tree;
  return seeOther(`/person/${person.id}`);
}
