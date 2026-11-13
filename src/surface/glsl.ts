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
uniform sampler2D uA0; // the ground picture on the first three levels, 0 to 1 with the middle at 0.5
uniform sampler2D uA1;
uniform sampler2D uA2;
uniform float uPicture; // 1 where the picture is there
uniform vec4 uL0; // half width, metres a sample, samples across, the distance out to which this level is used
uniform vec4 uL1;
uniform vec4 uL2;
uniform vec4 uL3;
uniform float uHmin;
uniform float uHrange;
uniform float uGround;
uniform float uRadius;

uniform vec2 uFarHeight; // the range the coarse level is encoded over: its minimum and its span
float dec(vec4 t, vec2 hr) { return hr.x + (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0 * hr.y; }

float lin(sampler2D s, vec2 p, vec4 l, vec2 hr) {
  vec2 f = vec2((p.x + l.x) / l.y - 0.5, (l.x - p.y) / l.y - 0.5);
  vec2 i = floor(f);
  vec2 t = f - i;
  float st = 1.0 / l.z;
  vec2 uv = (i + 0.5) * st;
  float a = dec(texture2D(s, uv), hr);
  float b = dec(texture2D(s, uv + vec2(st, 0.0)), hr);
  float c = dec(texture2D(s, uv + vec2(0.0, st)), hr);
  float d = dec(texture2D(s, uv + vec2(st, st)), hr);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}

float nearest(sampler2D s, vec2 p, vec4 l, vec2 hr) {
  vec2 uv = vec2((p.x + l.x) / (l.y * l.z), (l.x - p.y) / (l.y * l.z));
  return dec(texture2D(s, uv), hr);
}

bool holds(vec2 p, vec4 l, float dist) { return dist < l.w && abs(p.x) < l.x - 2.0 * l.y && abs(p.y) < l.x - 2.0 * l.y; }

// the ground's height over the site's, the sphere's fall taken off; \`fine\` reads four samples, otherwise one
float terrainY(vec2 p, float dist, bool fine) {
  float h;
  if (holds(p, uL0, dist)) h = fine ? lin(uH0, p, uL0, vec2(uHmin, uHrange)) : nearest(uH0, p, uL0, vec2(uHmin, uHrange));
  else if (holds(p, uL1, dist)) h = fine ? lin(uH1, p, uL1, vec2(uHmin, uHrange)) : nearest(uH1, p, uL1, vec2(uHmin, uHrange));
  else if (holds(p, uL2, dist)) h = fine ? lin(uH2, p, uL2, vec2(uHmin, uHrange)) : nearest(uH2, p, uL2, vec2(uHmin, uHrange));
  else h = fine ? lin(uH3, p, uL3, uFarHeight) : nearest(uH3, p, uL3, uFarHeight);
  return h - uGround - dot(p, p) / (2.0 * uRadius);
}

// the ground's own brightness at a point, from the picture of the level that serves it, 1 where it is the middle
float albedoAt(vec2 p, float dist) {
  if (uPicture < 0.5) return 1.0;
  vec4 l;
  if (holds(p, uL0, dist)) { l = uL0; return 2.0 * texture2D(uA0, vec2((p.x + l.x) / (l.y * l.z), (l.x - p.y) / (l.y * l.z))).r; }
  if (holds(p, uL1, dist)) { l = uL1; return 2.0 * texture2D(uA1, vec2((p.x + l.x) / (l.y * l.z), (l.x - p.y) / (l.y * l.z))).r; }
  if (holds(p, uL2, dist)) { l = uL2; return 2.0 * texture2D(uA2, vec2((p.x + l.x) / (l.y * l.z), (l.x - p.y) / (l.y * l.z))).r; }
  return 1.0;
}

// the measured ground's shadows, baked (scripts/make-moon-terrain.py): for a point, the elevation angle in degrees of the horizon toward the Sun, read from the finest of the three horizon maps that holds the point
uniform sampler2D uZ0;
uniform sampler2D uZ1;
uniform sampler2D uZ2;
uniform float uHzOn; // 1 where the maps are there
uniform vec3 uHzSun; // the two directions (of 18) the Sun's azimuth lies between, and the share of the second
uniform vec2 uHzRange; // the degrees the codes 0 and 255 stand for

float hzSector(sampler2D s, vec2 cell, float k) {
  float slab = floor(k / 3.0);
  float ch = k - slab * 3.0;
  vec3 v = texture2D(s, vec2((cell.x + slab) / 6.0, cell.y)).rgb;
  return ch < 0.5 ? v.r : (ch < 1.5 ? v.g : v.b);
}

float hzFrom(sampler2D s, vec2 p, float reach) {
  vec2 cell = clamp(vec2((p.x + reach) / (2.0 * reach), (reach - p.y) / (2.0 * reach)), vec2(0.5 / 512.0), vec2(1.0 - 0.5 / 512.0));
  float code = mix(hzSector(s, cell, uHzSun.x), hzSector(s, cell, uHzSun.y), uHzSun.z);
  return uHzRange.x + code * (uHzRange.y - uHzRange.x);
}

float horizonAt(vec2 p) {
  if (abs(p.x) < uL0.x && abs(p.y) < uL0.x) return hzFrom(uZ0, p, uL0.x);
  if (abs(p.x) < uL1.x && abs(p.y) < uL1.x) return hzFrom(uZ1, p, uL1.x);
  if (abs(p.x) < uL2.x && abs(p.y) < uL2.x) return hzFrom(uZ2, p, uL2.x);
  return -90.0;
}

// the spacing of the level that serves a point, for the step of a slope
float spacing(vec2 p, float dist) {
  if (holds(p, uL0, dist)) return uL0.y;
  if (holds(p, uL1, dist)) return uL1.y;
  if (holds(p, uL2, dist)) return uL2.y;
  return uL3.y;
}
`;


/** The made detail, in GLSL: the same formulas as `detail.ts` (craters on a seeded grid, by octave), and a fine roughness for the normals. */
export const DETAIL = /* glsl */ `
uniform float uPixel; // the angle one pixel takes, radians
uniform float uDetail; // 1 for the made detail, 0 for none

uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v = v ^ (v >> 16u);
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v = v ^ (v >> 16u);
  return v;
}
float u24(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }

