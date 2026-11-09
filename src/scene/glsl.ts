// The shader code shared by every body: noise, craters and bands for the realistic look, the lighting, and the ring and glow shaders. Strings only.

export const VERTEX = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
void main() {
  vObj = vec3(position.z, position.x, position.y);
  vN = normalize(normalMatrix * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** Noise, craters and the band palette, for the surface code of a body to call. */
export const PRELUDE = /* glsl */ `
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// Noise that knows how big a pixel is: an octave finer than the pixel can show is replaced by its average (0.5) instead of being sampled, so a small body is smooth and not a spray of pixel-sized specks.
float fbm(vec3 p) { float fw = length(fwidth(p)); float a = 0.5; float s = 0.0; for (int i = 0; i < 5; i++) { s += a * mix(0.5, vnoise(p), 1.0 - smoothstep(0.3, 0.7, fw)); p = p * 2.03 + vec3(1.7, 9.2, 3.1); fw *= 2.03; a *= 0.5; } return s; }
// Craters: a bowl and a raised rim in each cell that has one. Returns a height, negative in a bowl. A crater smaller than about two pixels fades out (it would only be noise).
float craters(vec3 p, float freq, float amp, float seed) {
  vec3 q = p * freq + seed; vec3 ip = floor(q); float h = 0.0;
  float fw = length(fwidth(q));
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 c = ip + vec3(float(x), float(y), float(z));
    float on = step(0.52, hash13(c + 3.7));
    vec3 ctr = c + hash33(c);
    float rad = mix(0.12, 0.36, hash13(c + 17.3));
    float d = length(q - ctr) / rad;
    float bowl = d < 1.0 ? (d * d - 1.0) : 0.0;
    float rim = d >= 1.0 ? exp(-pow((d - 1.0) * 5.0, 2.0)) * 0.3 * smoothstep(1.0, 1.08, d) : 0.0;
    h += on * amp * rad * (bowl + rim) * (1.0 - smoothstep(0.35, 0.9, fw / rad));
  }
  return h;
}
float lon(vec3 p) { return atan(p.y, p.x); }
float lat(vec3 p) { return asin(clamp(p.z, -1.0, 1.0)); }
float wrapPi(float a) { return a - 6.2831853 * floor((a + 3.1415927) / 6.2831853); }
vec3 dirOf(float lonDeg, float latDeg) { float lo = radians(lonDeg); float la = radians(latDeg); return vec3(cos(la) * cos(lo), cos(la) * sin(lo), sin(la)); }
// One big round bowl with a rim, by longitude, latitude and angular radius in degrees. Negative inside.
float bowl(vec3 p, float lonDeg, float latDeg, float radDeg, float depth) {
  float d = acos(clamp(dot(p, dirOf(lonDeg, latDeg)), -1.0, 1.0)) / radians(radDeg);
  return d < 1.0 ? depth * (d * d - 1.0) : depth * exp(-pow((d - 1.0) * 5.0, 2.0)) * 0.3 * smoothstep(1.0, 1.08, d);
}
// A soft oval on the body, 1 inside and 0 outside, by longitude and latitude in degrees.
float oval(vec3 p, float lon0, float lat0, float rx, float ry, float soft) {
  float dx = wrapPi(lon(p) - radians(lon0)) * cos(radians(lat0)) / radians(rx);
  float dy = (lat(p) - radians(lat0)) / radians(ry);
  return 1.0 - smoothstep(1.0 - soft, 1.0, sqrt(dx * dx + dy * dy));
}`;

/** The fragment shader of a body: the surface code goes between the prelude and `main`. `limbTint` is the colour the edge of a glowing body shifts to (default the Sun's orange). */
export function bodyFragment(surface: string, painted: boolean, world = false, limbTint?: readonly [number, number, number]): string {
  const tint = limbTint === undefined ? "vec3(1.0, 0.55, 0.25)" : `vec3(${limbTint.map((v) => v.toFixed(4)).join(", ")})`;
  return /* glsl */ `
precision highp float;
uniform vec3 uLight;
uniform float uRelief;
uniform float uAmbient;
uniform float uLimb;
uniform float uWrap;
uniform vec3 uAtmos;
uniform float uAtmosPow;
uniform float uRimBase;
uniform float uEmissive;
${painted ? "uniform float uMark;" : ""}
uniform vec3 uRingN;
uniform vec2 uRingR;
uniform float uRingOn;
uniform sampler2D uRingTex;
${painted ? "uniform sampler2D uMap;" : ""}
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
${world ? "varying vec3 vV;\nuniform int uOccN;\nuniform vec4 uOcc[6];" : ""}
${PRELUDE}
${surface}
void main() {
  vec3 p = normalize(vObj);
  vec4 s = surface(p);
  vec3 n = normalize(vN);
  float mu = ${world ? "clamp(dot(n, normalize(vV)), 0.0, 1.0)" : "clamp(n.z, 0.0, 1.0)"};
  if (uEmissive > 0.5) {
    float edge = pow(mu, uLimb);
    vec3 c = s.rgb * mix(${tint}, vec3(1.0), edge) * (0.55 + 0.45 * edge);
    gl_FragColor = vec4(c, 1.0);
    return;
  }
  float dg = dot(n, uLight);
  vec3 dpx = dFdx(vW); vec3 dpy = dFdy(vW);
  float hx = dFdx(s.a); float hy = dFdy(s.a);
  vec3 grad = cross(dpy, n) * hx + cross(n, dpx) * hy;
  float det = dot(dpx, cross(dpy, n));
  // relief is worked out from differences between neighbouring pixels, which cannot show a bump only a few pixels wide: on a small disc it fades out and the colour alone carries the craters
  float reliefLod = 1.0 - smoothstep(0.008, 0.024, length(fwidth(p)));
  vec3 nb = normalize(abs(det) * n - sign(det) * uRelief * reliefLod * grad * 22.0);
  float d = dot(nb, uLight);
  float diff = clamp((d + uWrap) / (1.0 + uWrap), 0.0, 1.0) * smoothstep(-0.02 - uWrap * 0.6, 0.1 + uWrap * 0.8, dg);
  if (uRingOn > 0.5) {
    float den = dot(uLight, uRingN);
    if (abs(den) > 1e-3) {
      float t = -dot(vW, uRingN) / den;
      if (t > 0.0) {
        vec3 hp = vW + t * uLight;
        float u = (length(hp) - uRingR.x) / (uRingR.y - uRingR.x);
        if (u > 0.0 && u < 1.0) diff *= 1.0 - 0.88 * texture2D(uRingTex, vec2(u, 0.5)).a;
      }
    }
  }
${world ? `  for (int i = 0; i < 6; i++) {
    if (i >= uOccN) break;
    vec3 oc = uOcc[i].xyz - vW;
    float along = dot(oc, uLight);
    if (along > 0.0) {
      float miss = length(oc - along * uLight);
      diff *= 1.0 - 0.92 * (1.0 - smoothstep(uOcc[i].w * 0.8, uOcc[i].w * 1.04 + 0.01, miss));
    }
  }` : ""}
  vec3 alb = pow(s.rgb, vec3(2.2));
  vec3 lit = alb * (uAmbient + (1.0 - uAmbient) * diff * 1.18);
  float rim = pow(1.0 - mu, uAtmosPow);
  lit += pow(uAtmos, vec3(2.2)) * rim * (uRimBase + (1.0 - uRimBase) * clamp(dg * 1.6 + 0.35, 0.0, 1.0));
  lit *= mix(1.0, pow(mu, 0.45), uLimb);
  gl_FragColor = vec4(pow(lit, vec3(1.0 / 2.2)), 1.0);
}`;
}

/** A painted body's surface code: the map by longitude and latitude, with the seam at 180 degrees left alone. */
export const PAINTED_SURFACE = /* glsl */ `
vec4 surface(vec3 p) {
  float u1 = atan(p.y, p.x) / 6.2831853 + 0.5;
  float u2 = fract(u1 + 0.5) - 0.5;
  float v = asin(clamp(p.z, -1.0, 1.0)) / 3.1415927 + 0.5;
  vec2 a = vec2(u1, v); vec2 b = vec2(u2, v);
  vec2 ax = dFdx(a); vec2 ay = dFdy(a); vec2 bx = dFdx(b); vec2 by = dFdy(b);
  bool useA = dot(ax, ax) + dot(ay, ay) <= dot(bx, bx) + dot(by, by);
  vec3 c = textureGrad(uMap, useA ? a : b, useA ? ax : bx, useA ? ay : by).rgb;
  // A map of plain bands is the same at every longitude, so the body turns and the picture does not. The wave, the spot and the polar hexagon move with the surface.
  if (uMark > 0.5) {
    float lon = atan(p.y, p.x);
    float lat = asin(clamp(p.z, -1.0, 1.0));
    float wave = sin(lon * 4.0 + lat * 6.0);
    float belt = 1.0 - smoothstep(1.15, 1.45, abs(lat));
    c *= 0.86 + 0.22 * (0.5 + 0.5 * wave) * belt;
    if (uMark > 1.5) {
      float ang = atan(p.y, p.x);
      float radius = length(p.xy);
      float hexR = 0.26 + 0.045 * cos(ang * 6.0);
      float hex = (1.0 - smoothstep(0.0, 0.028, abs(radius - hexR))) * smoothstep(0.42, 0.68, p.z);
      c = mix(c, vec3(0.45, 0.55, 0.68), hex);
    } else {
      float spot = exp(-pow((lat - 0.32) / 0.2, 2.0) - pow(lon / 0.5, 2.0));
      c = mix(c, c * vec3(0.28, 0.34, 0.5), clamp(spot, 0.0, 1.0));
    }
  }
  return vec4(c, dot(c, vec3(0.3, 0.59, 0.11)));
}`;

export const RING_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uRingTex;
uniform vec2 uRingR;
uniform vec3 uLight;
uniform vec3 uRingN;
varying vec3 vL;
varying vec3 vW;
void main() {
  float u = (length(vL.xy) - uRingR.x) / (uRingR.y - uRingR.x);
  if (u < 0.0 || u > 1.0) discard;
  vec4 t = texture2D(uRingTex, vec2(u, 0.5));
  float nl = dot(uRingN, uLight);
  float side = nl * uRingN.z;
  float bright = 0.16 + 0.84 * clamp(abs(nl) * 2.0, 0.0, 1.0);
  if (side < 0.0) bright *= 0.38;
  float b = dot(vW, uLight);
  float closest = sqrt(max(dot(vW, vW) - b * b, 0.0));
  float shadow = b < 0.0 ? smoothstep(1.02, 0.97, closest) : 0.0;
  vec3 c = pow(t.rgb, vec3(2.2)) * bright * (1.0 - 0.93 * shadow);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), t.a);
}`;

export const RING_VERTEX = /* glsl */ `
varying vec3 vL;
varying vec3 vW;
void main() {
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;


/**
 * The body's vertex shader for a perspective camera and a body anywhere in the scene: the normal and the position are in the scene's axes, the position in body radii from the body's centre
 * (`uScale` is the body's size in scene units), and `vV` points at the camera.
 */
export const VERTEX_WORLD = /* glsl */ `
uniform float uScale;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
varying vec3 vV;
void main() {
  vObj = vec3(position.z, position.x, position.y);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
  vW = mat3(modelMatrix) * position / uScale;
  vV = cameraPosition - w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** The ring's vertex shader for a perspective camera, with the same frame as `VERTEX_WORLD`. */
export const RING_VERTEX_WORLD = /* glsl */ `
uniform float uScale;
varying vec3 vL;
varying vec3 vW;
varying vec3 vV;
void main() {
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = mat3(modelMatrix) * position / uScale;
  vV = cameraPosition - w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** The ring's fragment shader for a perspective camera: which side is seen comes from the direction to the camera. */
export const RING_FRAGMENT_WORLD = RING_FRAGMENT.replace("varying vec3 vW;", "varying vec3 vW;\nvarying vec3 vV;").replace("float side = nl * uRingN.z;", "float side = nl * dot(uRingN, normalize(vV));");

export const GLOW_VERTEX = /* glsl */ `
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const GLOW_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vP;
uniform vec3 uColour;
void main() {
  float r = length(vP);
  if (r < 0.98) discard;
  float a = exp(-(r - 1.0) * 2.4) * 0.62;
  float streak = 0.82 + 0.18 * sin(atan(vP.y, vP.x) * 9.0 + r * 3.0);
  a *= streak * smoothstep(3.0, 1.6, r);
  gl_FragColor = vec4(uColour * a, a);
}`;

/**
 * The glow round a star that is not the Sun, drawn on a plane behind it: a wide soft bloom, a tight bright inner bloom, a thin glowing edge (the chromosphere), and, on an active star, prominences standing off the edge
 * with an occasional flare. `uStrength` is how bright, `uSpread` how fast the bloom fades, `uRim` the edge, `uProm` how big the prominences are, `uSeed` where they are and `uTime` moves them.
 */
export const STAR_GLOW_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vP;
uniform vec3 uColour;
uniform float uStrength;
uniform float uSpread;
uniform float uRim;
uniform float uProm;
uniform float uSeed;
uniform float uTime;
float h1(float n) { return fract(sin(n * 127.1 + uSeed * 91.7) * 43758.5453); }
float n1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
void main() {
  float r = length(vP);
  if (r < 0.98) discard;
  float x = r - 1.0;
  float fade = smoothstep(3.0, 1.6, r);
  float halo = exp(-x * uSpread) * uStrength;
  float tight = exp(-x * 14.0) * uStrength * 0.9;
  float rim = exp(-x * 60.0) * uRim;
  vec3 col = uColour * (halo + tight) + mix(uColour, vec3(1.0), 0.4) * rim;
  float a = halo + tight + rim;
  if (uProm > 0.0) {
    float ang = atan(vP.y, vP.x);
    float site = smoothstep(0.55, 0.85, n1(ang * 2.6 + uSeed * 20.0));
    float drift = 0.75 + 0.25 * sin(uTime * 0.5 + ang * 4.0);
    float height = site * uProm * 0.3 * drift;
    float strands = 0.65 + 0.35 * n1(ang * 70.0 + uTime * 0.3);
    float pr = step(0.0, x) * pow(smoothstep(height, 0.0, x), 1.6) * site * strands * 0.9;
    vec3 pc = mix(vec3(1.0, 0.42, 0.26), uColour, 0.2);
    float a0 = uSeed * 6.2831853 + uTime * 0.02;
    float da = atan(sin(ang - a0), cos(ang - a0));
    float burst = pow(max(0.0, sin(uTime * 0.9 + uSeed * 40.0)), 24.0) * uProm;
    float fl = exp(-da * da * 14.0) * exp(-x * 6.0) * burst * 1.6;
    col += pc * pr + vec3(1.0, 0.92, 0.75) * fl;
    a += pr + fl;
  }
  // additive blending multiplies by alpha, so the root of the light is the alpha and the colour carries the rest: the sum arrives as written
  float s = sqrt(min(a * fade, 1.0));
  gl_FragColor = vec4(col / max(a, 1e-4) * s, s);
}`;

/** A cheap lit ball for a moon seen small beside its planet. */
export const BALL_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uLight;
uniform vec3 uColour;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
${PRELUDE}
void main() {
  vec3 n = normalize(vN);
  float shade = 0.82 + 0.3 * (fbm(normalize(vObj) * 4.0) - 0.5);
  float diff = max(dot(n, uLight), 0.0);
  vec3 c = pow(uColour * shade, vec3(2.2)) * (0.04 + 1.1 * diff);
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;
