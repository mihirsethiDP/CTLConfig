# CloseTheLoop · Configuration console · v4

v4 is the v3 configuration console in v1's design. Everything v3 does carries over unchanged: Plant OS's five steps, state signals with their library categories and run-hours from run status, ＋ SCADA tag / Data input / Formula wherever readings live, the library check, inheriting, library IDs and local changes, origin tags and filters, attention-first lists, severity bands, flows per plant, maintenance overrides, the Global Admin's library editor, Go live with its confirmations, history, help on every screen and form, permissions per persona, keyboard access and the export. Only the look and layout change, taken from v1 (`/`):

- **Shell.** v1's light top bar (brand, a plant switcher, Sign in as, Reset data, ? Help, Hand-off doc) and side navigation: Plants, the current plant's Plant OS, Library, History, the legend and who is signed in.
- **Plant OS** as v1's setup wizard: a numbered step rail beside the step (done green, needs attention amber, current outlined), and a row of step chips across the top on narrower screens.
- **Components** from v1: line cards for rows, v1 chips and shaped severity chips, KPI tiles (the Library's filter cards too), health notes for banners, side sheets with white section cards, v1 forms, switches and segmented controls, v1 tables, modals, toasts and the check rows on Go live.
- **Help** is v1's guide panel: it docks beside the screen and follows it while open; a form's help sits beside its sheet so Save stays in reach.
- **Type and colour:** Figtree and IBM Plex Mono on v1's calm palette. Origin tags use it too: Library teal, SCADA slate, Added here outlined.

Files:

- `prototype.html` — the console. It saves in the browser under its own key (`ctl4.v3`), separate from v3.
- `index.html` — the hand-off doc, the same as v3's in v1's proposal-page design, with a v4 note and change-log entry.
- `assets/library.js`, `assets/store.js`, `assets/help.js` — v3's, unchanged except the storage key and `consoleVersion: "v4"` in the export.
- `assets/ui.js` — v3's screens with v1's shell: the top bar, side navigation, wizard rail, check rows and guide panel.
- `assets/v4.css` — v1's tokens and components, mapped onto every class v3's screens use.

v1, v2 and v3 are unchanged. Live: https://mihirsethidp.github.io/CTLConfig/v4/
