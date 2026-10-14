# 10: Print to PDF

**What to build:** A Print button on the viewer opens the browser Print dialog with a print stylesheet that fits the current view on the page and carries a title: focus person, view mode, and date. The output is vector, so it stays sharp when zoomed. Zero new dependencies.

**Blocked by:** 01: Serve the viewer script as its own file

**Status:** done

- [x] A Print button exists on the viewer toolbar
- [x] Print media hides the interface chrome and fits the chart to the page
- [x] The printed page carries a title with focus person, view mode, and date
- [x] The print shows the current view exactly: mode, depth, collapse state, search dimming off
- [x] Button and stylesheet markers are covered at the HTTP seam
- [ ] Manual check recorded in the ticket: the dialog output opens as a vector PDF

Manual check pending (needs a human print dialog run at the end of the session).
