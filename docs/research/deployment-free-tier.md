# Heritage — Free-tier deployment research

Researched 2026-10-14 against primary sources only (host official docs, Bun official docs/source, GitHub official docs). This is input for a deploy decision, not a deploy implementation.

## 0. Goal / constraints

- App shape: `Bun.serve` in `src/main.ts`, server-rendered HTML, zero dependencies. Port from `process.env.PORT ?? 3000`. State is an in-memory singleton; persistence is GEDCOM files only.
- Two facts that simplify deployment: `Bun.serve` reads `$PORT` by default and binds `0.0.0.0` by default, so the current entry already satisfies host port-binding rules with no code change.
  - https://bun.com/docs/runtime/http/server
  - https://render.com/docs/web-services (bind `0.0.0.0:$PORT`)
- User constraint: ALL FREE. No credit-card-required trials if avoidable. Card requirement is flagged per host below.

## 1. Recommendation (ranked, free-only)

1. **Render — first choice.** True free tier, no payment required to start, native Bun runtime, `PORT`-based binding already matches. Cost: sleep after 15 min idle (~1 min cold start) and ephemeral disk (state resets on sleep/redeploy — acceptable only if GEDCOM re-import on wake is acceptable).
   - https://render.com/docs/free
   - https://render.com/docs/native-runtimes
   - https://render.com/docs/your-first-deploy
2. **Northflank Developer Sandbox — second choice, best if always-on matters.** Free sandbox (2 services, 2 jobs, 1 addon/database), explicitly no sleeping, Dockerfile builds, free SSL + custom domains. Card status at signup is unverified — check before committing.
   - https://northflank.com/pricing
   - https://northflank.com/docs/v1/application/billing/pricing-on-northflank
   - https://northflank.com/docs/v1/application/build/build-with-a-dockerfile
3. **Koyeb — only if a credit card is acceptable.** Forever-free instance (512 MB / 0.1 vCPU), but signup requires a card with a $29 pre-authorization hold (immediately cancelled). First-party Bun + Dockerfile guide. Sleeps after 1 h idle.
   - https://www.koyeb.com/docs/faqs/pricing
   - https://www.koyeb.com/docs/deploy/bun
   - https://www.koyeb.com/docs/reference/instances
4. **Railway — fallback / short trial.** $5 trial credit for 30 days, no card; then a $1/month Free plan. $1/month does not cover a 24/7 service (RAM alone is $10/GB/month), so long-term free use needs opt-in Serverless sleep with cold-boot trade-offs. Bun needs a Dockerfile (official guide says Railpack does not auto-detect Bun).
   - https://railway.com/pricing
   - https://docs.railway.com/pricing/free-trial
   - https://docs.railway.com/pricing
   - https://docs.railway.com/guides/bun
   - https://docs.railway.com/deployments/serverless
5. **Fly.io — ruled out.** No free tier for new accounts: trial is 2 VM-hours or 7 days (machines auto-stop after 5 min), then a card is required. Cheapest always-on is ~$2.19/30 days. Good Bun story (Dockerfile + `oven/bun`), but it fails the all-free constraint.
   - https://fly.io/docs/about/free-trial/
   - https://fly.io/docs/about/cost-management/
   - https://docs.fly.io/about/pricing

## 2. Limits table (free tier only)

