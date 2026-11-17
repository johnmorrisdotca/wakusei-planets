# Which package should I use? (OUTLINE, for John's review)

**Status: an outline, not a page. Not published.** The ticket says this page is written last, from the measurements. Nothing below is a finding: every blank is a measurement not yet made. Ticket: MODULES-540.

## What the page will do

Answer one question for each of the five packages John named (suncalc, astronomy-engine, astronomia, celestine, astronomy-bundle), and for wakusei-planets itself: **for this job, which one, and why**, in a table a reader can scan, with the measurement beside each answer.

## Shape

| If you want | Use | Because (measurement to cite) |
|---|---|---|
| The Sun and Moon from a place, nothing else, smallest possible | to be decided | size and rise and set error: `scripts/compare/rise-set-results.json` (measured for suncalc, astronomy-engine and wakusei); not measured for the other three |
| Every planet's position, with an accuracy you can state | to be decided | `docs/guides/accuracy.md`, "Compared with other packages" (measured for astronomy-engine, solarsystem, suncalc) |
| Eclipses, apsides, alignments | to be decided | blank until MODULES-534 ships and its Horizons and eclipse-canon tests exist |
| Dwarf planets, minor bodies, moons | to be decided | the accuracy guide's tables for wakusei; **not measured** for the others |
| A picture, not a number | wakusei-planets | no comparison: the others do not draw |
| The sky behind it (stars, constellations) | hoshi-stars | its own page; not a comparison with these five |

## Rules for writing it

- Written after the comparison table in `roadmap.md` has no blank cell for the rows it uses. A row with a blank is left out, not guessed.
- Says where a competitor is better. No "best".
- No package is described from memory: each statement is read from its repo or its npm page, with the date.
- English first for John; a Japanese page only when the English page ships.
