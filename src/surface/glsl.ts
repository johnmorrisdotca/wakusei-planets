// The shaders of the standing view. The ground is one mesh of rings and rays round the viewer's feet, its heights read in the vertex shader from the levels of the height pyramid (the finest
// that holds the point and is near enough), its normal worked out from the same heights in the fragment shader, and its light from the Sun's direction: Lommel-Seeliger, the law the Moon's
// dust follows, and a hard shadow found by walking from the point toward the Sun over the same heights (a horizon-angle march) rather than from a shadow map, which cannot hold a
// stone's shadow and a mountain's at once. No air: no haze, a black sky, and what the Sun does not reach is black.
// The scene's frame is x east, y up, z south; the maths here is in the site's own plane (east, up, north), so a z is flipped on the way to the screen.

/** The uniforms of the pyramid every shader reads, and the one function that reads it: `terrainY(point, distance)`, metres over the site's ground, the Moon's curve taken off. */
export const HEIGHTS = /* glsl */ `
uniform sampler2D uH0;
uniform sampler2D uH1;
uniform sampler2D uH2;
uniform sampler2D uH3;
uniform vec4 uL0; // half width, metres a sample, samples across, the distance out to which this level is used
uniform vec4 uL1;
uniform vec4 uL2;
uniform vec4 uL3;
uniform float uHmin;
uniform float uHrange;
uniform float uGround;
uniform float uRadius;

float dec(vec4 t) { return uHmin + (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0 * uHrange; }

float lin(sampler2D s, vec2 p, vec4 l) {
  vec2 f = vec2((p.x + l.x) / l.y - 0.5, (l.x - p.y) / l.y - 0.5);
  vec2 i = floor(f);
  vec2 t = f - i;
  float st = 1.0 / l.z;
  vec2 uv = (i + 0.5) * st;
  float a = dec(texture2D(s, uv));
  float b = dec(texture2D(s, uv + vec2(st, 0.0)));
  float c = dec(texture2D(s, uv + vec2(0.0, st)));
  float d = dec(texture2D(s, uv + vec2(st, st)));
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}

float nearest(sampler2D s, vec2 p, vec4 l) {
  vec2 uv = vec2((p.x + l.x) / (l.y * l.z), (l.x - p.y) / (l.y * l.z));
  return dec(texture2D(s, uv));
}

bool holds(vec2 p, vec4 l, float dist) { return dist < l.w && abs(p.x) < l.x - 2.0 * l.y && abs(p.y) < l.x - 2.0 * l.y; }

// the ground's height over the site's, the sphere's fall taken off; \`fine\` reads four samples, otherwise one
float terrainY(vec2 p, float dist, bool fine) {
  float h;
  if (holds(p, uL0, dist)) h = fine ? lin(uH0, p, uL0) : nearest(uH0, p, uL0);
  else if (holds(p, uL1, dist)) h = fine ? lin(uH1, p, uL1) : nearest(uH1, p, uL1);
  else if (holds(p, uL2, dist)) h = fine ? lin(uH2, p, uL2) : nearest(uH2, p, uL2);
  else h = fine ? lin(uH3, p, uL3) : nearest(uH3, p, uL3);
  return h - uGround - dot(p, p) / (2.0 * uRadius);
}

// the spacing of the level that serves a point, for the step of a slope
float spacing(vec2 p, float dist) {
  if (holds(p, uL0, dist)) return uL0.y;
  if (holds(p, uL1, dist)) return uL1.y;
  if (holds(p, uL2, dist)) return uL2.y;
  return uL3.y;
}
`;

/** The ground's vertices: a ring index and an angle across the view, laid out as the viewer's own polar grid, then raised to the measured heights. */
export const GROUND_VERTEX = /* glsl */ `
precision highp float;
precision highp sampler2D;
// position (declared by three.js) holds x: 0 to 1 out along the rays (ring spacing grows with the distance), y: -1 to 1 across the view
uniform mat4 uVP;
uniform vec2 uEyeEN; // the eyes' place in the site's plane: east, north
uniform float uYaw; // radians, clockwise from north
uniform float uSpan; // half the angle drawn across the view, radians
uniform float uRMin;
uniform float uRMax;
${HEIGHTS}
varying vec3 vP;
void main() {
  float r = uRMin * pow(uRMax / uRMin, position.x);
  float a = uYaw + position.y * uSpan;
  vec2 p = uEyeEN + r * vec2(sin(a), cos(a));
  float y = terrainY(p, r, true);
  vP = vec3(p.x, y, p.y);
  gl_Position = uVP * vec4(p.x, y, -p.y, 1.0);
}
`;

/** The ground's light. `uSun` is the Sun's direction (east, up, north), `uEye` the eyes (east, up, north). */
export const GROUND_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform vec3 uSun;
uniform vec3 uEye;
uniform vec2 uEyeEN;
uniform float uExposure;
uniform float uAlbedo;
uniform float uMaxY; // the highest ground over the site's, for the end of a shadow's march
uniform float uEarthshine; // the Earth's light on the shade, a small share of a lit slope
uniform float uShadows; // 1 for the ground to shadow itself (the default), 0 for none (a try-out)
${HEIGHTS}
varying vec3 vP;

