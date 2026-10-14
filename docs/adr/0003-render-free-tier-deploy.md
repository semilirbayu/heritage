# ADR-0003: Render free tier for the demo deploy

**Status:** accepted (2026-10-14)

Heritage is a long-lived `Bun.serve` process with in-memory state, and hosting must be entirely free with no credit card. We deploy as a Render free web service (native Bun runtime, Blueprint `render.yaml`, auto-deploy on push to `main`, default `*.onrender.com` URL), accepting sleep-after-15-minutes and state loss on wake; persistence is explicitly out of scope.

## Considered Options

- **Northflank Sandbox** (runner-up): free and always-on, but card requirement and disk terms unverified at signup.
- **Koyeb**: forever-free instance but mandates a credit card — fails the no-card constraint.
- **Railway**: trial credit only; sustained use needs paid credit or Serverless trade-offs.
- **Fly.io**: trial-only for new accounts, then card + paid — ruled out on cost.
- **Cloudflare Workers / Vercel / Netlify / GitHub Pages**: request-driven or static runtimes that cannot host a persistent `Bun.serve` listener — ruled out on architecture, not price.

Full comparison with primary-source citations: `docs/research/deployment-free-tier.md`.

## Consequences

- 750 instance hours/month, 512 MB RAM, 5 GB bandwidth, 500 build minutes; over-quota suspends instead of billing (no card on file).
- Every sleep, redeploy, or restart wipes the tree; the demo flow is re-importing a `.ged` each visit until a persistence effort is scoped.
- A GitHub Actions workflow (`bun test` + `bun run build` on push/PR) gates `main` so broken commits never auto-deploy; free on a public repo.
