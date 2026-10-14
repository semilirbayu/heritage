# 03: Browser holds the file

**What to build:** After import, the browser stores the raw file. A session status JSON endpoint reports whether the server holds a tree. On any visit where the server has no tree, the browser re-sends the stored file and the explorer opens. The user never re-uploads by hand, and the server stores nothing durable (ADR-0005).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] After a successful import, the raw file is in browser storage
- [x] The status endpoint returns JSON that reports tree presence as a boolean
- [x] With an empty server and a stored file, a visit restores the tree automatically (manual browser check done 2026-10-14: server restart dropped the tree, page reload restored it from browser storage)
- [x] A full or unavailable storage state shows a clear message and keeps the drop zone usable
- [x] The store/mirror/restore decision logic is a pure helper covered by tests with mock storage
- [x] The server writes nothing to disk and uses no database
- [x] A new import replaces the stored file
