# 01: CI workflow

**What to build:** A GitHub Actions workflow that runs install, tests, and build on every push to `main` and every pull request, so broken changes show red before anything deploys.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Workflow file runs `bun install`, `bun test`, and `bun run build` in order
- [x] Triggers cover pushes to `main` and all pull requests
- [x] Bun is provisioned with the vendor setup action at `latest`
- [x] `bun test` passes locally with the suite unchanged (103 tests)

## Comments

- 2026-10-14: added `.github/workflows/ci.yml` (checkout@v4, oven-sh/setup-bun@v2 with `bun-version: latest`, install → test → build). No app code changes. Verified: YAML parses, typecheck clean, 103 pass, `bun run build` green. Actions-side signal confirms on first push/PR.
