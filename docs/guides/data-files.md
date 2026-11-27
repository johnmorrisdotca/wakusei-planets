---
title: Data files
section: how-to
order: 30
description: Download tables of bodies, orbits, spacecraft and places.
---

[日本語](ja/data-files.md)

Release assets include UTF-8 CSV and Parquet tables, a JSON schema per table, `LICENCE-DATA.md`, and `SHA256SUMS`. CSV uses `\N` for missing values; Parquet uses null. Numbers retain the source precision. Schema columns give types, units, meanings and sources.

## Tables and columns

- `bodies`: `id`, `kind`, `parent`, `nameEn`, `nameJa`, `radiusKm`, `flattening`, `massKg`, `gmKm3s2`, `surfaceGravityMs2`, `tiltDeg`, `rotationHours`, `poleRa`, `poleDec`, `colour`. Surface gravity is GM divided by radius squared, not a local measurement.
- `orbital-elements`: `id`, `parent`, `elementKind`, `frame`, `epochMs`, `aAu`, `aKm`, `eccentricity`, `inclination`, `node`, `argumentPeriapsis`, `meanAnomaly`, `meanLongitudeRate`, `periapsisRate`, `nodeRate`, `acceleration`, `poleRa`, `poleDec`, `waveAmplitude`, `wavePeriodDays`, `wavePhase`, `validFromYear`, `validToYear`, `meanLongitude`, `semiMajorRate`, `eccentricityRate`, `inclinationRate`, `extraB`, `extraC`, `extraS`, `extraF`, `source`. Angles are degrees; rates and epochs are described in the schema. Planet rows are JPL's approximate Keplerian elements for 1800 to 2050 and for 3000 BC to 3000 AD (Pluto only the first span). The Earth row is the Earth-Moon barycentre. `extraB` to `extraF` are the extra mean-anomaly terms, filled only for Jupiter to Neptune on the long span. Dwarf planet and dwarf moon elements are osculating; other moon elements are mean or fitted mean.
- `spacecraft`: `id`, `nameEn`, `nameJa`, `agency`, `launchMs`, `launchPrecision`, `launchSiteEn`, `launchSiteJa`, `launchVehicle`, `endMs`, `status`, `url`, `horizonsId`, `recordStartMs`, `recordEndMs`, `joins` (a JSON array).
- `spacecraft-events`: `craftId`, `order`, `kind`, `dateMs`, `precision`, `nameEn`, `nameJa`, `body`, `distanceKm`.
- `places`: `id`, `body`, `kind`, `nameEn`, `nameJa`, `lat`, `lon`, `approximate`, `famous`, `date`, `until`, `mission`, `operator`, `country`, `outcome`, `site`, `featureType`, `featureWordEn`, `featureWordJa`, `diameterKm`, `approved`, `origin`, `plannedDate`, `plannedDateOf`, `plannedStatus`, `plannedRead`, `sourceId`, `sourceRead`, `sourceUrl`, `sourceLatitude`, `sourceFrame`: every place on the 33 bodies of `/places` (see the guide "Places on the Moon, Mars and 31 more bodies"). Latitude is planetocentric and longitude east, -180 to 180; each row's credit is its `sourceId`'s in `LICENCE-DATA.md`.

The code is MIT. Data sources retain their own terms; read `LICENCE-DATA.md` for the exact credits and conditions. Theory coefficient tables are excluded while their redistribution terms are unsettled.

## Loading examples

These examples are untested; install the relevant tools yourself.

Pandas:

```text
import pandas as pd
bodies = pd.read_csv("bodies.csv", na_values=[r"\N"])
bodies = pd.read_parquet("bodies.parquet")
```

Polars:

```text
import polars as pl
bodies = pl.read_csv("bodies.csv", null_values=r"\N")
bodies = pl.read_parquet("bodies.parquet")
```

R:

```text
bodies <- arrow::read_parquet("bodies.parquet")
```

Rust (with the Polars parquet feature):

```text
use polars::prelude::*;
let bodies = ParquetReader::new(std::fs::File::open("bodies.parquet")?).finish()?;
```
