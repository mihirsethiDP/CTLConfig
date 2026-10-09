# CloseTheLoop · Configuration proposal · v2

v2 answers one gap v1 left open: an alert on a machine often needs a reading that is not on the machine (the pressure on its discharge header, the level in the tank it draws from), and a fix flow often needs to know the plant's shape (one pump or three). v1 configured each machine as an island.

The proposal: **named connections**. A machine's type declares the connections that matter to it (its suction, its discharge pipe, its standby). SCADA's pipes and headers fill them. A person confirms, or chooses where SCADA drew two. A library item that needs a reading on a connection inherits once the connection is bound, and says what it waits for until then. Fix flows are written once per type and read per plant: `{{standby}}` becomes "P-2" at one plant and "P-2 or P-3" at the next; a step marked "only where the machine has a suction" is skipped, and named on the record, where it has none.

v2 holds no diagnostic flows. An alert runs a generic fix flow, and the cause is recorded when the issue closes. Whether a guided diagnosis is needed is still being researched; the model leaves room for one.

- `index.html` — the brainstorm and the proposal: the gap, the options considered, named connections, context-aware fix steps, what v2 asks of SCADA, what changed from v1, a walkthrough, what is still open.
- `prototype.html` — the v2 console. Same shell as v1; `assets/` is a copy of v1's with the v2 changes applied. State is saved under its own key, so v1 and v2 do not disturb each other.
- What changed in `assets/`: `catalogue.js` (connections per type, pipe readings, alerts on connections, sample SCADA drawings with pipes and headers), `flows.js` (fix flows with connection tokens, no diagnostic flows), `app.js` (pipes, connection resolution, inheritance through connections, token resolution, export), `runtime.js` (a record runs its fix flow resolved for its machine; the cause is recorded at close), `operator.js`, `views.js` (the Connections section on a machine, the choose dialog, the drawing's pipe marks, the detect step's section D), `sheets.js` (readings on connections in the alert sheet, the fix-flow preview, tokens in the flow editor, connections on the type sheet).

v1 lives one level up and is unchanged: https://mihirsethidp.github.io/CTLConfig/

Live: https://mihirsethidp.github.io/CTLConfig/v2/

Run locally from the site root:

```bash
python -m http.server 4190
```

then open http://127.0.0.1:4190/v2/.
