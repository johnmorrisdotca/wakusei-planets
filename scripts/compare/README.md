# Accuracy comparison (MODULES-556)

Development tooling only. Nothing here is imported by the published package. No `src/` or root dependency changes. No browser is needed.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --dir scripts/compare install --frozen-lockfile --ignore-scripts
python3 -m venv scripts/compare/.venv
scripts/compare/.venv/bin/python -m pip install --require-hashes --only-binary=:all: --no-deps -r scripts/compare/requirements.txt
node scripts/compare/run.mjs
node scripts/compare/run.mjs --check
pnpm check
pnpm docs:check
```

On Windows use `.venv/Scripts/python.exe` for installation; the runner selects that path automatically. `COMPARE_PYTHON` can select an explicit interpreter. Python runs in isolated mode. Only the initial installations need network access. Do not install or run Swiss Ephemeris, Caelis Engine or GPL ephemeris packages in this harness.

- `pnpm-lock.yaml`: exact JS versions and integrity digests. Direct comparators: astronomy-engine **2.1.19**, **MIT** ([project](https://github.com/cosinekitty/astronomy)); suncalc **2.1.2**, **BSD-2-Clause** ([licence](https://github.com/mourner/suncalc/blob/master/LICENSE)). esbuild **0.25.12**, MIT, is the size-measurement tool, not a comparator.
- `requirements.txt`: solarsystem **0.1.8**, **MIT**, exact wheel SHA-256. The wheel's `solarsystem-0.1.8.dist-info/LICENSE` was inspected before execution; PyPI's metadata lacks a licence field. [Publisher](https://github.com/IoannisNasios/solarsystem), [PyPI](https://pypi.org/project/solarsystem/0.1.8/).
- `python-adapter.py`: calls public `Heliocentric(..., precession=False, view="horizontal").planets()` and `Moon(..., topographic=False).position()`. Fractional minutes preserve seconds. UTC offset and DST are zero. Internal Julian days are recorded only to audit the calendar conversion, not to repair it.
- `math.mjs`: independent IAU 1976 mean-frame rotation and a cancellation-resistant angular difference. Python's Ceres/Eris element-frame interpretation is explicitly uncertain; both interpretations are stored. No source algorithm is copied from another package.
- `horizons-observer.json`: independent NASA/JPL apparent airless azimuth/elevation, same UTC dates as the union of planet/Moon fixtures, at the public synthetic test coordinate 35° N, 105° W, ellipsoidal height 0 m. All request parameters are retained. Refresh only when intended with `python3 -I scripts/compare/fetch-observer.py` (network).
- `results.json`: complete reference and converted vectors, per-date errors, maxima, worst dates, calendar offsets, measured code sizes and package versions. Geometric vectors are all stored in km (Python Moon Earth radii use 6378.14 km); horizon rows store unit north/east/up vectors. Distances are not scored. No claimed scores are substituted for missing measurements.
- `limits.json`: **frozen**, not written by the runner. Existing geometric limits come from `test/accuracy.test.ts`. New airless horizon bounds are 6″ Sun and 8″ Moon, above initial maxima 3.925″ and 4.839″. Changing them requires an explicit reason and review.
- `render.mjs`: one data-driven renderer for the English and Japanese accuracy-guide sections; preserves all text outside its two marker comments.

`--check` verifies the fixture hash, per-date scores (0.00001″ platform tolerance), and generated docs. The source revision and minified bundle fingerprint identify the unreleased worktree code independently of its package.json version. Gzip values may differ by up to 64 bytes between zlib implementations; runtimes and installation metadata are excluded. JS sizes preserve **all** exports, not selected functions. Python size is concatenated source gzip, not a JS-equivalent bundle or install size.

The checked-in reference is a sparse regression grid, not a distribution-wide accuracy certificate. The fitted wakusei tables are derived from Horizons too. Common 1950–2050 results accompany full-range results so calendar and unsupported-range failures do not masquerade as typical precision. Apparent airless topocentric rows are separate from geometric J2000 rows; only the atmospheric correction is inverted, leaving each API's parallax, light-time, aberration and Earth-rotation errors in the score. Event timing is not tested (follow-up MODULES-561).
