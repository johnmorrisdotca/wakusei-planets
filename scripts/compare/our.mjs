// Source imports keep the regression test independent of stale build output.
import { heliocentric, heliocentricCentre, moonGeocentric, moonVector } from '../../src/ephemeris.ts';
import '../../src/tables/all.ts';
import { AU_KM, direction, removeRefraction } from './math.mjs';
import * as W from '../../src/suncalc.ts';
import { refraction } from '../../src/sky/engine.ts';
export function ourVector(body, ms, group, plutoBarycentre = false) {
  if (group === 'moons') {
    const vector = body === 'moon' ? moonGeocentric(ms) : moonVector(body, ms);
    if (!plutoBarycentre || (body !== 'nix' && body !== 'hydra')) return vector;
    // The published comparison keeps the original barycentric Horizons fixture for these two moons.
    const barycentre = heliocentric('pluto', ms);
    const centre = heliocentricCentre('pluto', ms);
    return vector.map((value, axis) => value - (barycentre[axis] - centre[axis]) * AU_KM);
  }
  if (body === 'sun') return heliocentric('earth', ms).map(x => -x * AU_KM);
  return heliocentric(body, ms).map(x => x * AU_KM);
}

export function ourHorizontal(body, date, observer) {
  const p=W[body==='sun'?'getPosition':'getMoonPosition'](new Date(date),observer.latitude,observer.longitude);
  return direction(p.azimuth,removeRefraction(p.altitude,refraction));
}
