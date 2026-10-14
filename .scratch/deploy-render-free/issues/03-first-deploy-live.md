# 03: First deploy live via guided script

**What to build:** An ephemeral guided script that walks the repo owner through the one-time human steps (account, Blueprint service creation from this repo, first-deploy verification), ending with the public URL serving the app.

**Blocked by:** 02 (the Blueprint must exist before a service can be created from it).

**Status:** done

- [x] Guided script generated from the repo's wizard template; `bash -n` clean
- [x] Human runs it: Render signup (no card), Blueprint service creation, first deploy confirmed
- [x] Public URL returns 200 on `/` and serves the Family/List views
- [x] Wake-after-idle serves within the accepted window (~1 minute)
- [x] Script deleted after its run (ephemeral by default)

## Comments

- 2026-10-14: wizard ready at `.scratch/deploy-render-free/render-setup-wizard.sh` (5 stages, `bash -n` clean, library untouched). Commit eb559c4 pushed to `main`. CI runs on GitHub. Human run is the only part left.
- 2026-10-14: live at https://heritage-63y8.onrender.com. Verified: `/` 200 (Family), `/list` 200 (People, import/export present), `/?view=pedigree` 200, `/?view=fan` 200; `/pedigree` and `/fan` 404 as designed (views are query params). CI run for eb559c4 is green. Wizard script deleted.
