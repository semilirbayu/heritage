# 03: First deploy live via guided script

**What to build:** An ephemeral guided script that walks the repo owner through the one-time human steps (account, Blueprint service creation from this repo, first-deploy verification), ending with the public URL serving the app.

**Blocked by:** 02 (the Blueprint must exist before a service can be created from it).

**Status:** ready-for-agent

- [ ] Guided script generated from the repo's wizard template; `bash -n` clean
- [ ] Human runs it: Render signup (no card), Blueprint service creation, first deploy confirmed
- [ ] Public URL returns 200 on `/` and serves the Family/List views
- [ ] Wake-after-idle serves within the accepted window (~1 minute)
- [ ] Script deleted after its run (ephemeral by default)
