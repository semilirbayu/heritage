import { describe, expect, test } from "bun:test";
import { createPerson } from "../src/domain/tree";
import {
  addMedia,
  personalPhoto,
  resolveMediaPath,
  setPersonalPhoto,
  SIDECAR_DIR,
} from "../src/domain/media";
import { emptyTree } from "../src/domain/tree";

describe("media links", () => {
  test("addMedia stores a link (never bytes) with title/date/place", () => {
    const { tree, media } = addMedia(emptyTree(), {
      path: "photos/ada.jpg",
      mime: "image/jpeg",
      title: "Ada portrait",
      dateRaw: "1840",
      placeRaw: "London",
    });
    expect(media.path).toBe("photos/ada.jpg");
    expect(tree.media).toHaveLength(1);
    expect(tree.media[0]?.title).toBe("Ada portrait");
    expect(tree.media[0]?.dateRaw).toBe("1840");
    expect(tree.media[0]?.place).toEqual({ raw: "London" });
  });

  test("setPersonalPhoto puts the photo first; replace swaps it", () => {
    const p = createPerson({ given: "Ada" });
    const t0 = emptyTree();
    const r1 = addMedia(t0, { path: "a.jpg" });
    const r2 = addMedia(r1.tree, { path: "b.jpg" });
    const withFirst = setPersonalPhoto({ ...p, mediaIds: [] }, r1.media.id);
    expect(withFirst.mediaIds[0]).toBe(r1.media.id);
    const replaced = setPersonalPhoto(withFirst, r2.media.id);
    expect(replaced.mediaIds[0]).toBe(r2.media.id);
    // previous photo kept as a regular link, no dupes
    expect(replaced.mediaIds).toEqual([r2.media.id, r1.media.id]);
    expect(personalPhoto(replaced, r2.tree)?.path).toBe("b.jpg");
  });

  test("personalPhoto is undefined without media; dangling ids resolve undefined", () => {
    const p = createPerson({ given: "Ada" });
    expect(personalPhoto(p, emptyTree())).toBeUndefined();
    expect(personalPhoto({ ...p, mediaIds: ["ghost"] }, emptyTree())).toBeUndefined();
  });

  test("sidecar convention: relative paths resolve under the media dir", () => {
    expect(SIDECAR_DIR).toBe("media");
    expect(resolveMediaPath("photos/a.jpg")).toBe("media/photos/a.jpg");
    expect(resolveMediaPath("media/photos/a.jpg")).toBe("media/photos/a.jpg");
    expect(resolveMediaPath("/abs/a.jpg")).toBe("/abs/a.jpg");
    expect(resolveMediaPath("https://x/y.jpg")).toBe("https://x/y.jpg");
  });
});