| Host | Card? | Free compute | Hours | Sleep | Bandwidth (free) | Build minutes (free) | Custom domain (free) | Bun story | Persistence on free | Deploy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Render | No (`No payment is required`, services suspend instead of billing without a card) | 0.1 CPU / 512 MB | 750 h/mo per workspace, then suspended to next month | 15 min idle, ~1 min wake | 5 GB/mo included (Hobby), then suspend-or-bill | 500 min/mo, then builds disabled without card | 2 included | Native runtime supports Bun; or Dockerfile | Ephemeral only; no disks on free; free Postgres expires after 30 days | Dashboard, git push, Blueprint `render.yaml`, CLI |
| Northflank Sandbox | Unverified (payments via Stripe; confirm at signup) | 2 services + 2 jobs + 1 addon | No stated hour cap | None (`Always-on-compute – no sleeping`) | Not stated on pricing page | Not stated | Free SSL + custom domains on all plans | Dockerfile or buildpack | 1 free database addon; volume terms unstated — verify | Git push, UI, API, CLI |
| Koyeb | Yes ($29 pre-auth hold, cancelled; 7–21 day release depends on bank) | 1 service/org, 512 MB / 0.1 vCPU / 2 GB SSD, fra or was only | No hour cap stated | 1 h idle (scale to zero) | 100 GB/mo free (outbound not charged yet) | Not stated | 10 free per pricing page; auto TLS | Dockerfile (first-party Bun guide) or buildpack | No volumes on free instance; ephemeral | Dashboard git-driven, CLI, Deploy button |
| Railway | No for trial; Free plan is $0 + $1 credit/mo | Trial: 1 GB RAM, shared vCPU, 5 services/project. Free: 1 vCPU / 0.5 GB per service | Credit-based, not hour-capped | Always-on by default; opt-in Serverless sleeps after ~5–10 min idle (cold boot, possible 502 on first request) | Egress $0.05/GB against credit | Against credit | Trial: 1 custom domain; Hobby: 2/service | Dockerfile (Railpack Bun auto-detect disputed — see §5) | Volumes exist (0.5 GB on Free/Trial), billed $0.15/GB/mo against credit | GitHub, CLI, Docker image |
| Fly.io | Yes after trial | Trial only (2 VM-h / 7 days) | n/a (not free) | Trial machines auto-stop after 5 min | n/a (not free) | n/a | 10 single-hostname certs free; shared IPv4 free | Dockerfile + `oven/bun` image | Paid volumes; 10 GB snapshots free | `fly launch`, CLI |

