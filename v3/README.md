# CloseTheLoop · Configuration console · v3 (dev hand-off)

v3 is the build to start now. It takes the DigitalPaani app's visual language (navy top bar, pill tabs, legend strip, stat tiles, grouped row cards, green and grey chips) and splits Close the Loop into two groups:

- **Configuration console** — this build. One configuration per plant: unit processes, control groups, machines, readings, alerts, schedules and rounds, manual overrides, the library check, review and go-live, audit. Every entity has add, edit and delete. Delete archives anything that has records. People are not in the console; they live in User Center.
- **Library** — a separate build, read here through one frozen interface. It offers rounds, data inputs and formulas by plant type and by unit process; alerts, schedules and limits by equipment type. The console inherits; items carry `Follows library` or `Custom`.

Readings come from three places and look the same to every alert: a SCADA tag, a value a person enters on a cadence (a data-input sensor), or a formula the analytical engine evaluates over other readings. Readings, alerts and schedules can live on the plant, a unit process, a control group or a machine.

The **library check** is the funnel: the library's perfect picture of each machine against what SCADA and the drawing brought. Every missing sensor is listed with two answers: add the tag (prefilled from the library) or record it as not installed with a reason, which skips the items that need it and names the gap in the hand-off. A unit process, group or machine can be put under a **manual override** (alerts muted, or under maintenance) until a date. Every screen has a "How this works" link and every drawer a "What do these fields mean?" link; the help content is `assets/help.js`.

What is not decided is a **placeholder**: it shows as a dashed chip where it bites, with an owner, and the hand-off JSON names it. Thirteen placeholders today, listed in the hand-off doc.

- `index.html` — the hand-off doc: purpose and status, the two groups and the library interface, the fundamental architecture, the entity model, every screen with acceptance criteria and CRUD, validation rules, the formula grammar for the analytical engine, data inputs and the missed-entry trigger, the export contract the engine receives, permissions, placeholders with owners, flags and questions, sequencing.
- `prototype.html` — the console. Five plants are seeded at different depths (Manesar STP live, Rudrapur STP live, Bawal WTP configured but draft, Pithampur ETP partial, Vedanta ETP bare). Four personas in the top bar. `Reset data` reseeds. State is kept in the browser under its own key; v1 and v2 are untouched.
- `assets/library.js` — the library as data (equipment types with readings, alerts, schedules and connections; unit process profiles; plant types; flows; causes; data inputs and formulas; sample SCADA drawings).
- `assets/store.js` — the console's model: entities, validation, CRUD with audit, inheritance by level, the derived escalation ladder, gaps and the review checklist, compile to the handoff's Trigger shape, placeholders, seed.
- `assets/ui.js` — the screens: plants, a plant's eight tabs, drawers for add and edit, modals for delete, inherit and not-installed records, the help panel, the library view, the audit.
- `assets/help.js` — the in-console help: every screen's purpose, who may change what, steps, every drawer's fields, the terms.
- `assets/v3.css` — the design language.

Every value beside a reading is sample data; nothing is read from a plant while configuring.

v1: https://mihirsethidp.github.io/CTLConfig/ · v2: https://mihirsethidp.github.io/CTLConfig/v2/

Live: https://mihirsethidp.github.io/CTLConfig/v3/

Run locally from the site root:

```bash
python -m http.server 4190
```

then open http://127.0.0.1:4190/v3/.
