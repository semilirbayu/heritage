# 07: Placeholder cards and an honest truncation notice

**What to build:** Collapsed branches show a placeholder card with a display name and hidden descendant and ancestor counts, through layout, API, and canvas. The truncated-view notice states the 500-person limit and offers the depth and sibling controls, so a partial view always explains itself.

**Blocked by:** 01: Serve the viewer script as its own file

**Status:** done

- [x] The layout emits placeholder nodes with a display name and hidden counts
- [x] The tree API returns them; the canvas draws them as distinct, clickable cards
- [x] Clicking a placeholder expands that branch
- [x] The truncation notice states the limit and offers the existing controls
- [x] The visible-people cap tests still pass
- [x] Layout geometry tests cover the placeholder node set
