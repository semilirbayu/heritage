import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createApp, type AppStore } from "../src/app/app";
import { familyPage } from "../src/app/pages";
import { VIEWER_JS } from "../src/app/viewerScript";
import { addChild, addPartner, createFamily, createPerson, emptyTree } from "../src/domain/tree";
import type { Tree } from "../src/domain/types";
import { renderLookSample } from "./chart-sample";
import {
  cardTextBaselines,
  chartTokens,
  depthWindow,
  edgeForSex,
  familyDepthChoices,
  peopleCountLabel,
  zoomPercent,
  zoomTier,
} from "../src/views/chartTokens";
import { COUPLE_PITCH, familyLayout, GENERATION_PITCH, NODE_H, NODE_W, X_GAP, Y_GAP } from "../src/views/family";

function app(): { store: AppStore; fetch: (req: Request) => Promise<Response> } {
  const store: AppStore = { tree: emptyTree() };
  const { fetch } = createApp(store);
  return { store, fetch: (req) => Promise.resolve(fetch(req)) };
}

describe("chart tokens", () => {
  test("measured card, type, and wire values", () => {
    expect(chartTokens.cardW).toBe(220);
    expect(chartTokens.cardH).toBe(102);
    expect(NODE_W).toBe(220);
    expect(NODE_H).toBe(102);
    expect(chartTokens.radius).toBe(8);
    expect(chartTokens.edgeWidth).toBe(2);
    expect(chartTokens.photo).toBe(64);
    expect(chartTokens.textX).toBe(82);
    expect(chartTokens.nameSize).toBe(15);
    expect(chartTokens.dateSize).toBe(15);
    expect(chartTokens.wireWidth).toBe(1);
    expect(chartTokens.initialScale).toBe(0.7);
    expect(COUPLE_PITCH).toBe(254);
    expect(GENERATION_PITCH).toBe(188);
    expect(COUPLE_PITCH).toBe(NODE_W + chartTokens.coupleGap);
    expect(GENERATION_PITCH).toBe(NODE_H + Y_GAP);
    expect(NODE_W + X_GAP).toBe(254);
    expect(X_GAP).toBeGreaterThanOrEqual(34);
  });

  test("unknown sex uses the male border token", () => {
    expect(chartTokens.edgeUnknown).toBe(chartTokens.edgeMale);
    expect(edgeForSex("U")).toBe(chartTokens.edgeMale);
    expect(edgeForSex("M")).toBe(chartTokens.edgeMale);
    expect(edgeForSex("F")).toBe(chartTokens.edgeFemale);
  });

  test("two name lines stay above the dates line", () => {
    const rows = cardTextBaselines(2);
    expect(rows.names).toHaveLength(2);
    expect(rows.date).toBeGreaterThan(rows.names[1]! + 12);
    expect(rows.date).toBeLessThan(chartTokens.cardH);
  });
});

describe("zoom tiers", () => {
  test("the label reads 100% at the initial family scale", () => {
    expect(zoomPercent(chartTokens.initialScale)).toBe(100);
    expect(zoomPercent(0.15)).toBe(21);
    expect(zoomPercent(4)).toBe(571);
    expect(zoomPercent(chartTokens.initialScale * 0.28)).toBe(28);
  });

  test("dates drop before photos, and compact drops both", () => {
    expect(zoomTier(chartTokens.initialScale * 0.85)).toBe("full");
    expect(zoomTier(chartTokens.initialScale * 0.71)).toBe("mid");
    expect(zoomTier(chartTokens.initialScale * 0.42)).toBe("mid");
    expect(zoomTier(chartTokens.initialScale * 0.28)).toBe("compact");
    expect(zoomTier(0.15)).toBe("compact");
  });

  test("compact mode widens and darkens the wire", () => {
    expect(chartTokens.wire).toBe("#999");
    expect(chartTokens.wireWidth).toBe(1);
    expect(chartTokens.wireLowZoom).toBe("#585857");
    expect(chartTokens.wireLowZoomWidth).toBe(2);
    expect(chartTokens.compactBelowPercent).toBeLessThan(chartTokens.datesBelowPercent);
  });
});

