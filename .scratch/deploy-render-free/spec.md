# Spec: Demo deploy on Render free tier

**Status:** ready-for-agent

## Problem Statement

Heritage only runs on a developer's machine (`bun dev`). There is no public URL to share, no repeatable deploy procedure, and no gate stopping a broken commit from becoming the shared demo.

## Solution

A demo deploy on Render's free tier: pushing to `main` auto-deploys the app to a public `*.onrender.com` URL via a committed Blueprint file, and a GitHub Actions workflow runs the test suite and build on every push and pull request. Hosting stays entirely free with no credit card; sleep and state loss are accepted properties of the demo deploy (see GLOSSARY.md), not problems to solve here.

## User Stories

1. As a developer, I want pushing to `main` to update the public demo automatically, so that sharing progress never needs manual steps.
2. As a visitor, I want a public URL that serves the Family, Pedigree, Fan, and List views, so that I can explore a tree without running code.
3. As a visitor, I want the demo to wake on first request after idle, so that an asleep service still serves me within about a minute.
4. As a visitor, I want to import a GEDCOM file into the demo after each wake, so that I can work with a real tree despite ephemeral state.
5. As a developer, I want pull requests to show test and build signal without deploying, so that broken changes are caught before merge.
6. As a developer, I want a broken `main` to be visible as a failed check, so that a red commit is never silently serving.
7. As a future maintainer, I want the deploy declared in a committed Blueprint file, so that recreating the service needs no tribal knowledge.
8. As the repo owner, I want the one-time dashboard steps captured in a guided script, so that setup happens once and is never re-explained.

## Implementation Decisions

- Deployment target is Render (ADR-0003); alternatives were evaluated in the cited research file and rejected on cost, card requirements, or architecture.
- The service uses the native Bun runtime with the existing entry point and start behavior; no Dockerfile and no application code changes.
- Service declaration lives in a Blueprint file in the repo (free plan, health check on the already-proven root endpoint, default region).
- Continuous integration uses the vendor Bun setup action followed by install, test, and build steps, triggered on pushes to `main` and on pull requests.
- The one-time human procedure (account, Blueprint service creation from the repo, first-deploy verification) is delivered as an ephemeral guided script, deleted after its run.
- Research input (`docs/research/deployment-free-tier.md`), decision record (ADR-0003), and vocabulary (GLOSSARY.md) already exist and are linked, not duplicated.

## Testing Decisions

- A good test here proves external behavior end to end: CI green on a healthy tree, red when tests or build break; the live URL serving the app after a push.
- Verification is behavioral, not snapshot-based: trigger the workflow on a test push/PR and confirm signal; visit the public URL after deploy and confirm the views serve; confirm wake-after-idle serves within the accepted window.
- Prior art: the repo's existing HTTP behavior tests (router `fetch` asserted directly) stay the suite CI runs; no new unit-test seams are introduced by this effort.

## Out of Scope

- Persistence across sleep/redeploy (volumes, databases, file-backed stores).
- Custom domains and DNS.
- Non-Render hosts, Docker images, preview environments per pull request.
- Any application code or GEDCOM behavior changes.
- Paid tiers, credit-card-backed services, uptime monitoring/alerting.

## Further Notes

- Free-tier quotas (instance hours, bandwidth, build minutes) suspend rather than bill; quota exhaustion is an ops event, not a code event.
- If the demo outgrows sleep/state-loss acceptance, that is a new effort (persistence first, then host re-evaluation starting from the Northflank notes in the research file).
