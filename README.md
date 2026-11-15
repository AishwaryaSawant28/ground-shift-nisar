# GROUND SHIFT — The Sinking City Mystery

A self-contained browser investigation built around NASA's published NISAR-derived Mexico City subsidence map (PIA26709, Figure A). Four linked missions teach how repeat radar observations reveal ground motion, how to separate signal from noise, and what the evidence can — and cannot — prove.

Built for the NASA Space Apps Challenge, "Dancing with the SARs". HTML, CSS and vanilla JavaScript only. No build step, backend, login, API key or network connection is required.

## Launch

1. Keep these four files in one folder:
   - `GROUND_SHIFT_space_mission.html`
   - `groundshift.css`
   - `groundshift.js`
   - `PIA26709_figA.png`
2. Open `GROUND_SHIFT_space_mission.html` in Chrome or Edge (double-click works; `file://` is supported).

Optional local server (not required):

```bash
cd path/to/folder
python -m http.server 8000
# then open http://localhost:8000/GROUND_SHIFT_space_mission.html
```

No installation, package manager or internet connection is needed. The NASA image is loaded from the local file, not a remote URL.

## Controls

- **Mouse / touch:** click map locations, drag to pan, use `+` / `−` / reset to zoom, drag patches, select answers, arrange the causal chain.
- **Keyboard (Mission 1 map):** focus the map, use arrow keys to move the probe (Shift for fine steps), Enter or Space to probe, Home to recentre.
- **Tab / Enter / Space:** all menus, settings, choices, archive rows and NOVA controls.
- **Esc:** return to the main menu from an investigation; closes the mobile NOVA panel first.
- **NOVA:** desktop panel on the right; on narrow screens the NOVA button opens a full-screen companion panel.

## Files

| File | Purpose |
| --- | --- |
| `GROUND_SHIFT_space_mission.html` | Entry point, all screens, attribution and disclosure |
| `groundshift.css` | Visual system, layouts, animation, responsive and print styles |
| `groundshift.js` | Game state, four missions, InSAR canvas, NOVA knowledge base, report |
| `PIA26709_figA.png` | Original NASA figure, included unmodified (1463 × 1556) |
| `.qa/` | Development-only browser test scripts and screenshots; not needed to play |

## Game structure

1. **Detect the Movement** — inspect the published deformation map, probe the two large dark-blue subsidence masses, read coordinates and answer a limits-of-evidence question.
2. **Decode the Radar** — step through three repeat acquisitions and see how phase differences build an interferogram; distinguish the schematic from real NISAR processing.
3. **Signal or Noise?** — review five map patches and classify them using NASA's note that yellow and red areas are likely residual noise in this preliminary product.
4. **Solve the Mystery** — order the causal chain from groundwater extraction through compaction to surface deformation and infrastructure strain, then answer synthesis questions.

Each mission has explicit instructions, live feedback, hints, explanations, a completion panel and a "next mission" path. Closed missions can be reopened from the Mission Archive (status shown as **Replay**).

## Scoring and progress

- Correct answers and completed interactions award Science XP once per mission. The completion bonus is 100 XP; replaying a closed mission does not farm repeat XP.
- Wrong answers and hints reduce **Credibility**; correct answers restore part of it. Credibility is a game device, not a scientific confidence metric.
- The HUD tracks XP, credibility and `missions / 4`; the archive records best XP per mission.
- A final report unlocks after Mission 4 with rank, evidence-review status, findings, method notes, limitations and a printable layout.
- XP, credibility, mission completions and preferences are saved in `localStorage` under `groundshift.case.v1`. NOVA's conversation is session-only and restarts with the page. Settings → **Reset case** clears the saved case and the current NOVA log after confirmation.

## NOVA — honest fallback assistant

NOVA is a **curated, keyword-matched knowledge base written for this case**, not a live generative AI model. It calls no external service and requires no API key. Answers are limited to the published NASA result, general InSAR education and explicit uncertainty/ethics statements. Unmatched questions return a disclosure that nothing was invented rather than a fabricated answer. The disclosure appears in the NOVA panel footer and in Settings.

## Science and data references

