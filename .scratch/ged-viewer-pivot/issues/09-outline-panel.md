# 09: Outline panel

**What to build:** A side panel lists the focused branch as a hierarchy (ancestors and descendants), with hidden counts where branches are collapsed or capped. A click on any entry refocuses the canvas on that person. This is navigation like a file explorer.

**Blocked by:** 01: Serve the viewer script as its own file

**Status:** done

- [x] The panel shows the focused branch as a nested list
- [x] Collapsed or capped branches show their hidden counts
- [x] Clicking an entry refocuses the canvas on that person and updates the drawer and URL state, as existing refocus does
- [x] The panel opens and closes without breaking the canvas layout
- [x] Outline data comes from the same layout pipeline as the canvas
- [x] The outline JSON shape is covered at the HTTP seam
