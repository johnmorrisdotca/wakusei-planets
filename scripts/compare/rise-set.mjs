// Rise and set times of the Sun and the Moon against JPL Horizons (horizons-rise-set.json). Development only.
// Every package is asked through its own public API for the same place and day; each answer is matched to the
// reference event of the same kind nearest to it. An answer more than an hour from any is counted as wrong,
// a reference event in the asked day with no answer as missed.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as A from 'astronomy-engine';
import * as S from 'suncalc';
import * as W from '../../src/suncalc.ts';

const HOUR = 3_600_000, DAY = 24 * HOUR;
const fixtureBytes = readFileSync(new URL('horizons-rise-set.json', import.meta.url));
const fixture = JSON.parse(fixtureBytes);
const limits = JSON.parse(readFileSync(new URL('rise-set-limits.json', import.meta.url), 'utf8'));
const columns = ['wakusei', 'astronomyEngine', 'suncalc'];
const valid = d => (d instanceof Date && Number.isFinite(d.getTime()) ? d.getTime() : null);
const aeTime = t => (t ? t.date.getTime() : null);

function answers(body, lat, lon, date) {
  const midnight = Date.parse(date + 'T00:00:00Z');
  const place = new A.Observer(lat, lon, 0);
  if (body === 'sun') {
    // the day around local mean noon: what suncalc's getTimes picks for a moment near noon, and wakusei's solar day
    const noon = midnight + 12 * HOUR - (lon / 15) * HOUR, from = noon - 12 * HOUR;
    const w = W.getTimes(new Date(noon), lat, lon), s = S.getTimes(new Date(noon), lat, lon);
    return {
      window: [from, from + DAY],
      wakusei: { rise: valid(w.sunrise), set: valid(w.sunset) },
      suncalc: { rise: valid(s.sunrise), set: valid(s.sunset) },
      astronomyEngine: { rise: aeTime(A.SearchAltitude(A.Body.Sun, place, +1, new Date(from), 1, -0.833)), set: aeTime(A.SearchAltitude(A.Body.Sun, place, -1, new Date(from), 1, -0.833)) },
    };
  }
  const w = W.getMoonTimes(new Date(midnight), lat, lon, 0), s = S.getMoonTimes(new Date(midnight), lat, lon, 0);
  return {
    window: [midnight, midnight + DAY],
    wakusei: { rise: valid(w.rise), set: valid(w.set) },
    suncalc: { rise: valid(s.rise), set: valid(s.set) },
    astronomyEngine: { rise: aeTime(A.SearchRiseSet(A.Body.Moon, place, +1, new Date(midnight), 1)), set: aeTime(A.SearchRiseSet(A.Body.Moon, place, -1, new Date(midnight), 1)) },
  };
}

const rows = [];
for (const c of fixture.cases) {
  const { latitude: lat, longitude: lon } = fixture.sites[c.site];
  for (const body of ['sun', 'moon']) {
    const got = answers(body, lat, lon, c.date);
    for (const kind of ['rise', 'set']) {
      const refs = c[body].filter(e => e.kind === kind).map(e => Date.parse(e.utc));
      const inWindow = refs.filter(t => t >= got.window[0] && t < got.window[1]);
      const row = { site: c.site, date: c.date, body, kind, reference: inWindow.map(t => new Date(t).toISOString()), results: {} };
      for (const k of columns) {
        const t = got[k][kind];
        if (t === null) {
          row.results[k] = inWindow.length ? { outcome: 'missed' } : { outcome: 'none' };
          continue;
        }
        const nearest = refs.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), Infinity);
        const errorSeconds = (t - nearest) / 1000;
        row.results[k] = Math.abs(errorSeconds) > 3600 ? { outcome: 'wrong', utc: new Date(t).toISOString() } : { outcome: 'matched', utc: new Date(t).toISOString(), errorSeconds: Math.round(errorSeconds * 1000) / 1000 };
      }
      rows.push(row);
    }
  }
}

function summary(body) {
  const mine = rows.filter(r => r.body === body);
  return Object.fromEntries(columns.map(k => {
    const errors = mine.map(r => r.results[k]).filter(x => x.outcome === 'matched').map(x => Math.abs(x.errorSeconds)).sort((a, b) => a - b);
    const count = o => mine.filter(r => r.results[k].outcome === o).length;
    const median = errors.length ? (errors[(errors.length - 1) >> 1] + errors[errors.length >> 1]) / 2 : null;
    return [k, { matched: errors.length, medianSeconds: median, maxSeconds: errors.at(-1) ?? null, missed: count('missed'), wrong: count('wrong') }];
  }));
}

const output = {
  schemaVersion: 1,
  fixtureSha256: createHash('sha256').update(fixtureBytes).digest('hex'),
  packages: { astronomyEngine: '2.1.19', suncalc: '2.1.2' },
  calls: {
    sun: 'wakusei getTimes(noon) and suncalc getTimes(noon) with noon the local mean noon; astronomy-engine SearchAltitude(Sun, -0.833 deg) from 12 h before it, one day',
    moon: 'wakusei getMoonTimes(midnight, lat, lng, 0) and suncalc getMoonTimes(midnight, lat, lng, 0) for the UTC day; astronomy-engine SearchRiseSet(Moon) from UTC midnight, one day',
  },
  summary: { sun: summary('sun'), moon: summary('moon') },
  rows,
};
for (const body of ['sun', 'moon']) {
  const s = output.summary[body].wakusei, limit = limits[body];
  if (s.missed || s.wrong) throw new Error(`${body}: wakusei missed ${s.missed} and gave ${s.wrong} wrong times`);
  if (limit !== undefined && s.maxSeconds > limit) throw new Error(`${body}: ${s.maxSeconds} s > published ${limit} s`);
}
const file = new URL('rise-set-results.json', import.meta.url);
if (process.argv.includes('--check')) {
  const previous = JSON.parse(readFileSync(file, 'utf8'));
  if (previous.fixtureSha256 !== output.fixtureSha256) throw new Error('rise and set reference changed: rerun and review');
  if (previous.rows.length !== rows.length) throw new Error('rise and set coverage changed');
  rows.forEach((row, i) => {
    for (const k of columns) {
      const a = row.results[k], b = previous.rows[i].results[k];
      if (a.outcome !== b.outcome || Math.abs((a.errorSeconds ?? 0) - (b.errorSeconds ?? 0)) > 0.002) throw new Error(`rise and set drift ${row.site} ${row.date} ${row.body} ${row.kind} ${k}; rerun and review`);
    }
  });
  // the guide's table quotes the worst times; it must match the recorded measurement
  for (const path of ['../../docs/guides/suncalc.md', '../../docs/guides/ja/suncalc.md']) {
    const guide = readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const body of ['sun', 'moon']) for (const k of columns) {
      const quoted = output.summary[body][k].maxSeconds.toFixed(1);
      if (!guide.includes(quoted)) throw new Error(`${path} does not quote ${body} ${k} ${quoted} s`);
    }
  }
  console.log('rise and set comparison reproduces within 2 ms');
} else {
  writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
  console.log('wrote scripts/compare/rise-set-results.json');
}
for (const body of ['sun', 'moon']) for (const k of columns) console.log(body, k, JSON.stringify(output.summary[body][k]));