Sources: Render free/instance/bandwidth/build/domain/port docs (https://render.com/docs/free, https://render.com/docs/compute-plans, https://render.com/pricing, https://render.com/docs/new-workspace-plans.md, https://render.com/docs/build-pipeline, https://render.com/docs/web-services); Northflank (https://northflank.com/pricing, https://northflank.com/docs/v1/application/billing/pricing-on-northflank); Koyeb (https://www.koyeb.com/docs/faqs/pricing, https://www.koyeb.com/docs/reference/instances, https://www.koyeb.com/pricing, https://www.koyeb.com/docs/run-and-scale/domains); Railway (https://railway.com/pricing, https://docs.railway.com/pricing/free-trial, https://docs.railway.com/pricing/plans, https://docs.railway.com/pricing, https://docs.railway.com/deployments/serverless, https://docs.railway.com/guides/cut-idle-costs-serverless, https://docs.railway.com/networking/domains/working-with-domains, https://docs.railway.com/volumes, https://docs.railway.com/volumes/reference, https://github.com/railwayapp/docs/blob/76db91a4/content/docs/public-networking.md); Fly.io (§1 links).

## 3. Render (recommended)

- Free web service: 0.1 CPU / 512 MB RAM, 750 instance hours/month per workspace; over-quota services suspend until next month. Spun-down services do not consume hours. https://render.com/docs/free, https://render.com/docs/compute-plans
- Sleep: spins down after 15 min without traffic; ~1 min to wake. Paid plans do not spin down. https://render.com/docs/faq
- No card needed to start: first-deploy tutorial states `No payment is required`; without a payment method, over-quota bandwidth suspends services and over-quota builds are disabled instead of billing. https://render.com/docs/your-first-deploy, https://render.com/docs/free
- Included quotas on the free Hobby workspace: 5 GB/mo outbound bandwidth, 500 build minutes/mo, 2 custom domains. https://render.com/pricing, https://render.com/docs/new-workspace-plans.md, https://render.com/docs/build-pipeline
- Bun: native runtime `supports both Node.js and Bun`; start command is `bun src/main.ts` (or a Dockerfile if preferred). https://render.com/docs/native-runtimes, https://render.com/docs/language-support
- Port: service must bind `0.0.0.0:$PORT` (default `PORT=10000`). Heritage already reads `PORT` and Bun defaults hostname to `0.0.0.0` — no code change. https://render.com/docs/web-services, https://render.com/tutorials/when-deploys-go-wrong/boot-and-port-binding, https://bun.com/docs/runtime/http/server
- Persistence: ephemeral filesystem on all services; free services cannot attach disks; free Postgres expires 30 days after creation. In-memory tree resets on every sleep/redeploy/restart. https://render.com/docs/free, https://render.com/docs/disks
- Deploy: dashboard from Git provider, auto-deploys on push, Blueprint `render.yaml`, or CLI (`--plan free`). https://render.com/docs/your-first-deploy
- Fit: plenty for a demo (512 MB dwarfs an in-memory tree + `bun` runtime). Only risk is sleep/wake UX and state loss — both are grill questions (§8).

## 4. Northflank Sandbox (always-on alternative)

- Sandbox is free: 2 services, 2 jobs, 1 addon, 1 BYOC cluster; for testing/hobby, not production. https://northflank.com/docs/v1/application/billing/pricing-on-northflank
- No sleeping: pricing page states `Always-on-compute – no sleeping :)`. This is the only evaluated free tier without idle sleep. https://northflank.com/pricing
- Build: Dockerfile (full control, BuildKit caching) or buildpack; ports auto-detected from `EXPOSE` or set manually. Bun ships via `oven/bun` base image per Bun's official Docker guide. https://northflank.com/docs/v1/application/build/build-with-a-dockerfile, https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code, https://bun.sh/docs/guides/ecosystem/docker
- Domains/SSL: free SSL and custom domains on all plans including Sandbox. https://northflank.com/pricing
- Persistence: plan includes 1 free database addon, but Heritage has no DB layer; whether sandbox services get persistent volumes is unstated in the checked docs — verify before relying on local files. https://northflank.com/pricing
- Card: docs describe card-based billing via Stripe, but whether Sandbox signup itself demands a card is unconfirmed — verify at signup and record the answer here. https://northflank.com/pricing
- Deploy: commit/push from GitHub, GitLab, or Bitbucket; UI, API, CLI. https://northflank.com/pricing

## 5. Koyeb (card-required fallback)

- Forever-free instance per org: 512 MB RAM, 0.1 vCPU, 2 GB SSD; one region only (Frankfurt or Washington, D.C.); no worker services, no custom scaling, no volumes. https://www.koyeb.com/docs/reference/instances, https://www.koyeb.com/docs/faqs/pricing
- Card is mandatory (`require a credit card to prevent fraud and abuse`), verified by a $29 pre-auth hold that is immediately cancelled (bank-dependent 7–21 day release). This alone disqualifies Koyeb under the no-card constraint. https://www.koyeb.com/docs/faqs/pricing
- Sleep: free instances scale to zero after 1 h without traffic. https://www.koyeb.com/docs/reference/instances
- Bandwidth: 100 GB/mo outbound free; overage not charged yet ($0.04/GB announced, with notice promised). https://www.koyeb.com/docs/faqs/pricing
- Domains: pricing page states ten custom domains free with automatic TLS. https://www.koyeb.com/pricing, https://www.koyeb.com/docs/run-and-scale/domains
- Bun: first-party `Deploy a Bun App` guide uses a `Dockerfile` (`FROM oven/bun:1` … `CMD ["bun", "server.ts"]`) with git-driven rebuilds, or a prebuilt image. Buildpack builder exists but supports Node.js/Python/Go/Ruby/PHP/Java/Scala — Bun is Dockerfile-only. Set `--env PORT=...` and expose it. https://www.koyeb.com/docs/deploy/bun, https://www.koyeb.com/docs/build-and-deploy/build-from-git
- Deploy: dashboard (GitHub → Dockerfile builder), CLI (`koyeb app init … --git-builder docker`), Deploy button, or prebuilt image. https://www.koyeb.com/docs/build-and-deploy/deploy-with-git, https://www.koyeb.com/docs/build-and-deploy

## 6. Railway (trial + $1/mo fallback)

- Trial: $5 one-time credit, 30 days, no card; limits 1 GB RAM, shared vCPU, 5 services/project. After trial or $5 spent, account reverts to the Free plan: $1 of credit/month, no rollover. https://docs.railway.com/pricing/free-trial, https://railway.com/pricing, https://docs.railway.com/pricing/plans
- $1/month math: RAM costs $10/GB/month and CPU $20/vCPU/month, egress $0.05/GB, volumes $0.15/GB/month. A 0.5 GB service costs ~$5/month in RAM alone, so 24/7 always-on exceeds the Free credit — sustainable free use requires opt-in Serverless sleep. https://docs.railway.com/pricing
- Serverless (opt-in per service): sleeps after ~5–10 min without outbound traffic; wakes on request with cold-boot delay, possible first-request 502, and de-prioritized rebuilds in rare cases. Background traffic (DB pools, telemetry) keeps services awake. https://docs.railway.com/deployments/serverless, https://docs.railway.com/guides/cut-idle-costs-serverless
- Bun: official Railway guide says `Railpack does not yet detect Bun projects automatically. Add a Dockerfile`. (Bun's own Railway guide claims Railpack detects Bun from `bun.lock` — the two primary sources conflict as of 2026-10-14; the Dockerfile path works under either, so use it.) https://docs.railway.com/guides/bun, https://bun.com/guides/deployment/railway
- Ports: Railway provides `PORT` unless user-defined; app must listen on `0.0.0.0:$PORT` — already satisfied. https://github.com/railwayapp/docs/blob/76db91a4/content/docs/public-networking.md
- Domains: trial limited to 1 custom domain. https://docs.railway.com/networking/domains/working-with-domains
- Persistence: volumes mount at a path (e.g. `/app/data`), 0.5 GB default on Free/Trial, billed against credit. Useful only if Heritage later writes GEDCOM/sidecar files to disk. https://docs.railway.com/volumes, https://docs.railway.com/volumes/reference
- Deploy: GitHub repo, CLI, or public/private Docker image. https://docs.railway.com/guides/bun

## 7. What will not work + why

- **Cloudflare Workers:** code runs on `workerd`, not Bun. `No Bun.serve, Bun.file, bun:sqlite, or other Bun-specific APIs in shipped code`; `nodejs_compat` covers only a subset of Node APIs. Heritage is a long-lived `Bun.serve` server — it cannot run here. https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- **Vercel:** request-driven Functions, not servers. Hobby caps function duration at 5 min; instances scale to zero; billing is per-invocation active CPU. No place for a persistent `Bun.serve` listener. https://vercel.com/docs/functions, https://vercel.com/docs/fluid-compute, https://vercel.com/docs/fundamentals/what-is-compute
- **Netlify:** same shape — site hosting plus Functions that `run in an ephemeral runtime environment` per event. No long-lived server process. https://docs.netlify.com/build/functions/overview/, https://docs.netlify.com/build/functions/get-started/
- **GitHub Pages:** static site hosting (`HTML, CSS, and JavaScript files straight from a repository`) — no server execution at all. https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- **Hugging Face Spaces (Docker):** Docker Spaces can run any container, but `creating a new Space that runs on compute (Gradio or Docker) requires a paid plan` — only Static Spaces are free for everyone. Free cpu-basic hardware also sleeps after 48 h idle. Ruled out on cost. https://huggingface.co/docs/hub/spaces-gpus, https://huggingface.co/docs/hub/main/en/spaces-sdks-docker
- **Fly.io:** ruled out on cost (trial-only, then card + ~$2.19/mo minimum), not on tech. https://fly.io/docs/about/free-trial/

## 8. CI for free (GitHub Actions)

- Public repos: standard GitHub-hosted runner usage is free (no minute cap). Private repos on GitHub Free: 2,000 min/month, 500 MB artifacts, 10 GB cache per repo; usage blocks without a payment method once quota is spent. https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions, https://docs.github.com/en/billing/concepts/product-billing/github-actions
- 2026 pricing change does not affect this: `Standard GitHub-hosted or self-hosted runner usage on public repositories will remain free`. https://github.com/resources/insights/2026-pricing-changes-for-github-actions
- Bun's vendor action installs Bun in CI and resolves version from `packageManager`/`engines.bun` or `latest` (pin with `bun-version`). https://github.com/oven-sh/setup-bun
- Sketch for a future workflow (recorded here only; not implemented): `ubuntu-latest` runner → `oven-sh/setup-bun` → `bun install` → `bun test` → `bun run build` on push/PR. A `bun test` run for this repo takes seconds, so even the private-repo 2,000 min quota is effectively inexhaustible.

## 9. Open questions for the grill

1. **State loss:** every free tier here (except Northflank's always-on) sleeps and wipes in-memory state. Is `import .ged on each visit` acceptable for a demo, or does free hosting force a persistence ticket (volume/DB) first?
2. **Sleep tolerance:** is Render's 15-min sleep / ~1-min wake acceptable, or is always-on (Northflank) worth its signup unknowns?
3. **Credit card:** is any card acceptable (unlocks Koyeb), or hard no-card (Render/Northflank/Railway-trial only)?
4. **Custom domain:** needed now (all shortlisted hosts offer one free), or is `*.onrender.com` fine?
5. **Repo visibility:** public (CI unlimited) or private (2,000 min/mo — still plenty)?
6. **Northflank unknowns:** confirm at signup whether Sandbox needs a card and whether services get any persistent disk; record answers in §4.
7. **Railway conflict:** Railpack Bun auto-detect (Bun docs claim) vs Dockerfile-required (Railway docs claim) — Dockerfile path sidesteps it, but confirm on first deploy.
