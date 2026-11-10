# Agents: start here

<!--
Template: kazoku-ui templates/AGENTS.md. Copy it to AGENTS.md at the repo root and fill in the Facts table below the marker.
Everything above the marker is the same in every package repo: change it here, then copy it over, never by hand in one repo.
Everything below the marker belongs to the repo. Public repo: no private hosts, addresses, home paths, logins or keys.
-->

This repo is one of the family of John Morris's npm packages. The rules every package repo shares are below; what differs is in the **Facts** table under the marker.

## Read first

1. spx-stats `docs/package-work.md` (https://github.com/spxis/spx-stats/blob/main/docs/package-work.md), and the section "Who may change what" in spx-stats `AGENTS.md`. They hold the boards, filing, checks, release, hand-off and reporting rules. If your session has an spx-stats checkout, `git pull` it first.
2. This repo's `CONTRIBUTING.md` and README, for the rules and commands of the code itself.
3. The Facts table below: your board, ports, checks, release path and hand-off project.

## Work

- **Board.** Every ticket for this repo is on the board named in Facts, titled `<title prefix>: ...` with `--area <title prefix>`. From the spx-stats checkout's `web/` directory: `pnpm task --board <board> list`, then `claim <id> "<who>"` with the whole id before you start. Read the ticket's full detail first. Anything you find outside your ticket becomes a new ticket; say so in your report. Never run `done`: the coordinating session closes tickets.
- **A gap in a shared part** (the view controls, theme switch, language picker, address state, save-as-image) is a `kazoku-ui:` ticket on the `kazoku-ui` board, not a copy or a workaround here.
- **One agent per repo**, in a new git worktree from `origin/main`. Never work in the main checkout or in another agent's worktree.
- **The must-have list.** A package is not released without its demo on Pages, an embed page, a documentation site in English and Japanese, the family files and tested usage examples (spx-stats `docs/package-work.md`, "The must-have list"; kazoku-ui `docs/package-standard.md`). `scripts/check-standard.mjs`, copied unchanged from kazoku-ui `templates/check-standard.mjs`, fails `pnpm check` when one is missing.
- **Ports.** Only the block in Facts. Check `lsof -iTCP:<port> -sTCP:LISTEN` first, stop only your own process by its PID, never `pkill`.
- **Commits.** As John Morris <john@johnmorris.ca>, Conventional Commits, subject 50 characters or less, no AI attribution, files added by name (never `git add -A`). Push fast-forward to `main` after `git fetch` and a rebase.
- **Live 3D (WebGL) needs a freeze test and software drawing.** A package with WebGL has `e2e/freeze.demo.*` and `pnpm test:freeze` (one frame at a time, nothing drawn at rest or out of sight, live contexts and GPU objects flat, canvas within 6 million pixels and 4096 a side), its `release.yml` passes `freeze-command: pnpm test:freeze` to the shared release, and every Chromium project in `playwright.config` draws in software (`SOFTWARE_GL_ARGS` from `@johnmorrisdotca/kazoku-ui/testing`), never on the Mac's graphics card. One headless browser at a time, closed when finished. Details: spx-stats `docs/package-work.md`, "No 3D release without a freeze test".
- **No long pages of fold-open sections.** A stack or loop of `<details>` or accordions that a reader scrolls through to find things is not allowed in a demo or site. Put choices in clicks in a row (kind, then family, then model), tabs, a grid or a search, with the chosen thing and its options on one screen. One small "More options" fold, or one "The call that draws it" fold beside its own demo, is fine. Details: spx-stats `docs/package-work.md`, "No long pages of fold-open sections".
- **Never.** GitHub issues, pull requests, discussions or comments; a token, key or private address in any file, commit or ticket; John's SPX, SPXN or SPXIS marks in an MIT package (the one exception: the space packages wakusei-planets, hoshi-stars, chikyu-earth and uchusen-rockets carry the keywords `spaceprogramx`, `space-program-x` and `spx`, the README line "Part of Space Program X (SPX)" and the "Space Program X" header on printable sheets, John 2026-11-08; the brand is written "Space Program X"); anything that bills; a new package name, first publish, major version, deprecation or licence change without John's yes.
- **Japanese.** Whatever you write for John, give the English beside it. A docs page is in one language.

## Checks, release, hand-off

- **Before every push** run the checks in Facts. Green locally, then green in CI after the push (`gh run watch`).
- **Release.** Make a release commit (bump `package.json`, move the CHANGELOG's Unreleased block under the version), push it, wait for CI. **Do not tag and do not publish.** John runs the Release workflow (Actions → Release → Run workflow, from `main`). It checks the tag against `package.json`, runs the repo's check script, skips a version already on npm, tags `v<version>`, and publishes by trusted publishing. The repo's `release.yml` should call kazoku-ui's `reusable-release.yml` (kazoku-ui `docs/release-workflow.md`); the trusted-publisher entry on npmjs.com names `release.yml`.
- **Hand-off** for every finished ticket: write `<ticket-id>.json` and run `SPX_HANDOFF_PROJECT=<hand-off project> python3 -I scripts/handoff/handoff.py check|write <file>` from the spx-stats checkout (the variable on the same command line; the id is the ticket's whole id). Read the replies at the start and before you finish. Then release your hold: `pnpm task --board <board> release <id> --by "<who>"`.
- **Report** in under 12 lines, first line `<your name>, ticket <id> (<title>)` (`subagent of <name>` for a subagent): what changed, shas, CI, anything John must decide, new tickets, and last `HAND-OFF WRITTEN: <path>`. If you stop for any reason, say so at once.

<!-- repo-specific: everything below this line belongs to this repo. A template update never touches it. -->

## Facts

| | |
|---|---|
| Package | `@johnmorrisdotca/wakusei-planets` |
| Repo | `johnmorrisdotca/wakusei-planets` |
| Board | `modules` (see the one-home table in spx-stats `docs/package-work.md`) |
| Title prefix and `--area` | `wakusei-planets` |
| Ports | 8300 to 8399 (this package's own block in John's port table): 8300 the demo and dev, 8301 the tests, 8302 the picture scripts, 8310 the serve example, 8303 to 8399 anything else |
| Checks before a push | `pnpm check`, `pnpm test:usage`, `pnpm test:demo`, `pnpm test:freeze` |
| Release | `release.yml` → `reusable-release.yml` (with the CI-green gate and the freeze test); trusted publisher entry: `release.yml` |
| Hand-off project | `wakusei-planets` |

## This repo

The Sun, the planets and their moons in three looks: `line` (an SVG string), `realistic` (a shader drawn from the body's real colours and features, three.js, optional peer) and `painted` (public-domain surface maps). Facts are IAU and NASA; planet positions JPL's approximate elements; moons JPL's mean elements and Meeus. Draw from numbers; never copy artwork. Imagery only from public-domain NASA/USGS/JPL sources, each file's licence checked and credited in `NOTICE.md`. No brand names in theme names, and no SPX, SPXN or SPXIS marks beyond the SpaceProgramX keywords and README line.

Performance is a hard requirement: live 3D goes through kazoku-ui's shared renderer (one WebGL context for the page), draws only on demand at 30 fps at most, caps the canvas at 4096 pixels a side and 6 MP, frees everything, pauses out of sight, honours reduced motion, recovers a lost context, and works out the sky at about 1 Hz (`src/live.ts`). `pnpm test:freeze` proves it and a release does not go out without it. Tests draw in software, one headless browser at a time.

Each body's shaded look is its own entry point (`src/bodies/<name>.ts`) that registers itself in `src/scene/look.ts` (a table on `globalThis`, so a CDN's separate copies still share it).
