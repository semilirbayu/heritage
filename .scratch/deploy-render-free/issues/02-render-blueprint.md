# 02: Render Blueprint in repo

**What to build:** A committed Render Blueprint file declaring the free web service, so the demo deploy is reproducible from git alone with no tribal dashboard knowledge.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Blueprint declares a web service on the free plan with the native Bun runtime
- [x] Build command installs dependencies; start command serves the existing entry point; health check hits the already-proven root endpoint
- [x] Every key in the file validates against Render's Blueprint spec
- [x] No application code changes

## Comments

- 2026-10-14: added `render.yaml` (web service `heritage`, `runtime: node` per Bun's official Render guide — Bun ships in the JS/TS native runtime, `bun install` / `bun src/main.ts`, health check `/`, `plan: free`). Region/branch/auto-deploy left at Render defaults per grill (default region, blueprint's branch, deploy on commit). Every key checked against the fetched Blueprint spec; YAML parses. No app code changes. Full validation (`render blueprints validate` / first sync) happens with ticket 03's live run. Note: Render's default Bun lags local (1.3.14); no `BUN_VERSION` pin — revisit only if build/start ever misbehave.