describe("chart layout pitch", () => {
  test("partner pitch and generation pitch come from the constants", () => {
    const a = createPerson({ given: "Ada", sex: "F" });
    const b = createPerson({ given: "William", sex: "M" });
    const couple = addPartner({ a, b });
    const child = createPerson({ given: "Anne", sex: "U" });
    const withChild = addChild({
      family: couple.family,
      childId: child.id,
      parent: couple.updatedA,
      child,
    });
    const tree: Tree = {
      ...emptyTree(),
      persons: [withChild.updatedParent, couple.updatedB, withChild.updatedChild!],
      families: [withChild.family],
    };
    const layout = familyLayout(tree, withChild.updatedParent.id, { depth: 1 });
    const at = new Map(layout.nodes.map((n) => [n.personId, n]));
    const left = at.get(couple.updatedB.id)!;
    const right = at.get(withChild.updatedParent.id)!;
    const kid = at.get(withChild.updatedChild!.id)!;
    expect(right.x - left.x).toBe(COUPLE_PITCH);
    expect(kid.y - right.y).toBe(GENERATION_PITCH);
  });
});

describe("depth window and counter", () => {
  test("family depth options are 1 through 5+ and All", () => {
    expect(familyDepthChoices("5").map((d) => d.label)).toEqual(["1", "2", "3", "4", "5+", "All"]);
    expect(depthWindow(5)).toEqual({ above: 5, below: 5 });
  });

  test("5+ keeps five generations above and five below", () => {
    const people = Array.from({ length: 13 }, (_, i) => createPerson({ given: `G${i}` }));
    const families = [];
    for (let i = 0; i < people.length - 1; i++) {
      families.push({ ...createFamily({ partners: [people[i]!.id] }), children: [people[i + 1]!.id] });
    }
    const tree: Tree = { ...emptyTree(), persons: people, families };
    const focus = people[6]!.id;
    const cut = familyLayout(tree, focus, { depth: 5 });
    const gens = new Set(cut.nodes.filter((n) => !n.kind).map((n) => n.generation));
    expect(gens.has(5)).toBe(true);
    expect(gens.has(-5)).toBe(true);
    expect(gens.has(6)).toBe(false);
    expect(gens.has(-6)).toBe(false);
    const all = familyLayout(tree, focus, { depth: Number.POSITIVE_INFINITY });
    const allGens = new Set(all.nodes.filter((n) => !n.kind).map((n) => n.generation));
    expect(allGens.has(6)).toBe(true);
    expect(allGens.has(-6)).toBe(true);
  });

  test("the counter reads N of M people", () => {
    expect(peopleCountLabel(1, 8)).toBe("1 of 8 people");
    expect(peopleCountLabel(4, 8)).toBe("4 of 8 people");
    expect(peopleCountLabel(1, 1)).toBe("1 of 1 person");
  });

  test("the family page opens at 5+ with cousins checked", () => {
    const person = createPerson({ given: "Ada", surname: "Lovelace" });
    const tree: Tree = { ...emptyTree(), persons: [person], families: [] };
    const page = familyPage(tree, person.id, undefined);
    expect(page).toContain('value="5" selected>5+</option>');
    expect(page).toContain('id="cousinsBtn" type="checkbox" checked');
    expect(page).toContain("Show cousins");
    expect(page).not.toContain('value="12"');
    expect(page).toContain('id="zoomLabel"');
    const kept = familyPage(tree, person.id, 6);
    expect(kept).toContain('value="6"');
    const all = familyPage(tree, person.id, Number.POSITIVE_INFINITY);
    expect(all).toContain('value="all" selected>All</option>');
  });
});

