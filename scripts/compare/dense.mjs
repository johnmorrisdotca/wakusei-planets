// The 60-date check of 1800 to 2200 (test/data/horizons-dense.json): wakusei and astronomy-engine against JPL Horizons, the worst direction error per body. Prints the table the accuracy guide quotes.
// Development tooling only, nothing here is shipped. Usage: node scripts/compare/dense.mjs
import { readFileSync } from 'node:fs';
import * as A from 'astronomy-engine';
import { ourVector } from './our.mjs';
import { AU_KM, EPS0, arcsec, rotateX } from './math.mjs';

const reference = JSON.parse(readFileSync(new URL('../../test/data/horizons-dense.json', import.meta.url), 'utf8'));
const aeVector = (v) => rotateX([v.x * AU_KM, v.y * AU_KM, v.z * AU_KM], -EPS0);
const rows = [];
const worst = (body, group, engine) => {
  let ours = 0, theirs = engine ? 0 : null;
  reference[group][body].forEach((target, i) => {
    const ms = Date.parse(reference.dates[i]);
    ours = Math.max(ours, arcsec(ourVector(body, ms, group === 'planets' ? 'planets' : 'moons'), target));
    if (engine) theirs = Math.max(theirs, arcsec(engine(A.MakeTime(new Date(ms))), target));
  });
  rows.push({ body, ours, theirs });
};
for (const body of Object.keys(reference.planets)) worst(body, 'planets', (t) => aeVector(A.HelioVector(A.Body[body[0].toUpperCase() + body.slice(1)], t)));
for (const body of Object.keys(reference.moons)) {
  const engine = body === 'moon' ? (t) => aeVector(A.GeoMoon(t)) : ['io', 'europa', 'ganymede', 'callisto'].includes(body) ? (t) => aeVector(A.JupiterMoons(t)[body]) : null;
  worst(body, 'moons', engine);
}
console.log('| Body | wakusei | astronomy-engine |\n|---|---:|---:|');
for (const r of rows) console.log(`| ${r.body} | ${r.ours.toFixed(r.ours < 100 ? 2 : 0)}″ | ${r.theirs === null ? '—' : r.theirs.toFixed(r.theirs < 100 ? 2 : 0) + '″'} |`);
