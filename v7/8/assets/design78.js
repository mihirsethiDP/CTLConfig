/* v7/8 · design78.js — the Design page (#/design): the tokens and components the configuration console is built from, the words it
   uses, and how it relates to the build the developers have today. Everything shown is the live component, drawn by the same
   helpers and styles the screens use (assets/theme78.css), so the page cannot drift from the product. */
(function () {
  'use strict';
  const W = window; const U = W.V7UI; if (!U || !U.route) return;
  const esc = U.esc; const btn = U.btn, chip = U.chip, card = U.card, sev = U.sev, table = U.table, note = U.note;
  const sw = (name, v, job) => `<div><i style="background:var(${v})"></i><b>${esc(name)}</b><span>${esc(job)}</span></div>`;
  const spec = (rows) => `<dl class="ds-spec">${rows.map(([k, v, why]) => `<dt>${esc(k)}</dt><dd>${v}${why ? `<p>${esc(why)}</p>` : ''}</dd>`).join('')}</dl>`;
  const crit = (t, w, tip) => `<span class="crit crit-${t}" data-tip="${esc(tip)}" data-tip-side="right">${esc(w)}</span>`;
  function page() {
    const colour = `<div class="ds-sw">${[
      sw('Navy', '--navy', 'The product: top bar, primary action, selected'),
      sw('Link blue', '--accent', 'Links and quiet actions'),
      sw('Ink', '--ink', 'Text'), sw('Ink, quiet', '--ink-3', 'Hints, labels, counts'),
      sw('Ground', '--bg', 'The page'), sw('Line', '--line-2', 'Borders and outlines'),
      sw('Caution', '--sev-caution', 'Severity, lowest'), sw('Minor', '--sev-minor', 'Severity'), sw('Major', '--sev-major', 'Severity'), sw('Emergency', '--sev-emergency', 'Severity, highest'),
      sw('Amber', '--warn', 'A value that differs from the library'), sw('Red', '--bad', 'Destructive or broken'),
    ].join('')}</div>`;
    const type = `<div class="ds-type"><p style="font:600 22px var(--font)">Page title, 22 semibold</p><p style="font:600 15.5px var(--font)">Section and card title, 15.5 semibold</p><p style="font:400 14px var(--font)">Body, 14 regular. One idea per sentence.</p><p style="font:400 12.5px var(--font);color:var(--ink-3)">Hint and caption, 12.5 quiet ink</p><p style="font:600 12px var(--font);letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3)">Group label, 12 caps</p><p class="mono">BLW · OS_TANK_DF, codes and tags in mono</p></div>`;
    const buttons = spec([
      ['Primary', btn('Publish', { kind: 'primary' }), 'One per screen: the thing the screen is for. Navy.'],
      ['Secondary', btn('Change limits', {}), 'Every other action. Outlined.'],
      ['Quiet', btn('Cancel', { kind: 'ghost' }), 'Leaving, or an action beside a stronger one.'],
      ['Destructive', btn('Return to Commissioning…', { kind: 'danger' }), 'Always asks before it acts, and asks why.'],
    ]);
    const chips = spec([
      ['Criticality', `<span class="ds-row">${crit('A', 'Critical', 'A failure breaks the discharge consent, is a safety hazard or stops the plant, and nothing takes over.')}${crit('B', 'Essential', 'A failure makes treatment worse within hours, or a standby or a second train takes over.')}${crit('C', 'Standard', 'A failure has no effect on the process within a day.')}</span>`, 'The darker the chip, the more the plant depends on it. Hover says what the word means.'],
      ['Severity', `<span class="ds-row">${sev('caution')}${sev('minor')}${sev('major')}${sev('emergency')}</span>`, 'Only for an alert line or an issue. An issue is coloured by its own severity everywhere it appears.'],
      ['State', `<span class="ds-row">${U.stateChip('commissioning')}${U.stateChip('live')}${U.stateChip('trial')}${U.stateChip('on')}${U.stateChip('off')}${U.stateChip('draft')}</span>`, 'A plant or an alert. A dot, a word, no green.'],
      ['Where a value comes from', `<span class="ds-row">${chip('Follows the library', { tone: 'lib' })}${chip("Plant's own value", { tone: 'changed' })}${chip('Draft', { tone: 'warn' })}</span>`, 'Amber means it differs from the library.'],
      ['Code or tag', `<span class="ds-row">${chip('BLW', { mono: true })}${chip('DO-AT2', { mono: true })}</span>`, 'What the database or the Visualization calls it. Mono, squared.'],
    ]);
    const switches = spec([
      ['Capsule', `<span class="capsule"><a class="on" href="#/design">Equipment types<span class="capsule-n">84</span></a><a href="#/design">Unit processes<span class="capsule-n">53</span></a></span>`, 'A choice between sibling lists of one area, or two ways to show one list.'],
      ['Filter', `<span class="ds-row">${U.filters([{ label: 'All', href: '#/design', on: true, count: 84 }, { label: 'Used at a plant', href: '#/design', count: 28 }])}</span>`, 'Narrows the list on screen. Carries its count, so no separate count is shown.'],
      ['Tabs', `<nav class="tabs" style="margin:0"><a class="tab on" href="#/design">Overview</a><a class="tab" href="#/design">Readings <span class="tab-n">4</span></a><a class="tab" href="#/design">Tasks <span class="tab-n">11</span></a></nav>`, 'The parts of one object. A tab carries its count, so the page has no row of count tiles.'],
      ['Tooltip', `<span class="ds-row"><span class="tip-i" tabindex="0" data-tip="Shown on hover and on keyboard focus. One or two sentences, no headings." data-tip-side="right">i</span> <span class="ov-pill" tabindex="0" data-tip="Measured; 1 alert on it" data-tip-side="right">Motor current <small>A</small></span></span>`, 'What a word or number means. Never the only place an instruction lives.'],
    ]);
    const words = table({
      cols: [{ label: 'In the developers\' build', key: 'a' }, { label: 'In the console', key: 'b' }, { label: 'Why', key: 'c' }],
      rows: [
        { a: 'Schedules', b: 'Tasks', c: 'An operator is given a task. The schedule is how often it comes round, one field of it.' },
        { a: 'Condition work, as its own list', b: 'A task that a range of a reading raises', c: 'It sits on the reading that raises it, beside the issue that the next range opens. No separate list.' },
        { a: 'SCADA vocabulary', b: 'Visualization', c: 'One word everywhere for the plant drawing and what it sends.' },
        { a: 'Pipe readings', b: 'Readings on pipes', c: 'Shown, dashed and marked "next phase". Nothing on them raises an alert yet.' },
        { a: 'What a range does, chosen at each plant', b: 'Set on the type, followed by plants', c: 'A range opens an issue or raises a task. The type says which; a plant reading follows it and can choose its own.' },
        { a: 'Kind of equipment', b: 'Kind, on the card under the name', c: 'Kept: Rotating, Vessel, Fixed, Dosing, Valve, Membrane, Device.' },
        { a: 'Edit, as one long form', b: 'One editor per value, opened where the value is', c: 'A limit is changed on its bar, a task on its row. The change is a draft until it is published.' },
        { a: 'Save changes, with a reason', b: 'Publish, after "Where it lands"', c: 'The person sees which plants a change reaches, and which keep their own value, before it goes out.' },
      ],
    });
    const kept = `<ul class="lg-ul"><li><b>The product's top bar and navy.</b> The console reads as part of the product.</li><li><b>The capsule switch</b> between the lists of one area.</li><li><b>Cards or a table</b> for a library list.</li><li><b>"What it reads" and "What it does"</b> as the two halves of a type.</li><li><b>Severity chips in a row</b>, lowest to highest, with their limits.</li><li><b>The dashed box</b> for what arrives in a later release.</li></ul>`;
    const dropped = `<ul class="lg-ul"><li><b>The count pills above the list.</b> The filters carry the same counts.</li><li><b>"Recently updated".</b> It repeats five of the cards below it. Drafts and what was published lately are listed once, with what they change.</li><li><b>Four counts on every card, zeros included.</b> A card says what the type has, in one line, and says so plainly when it has nothing.</li><li><b>"Show details" on each card.</b> The whole card opens the type.</li><li><b>The row of count tiles on a type.</b> The tabs carry the counts.</li><li><b>History in two places.</b> It is on the Details tab.</li></ul>`;
    const added = `<ul class="lg-ul"><li><b>How many values plants changed away from a type</b>, on its card, as a link to them. How many plants use it is not shown: that is on the type's Details tab.</li><li><b>A tooltip on criticality</b> saying what the word means, and on each reading saying what kind it is.</li><li><b>One button per box</b> on the overview, to the place where that box is changed.</li><li><b>Draft, Where it lands, Publish</b>: nothing reaches a plant from an edit alone.</li><li><b>Filters by use</b>: used at a plant, not used yet, with a draft.</li></ul>`;
    const body = `<div class="ds">`
      + card({ title: 'Colour', sub: 'Colour has four jobs: the product, severity, a difference from the library, and danger. Everything else is ink on white.', body: colour })
      + card({ title: 'Type', sub: 'Roboto for text, Roboto Mono for codes, tags and measured values.', body: type })
      + card({ title: 'Buttons', body: buttons })
      + card({ title: 'Chips', sub: 'A chip says one fact. It is filled only for criticality and severity.', body: chips })
      + card({ title: 'Switching and explaining', body: switches })
      + card({ title: 'A list of types', sub: 'The same card serves equipment types and unit processes.', body: `<p class="ov-sub" style="margin-bottom:10px">See it live: <a href="#/library">Library, as cards</a> · <a href="#/library?view=table">as a table</a> · <a href="#/library/BLW">a type's overview</a></p>` })
      + card({ title: 'Quick actions, and showing more only when asked', body: `<ul class="lg-ul"><li><b>The value is the button.</b> A reading on a type's overview opens its limits there. An alert has Limits and Timing on its own row; a task has How often.</li><li><b>A row opens for more.</b> The row says the fact; opening it gives the detail and the next links. Nothing a person must see is hidden inside.</li><li><b>A list says what to do next.</b> Each plant on All Plants carries its next step: the set-up step that is blocking, or its open issues and tasks due.</li><li><b>A Live plant's header</b> carries open issues, tasks due and Report a problem on every tab.</li><li><b>A library card</b> jumps to its limits or its tasks as well as opening the type.</li><li><b>Jump to</b> (Ctrl K) goes to any plant, equipment, type or flow, and opens a reading's limits by name.</li><li><b>An empty box says what to add</b>, and its button is the primary one. A type with nothing yet starts with Add a reading.</li></ul>` })
      + card({ title: 'Words', sub: 'Where the two builds use different words, the console uses one.', body: words })
      + card({ title: 'Taken from the developers\' build', body: kept })
      + card({ title: 'Left out, and why', body: dropped })
      + card({ title: 'Added', body: added })
      + note('This page draws the live components. Change a token in assets/theme78.css and every screen, and this page, changes with it.', 'quiet')
      + `</div>`;
    return U.page({ title: 'Design', sub: 'What the configuration console is built from: its colours, type, components and words. It takes the product\'s theme and the developers\' layout ideas, and keeps the behaviour of this prototype.', body });
  }
  U.route('design', page);
})();