uniform vec4 uKeep[6]; // the objects the made ground keeps away from: east, north, the distance inside which nothing is made, the distance outside which it all is
uniform float uKeepCount;
float keepMask(vec2 p) {
  float keep = 1.0;
  for (int i = 0; i < 6; i += 1) {
    if (float(i) >= uKeepCount) break;
    vec4 k = uKeep[i];
    float t = clamp((distance(p, k.xy) - k.z) / (k.w - k.z), 0.0, 1.0);
    keep = min(keep, t * t * (3.0 - 2.0 * t));
  }
  return keep;
}

// the made ground at a point: x the height in metres, yz the slope east and north, from every crater of every octave whose nominal diameter is over \`fromD\`
vec3 madeGround(vec2 p, float fromD) {
  vec3 sum = vec3(0.0);
  for (int octave = 5; octave >= 0; octave -= 1) {
    float nominal = 0.5 * exp2(float(octave));
    float fade = clamp(nominal / fromD - 1.0, 0.0, 1.0);
    if (fade <= 0.0) break;
    float cell = 3.0 * nominal;
    ivec2 base = ivec2(floor(p / cell));
    vec2 fr = p / cell - vec2(base);
    float occ = (octave >= 3 ? 0.5 : 1.0) * 0.36 * exp2(-0.5 * float(octave));
    for (int j = -1; j <= 1; j += 1) {
      for (int i = -1; i <= 1; i += 1) {
        // a crater is kept to the middle of its cell, so a neighbour's reaches this cell only within a fifth of the edge
        if ((i == -1 && fr.x > 0.2) || (i == 1 && fr.x < 0.8) || (j == -1 && fr.y > 0.2) || (j == 1 && fr.y < 0.8)) continue;
        ivec2 c = base + ivec2(i, j);
        uvec2 ab = pcg2d(uvec2(uint(c.x), uint(c.y + octave * 7919)));
        if (u24(ab.x) >= occ) continue;
        uvec2 cd = pcg2d(uvec2(uint(c.x + 104729), uint(c.y + octave * 7919 + 15485863)));
        float diameter = nominal * (1.0 + (octave == 5 ? 0.25 : 1.0) * u24(cd.y));
        float r4 = float(ab.x & 255u) / 255.0;
        float age = 1.0 - r4 * r4 * r4 * r4;
        float radius = 0.5 * diameter;
        float vary = 0.6 + 0.4 * (float(cd.x & 255u) / 255.0);
        float depth = diameter * (0.2 - 0.17 * age) * vary;
        float rim = 0.045 * diameter * pow(1.0 - age, 1.5);
        float rimWidth = 0.22 + 0.5 * age;
        vec2 centre = vec2(float(c.x) + 0.25 + 0.5 * u24(ab.y), float(c.y) + 0.25 + 0.5 * u24(cd.x)) * cell;
        vec2 d = p - centre;
        float r = length(d);
        float x = r / radius;
        float h = 0.0;
        float dh = 0.0;
        if (x < 1.0) { float bowl = 1.0 - x * x; float pw = 1.0 + age; h = -depth * pow(bowl, pw); dh = 2.0 * depth * pw * x * pow(bowl, age); }
        float e = (x - 1.0) / rimWidth;
        float ex = exp(-e * e);
        h += rim * ex;
        dh += -2.0 * rim * e * ex / rimWidth;
        if (x > 1.0) { float t = 1.0 / x; h += 0.25 * rim * t * t * t; dh += -0.75 * rim * t * t * t * t; }
        float k = r > 1e-6 ? dh / (radius * r) : 0.0;
        sum += fade * vec3(h, k * d.x, k * d.y);
      }
    }
  }
  return sum * keepMask(p);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  uvec2 c = uvec2(ivec2(i));
  float a = u24(pcg2d(c).x);
  float b = u24(pcg2d(c + uvec2(1u, 0u)).x);
  float cc = u24(pcg2d(c + uvec2(0u, 1u)).x);
  float d = u24(pcg2d(c + uvec2(1u, 1u)).x);
  return mix(mix(a, b, w.x), mix(cc, d, w.x), w.y);
}

