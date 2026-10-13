// Media links + personal photos. Bytes are never stored: a Media is a link
// (relative path, absolute path, or URL) with metadata. Personal photo =
// mediaIds[0] by convention. Sidecar: relative paths resolve under media/
// next to the .ged file on export.

import { newId } from "./tree";
import type { Media, Person, Tree } from "./types";

export const SIDECAR_DIR = "media";

export function addMedia(
  tree: Tree,
  input: { path: string; mime?: string; title?: string; dateRaw?: string; placeRaw?: string },
): { tree: Tree; media: Media } {
  const media: Media = {
    id: newId("m"),
    path: input.path,
    ...(input.mime ? { mime: input.mime } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.dateRaw ? { dateRaw: input.dateRaw } : {}),
    ...(input.placeRaw ? { place: { raw: input.placeRaw } } : {}),
  };
  return { tree: { ...tree, media: [...tree.media, media] }, media };
}

/** Set (or replace) the personal photo: first in mediaIds, no dupes. */
export function setPersonalPhoto(person: Person, mediaId: string): Person {
  return { ...person, mediaIds: [mediaId, ...person.mediaIds.filter((m) => m !== mediaId)] };
}

/** The personal photo, or undefined when missing/dangling. */
export function personalPhoto(person: Person, tree: Tree): Media | undefined {
  const first = person.mediaIds[0];
  if (!first) return undefined;
  return tree.media.find((m) => m.id === first);
}

/** Resolve a stored link: relative → under the sidecar dir, else as-is. Idempotent. */
export function resolveMediaPath(stored: string): string {
  if (/^([a-z]+:)?\/\//i.test(stored) || stored.startsWith("/") || stored === SIDECAR_DIR || stored.startsWith(`${SIDECAR_DIR}/`)) {
    return stored;
  }
  return `${SIDECAR_DIR}/${stored}`;
}
