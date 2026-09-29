# CloseTheLoop · Configuration proposal

A critique of the 28 September 2026 configuration handoff (`cfg-console-v4`) and a proposal for a simpler, equipment-first way to configure alerts, schedules and flows. Static site, no build step.

- `index.html` — the proposal: what the handoff gets wrong, principles, how it fits together, who configures what, the mapping to the approved PRD data model, open questions.
- `prototype.html` — the interactive console. Everything is in memory; **Reset data** restores the start state. Switch persona with **Sign in as**; flip **Show the model underneath** to see the PRD entity behind every card.
- `assets/data.js` — the fixture plant (Manesar STP). `assets/app.js` — the prototype. `assets/app.css` — styles on DigitalPaani tokens.

Live: https://mihirsethidp.github.io/CTLConfig/

Run locally:

```bash
python -m http.server 4190
```

then open http://127.0.0.1:4190/.
