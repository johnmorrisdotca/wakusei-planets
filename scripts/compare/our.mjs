// Source imports keep the regression test independent of stale build output.
import { heliocentric, moonGeocentric, moonVector } from '../../src/ephemeris.ts';
import '../../src/tables/all.ts';
import { AU_KM, direction, removeRefraction } from './math.mjs';
import * as W from '../../src/suncalc.ts';
import { refraction } from '../../src/sky/engine.ts';
export function ourVector(body, ms, group) {
  if (group === 'moons') return body === 'moon' ? moonGeocentric(ms) : moonVector(body, ms);
  if (body === 'sun') return heliocentric('earth', ms).map(x => -x * AU_KM);
  return heliocentric(body, ms).map(x => x * AU_KM);
}

export function ourHorizontal(body, date, observer) {
  const p=W[body==='sun'?'getPosition':'getMoonPosition'](new Date(date),observer.latitude,observer.longitude);
  return direction(p.azimuth,removeRefraction(p.altitude,refraction));
}
