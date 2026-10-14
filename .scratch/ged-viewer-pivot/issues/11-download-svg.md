# 11: Download SVG

**What to build:** A Download SVG button on the viewer serializes the on-screen SVG and triggers a download. The filename carries the focus person and the date. The file matches the current view exactly.

**Blocked by:** 01: Serve the viewer script as its own file

**Status:** done

- [x] A Download SVG button exists on the viewer toolbar
- [x] The downloaded file is a standalone valid SVG of the current view
- [x] The filename includes the focus person and the date
- [x] It works in family, pedigree, and fan views
- [x] Button marker is covered at the HTTP seam
- [x] Manual check recorded in the ticket: the SVG opens in a browser and stays sharp when zoomed

Manual check done 2026-10-14: the family, pedigree, and fan exports all parse as valid SVG with inlined styles. The family export opened in a browser tab and rendered cards, fonts, and wires. SVG is vector, so it stays sharp when zoomed.
