import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, type AppStore } from "../src/app/app";
import { emptyTree } from "../src/domain/tree";

function app(): { store: AppStore; fetch: (req: Request) => Promise<Response> } {
  const store: AppStore = { tree: emptyTree() };
  const { fetch } = createApp(store);
  return { store, fetch: (req) => Promise.resolve(fetch(req)) };
}

async function text(res: Response): Promise<string> {
  return await res.text();
}

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
    };
    expect(data.nodes).toHaveLength(2);
    expect(data.nodes.map((n) => n.name).sort()).toEqual(["Ada Lovelace", "Kid Lovelace"]);
    expect(data.edges.some((e) => e.kind === "parent")).toBe(true);
    const shallow = (await (await fetch(new Request("http://x/api/tree?depth=0"))).json()) as typeof data;
    expect(shallow.nodes).toHaveLength(1);
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
      nodes: unknown[];
    };
    expect(shallow.nodes).toHaveLength(2);
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
    const expanded = await (await fetch(new Request(`http://x/api/tree?root=${root}&depth=2`))).json() as { nodes: { id: string }[] };
    const collapsed = await (await fetch(new Request(`http://x/api/tree?root=${root}&depth=2&collapsed=${family.id}`))).json() as { nodes: { id: string }[] };
    expect(expanded.nodes).toHaveLength(3);
    expect(collapsed.nodes).toHaveLength(1);
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
    expect(fan.nodeWidth).toBeLessThan(232);
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
    expect(home).toContain("/api/tree");
    expect(home).toContain('id="drawer"');
    expect(home).toContain("depthSel");
    expect(home).toContain('id="fullBtn"');
    expect(home).toContain('id="settingsBtn"');
    expect(home).toContain('id="settingsMenu"');
    expect(home).toContain('id="setPhotos"');
    expect(home).toContain('id="setYears"');
    expect(home).toContain('id="setDefaultView"');
  });

  test("viewer page degrades to person links without JS", async () => {
    const { fetch } = app();
    const id = await create(fetch, "Ada", "Lovelace");
    const home = await text(await fetch(new Request("http://x/")));
    expect(home).toContain("<noscript>");
    expect(home).toContain(`/person/${id}`);
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
