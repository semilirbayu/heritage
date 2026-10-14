# Browser holds the file; the server stores nothing durable

The target user arrives with one `.ged` file and must never lose it. Render free tier has no disk; state resets on sleep, redeploy, and restart. We decided that the browser stores the raw `.ged` file and re-sends it to the server on each visit. The server keeps only a transient RAM copy of the parsed tree, which the existing API and editing routes need. Nothing is written to disk or a database. One file at a time; a new file replaces the old one.

## Considered Options

- **Server sessions with shareable URLs** — rejected: links die when the server sleeps; no user asked for sharing yet.
- **Database persistence (Render free Postgres)** — rejected: a new service, expires after 30 days, and breaks the "no user data saved" promise.
- **Fully stateless server: parse and lay out in the browser** — rejected: a rewrite of the whole app, and it removes editing, which needs a server-side tree.
- **Accept the loss; build a fast re-drop flow** — rejected: losing a family file is the worst experience for this user.

## Consequences

- A fully RAM-free server would remove editing and the current layout APIs. If that ever becomes a goal, revisit this ADR first.
- Continuity across visits and devices depends only on the browser copy.
- Shareable links need a future persistence decision and their own ADR.
