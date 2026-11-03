/* v7 · decisions7.js — window.V7_DECISIONS (the decision cards) + window.V7DEC (the #/decisions views, the decisions strip
   on every screen, and the document view the challenges doc and the overview draw).

   One file, shared byte-identical by both prototypes (v7/1 the recommended approach, v7/2 Alex's model as drafted) and by
   the docs. It loads standalone (a doc loads only this file) and inside either app (after work7.js); it registers its
   routes only when window.V7UI is present, and never touches V7 (core) state.

   GLOBALS READ (never written): window.V7_VARIANT '1' (default) | '2' — which prototype this page belongs to;
          window.V7_PAGE 'app' (default) | 'doc' (a hand-off doc in v7/N/) | 'overview' | 'challenges' (pages in site/v7/).
   DATA   window.V7_DECISIONS: ordered array of cards {id:'D1'…, title (a plain question), short (2–6 words), severity:
          'Decide before building further'|'Shapes v7'|'Small', arose ('First review'|'Reviewing v7/1'|'Designing v7/2'|'Building v7/2'),
          alexSays, v6Today, mihirsDirection, options:[{label, consequence, recommended}], recommendation, v7Does,
          tellAlex, v71Option, v71Short, v72Option, v72Short, v72Does, both, links:[{label, href, label72, href72}],
          where:{'1':[route patterns], '2':[route patterns]}}. Every field after `tellAlex` is optional: a card without
          them renders as before. Text fields are plain text; a blank line starts a paragraph and lines starting "- "
          are list items (see prose()). The site is public, so the cards describe Alex's documents in plain words: no
          document IDs, file names, section pointers or internal code names (tests/decisions7.test.js checks this).
          window.V7_READINGS: [{n, title, drafts, reading, why, card, confirm}], set right after the cards — the readings
          v7/2 takes where Alex's drafts are silent or say two things (card: the Dn it is argued on, or null; confirm:
          true when Mihir must confirm it). The views read whatever it holds when they render.
   HELPERS (pure, shared with the docs)
          V7DEC.list() · byId(id) · SEVERITIES [{key, short, tone, blurb}] · sevOf(d) · recommendedIndex(d) · optionText(d, opt)
          esc(s) · prose(text, {mark}) → html (paragraphs + lists; mark:true bolds "Contract should change")
          variant() → '1'|'2' · page() → 'app'|'doc'|'overview'|'challenges' · V72_READY (false while v7/2 is unbuilt)
          v71Index(d) · v72Index(d) · hasPair(d) · shortOf(d) · aroseOf(d) · builds(d, which) → one line
          hrefFor(which, route) → the prototype URL from this page · targetFor(which) → null | 'v7-1' | 'v7-2'
          challengesHref(id) · docHref(which, id) · linksFor(d, which) → [{label, route, href, target, ready, which}]
          matchRoute(pattern, path) · canonicalPath(variant, path) → the page an alias renders (v7/2 keeps v7/1's paths)
          markersFor(variant, path) → cards whose where[variant] matches the path or the page it renders (severity, then id)
          markerHtml(variant, path) → '' | <aside class="dec-mark"> (the quiet strip ui7 puts under each page header)
          twoHtml(d, {here}) · docHtml({mode, glance, cards, readings, here, level}) → html
          renderDoc(el|id, {mode:'challenges'|'overview'|'doc', …}) or renderDoc({glance, cards, readings, mode}) → fills
          and binds the document view (your-call chips write 'ctl7.decisions'); returns the html it wrote
   YOUR CALL (browser storage 'ctl7.decisions' = {v:1, answers:{D1:{opt:0…n-1|'other', note, at}}}; every access guarded;
          shared on purpose by both prototypes and every doc: a call is about the decision, not the version)
          answers() · answerOf(id) · noteOf(id) · setAnswer(id, {opt, note}) · clearAnswer(id) · differs(d) · counts()
          answersText() → "D1 — <title>: <chosen option> (note)" lines · alexText() → every "What to tell Alex" note
          onExternalChange(fn) → fn() after another tab changes the calls
   VIEWS  routes 'decisions' (list grouped by severity; filters ?show=open|answered|differs; cards collapse) and
          'decisions/:id' (one card, open, with previous/next). Actions: dec:pick, dec:note, dec:clear, dec:copy,
          dec:copyalex, dec:copyone, dec:openall, dec:closeall. Styles: decisions7.css next to this file (added at load).
          V7DEC.render.list(params) / render.detail(params) return html strings (used by tests).                            */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;

  W.V7_DECISIONS = [
    {
      "id": "D1",
      "title": "Add a treatment-step level above equipment now, or keep each tank as the home for its own readings, issues and tasks?",
      "short": "Treatment steps above equipment",
      "severity": "Decide before building further",
      "arose": "First review",
      "alexSays": "The spine is Plant type › Plant › Stage (a label) › Unit process › Equipment › Sensor › Reading. Issues and Tasks about the process are filed on the unit process, which the algorithm proposes and a person confirms in the structure pass of Alex's review queue. Stages come from the unit-process type, through a lookup in the existing identification code and its list of stage types. Alex lists these as decided, and once the drafts are promoted a screen that contradicts a settled decision counts as a defect.",
      "v6Today": "There is no level between the plant and its equipment. A tank's readings, issues and tasks sit on its database type: DO-AT2 sits on Manesar's AT-2 Diffuser Tank, and the MBBR sheet's issues sit on MBBR. The workbook's grouping only appears as \"From the Bar Screen sheet\" or \"From the MBBR sheet\", and the import drops any grouping data.",
      "mihirsDirection": "This phase has only plant types and the database's equipment types. Equipment isn't grouped into treatment steps and there are no readings on pipes between equipment; both wait for the next phase. The screens never use the spec's words for those levels.",
      "options": [
        {
          "label": "Keep each tank as the basin this phase, and tell Alex it's deferred, not rejected",
          "consequence": "Nothing new to build, and it works with the content that exists today: the workbook only has the Bar Screen and MBBR sheets, and both are database types. The costs stay, and they're named as next-phase work. DigitalPaani's 4 sludge recirculation pumps have their work parked on its 2 Tube settlers. Its 8 Open Skeleton Tanks (equalisation, chlorine contact, sump, sludge pit and others) have no home for process issues. The settler-outlet TSS and odour issues stay on MBBR. A plant that draws both a Mechanical Screen and a Screen Chamber Tank would get 11 screen tasks twice, though none of the four plants does today.",
          "recommended": true
        },
        {
          "label": "Show the workbook's grouping as a label that pages can group by",
          "consequence": "Little gain. v6 already shows \"From the MBBR sheet\" on every issue. A label doesn't stop screen tasks landing twice, because work is still filed per type. It only helps if work is filed on it, and that is option 3 under another name. It also adds a new grouping word to the screen.",
          "recommended": false
        },
        {
          "label": "Adopt Alex's full structure now",
          "consequence": "It puts the sludge-pump work in the right place (one pump can serve several tanks) and gives generic tanks a process of their own. But it needs identification output v7 doesn't have, adds a confirm-the-structure pass to commissioning and reverses the phase scope. Every reading, issue and task would move to a new home, so every page of v7 would change under it. At DigitalPaani it still runs the 8-hourly DO test once per MBBR (five times), and the settler-outlet issues still have no single home, because the plant has two trains.",
          "recommended": false
        }
      ],
      "recommendation": "Option 1. Here Mihir's direction is the stronger one, though it isn't free. Everything the workbook holds today lands cleanly on a database type. The case a new level would be expected to fix, the settler-outlet TSS and odour issues, isn't fixed at DigitalPaani: with two trains and five MBBR tanks, those issues need the plant or a train as their subject. A treatment-step level earns its place through readings across the step, and those are pipe readings, which are next phase anyway, so add both together. Tell Alex the real costs now (sludge-pump work parked on Tube settlers, eight generic tanks with no process home, the screen tasks that would land twice), and accept Alex's definition of the word instead of redefining it as \"the tank's type\".",
      "v7Does": "There's no grouping level. Tanks are the basin: each tank's readings, issues and tasks sit on its database type, and pages show no grouping chip or breadcrumb. The library shows one plain box: \"Grouping equipment into treatment steps, and readings on pipes between equipment — next phase.\"",
      "tellAlex": "Re the spine, stages as only a label, the stage list and filing treatment issues on the unit process (and many-to-many participation with them): deferred to the next phase, not rejected. This phase has no stage or unit-process level. Each tank is the basin, and its readings, issues and tasks sit on its database type, which fits your note that the unit process is the basin node. Your meaning of 'unit process' is agreed as the definition; we're just not building the level yet. Costs we carry until then:\n- The sludge recirculation pumps' work sits on the Tube settlers (v6 'Sludge-pump tasks').\n- Generic Open Skeleton Tanks have no process home (8 at DigitalPaani).\n- A plant that draws both a Mechanical Screen and a Screen Chamber Tank would get 11 screen tasks twice.\nThe settler-outlet TSS and odour issues stay on MBBR. A basin-level unit process wouldn't fix that at DigitalPaani (two MBBR trains, five basins); it needs a plant or train subject (see your entry on what an alert can be about).",
      "v71Option": 0,
      "v71Short": "No grouping level: each tank is the basin, with its readings, issues and tasks on its database type; a next-phase box in the library.",
      "v72Option": 2,
      "v72Short": "Unit processes, stages and control groups; a structure pass confirms them; Issues and Tasks filed on unit processes.",
      "v72Does": "v7/2 builds Alex's full structure. The spine is Plant type › Plant › Stage › Unit process › Equipment › Sensor › Reading, and a stage is only a label: nothing is filed on it. When the survey builds a plant graph, identification proposes unit processes (each basin or reactor node is one) and control groups (blowers or pumps that feed exactly the same downstream set), each with a plain reason, and a person confirms them in the structure pass. Issues and Tasks are filed on a unit process, a piece of equipment or the plant. A control group holds only its members and a setpoint, so nothing is filed on it either. At DigitalPaani the structure pass proposes 21 unit processes and 11 control groups and leaves 20 pieces of equipment unclassified, which someone must place or set aside by hand before Go live. The library gains unit-process types beside the 56 equipment types. The cost shows on every tank's page: a basin's readings, Issues and Tasks now sit on its unit process and come from its unit-process type, and the proposal is only as good as the pipes drawn in the plant graph.",
      "both": false,
      "links": [
        {
          "label": "Library: the next-phase box",
          "href": "#/library",
          "label72": "Library: unit-process types",
          "href72": "#/library/up-types"
        },
        {
          "label": "DigitalPaani equipment: five MBBRs, two Tube settlers, eight Open Skeleton Tanks",
          "href": "#/p/digitalpaani/equipment",
          "label72": "DigitalPaani's structure pass: unit processes and control groups",
          "href72": "#/p/digitalpaani/review/structure"
        },
        {
          "label": "Tube settler type: where the sludge-pump work sits",
          "href": "#/library/T_SETTLER/tasks",
          "label72": "The drawing at DigitalPaani: who participates in what",
          "href72": "#/p/digitalpaani/structure/drawing"
        }
      ],
      "where": {
        "1": [
          "library",
          "p/:plant/equipment",
          "library/T_SETTLER/:tab?",
          "p/:plant/readings"
        ],
        "2": [
          "library/up-types",
          "library/up-types/:id/:tab?",
          "p/:plant/review/structure",
          "p/:plant/structure/:view?",
          "p/:plant/up/:id/:tab?",
          "p/:plant/cg/:id"
        ]
      }
    },
    {
      "id": "D2",
      "title": "Should the plant home become Readiness (a stored Commissioning → Live state fed by one checklist) instead of the nine setup steps?",
      "short": "Readiness instead of nine steps",
      "severity": "Decide before building further",
      "arose": "First review",
      "alexSays": "One plant state, Commissioning → Live. The plant home is Readiness: three tracks (Structure · Bindings · People), blockers and gaps that each link to their fix, and one Go live button, after which Readiness becomes Coverage. A review queue replaces the nine-step wizard, and Inherit becomes a property of each field. Alex's reference lists four blockers ('No reachable Operator and Lead; untyped equipment; unclassified equipment; undecided drafts') and four gaps that 'Stay on Coverage': limits that can't resolve, noisy Triggers (more than 10 trial firings a day), no PM programme, and no diagnostic flow.",
      "v6Today": "v6 has a nine-step rail, from Connect SCADA to Review and go live. 'Live' is never stored. v6 works it out from three things: people can be reached, every type is in the database, and there are no drafts. So nothing holds alerts back during commissioning, and a plant with nothing inherited can still show Live. People are added and marked verified by hand in step 2, inside the console.",
      "mihirsDirection": "On 23 Oct, while redirecting v1, Mihir said 'the nine steps stay', adding attention chips and a Needs attention filter. Mihir's standing direction also says who is told belongs in the User Center, not the console, but v6 never followed it. On 29 Oct Mihir asked not to follow earlier versions blindly, so the 23 Oct call is an earlier default, not a fixed rule.",
      "options": [
        {
          "label": "Keep the nine steps; step 9 sets a stored Live",
          "consequence": "Matches the 23 Oct call and v6, so it feels familiar. But a wizard ends at Go live, which leaves trial firings, Coverage and re-reading SCADA on a Live plant with no home. It also keeps checks like 'escalation not read' that count page visits rather than whether the plant is ready.",
          "recommended": false
        },
        {
          "label": "Alex's Readiness exactly as drawn",
          "consequence": "The structure track brings back treatment-step grouping, and Readiness gets a phone-verify button, giving phones a second place to be edited. Alex's screens show three gap lists that disagree. Limits are set on the sensor before anyone accepts a proposal. Go live can pass with no alert on, for example after every proposal is rejected.",
          "recommended": false
        },
        {
          "label": "Readiness reworked for this phase, fed by one checklist",
          "consequence": "Three tracks: What SCADA found · What the library brings · Who is told (read from the User Center). One checklist feeds Readiness, the go-live confirmation and Coverage, so the three can never disagree. It adds two blockers Alex's list lacks: every proposal decided, and at least one alert On trial or On. It drops v6's 'escalation not read' and 'not inherited' checks. This reverses v6 twice, and both need Mihir's yes: the step rail goes, and people are no longer added in the console.",
          "recommended": true
        },
        {
          "label": "Only reachability and database types block; everything else is a gap",
          "consequence": "The fastest route to Go live, but a plant can go live with undecided proposals and no alert watching anything.",
          "recommended": false
        }
      ],
      "recommendation": "Take option 3. On this point Mihir's 23 Oct 'nine steps stay' is the weaker option, because v7's story goes past Go live: trial, Live, Coverage and re-reading SCADA. A wizard has nowhere to put any of that, and only a stored state plus one checklist stops the home page, the go-live confirmation and Coverage from disagreeing, which Alex's own screens already do. The two added blockers close the hole where Go live passes with nothing watching. The rule can be met on every plant: DigitalPaani, which only sends run-status and level readings, still gets 4 'Level high' alerts from the library. Mihir should confirm both reversals of v6 explicitly: the nine steps go, and people are read from the User Center instead of being added in the console.",
      "v7Does": "The nine steps are gone. The plant home is Readiness while the plant is Commissioning and Coverage once it is Live. The state is stored and only Go live sets it (Global Admin). 'Return to Commissioning' needs a reason. One checklist function feeds Readiness, the go-live confirmation and Coverage. The tracks are What SCADA found · What the library brings · Who is told. Who is told is read-only from the User Center stub, and 'Edit in the User Center' only shows a toast.\n\nBlockers:\n- equipment whose type is not in the database\n- What SCADA found not accepted\n- library proposals undecided\n- no alert On trial or On\n- no reachable Operator or Lead\n\nGaps (never block):\n- readings with no limits\n- noisy alerts (more than 10 trial firings a day, averaged over the trial so far)\n- equipment with no maintenance task\n- issues with no diagnostic\n- drawn type differs from stored type\n- trial shorter than 3 days\n\nAccepting a proposal turns its alert On trial, and Go live turns it On. Limits are never copied onto the sensor before acceptance: each band is looked up in order (changed here, then the SCADA form, then the library).\n\nContract should change: its blocker reads 'no reachable operator and no reachable lead', which taken literally blocks only when both are missing. It should read 'no reachable Operator, or no reachable Lead', since v6 and Alex both need one of each.",
      "tellAlex": "We accept the one plant state (Commissioning → Live), the review queue in place of the wizard, and Inherit as a property of each field, with different tracks: What SCADA found · What the library brings · Who is told. There are no unit processes, so 'unclassified' drops out. The Commissioning vs Live section of your reference needs one checklist generator: your wireframes for Readiness during the trial, the go-live confirmation and Coverage show three different gap lists, and the trial Readiness wireframe calls 6 trial firings a day 'noisy', against your own more-than-10. Please tighten 'undecided drafts' to 'every proposal decided' and add 'at least one Trigger On trial or On'. As drawn, Go live enables with zero Triggers if every binding is rejected. People becomes a read-only reachability check against the User Center, so no 'Send code' on Readiness (as your reference and your 'one place to edit each thing' principle already say). Errata: your first Readiness wireframe resolves zones before the Bindings pass, and the trial Readiness wireframe's '7 left inactive on purpose' includes the 2 can't-resolve drafts.",
      "v71Option": 2,
      "v71Short": "Readiness, then Coverage, replace the nine steps; one checklist; Go live blocked until an alert is On trial or On.",
      "v72Option": 1,
      "v72Short": "Readiness as drawn: Structure · Bindings · People, five blockers and four gaps; Go live needs no Trigger.",
      "v72Does": "v7/2 builds Readiness as Alex drew it. The plant home shows three tracks side by side, Structure · Bindings · People, then the blockers and gaps, then Go live. Steps that are waiting stay visible, greyed, and say what they wait for. A review queue with two passes, structure then bindings, replaces the nine steps, and every value shows its source, so there is no inherit step. Five things block Go live: no Operator with a verified phone, no Lead with a verified phone, equipment with no type, equipment the structure pass left unclassified, and drafts nobody has decided. The gaps are readings whose limits can't resolve, noisy Triggers, equipment with no maintenance programme and Issue Triggers with no diagnostic flow, and they stay on Coverage after go-live. Go live does not need a single active Trigger, and an unconfirmed structure pass does not block it either: DigitalPaani could go live with people added and nothing bound. v7/2 shows this instead of blocking it. Where Alex's drawings list different gaps on different screens, v7/2 uses one list on all of them.",
      "both": false,
      "links": [
        {
          "label": "DigitalPaani: Readiness with its blockers",
          "href": "#/p/digitalpaani",
          "label72": "DigitalPaani: Readiness, three tracks and its blockers",
          "href72": "#/p/digitalpaani"
        },
        {
          "label": "Vedanta: one undecided proposal blocks Go live",
          "href": "#/p/vedanta",
          "label72": "Vedanta: one undecided draft blocks Go live",
          "href72": "#/p/vedanta"
        },
        {
          "label": "Manesar: Coverage on a Live plant",
          "href": "#/p/manesar",
          "label72": "Manesar: Coverage on a Live plant",
          "href72": "#/p/manesar"
        }
      ],
      "where": {
        "1": [
          "p/:plant",
          "p/:plant/scada",
          "p/:plant/library"
        ],
        "2": [
          "p/:plant",
          "p/:plant/review/bindings"
        ]
      }
    },
    {
      "id": "D3",
      "title": "Should a real Emergency during Commissioning reach the plant's Leads, or nobody until Live?",
      "short": "Emergencies during Commissioning",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "While a plant is in Commissioning, every Trigger records trial firings only, at every severity, and \"nothing is sent until Live, even for a real Emergency\". That means no robocall, no hooter, no WhatsApp and nothing in the operator app. Alex chose this over the option the memo itself recommends, Emergencies real but quiet, even though the memo's Safety row marks the nothing-sent option \"✗ A real Emergency reaches no one\". Alex's follow-up pack lets a Global, Full or Technical Admin return a Live plant to Commissioning with a reason, but only Global or Full Admin can go live. Alex's first pack had flagged that permission as an open question, and the follow-up pack drops the flag.",
      "v6Today": "v6 has no Commissioning state: alerts that have limits are real from the start. An Emergency calls everyone on the roster at once, raises the full-screen alarm and sounds the hooter where it is switched on. So there is no quiet trial and no trial evidence to tune with.",
      "mihirsDirection": "Mihir has not set a direction on this. v6's approach, where everything is real at once, is the weakest choice for a plant whose sensors are still being wired. The standing brief still applies: do what is safe and easiest, show the consequence before it happens, read who is told from the User Center, and state a disagreement with Alex openly instead of building around it.",
      "options": [
        {
          "label": "Alex's decision: nothing is sent until Live, Emergencies included",
          "consequence": "This is the quietest trial: no siren and no client noise while sensors are wired. But a real Emergency during days of trial, such as a chlorine leak at the Gas Tonner, reaches nobody through CloseTheLoop. Returning a Live plant to Commissioning also silences any new Emergencies there.",
          "recommended": false
        },
        {
          "label": "Alex's memo recommendation: Emergencies are real but quiet",
          "consequence": "Caution, Minor and Major record trial firings only. An Emergency opens a real issue tagged Commissioning and kept out of metrics. It goes by WhatsApp and in the app to the plant's Leads and the commissioning admin, with no call and no hooter until Live. A false Emergency during wiring reaches a few people, not the whole plant. The cost is one stated exception in the notification rules, plus one check at the point where calls and the hooter are sent.",
          "recommended": true
        },
        {
          "label": "Keep nothing-sent for a new plant, but keep Emergencies real when a Live plant is returned to Commissioning",
          "consequence": "This closes the gap on running plants, where people already rely on the calls. A new plant's first trial stays silent. That is no worse than before CloseTheLoop, but it still fails Alex's own safety row for days at a time, and two rules for one state are harder to explain.",
          "recommended": false
        },
        {
          "label": "v6 as is: no Commissioning state",
          "consequence": "Everything is real from day one, calls and hooter included. There is no trial evidence to tune with, and untuned alerts call the roster and sound the hooter during wiring, which teaches the plant to ignore the siren.",
          "recommended": false
        }
      ],
      "recommendation": "Take option 2, which is what Alex's own memo recommends. The memo marks \"nothing sent\" as failing on safety, and Alex ranks safety second, below only \"nothing changes silently\". Neither pack names a fallback such as local alarms, and option 2 still gives Alex the quiet trial: no calls, no hooter and no client noise while sensors are wired. The biggest risk is a Live plant returned to Commissioning, because under Alex's rule it goes silent while people rely on it. So returning a plant should also need Global or Full Admin, the same as Go live, since Caution to Major alerts still drop back to trial after a return. Alex asked that decisions not be changed in code alone, so send this as a stated disagreement. Falling back to v6, where everything is real at once, is not better: it calls the whole roster during wiring.",
      "v7Does": "v7 builds the recommended option. At a plant in Commissioning, Caution, Minor and Major record trial firings only: nothing is sent, nothing reaches the operator app and nothing counts. An Emergency opens a real issue tagged Commissioning, told to the Leads by WhatsApp and in the app, with no call and no hooter, and kept out of metrics. Vedanta's pH Emergency on Wed 28 Oct, about 15:10, shows this. The go-live confirmation says \"Calls and the hooter start now\". On a Live plant, \"Return to Commissioning\" needs a reason and says Emergencies keep being sent. v7 has a single Global Admin user, so the rule about who can return a plant is not shown. Contract should change: the commissioning admin should also be told, as in the memo's recommended option, so whoever is tuning the plant sees the Emergency too.",
      "tellAlex": "Disagreement with nothing being sent until Live, Emergencies included: please take the option your memo recommends, Emergencies real but quiet, instead of nothing sent. Your Safety row marks the nothing-sent option \"✗ A real Emergency reaches no one\", and your second principle, safety, ranks above the trial's convenience. Real-but-quiet keeps the quiet trial. Bands below Emergency stay trial firings. An Emergency opens a real Issue with a Commissioning chip, sent on WhatsApp and in-app to commissioning staff and the plant's Leads. Robocall and hooter wait until Live, nothing counts in metrics, and the line on your go-live confirmation becomes \"Calls and the hooter start now\". On who can return a Live plant to Commissioning (open in your first pack, flag dropped in the follow-up pack): it should need Global or Full Admin, as Go live does. It should not be open to a Technical Admin or a Lead holding that grant, and it must not mute Emergencies. v7 builds the real-but-quiet option, and the hand-off doc names it as a proposed change, not a quiet fork.",
      "v71Option": 1,
      "v71Short": "Caution to Major record trial firings only; an Emergency opens a real issue told to the Leads, with no call and no hooter.",
      "v72Option": 0,
      "v72Short": "Nothing is sent until Live, Emergencies included; Vedanta's pH Emergency is a trial firing.",
      "v72Does": "v7/2 follows Alex's decision. While a plant is in Commissioning, every active Trigger records trial firings at every severity and nothing is sent, Emergencies included: no Issue, no call, no hooter, no WhatsApp and nothing in the operator app. Every page of the plant says \"Commissioning · nothing is sent\". Vedanta's pH Emergency on Wed 28 Oct, 15:10 is one more trial firing on pH low · EQ-1, with a peak of pH 3.7; its row is marked \"Emergency · nobody was told\", and no Issue opened. The go-live confirmation says Triggers will then \"notify the plant's people, including Emergency calls and the hooter\". Returning a Live plant to Commissioning needs a reason and says that from then on nothing is sent there either, Emergencies included; Issues already open stay open and are worked as normal.",
      "both": false,
      "links": [
        {
          "label": "Vedanta: the Emergency during the trial",
          "href": "#/p/vedanta/issues",
          "label72": "Vedanta: the Emergency recorded as a trial firing",
          "href72": "#/p/vedanta/trigger/a_3f"
        },
        {
          "label": "Vedanta: Readiness and Go live",
          "href": "#/p/vedanta",
          "label72": "Vedanta: Readiness and Go live",
          "href72": "#/p/vedanta"
        },
        {
          "label": "Manesar: Return to Commissioning",
          "href": "#/p/manesar",
          "label72": "Manesar: Return to Commissioning",
          "href72": "#/p/manesar"
        }
      ],
      "where": {
        "1": [
          "p/vedanta/issues",
          "p/vedanta/issue/is_5m",
          "p/vedanta/alert/a_3f",
          "p/vedanta",
          "p/manesar"
        ],
        "2": [
          "p/vedanta/trigger/a_3f",
          "p/vedanta/issues",
          "p/vedanta/people",
          "p/vedanta",
          "p/manesar"
        ]
      }
    },
    {
      "id": "D4",
      "title": "Which plant should carry each part of v7's story, when the one real SCADA layout only has run status and level?",
      "short": "Which plant carries which part",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Commissioning runs through binding Trigger templates to tagged sensors, then a trial in which active Triggers record trial firings. Limits are library rules such as '0.9 × tank_height' resolved into the sensor's zones, and more than 10 trial firings a day is a go-live gap. The wireframes use an illustrative 'Sample STP' ('146 pieces of equipment · 88 sensors', '31 Triggers active · 214 trial firings'). Task templates bind in the same pass, but only Triggers are trialled. Alex's new-plant scenario targets 'at least 80% of proposals accepted without change', and a later step in Alex's plan is a reference prototype on a real plant's graph.",
      "v6Today": "v6's only real SCADA export is DigitalPaani's layout (the drawing names the site Ireo Uptown): 66 equipment of 13 types and 38 drawn sensors, all run status (34) or level (4), so 28 equipment have none, all 5 MBBRs among them. Of the 62 library alerts its types offer, 4 have a reading to run on (Level high on 4 tanks); 58 wait for motor current, DO, level, trip and other readings the layout doesn't draw, while the same plant inherits 325 task schedules, 71 of them manual tests. Its tags come from labels, the form answers on 5 equipment are stand-ins, and Bawal, Manesar and Vedanta are hand-made samples.",
      "mihirsDirection": "Mihir has not said which plant should carry the study, but the v7 brief already splits it: DigitalPaani for the new plant from SCADA through Readiness, Vedanta (sample) for trial, tuning, the Emergency and go live, and Manesar (sample, Live) for live operation, with every sample count labelled. Mihir's equipment-only rule is not what limits DigitalPaani: all 58 missing readings belong to the equipment itself. They just aren't drawn.",
      "options": [
        {
          "label": "DigitalPaani only, start to finish",
          "consequence": "The structure is real throughout, and the main finding shows plainly: 15 MBBR issues can only be found by a report or a task. But trial and tuning get 4 Level high alerts, still running on sample readings, with little to tune. Live operation would need people and a history that DigitalPaani doesn't have.",
          "recommended": false
        },
        {
          "label": "Sample plants only: Vedanta up to go live, Manesar for live operation",
          "consequence": "Full trial and tuning screens, but on small invented plants (Vedanta has 13 equipment, 13 alerts and 1 DO probe). The study never shows what a real layout gives, which hides the most useful finding for Alex.",
          "recommended": false
        },
        {
          "label": "Split by plant, and say so on screen",
          "consequence": "DigitalPaani carries What SCADA found, What the library brings, Readiness, its task programme and its missing sensors, all on real structure. Vedanta carries the trial, tuning, the Emergency and go live. Manesar carries live issues, Coverage, the library change and Differences. Every sample screen is tagged. The walkthrough changes plant twice and has to say so each time.",
          "recommended": true
        },
        {
          "label": "Wait for a second real plant's layout and build the trial on it",
          "consequence": "v7 and Alex's reference prototype would share one real plant, and the numbers for Alex's 80% target could be compared. But it depends on Alex and Pepe, nobody knows when it would arrive, and its layout may be as sparse as DigitalPaani's. Better asked for alongside the split than waited on.",
          "recommended": false
        }
      ],
      "recommendation": "Choose the split, which the v7 brief already uses, and in the same message ask Alex for the real plant layout their reference prototype uses, instead of waiting for it. DigitalPaani is real for structure and for which alerts can run, but its counts are not real: its 4 level sensors hold only a static fill level from the drawing, so trial firings are sample readings on every plant. The split just lets each plant show what its data honestly carries. Don't add invented sensors to DigitalPaani. The bigger lesson is for Alex: on the one real layout, commissioning is mostly accepting a task programme and getting probes drawn, so trial firings and limits from design values cover only a small share of the setup work.",
      "v7Does": "v7 splits the story by plant. DigitalPaani (real layout) opens in Commissioning with nothing reviewed and nobody in the User Center, which is a blocker. It carries What SCADA found, What the library brings and Readiness, and its waiting alerts are greyed out with 'Needs a reading SCADA doesn't send'. Vedanta (sample, day 6 of trial) carries trial firings, the noisy alert, tuning, the Emergency and go live. Manesar (sample, Live) carries live issues, Coverage, the library change and Differences. All Plants tags each plant 'Sample plant' or 'Real SCADA layout', and every count or preview, DigitalPaani's included, carries 'Sample readings'. Contract should change: (1) list alerts that wait for an undrawn reading as one Readiness gap ('58 library alerts wait for a reading SCADA doesn't send'), and state that they never count as undecided proposals that block go live; (2) DigitalPaani's 5 stand-in form answers (EQTT-1, EQTT-2, FFP-1, FFP-2, UFFP-1) must not show 'From the SCADA form'; tag them as samples.",
      "tellAlex": "Alex, on which plant carries v7: the only real SCADA layout I have is DigitalPaani's drawing of Ireo Uptown. It draws only run status (34) and level (4) across 66 pieces of equipment, so of the 62 library Triggers its types offer, 4 can bind (Level high on 4 tanks) and 58 wait for motor current, DO, level and trip readings that aren't drawn. The export carries no tank dimensions, so a '0.9 × tank_height' limit wouldn't resolve, and the same plant gets 325 task schedules (247 from the workbook, as the v6 doc counts them, plus 78 from the general task sets), 71 of them manual tests. So at a real plant today, commissioning is mostly accepting a task programme and getting probes drawn, and trial firings and design-parameter limits cover only a small share of it. Please weigh your target of '80% accepted without change' and the feasibility suspects with that in mind. Could you and Pepe share the SCADA layout export for the real plant your reference prototype uses, and say whether it draws DO, pH and motor current? Until then v7 uses DigitalPaani for structure and for what can bind, and labelled sample plants for the trial, go live and Live.",
      "v71Option": 2,
      "v71Short": "Split by plant and said on screen: DigitalPaani's real layout, Vedanta's trial and go live, Manesar's live operation.",
      "v72Option": 2,
      "v72Short": "Same split by plant as v7/1.",
      "v72Does": "Same as v7/1: the story is split by plant and says so on screen. DigitalPaani, the one real plant graph, carries the structure pass, the bindings pass and Readiness. Vedanta (sample, day 6 of its trial) carries trial firings, tuning and go-live. Manesar (sample, Live) carries the live Issue, Coverage, the library change and Deviations. Bawal stays quiet. All Plants tags each plant \"Sample plant\" or \"Real plant graph\", and every count or preview carries \"Sample readings\". The one story difference comes from the Emergency card: at Vedanta the pH Emergency is a trial firing, not an Issue.",
      "both": true,
      "links": [
        {
          "label": "DigitalPaani: what the library brings",
          "href": "#/p/digitalpaani/library",
          "label72": "DigitalPaani: the bindings pass",
          "href72": "#/p/digitalpaani/review/bindings"
        },
        {
          "label": "Vedanta: the trial on a sample plant",
          "href": "#/p/vedanta",
          "label72": "Vedanta: the trial on a sample plant",
          "href72": "#/p/vedanta"
        },
        {
          "label": "All Plants: sample or real layout",
          "href": "#/plants",
          "label72": "All Plants: sample plant or real plant graph",
          "href72": "#/plants"
        }
      ],
      "where": {
        "1": [
          "plants",
          "p/digitalpaani/library",
          "p/vedanta"
        ],
        "2": [
          "plants",
          "p/digitalpaani/review/bindings",
          "p/vedanta"
        ]
      }
    },
    {
      "id": "D5",
      "title": "Where should trial-firing counts and the 'last 7 days' preview get their readings, and which engine counts them?",
      "short": "Readings behind trial counts",
      "severity": "Decide before building further",
      "arose": "First review",
      "alexSays": "During Commissioning, active Triggers record trial firings (Trigger, band, start, end, peak) at every severity, and more than 10 a day makes a Trigger 'noisy', a readiness gap. The Trigger page shows 'Fired 19 times in 3 days · median 4 min', and a limit change previews 'Last 7 days: would have fired 3 times (now 19)'. 'Must hold for' and 'must clear for' are set in minutes, Emergency fires on the first reading, and 'everything polls at 1 minute'. Alex's pack never says where the readings come from.",
      "v6Today": "Each sensor holds one current value that gets overwritten. There is no reading history and no poll interval, and DigitalPaani's real layout has only fixed values: 4 Level readings at 20 % and 34 ON/OFF. The engine opens and closes an issue on the first reading and never reads 'Hold for', even though the screen shows it and 'Try a reading' promises an issue 'after N min'. v6 also sets the hold to 0 on any alert that has an Emergency limit, each plant runs its own clock, and the activity log uses the computer's date.",
      "mihirsDirection": "Mihir has given no direction on trial firings or reading history. The nearest thing is v6's one-value 'Try a reading' with a 'Hold for' on each alert. The evidence makes that the weaker option: it tests one number instead of a week, and it promises a hold the engine never applies.",
      "options": [
        {
          "label": "Sample readings at 1-minute polls, one engine for everything",
          "consequence": "Each sensor gets a repeatable sample series, worked out on demand (about 10,080 points a week, which is trivial) and tagged 'Sample readings'. The same rule opens live issues, records trial firings and computes 'last 7 days'. It honours 'must hold for' (Emergency on the first reading), 'must clear for' and the pause list for equipment in maintenance. One clock runs every plant and the activity log. 'Now' and 'would have' always agree. Medium cost. It proves the screens and the tuning loop, but not whether 10 a day is the right threshold, because the outcomes are written in advance.",
          "recommended": true
        },
        {
          "label": "Real SCADA history only: ask DigitalPaani for a week of polled readings and replay them",
          "consequence": "Real evidence, and a real test of the threshold. Nobody has handed this data over or confirmed that SCADA keeps history. The exported DigitalPaani layout has no live values at all, and a new plant has no history before its trial, so the Commissioning story still needs samples. Worth asking for alongside option 1, not instead of it.",
          "recommended": false
        },
        {
          "label": "Scripted numbers, as in Alex's wireframes",
          "consequence": "The cheapest way to show the screens. The 'last 7 days' preview can't recompute while someone types a limit, so tuning is a picture rather than a test. The numbers are whatever we write, and Alex's own already disagree: the same 19 covers 3 days on one screen and 7 days on another, and 6 a day is called noisy.",
          "recommended": false
        },
        {
          "label": "Keep v6: one-value 'Try a reading', no trial",
          "consequence": "No new work. There is no evidence for tuning before go-live, which goes against Alex's trial decision. 'Hold for' stays on screen but does nothing, so an alert with a 30-min hold (MLSS high) still opens on the first reading.",
          "recommended": false
        }
      ],
      "recommendation": "Take option 1, and in the same round ask DigitalPaani whether SCADA keeps polled history, with a one-week export if it does. Option 1 is the only one where the preview recomputes as you type and agrees with the issues the plant actually opened. Poll the samples every minute, not every 15 minutes as v7 does today: at 15-minute polls every hold or clear of 15 min or less acts as one poll (15 min), so 5, 10 and 15 min behave the same and the 'median 4 min' on Alex's Trigger page can't occur. v6's 'Try a reading' (Mihir's earlier direction) is the weaker option, and making the engine honour 'must hold for' fixes something v6 already promises on screen; it is not a new feature.",
      "v7Does": "Each sensor gets a pure sample series, tagged 'Sample readings' wherever a count or preview appears. One firing rule drives trial firings, the limits sheet's 'Last 7 days with these limits: would have fired N times (now M)' and live issue opening. A firing starts after 'must hold for' (Emergency starts on the first reading) and ends after 'must clear for'; a deeper band in the same excursion is a step up, not a new firing. An alert counts as noisy at more than 10 trial firings a day, averaged over its trial days so far, so Vedanta's DO low at about 6 a day shows as 'mostly short', not noisy. One clock runs every plant and also stamps Activity.\n\nContract should change:\n(1) The sample series should poll every minute, not every 15 minutes (series stepMin=15). At 15-minute polls every hold or clear of 15 min or less acts as one poll (15 min), so 5, 10 and 15 min behave the same and the 'median 4 min' on Alex's Trigger page can't occur.\n(2) The lower bands on an alert that also has an Emergency limit should keep their own hold instead of v6's 0. The issue-page example 'must hold for 0 min' carries the 0 over.\n(3) List two v6 corrections as fixes, not decisions: the shared rule should honour the maintenance pause list, and statutory tasks should escalate.",
      "tellAlex": "On trial firings, the noisy threshold and persistence (your Trigger page and sensor page wireframes): trial firings are cheap once polled history exists. The real cost is getting that history out of SCADA. The 'last 7 days' preview on your sensor page works on a Live plant only where SCADA keeps history, and a new plant has none before its trial. v7 runs labelled sample readings through one engine for live Issues, trial firings and the preview; the prototype polls every 15 min today and we propose 1-minute polls. It also fixes v6's engine to honour persistence and clearing; v6 never did, so the persistence setting is more than a rename. Two questions back. Does DigitalPaani's SCADA store polled history, and can we get a week's export? Is a trial firing that deepens one firing that records its deepest band and peak? Your commissioning memo says trial firings have no promotion, and the record holds one band. One fix for the pack: 'more than 10 a day' is put on about 6 a day in your wireframes for Readiness during the trial, the Trigger page and the go-live confirmation, and the same 19 covers 3 days on the Trigger page but 7 days on the sensor page.",
      "v71Option": 0,
      "v71Short": "Sample readings for every sensor; one engine records trial firings, works out the 'last 7 days' preview and opens live issues.",
      "v72Option": 0,
      "v72Short": "Same sample readings and one engine as v7/1; trial firings are kept as records.",
      "v72Does": "Same as v7/1: each sensor has a repeatable sample series, and one engine records trial firings, works out the \"would have fired\" previews and opens live Issues. Alex's model asks for the same thing, an engine that records trial firings from readings; the fixed numbers in Alex's drawings are only drawings. In Alex's words, a firing starts after the Trigger's Persistence (\"must hold for\") and ends after its Clearing (\"must clear for\"), and an Emergency fires on the first reading. The Trigger page reads \"Fired 76 times in 5.9 days · median 45 min · peak 88%\" for Level high · EQ-1. Two things differ, and both come from other cards: the trial firings the engine records are kept as records, so changing a limit later leaves them as they were (card D24); and a frozen Trigger keeps its old terms until someone resyncs it (card D15). On a plant in Commissioning the preview counts over the trial so far; on a Live plant it covers the last 7 days.",
      "both": true,
      "links": [
        {
          "label": "Vedanta Readiness: trial firings and the noisy alert",
          "href": "#/p/vedanta",
          "label72": "Vedanta Readiness: trial evidence and the noisy Trigger",
          "href72": "#/p/vedanta"
        },
        {
          "label": "Vedanta readings: change limits with the 'last 7 days' preview",
          "href": "#/p/vedanta/readings",
          "label72": "DO-SBR-1's zones: the 'If you save' preview",
          "href72": "#/p/vedanta/sensor/v_sbr_DO"
        },
        {
          "label": "Manesar issues: opened under stated terms",
          "href": "#/p/manesar/issues",
          "label72": "DO low · AT-2: its open Issue and frozen terms",
          "href72": "#/p/manesar/trigger/a_do_at2"
        }
      ],
      "where": {
        "1": [
          "p/vedanta",
          "p/:plant/readings",
          "p/manesar/issues"
        ],
        "2": [
          "p/vedanta",
          "p/vedanta/sensor/v_sbr_DO",
          "p/manesar/trigger/a_do_at2"
        ]
      }
    },
    {
      "id": "D6",
      "title": "When a plant changes a library value, which reasons can it give, and where should a sensor fault or a library error go instead?",
      "short": "Reasons for a plant's own value",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "One override record covers every deviation. It holds the field, the value, the base value (captured automatically), a reason, a note, the author, a review date and a state. There are five reasons, each with its own path: Physical (set a design parameter), Regulatory/client, Structural (ask for a library variant by trait), Tuning (review in 90 days) and Temporary (expires within 30 days); migration adds a sixth, 'Migrated'.",
      "v6Today": "v6 writes the plant's value in place and does not keep the library value next to it. Any change to a library alert, schedule or limit makes the whole item the plant's own copy: library publishes skip it from then on, and nothing can put it back. Only criticality asks for a reason and shows 'Library says X'. Plants can also set their own clocks on each alert and choose which diagnostic an alert opens.",
      "mihirsDirection": "v5 and v6 used a two-way mark: an item either follows the library or is the plant's own copy, which rollouts leave alone. Limits sat on the sensor. Nothing in that direction argues against a single record of changes, and the evidence says the two-way mark is the weaker option: because it loses the library value, it can never show that the library has moved, and it cannot take a plant back to the library.",
      "options": [
        {
          "label": "Alex's five reasons as drawn (Physical, Regulatory or client, Structural, Tuning, Temporary)",
          "consequence": "Stays true to Alex's pack, but three of the five reasons point to things this phase does not have. Design parameters are the SCADA form's answers. Outlet limits sit on connection readings, which are next phase. v6's types carry no traits a variant could use. Alex's own screens save a probe fault as Tuning, and Temporary's 30-day limit cannot stretch to a December recalibration.",
          "recommended": false
        },
        {
          "label": "Two reasons and three ways out (what v7 does now)",
          "consequence": "The two reasons are 'Tuned for this plant' (note and review date) and 'For now, until …' (any length; goes back to the library by itself). The three ways out are not recorded as changes. 'The sensor reads wrong' opens the sensor-fault issue and its calibration task. 'It is built differently' sends the admin to fix the form in SCADA. 'The library is wrong' files a library suggestion. Every choice leads somewhere real. Regulatory and client limits are parked with a stated reason.",
          "recommended": true
        },
        {
          "label": "Keep v6's two-way mark (follows the library, or the plant's own copy) and add a reason prompt",
          "consequence": "The cheapest option. The library value is not kept, so there is no 'Library changed since', no 'Back to the library value' and no real list of differences. Library publishes keep skipping changed items without saying so.",
          "recommended": false
        },
        {
          "label": "No reasons: only a required note and a review date",
          "consequence": "The simplest form. The list of differences cannot be filtered or redirected, so a sensor fault looks the same as a real plant difference and stays as a limit change.",
          "recommended": false
        }
      ],
      "recommendation": "Option 2, which is what v7 does now. Every choice leads to something a plant can actually do in this phase. The three ways out catch the two mistakes Alex's own screens make: a probe fault saved as a lowered limit that outlives its recalibration, and a library guess corrected one plant at a time. It keeps Alex's record intact (the library value at the time, author, review date, state), so 'Library changed since', 'Back to the library value' and the differences list all work. v6's two-way mark, Mihir's earlier choice, is the weaker option and should go. Structural is not lost: it becomes a library suggestion that the library owner can meet with a rule on a SCADA form answer, the way v6's form rules already vary a type without splitting it.",
      "v7Does": "v7 keeps v6's values in place and adds a list of plant changes beside them. The list covers five things: limits per band, must hold and must clear, on/off, cadence and criticality. Each change records the library value at the time, a note, the author, the date and a review date. Its state is worked out, not stored: OK, Library changed since, Review due or Ended. The limits sheet offers two reasons: 'Tuned for this plant' (review in 6 months) and 'For now, until …' (goes back to the library on that date). Below them are three ways out, none saved as a change: 'The sensor reads wrong' (opens the sensor-fault issue or calibration task), 'It is built differently' (fix the form in SCADA) and 'The library is wrong' (logs a suggestion on the type page and in Activity). Manesar's older changes show as 'Not recorded (changed before reasons were kept)', and its plant-only limits and tasks (CDU-1's chemical tank level, Chemical refill on CDU-1, Sludge wasting on SP-1) show as 'Not in the library'. There are no per-alert clocks, the Emergency hold is fixed, and the diagnostic an alert opens comes from the library and cannot be changed at the plant. Contract should change: if an admin chooses 'The sensor reads wrong' and still saves a stopgap, 'For now' should fill in its end date from the calibration task's next due date.",
      "tellAlex": "On the override record, the tunable fields and how a plant departs from the library: v7 builds your override record as a list beside the in-place values, the way your pack keeps membership overrides. It covers your five tunable fields, keeps the Emergency hold fixed, and holds limits for each sensor and direction, so pH and MLSS don't need the per-Trigger exception your limits memo allows.\n\nOn the reasons:\n- Your sensor page wireframe, in the tune-a-limit scenario, saves a probe reading 0.3 low as Tuning, with a review on 26 Jan 2027, after its December recalibration.\n- Your Deviations wireframe records Plant M's 'low-load design', which is Physical by your own definition, as Tuning.\n\nv7 uses two reasons:\n- 'Tuned for this plant', with a 6-month review, since base moved already catches library changes.\n- 'For now, until <date>', any length, unlike Temporary's 30-day cap.\n\nIt adds three ways out that are not overrides:\n- A sensor fault goes to calibration.\n- Built differently goes to the SCADA form.\n- Library wrong becomes a library suggestion. Structural lands here, as a rule on a form answer.\n\nRegulatory/client is parked, because its limits sit on outlet readings, which are next phase. 'Migrated', which migration adds, is missing from your five reasons; v7 shows those as 'Not recorded'.\n\nPlease leave values still marked 'to confirm' (24 types, 6 of 56 alerts) out of your 80% target and out of Deviations until Rajesh Jain signs them off, as your limits memo says.\n\nOn your settled answer on clocks: per-alert clocks are gone.",
      "v71Option": 1,
      "v71Short": "Two reasons (Tuned for this plant, For now) and three ways out: the sensor reads wrong, fix it in SCADA, suggest a library change.",
      "v72Option": 0,
      "v72Short": "Five reasons (Physical, Regulatory or client, Structural, Tuning, Temporary), each with its own path.",
      "v72Does": "v7/2 offers Alex's five reasons and asks for the reason first, because it decides the path. Physical (\"this plant is built differently\") suggests setting a design parameter instead, so the derived value follows; overriding anyway is still offered. Regulatory or client needs a note. Structural (\"this kind always differs\") suggests asking for a library variant. Tuning needs a note and is reviewed in 90 days. Temporary needs an expiry of at most 30 days; on that date the value goes back to the library by itself and the plant admins are told. Every override keeps the value, the base value at the time, the reason, note, author and review date, and after saving it reads, for example, \"Override · Tuning · you · 29 Oct · review by 27 Jan\", with the library value beside it. Manesar's older values come across with the reason Migrated. A probe that reads low is saved as Tuning or Temporary, as in Alex's own example; there is no separate path to a sensor-fault Issue or a calibration Task, so the lowered limit stays until its review.",
      "both": false,
      "links": [
        {
          "label": "Change limits on AT-2's DO: two reasons, three ways out",
          "href": "#/p/manesar/eq/at2",
          "label72": "DO-AT2's zones: five reasons, each with its path",
          "href72": "#/p/manesar/sensor/at2_do?f=zone.below.minor"
        },
        {
          "label": "Manesar's differences from the library",
          "href": "#/p/manesar/differences",
          "label72": "Manesar's deviations",
          "href72": "#/p/manesar/deviations"
        },
        {
          "label": "Diffuser Tank in the library, where suggestions land",
          "href": "#/library/OS_TANK_DF",
          "label72": "Deviations across All Plants: Revert, Extend, Promote",
          "href72": "#/deviations"
        }
      ],
      "where": {
        "1": [
          "p/manesar/eq/at2",
          "p/manesar/eq/at2/readings",
          "p/:plant/differences",
          "differences",
          "library/OS_TANK_DF",
          "library/OS_TANK_DF/readings"
        ],
        "2": [
          "p/:plant/sensor/:id",
          "p/:plant/deviations",
          "deviations"
        ]
      }
    },
    {
      "id": "D7",
      "title": "Should work written for a set of equipment (all the blowers, every basin) be one task, or one per equipment?",
      "short": "One task, or one per equipment",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Issues and Tasks are filed on unit processes, equipment or the plant, and a unit process is the basin itself. Control groups are blowers or pumps that 'feed exactly the same set of downstream nodes', taken from the existing grouping code, but a control group holds only members and a setpoint, so no Task is filed on one. Scheduled Tasks start at go-live.",
      "v6Today": "Every workbook task goes onto each equipment of its type. At DigitalPaani (66 equipment) that makes 325 schedules and about 233 tasks a day. The blower duty/standby changeover and the blower log each land on all 5 blowers every 4 h (30 a day each), though the plant's two blower sets need only 12 changeovers a day. The MBBR inlet flow-meter reading lands on all 5 basins, though only MBBR-1 and MBBR-4 take feed. The v6 doc lists the changeover as a known gap.",
      "mihirsDirection": "This phase has no grouping of equipment into treatment steps or sets. A record sits on one equipment or on the plant, and library tasks reach every equipment of the type. That is right for most work, which really is done on each equipment. It is weaker for duty/standby changeovers: DigitalPaani's drawing already shows which blowers feed the same tanks, so copying the changeover onto each blower is the wrong shape.",
      "options": [
        {
          "label": "One task per equipment (v6 today)",
          "consequence": "Simplest rule and follows the direction exactly. DigitalPaani gets about 233 tasks a day, including 30 blower changeovers where its two blower sets need 12, and flow-meter readings on three basins that have no inlet.",
          "recommended": false
        },
        {
          "label": "Group on screen only: one task per type at the plant, with a line per equipment (v7 now)",
          "consequence": "DigitalPaani drops to about 68 tasks a day, but those tasks still hold about 230 lines, so the work stays the same. Records stay on each equipment, so every reading lands on the right equipment. The changeover still asks for a line per blower, and three basins still get an inlet flow-meter line.",
          "recommended": false
        },
        {
          "label": "Group on screen, and make the two real set jobs one plant round each",
          "consequence": "Same grouping as option 2. On top of it, the blower duty/standby changeover and the MBBR inlet flow-meter reading each become one plant round, only at plants that have that equipment. v6 already does this for instrument, panel and tank rounds. DigitalPaani: about 68 tasks and about 193 lines a day. Vedanta: about 47 tasks. Flaw: DigitalPaani's two blower sets share one changeover round until sets come from the drawing, and its two sludge-pump pairs (one per Tube settler) also merge into one task, as v7 does now.",
          "recommended": true
        },
        {
          "label": "Read the sets from the SCADA drawing now",
          "consequence": "Blowers or pumps that feed the same tanks share one changeover, which gives DigitalPaani's two blower sets the right count (12 a day). But it brings in the set grouping and pipe reading that this phase holds back. Alex's model as written can't file a task on a set either, so this needs a change from Alex. Better as next phase.",
          "recommended": false
        }
      ],
      "recommendation": "Option 3. Grouping on screen cuts DigitalPaani from about 233 tasks a day to about 68, a list the operator can work through. Records stay on each equipment, so every reading lands where it belongs. But grouping alone only hides the two jobs that are really one action for a set. Moving those two to a plant round uses placement v6 already has and adds no new idea. Grouping per type also merges the two Tube settlers' sludge-pump changeovers into one task, although each settler has its own pump pair; keeping those per settler would give about 83 a day. Mihir's 'no sets' rule is fine for this phase, but it is the weaker option for changeovers over time: plan to read sets from the drawing next phase rather than add an editor.",
      "v7Does": "Routine checks, routine work and manual tests show as one task per type at the plant, with a line per equipment (e.g. 'Visual check · 6 pumps'), marked 'to confirm'. PM and calibration stay on each equipment, and the schedules underneath stay per equipment. The go-live confirmation shows tasks a day both ways. Contract should change: (1) make the blower duty/standby changeover and the MBBR inlet flow-meter reading one plant round each, only at plants that have that equipment; (2) compute the go-live figures instead of using the example '41 a day, or 233'. The 233 is DigitalPaani's figure; Vedanta, where the story goes live, is about 47 a day grouped or 59 each. Show the line count next to the task count.",
      "tellAlex": "On real data, filing Tasks on the unit process doesn't cut the count. Each MBBR basin at DigitalPaani is its own unit process, so the tests done on each basin still land five times. The control-group rule you take from the code ('feed exactly the same set of downstream nodes') does match DigitalPaani's drawing, for both blower sets and the sludge-pump pairs. But a control group holds only members and a setpoint, so no Task can be filed on it. Can it become something a Task is filed on, next phase? For pumps, 'same pump function' needs a field our data doesn't have yet. Until then, v7 groups routine work per type at the plant (the changeover becomes one shared task with a line per blower), and we propose making the changeover and the MBBR inlet flow-meter reading plant rounds. Control groups, many-to-many participation and the rules for editing membership stay deferred along with unit processes. Your rule that scheduled Tasks start at go-live stands.",
      "v71Option": 1,
      "v71Short": "Routine checks, routine work and manual tests grouped per type on screen, marked 'to confirm'; PM and calibration stay per equipment.",
      "v72Option": 0,
      "v72Short": "A Task per equipment or unit process; no grouping by type; one Tasks-a-day number.",
      "v72Does": "v7/2 files every Task on one piece of equipment or one unit process, as Alex's model does. No option on this card matches Alex exactly: option 1 is the closest, and Alex also files Tasks on unit processes. Control groups carry no Tasks, so a blower changeover is a Task on each blower, and nothing on screen groups the Tasks of one type. No scheduled Task runs before go-live. The go-live confirmation gives one number, about 59 Tasks a day at Vedanta, where v7/1's grouping shows about 47 on screen; with every binding accepted, DigitalPaani would run about 233 Tasks a day once Live. Readiness counts equipment with no maintenance programme as a gap. Filing Tasks on unit processes does not shorten the list: each MBBR still gets its own tests, and the blower changeover lands on every blower.",
      "both": false,
      "links": [
        {
          "label": "Vedanta tasks, grouped per type",
          "href": "#/p/vedanta/tasks",
          "label72": "BL-1 at Vedanta: its own Tasks",
          "href72": "#/p/vedanta/eq/v_bl1/tasks"
        },
        {
          "label": "Vedanta go live: tasks a day both ways",
          "href": "#/p/vedanta",
          "label72": "Vedanta go live: one Tasks-a-day number",
          "href72": "#/p/vedanta"
        },
        {
          "label": "Blower in the library: the changeover task",
          "href": "#/library/BLW/tasks",
          "label72": "Blower in the library: its Task templates",
          "href72": "#/library/eq-types/BLW/tasks"
        }
      ],
      "where": {
        "1": [
          "p/:plant/tasks",
          "p/:plant/task/:id",
          "p/vedanta",
          "library/:code/tasks",
          "p/:plant/eq/:id/tasks"
        ],
        "2": [
          "p/:plant/tasks",
          "p/:plant/task/:id",
          "p/:plant/cg/:id",
          "p/vedanta/eq/v_bl1/tasks",
          "p/vedanta",
          "library/eq-types/BLW/tasks"
        ]
      }
    },
    {
      "id": "D8",
      "title": "Should a new alert on a Live plant get its own trial, rather than sending the whole plant back to Commissioning?",
      "short": "A trial on a Live plant",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Every Trigger created is a draft that \"never fires\", and a person activates it once its checks pass. Trial firings are recorded only while the whole plant is in Commissioning. On a Live plant, new equipment and Major library versions arrive as drafts, and the only way to get trial evidence again is to return the whole plant to Commissioning. Alex's commissioning memo says a return puts the plant's Triggers back into trial, and Alex's first pack left open who may make one. A Trigger also has a status and a separate Enabled field.",
      "v6Today": "An inherited alert switches itself on whenever it has limits, so nothing ever starts as a draft. After inheriting everything, Manesar has 14 of 14 alerts on and Vedanta has 13 of 13. v6 has no trial and keeps no past readings, so nobody sees what an alert would have done before it starts calling people.",
      "mihirsDirection": "In v5 and v6, Mihir switched an inherited alert on as soon as it had limits, to keep set-up quick. Mihir's standing brief also asks for the consequence to be shown before anything is saved. Here that means showing how often an alert would have fired before it goes on.",
      "options": [
        {
          "label": "Keep v6: an alert switches on once it has limits",
          "consequence": "Fastest. But it breaks Alex's settled rule that library items arrive as drafts, and a new alert on a running plant starts calling people before anyone has seen it fire.",
          "recommended": false
        },
        {
          "label": "Alex as written: drafts, with trial only by sending the whole plant back to Commissioning",
          "consequence": "Matches Alex's model and adds no new state. On a Live plant, switching a new alert on is a guess. The alternative is to send the whole plant back to Commissioning for one blower, which mutes every alert below Emergency, stops scheduled tasks and stops the counts on a staffed, running plant.",
          "recommended": false
        },
        {
          "label": "Drafts, plus a 'last 7 days' preview when switching on, and no trial on Live plants",
          "consequence": "Cheapest, because it reuses the replay the limits sheet already has (and Alex's own 'would have fired' pattern). It works for alerts on sensors that already have readings, such as a library change or a new alert on existing equipment. It tells you nothing about brand-new equipment, which has no past readings.",
          "recommended": false
        },
        {
          "label": "Each alert has its own state, Draft → On trial → On → Off, with the 'last 7 days' preview shown when switching on",
          "consequence": "The plant stays Live, and only the new alerts run On trial: they record trial firings and send nothing until someone switches them On. Commissioning uses the same state for every accepted alert, and the plant's Commissioning → Live switch stays for tasks, counts and Go live. This costs more than the plant switch alone: each alert needs an end date and a trial count, Readiness and Coverage need a list of what is still On trial, and Alex's written rules need a fourth alert status.",
          "recommended": true
        }
      ],
      "recommendation": "Choose option 4, kept narrow: each alert has its own Draft → On trial → On → Off, and the plant's Commissioning → Live switch stays for tasks, counts and Go live. A running plant can then test one new blower's alerts without muting everything else, stopping its tasks or stopping its counts. Show the 'last 7 days' preview next to every switch-on: an alert on a sensor that already has readings can then go On straight away, and only brand-new equipment has to wait out its 7 days. When those 7 days end, the alert stays On trial and Coverage lists it until someone decides. Mihir's earlier v5/v6 direction (switch an alert on once it has limits) is the weaker option, because it sends calls from alerts nobody has seen fire.",
      "v7Does": "Each alert has one state: Draft, On trial, On or Off. Library proposals arrive as drafts. Accepting one at a Commissioning plant puts it On trial (Vedanta), and Go live switches every On trial alert to On. On a Live plant, accepting a proposal (Manesar: What the library brings) puts the alert On trial for 7 days, after which v7 turns it On by itself. Switching an alert Off at a plant is recorded as a change here, with a reason. The contract should change in four ways:\n- Show the 'last 7 days' preview next to the On button.\n- A Live-plant alert On trial only records trial firings. The check runs before an issue is opened, so no message and no hooter goes out. Its Emergency band follows the separate Emergency decision.\n- Instead of turning On after 7 days, it should stay On trial, and Coverage should list it until someone switches it On or Off.\n- Accepted tasks have no trial: they start at Go live, or straight away on a Live plant.",
      "tellAlex": "On drafts: accepted. In v7 every library item arrives as a draft. We propose changing your rules on trial firings, on library versions reaching a Live plant and on returning a plant to Commissioning, so that trial is a state of each Trigger (Draft → On trial → On → Off), not only of a plant in Commissioning. When a Live plant adds a blower or takes a Major version, only those Triggers go On trial, and Activate shows the 'last 7 days: would have fired' preview from your wireframes (principle 3). The alternative is returning the whole plant to Commissioning, which under your Commissioning rules mutes every Trigger and stops Tasks and metrics on a running plant. The plant's Commissioning → Live state stays as it is, for Tasks, metrics and Go live. This needs a fourth status in the spec, alongside your memo's trial edits; 'draft never fires' stays unchanged. If status and Enabled merge, Off keeps the reason your Enabled field carries and its listing in Deviations.",
      "v71Option": 3,
      "v71Short": "Each alert is Draft, On trial, On or Off; on a Live plant an accepted alert runs 7 days On trial, then turns On by itself.",
      "v72Option": 1,
      "v72Short": "Drafts; no trial on a Live plant short of returning the whole plant to Commissioning.",
      "v72Does": "v7/2 follows Alex as written. Every binding arrives as a draft that never fires, and a person activates it once its checks pass. Trial firings exist only while the whole plant is in Commissioning. On a Live plant, new drafts (new equipment, or a major library version) are activated straight into real Issues and notifications, with no trial and no \"last 7 days\" preview. The only way to get trial evidence for them is to return the whole plant to Commissioning, which mutes every Trigger, Emergencies included, stops scheduled Tasks and stops the counts. Manesar's bindings pass shows the choice: its drafts wait there, and activating one gives no trial first.",
      "both": false,
      "links": [
        {
          "label": "Accepting library proposals puts alerts On trial (Vedanta)",
          "href": "#/p/vedanta/library",
          "label72": "Vedanta's bindings pass: accept and start the trial",
          "href72": "#/p/vedanta/review/bindings"
        },
        {
          "label": "Readiness during the trial (Vedanta)",
          "href": "#/p/vedanta",
          "label72": "Readiness during the trial (Vedanta)",
          "href72": "#/p/vedanta"
        },
        {
          "label": "Manesar: accept a proposal on a Live plant, On trial for 7 days",
          "href": "#/p/manesar/library",
          "label72": "Manesar: new drafts on a Live plant, no trial",
          "href72": "#/p/manesar/review/bindings"
        }
      ],
      "where": {
        "1": [
          "p/:plant/library",
          "p/vedanta",
          "p/:plant/alert/:id"
        ],
        "2": [
          "p/vedanta/review/bindings",
          "p/manesar/review/bindings",
          "p/vedanta",
          "p/:plant/trigger/:id"
        ]
      }
    },
    {
      "id": "D9",
      "title": "Should v7 keep the word SCADA and send every correction back to SCADA, showing stored-vs-drawn type mismatches as gaps?",
      "short": "Source name and where fixes go",
      "severity": "Small",
      "arose": "First review",
      "alexSays": "The survey writes the plant graph, and calling it \"SCADA\" is \"a defect in product copy\" (Alex's glossary). Equipment and its type come from \"The survey; tier from the graph\". Alex's follow-up pack dropped the first pack's \"type and tier from the Algorithm\". Fixes go upstream (\"Add sensor in the survey\", \"Fix the survey, then re-run\"), a missing design parameter offers \"Add parameter\", and structure can be overridden: freely in Commissioning, with a reason once Live.",
      "v6Today": "v6 says \"Connect SCADA\" and \"What SCADA found\". The type is the one stored on the SCADA node, or the drawn shape when none is stored. Every SCADA fact, including the SCADA form answers, is read-only (\"change it in the drawing\"), and fixes read \"fix the type in SCADA and read again\". Where the stored and drawn types differ, v6 shows \"drawn as …, the stored type wins\" on several screens but does not count it as needing attention, and its hand-off doc raises only the screen chamber.",
      "mihirsDirection": "SCADA is the only source of equipment, sensors and form answers. The type is a lookup of the stored type (equipmentType, else the drawn code) and is never guessed. The console never edits SCADA facts: fix it in SCADA, then read again.",
      "options": [
        {
          "label": "Keep the word SCADA, keep the console confirm-only, and count mismatches as gaps",
          "consequence": "Same as v6, plus one gap line for each node whose stored and drawn types differ (3 at DigitalPaani). Every correction means a trip to SCADA and a re-read, and nothing has to be merged. The screen chamber still misses Screen Chamber Tank's 6 issues and 14 tasks until the database team changes its stored type.",
          "recommended": true
        },
        {
          "label": "Use Alex's words: survey and plant graph",
          "consequence": "Matches Alex's glossary. But it renames the tool DP staff actually open, and it would call DigitalPaani's import (a SCADA layout export) a survey. If the survey is not where a type is fixed, 'Fix the survey' sends people to the wrong tool.",
          "recommended": false
        },
        {
          "label": "Let the console correct type and form answers, with a reason, kept across re-reads",
          "consequence": "Fastest in the field, and it fixes the screen chamber today. But the console becomes a second source: every re-read needs a merge rule, and a correction can quietly disagree with SCADA. Alex does not propose this for type either.",
          "recommended": false
        },
        {
          "label": "Let the drawn type win where the two differ",
          "consequence": "The screen chamber gains its 6 issues and 14 tasks. EQT Tanks 1 and 2 lose Open Skeleton Tank's items: Tank 2 loses Level high (85/95 %, its only alert that has a sensor) and both lose Tank cleaning. In their place they get Diffuser Tank's DO low, MLSS, Temperature high and SV30 items, which wait with no sensor. It also goes against Mihir's 23 Oct ruling that an EQT tank is not an aeration basin.",
          "recommended": false
        }
      ],
      "recommendation": "Option 1. Ask Alex and Pepe one question: in which tool is a wrong type or a missing form answer actually fixed, and does the SurveyApp write the same node store that SCADA draws? Keep 'SCADA' for now because it names the tool and the export v7 really reads. If the answer is the SurveyApp, change the fix copy to name it: the word should follow where the fix is made, not either glossary. A console correction would create a second source that every re-read must merge, and no single precedence rule is right for all three DigitalPaani nodes (the stored type is right for the EQT tanks, the drawn type for the screen chamber), so show each mismatch as a gap that says what it costs and send the screen chamber to the database team. On this question the evidence supports Mihir's direction, not Alex's rename or a console override.",
      "v7Does": "The word SCADA stays (\"What SCADA found\"). DigitalPaani starts from its real SCADA layout, and type = stored type, else the drawn shape. SCADA facts and form answers are read-only everywhere, and every correction says \"Fix it in SCADA, then read again\". \"What SCADA found\" lists the three DigitalPaani nodes that are stored as Open Skeleton Tank but drawn as Screen Chamber Tank or Diffuser Tank, and Readiness counts each one as a gap (never a blocker). The equipment Details tab shows the stored type, the drawn type and the form answers, all read-only. Contract should change: each mismatch line should say what the stored type leaves out (e.g. \"Screen Chamber Tank's 6 issues and 14 tasks do not reach it\"). For the EQT tanks the stored type is the right one, so a bare \"fix it in SCADA\" there points at the wrong side.",
      "tellAlex": "We disagree with your glossary on the word. The console keeps 'SCADA' because it is the tool DP staff open and the export we read. If the SurveyApp is where a type or a form answer gets fixed, tell us and the fix copy will name it. Please confirm two things: that the SurveyApp writes the same node store SCADA draws, and that your follow-up pack's 'The survey; tier from the graph' replaces your first pack's 'type and tier from the Algorithm'. On overriding structure: no console edits of type or form answers. Fixes go upstream and the plant is read again, as your own 'Fix the survey, then re-run' already says. On Readiness: please add a non-blocking case, 'stored and drawn types differ', next to 'untyped equipment'. DigitalPaani has three such nodes (Screen Chamber, EQT Tanks 1 and 2), and the Screen Chamber's stored type is wrong. The 'Add parameter' action in your wireframes maps to a missing SCADA form answer; see the limits decision (D18).",
      "v71Option": 0,
      "v71Short": "Keeps the word SCADA; its facts are read-only and fixes go back to SCADA; drawn-versus-stored type mismatches are Readiness gaps.",
      "v72Option": 1,
      "v72Short": "Survey and plant graph; the word SCADA never appears; a drawn-versus-stored mismatch shows only on Details.",
      "v72Does": "v7/2 uses Alex's words: the survey writes the plant graph, and the word SCADA never appears on its screens. DigitalPaani is tagged \"Real plant graph\". Equipment and sensors come from the plant graph and are read-only in the console; a missing sensor says \"Add sensor in the survey\", and a wrong type says \"Correct the survey, then re-run identification\". Each piece of equipment takes the type the plant graph stores. The screen chamber is drawn as a Screen Chamber Tank and stored as an Open Skeleton Tank: Alex's model has no gap for that, so it shows only on its Details. Identification proposes it as a Collection sump, and a person can change its type to Screening in the structure pass, which brings the screening content.",
      "both": false,
      "links": [
        {
          "label": "What SCADA found at DigitalPaani",
          "href": "#/p/digitalpaani/scada",
          "label72": "The structure pass at DigitalPaani",
          "href72": "#/p/digitalpaani/review/structure"
        },
        {
          "label": "DigitalPaani Readiness (mismatch gaps)",
          "href": "#/p/digitalpaani",
          "label72": "DigitalPaani Readiness: the Structure track",
          "href72": "#/p/digitalpaani"
        },
        {
          "label": "Screen Chamber Tank in the library",
          "href": "#/library/OS_TANK_SC",
          "label72": "Screen Chamber Tank in the library",
          "href72": "#/library/eq-types/OS_TANK_SC"
        }
      ],
      "where": {
        "1": [
          "p/:plant/scada",
          "p/digitalpaani",
          "p/:plant/eq/:id/details",
          "library/OS_TANK_SC/:tab?",
          "p/digitalpaani/eq/6968e88f2454ffacb8da3582/:tab?",
          "p/digitalpaani/eq/6968ed56656f906c6d864b9d/:tab?",
          "p/digitalpaani/eq/6968ed6b7578fbe0e9990ead/:tab?"
        ],
        "2": [
          "p/:plant/review/structure",
          "p/digitalpaani",
          "p/:plant/eq/:id/details",
          "p/:plant/up/:id/details",
          "library/eq-types/OS_TANK_SC/:tab?"
        ]
      }
    },
    {
      "id": "D10",
      "title": "Should the phone Equipment Card be the equipment page in a phone layout, or its own view that shares the one editor?",
      "short": "Phone card and equipment page",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "One editor everywhere. Every object has one page and one URL, a library type uses the instance page plus Downstream and Publish, inheritance is a property of each field rather than a step, and the plant is chosen on the page, never in a header switcher. Alex marks most of these as settled and one as still being worked on. One question is still open: are the Equipment Card and the equipment configuration page one surface or two? Alex's reference already half-answers it: limits are edited only on the sensor and are read-only on the Card's range bar, and the Card opens the same PM editor in a sheet. Only an undecided point in Alex's first pack lets the Card's sensor tile edit limits.",
      "v6Today": "v6 has two views of each piece of equipment, and they never link to each other: the console equipment page (its address doesn't name the plant) and the card in the operator app. The only link from the console page is a general 'work them in the operator app'. Each value already has a source chip, but inheritance is still a step with 'Inherit everything', a library type is edited in its own sheet ('Where it lands', 'Save and roll out'), and the plant is switched in the header.",
      "mihirsDirection": "Mihir hasn't decided whether the Card and the equipment page are one thing or two. Mihir's standing rules are one home per fact and nothing drawn twice, and on 16 Oct Mihir decided Leads may edit limits and alerts, so a Lead on the phone needs a way to reach the editor. The header switcher came with v1's look when Mihir asked for v4 to use v1's design. Nothing shows Mihir chose it on purpose, so removing it goes against no decision of Mihir's.",
      "options": [
        {
          "label": "One page, two layouts",
          "consequence": "The Card is the equipment page at the same address, with the same tabs (Readings · Issues · Tasks · Details) fitted to a phone. There is one address to share and one thing to build in v7. But the Card's own design (one action per screen, a card shape for each equipment type) gets rebuilt around the console's tabs, and four tabs on a phone work against 'one decision per screen' for Leads.",
          "recommended": false
        },
        {
          "label": "Two linked views, one editor",
          "consequence": "The Card stays the Lead's phone view with its own layout, and the equipment page stays the admin's dense view. Each links to the other for the same equipment. The Card stores nothing and has no editor of its own: limits show read-only on the range bar, and 'Change limits' or a task's cadence opens the same sheet the equipment page uses, so a Lead with permission can make the change from the phone. The cost is two layouts that must show the same facts.",
          "recommended": true
        },
        {
          "label": "Let the Card edit limits on its sensor tile",
          "consequence": "This adds a second editor for limits. It is quick for a Lead, but a limit could then change in two places under two sets of rules. That breaks one home per value, and it is the one point where Alex's two packs disagree.",
          "recommended": false
        },
        {
          "label": "Keep v6: two views, not linked",
          "consequence": "No work, but a Lead and an admin can't reach each other's view of the same tank. The open-issues banner on the console page sends people to the operator app's home, not to that equipment.",
          "recommended": false
        }
      ],
      "recommendation": "Two linked views, one editor. The Card never stores or edits its own copy of a value, so one home per value still holds. Leads keep a phone-first screen and admins keep density, as Alex's own principles ask, and the Card's existing design isn't rebuilt around the console's tabs. The v7 plan's 'one surface' is the weaker answer, but fixing it is small: v7's Phone view already has its own layout, so only the way it is described and the links in both directions change. The rest of this card is already settled and v7 does it (the plant in every address, a source chip on every value, the library type on the equipment page), so the answer there is simply 'agree'.",
      "v7Does": "There is no header plant switcher: the plant is picked on All Plants and appears in every address. There is no inherit step: every value shows where it comes from (From the library · From the SCADA form · Changed here · Library changed since). The library type page is the equipment page plus Where it lands and Publish. The equipment page has the tabs Readings · Issues · Tasks · Details. Its Phone view (the Equipment Card) shows the same content one decision per screen, with limits read-only and 'Change limits' opening the same limits sheet. Contract should change: the 'One object page' rule records the answer as one surface, the same page in a phone frame. It should record two linked views that share one editor: the Card has its own layout for the Lead, links to the equipment page and back, and holds no value of its own.",
      "tellAlex": "Agreed: one editor everywhere, one page and one address per object, the plant chosen on the page, and inheritance as a property of each field. v7 puts the plant in every address with All Plants as the way in, shows a source chip on every value instead of an inherit step, and makes the library type the equipment page plus Downstream ('Where it lands') and Publish. On the open question: two surfaces, one editor. The Equipment Card stays the Lead's phone view and holds no value of its own. It shows limits read-only on the range bar, opens the same limits and PM-cadence sheets as the equipment page, and links to that page and back. Please retire your first pack's 'edit limits on the Card's sensor tile' so that your reference is the only answer. Who may edit from the Card follows your permission rules, which v7 can't show yet because it has a single user.",
      "v71Option": 1,
      "v71Short": "Two linked views, one editor: the phone view shows limits read-only and opens the same limits sheet as the equipment page.",
      "v72Option": 1,
      "v72Short": "Limits edited only on each sensor's page (Zones); the Equipment Card shows them read-only and links there.",
      "v72Does": "v7/2 follows Alex's drafts: one editor for each value. Every sensor has a page of its own, and a plant's limits are edited only there, under Zones. A Trigger page shows its bands as \"Follows sensor\" and links there; its one exception is \"Override for this Trigger only\". The Readings tabs of equipment and unit-process pages show limits read-only with \"Edit on sensor\". The equipment page has Readings · Issues · Tasks · Details, like every object page and its library type. The Equipment Card is the Lead's phone screen for the same equipment: limits show read-only on its range bars with \"Edit on sensor\", and a Task's cadence opens the same editor in a sheet. This is the shape of option 2, the same option v7/1 builds; the difference is the separate sensor page, one more page between a reading and its limits.",
      "both": false,
      "links": [
        {
          "label": "Equipment page: AT-2, Manesar",
          "href": "#/p/manesar/eq/at2",
          "label72": "Sensor page: DO-AT2, the one place its limits are edited",
          "href72": "#/p/manesar/sensor/at2_do"
        },
        {
          "label": "Phone view of the same equipment",
          "href": "#/p/manesar/eq/at2/phone",
          "label72": "Equipment Card: BL-1, read-only range bars",
          "href72": "#/p/manesar/eq/bl1/phone"
        },
        {
          "label": "Library type page: Diffuser Tank",
          "href": "#/library/OS_TANK_DF",
          "label72": "Library type page: Activated sludge, the unit-process type of AT-2",
          "href72": "#/library/up-types/activated-sludge"
        }
      ],
      "where": {
        "1": [
          "p/:plant/eq/:id/phone",
          "p/manesar/eq/at2/:tab?",
          "library/OS_TANK_DF/:tab?"
        ],
        "2": [
          "p/:plant/sensor/:id",
          "p/:plant/eq/:id/phone",
          "p/:plant/up/:id/phone",
          "library/up-types/activated-sludge/:tab?"
        ]
      }
    },
    {
      "id": "D11",
      "title": "When a library change reaches the plants, should the plants whose values change be told, and how?",
      "short": "Telling plants about library changes",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "An open question in Alex's pack asks whether a plant is told when the library value under its override moves. Alex already marks this without a push in three places: on the field ('Library changed 1.5 → 1.8 since you overrode it', with Keep or Adopt), in Deviations and on plant Coverage. Under Alex's library-version rule, a Minor change ('a default value or a limit rule') updates every following plant with no notice, and only Emergency or statutory changes tell plant admins. The Downstream panel in Alex's wireframes shows '41 follow · will update', '6 override · base moved' and '57 Tasks become due now across 23 plants', and Alex lists that panel as a feasibility risk.",
      "v6Today": "'Save and roll out' changes the limits and task cadences of every following item at all four plants at once. Items a plant had changed are skipped and only counted in a toast. One Activity line goes to the plant that is open, and the other plants get nothing. 'Where it lands' counts equipment and readings but not tasks, and adds a fixed count of 31 more plants.",
      "mihirsDirection": "In v3, a change to a followed item waited until each plant applied the update. v5 and v6 reversed that, so a library save now changes every plant at once. The standing direction is that the User Center decides who is told, not the console, so the console's job is to show what changed.",
      "options": [
        {
          "label": "As Alex drew it: followers change at once, with no note",
          "consequence": "Least work. Plants that kept their own value get the 'Library changed since' mark. Plants that follow get new limits, or tasks that are suddenly due, and nothing explains why. Only the version on the source chip changes. If the publisher counts from the last service, Leads find a pile of tasks due today with no reason given.",
          "recommended": false
        },
        {
          "label": "Followers change at once, and every plant that changes gets a dated note",
          "consequence": "Each plant whose value changes gets an Activity entry and a Coverage line (e.g. 'Library changed Bearing service to every 4 months; 1 task due now'), and each task the change makes due says why. Plants that kept their own value show 'Library changed since' on the field and in Differences from the library. 'Where it lands' is a dry run with true counts over the four sample plants, so its numbers are small, not Alex's 41. Nothing is pushed.",
          "recommended": true
        },
        {
          "label": "Plants apply updates themselves (v3)",
          "consequence": "Nothing changes at a plant until someone there applies the update, so nobody misses a change. But plants fall behind the library and each one builds up a queue to work through. A fix made once in the library no longer reaches every plant, and safety changes would still have to be forced.",
          "recommended": false
        },
        {
          "label": "Send a message to plant people for every change and every library move",
          "consequence": "The most visible option, and the noisiest for small changes. It also moves the choice of who is told into the console, when that choice belongs in the User Center.",
          "recommended": false
        }
      ],
      "recommendation": "Take option 2. Answer Alex's question as drawn: no push when the library moves under a plant's own value, because that plant's value didn't change, and the field, Differences from the library and Coverage already show 'Library changed since'. The real gap is the plants that follow: their limits or task cadences change and nobody there hears about it. A dated note at each of those plants and a reason on each task that becomes due closes that gap without a push, and the User Center still decides who gets pushed. Mihir's earlier v3 direction (plants apply updates themselves) is the weaker option, because plants drift from the library and a fix stops reaching everyone. So keep v6's change-at-once rollout and add the note.",
      "v7Does": "Editing a type's limit or task cadence creates a draft. 'Where it lands' shows true counts for each of the four plants:\n- values that change (from → to) at plants that follow;\n- plants that changed the value (they keep it and will show 'Library changed since');\n- open issues (they keep the terms they opened under);\n- tasks that would become due now, each with the reason.\n\nPublishing changes the followers at once and writes a dated change note to each affected plant's Activity and Coverage. Nothing is pushed. A change to the Emergency band counts as a safety change: it needs a reason and reaches every plant, and plants that had changed the value lose that change, with a note saying so.\n\nContract should change in two places:\n- Each task a publish makes due should carry that reason on its own task page, not only in 'Where it lands'.\n- 'Where it lands' should say that it counts the four sample plants, and should drop the fixed count of other plants.",
      "tellAlex": "On your open question: no push when the base under an override moves. That plant's own value didn't change, and your field mark, Deviations and Coverage already show it. In v7 the mark reads 'Library changed since'. What I'd challenge in your library-version rule is the other side: a Minor change updates every following plant's limits or cadence and nobody at that plant is told, which sits badly with principle 1, 'Nothing changes silently'. v7 still publishes to followers at once, but it writes a dated change note to each changed plant's Activity and Coverage, and every Task the change makes due says why. Nothing is pushed, because the User Center decides who is told. The Downstream panel in your wireframes becomes a dry run with true counts over our four sample plants, not 41 and 57.",
      "v71Option": 1,
      "v71Short": "Followers change at once and each plant whose values change gets a dated note in Activity and Coverage; nothing is pushed.",
      "v72Option": 0,
      "v72Short": "Followers change at once with no note; overrides show Base moved.",
      "v72Does": "v7/2 does what Alex drew. When a library change is published, the plants that follow change at once, and nothing is sent or written to them: only the version on the source chip changes. The publish is logged once, in All Plants Activity. Overrides whose library value moved are marked \"Base moved\", the only amber state, on the field, in Deviations and as a count on Coverage, with Keep or Adopt the library value; an override that now equals the new value is cleared. The publisher sees every plant in Downstream before publishing, but the plants get no dated note. Only a forced change tells anyone: the plant admins at each plant it reaches.",
      "both": false,
      "links": [
        {
          "label": "Blower in the library: edit, Where it lands, publish",
          "href": "#/library/BLW",
          "label72": "Blower in the library: edit, Downstream, publish",
          "href72": "#/library/eq-types/BLW/tasks"
        },
        {
          "label": "Manesar: Differences from the library",
          "href": "#/p/manesar/differences",
          "label72": "Manesar's deviations: Base moved",
          "href72": "#/p/manesar/deviations"
        },
        {
          "label": "Manesar Coverage with library change notes",
          "href": "#/p/manesar",
          "label72": "Manesar Coverage: deviations here",
          "href72": "#/p/manesar"
        }
      ],
      "where": {
        "1": [
          "library/BLW/:tab?",
          "p/manesar/differences",
          "p/manesar",
          "p/:plant/activity",
          "activity/:plant?"
        ],
        "2": [
          "library/eq-types/BLW/tasks",
          "library/templates/:id",
          "p/manesar/deviations",
          "p/manesar",
          "p/:plant/activity",
          "activity/:plant?"
        ]
      }
    },
    {
      "id": "D12",
      "title": "Should hand-test readings get limits and a plant Readings list, so that a test result past its limit prompts a report?",
      "short": "Hand-test readings and limits",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "A Reading is 'any value: measured, computed, manual or lab', and one of Alex's wireframes shows 'MLSS · manual' with limits, an override and a Trigger. But limits are edited only at 'Sensor page → Zones', and No data means 'no sample within two poll intervals', so a manual or lab reading has nowhere to keep its limits and no 'No data' rule. An open question in Alex's pack proposes a plant-level Readings tab, drawn only on Live plants in the wireframes, and the proposed rule of 1.5 × the expected interval was never confirmed and is missing from Alex's follow-up pack.",
      "v6Today": "A manual reading can sit on a piece of equipment, where it uses the same limits sheet as a sensor, or on the plant, where it raises no alert. A number typed into a task step stays in the task record and is never compared with a limit. That covers 29 of the 32 number steps, including the DO hand test. DigitalPaani's 5 MBBRs have no sensors, so low DO shows up only in the 8-hourly test, and the operator has to notice it and raise it separately through 'Report a problem'. The workbook rule 'below 1 ppm, test every 2 hours' is kept only as a note.",
      "mihirsDirection": "Readings and alerts sit on the equipment only. Inlet and outlet water values wait for the next phase, visible but read-only. Limits live on the reading itself, and a typed value never overwrites an online reading. The earlier answer to the Readings-tab question was a read-only list with no alerts in this phase. That keeps the equipment rule but leaves hand-test results unchecked.",
      "options": [
        {
          "label": "Keep as drafted: the Readings tab on Live plants only, test results stay in the task record",
          "consequence": "Least work. Alex's 'MLSS · manual' still has nowhere to keep its limits, and staff tuning during Commissioning get no list of readings. At DigitalPaani a DO test below 1 mg/L is logged and nothing else happens, unless the operator thinks to report it.",
          "recommended": false
        },
        {
          "label": "Readings taken in the equipment get limits, and a test past its limit offers a report",
          "consequence": "In-tank hand tests (DO, pH, temperature, SV-30, MLSS, OUR) use the same limits sheet as sensors and pick up the library's limits by reading and direction (MBBR DO: Minor below 2.0, Major below 1.0 mg/L). Their expected interval comes from the test's schedule. The plant Readings list appears in both Commissioning and Live, grouped by equipment. Inlet and outlet lab results (COD, BOD, ammonia, nitrate, TSS, turbidity, alkalinity) are listed read-only under 'Next phase'. From go-live, a test result past its limit shows the limit and offers 'Report Low DO level in the bioreactor' with the value attached, and a person decides. 'No data' after 1.5 times the test interval changes only how the reading looks, because a late test already shows as an overdue task.",
          "recommended": true
        },
        {
          "label": "A test result past its limit opens the issue by itself",
          "consequence": "No tap needed, and the DO test could switch to every 2 hours below 1 ppm. But one mistyped number would open an issue and tell people. It also cuts against Alex's own 'automation proposes, a person confirms', and it needs everything in option 2 to be built first.",
          "recommended": false
        }
      ],
      "recommendation": "Option 2. At plants without probes the hand test is the only way to find low DO. One prompt that links the test step to the existing 'Report a problem' closes that gap, and a person still decides. Limit this to readings taken in the equipment: 7 of the MBBR's 13 hand tests sample inlet or outlet water, and giving those limits would break the equipment-only rule. Mihir's earlier position, that test values stay only in the task record, is the weaker one and should change; opening issues automatically (option 3) can wait until people have used the prompt.",
      "v7Does": "Manual and lab readings use the same limits sheet as sensors and show an expected interval. A test whose steps record no number (a visual check such as 'Biofilm visual check on media and microscopy') stays a task only: it is not listed as a reading and does not count as a reading with no limits. The plant Readings tab appears in both Commissioning and Live and lists every reading grouped by equipment, with its kind (SCADA, manual, lab), latest sample value and limits. The task page shows steps with checkboxes: a typed number gets no limit and no report offer. The contract should change in three ways. First, give limits only to manual and lab readings taken in the equipment, and list inlet and outlet lab results read-only under 'Next phase'. Second, on a Live plant, a hand-test number step past its limit should show the limit and offer to report the matching issue with the value attached. Third, take the expected interval from the test's schedule, and use 'No data' after 1.5 times that interval only to change how the reading looks.",
      "tellAlex": "On the plant Readings tab: yes, a plant Readings list in both Commissioning and Live, grouped by equipment. Manual and lab readings taken in the equipment (DO, pH, MLSS, SV-30 and so on) are where your limit rules land, the same as on a sensor. That gives the 'MLSS · manual' reading in your wireframes the 'Edit on sensor' home it is missing. Inlet and outlet lab values stay read-only until connections come. Please bring back the proposed 1.5 × rule as part of your No data rule: 1.5 × the test's own schedule interval, as a display state only, since a late test already shows as overdue. On a Live plant, a hand test past its limit offers to report the matching Issue with the value attached, and a person decides, in line with your 'automation proposes, a person confirms'.",
      "v71Option": 1,
      "v71Short": "Manual and lab readings get limits and a Readings tab in both states; a number typed in a test gets no limit and no report offer.",
      "v72Option": 0,
      "v72Short": "Readings tab on Live plants only; hand-test results stay in the Task, with no limits.",
      "v72Does": "v7/2 keeps Alex's draft. The plant Readings tab appears on Live plants only and lists the plant graph's sensors with their zones. Manual and lab results are not readings with limits: they stay in the Task record where they were typed, with no limits and no prompt to report. Vedanta, in Commissioning, has no Readings tab. Once DigitalPaani is Live, a DO test below 1 mg/L there would be logged in its Task, and nothing else would happen unless the operator reports it. Alex's own unit-process drawing points the other way, with a manual MLSS reading that has limits and a Trigger; v7/2 follows this card's option and asks Mihir to confirm.",
      "both": false,
      "links": [
        {
          "label": "Vedanta readings: manual and lab readings with an expected interval",
          "href": "#/p/vedanta/readings",
          "label72": "Manesar Readings: a Live plant's readings",
          "href72": "#/p/manesar/readings"
        },
        {
          "label": "MBBR in the library (DO limits and hand tests)",
          "href": "#/library/MBBR",
          "label72": "MBBR in the library (unit-process type): hand tests as Tasks",
          "href72": "#/library/up-types/mbbr/tasks"
        },
        {
          "label": "Manesar tasks on a Live plant",
          "href": "#/p/manesar/tasks",
          "label72": "AT-2's Tasks: the hand tests",
          "href72": "#/p/manesar/up/at2/tasks"
        }
      ],
      "where": {
        "1": [
          "p/:plant/readings",
          "library/MBBR/:tab?",
          "p/manesar/tasks"
        ],
        "2": [
          "p/:plant/readings",
          "library/up-types/mbbr/:tab?",
          "p/manesar/up/at2/tasks"
        ]
      }
    },
    {
      "id": "D13",
      "title": "Should the console only read people from the User Center, and drop the per-alert start-by and fix-by fields?",
      "short": "People, phones and response times",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Alex's settled answer: an Issue's start-by and fix-by come from its severity, and a Task's come from tier and cadence. There is no per-Trigger override except a PM's tolerance days, yet Alex's own notifications document still lets a Technical Admin change both numbers on a rule. Alex's follow-up pack puts roster, phones and routing in the console under Plant → People, adds a Readiness People track with 'Send code', and puts grants plus an access review on a global Access page, building on the 'Roles & Routing' roster in the product requirements.",
      "v6Today": "Step 2 'People' keeps a roster in the console: one role per person, and 'Mark verified (demo)' for phones. Step 6 lets each alert change 'Must start within' and 'Must be fixed within', and v6 cites Alex's notifications document as allowing this. It also lets each schedule change its grace days, and the plant change its quiet hours and hooter.",
      "mihirsDirection": "Since v3, who is told is worked out in the User Center, not the console. v3 and v4 kept to this, but v1, v5 and v6 brought a console roster back. Mihir never ruled out per-alert clocks: every version from v1 to v6 kept them, following Alex's notifications document.",
      "options": [
        {
          "label": "The console reads people, the User Center owns them, and start-by and fix-by follow the severity",
          "consequence": "Alerts have no start-by or fix-by fields; a PM's grace days stay on the schedule. Readiness reads reachability from the User Center and blocks Go live until there is a reachable operator and a reachable lead, with a link out. The roster, phone checks, admin access and its review, quiet hours and the hooter switch all live in the User Center. Commissioning staff have to switch tools to fix people, and the reply to Alex must list this as a disagreement with their pack and their configuration spec.",
          "recommended": true
        },
        {
          "label": "Alex's People track in the console",
          "consequence": "No start-by or fix-by fields. The roster, phones with Send code, routing, admin access and the access review are all edited in the console. Commissioning staff get one tool, but a person's phone and access get a second home beside the User Center, and the two have to be kept in step across plants.",
          "recommended": false
        },
        {
          "label": "Keep the per-alert clock fields, with people in the User Center",
          "consequence": "Matches Alex's notifications document and every earlier version. But a response time typed per alert drifts from plant to plant, so nobody can say what the response time is and no central change can fix it. It also reopens an answer Alex has settled.",
          "recommended": false
        },
        {
          "label": "Keep v6 as it is",
          "consequence": "A console roster with demo phone checks, plus per-alert clock fields. People and response times each end up with two homes, which contradicts both Alex's settled clock answer and Mihir's User Center rule.",
          "recommended": false
        }
      ],
      "recommendation": "Option 1. On clocks, Mihir's own earlier versions are the weaker side. A response time typed per alert drifts plant by plant and can't be reasoned about centrally, while one severity table keeps one home per fact; keep only a PM's grace days, which Alex's rule itself allows. On people, a phone number and an admin grant belong to the person across all plants, so the User Center should be their one home; the console only needs to know whether someone can be reached, and a Readiness blocker with a link out covers that. The cost is a tool switch for commissioning staff and an open disagreement with Alex's pack, which the reply should name.",
      "v7Does": "There are no start-by or fix-by fields anywhere. The alert page shows 'Start by / fix by follow the severity' as read-only text (Emergency 1 h / 4 h, Major 8 h / 24 h, Minor 24 h / 72 h). Readiness has a read-only 'Who is told' track fed from a stub User Center roster (v6's people), with an 'Edit in the User Center' link that only shows a toast; a missing reachable operator or lead blocks Go live. There is no roster editing, no Send code and no Access page. Contract should change: (1) keep a PM's grace days on the schedule, shown on the task page and changeable with a reason, because 'no per-alert clocks anywhere' leaves this unstated; (2) say that quiet hours and the hooter switch are read from the User Center and shown read-only; (3) word the blocker as 'no reachable operator, or no reachable lead', because 'no reachable operator and no reachable lead' reads as blocking only when both are missing.",
      "tellAlex": "Your settled answer on clocks is accepted. In v7 an Issue's start-by and fix-by follow its severity with no per-alert fields, and a PM's tolerance days should stay on the schedule (v7 doesn't show them yet). Please also change every place in your notification documents (the brief, its acceptance criteria and its decisions log) that still lets a Technical Admin change both numbers on a rule; your settled answer lists only the v6 prototype among the documents to change. On people, v7 departs from your pack's Plant → People page, the people rows of your permission matrix, the 'Send code' track on your Readiness wireframe and the 'Roles & Routing' roster in the product requirements. The console only reads the roster and reachability from the User Center, and grants, the access review, site quiet hours and the hooter switch live there. With people read-only in the console, can you restate why Go live needs the People half of Full Admin?",
      "v71Option": 0,
      "v71Short": "People are read-only from a User Center stub; no start-by or fix-by fields: both follow the severity.",
      "v72Option": 1,
      "v72Short": "Roster, phones and routing edited on the plant's People tab; no per-Trigger clocks.",
      "v72Does": "v7/2 puts Alex's People track in the console. The plant's People tab holds the roster: each person's role (Operator, Lead, Senior Lead or Client viewer), phone, channel and admin grant. \"Send code\" sends a code; the person verifies their own phone with it. Routing shows who each severity reaches, and the hooter is the plant's one setting. Readiness blocks Go live until an Operator and a Lead can be reached on a verified phone, and links to People. DigitalPaani starts with nobody, so adding its people is part of the Readiness chapter. Triggers have no start-by or fix-by fields: both follow the severity. A person's phone now has a home in the console as well as in the User Center, and nothing keeps the two in step.",
      "both": false,
      "links": [
        {
          "label": "DigitalPaani Readiness: no people yet blocks Go live",
          "href": "#/p/digitalpaani",
          "label72": "DigitalPaani: People, the roster and Send code",
          "href72": "#/p/digitalpaani/people"
        },
        {
          "label": "Vedanta Readiness: the read-only Who is told track",
          "href": "#/p/vedanta",
          "label72": "Vedanta Readiness: the People track",
          "href72": "#/p/vedanta"
        },
        {
          "label": "Alert page: start by and fix by follow the severity",
          "href": "#/p/manesar/alert/a_do_at2",
          "label72": "Trigger page: no clock fields",
          "href72": "#/p/manesar/trigger/a_do_at2"
        }
      ],
      "where": {
        "1": [
          "p/digitalpaani",
          "p/vedanta",
          "p/:plant/alert/:id",
          "p/:plant/issue/:id"
        ],
        "2": [
          "p/:plant/people",
          "p/digitalpaani",
          "p/vedanta",
          "p/:plant/trigger/:id",
          "p/:plant/issue/:id"
        ]
      }
    },
    {
      "id": "D14",
      "title": "Which words go on screen where Alex's word list and v6's disagree?",
      "short": "Words on screen",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Alex's word list maps each idea to one word and says \"Anything in the right column is a defect in product copy.\" It requires Equipment, Trigger, Zones, Persistence/Clearing, Override, Base moved, Deviation, Library and All Plants. It bans machine, alert, schedule, custom, estate, workflow, database (as a name for the library) and SCADA (as a name for the plant graph).",
      "v6Today": "v6 shows several words that Alex's list bans: a word for equipment that leaves tanks out, a name for the all-plants page, 'Workflows', 'Full Site Admin', 'Limits and alerts' and 'Hold for'. It also has one chip word that means two things: a plant's own edit, and an alert with its own limits. Its rule V6-37 keeps the words for treatment steps, equipment groups and duty/standby off screen, and spec words appear only behind 'Show the model underneath'.",
      "mihirsDirection": "No spec words on screen, only behind a model toggle. Every label must pass 'would Devid know what this means?'. SCADA is the only source of equipment, so 'SCADA' stays on screen.",
      "options": [
        {
          "label": "Adopt Alex's word list wholesale",
          "consequence": "Alex's documents, the spec and v7 share one vocabulary, and Alex's review finds no copy defects. But admins meet spec terms for the configured rule, the hold and clear times, the base-moved state and the list of differences. 'SCADA' disappears from the source screen. And Alex's own wireframes already fall back to 'limits' and 'must hold for'.",
          "recommended": false
        },
        {
          "label": "Keep v6's words and map Alex's terms only in the hand-off doc",
          "consequence": "No copy changes. But v6's real ambiguities stay: tanks are called by a word that leaves them out, one chip word means two things, and the library is sometimes called 'database'. Alex's review flags each one as a defect.",
          "recommended": false
        },
        {
          "label": "Word by word: take Alex's words where they fix a meaning, keep plain words for the mechanics, put the mapping in a word map",
          "consequence": "From Alex: Equipment, Issue, Task, Library (never 'database'), All Plants, Trial firing, Readiness/Coverage, Commissioning/Live and the severity names. Kept plain: 'alert', 'limits', 'must hold for' / 'must clear for', 'Changed here', 'Library changed since' and 'Differences from the library'. SCADA stays as the source. Screens pass the Devid test and Alex gets an exact list. The cost is a short agreement with Alex, and 'alert' departs from the spec's word for the configured rule.",
          "recommended": true
        },
        {
          "label": "Word by word as above, plus v6's 'Show the model underneath' toggle on every screen",
          "consequence": "Alex's terms are visible in the app next to each label. But every screen then carries two vocabularies to keep in step, and the toggle only serves Alex and developers, who already get a word map in the hand-off doc.",
          "recommended": false
        }
      ],
      "recommendation": "Go word by word, with the mapping in a word map in the hand-off doc. Where a word fixes a real meaning, Alex is right and v6 should give way: a tank is equipment, and v6's two-meaning chip word and 'database' for the library both confuse. On the mechanics the gap is small, because Alex's own wireframes already show 'limits', 'must hold for' and 'must clear for' on screen. 'Alert' stays because v7's alerts are only ever fired by a reading (scheduled work is a task's cadence). v7 uses alert for the configured rule; 'alerts reach people' means that rule's notifications start. Mihir's earlier direction is weaker in two places. The model toggle isn't needed, because one word map in the hand-off doc does the job. And V6-37 should be a scope rule rather than a permanent ban, so Alex's names for treatment steps and equipment groups get used when those arrive next phase.",
      "v7Does": "On screen, v7 uses: equipment, sensor, reading, limits (Caution · Minor · Major · Emergency), alert (what an admin sets), issue (what opens), task, root cause, fix, library, SCADA, the database's type names as stored, 'must hold for N min' / 'must clear for N min', Commissioning, Live, Readiness, Coverage, On trial, trial firings and All Plants. The source chips are From the library · From the SCADA form · Changed here · Library changed since · No limits yet · Next phase. Alex's spec terms and v6's ambiguous words never appear on screen, and the smoke test checks the rendered pages for them. There is no model toggle. The mapping lives only on the Decisions page and in the hand-off doc. Contract should change: the hand-off doc should carry an explicit two-column word map (Alex's word, v7's word, the reason), and the smoke test's banned-word check must skip the Decisions page, because those cards quote Alex.",
      "tellAlex": "Words (your word list): v7 adopts Equipment, Sensor, Reading, Issue, Task, Library (never 'database'), All Plants, Full Admin, Commissioning/Live, Readiness/Coverage, Trial firing, the severity names and Fix. On screen it keeps 'alert' for what an admin sets. That is always fired by a reading; scheduled work shows as a task's cadence. We know this departs from the spec's 'Trigger'. It also keeps 'limits' and your own wireframe labels 'must hold for' / 'must clear for'. Trigger, Zones, Persistence/Clearing, Binding, Derived, Override, Base moved and Deviation go into the hand-off doc's word map; on screen those ideas read as 'Changed here', 'Library changed since' and 'Differences from the library'. 'SCADA' stays as the source; that is answered on the D9 card. We're dropping the V6-37 ban, so Stage, Unit process and Control group will be your names when those arrive next phase. One product-copy slip in the pack: 'Live · 1.8 mg/L' on one of your wireframes. Separately, 'Archetype AR-2' on another wireframe puts a code on screen.",
      "v71Option": 2,
      "v71Short": "Word by word: alert, issue, task, limits, 'must hold for'; Alex's spec terms never on screen; the mapping in a word map.",
      "v72Option": 0,
      "v72Short": "Alex's word list wholesale: Trigger, Zones, Persistence, Override, Base moved, Deviation and the rest.",
      "v72Does": "v7/2 uses Alex's word list wholesale: Trigger (what an admin configures), Issue and Task, Zones (a sensor's limits), Persistence and Clearing (\"must hold for\", \"must clear for\"), Override, Base moved, Deviation, Binding, Review queue, Trial firing, Diagnostic flow and Action flow, Fix and Verify, Criticality tier A · B · C, Equipment, Plant graph, Design parameter, Template, Limit rule, Unit process, Stage and Control group. Words Alex bans never appear on its screens, among them alert, machine, schedule, SCADA, estate and custom, and the smoke test checks every page for them. Each value shows its source: Library, Derived, Proposed, Override, Base moved or Gap, and Forced, Suspended or Pinned where they apply. The cost is a vocabulary the plant has to learn: a reading's limits are its Zones, and a hold time is its Persistence.",
      "both": false,
      "links": [
        {
          "label": "Differences at Manesar: 'Changed here' and 'Library changed since'",
          "href": "#/p/manesar/differences",
          "label72": "Deviations at Manesar: Override and Base moved",
          "href72": "#/p/manesar/deviations"
        },
        {
          "label": "A library type page: limits, must hold for, source chips",
          "href": "#/library/OS_TANK_DF",
          "label72": "A template page: limit rules, Persistence, source chips",
          "href72": "#/library/templates/tpl_up_activated-sludge_do-low"
        },
        {
          "label": "What SCADA found at DigitalPaani",
          "href": "#/p/digitalpaani/scada",
          "label72": "The review queue at DigitalPaani",
          "href72": "#/p/digitalpaani/review/structure"
        }
      ],
      "where": {
        "1": [
          "p/manesar/differences",
          "library/OS_TANK_DF",
          "library/OS_TANK_DF/readings",
          "p/digitalpaani/scada"
        ],
        "2": [
          "p/manesar/deviations",
          "library/templates/tpl_up_activated-sludge_do-low",
          "p/digitalpaani/review/structure"
        ]
      }
    },
    {
      "id": "D15",
      "title": "Should an open issue lock its alert, or finish on the terms it opened under while changes apply at once?",
      "short": "Freeze while an issue is open",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "The requirements say a Trigger with an open Issue is frozen, but Alex's pack applies this three ways. Alex's alert page for a Live plant locks the hold time ('Override · frozen'). Alex's sensor page and that alert page save a limit change now and say it 'reaches it after that'. Alex's domain model, following Alex's limits memo and the requirements, leaves frozen Triggers showing 'base moved' until someone resyncs them by hand, and Alex's versioning rule just says they are 'skipped'. Alex's scenario for tuning one limit at one plant starts from the DO-low Issue, which the Live alert page says is usually still open, yet its done-when expects the new value on 'every Trigger following DO-AT2'.",
      "v6Today": "While an issue is open, v6 locks the alert's own terms and offers 'switch off, then add a corrected copy', which is the requirements' own way out. v5 brought this back and v6 kept it. v6's limits sheet promises that new limits 'reach it after it closes', but the engine reads limits live, so the open issue steps up against the new limits at once. v6 contradicts itself.",
      "mihirsDirection": "On 16 Oct (v3), Mihir took the freeze out of the console, calling it 'not the configuration's concern; it belongs to the plant's live status', and removed the frozen state. That call never said which terms an open issue then runs on. Because of that gap, v5 slid back to the lock. The direction was right but incomplete.",
      "options": [
        {
          "label": "Keep the freeze as written: an alert's terms lock while an issue is open, and library and limit changes skip it until someone resyncs it by hand",
          "consequence": "Only one value exists at a time. But Alex's tune-one-limit scenario fails in its usual case, the alert stays out of step with the library until someone remembers to resync it, and urgent fixes need 'switch off, add a corrected copy'. Alex's screens and that scenario would also need rewording to agree with each other.",
          "recommended": false
        },
        {
          "label": "Save now, and the change reaches the alert when its open issue closes",
          "consequence": "No lock and no resync by hand. An alert has only one open issue at a time, so this behaves like the next option. The difference is that the alert, sensor and library screens each have to show a waiting value ('waits for issue #n to close').",
          "recommended": false
        },
        {
          "label": "No freeze: the open issue finishes on the terms it opened under, and every change applies at once to the alert and its next issue",
          "consequence": "Settings are never locked and Alex's tune-one-limit scenario takes one step. Old and new values exist side by side only while that issue is open, and only the issue page shows the old ones. Every issue already stores the terms it opened under, so those stored terms simply start driving how it closes and steps up. This overrules the requirements' stated choice, so Alex has to agree.",
          "recommended": true
        }
      ],
      "recommendation": "Choose the third option: no freeze, and the open issue keeps the terms it opened under. It is the easiest for the admin, with no lock, no corrected copy and no resync to remember. It still gives the protection the requirements want: no limit or clock moves under an operator in the middle of an issue. The requirements reject this to avoid having two values, but the freeze does not avoid them either. It parks the old value on the alert until someone resyncs it by hand, while this option shows the old value only on the issue and ends it when the issue closes. Mihir's 16 Oct call needs this rule to hold, and Mihir should present it as disagreeing with the requirements' reasoning, not only with Alex's screens.",
      "v7Does": "Each issue stores the terms it opened under (band, limit, must hold for, must clear for) and closes or steps up by them. Any change to a limit, hold time or library value applies to the alert at once and to its next issue. There is no lock and no corrected-copy path, and the limits sheet has no 'close it as a false alarm' shortcut: closing as a false alarm stays on the issue page and asks why. The issue page shows 'Opened under: Major below 1.0 mg/L, must hold for 0 min, must clear for 15 min', plus 'Opened under the old limit 1.0 mg/L (now 1.5 mg/L)' when the alert has changed since. 'Where it lands' lists open issues as keeping their terms.",
      "tellAlex": "On the freeze, as the requirements, your versioning rule and your limits memo set it out: v7 drops it, as I decided on 16 Oct, and adds the rule that call was missing. An open Issue closes and steps up by the terms it opened under, using the rule snapshot every record already carries. Every limit, hold-time or library change applies at once to the Trigger and its next Issue. That is the same 'applies from the next one' rule the requirements already use for PM cadence. I know this overrules the requirements' 'not snapshotted, frozen' reasoning. The freeze also leaves two values, though: the requirements mark Triggers 'diverged' until someone resyncs them by hand. With this rule, your tune-one-limit scenario's done-when holds in its usual case, and the sensor page's 'Close it as a false alarm' and the library page's '3 frozen · wait for open Tasks' go away. Can you agree, or name the case that needs the lock?",
      "v71Option": 2,
      "v71Short": "No freeze: an open issue finishes on the terms it opened under; every change applies at once to the alert and its next issue.",
      "v72Option": 0,
      "v72Short": "Freeze: while an Issue is open every change skips its Trigger, forced ones too; afterwards a person resyncs it.",
      "v72Does": "v7/2 keeps the freeze. While a Trigger has an open Issue its terms are held: the Trigger page says so first, and its own settings can't be changed (\"Override · frozen\"). A change to the sensor's zones, a design parameter or a library publish still saves but skips the frozen Trigger, a forced Emergency change included, so the tank with the open Issue is the one that misses a stricter limit until the Issue closes (card D23). After the Issue closes, a Trigger whose terms moved stays on its held terms and shows \"Base moved\" until someone resyncs it by hand; only a forced change reaches it meanwhile. Manesar's DO low · AT-2 is frozen at the start of the story. The zones preview names the frozen Trigger and offers \"Close it as a false alarm\", as Alex drew it.",
      "both": false,
      "links": [
        {
          "label": "Manesar issues: the open 'DO low — AT-2' and the terms it opened under",
          "href": "#/p/manesar/issues",
          "label72": "DO low · AT-2: frozen while its Issue is open",
          "href72": "#/p/manesar/trigger/a_do_at2"
        },
        {
          "label": "Change limits on Aeration Tank 2 while its issue is open",
          "href": "#/p/manesar/eq/at2/readings",
          "label72": "DO-AT2's zones while the Issue is open",
          "href72": "#/p/manesar/sensor/at2_do"
        },
        {
          "label": "The 'DO low — AT-2' alert page",
          "href": "#/p/manesar/alert/a_do_at2",
          "label72": "Manesar's deviations: Base moved, waiting for a resync",
          "href72": "#/p/manesar/deviations"
        }
      ],
      "where": {
        "1": [
          "p/manesar/issues",
          "p/:plant/issue/:id",
          "p/manesar/eq/at2",
          "p/manesar/eq/at2/readings",
          "p/manesar/alert/a_do_at2"
        ],
        "2": [
          "p/manesar/trigger/a_do_at2",
          "p/manesar/sensor/at2_do",
          "p/manesar/deviations",
          "p/:plant/issue/:id"
        ]
      }
    },
    {
      "id": "D16",
      "title": "Where should an issue sit, and how does it name the equipment that caused it?",
      "short": "Where an issue sits",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Alex marks this as already settled by the requirements: a Trigger can be about a machine, a unit process or the whole plant. Alex lists it among the requirements' rules that v5 currently breaks. Alex's ruling on treatment issues files them on the unit process and keeps machine attribution through diagnosis unchanged. Alex's wireframes put DO low on AT-2 (the basin) and outlet turbidity on SC-1 (the clarifier).",
      "v6Today": "Every alert, and every issue an operator reports, sits on one piece of equipment. Only rounds, plant schedules and faults on plant-level sensors sit on the plant. Closing an issue writes its root cause (e.g. 'All blowers OFF') into the tank's history but never onto the blowers' cards. At DigitalPaani, effluent BOD/COD, ammonia, TSS and odour have to be reported on one of five MBBRs, and the Tube settler lists neither TSS nor odour.",
      "mihirsDirection": "Alerts read sensors on the equipment only, never a pipe or connection reading, and no alert sits on the plant. Connection readings wait for the next phase. That is right for alerts. Stretched to 'every issue sits on one piece of equipment', it is the weaker rule: a lab test of the combined treated water gets pinned on whichever MBBR the operator happens to open.",
      "options": [
        {
          "label": "Keep v6: every issue on one piece of equipment, no 'caused by'",
          "consequence": "Nothing to build. The blowers' cards never show the DO problems they caused. Treated-water results land on whichever MBBR the operator opens. Nobody can report the Tube settler's own outlet problems against it. Alex reads this as breaking a rule they consider settled.",
          "recommended": false
        },
        {
          "label": "Each issue sits where it was seen, plus an operator-confirmed 'caused by'",
          "consequence": "Alerts stay on the equipment whose sensor fired. Issues seen at a settler's outlet (TSS, odour, yellow water) sit on that train's Tube settler. BOD/COD and ammonia lab results on the combined treated water sit on the plant. The diagnosis offers the equipment that caused the issue, pre-selected from the plant's links (MBBR Air Blowers 1-3, not the EQT blowers). The operator confirms one or more, and the issue then also shows on their cards. The five settler causes the workbook leaves without a type (two for TSS, three for odour) need retyping to Tube settler.",
          "recommended": true
        },
        {
          "label": "Operator-confirmed 'caused by', and all five treated-water issues on the plant",
          "consequence": "One simple rule for treated water. At DigitalPaani it loses which train the problem came from, so the diagnosis has to ask which settler. The Tube settler page still doesn't show its own outlet problems.",
          "recommended": false
        },
        {
          "label": "Adopt Alex's model in full: treatment-step and plant alerts",
          "consequence": "Needs equipment grouped into treatment steps and alerts on outlet readings, which sit on pipes. Both are next phase, so v7 can't build this now. For in-tank DO nothing changes on screen, because Alex's AT-2 basin is v6's tank.",
          "recommended": false
        }
      ],
      "recommendation": "Option 2. Each issue sits where the problem was seen and gains 'caused by' where the cause was found. Alex already keeps that attribution, so most of this is agreement, not a counter-proposal. Equipment-only stays right for alerts, but forcing a combined treated-water lab result onto one of five MBBRs writes a guess into that tank's history; the plant and each train's settler are the right homes. The operator has to confirm 'caused by', and it can name several pieces of equipment because root causes name equipment types, not tags; v7 has no per-equipment reliability numbers yet, so a blower-caused DO issue staying on the tank costs only a history line.",
      "v7Does": "Alerts sit on the equipment whose sensor fired, and none sits on the plant. When a diagnosis lands on a root cause typed to another equipment type, the issue gains 'Caused by <tag>' and shows in that equipment's Issues tab. The five treated-water issues stay where v6 put them (four on MBBR, yellow water on Tube settler), marked 'Where it belongs: to confirm'. Contract should change: v7 suggests 'caused by' and the operator sets it. It matches only the cause's types other than the issue's own ('All blowers OFF' is typed MBBR, Blower, Mini Blower) and pre-selects from the plant's links. The operator confirms one or more, and the issue record stores a list (causedBy: [eqIds]) instead of one tag.",
      "tellAlex": "On where an alert can sit and where treatment issues are filed: agreed on the split between where an issue was observed and what caused it. v7 adds machine attribution through diagnosis, as the requirements describe it: the operator confirms it, the plant's links only pre-select ('suggests; it never attributes'), and it can name several machines. Plant subject accepted for treated-water results from lab tests and reports. Issues seen at a settler outlet sit on that train's settler, as your review queue does with SC-1. Deferred to the next phase: unit-process subjects, and plant or outlet alerts that read a connection. For in-tank DO this changes nothing on screen, because your AT-2 basin is our tank equipment. Known gap: until unit processes exist, a DO-low issue stays on the tank's record. When MTBF arrives, only attributed records should count, as the requirements say.",
      "v71Option": 1,
      "v71Short": "Alerts sit on the equipment whose sensor fired; a diagnosis adds 'Caused by'; treated-water issues stay where v6 put them, 'to confirm'.",
      "v72Option": 3,
      "v72Short": "Triggers on equipment, unit processes or the plant; treatment Issues on the unit process.",
      "v72Does": "v7/2 builds Alex's model in full. A Trigger can be about a piece of equipment, a unit process or the plant. Treatment Issues such as DO low are filed on the unit process (AT-2 at Manesar), and an Issue on a piece of equipment also shows on every unit process it takes part in, marked \"Shared\". The diagnosis still names the equipment at fault: Manesar's DO low · AT-2 lands on BL-1's intake filter, the Issue then reads \"Caused by BL-1\", and BL-1's own Issues tab lists it. No plant in the study has a reading that belongs to the plant as a whole, so no plant Trigger is seeded. Readings on pipes between equipment stay next phase, as in v7/1.",
      "both": false,
      "links": [
        {
          "label": "Manesar issues: DO low on AT-2, diagnosis and 'caused by'",
          "href": "#/p/manesar/issues",
          "label72": "AT-2, a unit process: its Issues",
          "href72": "#/p/manesar/up/at2/issues"
        },
        {
          "label": "DigitalPaani equipment: five MBBRs, two Tube settlers",
          "href": "#/p/digitalpaani/equipment",
          "label72": "DigitalPaani's structure: unit processes and participants",
          "href72": "#/p/digitalpaani/structure"
        },
        {
          "label": "Tube settler in the library",
          "href": "#/library/T_SETTLER",
          "label72": "Unit-process types in the library",
          "href72": "#/library/up-types"
        }
      ],
      "where": {
        "1": [
          "p/manesar/issues",
          "p/:plant/issue/:id",
          "p/:plant/eq/:id/issues",
          "p/digitalpaani/equipment",
          "library/T_SETTLER/:tab?"
        ],
        "2": [
          "p/:plant/up/:id/issues",
          "p/:plant/eq/:id/issues",
          "p/:plant/issue/:id",
          "p/digitalpaani/structure",
          "library/up-types"
        ]
      }
    },
    {
      "id": "D17",
      "title": "What carries a library version, and can a plant stay on an older one?",
      "short": "Library versions and pins",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Two things carry versions. Types do: an equipment type ('Blower v4') or a unit-process type ('Activated sludge v4'). Templates do too, and each holds 'a limit rule per band'; every Trigger records its template and version. Each publish is one of four kinds, and the screen suggests which ('Version: Minor (suggested)'): a patch is silent, a minor change updates followers and marks overrides 'base moved', a major change arrives as drafts, and an Emergency or statutory change is forced with overrides suspended. Plants can be pinned ('2 pinned · hold at v4'). Pins come from the requirements, and Alex's ruling on plant differences kept them. But Alex's follow-up pack drops the pin permission row that the first pack had, and Alex's screen of every plant's differences shows no pins.",
      "v6Today": "Every plant points at one shared library. Saving an equipment type sends its limits (all four bands, Emergency included) and its cadences to every following plant at once and reports the counts afterwards. Values a plant set itself are left alone, with no sign that the library moved. Only diagnostic and fix flows have version numbers.",
      "mihirsDirection": "The library is the database's equipment types and nothing grouped above them. A type carries its readings, limits, alerts and tasks together. v5 and v6 dropped v3's pull model, where each plant sat on a dated library version and chose 'Update to vX' or 'Not now'. Instead, one library goes out to every plant on save, and types have no version.",
      "options": [
        {
          "label": "As Alex drew it: versions on types and on templates, limit rules on templates, four kinds confirmed by the publisher, pins",
          "consequence": "The most faithful option. The screen shows two version numbers, and 'v4' doesn't say which one it means. The spec doesn't say which rule wins when two templates on one sensor disagree. Pins need a copy of the library for each pinned plant, plus a version history. It costs the most, and three of the four kinds rarely come up across four plants.",
          "recommended": false
        },
        {
          "label": "One version per equipment type, the kind worked out from the change, no pins",
          "consequence": "One number per type; flows keep their own numbers, as in v6. Each reading has one limit per direction, and every alert on it follows that limit, so rules can't conflict. Wording changes are silent. Changed numbers or cadences update the plants that follow. Plants with their own value keep it and show 'Library changed since'. New bands or items arrive as drafts at each plant. Making an Emergency limit stricter is a safety change: it needs a reason and applies over plants' own values. A plant that must keep a value overrides it with 'For now, until …'. Medium cost: the type editor has to enforce one limit per reading and direction, which v6's doesn't. This departs from the pin that Alex kept from the product spec.",
          "recommended": true
        },
        {
          "label": "Version the whole library as one dated document that plants pull (v3)",
          "consequence": "One number covers everything, but a small change to one type moves every plant's library version. Every plant also stays behind until someone clicks Update, so in practice every plant is pinned by default.",
          "recommended": false
        },
        {
          "label": "Keep v6: send to every plant on save, no version on types",
          "consequence": "The cheapest option. There's no preview of where a change lands before it goes out, and no version number for Differences to cite. Plants that kept their own value are never told the library moved.",
          "recommended": false
        }
      ],
      "recommendation": "Choose option 2. A single version per type removes the 'which v4?' question, and it closes the unanswered case where two templates on one sensor disagree. Working the kind out from the change keeps the suggestion Alex's publish screen already makes, without a picker. Drop pins because nobody answers for them, not because nobody can see them. Alex does show pins, but a pin holds a whole type back on one reason with no review date. A 'For now, until …' override does the same job for one value, with a date. On the rest, the v6 direction is the weaker option: take Alex's preview before publishing, the 'Library changed since' mark, and drafts for new bands.",
      "v7Does": "Only equipment types have version numbers; the type page shows 'Library · version N'. Limits sit on the type's readings, matched by reading and direction, and alerts and tasks travel with the type. Editing a type makes a draft. Where it lands shows true counts over the four plants:\n- values that change\n- plants that keep their own value (they then show 'Library changed since')\n- open issues, which keep the terms they opened under\n- tasks that become due now\n\nThe kind is worked out, never picked. Any Emergency-band change is a safety change: it needs a reason and ends plants' own values with a note. Publishing writes a dated note to each affected plant's Activity and Coverage. There are no pins.\n\nContract should change:\n- A safety change should end a plant's own Emergency value only when the library's new value is stricter. Loosening it is an ordinary change.\n- A band an alert didn't have before should arrive as a draft at each plant, the same way alerts added later do.\n- Flows should keep v6's own version numbers.",
      "tellAlex": "On how library versions reach plants, and the related rules on limits and editing: v7 versions the equipment type only. That means one number, no Template axis and no unit-process 'Activated sludge v4'. Limits sit once per reading and direction on the type, and every Trigger follows them. That closes the gap where two Templates on DO-AT2 disagree and binding just reuses the zone, as your domain model has it. The kind is worked out rather than picked, which your library page already half does:\n- wording changes are silent\n- number changes update followers and mark 'base moved'\n- new bands or items arrive as drafts\n- a stricter Emergency limit is forced\n\nWe're dropping pins for now. We know they come from the requirements, and your ruling on plant differences kept them. Our reason: a pin holds a whole type back on one reason with no review date. Your follow-up pack has also already lost the pin permission row, and your differences screen never shows a pin. What does a pin do that a 'For now, until …' override doesn't? And do you have a statutory change that isn't an Emergency band?",
      "v71Option": 1,
      "v71Short": "One version per equipment type; the kind of change is worked out, never picked; Where it lands shows the counts first; no pins.",
      "v72Option": 0,
      "v72Short": "Versions on types and templates; four publish kinds, suggested and confirmed by the publisher; pins.",
      "v72Does": "v7/2 versions two things: types (equipment types and unit-process types) and templates, and each template holds a limit rule per band. Every Trigger records the template and version it came from. A publish is one of four kinds, which the screen suggests and the publisher confirms, raising it if needed but never lowering it: a patch is silent; a minor change updates the plants that follow and marks overrides \"Base moved\" (an override that now equals the new value is cleared); a major change arrives at each plant as drafts in its review queue; a forced change, for an Emergency or statutory limit, needs a reason, applies everywhere, suspends overrides on that band and tells the plant admins. A plant can pin a template version, with a reason, and a pinned plant holds through everything except a forced change. A Trigger with an open Issue is skipped by all four. Screens show two version numbers, the type's and the template's.",
      "both": false,
      "links": [
        {
          "label": "Diffuser Tank in the library: version, Where it lands, Publish",
          "href": "#/library/OS_TANK_DF",
          "label72": "A template: version, Downstream, Publish",
          "href72": "#/library/templates/tpl_up_activated-sludge_mlss-low"
        },
        {
          "label": "Manesar's differences from the library",
          "href": "#/p/manesar/differences",
          "label72": "Manesar's deviations: Base moved and pins",
          "href72": "#/p/manesar/deviations"
        },
        {
          "label": "Differences across all plants",
          "href": "#/differences",
          "label72": "Deviations across All Plants",
          "href72": "#/deviations"
        }
      ],
      "where": {
        "1": [
          "library/OS_TANK_DF/:tab?",
          "p/manesar/differences",
          "differences"
        ],
        "2": [
          "library/templates/:id",
          "p/manesar/deviations",
          "deviations"
        ]
      }
    },
    {
      "id": "D18",
      "title": "Which limits should scale with equipment size, and should each value's source be worked out or stored?",
      "short": "Size-scaled limits and value sources",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Alex's ruling on limits has the library hold a rule per band: \"a constant, or an expression over design parameters such as 0.9 × tank_height\". Alex's limits memo flags a constant on a size-dependent reading, and has derived limits re-resolve when a parameter changes. A missing parameter becomes a Readiness gap (\"AT-2 has no tank height\"), design parameters are edited on Details, and 'form' and 'SCADA' are defect words in copy. Alex's pattern for library values puts a source chip on every value, with up to 12 states (Library, Derived, Proposed, Override, Learned, Base moved, Frozen and others).",
      "v6Today": "Level reads as a 0–100 % fill on every plant, so a tank-height rule would add nothing. The only limits v6 works out from the SCADA form are motor current from the motor rating, on Pump, Submersible Pump, Blower and Screw Press. Those four types also hold fixed amps, and three code paths disagree on which value wins. DigitalPaani sends no motor current, so the rule only fires on the sample plants. v6 stores one source tag per sensor: 11 of Manesar's 12 sensors with limits have no tag, suggestions ignore direction, and a Blower publish overwrote BL-1's 44/48 A (its form gives 40/42/46 A) and tagged it as library.",
      "mihirsDirection": "SCADA is the only source of equipment and form answers, and limits live on the sensor. That matches the shape of Alex's rule and rules out editing design parameters in the console, but it says nothing about which rules or which chips. The cost: the SCADA form asks no motor rating for five types (Agitator, Booster Pump, DAF, Flash Mixer, Flocculation), so they can only keep guessed amps until SCADA adds the question.",
      "options": [
        {
          "label": "Alex's full rule language: expressions over design parameters, a parameter editor in the console, the constant flag, re-working on change, all 12 source states",
          "consequence": "The most expressive option and the costliest part of the library work, but today it would drive one reading. On a level sensor that reads in %, a tank-height rule changes nothing: it resolves to the same %, with the metres shown; but the tank-height gap does appear wherever the survey holds no tank height. Most states would sit empty. Editing parameters in the console creates a second source next to SCADA.",
          "recommended": false
        },
        {
          "label": "One rule (motor current from SCADA's motor rating), a constant per type for everything else, and each value's source worked out from a stored change record",
          "consequence": "One function, matching on reading and direction, feeds the chip, the suggestion and the library publish. That fixes the three-way split over which value wins and the suggestions that ignore direction. Plant changes store value, reason and base, so 'Changed here' and 'Library changed since' both work. A new rating in SCADA flows through on the next read. If a future sensor reports level in metres, a second rule kind will be needed.",
          "recommended": true
        },
        {
          "label": "Keep v6's stored source tag and re-tag the seed data",
          "consequence": "Less work now, but the tag drifts away from the value again. That is how a library publish overwrote BL-1.",
          "recommended": false
        },
        {
          "label": "Constants only, one per type",
          "consequence": "The simplest option, but same-type motors of different sizes get the same amps. DigitalPaani's 3.7 kW and 5.5 kW pumps would all get Pump's 40/45 A, where the form gives 6.7/7/7.7 A and 10/10.5/11.5 A.",
          "recommended": false
        }
      ],
      "recommendation": "Option 2. It keeps Alex's shape but uses only the rule SCADA can feed today. Working out each value's source from one function plus a stored change record removes the cause of the BL-1 overwrite; v6's stored tag is the weaker design. Go a step past the contract: drop the fixed amps from the four rated types, so a missing rating shows up on Readiness as 'No limits yet · Add the motor rating in SCADA'. Without that, a 3.7 kW pump that draws about 7 A gets a 40 A limit it never reaches. For the five unrated types, keep the guessed amps marked 'to confirm' and ask the SCADA team to add the rating question. Keep BL-1's 44/48 A as the 'Changed here · Not recorded' example; it is seed data, so this is a choice about the demo.",
      "v7Does": "Each band's source is worked out on every read and never stored. A plant change shows 'Changed here', or 'Library changed since' when its stored base differs from today's library value. Otherwise motor current from the SCADA form's motor rating shows 'From the SCADA form: 22 kW motor'. Otherwise the chip is 'From the library' or 'No limits yet', and readings between equipment show 'Next phase'. The order is plant change, then SCADA form, then library, matched by reading and direction. The change record keeps value, reason, base and review date. Form answers are read-only ('Fix it in SCADA, then read again'). There is no expression editor and no constant flag. Manesar's BL-1 shows 'Changed here' (reason not recorded) against the SCADA form's 40/42/46 A, and Differences names that base 'SCADA form', not 'Library'. Contract should change: (1) drop the fixed amps from Pump, Submersible Pump, Blower and Screw Press (the Blower library still holds 44/48), so a missing rating gives 'No limits yet'; (2) have the same function cover Blower's 'Clean intake filter' thresholds, which also come from the motor rating.",
      "tellAlex": "On limits in the library: accepted in shape (limits on the sensor, a library rule per band). For this phase I'm narrowing the rule kinds to the one SCADA feeds: motor current from the motor rating. Everything else is a constant per type. Level arrives as a 0–100 % fill, so the tank-height rule and its Readiness gap don't come up yet; the 'rules over design parameters' goal stays open. On your memo's constant flag: none for now. Design parameters are SCADA form answers: read-only in the console and fixed in SCADA, not edited on Details. Your memo's rule that derived limits follow a changed parameter stays in a narrow form: values are worked out on read, so a new rating flows through. Plant changes keep their value, and open issues keep the terms they opened under; there's no freeze. On source chips: v7 shows six (From the library, From the SCADA form, Changed here, Library changed since, No limits yet, Next phase), worked out from your override record (value, reason, base, review date) and never stored. Proposed, Learned, Pinned, Suspended, Locked and Frozen wait until something can set them. 'SCADA' and 'form' stay on screen, against your pack's glossary, because SCADA is where the fix is made.",
      "v71Option": 1,
      "v71Short": "Motor current from SCADA's motor rating, a constant per type for the rest; each value's source worked out on every read.",
      "v72Option": 0,
      "v72Short": "Limit rules over design parameters, a parameter editor, the constant flag, every source state.",
      "v72Does": "v7/2 builds Alex's rule language. A template's limit rule for each band is a constant or an expression over design parameters, such as 85% of tank height or 105% of a motor's full-load current. A person adds a missing design parameter, or replaces a survey value with a note, on the unit-process, equipment or plant page under Details. Changing a parameter re-resolves every derived limit that uses it, and the preview names what follows, what is frozen and what keeps its own value. A constant on a size-dependent reading (level, flow, pressure, current) is flagged when it is written: \"This scales with the plant. Use a design parameter?\". Each value resolves first match wins: Forced, Override, Derived, Library (or a pinned version), what the algorithm proposes, else Gap, and its chip says which. On a level sensor that reads in %, a tank-height rule resolves to the same % with the metres shown, \"85% (3.4 m)\", so it changes no limit there; where the survey has no tank height the limit can't resolve, and Readiness lists that gap with the parameter it needs, as for three tanks at DigitalPaani. Learned is reserved and never shown.",
      "both": false,
      "links": [
        {
          "label": "BL-1 at Manesar: plant value against the SCADA form",
          "href": "#/p/manesar/eq/bl1/readings",
          "label72": "BL-1's motor current: Derived limits and Manesar's own value",
          "href72": "#/p/manesar/sensor/bl1_amps"
        },
        {
          "label": "Blower in the library",
          "href": "#/library/BLW",
          "label72": "Blower in the library: limit rules over design parameters",
          "href72": "#/library/eq-types/BLW"
        },
        {
          "label": "Manesar's differences from the library",
          "href": "#/p/manesar/differences",
          "label72": "Manesar's deviations",
          "href72": "#/p/manesar/deviations"
        }
      ],
      "where": {
        "1": [
          "p/manesar/eq/bl1",
          "p/manesar/eq/bl1/readings",
          "library/BLW",
          "p/manesar/differences",
          "library/BLW/readings"
        ],
        "2": [
          "p/manesar/sensor/bl1_amps",
          "library/eq-types/BLW",
          "p/manesar/deviations",
          "p/digitalpaani/review/bindings",
          "p/:plant/eq/:id/details",
          "p/:plant/up/:id/details"
        ]
      }
    },
    {
      "id": "D19",
      "title": "How should a task's first due date be set at go-live, and what becomes due when the library changes a cadence?",
      "short": "First due dates at go-live",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Alex's go-live rule: no scheduled Tasks run before Live, and at go-live \"each PM's first due date is taken from the last service date entered during commissioning, or from the go-live date when there isn't one\". Readiness has an optional 'Last service dates' step, counted per equipment (\"Entered for 9 of 14 pieces of equipment\"), so it is unclear whether Alex means one date per equipment or one per task. A library cadence change shows \"57 Tasks become due now across 23 plants\", and one choice covers the whole publish: \"Count from the last service\" or \"Count from the publish date\".",
      "v6Today": "v6 has no 'last done' or last-service date. Its only per-task date is an editable 'Next due', and SCADA's forms ask for Installation Date and Manufacturing Date but never a service date. When a plant inherits from the library, every equipment calendar task and calibration is first due 2 Nov 2026 (317 of 325 at DigitalPaani), and plant rounds are first due 6 Oct. A library cadence change edits the interval but never the due date: Manesar BL-1's bearing service, cut from 6 to 3 months, stays due 14 Nov even though it was last done 18 May.",
      "mihirsDirection": "Mihir never chose a rule. v6's fixed 2 Nov date is a placeholder. v6 left one related question open: blowers with no run-hours reading (all of DigitalPaani's) count oiling and greasing in clock hours, marked \"Keep, or leave the job out\". Mihir's standing brief (simple, frictionless, show consequences) argues against hours of date entry at commissioning, and against a 'due now' count with no real dates behind it.",
      "options": [
        {
          "label": "Alex's rule as written: the last service date entered at commissioning, else go-live day, plus one count-from choice per publish",
          "consequence": "Easy to describe. At DigitalPaani, blank dates put about 160 maintenance tasks on go-live day. Filling them in means about 160 typed dates. One date per equipment can't set a Blower's nine separate maintenance schedules. Where no date was entered, the publish-time choice has nothing to count from.",
          "recommended": false
        },
        {
          "label": "Spread first due dates; after a cadence change, recount from real completions and never move a due date later",
          "consequence": "No typing at go-live and no pile-up on day one. An optional 'last done' date on each task sets its date when someone knows it. After a cadence change, each task counts from its last real completion, or from the publish date if it has none. Anything already overdue is due within 7 days, and a shorter cadence never makes a due date later. No choice at publish. The cost: equipment that was neglected before go-live may wait up to one interval for its first visit unless someone enters a 'last done' date.",
          "recommended": true
        },
        {
          "label": "Same, but overdue work gets one full interval of grace (contract rule 9 as written)",
          "consequence": "Go-live works the same way, but the grace can make a shorter cadence come due later than the old one. Manesar MBR-1's Quarterly CIP, last done Thu 20 Aug and cut from 3 to 2 months, would move from Wed 18 Nov to about Mon 28 Dec instead of falling due now.",
          "recommended": false
        },
        {
          "label": "No recount: a new cadence starts from each task's existing due date (v6 today)",
          "consequence": "Simplest. Equipment that is already overdue under a shorter cadence stays unflagged until its old date, which is exactly what a 'due now' count is there to catch. First due dates stay on one fixed day.",
          "recommended": false
        }
      ],
      "recommendation": "Choose option 2. It needs no typing at go-live, yet it still uses a real date wherever someone knows one. It works per task rather than per equipment, which is the only way to set a Blower's nine maintenance schedules. Counting cadence changes only from real completions keeps the 'Tasks become due now' figure honest. \"Due within 7 days, never later than before\" also replaces the one-interval grace the contract describes, which can push a shortened task later than it already was. v7 already works this way, except that it makes overdue work due at once when the change is published rather than within 7 days. Alex's rule, v6's fixed date and v6's leave-it-alone rule are all weaker than this.",
      "v7Does": "At go-live, each task's first due date is spread across its own interval, and each task can carry an optional 'last done' date on its task page. Run-hours work falls due when its hour meter reaches the reading at its last service, or at go-live, plus its run-hours; the meter counts only while the equipment runs (in the sample readings about 20 h a day on duty, 1 on standby), and this work is left out of the go-live spread. On a library cadence change, 'Where it lands' and the publish use one rule, so the dates it shows are the dates that result. A task counts from its last real completion; if the new cadence makes it overdue, it falls due at once when the change is published, with no grace (Manesar MBR-1's Quarterly CIP, last done Thu 20 Aug, cut from 3 to 2 months, is listed under 'Falls due now' and is due Thu 29 Oct, 09:00 after publishing). A task never done since go-live counts from the publish date and never moves later than it was (BL-2's bearing service, 6 to 3 months: due Wed 27 Jan instead of Sun 28 Feb). Run-hours work also follows its hour meter, so BL-1's bearing service stays due Tue 10 Nov by its meter. Contract should change in two ways. First, rule 9's one-interval grace for overdue work is not what v7 does: overdue work falls due when the change is published (option 2 would give it 7 days). Second, say that a 'last done' date sets the next due date.",
      "tellAlex": "On your go-live rule for first due dates, and the Readiness, library and go-live screens that show it: v7 doesn't ask for service dates at go-live. Each task's first due date is spread across its own interval, and each task can take an optional 'last done' date. Is that rule's date per task or per equipment (\"Entered for 9 of 14 pieces of equipment\")? One date per equipment can't set a Blower's nine maintenance schedules. \"Tasks become due now\" can only count real completions, entered at commissioning or recorded at Live plants. So v7 recounts each task from its last completion, or from the publish date if there is none, and never later than before. Overdue work falls due when the change is published (we recommend within a week), and v7 drops the per-publish \"Count from the last service / Count from the publish date\" choice.",
      "v71Option": 1,
      "v71Short": "First due dates spread over each task's interval; after a cadence change, count from real completions, never later than before.",
      "v72Option": 0,
      "v72Short": "First PM due from the last service date entered, else go-live day; a count-from choice per publish.",
      "v72Does": "v7/2 follows Alex's rule. No scheduled Task runs before go-live. Readiness has an optional step, \"Last service dates\", one date per piece of equipment (\"Entered for 4 of 11 pieces of equipment\" at Vedanta). At go-live a PM Task counts from the last service date entered for its equipment; every other scheduled Task, and every PM without a date, falls due on go-live day, so 51 scheduled Tasks would fall due on Vedanta's go-live day. Alex's \"otherwise the go-live date\" is read as due that day; read as counted from go-live, go-live day would be quiet instead, and Mihir is asked to confirm. When the library changes a cadence, Downstream shows how many Tasks become due now, and the publisher chooses where counting starts: \"Count from the last service\" or \"Count from the publish date\", which can move a Task later than before.",
      "both": false,
      "links": [
        {
          "label": "Vedanta Readiness and the go-live confirmation",
          "href": "#/p/vedanta",
          "label72": "Vedanta Readiness: last service dates and Go live",
          "href72": "#/p/vedanta"
        },
        {
          "label": "Blower type: edit a cadence, see Where it lands",
          "href": "#/library/BLW/tasks",
          "label72": "Blower type: a cadence change and the count-from choice",
          "href72": "#/library/eq-types/BLW/tasks"
        },
        {
          "label": "Manesar tasks: next due and last done",
          "href": "#/p/manesar/tasks",
          "label72": "BL-2 at Manesar: its Tasks and due dates",
          "href72": "#/p/manesar/eq/bl2/tasks"
        }
      ],
      "where": {
        "1": [
          "p/vedanta",
          "library/BLW/tasks",
          "p/:plant/tasks",
          "p/:plant/eq/:id/tasks",
          "p/:plant/task/:id"
        ],
        "2": [
          "p/vedanta",
          "p/:plant/people/service-dates",
          "library/eq-types/BLW/tasks",
          "p/manesar/eq/bl2/tasks",
          "p/:plant/task/:id"
        ]
      }
    },
    {
      "id": "D20",
      "title": "Should sludge pumps get their own work now? If so, should it come from SCADA's pipes or from Alex's drawing editor?",
      "short": "Sludge-pump work and membership",
      "severity": "Shapes v7",
      "arose": "First review",
      "alexSays": "Membership is many-to-many and found from the plant graph: a recirculation pump takes part in every reactor of its loop. 'Control groups' map to a grouping that already exists in the code, may overlap and have no subtypes. Membership is edited on the drawing, in Alex's wireframe and scenario for it: freely during Commissioning, and after Live only by a Technical Admin with a reason. Shared equipment takes its highest tier, though that question is still open. Alex lists the drawing editor among their own feasibility worries.",
      "v6Today": "v6 has no pump roles. The sludge-pump check, maintenance and duty/standby changeover sit on the Tube settler ('moves to the pump when pumps are split by role'). The 15-cause 'Tube settler: Breakdown of sludge recirculation / sludge wasting pump' issue sits on every Pump and Submersible Pump. So at DigitalPaani (22 Pumps), 16 pumps that never touch sludge list it and say 'Can diagnose 1 issue', while the four Sludge Re-Circulation Pumps carry only the generic megger test themselves. v6 draws SCADA's pipes on its schematic and in the 'Connected to' row, but no placement, alert or task logic uses them.",
      "mihirsDirection": "No grouping of equipment into treatment steps or duty/standby sets, no splitting of database types, and the type is a lookup of what is stored. v5 left out any 'what is this pump for' question because that is a treatment step by another name. Readings on pipes wait for the next phase. Using the pipe layout to place work was never ruled on.",
      "options": [
        {
          "label": "Keep v6's placement for v7, marked 'to confirm'",
          "consequence": "No new logic. Sludge-pump work stays on the Tube settler and the sludge breakdown issue stays on every pump. 16 DigitalPaani pumps keep showing it, and so do Vedanta's sump pumps and Bawal's raw-water pumps. The cost stays visible, and nothing gets built that the next phase might throw away.",
          "recommended": true
        },
        {
          "label": "Let SCADA's pipes place sludge-pump work (pumps fed by a Tube settler or Clarifier)",
          "consequence": "Those pumps get the sludge-pump check, maintenance, changeover and breakdown issue, with the reason shown ('fed by Tube Settler 1'). That covers DigitalPaani's four, Vedanta's SP-1 and Manesar's SP-1, with no type split and no editor. But it is the first logic that trusts the drawing. DigitalPaani's UF backwash pumps have no inlet drawn, its irrigation and flushing pumps have no outlet, and pipes have been drawn against the flow. Pumps that lose the sludge issue are left with no breakdown issue at all, and the two screw-press feed pumps still need a rule.",
          "recommended": false
        },
        {
          "label": "Ask the database team for a pump role on the SCADA form",
          "consequence": "A true lookup and the most reliable source, and Alex's grouping code already sorts pumps by a 'pump function'. But it reverses v5's 'no what-is-it-for question', depends on another team, and needs every plant's form filled in.",
          "recommended": false
        },
        {
          "label": "Adopt Alex's membership model with the drawing editor",
          "consequence": "Pumps and blowers join tanks and duty/standby sets, edited on the drawing. It needs grouping into treatment steps, pipe data and an editor Alex already doubts. Even then, two of Alex's membership rules put recirculation pumps in the MBBRs, not on the Tube settler where the sludge-pump work is filed, so on its own it would not fix this case.",
          "recommended": false
        }
      ],
      "recommendation": "Option 1 for v7: keep v6's placement marked 'to confirm', and build no membership editor and no duty/standby sets. The editor is the most expensive item in Alex's pack, Alex doubts it can be built, and it would not even move the sludge-pump work. For sludge pumps alone, though, the 'database type only' direction is the weaker answer in the long run, because SCADA's pipes already pick out the right pumps. So give a yes or no on option 2 as the next phase's first step. If yes, the rule should cover Clarifier-fed pumps too, and 'What SCADA found' needs a pipe check before anything trusts the drawing.",
      "v7Does": "There is no grouping into treatment steps and no duty/standby sets. The library shows one plain box: 'Grouping equipment into treatment steps, and readings on pipes between equipment — next phase.' Pumps keep v6's placement. The sludge-pump check, maintenance and changeover stay on the Tube settler, as set-level work marked 'to confirm'. The sludge breakdown issue stays on every Pump and Submersible Pump. When a diagnosis lands on another equipment's root cause, the issue adds 'Caused by <tag>'. The contract has no line about the sludge pumps' pipe evidence. Contract should change: show SCADA's 'Connected to' read-only in the equipment page's Details, as v6's inspector does. On each pump SCADA draws fed by a Tube settler (DigitalPaani SRCP-1 to 4, Vedanta SP-1), add a quiet line: 'Its sludge-pump work sits on Tube Settler 1 for now — to confirm'. Do not use the challenge's 'Next phase: connections' hint here, because that box is for readings on pipes.",
      "tellAlex": "The membership editor on the drawing is not being built and isn't wanted this phase. Your rules on shared equipment, control groups and membership changes after Live, and the open question on how critical shared equipment is, are deferred along with unit processes and control groups. Equipment in several groups, the name 'control group' and the model's full chain from plant type to reading wait with them. v7 keeps v6's sludge-pump placement on the Tube settler, marked to confirm. Sludge pumps are the first case the next phase must solve, from SCADA's pipes or the grouping code's 'pump function' rather than a drawing editor. Note that two of your membership rules would put the recirculation pumps in the MBBRs, not where the workbook files their work, and they don't cover the wasting line to the Sludge Pit. Where does the grouping code's 'pump function' come from: the form, the name or the graph?",
      "v71Option": 0,
      "v71Short": "v6's placement kept: sludge-pump work on the Tube settler, marked 'to confirm'; no membership editor and no duty/standby sets.",
      "v72Option": 3,
      "v72Short": "Many-to-many membership from the plant graph, edited on the drawing.",
      "v72Does": "v7/2 builds Alex's membership model. Participation is many-to-many and found from the plant graph: a recirculation pump participates in every reactor of its loop, and blowers or pumps that feed exactly the same downstream set form a control group. The structure pass proposes it, and membership is edited on the drawing: select a unit process to outline its participants (proposed ones dashed, shared ones tagged), add or remove one, and see the consequence before saving. Edits are free during Commissioning, need a reason once Live and flag the Triggers they touch, and survive a re-run. At DigitalPaani the participation rules put the sludge recirculation pumps in the MBBRs, not in the Tube settling unit processes where the library writes the sludge-pump Tasks, so the drawing alone does not move that work.",
      "both": false,
      "links": [
        {
          "label": "Sludge Re-Circulation Pump 1 at DigitalPaani",
          "href": "#/p/digitalpaani/eq/696a2b03bfe16121ad818cca",
          "label72": "Sludge Re-Circulation Pump 1: what it participates in",
          "href72": "#/p/digitalpaani/eq/696a2b03bfe16121ad818cca"
        },
        {
          "label": "Tube settler type: the sludge-pump tasks",
          "href": "#/library/T_SETTLER/tasks",
          "label72": "The drawing: membership at DigitalPaani",
          "href72": "#/p/digitalpaani/structure/drawing"
        },
        {
          "label": "Pump in the library",
          "href": "#/library/PMP",
          "label72": "Pump in the library",
          "href72": "#/library/eq-types/PMP"
        }
      ],
      "where": {
        "1": [
          "p/digitalpaani/eq/696a2b03bfe16121ad818cca/:tab?",
          "library/T_SETTLER/:tab?",
          "library/PMP/:tab?",
          "library/SUB_PMP/:tab?",
          "p/digitalpaani/eq/696a065601a4fb73764bdee4/issues"
        ],
        "2": [
          "p/digitalpaani/eq/696a2b03bfe16121ad818cca/:tab?",
          "p/:plant/structure/:view?",
          "p/:plant/cg/:id",
          "library/eq-types/PMP/:tab?"
        ]
      }
    },
    {
      "id": "D21",
      "title": "What makes a trial alert \"noisy\": more than 10 firings a day, or short firings just past its limit?",
      "short": "What makes a trial noisy",
      "severity": "Small",
      "arose": "First review",
      "alexSays": "Alex's commissioning rules say \"a Trigger with more than 10 trial firings a day is a readiness gap, not a blocker\", and the number is to be tuned after the first three plants. Alex's list of conflicts marks it \"default, not discussed\", and no document says over which days the rate is taken. Alex's own screens still mark DO low · AT-2, at 19 firings in 3 days (about 6 a day), \"Noisy · more than 10 a day\".",
      "v6Today": "v6 has no trial and no noisy check, so every alert opens a real issue. Its runtime also ignores \"must hold for\" and \"must clear for\" and opens and closes on the first reading. A firing count taken from v6 would therefore be too high.",
      "mihirsDirection": "Mihir gave no earlier direction on trial firings. The standing brief (simple by design, plain words, show consequences, critique rather than follow) points to one stated rule, with the rate shown beside the mark instead of a bare \"noisy\" label.",
      "options": [
        {
          "label": "Alex's rule as written: more than 10 a day, averaged over the alert's own trial days so far",
          "consequence": "One number and easy to explain. Vedanta's DO low (about 6 a day, mostly short firings) goes live with no mark. It then becomes the false-alarm issues that Alex tunes later on a Live plant.",
          "recommended": false
        },
        {
          "label": "A lower count: 3 or more a day",
          "consequence": "Still one number, and it marks DO low. It also marks alerts that fire for real while a new plant settles and whose limits are fine. The gap list grows and staff learn to skip it.",
          "recommended": false
        },
        {
          "label": "More than 10 a day, or 3 or more a day when most firings are short (30 min or less, peak within 10% of the limit). Show the rate on every alert.",
          "consequence": "Marks what tuning can fix (a limit or a 'must hold for' set too tight) and says why: '6 a day, mostly short'. It is one more idea to explain. The data is the start, end and peak that each trial firing already keeps.",
          "recommended": true
        },
        {
          "label": "No mark: show the rate and 'mostly short' on every alert, sorted noisiest first, and let staff judge",
          "consequence": "The simplest option, and the sorted list is already Alex's design. But nothing on Readiness prompts anyone to tune before go live.",
          "recommended": false
        }
      ],
      "recommendation": "Choose option 3. Alex's own tuning case is a false-alarm pattern: about 3 a day, 15 of 19 closed as false alarms, most closed within 10 min with the reading near the limit. A count of more than 10 never catches that, and a plain lower count would also mark alerts that fire for real while a new plant settles. Short firings just past the limit are exactly what moving the limit or lengthening \"must hold for\" fixes, so the mark points at the fix. v7's current default (Alex's rule as written) is the weaker option and is kept only so the gap is visible. Keep the window named (\"averaged over the trial so far\"), the rate shown on every alert, and both numbers provisional until three plants are live.",
      "v7Does": "v7 replays the sample readings to count trial firings, honouring \"must hold for\" and \"must clear for\". It shows each alert's rate as \"n a day\" over that alert's own trial days. It adds \"mostly short\" when most firings last 30 min or less and peak within 10% of the limit. The noisy gap appears only above 10 a day, averaged over the trial so far. At Vedanta, Level high — EQ-1 (12.8 a day) carries the gap. DO low — SBR-1 (5.9 a day) shows \"mostly short\" with no mark. Contract should change if option 3 is chosen: the noisy rule adds \"or 3 or more a day with most firings short\", and DO low — SBR-1 then carries the gap on Readiness.",
      "tellAlex": "On the noisy-alert rule, your screens contradict it. DO low · AT-2 fires 19 times in 3 days, about 6 a day (your Readiness screen says '6 a day'). Yet your Commissioning alert page marks it 'Noisy · more than 10 a day', and your Readiness screen and go-live confirmation count 2 noisy Triggers when only Sump level (11 a day) qualifies. The Commissioning alert page also reuses '19', the number your sensor page and Live alert page use for 7 days Live. Its 'median 4 min' is shorter than the 10-min clearing, so please say where a firing's length ends. Your tune-one-limit case on the Live alert page (about 3 a day, 15 closed as false alarm, closed within 10 min near 1.5) is flapping, not volume. So I'd tune the rule now to: more than 10 a day averaged over the trial so far, or 3+ a day with most firings short (30 min or less, peak within 10% of the limit). That can be computed from the start, end and peak each trial firing already stores. Keep your per-day column sorted noisiest first.",
      "v71Option": 0,
      "v71Short": "Noisy above 10 trial firings a day; DO low at SBR-1 (5.9 a day) shows 'mostly short' and carries no mark.",
      "v72Option": 0,
      "v72Short": "Noisy above 10 trial firings a day; no 'mostly short' label; firings are kept, so a mark clears only as the average falls.",
      "v72Does": "v7/2 uses Alex's rule as written: a Trigger is noisy when it records more than 10 trial firings a day, averaged over its own trial days so far, and that is a Readiness gap, not a blocker. The Trigger page shows \"Fired … times in … days · median … min · peak …\", and the Triggers list can be sorted noisiest first by trial firings a day. At Vedanta, Level high · EQ-1 (12.8 a day) is noisy. DO low · SBR-1 (5.9 a day, most of them short and near its limit) carries no mark and no \"mostly short\" label, and goes live as it is. Trial firings are kept as records (card D24), so tuning a noisy Trigger does not clear its mark at once: it clears only as the daily average falls, under two days later for Level high · EQ-1. On a Live plant, noisy means more than 10 Issues a day over the last 7 days.",
      "both": false,
      "links": [
        {
          "label": "Vedanta Readiness: the noisy gap",
          "href": "#/p/vedanta",
          "label72": "Vedanta Readiness: the noisy gap",
          "href72": "#/p/vedanta"
        },
        {
          "label": "Vedanta equipment: SBR-1 and EQ-1 alerts",
          "href": "#/p/vedanta/equipment",
          "label72": "Vedanta's Triggers, noisiest first",
          "href72": "#/p/vedanta/triggers?sort=trial"
        },
        {
          "label": "Manesar issues: DO low — AT-2 on a Live plant",
          "href": "#/p/manesar/issues",
          "label72": "DO low · AT-2 on a Live plant",
          "href72": "#/p/manesar/trigger/a_do_at2"
        }
      ],
      "where": {
        "1": [
          "p/vedanta",
          "p/vedanta/equipment",
          "p/manesar/issues",
          "p/vedanta/alert/:id",
          "p/vedanta/eq/v_sbr",
          "p/vedanta/eq/v_sbr/readings"
        ],
        "2": [
          "p/vedanta",
          "p/vedanta/triggers",
          "p/vedanta/trigger/:id",
          "p/manesar/trigger/a_do_at2"
        ]
      }
    },
    {
      "id": "D22",
      "title": "Should the library's proposals list a shared task once, the way the plant's task list does?",
      "short": "Shared tasks on the review",
      "severity": "Small",
      "arose": "Reviewing v7/1",
      "alexSays": "Alex's bindings pass lists one row per template and subject ('Bearing service · Task → BL-1'), grouped by unit process, with 'Accept n' on each group and 'Accept n and start trial' for everything left. Every Task sits on exactly one subject, so nothing is grouped on the pass or on the plant's Tasks list, and each accepted Task is one row on each.",
      "v6Today": "v6 copies every library task onto each equipment of its type (325 schedules at DigitalPaani) and lists them one per equipment everywhere, so its counts agree but every list is long.",
      "mihirsDirection": "This phase has no sets: a record sits on one piece of equipment or on the plant (card D7), and shared routine work is grouped on screen only. Mihir hasn't said whether the review should group the same way. The standing brief asks for the simplest screen that shows the consequence.",
      "options": [
        {
          "label": "Keep the review per equipment (v7/1 today)",
          "consequence": "DigitalPaani's review shows 329 proposals to decide (325 tasks, 4 alerts), with a shared task listed once under each piece of equipment: the blower running-parameters log appears five times. 'Accept all for 5 Blowers' takes them in one click, but the counts disagree: the 329 decided here become 217 rows on the Tasks tab. Leaving one blower out is one click.",
          "recommended": false
        },
        {
          "label": "Group shared tasks on the review the same way the Tasks tab does",
          "consequence": "One line per shared task, naming its equipment ('Blower running parameters log · 5 blowers'), accepted or left out for all of them at once; opening the line lets you leave one piece of equipment out with a reason. DigitalPaani's review drops to 221 lines (217 tasks, 4 alerts), and the 217 match the Tasks tab. One grouping rule serves both screens. Leaving one blower out takes one more click.",
          "recommended": true
        },
        {
          "label": "Group nothing anywhere: one row per task and subject on the review and on the Tasks tab (v7/2)",
          "consequence": "The two lists agree because neither groups. But the Tasks tab then carries every copy too: at DigitalPaani about 233 tasks a day if each piece of equipment gets its own, against about 68 grouped (card D7).",
          "recommended": false
        }
      ],
      "recommendation": "Option 2. The review is where an admin first meets the plant's work, so it should count that work the way the operator will see it: 221 lines at DigitalPaani instead of 329, and the 217 tasks match the Tasks tab. It reuses the Tasks tab's grouping, so there is one rule, and records still sit on each piece of equipment. Leaving one blower out stays possible, one click deeper. If Mihir takes card D7's plant rounds, both screens change together.",
      "v7Does": "'What the library brings' lists proposals per piece of equipment, under a card per type. DigitalPaani opens with '329 proposals to decide' (325 tasks and 4 alerts; 130 more can't be used yet). Each type card has 'Accept all for 5 Blowers', and 'Accept all 329' asks first, saying tasks start at go live at about 68 a day (233 if each piece of equipment gets its own). Once accepted, the Tasks tab shows 217 rows: 172 tasks on one piece of equipment, 8 on the plant, and 37 tasks grouped per type with a line per equipment. So the review and the Tasks tab count the same work two ways. If option 2 is chosen, the review takes the Tasks tab's grouping.",
      "tellAlex": "On your bindings pass: one row per template and subject, grouped by unit process with 'Accept n' per group, reads well. Our review lists per equipment while our task list groups shared routine work per type, so the counts disagree (329 against 217 at DigitalPaani). We propose making the review count the way the task list does. No question for you; just noting that your pass and your Tasks list agree for the opposite reason: neither groups.",
      "v71Option": 0,
      "v71Short": "Lists each shared task once per piece of equipment (329 to decide at DigitalPaani); the Tasks tab groups them into 217.",
      "v72Option": 2,
      "v72Short": "One row per Task and subject on the bindings pass and on the Tasks tab: nothing is grouped, so the counts agree.",
      "v72Does": "v7/2's bindings pass lists one row per template and subject ('Clean intake filter · Task → BL-1'), grouped by unit process, with 'Accept n' per group and 'Accept n and start trial' for everything left; it opens once the structure pass is confirmed. Every Task sits on one subject and nothing is grouped on the Tasks tab either, so each accepted Task is one row on the pass and one row on the Tasks tab. The cost is card D7's: one Tasks-a-day number with every copy in it.",
      "both": false,
      "links": [
        {
          "label": "DigitalPaani: What the library brings, 329 proposals to decide",
          "href": "#/p/digitalpaani/library",
          "label72": "DigitalPaani: the bindings pass, one row per template and subject",
          "href72": "#/p/digitalpaani/review/bindings"
        },
        {
          "label": "DigitalPaani tasks: 217 rows once everything is accepted",
          "href": "#/p/digitalpaani/tasks",
          "label72": "DigitalPaani Tasks: one per subject, nothing grouped",
          "href72": "#/p/digitalpaani/tasks"
        }
      ],
      "where": {
        "1": [
          "p/:plant/library",
          "p/digitalpaani/tasks"
        ],
        "2": [
          "p/:plant/review/bindings",
          "p/digitalpaani/tasks"
        ]
      }
    },
    {
      "id": "D23",
      "title": "Should a safety change to an Emergency limit reach a tank whose issue is still open?",
      "short": "Safety changes and open issues",
      "severity": "Shapes v7",
      "arose": "Designing v7/2",
      "alexSays": "Alex's versioning rule makes any change to an Emergency band, or to a statutory template, Forced: it reaches every plant, pinned ones included, and tells the plant admins. The same drafts say Triggers with open Issues aren't touched by any change and show 'base moved' until someone resyncs them by hand, so the tank with the open Issue keeps the old Emergency limit. The drafts don't weigh the two against each other, and they don't say whether a Forced change reaches a Trigger whose Issue has closed but which still waits for its resync. Alex ranks safety second, below only 'nothing changes silently'.",
      "v6Today": "v6 has no versions and no safety kind. A library save reaches every plant at once, and the engine reads limits live, so an open issue steps up against a new limit straight away, even though v6's limits sheet says new limits 'reach it after it closes'.",
      "mihirsDirection": "Mihir's 16 Oct call took the freeze out (card D15), and v7 added the rule that an open Issue finishes on the terms it opened under. Neither call looked at a safety change. The standing brief: do what is safe and easiest, and show the consequence before it happens.",
      "options": [
        {
          "label": "Wait until the Issue closes (both prototypes today)",
          "consequence": "The tank with the open Issue keeps the old Emergency limit until someone closes the Issue; every other tank gets the stricter one at once. At Manesar, raising DO low's Emergency limit from 0.5 to 0.8 mg/L reaches AT-1 and AT-2, but the open Major Issue on AT-2 still steps up to Emergency only below 0.5, so a fall to 0.7 mg/L makes no Emergency call. No exception to explain.",
          "recommended": false
        },
        {
          "label": "A stricter Emergency limit reaches open Issues at once",
          "consequence": "The open Issue steps up to Emergency at the new limit and calls people; everything else it opened under (its band's limit, persistence, clearing) stays. A safety change that loosens the Emergency limit still waits for the Issue to close. The Issue page says 'Emergency limit tightened by a safety change while this Issue was open: 0.5 → 0.8 mg/L', and the publish preview lists the open Issue among what it reaches. Cost: one stated exception to 'an open Issue keeps its terms' in v7, and to 'open records aren't touched' in Alex's freeze.",
          "recommended": true
        },
        {
          "label": "Wait until the Issue closes and someone resyncs the Trigger",
          "consequence": "The freeze read strictly: a Trigger held after its Issue closes skips every change, Forced included, until a person presses Resync. The stricter Emergency limit can stay missing for days after the Issue is over, with nothing on Readiness or Coverage to say so. Neither prototype builds this; it is the reading v7/2 turned down.",
          "recommended": false
        }
      ],
      "recommendation": "Option 2. A safety change matters most for the tank closest to an Emergency, and an open low-DO Issue marks exactly that tank. Waiting for the Issue to close, which both prototypes do, skips it for as long as the Issue stays open; waiting for a resync as well could skip it for days. Applying only a stricter Emergency limit leaves everything the operator is working to unchanged, and it isn't silent: the Issue page and the publish preview both say so. It needs Alex's agreement, because the drafts say open records aren't touched, and it adds one line to v7's 'an open Issue keeps its terms' rule if Mihir keeps card D15's option 3.",
      "v7Does": "There is no freeze (card D15): a change reaches the alert at once, but an open issue steps up and clears by the terms it opened under, its Emergency limit included. Publishing a safety change to the Diffuser Tank's DO Emergency limit (0.5 → 0.8 mg/L) moves AT-1 and AT-2 to 0.8, and 'Where it lands' says '1 open issue on these readings keeps the terms it opened under'. The open 'DO low — AT-2' issue, at Major, still steps up to Emergency only below 0.5. Its page says nothing about it, because it compares only the band the issue opened at. Once the issue closes, the next one opens under 0.8.",
      "tellAlex": "On Forced changes and frozen Triggers: your versioning rule says an Emergency change is Forced and reaches every plant, and also that Triggers with open Issues aren't touched. When both apply, the tank with the open low-DO Issue is the one tank that misses the stricter Emergency limit, and our own rule (an open Issue keeps its terms) has the same gap. I'd like a stricter Emergency limit to reach open Issues too, on that band only, with the Issue page saying so. Do you agree? And once the Issue has closed, should a Forced change reach a Trigger that still waits for its resync? v7/2 assumes yes.",
      "v71Option": 0,
      "v71Short": "Waits: the open issue keeps the old Emergency limit until it closes; the alert itself moves at once.",
      "v72Option": 0,
      "v72Short": "Waits: the frozen Trigger is skipped while its Issue is open; once it closes, the forced band reaches it.",
      "v72Does": "v7/2 skips the frozen Trigger, as Alex's drafts say: Downstream lists '1 frozen · wait for open Issues' with 'Manesar STP · DO low · AT-2', which keeps 0.5 while its Issue is open. The drafts are silent on a Trigger whose Issue has closed but which still waits for a resync; there v7/2 lets a Forced change reach it at once on the forced band, while its other terms keep waiting (safety decides the silent case). So the gap lasts as long as the Issue stays open, as in v7/1, and Downstream shows it before publishing.",
      "both": false,
      "links": [
        {
          "label": "Diffuser Tank in the library: change DO's Emergency limit and see Where it lands",
          "href": "#/library/OS_TANK_DF",
          "label72": "DO low template: Downstream lists the frozen Trigger",
          "href72": "#/library/templates/tpl_up_activated-sludge_do-low"
        },
        {
          "label": "Manesar: the open 'DO low — AT-2' issue and the terms it opened under",
          "href": "#/p/manesar/issue/is_2z",
          "label72": "Manesar: the open 'DO low · AT-2' Issue",
          "href72": "#/p/manesar/issue/is_2z"
        }
      ],
      "where": {
        "1": [
          "library/OS_TANK_DF",
          "library/OS_TANK_DF/readings",
          "p/manesar/issue/is_2z"
        ],
        "2": [
          "library/templates/tpl_up_activated-sludge_do-low",
          "p/manesar/issue/is_2z"
        ]
      }
    },
    {
      "id": "D24",
      "title": "Should trial firings be kept as they happened, or recounted with today's limits after every change?",
      "short": "Trial firings: kept or recounted",
      "severity": "Small",
      "arose": "Designing v7/2",
      "alexSays": "Alex's reference makes a trial firing a record the engine sets (Trigger, band, start, end, peak), and Alex's commissioning memo keeps trial firings as history. A limit change previews 'would have fired n times (now m)' over the same readings, and more than 10 trial firings a day, averaged over the trial so far, marks a Trigger noisy. No draft says whether firings recorded under the old limit still count towards the mark once the limit is fixed.",
      "v6Today": "v6 has no trial, no reading history and no record of firings: every alert opens a real issue at once (card D5).",
      "mihirsDirection": "Mihir has set no direction on trial firings. The standing brief: nothing changes silently, show the consequence before it happens, keep it simple.",
      "options": [
        {
          "label": "Recount the trial with today's limits after every change (v7/1)",
          "consequence": "The trial card and the noisy mark follow a fix at once: Vedanta's Level high on EQ-1 goes from 76 firings (12.8 a day, noisy) to 0 the moment its Caution limit moves from 85 to 87%. But the history rewrites itself: lowering pH low's Emergency limit on EQ-1 from 4.0 to 3.5 turns Wed 28 Oct's Emergency (pH 3.7) into a Major firing. v7/1 still has that Emergency only because it opened a real issue (card D3); with nothing sent during Commissioning, the trial card would be its only trace.",
          "recommended": false
        },
        {
          "label": "Keep each firing as a record and average over the whole trial (v7/2, as Alex wrote it)",
          "consequence": "History never changes, and Wed 28 Oct's Emergency stays on the trial card whatever the limit becomes. But a fixed Trigger stays marked noisy until its average falls below 10 a day: Level high on EQ-1, tuned at 09:00 on Thu 29 Oct, keeps its Readiness gap until about 01:19 on Sat 31 Oct, although the preview already says it would have fired 0 times instead of 76. The mark doesn't block Go live, so staff learn to ignore it, or hold go-live for almost two days over a Trigger that is already fixed.",
          "recommended": false
        },
        {
          "label": "Keep the records, and judge 'noisy' by replaying the trial with today's limits",
          "consequence": "The trial card lists what happened, unchanged, and adds a second line: 'With today's limits: 0 in 5.9 days'. The noisy mark and the go-live confirmation use that second line, so a fix shows at once and nothing is erased. It uses the same replay the 'would have fired' preview already needs, so it adds no new data. Cost: two numbers on the Trigger page instead of one.",
          "recommended": true
        },
        {
          "label": "Keep the records, and count the noisy mark only from the last change",
          "consequence": "Needs no replay, so it works even where the plant keeps no reading history. But the mark clears the moment a limit changes, on no evidence ('0 firings in 2 hours'), and comes back a day later if the fix didn't work. The go-live confirmation would have to say how long ago each Trigger was changed.",
          "recommended": false
        }
      ],
      "recommendation": "Option 3. Records are the right home for what happened: Alex's memo asks for them, and when nothing is sent during Commissioning they are the only trace of an Emergency. But the noisy mark is a prompt to tune, so it should judge the Trigger as it is now, and the 'would have fired' preview already replays the trial with the typed limits. Showing both lines keeps the history honest and lets a fixed Trigger clear at once. If a plant keeps no reading history, option 4 is the fallback; recounting the history itself (v7/1 today) is the weaker option.",
      "v7Does": "v7/1 never stores a trial firing. The trial card and the noisy mark replay the sample readings over the trial so far with the alert's current limits and timing, so a reasoned change shows at once: moving Level high — EQ-1's Caution from 85 to 87% takes it from 76 firings (12.8 a day) to 0, and the noisy gap leaves Readiness straight away. The same replay rewrites the past: lowering pH low — EQ-1's Emergency limit from 4.0 to 3.5 turns its Emergency on Wed 28 Oct into a Major firing on the trial card. The real Commissioning issue that Emergency opened stays.",
      "tellAlex": "On trial firings as records: agreed, keep them as history. With nothing sent during Commissioning they're the only trace of an Emergency. One change to the noisy mark: judge it by replaying the trial with the Trigger's current limits (the same replay your 'would have fired' preview uses), shown as a second line on the trial card. Otherwise a Trigger fixed on day 6 stays marked noisy for almost two more days. Does that fit what you meant?",
      "v71Option": 0,
      "v71Short": "Recounts the trial with today's limits: a fix clears the noisy mark at once, but past firings change with it.",
      "v72Option": 1,
      "v72Short": "Keeps each trial firing as a record: history never changes, but a fixed Trigger stays noisy for days.",
      "v72Does": "v7/2 stores each trial firing as a record and never recounts it. After tuning, Level high · EQ-1's trial card still reads 'Fired 76 times in 5.9 days'; the override preview says 'Trial so far: would have fired 0 times instead of 76', yet the noisy gap stays on Readiness until the average falls below 10 a day, about 01:19 on Sat 31 Oct with no new firings. Wed 28 Oct's Emergency on pH low · EQ-1 stays on the trial card whatever its limit becomes, which matters because v7/2 sends nothing and opens no Issue during Commissioning.",
      "both": false,
      "links": [
        {
          "label": "Vedanta: Level high — EQ-1, the noisy alert and its trial card",
          "href": "#/p/vedanta/alert/a_3d",
          "label72": "Vedanta: Level high · EQ-1, 76 trial firings kept after tuning",
          "href72": "#/p/vedanta/trigger/a_3d"
        },
        {
          "label": "Vedanta: pH low — EQ-1 and its Emergency on Wed 28 Oct",
          "href": "#/p/vedanta/alert/a_3f",
          "label72": "Vedanta: pH low · EQ-1, the Emergency kept as a trial firing",
          "href72": "#/p/vedanta/trigger/a_3f"
        },
        {
          "label": "EQ-1's readings: change the level limits with a preview",
          "href": "#/p/vedanta/eq/v_eq1/readings",
          "label72": "LVL-EQ-1's Zones: an override with a trial preview",
          "href72": "#/p/vedanta/sensor/v_eq1_LVL"
        }
      ],
      "where": {
        "1": [
          "p/vedanta/alert/:id",
          "p/vedanta/eq/v_eq1/:tab?"
        ],
        "2": [
          "p/vedanta/trigger/:id",
          "p/vedanta/sensor/v_eq1_LVL"
        ]
      }
    },
    {
      "id": "D25",
      "title": "When the library swaps a fixed number for a rule, should a plant still on the old number keep it as its own value?",
      "short": "Old library numbers at a plant",
      "severity": "Small",
      "arose": "Designing v7/2",
      "alexSays": "Alex's migration turns every legacy plant value that differs from the library into an override with the reason Migrated and a 90-day review; Migrated is never offered in the form. A condition Task's 'do when' and 'done when' are tunable values like any limit. Alex's limit rules let a library value be a share of a design parameter; v7/2's library writes a blower's motor-current limits that way, and its intake-filter job too, as v6's form rule already did. The drafts don't say what to do with a value that differs only because the library itself moved from a number to a rule.",
      "v6Today": "v6's Blower type holds fixed numbers: motor current Caution 44 A and Minor 48 A with no Major, and the intake-filter job at 42 A, done at 38 A. Its SCADA form rule would give 40 / 42 / 46 A and 38 / 34 A for a 22 kW motor. Manesar's BL-1 (22 kW) holds exactly the fixed numbers, and nothing records whether anyone chose them.",
      "mihirsDirection": "Mihir has set no rule for migrating plant values. The standing brief: nothing changes silently on a running plant, and show the consequence before it happens.",
      "options": [
        {
          "label": "Keep them as the plant's own values, marked Migrated, with a review date",
          "consequence": "Nothing moves on a Live plant. Five of Manesar's 15 migrated values are these, all due for review by 30 Nov, and BL-1 keeps no Major motor-current band while every other 22 kW blower gets one at 46 A. A reviewer can't tell a value the plant chose from one it simply never changed.",
          "recommended": false
        },
        {
          "label": "Treat them as leftovers: a value equal to the old library number follows the new rule at migration",
          "consequence": "BL-1 moves to 40.0 / 42.0 / 46.0 A, gains a Major band, and its intake-filter job starts at 38.0 A instead of 42 A, so it comes due sooner. No review is needed. But a running plant's limits change with nobody looking, and a plant that really chose 44 A loses it.",
          "recommended": false
        },
        {
          "label": "Keep them, and mark the ones that equal the old library number",
          "consequence": "Nothing moves at migration. Each such value says 'Same as the library's old number: probably never chosen here', and the review list puts them first with 'Adopt the library value' one click away, showing what changes (BL-1 gains a Major band at 46 A). Five of Manesar's 15 migrated values carry the mark. Costs one comparison at migration.",
          "recommended": true
        }
      ],
      "recommendation": "Option 3. Moving values on a Live plant at migration (option 2) breaks 'nothing changes silently' and would quietly change BL-1's limits. Keeping them unmarked (option 1) is safe but leaves the reviewer guessing, and a blower with no Major band is the kind of thing a 90-day review should catch first. The mark costs one comparison with the old library and turns the review into a quick Adopt or Keep. Manesar is a sample plant, so neither prototype can know what it chose; the review is where a person decides.",
      "v7Does": "v7/1 shows AMP-BL1's 44 / 48 A and its missing Major band as 'Changed here', reason 'Not recorded (changed before reasons were kept)', against 40 / 42 / 46 A from the SCADA form for a 22 kW motor. The intake-filter job keeps 42 / 38 A and is not listed in Differences at all: v7/1 has no record for a condition's thresholds and doesn't work them out from the form. So the same leftover shows as a plant change in one place and not at all in the other. This is closest to option 1, without its review date or its Migrated mark.",
      "tellAlex": "On migration: when the library swaps a fixed number for a rule, plants still on the old number show up as overrides nobody chose. Manesar's blower has five. I'd keep them as Migrated, as you say, but mark the ones that equal the old library value so the review can adopt the rule in one step. Is Migrated meant to cover these, or should migration adopt the rule where a plant never changed the value?",
      "v71Option": null,
      "v71Short": "Closest to option 1: keeps them as changed here, reason not recorded, no review date; the intake-filter values aren't listed at all.",
      "v72Option": 0,
      "v72Short": "Keeps all five as Migrated overrides, review by 30 Nov; nothing marks them as the library's old numbers.",
      "v72Does": "v7/2 migrates all five as overrides with the reason Migrated, set 1 Sep 2026, review by 30 Nov 2026, author not recorded: AMP-BL1's Caution 44 A (base 40.0 A), Minor 48 A (base 42.0 A) and Major none (base 46.0 A), and the Clean intake filter job's do-when 42 A (base 38.0 A) and done-when 38 A (base 34.0 A). Without the last two, BL-1's intake-filter job would move to 38.0 / 34.0 A with nobody told. Nothing marks them as the library's old numbers.",
      "both": false,
      "links": [
        {
          "label": "Manesar BL-1: motor-current limits changed here",
          "href": "#/p/manesar/eq/bl1/readings",
          "label72": "AMP-BL1's Zones: three Migrated overrides",
          "href72": "#/p/manesar/sensor/bl1_amps"
        },
        {
          "label": "Manesar differences from the library",
          "href": "#/p/manesar/differences",
          "label72": "Manesar deviations: the Migrated values",
          "href72": "#/p/manesar/deviations"
        }
      ],
      "where": {
        "1": [
          "p/manesar/eq/bl1/:tab?",
          "p/manesar/differences"
        ],
        "2": [
          "p/manesar/sensor/bl1_amps",
          "p/manesar/eq/bl1/:tab?",
          "p/manesar/deviations",
          "p/manesar/trigger/w_intake"
        ]
      }
    },
    {
      "id": "D26",
      "title": "Should a piece of equipment take the highest criticality of the treatment steps it serves, or keep its type's own?",
      "short": "Criticality from what it serves",
      "severity": "Small",
      "arose": "Designing v7/2",
      "alexSays": "Alex's drafts make the criticality tier (A, B or C) a value worked out from the plant graph, changed at a plant only with a reason. They propose that equipment shared between unit processes takes the highest tier of the unit processes it serves, and list that rule as proposed, not decided. The drafts don't say what the tier then drives.",
      "v6Today": "Every piece of equipment carries its type's criticality: Critical, Essential or Standard (A, B or C). A plant changes it with a note: Manesar's SP-1 is Standard against its type's Essential ('Sludge can wait a day'). Nothing works a criticality out from what the equipment feeds.",
      "mihirsDirection": "This phase has no level above equipment (card D1), so there is no treatment step for a piece of equipment to serve. Mihir hasn't spoken to criticality. The standing brief: nothing changes silently on a running plant, and show the consequence before it happens.",
      "options": [
        {
          "label": "Keep each type's own criticality; a plant changes it with a reason (v7/1)",
          "consequence": "Nothing moves when the structure changes, and it needs no structure at all, so it fits this phase. But supporting equipment can rank below what it serves until someone at the plant raises it: at Bawal, valve V-1 stays Standard while the filter it feeds is Essential, and dosing tank DT-1 and cavitator CV-1 stay Essential beside a Critical UF membrane.",
          "recommended": true
        },
        {
          "label": "Take the highest criticality of the unit processes it serves, worked out from the plant graph (v7/2)",
          "consequence": "Supporting and shared equipment ranks with what it serves, and nobody has to remember to raise it. But the tier rides along with every membership change: a structure edit previews it, yet nobody decides it on its own. At Bawal, its confirmed structure raises V-1 from C to B and DT-1 and CV-1 from B to A; at DigitalPaani the proposed structure raises the four UF backwash pumps from B to A and six UF valves from C to A before anyone confirms it. Needs the unit-process level of card D1.",
          "recommended": false
        },
        {
          "label": "Suggest the higher criticality from the structure; a person accepts it with a reason",
          "consequence": "The structure pass lists each raise with its reason ('UFBP-1: B → A, takes part in UF-1'), and accepting it records the plant's own value, so no tier moves without a person agreeing to that tier. Costs one more decision per raised piece of equipment (10 at DigitalPaani, 3 at Bawal), and a later structure change only suggests again. Also needs card D1's level.",
          "recommended": false
        }
      ],
      "recommendation": "Option 1 for this phase. With no level above equipment (card D1's recommendation) there is nothing to work a criticality out from, and in both prototypes the criticality is only shown and changed with a reason: nothing in this study ranks or times work by it yet. When treatment steps arrive, prefer option 3 to option 2: a suggestion a person accepts keeps 'nothing changes silently', where a worked-out value moves a tier whenever membership changes. Ask Alex what the tier is meant to drive, because that decides how much a wrong tier costs.",
      "v7Does": "Each piece of equipment takes its type's criticality from the library, shown as Critical, Essential or Standard in its page header, on its Details and in the plant's equipment list. A plant changes it with a note, and the change shows in Differences (Manesar's SP-1 is Standard against its type's Essential). Nothing works a criticality out from what the equipment serves: Bawal's V-1 is Standard, and DT-1 and CV-1 are Essential.",
      "tellAlex": "On criticality for shared equipment, which your drafts list as proposed: this phase has no unit-process level, so we'd keep each type's own tier, changed at a plant with a reason. When the level arrives, could the graph suggest a higher tier for a person to accept, rather than derive it? Derived, the tier moves with every membership change (Bawal's V-1, DT-1 and CV-1 rise with its confirmed structure). And what is the tier meant to drive: the order of work, or how fast a fault must be fixed?",
      "v71Option": 0,
      "v71Short": "Each piece of equipment keeps its type's criticality; a plant changes it with a note, shown in Differences.",
      "v72Option": 1,
      "v72Short": "Derived from the structure: the highest of the type's tier and the unit processes it serves (Bawal's V-1, DT-1 and CV-1 rise).",
      "v72Does": "v7/2 works the tier out as Derived: the highest of the type's library tier and the tiers of every unit process the equipment takes part in (proposed, confirmed or added), never lower, unless the plant overrides it with a reason. When the graph raises it, the chip says 'Derived · highest of UF-1'. At Bawal this raises V-1 from C to B (it serves MGF-1) and DT-1 and CV-1 from B to A (UF-1). At DigitalPaani the proposed structure raises the four UF backwash pumps from B to A and six UF valves from C to A before anyone confirms it, and a structure edit shows each change before it is saved. v7/2 shows tiers as A, B and C, without v6's Critical, Essential and Standard.",
      "both": false,
      "links": [
        {
          "label": "Bawal V-1: Standard, from its type",
          "href": "#/p/bawal/eq/sc_v1/details",
          "label72": "Bawal V-1: tier B, Derived from MGF-1",
          "href72": "#/p/bawal/eq/sc_v1/details"
        },
        {
          "label": "Bawal equipment and each one's criticality",
          "href": "#/p/bawal/equipment",
          "label72": "DigitalPaani's structure pass: what the proposed structure raises",
          "href72": "#/p/digitalpaani/review/structure"
        }
      ],
      "where": {
        "1": [
          "p/bawal/eq/sc_v1/:tab?",
          "p/bawal/eq/sc_dt1/:tab?",
          "p/bawal/eq/sc_cav/:tab?",
          "p/bawal/equipment",
          "p/digitalpaani/eq/696a1ad134de5ea6f9f9ebef/:tab?"
        ],
        "2": [
          "p/bawal/eq/sc_v1/:tab?",
          "p/bawal/eq/sc_dt1/:tab?",
          "p/bawal/eq/sc_cav/:tab?",
          "p/:plant/review/structure",
          "p/digitalpaani/eq/696a1ad134de5ea6f9f9ebef/:tab?"
        ]
      }
    },
    {
      "id": "D27",
      "title": "Should a plant's achievements, such as '90 days without an Emergency', come across from v6, and as what?",
      "short": "Achievements from v6",
      "severity": "Small",
      "arose": "Designing v7/2",
      "alexSays": "In Alex's model a Trigger fires one of three things: an Issue (something is wrong), a Task (planned work) or an Achievement (something went right). Achievements show on plant and unit-process pages, and during Commissioning a Trigger records a trial firing instead. The drafts don't say which achievements a plant starts with or what they lead to.",
      "v6Today": "v6 calls them milestones, and a plant inherits them from its plant type: an STP gets 'Zero overdue tasks this week' and '90 days without an Emergency', an ETP the first of those, a WTP '30 days of outlet within limits'. Manesar holds three, the third being 'DO held above 2.5 mg/L for 24 hours'.",
      "mihirsDirection": "Mihir hasn't spoken to achievements. This phase's alerts read sensors on the equipment, and the standing brief asks for the simplest screen that shows a consequence, with nothing changing silently.",
      "options": [
        {
          "label": "Leave them out this phase (both prototypes today)",
          "consequence": "Nothing to build or configure. But v6's milestones disappear at migration with no trace, Manesar's three included, and plants lose the one screen that says something went right. Nobody is told they're gone.",
          "recommended": false
        },
        {
          "label": "Keep them as a Trigger outcome, as Alex draws them",
          "consequence": "Each achievement is a Trigger with a condition, configured, reviewed and versioned like any other, and shown on the plant's page; Manesar's three come across as Triggers. It adds a third outcome to every Trigger form, the review and the library, for something that tells nobody anything urgent.",
          "recommended": false
        },
        {
          "label": "Work the plant-wide ones out from Issues and Tasks on the Live home, with nothing to configure",
          "consequence": "'90 days without an Emergency' and 'Zero overdue tasks this week' become two lines on a Live plant's home, counted from its own issues and tasks. Milestones on a reading ('DO held above 2.5 mg/L for 24 hours', '30 days of outlet within limits') need a reading rule, so they are dropped and listed at migration as not carried. Small to build, and no new settings.",
          "recommended": true
        }
      ],
      "recommendation": "Option 3. Two of v6's milestones are counts the console already has (Emergencies and overdue tasks), so they need no configuration, and showing them keeps the one positive signal plant staff get. Making achievements Triggers (option 2) adds a third kind of outcome to every editor for little gain this phase. Leaving them out (option 1) drops them silently at migration; if Mihir picks it, migration should at least list them as not carried.",
      "v7Does": "v7/1 shows no achievements anywhere. v6's milestones at Manesar are in the sample data, but no screen reads them, and the plant types' milestones reach no page. Manesar's home (Coverage) shows how often each alert fired, how many were false alarms and how long issues took to close.",
      "tellAlex": "On Achievements: neither prototype builds them this phase. We'd show the two plant-wide ones v6 has ('90 days without an Emergency', 'Zero overdue tasks this week') on a Live plant's home, counted from Issues and Tasks, rather than make them Triggers. Is an Achievement meant to be configured per plant, or is it reporting?",
      "v71Option": 0,
      "v71Short": "Leaves achievements out: v6's milestones, Manesar's three included, are neither shown nor carried across.",
      "v72Option": 0,
      "v72Short": "Leaves achievements out, though Alex gives every Trigger them as a third outcome; Manesar's three aren't carried.",
      "v72Does": "v7/2 builds no Achievement outcome: its Triggers fire Issues and Tasks only, and Coverage shows no achievements. Both prototypes leave them out so the comparison stays like for like; it is Alex's model where the gap shows, because the drafts give every Trigger a third outcome.",
      "both": true,
      "links": [
        {
          "label": "Manesar's home (Coverage): no achievements",
          "href": "#/p/manesar",
          "label72": "Manesar's Coverage: four cards, no achievements",
          "href72": "#/p/manesar"
        }
      ],
      "where": {
        "1": [
          "p/manesar"
        ],
        "2": [
          "p/manesar"
        ]
      }
    }
  ];

  /* the readings v7/2 takes where Alex's drafts are silent or say two things: {n, title, drafts (what the drafts say),
     reading (what v7/2 does), why, card (the Dn the question is argued on, or null), confirm (true when Mihir must
     confirm it)}. The document view lists them, each linking the card it is argued on. */
  W.V7_READINGS = [
    {
      "n": 1,
      "title": "A safety change and a tank with an open Issue",
      "drafts": "An Emergency change is Forced and reaches every plant, yet Triggers with open Issues are skipped by every change.",
      "reading": "As written: the frozen Trigger is skipped, so the tank with the open low-DO Issue misses the stricter Emergency limit until its Issue closes.",
      "why": "The drafts say it plainly and v7/2 does not improve on them, but Alex's own safety principle argues the other way, so this goes to Alex.",
      "card": "D23",
      "confirm": true
    },
    {
      "n": 2,
      "title": "Nothing is sent during Commissioning",
      "drafts": "During Commissioning, Triggers record trial firings at every severity and nothing is sent, Emergencies included.",
      "reading": "Kept as Alex decided. Returning a Live plant to Commissioning also mutes its new Emergencies, and the return dialog says so.",
      "why": "It is Alex's stated decision; v7/2 shows the cost instead of changing it.",
      "card": "D3",
      "confirm": false
    },
    {
      "n": 3,
      "title": "Going live with nothing bound",
      "drafts": "Alex's blockers are people nobody can reach, equipment with no type or left unclassified, and undecided drafts. No rule asks for at least one Trigger.",
      "reading": "Go live needs no Trigger, and a structure pass nobody confirmed does not block it (only unclassified equipment does), so a plant with people added and nothing bound can go live.",
      "why": "The list is read as written; card D2 sets out the cost.",
      "card": "D2",
      "confirm": false
    },
    {
      "n": 4,
      "title": "Readings on pipes",
      "drafts": "Triggers sit on a unit process, a piece of equipment or the plant. One of Alex's drawings binds a settler's outlet turbidity, but nothing says what subject a reading on a pipe takes.",
      "reading": "Readings on pipes, such as an MBR outlet turbidity, stay unbound, as in v7/1, so the Live plants' numbers stay like for like.",
      "why": "Binding them would be the fuller reading of Alex's model; v7/2 keeps the two prototypes comparable instead, which Mihir should confirm.",
      "card": "D16",
      "confirm": true
    },
    {
      "n": 5,
      "title": "Tanks stored with a generic type",
      "drafts": "Identification proposes a unit-process type from the plant graph, but many tanks are stored with a generic type.",
      "reading": "The type stored in the survey is used first, as in v7/1, then rules from the tank's place in the graph, each with a plain reason. The screen chamber is proposed as a Collection sump, and a person can change it.",
      "why": "Automation proposes, a person confirms.",
      "card": "D9",
      "confirm": false
    },
    {
      "n": 6,
      "title": "Where a unit-process type's content comes from",
      "drafts": "Unit-process types carry Triggers, Tasks and Issue types, but the drafts don't say where that content starts.",
      "reading": "Each unit-process type copies its content from one database type. The five generic ones (Collection sump, Equalisation, Chlorine contact, Sludge holding, Treated water storage) start with Open Skeleton Tank's content, and the other generic types' own content goes unused.",
      "why": "It keeps the workbook content the same as v7/1, so the comparison is fair.",
      "card": "D1",
      "confirm": false
    },
    {
      "n": 7,
      "title": "Pump function",
      "drafts": "Control groups are pumps or blowers with the same function feeding the same equipment downstream, but the data has no pump-function field.",
      "reading": "The tag's name stands in for the function. That proposes two doubtful control groups: UF backwash pumps across both trains, and hypo dosing across both lines.",
      "why": "Automation proposes, a person confirms: the structure pass shows both for a person to fix.",
      "card": "D20",
      "confirm": false
    },
    {
      "n": 8,
      "title": "Membership rules taken literally",
      "drafts": "Alex's five membership rules say which equipment takes part in which unit process.",
      "reading": "Applied as written, they leave feed and transfer pumps, screw presses and the poly dosing set unclassified: 20 of DigitalPaani's 45 pieces of equipment and 7 of Bawal's 8.",
      "why": "v7/2 renders the model as drafted, costs included; the structure pass is where a person places them.",
      "card": "D20",
      "confirm": false
    },
    {
      "n": 9,
      "title": "Criticality tier from the plant graph",
      "drafts": "Alex's later drafts say the tier comes from the survey and the graph, without saying how.",
      "reading": "The tier is worked out: the higher of the type's tier and the tiers of the unit processes the equipment takes part in, never lower than the type's.",
      "why": "Safety: equipment that serves a critical unit process is never ranked below it.",
      "card": "D26",
      "confirm": false
    },
    {
      "n": 10,
      "title": "Changing a unit process's type",
      "drafts": "The structure pass lets a person change a proposed type; the drafts don't say whether that is allowed later.",
      "reading": "Only while the structure pass is open. Afterwards the action is switched off and says why.",
      "why": "A later change would re-propose every binding, which the drafts don't describe.",
      "card": "D1",
      "confirm": false
    },
    {
      "n": 11,
      "title": "Reasons for structure changes",
      "drafts": "Structure changes on a Live plant need a reason, but Alex's five override reasons are written for values.",
      "reading": "A structure change keeps the typed reason as its note, with no reason category and a one-year review. 'Not part of any unit process' is a decision, not an override.",
      "why": "Nothing changes silently, without forcing value reasons onto structure.",
      "card": "D20",
      "confirm": false
    },
    {
      "n": 12,
      "title": "'Caused by' through diagnosis",
      "drafts": "Diagnosis can attribute an Issue to a machine, and Alex's structure says which machines take part in which unit process.",
      "reading": "Attribution stays one automatic 'Caused by', with candidates from the structure first. A root cause typed to both the basin's type and a machine's type lands on the machine.",
      "why": "It is the requirement as written; the structure only narrows the candidates.",
      "card": "D16",
      "confirm": false
    },
    {
      "n": 13,
      "title": "Two version numbers",
      "drafts": "Both types and templates carry versions.",
      "reading": "A template edit raises only the template's version; a type's version moves only when the type's own fields change.",
      "why": "One place to edit each thing: each number belongs to what changed.",
      "card": "D17",
      "confirm": false
    },
    {
      "n": 14,
      "title": "Tank height on a % level sensor",
      "drafts": "Level limits are a share of tank height, but most level sensors already read 0–100 %.",
      "reading": "On a % sensor the rule resolves to the same % with the metres shown ('85% (3.4 m)'), and a gap appears where the survey has no height.",
      "why": "Configuration shows its results: the metres make the rule visible, and the gap says what is missing.",
      "card": "D18",
      "confirm": false
    },
    {
      "n": 15,
      "title": "Releasing a frozen Trigger",
      "drafts": "Frozen Triggers show 'base moved' until someone resyncs them, though one drawing says changes 'reach it after that'.",
      "reading": "Only a person's resync releases a Trigger whose terms moved; while it waits it skips every later change except a Forced one. The preview keeps 'Close it as a false alarm' as drawn.",
      "why": "Nothing changes silently: an automatic catch-up would change a Trigger with nobody looking. 'Close it as a false alarm' stays as drawn, although it nudges people to close Issues as false alarms.",
      "card": "D15",
      "confirm": false
    },
    {
      "n": 16,
      "title": "Choosing a publish kind",
      "drafts": "Downstream suggests Patch, Minor, Major or Forced, but the drafts don't say who may change the suggestion.",
      "reading": "The publisher may raise the suggested kind, never lower it. Forced is only for an Emergency or statutory change, and then it is the only choice.",
      "why": "Nothing changes silently (a value change can't go out as a silent Patch), and safety (an Emergency change is always Forced).",
      "card": "D17",
      "confirm": false
    },
    {
      "n": 17,
      "title": "Replacing a survey value",
      "drafts": "Design parameters come from the survey, a person or a calculation.",
      "reading": "A person may replace a survey value on the Details tab with a note saying why; it is not an override record.",
      "why": "One place to edit each thing: the design parameter holds the value, the note says why it differs.",
      "card": "D18",
      "confirm": false
    },
    {
      "n": 18,
      "title": "Migrated values",
      "drafts": "Legacy plant values become overrides with the reason Migrated and a 90-day review, but the drafts never date the migration.",
      "reading": "The review counts from Manesar's go-live, 1 Sep 2026, so it falls on 30 Nov 2026. Plant-only Tasks become single-use templates, with 'Keep single-use' or 'Merge into' a type.",
      "why": "Nothing changes silently: no invented reason, and a real date to review by.",
      "card": "D6",
      "confirm": false
    },
    {
      "n": 19,
      "title": "Vedanta's pH Emergency limit",
      "drafts": "Vedanta set its own pH Emergency limit where the library has none, and a value set where the library has no rule may only be Physical or Tuning.",
      "reading": "It is Physical: a pickling line upstream is how the plant is built.",
      "why": "Alex's own definition of Physical fits; it is reviewed in a year.",
      "card": "D6",
      "confirm": false
    },
    {
      "n": 20,
      "title": "A sensor fault saved as Tuning",
      "drafts": "Alex's five reasons have no path for a sensor that reads wrong.",
      "reading": "A probe fault saved as Tuning stays a limit change for 90 days; nothing sends it to a calibration instead.",
      "why": "It is the model as drafted; the cost, a wrong limit that outlives the calibration, is shown.",
      "card": "D6",
      "confirm": false
    },
    {
      "n": 21,
      "title": "Noisy on a Live plant",
      "drafts": "Noisy means more than 10 trial firings a day, yet Coverage on a Live plant still names the noisiest Trigger.",
      "reading": "On a Live plant, noisy counts Issues a day over the last 7 days, or since go-live when that is shorter.",
      "why": "A mark based on the trial could never clear once the plant is Live.",
      "card": "D21",
      "confirm": false
    },
    {
      "n": 22,
      "title": "Activating a draft on a Live plant",
      "drafts": "A draft on a Live plant is accepted and then activated, with no trial.",
      "reading": "No 'would have fired' preview when activating: the dialog says it gets no trial and lists its bands.",
      "why": "That preview belongs to a different option on card D8; v7/2 renders Alex's.",
      "card": "D8",
      "confirm": false
    },
    {
      "n": 23,
      "title": "Open Issues when a plant returns to Commissioning",
      "drafts": "After a return to Commissioning, new firings are trial firings; the drafts don't say what happens to Issues already open.",
      "reading": "Open Issues stay open and keep their reminders and escalations. Who may return a plant is shown as text, because the prototype has one user.",
      "why": "Safety: an Issue people are already working on isn't muted halfway.",
      "card": "D3",
      "confirm": false
    },
    {
      "n": 24,
      "title": "First due dates at go-live",
      "drafts": "Each maintenance Task's first due date comes 'from the last service date entered, or from the go-live date when there isn't one'.",
      "reading": "An entered date is counted from: due at that date plus the interval. With no date the Task is due on go-live day, as Alex's go-live confirmation says ('otherwise today'), which puts 51 of Vedanta's 73 scheduled Tasks on that day.",
      "why": "Read literally, as Alex's go-live confirmation puts it ('otherwise today'); an entered date can only be counted from, because a past date can't itself be the due date. Counting from go-live instead would leave go-live day quiet. Mihir to confirm.",
      "card": "D19",
      "confirm": true
    },
    {
      "n": 25,
      "title": "Counting from the publish date",
      "drafts": "A cadence change asks once whether to count from the last service or from the publish date.",
      "reading": "'Count from the publish date' may move a Task later than before, and Downstream says so.",
      "why": "Show the consequence before saving.",
      "card": "D19",
      "confirm": false
    },
    {
      "n": 26,
      "title": "Who is told, per plant",
      "drafts": "Alex draws who each severity reaches, a hooter switch and quiet hours.",
      "reading": "Per plant only the hooter is a setting; who each severity reaches is worked out from the roster, and quiet hours are not shown.",
      "why": "One place to edit each thing: people and roles are edited on the roster, so who is told follows them.",
      "card": "D13",
      "confirm": false
    },
    {
      "n": 27,
      "title": "Editing people",
      "drafts": "People are added in the console, with a phone that must be verified.",
      "reading": "People edits need no reason and each is written to Activity. The person verifies their own phone with a code (a labelled sample button stands in for them in the prototype).",
      "why": "Override reasons are for values that differ from the library, and a roster has no library value.",
      "card": "D13",
      "confirm": false
    },
    {
      "n": 28,
      "title": "Issues and Tasks tabs",
      "drafts": "Alex's plant tabs have no Issues or Tasks tab.",
      "reading": "v7/2 adds both, so the two prototypes can be compared on where Issues and Tasks land.",
      "why": "Configuration shows its results.",
      "card": null,
      "confirm": false
    },
    {
      "n": 29,
      "title": "Blind spots",
      "drafts": "Alex's Coverage has a blind-spots card that waits for diagnostics.",
      "reading": "Only Alex's placeholder sentence is shown; v7/1's worked-out blind spots are not.",
      "why": "v7/2 renders the model as drafted.",
      "card": "D2",
      "confirm": false
    },
    {
      "n": 30,
      "title": "Chips and side-rail items not built",
      "drafts": "Alex's chips include 'Learned' and 'Locked', and the side rail has Search and Access.",
      "reading": "'Learned' and 'Locked' never appear, and Search and Access aren't built, so grant expiry, 'last used' and the access review aren't shown.",
      "why": "Nothing in the prototype can set them: it has one user and nothing that learns.",
      "card": null,
      "confirm": false
    },
    {
      "n": 31,
      "title": "Criticality labels",
      "drafts": "Alex's word list gives Criticality tier A, B and C.",
      "reading": "Only A, B and C are shown; v6's Critical, Essential and Standard are dropped.",
      "why": "'Standard' is on Alex's don't-use list, and the other two have no word of Alex's.",
      "card": "D14",
      "confirm": false
    },
    {
      "n": 32,
      "title": "Where Tasks sit",
      "drafts": "Alex files Tasks on unit processes, equipment or the plant, never on a set.",
      "reading": "No option on card D7 matches exactly. v7/2 records 'one task per equipment' as the closest and adds Tasks on unit processes, and the card says so.",
      "why": "The card's options were written before unit processes were built.",
      "card": "D7",
      "confirm": false
    },
    {
      "n": 33,
      "title": "A Trigger's status and its Enabled switch",
      "drafts": "A Trigger has a status (draft, active, inactive), and its page also shows an 'Enabled' switch.",
      "reading": "One status, with 'Enabled' shown from it. Setting an active Trigger inactive on a Live plant is an override, with one of the five reasons.",
      "why": "One place to edit each thing.",
      "card": "D8",
      "confirm": false
    },
    {
      "n": 34,
      "title": "Manual and lab readings",
      "drafts": "Alex's word list counts manual and lab results as readings, and the unit-process drawing shows a manual MLSS reading with limits, an override and a Trigger. Yet limits live only in a sensor's Zones, and a hand test has no sensor.",
      "reading": "v7/2 builds card D12's first option, Alex's draft as written: a hand-test number stays in the Task record, with no limits and no prompt to report.",
      "why": "One place to edit each thing supports it, but the drawing points to limits and a Trigger on a hand test. Mihir to confirm which v7/2 should show.",
      "card": "D12",
      "confirm": true
    },
    {
      "n": 35,
      "title": "Thresholds on condition Tasks",
      "drafts": "A condition Task's 'do when' and 'done when' are tunable values, but the drafts don't say how a plant's old values move across when the library's rule changes.",
      "reading": "They take an override record like any limit. Manesar's intake-filter job keeps 42 / 38 A as two Migrated overrides against a worked-out 38.0 / 34.0 A.",
      "why": "Nothing changes silently: without the records, the blower's job would move with nobody told.",
      "card": "D25",
      "confirm": true
    },
    {
      "n": 36,
      "title": "A held Trigger after its Issue closes",
      "drafts": "The drafts say only that Triggers with open records are skipped and stay out of step 'until somebody resyncs them'.",
      "reading": "A Trigger waiting for a resync stays on its held terms for every later change except a Forced one, which reaches it at once on the forced band; its other terms still wait.",
      "why": "The drafts exempt only Triggers with open records, and safety decides the case they leave open.",
      "card": "D23",
      "confirm": true
    },
    {
      "n": 37,
      "title": "Previews during Commissioning",
      "drafts": "A limit change previews 'would have fired', and trial firings are counted over the trial.",
      "reading": "On a Commissioning plant the override preview reads 'Trial so far: would have fired n times instead of m', against the recorded trial firings; Live plants keep 'Last 7 days'.",
      "why": "A plant in its trial has no Live week to count; the trial is the evidence.",
      "card": "D24",
      "confirm": false
    },
    {
      "n": 38,
      "title": "What 'Triggers active' counts",
      "drafts": "The trial banner counts active Triggers; the drafts don't say whether a condition Task records trial firings.",
      "reading": "It counts Triggers that raise Issues. Task Triggers record no trial firings in Commissioning.",
      "why": "Scheduled Tasks wait for go-live, so counting them would swell a number that is about Issues.",
      "card": "D5",
      "confirm": false
    },
    {
      "n": 39,
      "title": "Achievements",
      "drafts": "Alex gives a Trigger a third outcome, an achievement; v6 holds three at Manesar, such as '90 days without an Emergency'.",
      "reading": "Neither prototype shows achievements.",
      "why": "Leaving them out of both keeps the comparison like for like.",
      "card": "D27",
      "confirm": false
    },
    {
      "n": 40,
      "title": "Plant types",
      "drafts": "Alex lists four plant types: STP, ETP, WTP and water accounting.",
      "reading": "The library shows the three that have plants and plant rounds in this study.",
      "why": "A type with no plant would be an empty page.",
      "card": null,
      "confirm": false
    },
    {
      "n": 41,
      "title": "Pins need a reason",
      "drafts": "The drafts list a pin as a deviation but don't say what it records.",
      "reading": "A pin needs a reason, and shows in Deviations.",
      "why": "Nothing changes silently.",
      "card": "D17",
      "confirm": false
    },
    {
      "n": 42,
      "title": "Actions on a value whose base moved",
      "drafts": "Alex's pattern for an inherited value gives a value whose base moved two actions, Keep (with a new note) and Adopt the library value, while Alex's drawing of the Deviations page shows Revert, Extend and Promote on the same row.",
      "reading": "A row whose base moved offers Keep and Adopt the library value, as the pattern says, plus Promote, which the drawing shows. Revert and Extend stay on the other rows.",
      "why": "Show the consequence before saving: Keep and Adopt name the value that moved, and Revert and Extend do not.",
      "card": "D11",
      "confirm": true
    },
    {
      "n": 43,
      "title": "'Adopt' on the don't-use list",
      "drafts": "Alex's word list bans 'adopt' for taking on a binding, yet Alex's own copy for a value whose base moved says 'Keep yours, or adopt the library value'.",
      "reading": "v7/2 keeps 'Adopt the library value' on a value whose base moved, as Alex wrote it, and never says 'adopt' for a binding, so the word check does not ban the word outright.",
      "why": "It is Alex's own copy for that one state; the ban is read as being about bindings.",
      "card": "D14",
      "confirm": true
    },
    {
      "n": 44,
      "title": "An override that ends by itself",
      "drafts": "A minor library change clears an override that now equals the library value. The drafts don't say what happens when a design parameter changes and a derived value comes to equal an override, and their list of override states has no 'Cleared' and no 'Suspended'.",
      "reading": "A derived value that comes to equal an override clears it too, and the override moves to history as 'Cleared'. A Forced change suspends the overrides on its band: kept, not applied, and back when the change is lifted. Both states are shown.",
      "why": "The same equality makes the override pointless either way, and showing both states means nothing changes silently.",
      "card": "D17",
      "confirm": true
    },
    {
      "n": 45,
      "title": "How many plants a publish reaches",
      "drafts": "Alex's publish button counts the plants that will update ('Publish v2 to 1 plant'), though a plant that overrides the value receives the new version too and shows Base moved.",
      "reading": "The button counts the plants that follow, as drawn. Downstream lists, above it, every plant that will show Base moved and every Trigger that is frozen or pinned.",
      "why": "Show the consequence before saving: Downstream names every plant a publish reaches, so the button can keep the count Alex drew.",
      "card": "D17",
      "confirm": true
    },
    {
      "n": 46,
      "title": "Constants on readings that scale with the plant",
      "drafts": "Limits on readings that scale with the plant (level, flow, pressure, motor current) should be rules over design parameters, but a rule can only resolve where the plant has that parameter.",
      "reading": "A band becomes a rule only where the type's survey asks for the parameter, such as a tank's height or a motor's rating. Elsewhere it stays a constant with the flag 'This scales with the plant. Use a design parameter?', as an agitator's motor current does.",
      "why": "Safety: a rule that could never resolve would leave the reading with no limits at all.",
      "card": "D18",
      "confirm": true
    },
    {
      "n": 47,
      "title": "Machines that are a process of their own",
      "drafts": "A unit process is a basin or reactor in the plant graph, and Alex's membership rules place blowers, pumps, dosing sets and valves in one. The drafts don't say whether a bar screen, a screw press, a filter press or an agitator is a unit process or a piece of equipment.",
      "reading": "They are equipment. No membership rule places them, so they come up unclassified until a person places them or marks them not part of any unit process.",
      "why": "Automation proposes and a person confirms: the structure pass shows each of them for a person to decide, and v7/2 applies the rules as drafted.",
      "card": "D1",
      "confirm": true
    },
    {
      "n": 48,
      "title": "Notes on an override",
      "drafts": "Alex's drafts ask for a note with a Tuning or a Regulatory or client override, and with every override for one Trigger only. They don't ask for one with Physical, Structural or Temporary.",
      "reading": "v7/2 follows that exactly: a Physical, Structural or Temporary override can be saved with no note, where v7/1 always asks why.",
      "why": "v7/2 renders the model as drafted. The reason is always recorded; the cost is an override nobody explained in words.",
      "card": "D6",
      "confirm": true
    }
  ];

  /* ── severities ──────────────────────────────────────────────────────────────────────────────────────── */
  const SEVERITIES = [
    { key: 'Decide before building further', short: 'Decide first', tone: 'bad', blurb: 'More of v7 rests on these than on any other card. Answer them first.' },
    { key: 'Shapes v7', short: 'Shapes v7', tone: 'info', blurb: 'Each one changes how v7 behaves. The card says what v7 does today and what it would take to change.' },
    { key: 'Small', short: 'Small', tone: 'muted', blurb: 'Quick calls with a low cost either way.' },
  ];
  function sevOf(d) { return SEVERITIES.find((s) => s.key === (d && d.severity)) || SEVERITIES[1]; }
  function sevRank(d) { const i = SEVERITIES.findIndex((s) => s.key === (d && d.severity)); return i < 0 ? 1 : i; }

  /* ── pure text helpers ───────────────────────────────────────────────────────────────────────────────── */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return s == null ? '' : String(s).replace(/[&<>"']/g, (c) => ESC[c]); }
  const CC = /(^|\.\s|:\s)((?:The c|C)ontract should change[^:]{0,40}:)/g;
  /* prose: a blank line starts a paragraph; "- " lines are list items; other lines are their own paragraphs */
  function prose(text, o) {
    const mark = !!(o && o.mark);
    const line = (l) => { const e = esc(l); return mark ? e.replace(CC, '$1<b class="dec-cc">$2</b>') : e; };
    return String(text == null ? '' : text).split(/\n\s*\n/).map((block) => {
      let out = ''; let items = [];
      const flush = () => { if (items.length) { out += `<ul>${items.map((x) => `<li>${line(x)}</li>`).join('')}</ul>`; items = []; } };
      block.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
        const m = l.match(/^[-•]\s+(.*)$/);
        if (m) items.push(m[1]); else { flush(); out += `<p>${line(l)}</p>`; }
      });
      flush();
      return out;
    }).join('');
  }
  const filled = (t) => t != null && String(t).trim() !== '';

  /* ── cards ───────────────────────────────────────────────────────────────────────────────────────────── */
  function list() { return Array.isArray(W.V7_DECISIONS) ? W.V7_DECISIONS : []; }
  function byId(id) { return list().find((d) => d && d.id === id) || null; }
  function recommendedIndex(d) { const i = (d && d.options || []).findIndex((o) => o && o.recommended); return i < 0 ? null : i; }
  function optionText(d, opt) {
    if (opt === 'other') return 'Something else';
    const o = d && d.options && d.options[+opt];
    return o ? o.label : '';
  }
  function optName(d, opt) { return opt === 'other' ? 'Something else' : `Option ${+opt + 1}`; }
  const ARISINGS = ['First review', 'Reviewing v7/1', 'Designing v7/2', 'Building v7/2'];
  function idNum(id) { const m = /\d+/.exec(String(id == null ? '' : id)); return m ? +m[0] : 0; }
  function isIndex(d, i) { return typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < ((d && d.options) || []).length; }
  /* the option each prototype builds: v7/1 defaults to the recommended one when the card does not say; null = none of them */
  function v71Index(d) { if (!d) return null; if (d.v71Option === undefined) return recommendedIndex(d); return isIndex(d, d.v71Option) ? d.v71Option : null; }
  function v72Index(d) { return d && isIndex(d, d.v72Option) ? d.v72Option : null; }
  /* a card that says what each prototype builds (the newer shape); older cards keep the single "What v7 does now" view */
  function hasPair(d) { return !!d && ['v71Option', 'v72Option', 'v71Short', 'v72Short', 'v72Does'].some((k) => d[k] != null && d[k] !== ''); }
  function shortOf(d) {
    if (d && filled(d.short)) return String(d.short).trim();
    const t = String((d && d.title) || '').trim().replace(/\?$/, '');
    if (t.length <= 48) return t;
    const cut = t.slice(0, 47); const sp = cut.lastIndexOf(' ');
    return (sp > 24 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, '') + '…';
  }
  function aroseOf(d) { return d && filled(d.arose) ? String(d.arose).trim() : ARISINGS[0]; }
  function isFirstReview(d) { return aroseOf(d) === ARISINGS[0]; }
  /* builds(d, '1'|'2') → what that prototype builds, in one line ('' when the card does not say) */
  function builds(d, which) {
    if (!d) return '';
    const w = which1(which);
    const s = w === '2' ? d.v72Short : d.v71Short;
    if (filled(s)) return String(s).trim();
    if (!hasPair(d)) return '';
    const i = w === '2' ? v72Index(d) : v71Index(d);
    return i == null ? '' : `${optName(d, i)}, ${d.options[i].label}`;
  }

  /* ── your call (browser storage, guarded) ────────────────────────────────────────────────────────────── */
  const KEY = 'ctl7.decisions';
  let MEM = null;
  function store() {
    if (MEM) return MEM;
    let v = null;
    try { v = JSON.parse(W.localStorage.getItem(KEY) || 'null'); } catch (e) { v = null; }
    MEM = v && v.v === 1 && v.answers && typeof v.answers === 'object' ? v : { v: 1, answers: {} };
    return MEM;
  }
  function save() { try { W.localStorage.setItem(KEY, JSON.stringify(store())); } catch (e) { /* storage off: kept for this visit only */ } }
  function validOpt(d, opt) { return opt === 'other' || (Number.isInteger(+opt) && opt !== '' && opt !== null && +opt >= 0 && +opt < (d.options || []).length); }
  function answers() { return Object.assign({}, store().answers); }
  function answerOf(id) {
    const a = store().answers[id]; const d = byId(id);
    return a && d && validOpt(d, a.opt) ? a : null;
  }
  function setAnswer(id, a) {
    const d = byId(id); if (!d) return { ok: false, error: 'No such decision.' };
    const cur = store().answers[id] || {};
    const next = { opt: a && 'opt' in a ? a.opt : cur.opt, note: a && 'note' in a ? String(a.note || '') : (cur.note || ''), at: new Date().toISOString() };
    if (next.opt !== 'other' && next.opt != null && next.opt !== '') next.opt = +next.opt;
    if (next.opt == null || next.opt === '' || !validOpt(d, next.opt)) {
      if (!next.note) { delete store().answers[id]; save(); return { ok: true, cleared: true }; }
      next.opt = null;
    }
    store().answers[id] = next; save();
    return { ok: true, answer: next };
  }
  function noteOf(id) { const a = store().answers[id]; return a && a.note ? String(a.note) : ''; }
  function clearAnswer(id) { delete store().answers[id]; save(); return { ok: true }; }
  function differs(d) { const a = answerOf(d.id); return !!a && a.opt !== recommendedIndex(d); }
  function counts() {
    const all = list(); const answered = all.filter((d) => answerOf(d.id)).length;
    return { all: all.length, answered, open: all.length - answered, differs: all.filter(differs).length, same: all.filter((d) => d && d.both === true).length };
  }
  function answersText() {
    const all = list(); const lines = []; const open = [];
    all.forEach((d) => {
      const a = answerOf(d.id); const note = noteOf(d.id).replace(/\s+/g, ' ').trim();
      if (!a && !note) { open.push(d.id); return; }
      lines.push(`${d.id} — ${d.title}: ${a ? optionText(d, a.opt) : 'no call yet'}${note ? ` (${note})` : ''}`);
    });
    if (!lines.length) return '';
    return ['My calls on the v7 decisions', ''].concat(lines, open.length ? ['', 'Not answered yet: ' + open.join(', ')] : []).join('\n');
  }
  function alexText() {
    return ['Notes for Alex from the v7 decisions', ''].concat(list().filter((d) => filled(d.tellAlex)).map((d) => `${d.id} — ${d.title}\n${d.tellAlex}`).join('\n\n')).join('\n');
  }
  /* a call made in another tab (the other prototype, a doc): drop the cached copy, then tell the page */
  const EXT = [];
  function onExternalChange(fn) {
    if (typeof fn !== 'function') return;
    EXT.push(fn);
    if (EXT.length > 1) return;
    try {
      if (typeof W.addEventListener === 'function') {
        W.addEventListener('storage', (ev) => {
          if (ev && ev.key != null && ev.key !== KEY) return;
          MEM = null;
          EXT.slice().forEach((f) => { try { f(); } catch (e) { /* one listener failing never stops the others */ } });
        });
      }
    } catch (e) { /* no window events */ }
  }

  /* ── the two prototypes, and where a link goes from this page ────────────────────────────────────────── */
  const VARIANTS = {
    '1': { name: 'v7/1', title: 'What v7/1 does (recommended approach)', what: 'the recommended approach' },
    '2': { name: 'v7/2', title: 'What v7/2 does (Alex\'s model)', what: 'Alex\'s model as drafted' },
  };
  const PAGES = ['app', 'doc', 'overview', 'challenges'];
  let DOC_PAGE = null;                                 // set by renderDoc on a page that names no V7_PAGE
  function which1(w) { return String(w) === '2' ? '2' : '1'; }
  function variant() { return which1(W.V7_VARIANT == null ? '1' : W.V7_VARIANT); }
  function pageKind() { const p = W.V7_PAGE; if (PAGES.includes(p)) return p; return DOC_PAGE || 'app'; }
  function atTop() { const p = pageKind(); return p === 'overview' || p === 'challenges'; }     // pages in site/v7/, beside 1/ and 2/
  function normRoute(route) {
    let r = route == null ? '' : String(route).trim();
    if (!r) return '';
    if (r[0] !== '#') r = '#' + (r[0] === '/' ? '' : '/') + r;
    return r;
  }
  /* hrefFor('1'|'2', '#/p/manesar/issues') → a link that works from this page */
  function hrefFor(which, route) {
    const w = which1(which); const r = normRoute(route); const p = pageKind();
    if (p === 'overview' || p === 'challenges') return `${w}/prototype.html${r}`;
    const same = w === variant();
    if (p === 'doc') return same ? `prototype.html${r}` : `../${w}/prototype.html${r}`;
    if (same) return r || '#/plants';
    return `../${w}/prototype.html${r}`;
  }
  /* a link into the other prototype opens in a named window (reused), so the two stay side by side */
  function targetFor(which) { const w = which1(which); if (atTop()) return `v7-${w}`; return w === variant() ? null : `v7-${w}`; }
  function challengesHref(id) { return (atTop() ? 'challenges.html' : '../challenges.html') + (filled(id) ? '#' + String(id).trim() : ''); }
  function docHref(which, id) {
    const w = which1(which); const h = filled(id) ? '#' + String(id).trim() : '';
    if (atTop()) return `${w}/index.html${h}`;
    if (w === variant()) return pageKind() === 'doc' ? (h || 'index.html') : `index.html${h}`;
    return `../${w}/index.html${h}`;
  }
  function readyFor(which) { return which1(which) === '1' || DEC.V72_READY === true || (variant() === '2' && !atTop()); }
  /* linksFor(d, '1'|'2') → the card's places in that prototype; ready false → show "v7/2 is in build", not a link */
  function linksFor(d, which) {
    const w = which1(which); const ready = readyFor(w);
    return ((d && d.links) || []).map((l) => {
      if (!l) return null;
      const route = w === '2' ? l.href72 : l.href;
      if (!filled(route)) return null;
      const label = w === '2' ? (filled(l.label72) ? l.label72 : l.label) : l.label;
      return { label: String(label == null ? '' : label), route: String(route), href: ready ? hrefFor(w, route) : null, target: ready ? targetFor(w) : null, ready, which: w };
    }).filter(Boolean);
  }

  /* ── where a decision shows on screen: route patterns, the router's rules ────────────────────────────── */
  function hashPath(path) {
    let s = String(path == null ? '' : path).trim().replace(/^#/, '').replace(/^\/+/, '');
    const q = s.indexOf('?'); if (q >= 0) s = s.slice(0, q);
    return s.replace(/\/+$/, '');
  }
  function segsOf(p) { return p ? p.split('/').map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } }) : []; }
  /* matchRoute('p/:plant/alert/:id', 'p/manesar/alert/a_do_at2') → true. A literal segment matches exactly, ':x' any one
     segment, ':x?' one segment or none; the query is ignored. */
  function patternSegs(pattern) { return segsOf(String(pattern == null ? '' : pattern).trim().replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '')); }
  function matchRoute(pattern, path) {
    const segs = patternSegs(pattern); const parts = Array.isArray(path) ? path : segsOf(hashPath(path));
    if (!segs.length) return false;
    const go = (i, j) => {
      if (i === segs.length) return j === parts.length;
      const s = segs[i];
      if (s[0] === ':') {
        if (j < parts.length && parts[j] !== '' && go(i + 1, j + 1)) return true;
        return /\?$/.test(s) ? go(i + 1, j) : false;
      }
      return j < parts.length && parts[j] === s && go(i + 1, j + 1);
    };
    return go(0, 0);
  }
  function isDecisionsPath(p) { return p === 'decisions' || p.indexOf('decisions/') === 0; }
  /* v7/2 keeps v7/1's paths alive as aliases that render its own page in place; `where` names only v7/2's own routes,
     so an alias is read as the page it renders: [alias pattern, page pattern, first segments that are not the alias].
     'p/:plant/review' is left out: it renders the structure pass or the bindings pass, depending on the plant. */
  const ALIASES = {
    '2': [
      ['p/:plant/alert/:id', 'p/:plant/trigger/:id'],
      ['p/:plant/library', 'p/:plant/review/bindings'],
      ['p/:plant/scada', 'p/:plant/review/structure'],
      ['p/:plant/equipment', 'p/:plant/structure'],
      ['p/:plant/differences', 'p/:plant/deviations'],
      ['differences', 'deviations'],
      ['p/:plant/eq/:id/card', 'p/:plant/eq/:id/phone'],
      ['library/:code/:tab?', 'library/eq-types/:code/:tab?', ['eq-types', 'up-types', 'templates', 'plant-types', 'conditions', 'flows', 'root-causes']],
    ],
  };
  function bindRoute(pattern, parts) {
    const segs = patternSegs(pattern); const out = {};
    if (!matchRoute(pattern, parts)) return null;
    segs.forEach((s, i) => { if (s[0] === ':' && i < parts.length) out[s.replace(/^:|\?$/g, '')] = parts[i]; });
    return out;
  }
  /* canonicalPath('2', 'p/vedanta/alert/a_3f') → 'p/vedanta/trigger/a_3f'; a path that is no alias comes back as it is */
  function canonicalParts(v, parts) {
    const as = ALIASES[which1(v)] || [];
    for (const [from, to, not] of as) {
      const b = bindRoute(from, parts);
      if (!b || (not && not.includes(b.code))) continue;
      return patternSegs(to).map((s) => (s[0] === ':' ? b[s.replace(/^:|\?$/g, '')] : s)).filter((s) => s != null);
    }
    return parts;
  }
  function canonicalPath(v, path) { return canonicalParts(v, segsOf(hashPath(path))).join('/'); }
  function markersFor(v, path) {
    const p = hashPath(path);
    if (!p || isDecisionsPath(p)) return [];
    const w = which1(v); const parts = segsOf(p); const page = canonicalParts(w, parts);
    return list().filter((d) => {
      const pats = d && d.where && typeof d.where === 'object' ? d.where[w] : null;
      return Array.isArray(pats) && pats.some((pt) => typeof pt === 'string' && (matchRoute(pt, parts) || (page !== parts && matchRoute(pt, page))));
    }).sort((a, b) => sevRank(a) - sevRank(b) || idNum(a.id) - idNum(b.id));
  }
  const MARK_OPEN = new Set();                          // strip items a reader opened (kept across re-renders), `${path}|${id}`
  /* the status word never reuses the app's issue status "Open" */
  const NO_CALL = 'No call yet';
  function markStatus(d) { const a = answerOf(d.id); return a && a.opt != null ? `Your call: ${optName(d, a.opt)}` : NO_CALL; }
  function markItem(d, key, v) {
    const k = `${key}|${d.id}`; const b1 = builds(d, '1'); const b2 = builds(d, '2');
    const lines = d.both === true && b1
      ? `<p class="dm-v"><span class="dm-vk">Same in both:</span> ${esc(b1)}</p>`
      : (b1 ? `<p class="dm-v"><span class="dm-vk dm-v1">v7/1 builds:</span> ${esc(b1)}</p>` : '') + (b2 ? `<p class="dm-v"><span class="dm-vk dm-v2">v7/2 builds:</span> ${esc(b2)}</p>` : '');
    const st = markStatus(d);
    return `<details class="dm" data-dm="${esc(k)}"${MARK_OPEN.has(k) ? ' open' : ''}>`
      + `<summary><span class="dm-id">${esc(d.id)}</span> · <span class="dm-t">${esc(shortOf(d))}</span> · <span class="dm-s${st === NO_CALL ? '' : ' dm-called'}">${esc(st)}</span></summary>`
      + `<div class="dm-b"><p class="dm-q">${esc(d.title)}</p>${lines}`
      + `<p class="dm-go"><a href="${esc(hrefFor(v, '#/decisions/' + d.id))}" aria-label="Open card ${esc(d.id)}">Open the card</a><a href="${esc(challengesHref(d.id))}" target="_blank" rel="noopener" aria-label="Read ${esc(d.id)} in the challenges doc (opens a new tab)">Read in the challenges doc</a></p></div></details>`;
  }
  /* markerHtml(variant, path) → '' or the quiet strip: up to 3 cards inline, the rest under "+n more" */
  function markerHtml(v, path) {
    const ds = markersFor(v, path);
    if (!ds.length) return '';
    const key = hashPath(path); const w = which1(v);
    const rest = ds.slice(3); const mk = `${key}|more`;
    const more = rest.length ? `<details class="dm dm-more" data-dm="${esc(mk)}"${MARK_OPEN.has(mk) ? ' open' : ''}><summary>+${rest.length} more</summary><div class="dm-list">${rest.map((d) => markItem(d, key, w)).join('')}</div></details>` : '';
    return `<aside class="dec-mark" aria-label="Decisions on this screen"><span class="dm-k">Decisions on this screen</span>${ds.slice(0, 3).map((d) => markItem(d, key, w)).join('')}${more}</aside>`;
  }

  /* ── pieces shared by the app's card pages and the document view ─────────────────────────────────────── */
  function builtChips(d, i) {
    if (!hasPair(d)) return '';
    return (v71Index(d) === i ? '<span class="dk-chip dk-b1">Built in v7/1</span>' : '') + (v72Index(d) === i ? '<span class="dk-chip dk-b2">Built in v7/2</span>' : '');
  }
  function seeHtml(d, w) {
    const ls = linksFor(d, w);
    if (!ls.length) return '';
    const k = `<span class="dk-see-k">See it in ${esc(VARIANTS[w].name)}</span>`;
    if (!ls[0].ready) return `<div class="dk-see is-wip">${k}<span class="dk-wip">${esc(VARIANTS[w].name)} is in build</span><ul>${ls.map((l) => `<li>${esc(l.label)}</li>`).join('')}</ul></div>`;
    return `<div class="dk-see">${k}<ul>${ls.map((l) => `<li><a href="${esc(l.href)}"${l.target ? ` target="${esc(l.target)}"` : ''}>${esc(l.label)}${l.target ? `<span class="dk-x"> (opens ${esc(VARIANTS[w].name)})</span>` : ''}</a></li>`).join('')}</ul></div>`;
  }
  /* twoHtml(d, {here}) → "The two prototypes": v7/1 first; here:true marks the prototype this page belongs to */
  function twoHtml(d, o) {
    if (!d) return '';
    const here = !!(o && o.here);
    const col = (w) => {
      const i = w === '1' ? v71Index(d) : v72Index(d);
      const short = w === '1' ? d.v71Short : d.v72Short;
      const does = w === '1' ? d.v7Does : d.v72Does;
      const you = here && w === variant() ? '<span class="dk-chip dk-here">You are here</span>' : '';
      const opt = hasPair(d) && i != null ? `<p class="dk-opt">Builds ${esc(optName(d, i))}: ${esc(d.options[i].label)}</p>` : '';
      const body = filled(does) ? `<div class="dk-prose">${prose(does, { mark: w === '1' })}</div>` : (w === '2' ? '<p class="dk-none">Not written yet.</p>' : '');
      return `<div class="dk-col dk-col-${w}"><div class="dk-col-h"><b>${esc(VARIANTS[w].title)}</b>${you}</div>${filled(short) ? `<p class="dk-lead">${esc(short)}</p>` : ''}${opt}${body}${seeHtml(d, w)}</div>`;
    };
    return `<div class="dk-two">${col('1')}${col('2')}</div>${d.both === true ? '<p class="dk-same">Both prototypes build the same thing here.</p>' : ''}`;
  }

  /* ── the document view (the challenges doc, the overview, a hand-off doc): read-only plus your call ─────── */
  function callDoc(d) {
    const a = answerOf(d.id);
    if (!a) return noteOf(d.id) ? '<span class="dk-chip dk-c-muted">Note only</span>' : '<span class="dd-none">No call yet</span>';
    if (a.opt === recommendedIndex(d)) return `<span class="dk-chip dk-c-ok">${esc(optName(d, a.opt))}, as recommended</span>`;
    return `<span class="dk-chip dk-c-call" title="${esc(optionText(d, a.opt))}">${esc(optName(d, a.opt))}</span>`;
  }
  function sevTag(d, short) { const s = sevOf(d); return `<span class="dd-sev dd-sev-${esc(s.tone)}"${short ? ` title="${esc(s.key)}"` : ''}>${esc(short ? s.short : s.key)}</span>`; }
  function countHtml() {
    const c = counts();
    return `${c.all} challenges · <b>${c.answered}</b> answered${c.differs ? ` · ${c.differs} differ from the recommendation` : ''}`;
  }
  function picksInner(d) {
    const a = answerOf(d.id); const cur = a ? a.opt : null; const rec = recommendedIndex(d);
    const b = (val, label, title) => `<button type="button" class="dd-pick${cur === val ? ' on' : ''}" data-dd-pick="${esc(d.id)}" data-opt="${esc(val)}" aria-pressed="${cur === val ? 'true' : 'false'}"${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</button>`;
    return '<span class="dd-k2">Your call</span>'
      + (d.options || []).map((o, i) => b(i, optName(d, i) + (i === rec ? ' (recommended)' : ''), o && o.label)).join('')
      + b('other', 'Something else', 'Say what in a note on the card in the prototype')
      + (a ? `<button type="button" class="dd-pick dd-clear" data-dd-pick="${esc(d.id)}" data-opt="">Clear</button>` : '')
      + '<span class="dd-saved">Kept in this browser and shared with both prototypes.</span>';
  }
  function docOpts(o) {
    o = o || {};
    const mode = ['challenges', 'overview', 'doc'].includes(o.mode) ? o.mode : 'challenges';
    return {
      mode, glance: o.glance !== false, cards: o.cards !== false, readings: o.readings !== false,
      here: o.here != null ? !!o.here : mode === 'doc', level: Math.min(5, Math.max(2, Math.round(+o.level) || 2)),
    };
  }
  function docGlance(x) {
    const all = list(); const H = `h${x.level}`; const paired = all.some(hasPair);
    const head = paired ? ['Card', 'Question', 'Severity', 'v7/1 builds', 'v7/2 builds', 'Your call'] : ['Card', 'Question', 'Severity', 'Recommended', 'Your call'];
    const rows = all.map((d) => {
      const id = esc(d.id); const rec = recommendedIndex(d);
      const b1 = builds(d, '1'); const b2 = d.both === true ? 'Same as v7/1' : builds(d, '2');
      const mid = paired
        ? `<td data-label="v7/1 builds">${b1 ? esc(b1) : '<span class="dd-none">—</span>'}</td><td data-label="v7/2 builds">${b2 ? esc(b2) : '<span class="dd-none">Not written yet</span>'}</td>`
        : `<td data-label="Recommended">${rec == null ? '<span class="dd-none">—</span>' : `<b>${rec + 1}.</b> ${esc(d.options[rec].label)}`}</td>`;
      return `<tr><td data-label="Card"><a class="dd-ref" href="#${id}">${id}</a></td>`
        + `<td data-label="Question"><a class="dd-qref" href="#${id}" title="${esc(d.title)}">${esc(shortOf(d))}</a>${isFirstReview(d) ? '' : `<span class="dd-arose-s">Arose: ${esc(aroseOf(d))}</span>`}</td>`
        + `<td data-label="Severity">${sevTag(d, true)}</td>${mid}<td data-label="Your call" data-dd-call="${id}">${callDoc(d)}</td></tr>`;
    }).join('');
    return `<section class="dd-glance" aria-labelledby="dd-glance-h"><${H} class="dd-gh" id="dd-glance-h">At a glance</${H}>`
      + `<p class="dd-count" data-dd-count>${countHtml()}</p>`
      + `<div class="dd-tw"><table class="dd-table"><thead><tr>${head.map((t) => `<th scope="col">${esc(t)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  const GROUP_TITLE = { 'First review': 'From the first review of Alex\'s packs', 'Reviewing v7/1': 'From reviewing v7/1', 'Designing v7/2': 'From designing v7/2', 'Building v7/2': 'From building v7/2' };
  /* each group carries an anchor the docs' contents link to: #group-first-review, #group-reviewing-v7-1, #group-designing-v7-2,
     #group-building-v7-2 */
  function groupId(a) { return 'group-' + (String(a || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'questions'); }
  function docCard(d, x) {
    const H = `h${x.level + 1}`; const id = esc(d.id); const rec = recommendedIndex(d); const v = variant();
    const opts = (d.options || []).map((o, i) => `<li class="dd-opt${i === rec ? ' is-rec' : ''}"><div class="dd-opt-h"><span class="dd-on">${esc(optName(d, i))}</span><b>${esc(o && o.label)}</b>${i === rec ? '<span class="dk-chip dk-rec">Recommended</span>' : ''}${builtChips(d, i)}</div>${o && filled(o.consequence) ? `<p>${esc(o.consequence)}</p>` : ''}</li>`).join('');
    const bg = [['What Alex\'s pack says', d.alexSays], ['What v6 does today', d.v6Today], ['Mihir\'s earlier direction', d.mihirsDirection], ['What to tell Alex', d.tellAlex]]
      .filter(([, t]) => filled(t))
      .map(([t, text]) => `<details class="dd-fold"><summary>${esc(t)}</summary><div class="dk-prose${t === 'What to tell Alex' ? ' dd-quote' : ''}">${prose(text)}</div></details>`).join('');
    const tg = targetFor(v);
    return `<section class="dd-card" id="${id}" aria-labelledby="${id}-q">`
      + `<div class="dd-meta"><span class="dd-id">${id}</span><span class="dd-short">${esc(shortOf(d))}</span>${sevTag(d)}<span class="dd-arose">Arose: ${esc(aroseOf(d))}</span><span class="dd-mycall">Your call: <span data-dd-call="${id}">${callDoc(d)}</span></span></div>`
      + `<${H} class="dd-q" id="${id}-q">${esc(d.title)}</${H}>`
      + (filled(d.recommendation) ? `<div class="dd-rec"><span class="dd-k">Recommendation</span><div class="dk-prose">${prose(d.recommendation)}</div></div>` : '')
      + `<span class="dd-k">The two prototypes</span>${twoHtml(d, { here: x.here })}`
      + `<span class="dd-k">Options</span><ol class="dd-opts">${opts}</ol>`
      + `<div class="dd-picks" data-dd-picks="${id}" role="group" aria-label="Your call on ${id}">${picksInner(d)}</div>`
      + (bg ? `<div class="dd-bg"><span class="dd-k">Background</span>${bg}</div>` : '')
      + `<p class="dd-go"><a href="${esc(hrefFor(v, '#/decisions/' + d.id))}"${tg ? ` target="${esc(tg)}"` : ''}>Add a note on this card in ${esc(VARIANTS[v].name)}<span aria-hidden="true"> →</span></a></p>`
      + '</section>';
  }
  function docCards(x) {
    const all = list(); const H = `h${x.level}`;
    const order = ARISINGS.concat(all.map(aroseOf)).filter((a, i, arr) => arr.indexOf(a) === i);
    const groups = order.map((a) => ({ a, ds: all.filter((d) => aroseOf(d) === a) })).filter((g) => g.ds.length);
    if (groups.length <= 1) return `<div class="dd-group" id="group-questions"><${H} class="dd-gh">The questions · ${all.length}</${H}>${all.map((d) => docCard(d, x)).join('')}</div>`;
    return groups.map((g) => `<div class="dd-group" id="${esc(groupId(g.a))}"><${H} class="dd-gh">${esc(GROUP_TITLE[g.a] || g.a)} · ${g.ds.length}</${H}>${g.ds.map((d) => docCard(d, x)).join('')}</div>`).join('');
  }
  function readings() { return Array.isArray(W.V7_READINGS) ? W.V7_READINGS.filter((r) => r && typeof r === 'object') : []; }
  function docReadings(x) {
    const rs = readings(); if (!rs.length) return '';
    const H = `h${x.level}`; const H3 = `h${x.level + 1}`; const n = rs.filter((r) => r.confirm === true).length;
    const items = rs.map((r, i) => {
      const num = r.n != null && filled(r.n) ? String(r.n) : String(i + 1);
      const c = filled(r.card) ? byId(String(r.card).trim()) : null;
      const card = c ? `<p class="dd-rcard">Decided on card <a class="dd-ref" href="#${esc(c.id)}">${esc(c.id)}</a> · ${esc(shortOf(c))}</p>` : (filled(r.card) ? `<p class="dd-rcard">Card ${esc(r.card)}</p>` : '');
      const dl = [['What the drafts say', r.drafts], ['The reading v7/2 takes', r.reading], ['Why this reading', r.why]].filter(([, t]) => filled(t)).map(([k, t]) => `<dt>${esc(k)}</dt><dd>${prose(t)}</dd>`).join('');
      return `<li class="dd-reading${r.confirm === true ? ' to-confirm' : ''}" id="reading-${esc(num.replace(/[^\w-]/g, ''))}"><div class="dd-rh"><span class="dd-rn">${esc(num)}</span><${H3}>${esc(r.title || '')}</${H3}>${r.confirm === true ? '<span class="dk-chip dk-confirm">Mihir to confirm</span>' : ''}</div>${dl ? `<dl class="dd-rdl">${dl}</dl>` : ''}${card}</li>`;
    }).join('');
    return `<section class="dd-readings" id="readings" aria-labelledby="readings-h"><${H} class="dd-gh" id="readings-h">Readings v7/2 takes where Alex's drafts are silent · ${rs.length}</${H}>`
      + `<p class="dd-lede">v7/2 builds Alex's model as drafted. Where the drafts say nothing, or say two different things, v7/2 has to pick one reading to build. Each one is here in plain words${n ? `; ${n === 1 ? 'one needs' : n + ' need'} Mihir to confirm` : ''}.</p>`
      + `<ol class="dd-rl">${items}</ol></section>`;
  }
  function docHtml(o) {
    const x = docOpts(o);
    return `<div class="dd" data-dd-mode="${esc(x.mode)}">${x.glance ? docGlance(x) : ''}${x.cards ? docCards(x) : ''}${x.readings ? docReadings(x) : ''}</div>`;
  }
  const each = (nodes, fn) => { for (let i = 0; nodes && i < nodes.length; i++) fn(nodes[i]); };
  function refreshDoc(root, id) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const ds = id ? [byId(id)].filter(Boolean) : list();
    ds.forEach((d) => {
      if (!/^[\w-]+$/.test(String(d.id))) return;
      each(root.querySelectorAll(`[data-dd-call="${d.id}"]`), (n) => { n.innerHTML = callDoc(d); });
      each(root.querySelectorAll(`[data-dd-picks="${d.id}"]`), (n) => { n.innerHTML = picksInner(d); });
    });
    each(root.querySelectorAll('[data-dd-count]'), (n) => { n.innerHTML = countHtml(); });
  }
  function onDocClick(root, ev) {
    const t = ev && ev.target;
    const btn = t && typeof t.closest === 'function' ? t.closest('[data-dd-pick]') : null;
    if (!btn || typeof btn.getAttribute !== 'function') return;
    const id = btn.getAttribute('data-dd-pick'); const d = byId(id); if (!d) return;
    const raw = btn.getAttribute('data-opt'); const a = answerOf(id);
    const opt = raw === 'other' ? 'other' : raw === '' || raw == null ? '' : +raw;
    if (opt === '' || (a && a.opt === opt)) setAnswer(id, { opt: '' });      // Clear, or a second click on the call: the note stays
    else setAnswer(id, { opt });
    refreshDoc(root, id);
  }
  function bindDoc(root) {
    if (!root || root.__ddBound || typeof root.addEventListener !== 'function') return;
    root.__ddBound = true;
    root.addEventListener('click', (ev) => onDocClick(root, ev));
    onExternalChange(() => refreshDoc(root));
  }
  function elOf(x) {
    if (!x) return null;
    if (typeof x !== 'string') return x;
    try { return typeof document !== 'undefined' && document && typeof document.getElementById === 'function' ? document.getElementById(x) : null; } catch (e) { return null; }
  }
  /* the stylesheet sits next to this file; a doc that did not link it gets it added */
  const CSS_V = 3;
  const BASE = (() => {
    try {
      const s = typeof document !== 'undefined' && document ? document.currentScript : null;
      const src = s && typeof s.getAttribute === 'function' ? String(s.getAttribute('src') || '').split('?')[0] : '';
      if (src) return src.slice(0, src.lastIndexOf('/') + 1);
    } catch (e) { /* no DOM */ }
    return 'assets/';
  })();
  function ensureCss() {
    try {
      if (typeof document === 'undefined' || !document || !document.head || typeof document.querySelectorAll !== 'function' || typeof document.createElement !== 'function') return;
      const ls = document.querySelectorAll('link[rel="stylesheet"]');
      for (let i = 0; i < ls.length; i++) if (/decisions7\.css/.test(String(ls[i].getAttribute('href') || ''))) return;
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `${BASE}decisions7.css?v=${CSS_V}`; document.head.appendChild(l);
    } catch (e) { /* the page keeps its own look */ }
  }
  function deepLink() {
    try {
      const h = W.location ? String(W.location.hash || '') : '';
      if (!/^#[A-Za-z][\w-]*$/.test(h) || typeof document === 'undefined' || !document || typeof document.getElementById !== 'function') return;
      const t = document.getElementById(h.slice(1)); if (t && typeof t.scrollIntoView === 'function') t.scrollIntoView();
    } catch (e) { /* stay at the top */ }
  }
  /* renderDoc(el | id, {mode}) fills one element; renderDoc({glance, cards, readings, mode}) fills up to three (ids or elements) */
  function renderDoc(target, o) {
    const slots = target && typeof target === 'object' && !('innerHTML' in target) && (target.glance || target.cards || target.readings) ? target : null;
    const x = docOpts(slots || o);
    if (!W.V7UI && !PAGES.includes(W.V7_PAGE)) DOC_PAGE = x.mode;
    ensureCss();
    if (slots) {
      const out = { glance: docGlance(x), cards: docCards(x), readings: docReadings(x) };
      Object.keys(out).forEach((k) => {
        const el = elOf(slots[k]); if (!el) return;
        el.innerHTML = `<div class="dd" data-dd-mode="${esc(x.mode)}">${out[k]}</div>`; bindDoc(el);
      });
      deepLink();
      return out;
    }
    const html = docHtml(x); const el = elOf(target);
    if (el) { el.innerHTML = html; bindDoc(el); deepLink(); }
    return html;
  }

  const DEC = W.V7DEC = {
    list, byId, SEVERITIES, sevOf, esc, prose, recommendedIndex, optionText,
    answers, answerOf, noteOf, setAnswer, clearAnswer, differs, counts, answersText, alexText, KEY, onExternalChange,
    VARIANTS, ARISINGS, variant, page: pageKind, V72_READY: true, PUBLIC: !list().some((d) => d && Array.isArray(d.ids) && d.ids.length),
    v71Index, v72Index, hasPair, shortOf, aroseOf, builds, hrefFor, targetFor, challengesHref, docHref, linksFor,
    matchRoute, canonicalPath, markersFor, markerHtml, twoHtml, docHtml, renderDoc, cssBase: () => BASE,
    render: { list: () => '', detail: () => '' },
  };

  /* strip items keep their open state across re-renders (toggle events do not bubble; capture them) */
  try {
    if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
      document.addEventListener('toggle', (ev) => {
        const t = ev && ev.target;
        if (!t || !t.matches || !t.matches('details.dm[data-dm]')) return;
        const k = t.getAttribute('data-dm');
        if (t.open) MARK_OPEN.add(k); else MARK_OPEN.delete(k);
      }, true);
    }
  } catch (e) { /* no DOM */ }

  /* ── the app's views (only when the prototype shell is loaded) ───────────────────────────────────────── */
  const UI = W.V7UI;
  if (!UI || typeof UI.route !== 'function') return;

  const OPEN = new Set();          // cards open on the list page (kept across re-renders)
  const JUST = new Set();          // answered while a filter was on: stay visible until the filter changes
  let LAST_SHOW = null;
  const SHOWS = { open: 'Not answered yet', answered: 'Answered', differs: 'Differs from the recommendation' };

  function callChip(d) {
    const a = answerOf(d.id);
    if (!a) return UI.chip(noteOf(d.id) ? 'Note only' : 'Not answered', { tone: 'muted' });
    const rec = recommendedIndex(d);
    if (a.opt === rec) return UI.chip(`Your call: ${optName(d, a.opt)}, as recommended`, { tone: 'ok' });
    return UI.chip(`Your call: ${optName(d, a.opt)}`, { tone: 'info', title: optionText(d, a.opt) });
  }
  function sevChip(d) { const s = sevOf(d); return UI.chip(s.key, { tone: s.tone }); }

  function optionsHtml(d) {
    const a = answerOf(d.id); const rec = recommendedIndex(d); const name = `dec-${d.id}`;
    const row = (val, i, label, sub, isRec) => {
      const on = a && a.opt === val;
      return `<label class="radio dec-opt${isRec ? ' is-rec' : ''}${on ? ' on' : ''}"><input type="radio" id="${esc(`dec-${d.id}-o${i}`)}" name="${esc(name)}" value="${esc(val)}"${on ? ' checked' : ''} data-act="dec:pick" data-id="${esc(d.id)}">`
        + `<span><b><span class="dec-on">${esc(i === 'x' ? 'Other' : `Option ${i + 1}`)}</span> ${esc(label)}${isRec ? ' <span class="chip chip-ok dec-recchip">Recommended</span>' : ''}${i === 'x' ? '' : builtChips(d, i)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></label>`;
    };
    const opts = (d.options || []).map((o, i) => row(i, i, o.label, o.consequence, i === rec)).join('')
      + row('other', 'x', 'Something else: say what in the note', '', false);
    const note = noteOf(d.id);
    return `<div class="radios dec-opts" role="radiogroup" aria-label="Your call on ${esc(d.id)}">${opts}</div>`
      + `<div class="dec-note"><label class="field-l" for="dec-note-${esc(d.id)}">Note <span class="muted">(optional, copied with your answer)</span></label>`
      + `<textarea id="dec-note-${esc(d.id)}" rows="2" data-act="dec:note" data-live data-id="${esc(d.id)}" placeholder="A condition, a question back, or what you would do instead">${esc(note)}</textarea></div>`
      + (a || note ? `<div class="dec-clear">${UI.btn('Clear my call', { act: 'dec:clear', data: { id: d.id }, kind: 'ghost', small: true })}</div>` : '');
  }

  function linksHtml(d) {
    const ls = (d.links || []).filter((l) => l && l.href);
    if (!ls.length) return '';
    return `<div class="dec-links">${ls.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}<span aria-hidden="true"> →</span></a>`).join('')}</div>`;
  }

  function fold(title, inner, open, extra) {
    return `<details class="dec-fold"${open ? ' open' : ''}><summary>${esc(title)}${extra || ''}</summary><div class="dec-fold-b">${inner}</div></details>`;
  }
  function chalLink(d) { return `<a class="dec-chal" href="${esc(challengesHref(d ? d.id : ''))}" target="_blank" rel="noopener" title="The challenges doc opens in a new tab">Read in the challenges doc<span aria-hidden="true"> ↗</span></a>`; }

  function bodyHtml(d, o) {
    const detail = !!(o && o.detail);
    const h = (t) => `<h3 class="dec-h">${esc(t)}</h3>`;
    const background = [['What Alex\'s pack says', d.alexSays], ['What v6 does today', d.v6Today], ['Mihir\'s earlier direction', d.mihirsDirection]]
      .filter(([, t]) => filled(t)).map(([t, text]) => fold(t, `<div class="dec-prose">${prose(text)}</div>`, detail)).join('')
      + (filled(d.tellAlex) ? fold('What to tell Alex', `<div class="dec-prose dec-quote">${prose(d.tellAlex)}</div><div class="dec-copy1">${UI.btn('Copy this note', { act: 'dec:copyone', data: { id: d.id }, kind: 'ghost', small: true })}</div>`, detail) : '');
    const meta = `<p class="dec-meta">${isFirstReview(d) ? '' : `<span class="dec-arose">Arose: ${esc(aroseOf(d))}</span>`}${chalLink(d)}</p>`;
    const now = hasPair(d)
      ? `${h('The two prototypes')}${twoHtml(d, { here: true })}`
      : `${h('What v7 does now')}<div class="dec-now dec-prose">${prose(d.v7Does, { mark: true })}</div>` + (linksHtml(d) ? `${h('See it in the prototype')}${linksHtml(d)}` : '');
    return meta
      + (filled(d.recommendation) ? `<div class="dec-rec">${h('Recommendation')}<div class="dec-prose">${prose(d.recommendation)}</div></div>` : '')
      + `${h('Your call')}${optionsHtml(d)}`
      + now
      + (background ? `${h('Background')}<div class="dec-bg">${background}</div>` : '');
  }

  /* the closed card's second line names what the other prototype builds */
  function otherLine(d) {
    if (!hasPair(d)) return '';
    const v = variant(); const other = v === '2' ? '1' : '2';
    if (d.both === true) return `${VARIANTS[other].name}: same as ${VARIANTS[v].name}`;
    const i = other === '2' ? v72Index(d) : v71Index(d);
    return i == null ? '' : `${VARIANTS[other].name}: ${optName(d, i)}, ${d.options[i].label}`;
  }
  function cardHtml(d) {
    const rec = recommendedIndex(d); const open = OPEN.has(d.id);
    const recLine = rec != null ? `Recommended: ${optName(d, rec)}, ${d.options[rec].label}` : '';
    const other = otherLine(d);
    return `<details class="dec" id="dec-${esc(d.id)}" data-dec="${esc(d.id)}"${open ? ' open' : ''}>`
      + `<summary><span class="dec-id">${esc(d.id)}</span><span class="dec-q">${esc(d.title)}</span><span class="dec-call" data-dec-call="${esc(d.id)}">${callChip(d)}</span>`
      + (recLine ? `<span class="dec-rec1">${esc(recLine)}</span>` : '') + (other ? `<span class="dec-rec1 dec-other">${esc(other)}</span>` : '') + '</summary>'
      + `<div class="dec-body">${bodyHtml(d)}<p class="dec-perma"><a href="#/decisions/${esc(d.id)}">Open ${esc(d.id)} on its own page</a></p></div></details>`;
  }

  function listPage(params) {
    const q = (params && params._q) || {};
    const show = SHOWS[q.show] ? q.show : 'all';
    if (show !== LAST_SHOW) { JUST.clear(); LAST_SHOW = show; }
    const all = list(); const c = counts();
    const keep = (d) => show === 'all' || JUST.has(d.id)
      || (show === 'open' && !answerOf(d.id)) || (show === 'answered' && !!answerOf(d.id)) || (show === 'differs' && differs(d));
    const filters = UI.filters([
      { label: 'All', href: '#/decisions', on: show === 'all', count: c.all },
      { label: SHOWS.open, href: '#/decisions?show=open', on: show === 'open', count: c.open },
      { label: SHOWS.answered, href: '#/decisions?show=answered', on: show === 'answered', count: c.answered },
      { label: SHOWS.differs, href: '#/decisions?show=differs', on: show === 'differs', count: c.differs },
    ]);
    const groups = SEVERITIES.map((s) => {
      const ds = all.filter((d) => d.severity === s.key && keep(d));
      if (!ds.length) return '';
      const n = all.filter((d) => d.severity === s.key).length;
      return UI.section(`${s.key} · ${n}`, `<div class="dec-list">${ds.map(cardHtml).join('')}</div>`, { sub: s.blurb, cls: 'dec-sec dec-sev-' + s.tone });
    }).join('');
    const none = show !== 'all' && !groups ? UI.empty(show === 'open' ? 'Every decision has your call. Copy your answers to send them.' : 'No decision matches this filter yet.', UI.btn('Show all decisions', { href: '#/decisions' })) : '';
    const progress = `<div class="dec-progress">${UI.progress(c.answered, c.all)}<span><b>${c.answered}</b> of ${c.all} answered${c.differs ? ` · ${c.differs} differ from the recommendation` : ''}</span></div>`;
    const tools = `<div class="dec-tools">${UI.btn('Open all', { act: 'dec:openall', kind: 'ghost', small: true })}${UI.btn('Close all', { act: 'dec:closeall', kind: 'ghost', small: true })}</div>`;
    const intro = `<p class="dec-intro">Each card is one question v7 raises for Mihir: what Alex's pack says, what v6 does, the options with their consequences, a recommendation, and what this prototype does today. Pick your call on each card; it is kept in this browser. Then copy your answers to send them. Calls about the study itself are answered and copied in the challenges doc. ${chalLink(null)}</p>`;
    const v = variant(); const o = v === '2' ? '1' : '2';
    const sub = all.some(hasPair)
      ? `${c.all} questions for Mihir. Each card says what this prototype (${VARIANTS[v].name}, ${v === '1' ? 'the recommended approach' : 'Alex\'s model'}) does and what ${VARIANTS[o].name} (${o === '1' ? 'the recommended approach' : 'Alex\'s model'}) does, with links to both. Your calls are shared with ${VARIANTS[o].name} in this browser.`
      : `${c.all} questions for Mihir, with a recommendation and what v7 does now.`;
    return UI.page({
      title: 'Decisions',
      sub,
      chips: [],
      actions: [UI.btn('Copy my answers', { act: 'dec:copy', kind: 'primary', disabled: !answersText(), title: answersText() ? 'Copy a plain-text list of your calls' : 'Pick your call on at least one card first' }), list().some((d) => filled(d.tellAlex)) ? UI.btn('Copy the notes for Alex', { act: 'dec:copyalex' }) : ''],
      body: `${intro}<div class="dec-top">${progress}${filters}${tools}</div>${groups}${none}`,
      cls: 'pg-decisions',
    });
  }

  function detailPage(params) {
    const id = params && params.id; const d = byId(id); const all = list();
    if (!d) {
      return UI.page({ crumbs: [{ label: 'Decisions', href: '#/decisions' }, { label: String(id || '') }], title: 'No such decision', cls: 'pg-decisions',
        body: UI.empty(`There is no decision called ${id}. The cards run from ${all[0] ? all[0].id : 'D1'} to ${all.length ? all[all.length - 1].id : 'D21'}.`, UI.btn('All decisions', { href: '#/decisions' })) });
    }
    const i = all.indexOf(d); const prev = all[i - 1]; const next = all[i + 1];
    const nav = `<nav class="dec-nav" aria-label="Other decisions">${prev ? `<a href="#/decisions/${esc(prev.id)}" title="${esc(prev.title)}">← ${esc(prev.id)}</a>` : '<span></span>'}<a href="#/decisions">All decisions</a>${next ? `<a href="#/decisions/${esc(next.id)}" title="${esc(next.title)}">${esc(next.id)} →</a>` : '<span></span>'}</nav>`;
    return UI.page({
      crumbs: [{ label: 'Decisions', href: '#/decisions' }, { label: d.id }],
      title: d.title,
      chips: [UI.chip(d.id, { tone: 'muted', mono: true }), sevChip(d), `<span data-dec-call="${esc(d.id)}">${callChip(d)}</span>`],
      actions: [UI.btn('Copy my answers', { act: 'dec:copy', kind: 'ghost', disabled: !answersText() })],
      body: `<div class="dec-single">${bodyHtml(d, { detail: true })}</div>${nav}`,
      cls: 'pg-decisions pg-decision',
    });
  }

  W.V7DEC.render = { list: listPage, detail: detailPage };
  UI.route('decisions', listPage);
  UI.route('decisions/:id', detailPage);

  /* ── actions ─────────────────────────────────────────────────────────────────────────────────────────── */
  const idOf = (el) => (el && el.getAttribute ? el.getAttribute('data-id') : null);
  function copyOut(text, done, title) {
    const fallback = () => {
      UI.modal({
        title: title || 'Copy the text',
        sub: 'Copying is blocked in this browser. Select the text below and copy it (Ctrl+C or ⌘C).',
        body: `<textarea class="dec-copybox" readonly rows="14">${esc(text)}</textarea>`,
        foot: UI.btn('Done', { act: 'ui:close', data: { what: 'modal' }, kind: 'primary' }),
        onBind: (el) => { const ta = el && el.querySelector ? el.querySelector('textarea') : null; if (ta) { try { ta.focus(); ta.select(); } catch (e) { /* ignore */ } } },
      });
    };
    let p = null;
    try { p = UI.copy(text); } catch (e) { p = null; }
    if (p && typeof p.then === 'function') p.then((ok) => { if (ok) UI.toast(done); else fallback(); }, fallback);
    else fallback();
  }
  UI.on('dec:pick', (el) => {
    const id = idOf(el); const d = byId(id); if (!d) return false;
    const r = setAnswer(id, { opt: el.value });
    if (!r.ok) { UI.toast(r.error); return false; }
    JUST.add(id); OPEN.add(id);
    const a = answerOf(id);
    UI.toast(a && a.opt != null ? `${id}: your call is ${optName(d, a.opt)}${a.opt === recommendedIndex(d) ? ', the recommended option' : ''}. Kept in this browser.` : `${id}: call cleared.`);
    return undefined;                                    // re-render: counts, chips and filters update together
  });
  UI.on('dec:note', (el) => {                            // typing never re-renders; a note alone is enough to copy
    const id = idOf(el); if (!byId(id)) return false;
    setAnswer(id, { note: el.value });
    try { const ok = !!answersText(); document.querySelectorAll('[data-act="dec:copy"]').forEach((b) => { b.disabled = !ok; if (ok) { b.removeAttribute('aria-disabled'); b.title = 'Copy a plain-text list of your calls'; } else b.setAttribute('aria-disabled', 'true'); }); } catch (e) { /* the next render updates it */ }
    return false;
  });
  UI.on('dec:clear', (el) => { const id = idOf(el); if (!byId(id)) return false; clearAnswer(id); OPEN.add(id); UI.toast(`${id}: your call and note are cleared.`); return undefined; });
  UI.on('dec:copy', () => {
    const text = answersText();
    if (!text) { UI.toast('Pick your call on at least one card first.'); return false; }
    const n = counts().answered;
    copyOut(text, `Copied your calls on ${n} decision${n === 1 ? '' : 's'}. Paste them into a message to send.`, 'Copy your answers');
    return false;
  });
  UI.on('dec:copyalex', () => { copyOut(alexText(), `Copied the notes for Alex from all ${list().length} decisions.`, 'Copy the notes for Alex'); return false; });
  UI.on('dec:copyone', (el) => { const d = byId(idOf(el)); if (!d) return false; copyOut(`${d.id} — ${d.title}\n${d.tellAlex}`, `Copied the note for Alex on ${d.id}.`, `Copy the note for Alex on ${d.id}`); return false; });
  UI.on('dec:openall', () => { list().forEach((d) => OPEN.add(d.id)); return undefined; });
  UI.on('dec:closeall', () => { OPEN.clear(); return undefined; });
  /* a call made in the other prototype's tab shows here on the next render */
  onExternalChange(() => { try { UI.render(); } catch (e) { /* the next navigation renders it */ } });

  /* remember which cards are open, so a re-render keeps them open (toggle events do not bubble; capture them) */
  try {
    if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
      document.addEventListener('toggle', (ev) => {
        const t = ev && ev.target;
        if (!t || !t.matches || !t.matches('details.dec[data-dec]')) return;
        const id = t.getAttribute('data-dec');
        if (t.open) OPEN.add(id); else OPEN.delete(id);
      }, true);
    }
  } catch (e) { /* no DOM */ }
  if (typeof UI.addCss === 'function') UI.addCss(`${BASE}decisions7.css?v=${CSS_V}`);
}());
