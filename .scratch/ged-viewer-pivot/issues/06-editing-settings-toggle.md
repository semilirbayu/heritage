# 06: Editing behind a settings toggle

**What to build:** A settings toggle turns editing on for this browser. When it is on, edit links and forms reappear in the person drawer and person page. It is off by default and the choice persists across reloads (ADR-0004).

**Blocked by:** 05: Navigation shows Explore, Import, Export

**Status:** done

- [x] A settings toggle exists, default off
- [x] Off: no edit affordances anywhere in the interface
- [x] On: edit links and edit forms reappear where they were before the pivot
- [x] The choice persists across reloads
- [x] All edit operations still pass their tests in both states
