# Heritage

Family tree maker tools + GEDCOM import/export: a Bun-served, server-rendered web app for building and editing family trees (people, relationships, facts, media) with GEDCOM round-trip.

## Language

### Deployment

**Demo deploy**:
The free, ephemeral Render hosting of the current app: sleeps when idle, loses in-memory state on wake.
_Avoid_: production deploy, staging

**Sleep**:
Render spinning the free service down after 15 minutes without traffic (~1 minute to wake).
_Avoid_: shutdown, suspend, scale-to-zero
