import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, type AppStore } from "../src/app/app";
import { NODE_W } from "../src/views/family";
import { emptyTree } from "../src/domain/tree";
import { addParent, createPerson } from "../src/domain/tree";

function app(): { store: AppStore; fetch: (req: Request) => Promise<Response> } {
  const store: AppStore = { tree: emptyTree() };
  const { fetch } = createApp(store);
  return { store, fetch: (req) => Promise.resolve(fetch(req)) };
}

async function text(res: Response): Promise<string> {
  return await res.text();
}

const isPh = (n: { kind?: string }): boolean => n.kind === "placeholder";
const personNodes = (nodes: { kind?: string }[]) => nodes.filter((n) => !isPh(n));

describe("heritage app", () => {
  test("empty tree shows entry points (add person + import)", async () => {
    const { fetch } = app();
    const body = await text(await fetch(new Request("http://x/")));
    expect(body).toContain("/person/new");
    expect(body).toContain("/import");
  });

  test("create person → family view shows the card with photo placeholder", async () => {
    const { fetch, store } = app();
    const res = await fetch(
      new Request("http://x/person/new", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "given=Ada&surname=Lovelace",
      }),
    );
    expect(res.status).toBe(303);
    const body = await text(await fetch(new Request("http://x/")));
    expect(body).toContain("Ada Lovelace");
    expect(store.tree.persons).toHaveLength(1);
  });

  test("add child relation → both cards + parent edge", async () => {
    const { fetch } = app();
    const adaId = await create(fetch, "Ada", "Lovelace");
    await fetch(
      new Request(`http://x/person/${adaId}/relation`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "kind=child&given=Kid&surname=Lovelace",
      }),
    );
    const body = await text(await fetch(new Request("http://x/")));
    expect(body).toContain("Ada Lovelace");
    expect(body).toContain("Kid Lovelace");
  });

  test("list view filters by surname and sorts", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    await create(fetch, "Zed", "Young");
    const filtered = await text(await fetch(new Request("http://x/list?surname=love")));
    expect(filtered).toContain("Ada Lovelace");
    expect(filtered).not.toContain("Zed Young");
    const sorted = await text(await fetch(new Request("http://x/list?sort=given")));
    expect(sorted.indexOf("Ada")).toBeLessThan(sorted.indexOf("Zed"));
  });

  test("person page shows facts; add fact appears", async () => {
    const { fetch } = app();
    const id = await create(fetch, "Ada", "Lovelace");
    await fetch(
      new Request(`http://x/person/${id}/fact`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "type=BIRT&date=10+DEC+1815&place=London",
      }),
    );
    const body = await text(await fetch(new Request(`http://x/person/${id}`)));
    expect(body).toContain("BIRT");
    expect(body).toContain("10 DEC 1815");
  });

  test("import fixture populates the tree and shows the report", async () => {
    const { fetch, store } = app();
    const ged = readFileSync(join(__dirname, "fixtures", "minimal-551.ged"));
    const form = new FormData();
    form.append("file", new File([ged], "tree.ged", { type: "text/plain" }));
    const res = await fetch(new Request("http://x/import", { method: "POST", body: form }));
    expect(res.status).toBe(303);
    expect(store.tree.persons).toHaveLength(2);
    const report = await text(await fetch(new Request("http://x/import?report=1")));
    expect(report).toContain("5.5.1");
    expect(report).toContain("2");
  });

  test("export downloads gedcom honoring the living filter", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    const full = await text(await fetch(new Request("http://x/export.ged")));
    expect(full.trimEnd().endsWith("0 TRLR")).toBe(true);
    expect(full).toContain("Lovelace");
    const redacted = await text(await fetch(new Request("http://x/export.ged?living=redact")));
    expect(redacted).toContain("Living");
    expect(redacted).not.toContain("Lovelace");
  });

  test("unknown person and bad routes are 404", async () => {
    const { fetch } = app();
    expect((await fetch(new Request("http://x/person/ghost"))).status).toBe(404);
    expect((await fetch(new Request("http://x/nope"))).status).toBe(404);
  });

  test("api/tree serves layout JSON with person summaries", async () => {
    const { fetch } = app();
    const adaId = await create(fetch, "Ada", "Lovelace");
    await fetch(
      new Request(`http://x/person/${adaId}/relation`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "kind=child&given=Kid&surname=Lovelace",
      }),
    );
    const res = await fetch(new Request("http://x/api/tree"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      nodes: { personId: string; name: string; generation: number }[];
      edges: { kind: string }[];
      limit: number;
    };
    expect(data.nodes).toHaveLength(2);
    expect(data.limit).toBe(500);
    expect(data.nodes.map((n) => n.name).sort()).toEqual(["Ada Lovelace", "Kid Lovelace"]);
    expect(data.edges.some((e) => e.kind === "parent")).toBe(true);
    const shallow = (await (await fetch(new Request("http://x/api/tree?depth=0"))).json()) as typeof data;
    expect(shallow.nodes.filter((n) => n.generation !== undefined && n.name)).toHaveLength(1);
    expect(shallow.nodes.filter((n) => !n.name)).toHaveLength(1); // one placeholder for the cut branch
    expect((await fetch(new Request("http://x/api/tree?root=ghost"))).status).toBe(404);
  });

  test("invalid depth falls back to the full tree", async () => {
    const { fetch } = app();
    const adaId = await create(fetch, "Ada", "Lovelace");
    await fetch(
      new Request(`http://x/person/${adaId}/relation`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "kind=child&given=Kid&surname=Lovelace",
      }),
    );
    const res = await fetch(new Request("http://x/api/tree?depth=abc"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { nodes: unknown[] };
    expect(data.nodes).toHaveLength(2);
  });

  test("tree API defaults to the full family branch", async () => {
    const { fetch, store } = app();
    let parentId = await create(fetch, "Gen0", "Test");
    for (const name of ["Gen1", "Gen2", "Gen3"]) {
      await fetch(
        new Request(`http://x/person/${parentId}/relation`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: `kind=child&given=${name}&surname=Test`,
        }),
      );
      parentId = store.tree.persons.find((p) => p.names[0]?.given === name)!.id;
    }
    const rootId = store.tree.persons.find((p) => p.names[0]?.given === "Gen0")!.id;
    const def = (await (await fetch(new Request(`http://x/api/tree?root=${rootId}`))).json()) as {
      nodes: { personId: string }[];
    };
    expect(def.nodes).toHaveLength(4);
    const shallow = (await (await fetch(new Request(`http://x/api/tree?root=${rootId}&depth=1`))).json()) as {
      nodes: { kind?: string }[];
    };
    expect(personNodes(shallow.nodes)).toHaveLength(2);
  });

  test("siblings show by default and hide with siblings=0", async () => {
    const { fetch, store } = app();
    const parent = await create(fetch, "Parent", "One");
    const grandparent = await create(fetch, "Grandparent", "One");
    await fetch(
      new Request(`http://x/person/${parent}/relation`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `kind=parent&existing=${grandparent}`,
      }),
    );
    await fetch(
      new Request(`http://x/person/${grandparent}/relation`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "kind=child&given=Uncle&surname=One",
      }),
    );
    const uncle = store.tree.persons.find((p) => p.names[0]?.given === "Uncle")!;
    const def = (await (
      await fetch(new Request(`http://x/api/tree?root=${parent}&depth=1`))
    ).json()) as { nodes: { personId: string }[] };
    expect(def.nodes.some((n) => n.personId === grandparent)).toBe(true);
    expect(def.nodes.some((n) => n.personId === uncle.id)).toBe(true);
    const hidden = (await (
      await fetch(new Request(`http://x/api/tree?root=${parent}&depth=1&siblings=0`))
    ).json()) as { nodes: { personId: string }[] };
    expect(hidden.nodes.some((n) => n.personId === uncle.id)).toBe(false);
    expect(hidden.nodes.some((n) => n.personId === grandparent)).toBe(true);
    const detail = (await (
      await fetch(new Request(`http://x/api/person/${parent}`))
    ).json()) as { siblingCount: number };
    expect(detail.siblingCount).toBe(1);
  });

  test("tree API collapses a branch without deleting its people", async () => {
    const { fetch, store } = app();
    const root = await create(fetch, "Root", "One");
    await fetch(new Request(`http://x/person/${root}/relation`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "kind=child&given=Child&surname=One",
    }));
    const child = store.tree.persons.find((p) => p.names[0]?.given === "Child")!;
    await fetch(new Request(`http://x/person/${child.id}/relation`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "kind=child&given=Grandchild&surname=One",
    }));
    const family = store.tree.families.find((candidate) => candidate.partners.includes(root))!;
    const expanded = await (await fetch(new Request(`http://x/api/tree?root=${root}&depth=2`))).json() as { nodes: { kind?: string }[] };
    const collapsed = await (await fetch(new Request(`http://x/api/tree?root=${root}&depth=2&collapsed=${family.id}`))).json() as { nodes: { kind?: string }[] };
    expect(personNodes(expanded.nodes)).toHaveLength(3);
    expect(personNodes(collapsed.nodes)).toHaveLength(1);
    expect(collapsed.nodes.filter(isPh)).toHaveLength(1);
    expect(store.tree.persons).toHaveLength(3);
  });

  test("pedigree and fan APIs return ancestor-only layouts", async () => {
    const { fetch, store } = app();
    const parent = await create(fetch, "Parent", "One");
    await fetch(new Request(`http://x/person/${parent}/relation`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "kind=child&given=Child&surname=One",
    }));
    const childId = await create(fetch, "Root", "Two");
    // Use an explicit family via a parent link so the child has an ancestor.
    await fetch(new Request(`http://x/person/${childId}/relation`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `kind=parent&existing=${parent}`,
    }));
    await fetch(new Request(`http://x/person/${childId}/relation`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "kind=child&given=Descendant&surname=Two",
    }));
    const descendantId = store.tree.persons.find((p) => p.names[0]?.given === "Descendant")!.id;
    const pedigree = await (await fetch(new Request(`http://x/api/tree?view=pedigree&root=${childId}&depth=1`))).json() as { view: string; nodes: { personId: string }[] };
    const fan = await (await fetch(new Request(`http://x/api/tree?view=fan&root=${childId}&depth=1`))).json() as { view: string; nodeWidth: number; nodes: { personId: string }[] };
    expect(pedigree.view).toBe("pedigree");
    expect(pedigree.nodes.map((n) => n.personId)).toContain(parent);
    expect(pedigree.nodes.map((n) => n.personId)).not.toContain(descendantId);
    expect(fan.view).toBe("fan");
    expect(fan.nodeWidth).toBeLessThan(NODE_W);
    expect(fan.nodes.map((n) => n.personId)).toEqual(pedigree.nodes.map((n) => n.personId));
  });

  test("api/person serves facts and relations", async () => {
    const { fetch } = app();
    const id = await create(fetch, "Ada", "Lovelace");
    await fetch(
      new Request(`http://x/person/${id}/fact`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "type=BIRT&date=1815",
      }),
    );
    const res = await fetch(new Request(`http://x/api/person/${id}`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { name: string; facts: { type: string; date?: string; place?: string }[] };
    expect(data.name).toBe("Ada Lovelace");
    expect(data.facts).toEqual([{ type: "BIRT", date: "1815", place: undefined }]);
    expect((await fetch(new Request("http://x/api/person/ghost"))).status).toBe(404);
  });

  test("api/person serves biography, media, and the relation to the root", async () => {
    const { store, fetch } = app();
    const parent = createPerson({ given: "Parent", sex: "M" });
    const root = createPerson({ given: "Root", sex: "F" });
    const kid = {
      ...createPerson({ given: "Kid", sex: "F" }),
      biography: "Born at home.",
      mediaIds: ["m1", "gone"],
    };
    const up = addParent({ child: root, parent });
    const down = addParent({ child: kid, parent: up.updatedChild });
    store.tree = {
      ...emptyTree(),
      persons: [up.updatedParent, down.updatedParent, down.updatedChild],
      families: [up.family, down.family],
      media: [
        {
          id: "m1",
          path: "photos/kid.jpg",
          title: "Kid at three",
          dateRaw: "1900",
          place: { raw: "Oslo" },
        },
      ],
    };
    const res = await fetch(
      new Request(`http://x/api/person/${kid.id}?root=${root.id}`),
    );
    const data = (await res.json()) as {
      relation: string;
      biography: string;
      mediaCount: number;
      media: { id: string; path: string; title: string; date: string; place: string; missing?: true }[];
    };
    expect(data.relation).toBe("Daughter");
    expect(data.biography).toBe("Born at home.");
    expect(data.mediaCount).toBe(2);
    expect(data.media[0]).toEqual({
      id: "m1",
      path: "photos/kid.jpg",
      title: "Kid at three",
      date: "1900",
      place: "Oslo",
    });
    expect(data.media[1]!.missing).toBe(true);
    const self = (await (
      await fetch(new Request(`http://x/api/person/${root.id}?root=${root.id}`))
    ).json()) as { relation: string; mediaCount: number };
    expect(self.relation).toBe("Main person");
    expect(self.mediaCount).toBe(0);
    const layout = (await (
      await fetch(new Request(`http://x/api/tree?root=${root.id}&depth=1`))
    ).json()) as { nodes: { personId: string; mediaCount?: number }[] };
    expect(layout.nodes.find((n) => n.personId === kid.id)?.mediaCount).toBe(2);
  });

  test("api/people searches across the whole tree with bounded suggestions", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    await create(fetch, "Adam", "West");
    await create(fetch, "Grace", "Hopper");
    const res = await fetch(new Request("http://x/api/people?q=ada"));
    const data = (await res.json()) as { total: number; people: { name: string }[] };
    expect(data.total).toBe(2);
    expect(data.people.map((p) => p.name)).toEqual(["Ada Lovelace", "Adam West"]);
    expect((await (await fetch(new Request("http://x/api/people?q=a"))).json()).people).toHaveLength(0);
  });

  test("photo form records date/place; private flag saves; pan links present", async () => {
    const { fetch, store } = app();
    const id = await create(fetch, "Ada", "Lovelace");
    await fetch(
      new Request(`http://x/person/${id}/photo`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "path=photos%2Fada.jpg&title=Ada&date=1840&place=London",
      }),
    );
    expect(store.tree.media[0]).toMatchObject({ dateRaw: "1840", place: { raw: "London" } });
    await fetch(
      new Request(`http://x/person/${id}/edit`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "given=Ada&surname=Lovelace&sex=F&living=1&private=1",
      }),
    );
    expect(store.tree.persons[0]?.private).toBe(true);
    const home = await text(await fetch(new Request("http://x/")));
    expect(home).toContain('id="viewer"');
    expect(home).toContain('<script src="/viewer.js"');
    expect(home).toContain('id="drawer"');
    expect(home).toContain("depthSel");
    expect(home).toContain('id="fullBtn"');
    expect(home).toContain('id="settingsBtn"');
    expect(home).toContain('id="settingsMenu"');
    expect(home).toContain('id="setPhotos"');
    expect(home).toContain('id="setYears"');
    expect(home).not.toContain("tree-view-tabs");
    expect(home).not.toContain('id="zoomReset"');
  });

  test("viewer page degrades to person links without JS", async () => {
    const { fetch } = app();
    const id = await create(fetch, "Ada", "Lovelace");
    const home = await text(await fetch(new Request("http://x/")));
    expect(home).toContain("<noscript>");
    expect(home).toContain(`/person/${id}`);
  });
});