- **Primary source and image:** NASA Science Photojournal, [“US-Indian Spacecraft Captures Mexico City Subsidence”](https://science.nasa.gov/photojournal/us-indian-spacecraft-captures-mexico-city-subsidence/), PIA26709, Figure A. Observation window 25 October 2025 – 17 January 2026; areas sinking more than 2 cm per month; yellow and red areas flagged as likely residual noise in this preliminary product.
- **Mission context:** NASA–ISRO NISAR, [nisar.jpl.nasa.gov](https://nisar.jpl.nasa.gov/). NISAR is a joint NASA–ISRO mission; its L-band SAR is designed to measure subtle surface deformation.
- The game uses the **published, processed visualisation** as evidence. It does not process raw NISAR data, does not show a live map and does not measure deformation itself. In-game radar schematics are labelled illustrations.
- Cause-and-effect discussion distinguishes observation (surface motion) from interpretation (groundwater extraction and compaction of former lakebed sediments). The game does not certify any building as safe or unsafe.

The NASA image is reproduced unmodified with source attribution. No ownership of the original data or imagery is claimed.

## Accessibility and responsiveness

- Responsive layouts tested at 1440 × 900 desktop and 390 × 844 mobile; no horizontal overflow.
- Keyboard-operable navigation, choices and map probing; visible focus states; ARIA labels, `aria-expanded` on the mobile NOVA toggle, live regions for the log and toasts.
- Settings for motion (also honours `prefers-reduced-motion`), sound and text size. Sound is off by default; reset clears preferences.
- Texture and decorative canvases are hidden from assistive technology. Print styles are included for the final report.

## Test report (performed in this build)

Tested in Chrome via the DevTools Protocol against the local `file://` page, with real clicks/pointer events and DOM assertions.

| Area | Result |
| --- | --- |
| JavaScript syntax | `node --check groundshift.js` passes |
| Load and console | All screens boot; **no runtime exceptions or console errors** during full desktop and mobile runs |
| Image | `PIA26709_figA.png` loads locally at 1463 × 1556 |
| Mission 1 | Both map probes register in sequence, two markers appear, question renders and mission closes; keyboard arrow + Enter probing also finds the northern zone |
| Mission 2 | All three InSAR passes advance, canvas renders at 455 × 256, both questions answerable, mission closes |
| Mission 3 | All 5 patches inspected/reviewed, crops render dark-blue centres for the subsidence patches, wrap-up question and close |
| Mission 4 | All 5 chain slots filled, validation enables, synthesis questions answerable, report unlocks |
| Full run | 4/4 missions, **1020 XP**, **100% credibility**, rank **Lead investigator**, 4 findings in report |
| NOVA | Greeting, live/colour/building questions return grounded answers; disclosure visible; mobile panel opens at 390 × 844 with readable message content |
| Scoring feedback | A wrong answer drops credibility to 95%; a hint drops it to 92% and shows corrective feedback |
| Persistence | Edited progress (145 XP, 88%) survives a page reload and appears in HUD and menu |
| Reset | Confirmed reset returns 0/4, 100% credibility and default text/motion/sound settings |
| Navigation | Menu, archive, science lab, settings, mission rail, next-mission buttons, report, replay and Esc all function |
| Responsive | Menu, game shell, map, mission 3, mobile NOVA and report show no horizontal overflow at 390 px; desktop menu fits 1440 × 900 without scrolling |
| Settings | Text size, reduced motion and sound toggles update state and persist |

Not verified: audible sound output (headless browser), real screen-reader traversal, and browsers other than Chrome/Edge (Chromium).

## Known limitations

- Progress requires `localStorage`; private/strict modes may discard it. There is no cloud save.
- All four files must stay together; moving the HTML without the PNG/CSS/JS breaks the game.
- Evidence is a fixed published product, not live monitoring. NOVA is scripted and cannot answer arbitrary science questions.
- Missions are linear and sealed until the previous one closes; this is intentional progression.
- Answer order is shuffled per render, so exact on-screen choice positions differ between sessions.
- XP is awarded once per mission; replays are for review and do not increase score.
- Map hit zones and patch crops are calibrated to the supplied NASA figure; replacing the image would require recalibration.
- Accessibility was implemented and keyboard-tested, but no formal WCAG audit or screen-reader session was completed.
- The final report is an educational synthesis, not a safety assessment or planning document.

## Tools and resources

- Hand-authored HTML, CSS and vanilla JavaScript; Canvas 2D for the globe, starfield, radar and InSAR illustrations; Web Audio for optional interface tones; `localStorage` for persistence.
- NASA PIA26709 Figure A as the sole scientific image; general InSAR concepts (phase, line-of-sight displacement, residual noise) explained in the Science Lab.
- No frameworks, icon packs, web fonts, analytics, external APIs or paid services.
- Development QA used Node.js scripts driving headless Chrome over the DevTools Protocol; artifacts are in `.qa/`.


## AI-use disclosure

This project was built with substantial AI assistance (Codebuff) for code implementation, interaction design and automated QA. Scientific statements were constrained to the cited NASA product and introductory InSAR concepts; no measurements, dates or citations were invented. NOVA is explicitly a scripted, curated assistant and not a generative model. Before any public submission, a human team should review the text, verify the NASA attribution and confirm the educational claims against the primary source.

## Attribution

NASA image and result: PIA26709, NASA Science Photojournal / NASA–ISRO NISAR. Educational interpretation and game code: GROUND SHIFT project. Not affiliated with or endorsed by NASA.