// a fine roughness of the dust: two scales, as a slope (east, north), faded out where a pixel covers more than a few of its grains
vec2 roughness(vec2 p, float footprint) {
  vec2 g = vec2(0.0);
  for (int k = 0; k < 2; k += 1) {
    float s = k == 0 ? 0.07 : 0.3;
    float amp = k == 0 ? 0.3 : 0.28;
    float fade = smoothstep(footprint * 2.0, footprint * 7.0, s);
    if (fade <= 0.0) continue;
    float d = s * 0.25;
    vec2 q = (k == 0 ? vec2(p.x * 0.629 + p.y * 0.777, p.y * 0.629 - p.x * 0.777) : vec2(p.x * 0.857 - p.y * 0.515, p.x * 0.515 + p.y * 0.857)) / s;
    float dx = vnoise(q + vec2(0.25, 0.0)) - vnoise(q - vec2(0.25, 0.0));
    float dy = vnoise(q + vec2(0.0, 0.25)) - vnoise(q - vec2(0.0, 0.25));
    g += fade * amp * vec2(dx, dy) / (0.5 * s) * 0.012;
  }
  return g;
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
${DETAIL}
varying vec3 vP;
void main() {
  float r = uRMin * pow(uRMax / uRMin, position.x);
  float a = uYaw + position.y * uSpan;
  vec2 p = uEyeEN + r * vec2(sin(a), cos(a));
  float y = terrainY(p, r, true);
  // the made craters, those the mesh can hold here: bigger than a few of its steps
  if (uDetail > 0.5 && r < 3000.0) y += madeGround(p, max(2.5 * r * uPixel, 0.06 * r)).x;
  vP = vec3(p.x, y, p.y);
  gl_Position = uVP * vec4(p.x, y, -p.y, 1.0);
}
`;

/** What the ground, the rocks and their shadows all need to be lit: the Sun, the eyes, the heights and the made detail, the ground's height with the craters on it, and a point's light (a hard shadow by a march toward the Sun). */
export const LIGHT = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uEye;
uniform vec2 uEyeEN;
uniform float uExposure;
uniform float uAlbedo;
uniform float uMaxY; // the highest ground over the site's, for the end of a shadow's march
uniform float uEarthshine; // the light of the sunlit ground round the shade, a small share of a lit slope's
uniform float uShadows; // 1 for the ground to shadow itself (the default), 0 for none (a try-out)
uniform float uSunDegrees; // the Sun's elevation in degrees
uniform vec3 uNear; // the near march: steps, the distance it reaches in metres, the distance out to which the made craters are in it (the quality of the draw)
${HEIGHTS}
${DETAIL}

// the ground's height at a point: the measured heights and, near the eyes, the made craters (kept to the ones a pixel here can show)
float groundY(vec2 p, float dist, bool fine, float fromD) {
  float y = terrainY(p, dist, fine);
  if (uDetail > 0.5 && fromD < 24.0) y += madeGround(p, fromD).x;
  return y;
}

// 1 where the Sun reaches a point, 0 where the ground is in its way. The measured ground's shadow is read from the baked horizon; the march toward the Sun over the heights (and the made craters) is the near
// field's only, a few tens of metres with a fixed number of steps, as sharp as the Sun's edge. Where there is no baked horizon the march goes all the way, as it did before the maps.
float lit(vec3 P, float dist0) {
  vec2 dir = normalize(uSun.xz);
  float slope = uSun.y / max(length(uSun.xz), 1e-4);
  if (uHzOn > 0.5 && horizonAt(P.xz) - 0.3 > uSunDegrees) return 0.0;
  // the ground at the point from the heights themselves, not the mesh's slope between its corners, which can be a long way off on a far mountain
  P.y = groundY(P.xz, dist0, true, 2.5 * dist0 * uPixel);
  float t = 0.5 * spacing(P.xz, dist0) + 0.25;
  if (uDetail > 0.5) t = min(t, 0.2 + 0.02 * dist0);
  // a pixel's own start along the ray: the edge of a rim's shadow is a line of steps, and a line of steps is jagged; with a start of its own each pixel it becomes a fine grain instead
  float jitter = fract(sin(dot(P.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float range = uHzOn > 0.5 ? uNear.y : 80000.0;
  for (int i = 0; i < 260; i += 1) {
    if (float(i) >= uNear.x) break;
    vec2 q = P.xz + dir * t;
    float y = P.y + slope * t;
    float dist = max(t, distance(q, uEyeEN));
    float res = spacing(q, dist);
    float h = groundY(q, dist, t < 600.0, t < uNear.z ? max(0.2 * t, 2.5 * dist * uPixel) : 99.0);
    float bias = (t < 40.0 ? 0.01 : 0.3 * res) + 0.002 * t;
    if (h > y + bias) return 0.0;
    if (y > uMaxY || t > range) break;
    float step = t < 30.0 ? t * 0.045 + 0.04 : t * 0.06 + 0.5;
    t += step * (0.65 + 0.7 * jitter);
  }
  return 1.0;
}
`;

/** The ground's light. */
export const GROUND_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;
${LIGHT}
varying vec3 vP;

void main() {
  float dist = distance(vP.xz, uEyeEN);
  float fromD = 2.5 * dist * uPixel;
  float e = max(spacing(vP.xz, dist), dist * 0.001);
  float hE = terrainY(vP.xz + vec2(e, 0.0), dist, true);
  float hW = terrainY(vP.xz - vec2(e, 0.0), dist, true);
  float hN = terrainY(vP.xz + vec2(0.0, e), dist, true);
  float hS = terrainY(vP.xz - vec2(0.0, e), dist, true);
  vec2 slope = vec2((hE - hW) / (2.0 * e), (hN - hS) / (2.0 * e));
  if (uDetail > 0.5) {
    if (fromD < 24.0) slope += madeGround(vP.xz, fromD).yz;
    slope += roughness(vP.xz, dist * uPixel);
  }
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
  float mu0 = dot(n, uSun);
  float mu = max(dot(n, normalize(uEye - vP)), 0.03);
  float shine = 0.0;
  if (mu0 > 0.0 && uSun.y > -0.01) shine = (uShadows > 0.5 ? lit(vP, dist) : 1.0) * 2.0 * mu0 / (mu0 + mu);
  float light = uAlbedo * albedoAt(vP.xz, dist) * (shine + uEarthshine * max(n.y, 0.0)) * uExposure;
  gl_FragColor = vec4(vec3(pow(clamp(light, 0.0, 1.0), 1.0 / 2.2)), 1.0);
}
`;

/** The rocks: pieces of ground standing on it. Their corners come from the page already in the site's plane (east, up, north). */
export const ROCK_VERTEX = /* glsl */ `
precision highp float;
// position, normal and uv are declared by three.js
attribute float tone;
uniform mat4 uVP;
varying vec3 vP;
varying vec3 vN;
varying float vTone;
void main() {
  vP = position;
  vN = normal;
  vTone = tone;
  gl_Position = uVP * vec4(position.x, position.y, -position.z, 1.0);
}
`;

export const ROCK_FRAGMENT = /* glsl */ `
precision highp float;
precision highp sampler2D;
${LIGHT}
varying vec3 vP;
varying vec3 vN;
varying float vTone;
void main() {
  vec3 n = normalize(vN);
  float mu0 = dot(n, uSun);
  float mu = max(dot(n, normalize(uEye - vP)), 0.03);
  float dist = distance(vP.xz, uEyeEN);
  float shine = 0.0;
  if (mu0 > 0.0 && uSun.y > -0.01) shine = (uShadows > 0.5 ? lit(vP + n * 0.02, dist) : 1.0) * 2.0 * mu0 / (mu0 + mu);
  float light = uAlbedo * 1.1 * vTone * (shine + 0.12 * (n.y * 0.5 + 0.5)) * uExposure; // the shade of a stone is lit by the ground round it
  gl_FragColor = vec4(vec3(pow(clamp(light, 0.0, 1.0), 1.0 / 2.2)), 1.0);
}
`;

/** A rock's shadow on the ground: a quad laid along the way the Sun's light goes, a soft dark shape, drawn over the ground. */
export const SHADOW_VERTEX = /* glsl */ `
precision highp float;
uniform mat4 uVP;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = uVP * vec4(position.x, position.y, -position.z, 1.0);
}
`;

export const SHADOW_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  float u = vUv.x;
  float across = smoothstep(1.0, 0.5, abs(vUv.y));
  float along = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.78, 1.0, u));
  float a = across * along * 0.85;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
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

/** The rover's traverse as a faint pair of tracks on the ground: a strip along the published line, its heights read from the same pyramid and made craters as the ground, drawn a hair over it. */
export const TRACK_VERTEX = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform mat4 uVP;
uniform vec2 uEyeEN;
${HEIGHTS}
${DETAIL}
varying vec2 vUv;
varying float vDist;
void main() {
  vec2 p = position.xy;
  float dist = distance(p, uEyeEN);
  vUv = uv;
  vDist = dist;
  if (dist > 600.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float y = terrainY(p, dist, true);
  if (uDetail > 0.5) y += madeGround(p, max(2.5 * dist * uPixel, 0.06 * dist)).x;
  y += 0.03 + 0.0007 * dist;
  gl_Position = uVP * vec4(p.x, y, -p.y, 1.0);
}
`;