describe("viewer script served as its own file", () => {
  test("GET /viewer.js returns the viewer script", async () => {
    const { fetch } = app();
    const res = await fetch(new Request("http://x/viewer.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    const body = await text(res);
    expect(body).toContain("getElementById('viewer')");
    expect(body).toContain("load();");
    expect(body).toContain("/api/tree");
  });

  test("family page loads the script file instead of inlining it", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    const body = await text(await fetch(new Request("http://x/")));
    expect(body).toContain('<script src="/viewer.js"');
    expect(body).not.toContain("getElementById('viewer')");
  });

  test("empty tree home has no viewer script reference", async () => {
    const { fetch } = app();
    const body = await text(await fetch(new Request("http://x/")));
    expect(body).not.toContain("/viewer.js");
  });
});

describe("drop-zone first screen", () => {
  test("empty home shows a drop zone with a file picker and help", async () => {
    const { fetch } = app();
    const body = await text(await fetch(new Request("http://x/")));
    expect(body).toContain('id="dropZone"');
    expect(body).toContain('type="file"');
    expect(body).toContain('action="/import"');
    expect(body).toContain(".ged");
    expect(body).toContain("/person/new");
  });

  test("choosing a file imports it and opens the explorer with the report", async () => {
    const { fetch } = app();
    const ged = readFileSync(join(__dirname, "fixtures", "minimal-551.ged"));
    const form = new FormData();
    form.append("file", new File([ged], "tree.ged", { type: "text/plain" }));
    const res = await fetch(new Request("http://x/import", { method: "POST", body: form }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?imported=1");
    const home = await text(await fetch(new Request("http://x/?imported=1")));
    expect(home).toContain('id="viewer"');
    expect(home).toContain("Import complete");
    expect(home).toContain("GEDCOM 5.5.1");
    expect(home).not.toContain('id="dropZone"');
  });

  test("home with a live tree opens the explorer directly", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    const body = await text(await fetch(new Request("http://x/")));
    expect(body).toContain('id="viewer"');
    expect(body).not.toContain('id="dropZone"');
  });

  test("post-import report panel stays available on the import page", async () => {
    const { fetch } = app();
    const ged = readFileSync(join(__dirname, "fixtures", "minimal-551.ged"));
    const form = new FormData();
    form.append("file", new File([ged], "tree.ged", { type: "text/plain" }));
    await fetch(new Request("http://x/import", { method: "POST", body: form }));
    const body = await text(await fetch(new Request("http://x/import?report=1")));
    expect(body).toContain("Import complete");
    expect(body).toContain("Everything imported cleanly");
  });
});

describe("browser holds the file", () => {
  test("status endpoint reports tree presence", async () => {
    const { fetch } = app();
    expect(await (await fetch(new Request("http://x/api/status"))).json()).toEqual({ tree: false });
    await create(fetch, "Ada", "Lovelace");
    expect(await (await fetch(new Request("http://x/api/status"))).json()).toEqual({ tree: true });
  });

  test("session script is served and loaded on every page", async () => {
    const { fetch } = app();
    const res = await fetch(new Request("http://x/session.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    const script = await text(res);
    expect(script).toContain("/api/status");
    expect(script).toContain("/import");
    const list = await text(await fetch(new Request("http://x/list")));
    expect(list).toContain('<script src="/session.js"');
    const home = await text(await fetch(new Request("http://x/")));
    expect(home).toContain('<script src="/session.js"');
  });
});

describe("file health page", () => {
  test("file health shows version, encoding, and counts with no query params", async () => {
    const { fetch } = app();
    const ged = readFileSync(join(__dirname, "fixtures", "minimal-551.ged"));
    const form = new FormData();
    form.append("file", new File([ged], "tree.ged", { type: "text/plain" }));
    await fetch(new Request("http://x/import", { method: "POST", body: form }));
    const body = await text(await fetch(new Request("http://x/file")));
    expect(body).toContain("File health");
    expect(body).toContain("5.5.1");
    expect(body).toContain("UTF-8");
    expect(body).toContain("People");
    expect(body).toContain("No warnings were reported.");
  });

  test("file health empty state without an import", async () => {
    const { fetch } = app();
    const body = await text(await fetch(new Request("http://x/file")));
    expect(body).toContain("File health");
    expect(body).toContain("No file");
    expect(body).toContain('href="/"');
  });

  test("file health is one click away from every page", async () => {
    const { fetch } = app();
    const home = await text(await fetch(new Request("http://x/")));
    expect(home).toContain('href="/file"');
    const list = await text(await fetch(new Request("http://x/list")));
    expect(list).toContain('href="/file"');
  });
});

describe("navigation and hidden editing", () => {
  test("nav shows only Explore, Import, Export; footer keeps secondary links and settings", async () => {
    const { fetch } = app();
    const body = await text(await fetch(new Request("http://x/list")));
    const nav = /<nav class="site-nav"[\s\S]*?<\/nav>/.exec(body)![0];
    expect(nav).toContain(">Explore<");
    expect(nav).toContain('href="/import"');
    expect(nav).toContain('href="/export"');
    expect(nav).not.toContain('href="/list"');
    expect(nav).not.toContain('href="/file"');
    expect(nav).not.toContain("/person/new");
    expect(nav).not.toContain("Add");
    expect(body).toContain('aria-label="Secondary navigation"');
    expect(body).toContain('<a href="/file">File health</a>');
    expect(body).toContain('aria-label="Settings"');
  });

  test("edit affordances are marked and hidden by default", async () => {
    const { fetch } = app();
    const id = await create(fetch, "Ada", "Lovelace");
    const person = await text(await fetch(new Request(`http://x/person/${id}`)));
    expect(person).toContain('class="edit-only"');
    expect(person).toContain(".edit-only{display:none}");
    expect(person).toContain("[data-edit=\"on\"] .edit-only{display:revert}");
    expect(person).toContain("localStorage.getItem('heritage.edit')");
    expect(person).toContain('class="read-view"');
    const home = await text(await app().fetch(new Request("http://x/")));
    expect(home).toContain('class="empty-divider edit-only"');
    const list = await text(await fetch(new Request("http://x/list")));
    expect(list).toContain('class="primary edit-only"');
  });

  test("drawer edit links are marked edit-only", async () => {
    const { fetch } = app();
    const script = await text(await fetch(new Request("http://x/viewer.js")));
    expect(script).toContain("'secondary edit-only'");
    expect(script).toContain("'primary edit-only'");
    expect(script).toContain("'Edit record'");
  });

  test("edit routes still respond in the default state", async () => {
    const { fetch, store } = app();
    const id = await create(fetch, "Ada", "Lovelace");
    const res = await fetch(
      new Request(`http://x/person/${id}/edit`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "given=Augusta&surname=Lovelace",
      }),
    );
    expect(res.status).toBe(303);
    expect(store.tree.persons[0]?.names[0]?.given).toBe("Augusta");
  });
});

describe("editing settings toggle", () => {
  test("a toggle exists and persists the choice, default off", async () => {
    const { fetch } = app();
    const home = await text(await fetch(new Request("http://x/")));
    expect(home).toContain('id="editToggle"');
    expect(home).toContain("localStorage.setItem('heritage.edit'");
    expect(home).toContain("document.documentElement.dataset.edit");
    expect(home).toContain("localStorage.getItem('heritage.edit')==='on'?'on':'off'");
  });

  test("the toggle control appears on record pages", async () => {
    const { fetch } = app();
    const id = await create(fetch, "Ada", "Lovelace");
    const person = await text(await fetch(new Request(`http://x/person/${id}`)));
    expect(person).toContain('id="editToggle"');
    const list = await text(await fetch(new Request("http://x/list")));
    expect(list).toContain('id="editToggle"');
  });
});

describe("placeholders and truncation notice", () => {
  test("the tree API returns placeholder nodes with counts", async () => {
    const { fetch, store } = app();
    const ada = await create(fetch, "Ada", "Lovelace");
    const child = await create(fetch, "Byron", "");
    const res = await fetch(
      new Request(`http://x/person/${ada}/relation`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `kind=child&given=Byron&surname=&existing=${encodeURIComponent(child)}`,
      }),
    );
    expect(res.status).toBe(303);
    const familyId = store.tree.families[0]!.id;
    const tree = (await (
      await fetch(new Request(`http://x/api/tree?root=${ada}&collapsed=${familyId}`))
    ).json()) as { nodes: { kind?: string; personId: string; hiddenDescendants?: number }[] };
    const ph = tree.nodes.find(isPh);
    expect(ph).toBeDefined();
    expect(ph!.personId).toBe(`ph:below:${ada}`);
    expect(ph!.hiddenDescendants).toBe(1);
  });

  test("the viewer draws placeholders and the notice states the 500 limit with controls", async () => {
    const { fetch } = app();
    const script = await text(await fetch(new Request("http://x/viewer.js")));
    expect(script).toContain("n.kind === 'placeholder'");
    expect(script).toContain("hiddenDescendants");
    expect(script).toContain("data.limit");
    expect(script).toContain("depthSel");
    expect(script).toContain("siblingsBtn");
  });
});

describe("depth control", () => {
  test("the branch depth control collapses and expands to a chosen depth", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    const page = await text(await fetch(new Request("http://x/")));
    expect(page).toContain('id="depthSel"');
    expect(page).toContain('aria-label="Collapse or expand to depth"');
    expect(page).toContain('title="Collapse or expand this branch to a chosen depth"');
  });
});

describe("outline panel", () => {
  test("the outline endpoint returns the branch hierarchy with hidden counts", async () => {
    const { fetch, store } = app();
    const root = await create(fetch, "Root", "Tree");
    await fetch(new Request(`http://x/person/${root}/relation`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "kind=child&given=Child&surname=Tree",
    }));
    const child = store.tree.persons.find((p) => p.names[0]?.given === "Child")!;
    await fetch(new Request(`http://x/person/${child.id}/relation`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "kind=child&given=Grandchild&surname=Tree",
    }));
    const full = (await (await fetch(new Request(`http://x/api/outline?root=${root}`))).json()) as {
      root: string;
      tree: { id: string; name: string; hiddenAncestors: number; hiddenDescendants: number; children: { id: string; hiddenDescendants: number; children: { id: string }[] }[]; parents: unknown[] };
    };
    expect(full.root).toBe(root);
    expect(full.tree.name).toBe("Root Tree");
    expect(full.tree.children[0]!.children[0]).toBeDefined();
    expect(full.tree.hiddenDescendants).toBe(0);
    const cut = (await (await fetch(new Request(`http://x/api/outline?root=${root}&depth=1`))).json()) as typeof full;
    expect(cut.tree.children).toHaveLength(1);
    expect(cut.tree.children[0]!.children).toHaveLength(0);
    expect(cut.tree.children[0]!.hiddenDescendants).toBe(1);
    expect((await fetch(new Request("http://x/api/outline?root=ghost"))).status).toBe(404);
    const dflt = (await (await fetch(new Request("http://x/api/outline"))).json()) as typeof full;
    expect(dflt.root).toBe(root);
    const fresh = app();
    const empty = (await (await fresh.fetch(new Request("http://x/api/outline"))).json()) as { tree: unknown };
    expect(empty.tree).toBeNull();
  });

  test("family page ships the outline panel and toolbar toggle", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    const page = await text(await fetch(new Request("http://x/")));
    expect(page).toContain('id="outline"');
    expect(page).toContain('id="outlineBtn"');
    expect(page).toContain('aria-label="Branch outline"');
  });

  test("the viewer fetches, renders, and refocuses from the outline", async () => {
    const { fetch } = app();
    const script = await text(await fetch(new Request("http://x/viewer.js")));
    expect(script).toContain("'/api/outline?'");
    expect(script).toContain("renderOutline");
    expect(script).toContain("outlineBtn");
    expect(script).toContain("focusBranch(node.id, node.name");
  });
});

