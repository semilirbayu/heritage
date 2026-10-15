# Heritage

A GED file viewer and explorer: a Bun-served, server-rendered web app for exploring family trees imported from GEDCOM files (people, relationships, facts, media), with GEDCOM round-trip and export of the tree view to PDF and SVG. Explore is the main job. Editing exists but does not grow.

## Language

**File health**:
A permanent panel that shows what the app read from the imported GED file: version, encoding, record counts, and warnings.
_Avoid_: import report, health check

**Placeholder card**:
A dashed canvas card that stands in for a hidden branch. It shows the branch name and the hidden counts, and expands the branch on click.
_Avoid_: ghost node, dummy node, phantom card

**Outline panel**:
The side panel that lists the focused branch as a nested hierarchy, with hidden counts, and refocuses the canvas on click.
_Avoid_: tree minimap, table of contents

**Session file**:
The raw `.ged` file the browser keeps after an import. The server never stores it on disk; the browser re-sends it when the server has no tree.
_Avoid_: mirror, cached copy, uploaded file

### Deployment

**Demo deploy**:
The free, ephemeral Render hosting of the current app: sleeps when idle, loses in-memory state on wake.
_Avoid_: production deploy, staging

**Sleep**:
Render spinning the free service down after 15 minutes without traffic (~1 minute to wake).
_Avoid_: shutdown, suspend, scale-to-zero
