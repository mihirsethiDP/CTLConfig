# CloseTheLoop · Configuration proposal

A critique of the 28 September 2026 configuration handoff (`cfg-console-v4`) and a proposal for a simpler way to configure alerts, schedules and flows: SCADA draws the plant, a three-level library decides what each thing watches, the admin confirms. Static site, no build step.

- `index.html` — the proposal: what the handoff gets wrong, principles, simplifying by design, how it fits together, "SCADA builds it, the library decides", who configures what, the mapping to the approved PRD data model, open questions.
- `prototype.html` — the interactive console. Everything is in memory; **Reset data** restores the start state. **Sign in as** switches persona. **? Help** opens a panel that follows the screen and the step, and holds three demo switches: make the next save fail, start a new plant from SCADA, show the model underneath.
- `assets/data.js` — the sample plant (Manesar STP). `assets/catalogue.js` — the library (plant types, unit-process profiles, equipment types), the SCADA palette with every code and what it maps to, and two sample SCADA drawings (Bawal WTP, Manesar STP) plus the change each receives later. `assets/flows.js` — 28 diagnostic flows, 68 action flows (maintenance, fixes, rounds, calibration, condition-based) and 67 root causes, bound to the library so every plant inherits them with the type. `assets/app.js` — core: the estate (three plants, one library, saved in localStorage), SCADA import, detection, inheritance, propagation, router, guide, export. `assets/runtime.js` — what happens after configuration: records, the notification pipeline, a clock, maintenance mode, sensor faults, planning arithmetic. `assets/operator.js` — the operator app and equipment card on a phone, with the pipeline beside it. `assets/estate.js` — the Estate and Maintenance pages. `assets/views.js` — setup steps (with the SCADA drawing), equipment, flows, library, people, activity. `assets/sheets.js` — stepper sheets. `assets/app.css`, `assets/app2.css`, `assets/theme-calm.css` — styles on DigitalPaani tokens.

Live: https://mihirsethidp.github.io/CTLConfig/

Run locally:

```bash
python -m http.server 4190
```

then open http://127.0.0.1:4190/.
