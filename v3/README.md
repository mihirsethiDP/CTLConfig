# CloseTheLoop · Configuration console · v3 (dev hand-off)

v3 is the build to start now. It takes the DigitalPaani app's visual language (navy top bar, pill tabs, legend strip, stat tiles, grouped row cards, green and grey chips) and splits Close the Loop into two groups:

- **Configuration console** — this build. One configuration per plant: unit processes, control groups, machines, readings, alerts, schedules and rounds, manual overrides, the library check, review and go-live, audit. Every entity has add, edit and delete. Delete archives anything that has records. People are not in the console; they live in User Center.
- **Library** — shared by every plant, edited by a Global Admin on the console's Library page (draft, publish, versions), read by plants through one frozen interface. It offers rounds, data inputs and formulas by plant type and by unit process; alerts, schedules and limits by equipment type. Every library item has a library ID that never changes; every inherited item at a plant has its own plant ID and links to the library by that library ID, so names are free on both sides. A plant can change the name, flow or cadence of an inherited alert or schedule as a local change and stay linked; Reset to library drops it.

Readings come from three places and look the same to every alert: a SCADA tag, a value a person enters on a cadence (a data-input sensor), or a formula the analytical engine evaluates over other readings. Readings, alerts and schedules can live on the plant, a unit process, a control group or a machine; every Sensors group header and every unit process, group and machine form has ＋ SCADA tag, ＋ Data input and ＋ Formula.

**State signals.** Many sensors report a state, not a measurement: running, tripped, flooded, auto/manual, hooter, valve open or closed. SCADA creates each with its **signal category**, and the library defines the categories (the states, what each means, and whether it counts run-hours). An alert on a state picks the states that raise it, the severity and the minutes in that state; the engine counts the time with COUNTIF. Auto/manual is only reported. **Run-hours** come from each machine's run status; a counter (throughput) can still drive a schedule, never an alert. Equipment types also carry data inputs for every machine, and a data input can record a state, such as a yes/no check. The acceptance criteria are SS-1 to SS-15 in section 5.11 of the hand-off doc.

The **library check** is the funnel: the library's perfect picture of each machine against what SCADA and the drawing brought. Every missing sensor is listed with two answers: add the tag (prefilled from the library) or record it as not installed with a reason, which skips the items that need it and names the gap in the hand-off. A unit process, group or machine can be put **under maintenance** until a date, which suppresses alerts on it and everything below it. Every alert, formula and missed entry compiles to an analytical-engine formula in HyperFormula style with an upsert key. Every screen has a "How this works" link and every drawer a "What do these fields mean?" link; the help content is `assets/help.js`.

What is not decided is a **placeholder**: it shows as a dashed chip where it bites, with an owner, and the hand-off JSON names it. Eleven placeholders today, listed in the hand-off doc; the seventeen flags raised on 16 Oct are decided in its section 12.

- `index.html` — the hand-off doc: purpose and status, the two groups and the library interface, the fundamental architecture, the entity model, every screen with acceptance criteria and CRUD, validation rules, the formula grammar for the analytical engine, data inputs and the missed-entry trigger, the export contract the engine receives, permissions, placeholders with owners, flags and questions, sequencing.
- `prototype.html` — the console. A plant has one tab, **Plant OS**, with five steps shown as the pill bar (Shape, Sensors, Alerts, Work, Go live), a status dot on each, Back and Next, and History behind a link. Every step lists what needs attention first (a toggle, an amber banner with the reasons, marked rows). Every row starts with where the item came from: a purple Library tag, a blue SCADA tag, or a teal Added here tag for items added by hand; the counts per origin in each step's toolbar filter the list. Rows carry one line and one amber chip saying why; edit, delete, status and overrides live in the drawer. The alert drawer is built around a coloured severity band bar that inherits the sensor's preset thresholds by default. Flows have a quick view and can be edited per plant. The library check and the pending decisions are collapsible panels. A Global Admin edits the library (equipment types with sensors, preset bands, alerts, planned work and data inputs; signal categories; stage profiles; plant types; flows) as a draft and publishes a new version. The Library page opens with ten count cards that act as filters (plant types, stage profiles, equipment types, signal categories, alerts, schedules, data inputs, formulas, flows, versions); each plant sees what a new version changes and updates when ready. Five plants are seeded at different depths (Manesar STP live, Rudrapur STP live, Bawal WTP configured but draft, Pithampur ETP partial, Vedanta ETP bare). Four personas in the top bar. `Reset data` reseeds. State is kept in the browser under its own key; v1 and v2 are untouched.
- `assets/library.js` — the library as data (equipment types with readings, alerts, schedules, data inputs and connections; signal categories; unit process profiles; plant types; flows; causes; data inputs and formulas; sample SCADA drawings).
- `assets/store.js` — the console's model: entities, validation, CRUD with audit, inheritance by level, the severity bands and clocks, gaps and the review checklist, compile to the handoff's Trigger shape, placeholders, seed.
- `assets/ui.js` — the screens: plants, a plant's five Plant OS steps, drawers for add and edit, modals for delete, inherit and not-installed records, the help panel, the library view, the audit.
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
