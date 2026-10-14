# 01: Serve the viewer script as its own file

**What to build:** The explorer page behaves exactly as today (pan, zoom, search, detail drawer, collapse pills), but its script is served as its own file instead of one inline blob. No build step, no new dependencies. This prefactor makes every later viewer ticket smaller.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The viewer page loads its script from its own route; behavior is unchanged
- [x] The script route returns JavaScript with the correct content type
- [x] Existing viewer behavior tests stay green
- [x] No new dependencies; no build step added
