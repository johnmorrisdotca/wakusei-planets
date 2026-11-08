# Contributing

Wakusei Planets is a small TypeScript package: the Sun, the planets and their moons as line drawings and, as optional entry points, shaded drawings with three.js. These are the rules and the commands.

## Set up

```sh
pnpm install
pnpm check        # lint, typecheck, unit tests, build, package check
```

Work in a git worktree from `origin/main`, one branch per change. Ports: this package owns **8225–8249** of the 8200–8299 block the space packages share (8225 the demo, 8226 the tests, 8227 the picture scripts); check a port is free before you use it, and stop only your own processes by PID.

## The rules

- **Draw from public facts, and cite them.** Sizes, tilt, poles and rotation are the IAU's and NASA's; positions are JPL's and Meeus's. Never copy or trace artwork, a logo or any official mark. No SPX, SPXN or SPXIS marks in this MIT package.
- **Pictures only from public-domain sources.** Check each file's licence, record it in `NOTICE.md`, keep the originals out of the repository, and say what a change adds in bytes.
- **Keep it small.** The runtime dependency is kazoku-ui (the shared renderer); three.js is an optional peer. Do not add another without saying so. The main entry stays pure: the same arguments give the same markup.
- **Performance is not optional.** Live 3D goes through the shared renderer, draws only when something changes, at most thirty times a second, within 4096 pixels a side and 6 million pixels, and frees what it takes. Any change to drawing runs `pnpm test:freeze`. Tests draw in software and one browser at a time.
- **Look at what you change.** Render it, screenshot it, compare it with a real picture of the body, and fix what is off.
- **A fact with no source is left out, never guessed.**

## Checks

```sh
pnpm check        # lint, typecheck, unit tests, build, package check
pnpm test:readme  # every ts block of the README, type-checked and run against the packed package
pnpm test:usage   # every way of using it in the README and the guides, built and opened
pnpm docs:check   # the reference site's checks: every export documented with a running example, every guide with its Japanese twin
pnpm test:demo    # the demo and the docs site in a real browser (needs: pnpm exec playwright install chromium webkit)
pnpm test:demo:one --project=webkit-phone  # one of the four (chromium-desk, chromium-phone, webkit-desk, webkit-phone): CI runs them as four jobs
pnpm test:freeze  # draws, frames, contexts and GPU objects at rest and over a run of changes
```

The demo runs at `pnpm dev` → http://127.0.0.1:8225/wakusei-planets/.

## Release

Do not tag and do not publish. A release is prepared by bumping `package.json` (and `src/version.ts`), moving the CHANGELOG's unreleased notes under the new version, and pushing; when CI is green the coordinating session starts the Release workflow, which publishes to npm by trusted publishing. Ask first before a new package name, a first publish, a major version, a deprecation or a licence change.
