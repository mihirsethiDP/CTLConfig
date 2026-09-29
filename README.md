# CloseTheLoop · Configuration proposal

A critique of the 28 September 2026 configuration handoff (`cfg-console-v4`) and a proposal for a simpler, equipment-first way to configure alerts, schedules and flows. Static site, no build step.

- `index.html` — the proposal: what the handoff gets wrong, principles, simplifying by design (laws → decisions, every state designed), how it fits together, who configures what, the mapping to the approved PRD data model, open questions.
- `prototype.html` — the interactive console. Everything is in memory; **Reset data** restores the start state. **Sign in as** switches persona. **? Help** opens a panel that follows the screen and the step, and holds three demo switches: make the next save fail, start from an empty plant, show the model underneath.
- `assets/data.js` — the fixture plant (Manesar STP). `assets/app.js` — core, router, guide, states. `assets/views.js` — setup wizard and pages. `assets/sheets.js` — stepper sheets. `assets/app.css`, `assets/app2.css` — styles on DigitalPaani tokens.

Live: https://mihirsethidp.github.io/CTLConfig/

Run locally:

```bash
python -m http.server 4190
```

then open http://127.0.0.1:4190/.
