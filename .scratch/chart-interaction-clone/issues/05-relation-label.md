# 05: Relation label in the person panel

**What to build:** The panel shows how the selected person relates to the
current root person: `Your grandfather`, `Your father`, `Your cousin`.
The label updates when the user re-roots the chart.

**Blocked by:** none

**Status:** resolved

- [x] Add a pure function in the domain layer that returns a relation
      label for `(tree, rootId, personId)`.
- [x] Cover these cases: same person, partner, parent, child, sibling,
      grandparent, grandchild, aunt or uncle, niece or nephew, cousin.
- [x] Use the person's sex to pick the word. Use a neutral word when sex
      is unknown.
- [x] Fall back to `Relative` when the path is longer or not known.
- [x] In-law and half relations reach a correct word or the fallback.
      Do not return a wrong close word.
- [x] The panel shows the label under the name. When the root is the
      selected person, show `Main person`.
- [x] No new data field. The label comes from the graph that is loaded.
- [x] Unit tests cover each case, including a missing path and a cycle.
- [x] `bun test` passes and `bun run typecheck` is clean.

## Notes

Keep the function free of DOM and of the request layer. Put it beside
the existing kinship helpers in `src/domain/tree.ts`, or in a new module
when that file gets too large.

Re-rooting already clears and reloads the view. Read the root from the
viewer mount data, not from the URL, so the label and the chart agree.

The source chart says `Your grandfather` and `Your grandaunt`. Use plain
English. `Grandaunt` is not a common word. Prefer `Great-aunt`.

## Done

`relationLabel(tree, rootId, personId)` and `siblingsOf(tree, person)`
live in `src/domain/tree.ts`. The function walks `kinOf` and
`siblingsOf`, so it needs no new data. It returns:

| Relation | Words |
| --- | --- |
| same person | `Main person` |
| partner | `Husband`, `Wife`, `Partner` |
| parent | `Father`, `Mother`, `Parent` |
| child | `Son`, `Daughter`, `Child` |
| sibling | `Brother`, `Sister`, `Sibling` |
| grandparent | `Grandfather`, `Grandmother`, `Grandparent` |
| grandchild | `Grandson`, `Granddaughter`, `Grandchild` |
| parent's sibling | `Uncle`, `Aunt`, `Aunt or uncle` |
| sibling's child | `Nephew`, `Niece`, `Nephew or niece` |
| cousin | `Cousin` |
| other path | `Relative` |

In-law and great-aunt paths return `Relative`. They never return a wrong
close word.

The viewer sends the live root: `/api/person/:id?root=:root`. The API
returns `relation` only when the root exists. The drawer prints it under
the meta line. Re-rooting sets `root` before the reload, so the next
selection uses the new root.

Tests cover every word, the neutral fallback for unknown sex, a ghost id,
and a missing root. Verified in the browser: the child of the root shows
`Child`, and the root shows `Main person`.
