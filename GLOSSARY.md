# Heritage

A GED file viewer and explorer: a Bun-served, server-rendered web app for exploring family trees imported from GEDCOM files (people, relationships, facts, media), with GEDCOM round-trip and export of the tree view to PDF and SVG. Explore is the main job. Editing exists but does not grow.

## Language

**File health**:
A permanent panel that shows what the app read from the imported GED file: version, encoding, record counts, and warnings.
_Avoid_: import report, health check

### Deployment

**Demo deploy**:
The free, ephemeral Render hosting of the current app: sleeps when idle, loses in-memory state on wake.
_Avoid_: production deploy, staging

**Sleep**:
Render spinning the free service down after 15 minutes without traffic (~1 minute to wake).
_Avoid_: shutdown, suspend, scale-to-zero
