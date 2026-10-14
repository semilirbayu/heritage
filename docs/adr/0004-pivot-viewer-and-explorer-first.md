# Pivot: viewer and explorer first

Heritage started as a MyHeritage-style tree editor (build and edit family trees, GEDCOM round-trip). We decided that explore is the main job of the app: import a `.ged` file, explore the tree, always-visible file health, and export of the view (PDF, SVG). The target user arrives with a downloaded file from Ancestry, MyHeritage, or FamilySearch and wants to understand it, not author it. Editing stays behind a settings toggle and does not grow; the editor code remains because it works, is tested, and costs little to keep.

## Considered Options

- **Remove editing entirely** — rejected: throws away working, tested software for no user benefit.
- **Keep investing in editing** — rejected: contradicts the pivot; the app would compete as an editor, not as the best `.ged` viewer.
- **Editing stays in primary navigation** — rejected: navigation must tell every visitor that this app is an explorer.
