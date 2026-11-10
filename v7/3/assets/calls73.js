/* v7/3 · calls73.js — the calls already made on the v7 decision cards, which v7/3 (the decided build) carries as decided.
   Read by decisions7.js as window.V7_CALLS_MADE {Dn: {opt (0-based option, or 'other'), by, atText, note}}. window.V7_BUILT73
   says, for the hand-off page, how far v7/3 builds each call: {Dn: [state 'Built'|'Partly built'|'Not built yet'|'Parked', what]}.
   Your own calls in this prototype are kept under 'ctl73.decisions'. */
window.V7_CALLS_MADE = {
  /* Mihir, Tue 10 Nov 2026 */
  D1: { opt: 2, by: 'Mihir', atText: 'Tue 10 Nov', note: 'We need to account for unit processes now.' },
  D2: { opt: 2, by: 'Mihir', atText: 'Tue 10 Nov' },
  D3: { opt: 2, by: 'Mihir', atText: 'Tue 10 Nov' },
  D4: { opt: 2, by: 'Mihir', atText: 'Tue 10 Nov', note: 'For the prototype only.' },
  D5: { opt: 'other', by: 'Mihir', atText: 'Tue 10 Nov', note: 'No sample readings are needed to set up a new plant. They may be needed when editing an existing plant or any of its properties.' },
  D6: { opt: 2, by: 'Mihir', atText: 'Tue 10 Nov' },
  D7: { opt: 2, by: 'Mihir', atText: 'Tue 10 Nov', note: 'The library gets a control-group type, and the changeover tasks are housed there.' },
  D8: { opt: 3, by: 'Mihir', atText: 'Tue 10 Nov' },
  D9: { opt: 1, by: 'Mihir', atText: 'Tue 10 Nov', note: 'Use "plant graph" everywhere.' },
  D11: { opt: 2, by: 'Mihir', atText: 'Tue 10 Nov', note: "We don't want to touch any change the plant owners made themselves." },
  D26: { opt: 0, by: 'Mihir', atText: 'Tue 10 Nov' },
  /* made on the shared decision board, Tue 3 Nov 2026 */
  D12: { opt: 1, by: 'Alexander', atText: 'Tue 3 Nov' },
  D13: { opt: 0, by: 'Alexander', atText: 'Tue 3 Nov' },
  D14: { opt: 2, by: 'Alexander', atText: 'Tue 3 Nov' },
  D15: { opt: 2, by: 'Alexander', atText: 'Tue 3 Nov' },
  D16: { opt: 1, by: 'Alexander', atText: 'Tue 3 Nov' },
  D17: { opt: 1, by: 'Alexander', atText: 'Tue 3 Nov' },
  D18: { opt: 1, by: 'Alexander', atText: 'Tue 3 Nov' },
  D19: { opt: 1, by: 'Alexander', atText: 'Tue 3 Nov' },
  D20: { opt: 0, by: 'Alexander', atText: 'Tue 3 Nov' },
  D21: { opt: 0, by: 'Alexander', atText: 'Tue 3 Nov' },
  D22: { opt: 1, by: 'Alexander', atText: 'Tue 3 Nov' },
  D23: { opt: 0, by: 'Alexander', atText: 'Tue 3 Nov' },
  D24: { opt: 2, by: 'Alexander', atText: 'Tue 3 Nov' },
  D25: { opt: 2, by: 'Alexander', atText: 'Tue 3 Nov' },
  D27: { opt: 0, by: 'Alexander', atText: 'Tue 3 Nov' },
  /* the team's feedback on the prototypes, taken up by Mihir */
  D28: { opt: 'other', by: 'Mihir', atText: 'Tue 10 Nov', note: 'Any task or issue a reading triggers sits on that equipment. No separate condition-based section.' },
  D29: { opt: 1, by: 'Mihir', atText: 'Thu 5 Nov', note: 'Four handles, and a slot per range for what it triggers.' },
};
window.V7_BUILT73 = {
  D1: ['Partly built', "Each plant has a Structure tab: stages, unit processes with the equipment that takes part in them, control groups, and equipment not placed yet. A new plant's structure is proposed from the plant graph and confirmed once. The library lists the 27 unit-process types. Not built yet: a unit process still carries its basin's own readings, alerts and tasks; it has no content of its own type."],
  D2: ['Built', 'Readiness on the plant Home, fed by one checklist.'],
  D3: ['Built', 'On a new plant nothing is sent, Emergencies included: Vedanta\'s pH Emergency on Wed 28 Oct is kept as a trial firing and opens no issue. A plant that was Live keeps its Emergencies real when it is back in Commissioning.'],
  D4: ['Built', 'DigitalPaani for a new plant, Vedanta up to go live, Manesar and Bawal for live running. Prototype only.'],
  D5: ['Built', 'The limits sheet asks for no readings on a new plant. On a Live plant it replays the last 7 days with the new limits.'],
  D6: ['Built', "A value is 'Follows the library' or 'Plant's own value'. Making it the plant's own asks one question: why."],
  D7: ['Partly built', 'A duty/standby changeover is one task per control group. The library page lists the control-group types and the work they house. Not built yet: editing a control-group type in the library.'],
  D8: ['Built', 'Each alert has its own state: Draft, On trial, On, Off.'],
  D9: ['Built', '"Plant graph" on every screen; the word SCADA is gone.'],
  D10: ['Parked', 'Not in focus for now. The phone card and the equipment page stay as v7/1 has them.'],
  D11: ['Partly built', 'A library change never replaces a value a plant changed itself, safety changes included. Not built yet: plants applying an update themselves; followers still change when the library publishes, with a dated note.'],
  D26: ['Built', "Each piece of equipment keeps its type's criticality; a plant changes it with a reason."],
  D28: ['Built', 'A range on a reading triggers an issue or a task, and both sit on that reading\'s equipment. The Tasks tabs list such a task with the equipment\'s other tasks; there is no separate condition-based section.'],
  D29: ['Built', 'The limits sheet has the bar with four handles, and each range has a "Triggers" slot: an issue with its diagnostic flow, or a task with its steps.'],
};
window.V7_DEC_KEY = 'ctl73.decisions';
