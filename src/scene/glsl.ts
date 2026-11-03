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
float fbm(vec3 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
// Craters: a bowl and a raised rim in each cell that has one. Returns a height, negative in a bowl.
float craters(vec3 p, float freq, float amp, float seed) {
  vec3 q = p * freq + seed; vec3 ip = floor(q); float h = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 c = ip + vec3(float(x), float(y), float(z));
    float on = step(0.52, hash13(c + 3.7));
    vec3 ctr = c + hash33(c);
    float rad = mix(0.12, 0.36, hash13(c + 17.3));
    float d = length(q - ctr) / rad;
    float bowl = d < 1.0 ? (d * d - 1.0) : 0.0;
    float rim = d >= 1.0 ? exp(-pow((d - 1.0) * 5.0, 2.0)) * 0.3 : 0.0;
    h += on * amp * rad * (bowl + rim);
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
  return d < 1.0 ? depth * (d * d - 1.0) : depth * exp(-pow((d - 1.0) * 5.0, 2.0)) * 0.3;
}
// A soft oval on the body, 1 inside and 0 outside, by longitude and latitude in degrees.
float oval(vec3 p, float lon0, float lat0, float rx, float ry, float soft) {
  float dx = wrapPi(lon(p) - radians(lon0)) * cos(radians(lat0)) / radians(rx);
  float dy = (lat(p) - radians(lat0)) / radians(ry);
  return 1.0 - smoothstep(1.0 - soft, 1.0, sqrt(dx * dx + dy * dy));
}`;

/** The fragment shader of a body: the surface code goes between the prelude and `main`. */
export function bodyFragment(surface: string, painted: boolean, world = false): string {
  return /* glsl */ `
precision highp float;
uniform vec3 uLight;
uniform float uRelief;
uniform float uAmbient;
uniform float uLimb;
uniform float uWrap;
uniform vec3 uAtmos;
uniform float uAtmosPow;
uniform float uEmissive;
uniform vec3 uRingN;
uniform vec2 uRingR;
uniform float uRingOn;
uniform sampler2D uRingTex;
${painted ? "uniform sampler2D uMap;" : ""}
varying vec3 vObj;
varying vec3 vN;
varying vec3 vW;
${world ? "varying vec3 vV;" : ""}
${PRELUDE}
${surface}
void main() {
  vec3 p = normalize(vObj);
  vec4 s = surface(p);
  vec3 n = normalize(vN);
  float mu = ${world ? "clamp(dot(n, normalize(vV)), 0.0, 1.0)" : "clamp(n.z, 0.0, 1.0)"};
  if (uEmissive > 0.5) {
    float edge = pow(mu, uLimb);
    vec3 c = s.rgb * mix(vec3(1.0, 0.55, 0.25), vec3(1.0), edge) * (0.55 + 0.45 * edge);
    gl_FragColor = vec4(c, 1.0);
    return;
  }
  float dg = dot(n, uLight);
  vec3 dpx = dFdx(vW); vec3 dpy = dFdy(vW);
  float hx = dFdx(s.a); float hy = dFdy(s.a);
  vec3 grad = cross(dpy, n) * hx + cross(n, dpx) * hy;
  float det = dot(dpx, cross(dpy, n));
  vec3 nb = normalize(abs(det) * n - sign(det) * uRelief * grad * 22.0);
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
  vec3 alb = pow(s.rgb, vec3(2.2));
  vec3 lit = alb * (uAmbient + (1.0 - uAmbient) * diff * 1.18);
  float rim = pow(1.0 - mu, uAtmosPow);
  lit += pow(uAtmos, vec3(2.2)) * rim * (0.12 + 0.88 * clamp(dg * 1.6 + 0.35, 0.0, 1.0));
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