describe("show cousins", () => {
  test("checked adds the sibling line, unchecked removes it", () => {
    const parent = createPerson({ given: "Parent", sex: "M" });
    const root = createPerson({ given: "Root", sex: "M" });
    const sib = createPerson({ given: "Sib", sex: "F" });
    const niece = createPerson({ given: "Niece", sex: "F" });
    const nieceSpouse = createPerson({ given: "Ned", sex: "M" });
    const home = { ...createFamily({ partners: [parent.id] }), children: [root.id, sib.id] };
    const sibFam = addPartner({ a: sib, b: nieceSpouse });
    const withNiece = addChild({
      family: sibFam.family,
      childId: niece.id,
      parent: sibFam.updatedA,
      child: niece,
    });
    const tree: Tree = {
      ...emptyTree(),
      persons: [parent, root, withNiece.updatedParent, sibFam.updatedB, withNiece.updatedChild!],
      families: [home, withNiece.family],
    };
    const on = familyLayout(tree, root.id, { depth: 3, showSiblings: true, showCousins: true });
    const off = familyLayout(tree, root.id, { depth: 3, showSiblings: true, showCousins: false });
    const onIds = new Set(on.nodes.map((n) => n.personId));
    const offIds = new Set(off.nodes.map((n) => n.personId));
    expect(onIds.has(sib.id)).toBe(true);
    expect(onIds.has(niece.id)).toBe(true);
    expect(onIds.has(nieceSpouse.id)).toBe(true);
    expect(offIds.has(sib.id)).toBe(true);
    expect(offIds.has(niece.id)).toBe(false);
    expect(offIds.has(nieceSpouse.id)).toBe(true);
    expect(off.nodes.filter((n) => !n.kind).length).toBeLessThan(on.nodes.filter((n) => !n.kind).length);
  });
});

describe("chart snapshot", () => {
  test("the viewer reads chart tokens and the cousins flag", () => {
    expect(VIEWER_JS).toContain(chartTokens.edgeMale);
    expect(VIEWER_JS).toContain(chartTokens.edgeFemale);
    expect(VIEWER_JS).toContain("CHART.initialScale");
    expect(VIEWER_JS).toContain("CHART.textX");
    expect(VIEWER_JS).toContain("CHART.wireWidth");
    expect(VIEWER_JS).toContain(chartTokens.wireLowZoom);
    expect(VIEWER_JS).toContain("compactBelowPercent");
    expect(VIEWER_JS).toContain("zoomLabel");
    expect(VIEWER_JS).toContain("tier-");
    expect(VIEWER_JS).toContain("mediaCount");
    expect(VIEWER_JS).toContain("media-badge");
    expect(VIEWER_JS).toContain("settings.showPhotos && n.mediaCount");
    expect(VIEWER_JS).toContain("drawer-bio");
    expect(VIEWER_JS).toContain("showCousins");
    expect(VIEWER_JS).toContain("of ' + totalPeople");
    expect(VIEWER_JS).toContain("stroke-linecap': currentView === 'family' ? 'butt'");
  });

  test("a small tree keeps card anatomy in the golden svg", () => {
    const svg = renderLookSample();
    expect(svg).toContain(`width="${chartTokens.cardW}"`);
    expect(svg).toContain(`height="${chartTokens.cardH}"`);
    expect(svg).toContain(`rx="${chartTokens.radius}"`);
    expect(svg).toContain(`stroke="${chartTokens.edgeFemale}"`);
    expect(svg).toContain(`stroke="${chartTokens.edgeMale}"`);
    expect(svg).toContain('class="couple-pill"');
    expect(svg).toContain('aria-label="Edit Ada Lovelace"');
    expect(svg).toContain('aria-label="Expand branch of Anne King"');
    expect(svg).toContain(`stroke-width="${chartTokens.wireWidth}"`);
    expect(svg).toContain(`fill="${chartTokens.stage}"`);
    expect(svg).not.toContain('stroke-linecap="round"');
    const golden = readFileSync(join(import.meta.dir, "fixtures/chart-look.svg"), "utf8");
    expect(svg).toBe(golden);
  });
});

describe("family page route", () => {
  test("the served family page uses 5+ and the cousins checkbox", async () => {
    const { fetch } = app();
    await fetch(
      new Request("http://x/person/new", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "given=Ada&surname=Lovelace",
      }),
    );
    const page = await (await fetch(new Request("http://x/"))).text();
    expect(page).toContain('value="5" selected>5+</option>');
    expect(page).toContain('id="cousinsBtn" type="checkbox" checked');
    expect(page).toContain("Show cousins");
  });
});
