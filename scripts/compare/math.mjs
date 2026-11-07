// Independent frame adapters: Meeus, Astronomical Algorithms, chapters 13, 21, 22.
export const RAD = Math.PI / 180;
export const AU_KM = 149597870.7;
export const EPS0 = 84381.448 / 3600 * RAD;
export function direction(longitude, latitude, radius = 1) {
  const l = longitude * RAD, b = latitude * RAD;
  return [radius * Math.cos(b) * Math.cos(l), radius * Math.cos(b) * Math.sin(l), radius * Math.sin(b)];
}
export function rotateX([x,y,z], a) { return [x, y*Math.cos(a)-z*Math.sin(a), y*Math.sin(a)+z*Math.cos(a)]; }
export function rotateY([x,y,z], a) { return [x*Math.cos(a)+z*Math.sin(a), y, -x*Math.sin(a)+z*Math.cos(a)]; }
export function rotateZ([x,y,z], a) { return [x*Math.cos(a)-y*Math.sin(a), x*Math.sin(a)+y*Math.cos(a), z]; }
export function arcsec(a, b) {
  const na = Math.hypot(...a), nb = Math.hypot(...b);
  if (![...a,...b,na,nb].every(Number.isFinite) || !na || !nb) throw new Error('nonfinite or zero comparison vector');
  const u=a.map(x=>x/na),v=b.map(x=>x/nb);
  return 2*Math.atan2(Math.hypot(...u.map((x,i)=>x-v[i])),Math.hypot(...u.map((x,i)=>x+v[i])))/RAD*3600;
}
// Mean ecliptic/equinox of date -> mean ecliptic/equinox J2000. UTC identifies the
// frame epoch; TT-UTC has negligible (<0.001 arcsec) impact on this slow rotation.
export function dateEclipticToJ2000(vector, ms) {
  const t=(ms/86400000+2440587.5-2451545)/36525;
  const e=(84381.448-46.815*t-0.00059*t*t+0.001813*t*t*t)/3600*RAD;
  const zeta=(2306.2181*t+0.30188*t*t+0.017998*t*t*t)/3600*RAD;
  const z=(2306.2181*t+1.09468*t*t+0.018203*t*t*t)/3600*RAD;
  const theta=(2004.3109*t-0.42665*t*t-0.041833*t*t*t)/3600*RAD;
  return rotateX(rotateZ(rotateY(rotateZ(rotateX(vector,e),-z),theta),-zeta),-EPS0);
}
// Numerical removal of a package's documented atmospheric correction. The
// comparison is airless; parallax/light-time/aberration remain part of the API.
export function removeRefraction(apparent, correction) {
  let lo=-90,hi=90;
  for(let i=0;i<70;i++){ const m=(lo+hi)/2; if(m+correction(m)<apparent)lo=m; else hi=m; }
  const altitude=(lo+hi)/2;
  if(Math.abs(altitude+correction(altitude)-apparent)>1e-8)throw new Error('refraction inversion failed');
  return altitude;
}