describe("print to pdf", () => {
  test("the viewer toolbar ships the print button, title, and print stylesheet", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    const page = await text(await fetch(new Request("http://x/")));
    expect(page).toContain('id="printBtn"');
    expect(page).toContain("Print / Save as PDF");
    expect(page).toContain('id="printTitle"');
    expect(page).toContain("@media print");
  });

  test("the viewer prints the current view through the dialog", async () => {
    const { fetch } = app();
    const script = await text(await fetch(new Request("http://x/viewer.js")));
    expect(script).toContain("window.print()");
    expect(script).toContain("printTitle.textContent");
    expect(script).toContain("matchMedia('print')");
    expect(script).toContain("personSearch.value = ''");
  });
});

describe("download svg", () => {
  test("the viewer toolbar ships the download SVG button", async () => {
    const { fetch } = app();
    await create(fetch, "Ada", "Lovelace");
    const page = await text(await fetch(new Request("http://x/")));
    expect(page).toContain('id="svgBtn"');
    expect(page).toContain("Download SVG");
  });

  test("the viewer serializes the current view to an SVG file", async () => {
    const { fetch } = app();
    const script = await text(await fetch(new Request("http://x/viewer.js")));
    expect(script).toContain("XMLSerializer");
    expect(script).toContain("image/svg+xml");
    expect(script).toContain(".download =");
    expect(script).toContain("setAttribute('xmlns'");
    expect(script).toContain("viewBox");
  });

  test("the viewer script compiles as JavaScript", async () => {
    const { fetch } = app();
    const script = await text(await fetch(new Request("http://x/viewer.js")));
    expect(() => new Function(script)).not.toThrow();
  });
});

async function create(fetch: (req: Request) => Promise<Response>, given: string, surname: string): Promise<string> {
  const res = await fetch(
    new Request("http://x/person/new", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `given=${given}&surname=${surname}`,
    }),
  );
  const loc = res.headers.get("location") ?? "";
  return loc.split("/").pop()!;
}