float lit(vec3 P) {
  vec2 dir = normalize(uSun.xz);
  float slope = uSun.y / max(length(uSun.xz), 1e-4);
  // the ground at the point from the heights themselves, not the mesh's slope between its corners, which can be a long way off on a far mountain
  P.y = terrainY(P.xz, distance(P.xz, uEyeEN), true);
  float t = 0.5 * spacing(P.xz, distance(P.xz, uEyeEN)) + 1.0;
  for (int i = 0; i < 200; i += 1) {
    vec2 q = P.xz + dir * t;
    float y = P.y + slope * t;
    float dist = max(t, distance(q, uEyeEN));
    float res = spacing(q, dist);
    // near the point four samples are read (the point's own height is one of the same kind); far, one, and the ground may stand a share of a step over the ray before it counts
    float h = terrainY(q, dist, t < 60.0);
    if (h > y + 0.15 * res + 0.002 * t) return 0.0;
    if (y > uMaxY || t > 80000.0) break;
    t = t * 1.06 + 0.5;
  }
  return 1.0;
}

void main() {
  float dist = distance(vP.xz, uEyeEN);
  float e = max(spacing(vP.xz, dist), dist * 0.001);
  float hE = terrainY(vP.xz + vec2(e, 0.0), dist, true);
  float hW = terrainY(vP.xz - vec2(e, 0.0), dist, true);
  float hN = terrainY(vP.xz + vec2(0.0, e), dist, true);
  float hS = terrainY(vP.xz - vec2(0.0, e), dist, true);
  vec3 n = normalize(vec3(-(hE - hW) / (2.0 * e), 1.0, -(hN - hS) / (2.0 * e)));
  float mu0 = dot(n, uSun);
  float mu = max(dot(n, normalize(uEye - vP)), 0.03);
  float shine = 0.0;
  if (mu0 > 0.0 && uSun.y > -0.01) shine = (uShadows > 0.5 ? lit(vP) : 1.0) * 2.0 * mu0 / (mu0 + mu);
  float light = uAlbedo * (shine + uEarthshine * max(n.y, 0.0)) * uExposure;
  gl_FragColor = vec4(vec3(pow(clamp(light, 0.0, 1.0), 1.0 / 2.2)), 1.0);
}
`;

/** A flat disc that always faces the viewer, set at a direction and a size: the Sun, and the Earth with its lit side toward the Sun. */
export const DISC_VERTEX = /* glsl */ `
precision highp float;
// position (declared by three.js) holds the corners of a square, -1 to 1
uniform mat4 uVP;
uniform vec3 uEyeWorld;
uniform vec3 uDirWorld; // unit, scene frame
uniform vec3 uRightWorld;
uniform vec3 uUpWorld;
uniform float uHalf; // half the square's side as a share of the distance
varying vec2 vUv;
void main() {
  vUv = position.xy;
  float d = 400000.0;
  vec3 w = uEyeWorld + uDirWorld * d + (uRightWorld * position.x + uUpWorld * position.y) * uHalf * d;
  gl_Position = uVP * vec4(w, 1.0);
}
`;

/** The Sun as a disc, or the Earth as a lit sphere: the same shader, `uKind` 0 for the Sun and 1 for the Earth. */
export const DISC_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKind;
uniform vec3 uSunEnu; // the Sun's direction in the sky's own frame (east, north, up)
uniform vec3 uDirEnu; // the disc's direction in the same frame
uniform vec3 uRightEnu;
uniform vec3 uUpEnu;
uniform float uExposure;
varying vec2 vUv;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  if (uKind < 0.5) { gl_FragColor = vec4(vec3(1.0), 1.0); return; }
  // the sphere's normal toward the viewer, in the sky's frame: the viewer looks along uDirEnu, so the face toward it points the other way
  vec3 nrm = normalize(-uDirEnu * sqrt(1.0 - r2) + uRightEnu * vUv.x + uUpEnu * vUv.y);
  float d = dot(nrm, uSunEnu);
  float day = smoothstep(-0.02, 0.06, d);
  vec3 ocean = vec3(0.10, 0.27, 0.62);
  vec3 cloud = vec3(0.85, 0.88, 0.92);
  float band = 0.5 + 0.5 * sin(nrm.z * 9.0 + nrm.x * 5.0);
  vec3 c = mix(ocean, cloud, smoothstep(0.55, 0.95, band) * 0.6);
  float limb = 1.0 - 0.35 * r2;
  vec3 colour = c * (0.04 + 0.96 * max(d, 0.0)) * day * limb;
  colour += c * 0.012; // the night side's own faint light
  gl_FragColor = vec4(pow(clamp(colour, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}
`;