export const TRACK_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying float vDist;
void main() {
  // two bands, a wheel's width each, a gauge apart, broken a little along the way, fading out with the distance: faint on purpose
  float band = smoothstep(0.11, 0.0, abs(abs(vUv.y) - 0.64));
  float broken = 0.65 + 0.35 * fract(sin(floor(vUv.x * 3.0) * 12.9898) * 43758.5453);
  float a = band * broken * 0.14 * (1.0 - smoothstep(250.0, 600.0, vDist));
  if (a < 0.004) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;

/** The things at a site: the rocks' light, with a flat colour for each corner (the gold of the lunar module's foil, the grey of the rover's frame). */
export const OBJECT_VERTEX = ROCK_VERTEX.replace("attribute float tone;", "attribute float tone;\nattribute vec3 tint;").replace("varying float vTone;", "varying float vTone;\nvarying vec3 vTint;").replace("vTone = tone;", "vTone = tone;\n  vTint = tint;");
export const OBJECT_FRAGMENT = ROCK_FRAGMENT.replace("varying float vTone;", "varying float vTone;\nvarying vec3 vTint;").replace("gl_FragColor = vec4(vec3(pow(clamp(light, 0.0, 1.0), 1.0 / 2.2)), 1.0);", "gl_FragColor = vec4(pow(clamp(vec3(light) * vTint, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);");
