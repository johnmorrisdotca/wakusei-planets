// The sky behind the planets, from hoshi-stars: the bright stars, the constellation figures and a ribbon of the Milky Way.
// Drawn only when `<wakusei-space sky>` asks. The group sits on the camera, just inside the far plane, so the planets stand in front of it.
import { RAD, toEcliptic, type Vec3 } from "../vec.ts";

/** A right ascension and declination (degrees, J2000) as a unit vector in the scene, which is the ecliptic. */
export function skyDirection(rightAscension: number, declination: number): Vec3 {
  const ra = rightAscension * RAD;
  const dec = declination * RAD;
  return toEcliptic([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]);
}

interface SkyObject {
  frustumCulled: boolean;
  renderOrder: number;
}
interface SkyGroup extends SkyObject {
  add(child: SkyObject): void;
  visible: boolean;
  position: { set(x: number, y: number, z: number): void };
  scale: { setScalar(value: number): void };
}
interface SkyGeometry {
  setAttribute(name: string, attribute: unknown): void;
}
interface SkyThree {
  Group: new () => SkyGroup;
  BufferGeometry: new () => SkyGeometry;
  BufferAttribute: new (array: Float32Array, itemSize: number) => unknown;
  Points: new (geometry: SkyGeometry, material: unknown) => SkyObject;
  PointsMaterial: new (parameters: object) => unknown;
  LineSegments: new (geometry: SkyGeometry, material: unknown) => SkyObject;
  LineBasicMaterial: new (parameters: object) => unknown;
}
interface SkyCamera {
  position: { x: number; y: number; z: number };
  far: number;
}

const placed = (direction: Vec3, at: number, out: Float32Array): void => {
  out[at] = direction[0];
  out[at + 1] = direction[1];
  out[at + 2] = direction[2];
};

const toneOf = (hex: string, magnitude: number): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  const tone = Math.max(0.22, Math.min(1, 10 ** (-0.35 * (magnitude - 0.4))));
  return [((n >> 16) & 255) / 255 * tone, ((n >> 8) & 255) / 255 * tone, (n & 255) / 255 * tone];
};

const linesOf = (three: SkyThree, pairs: Vec3[], colour: number, opacity: number): SkyObject => {
  const positions = new Float32Array(pairs.length * 3);
  pairs.forEach((direction, index) => placed(direction, index * 3, positions));
  const geometry = new three.BufferGeometry();
  geometry.setAttribute("position", new three.BufferAttribute(positions, 3));
  const lines = new three.LineSegments(geometry, new three.LineBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false }));
  lines.frustumCulled = false;
  lines.renderOrder = -1;
  return lines;
};

/** The sky group, or null where this three has no points. hoshi-stars is loaded only here. */
export async function createStarSky(three: SkyThree): Promise<SkyGroup | null> {
  if (typeof three.Points !== "function" || typeof three.LineSegments !== "function") return null;
  const [{ stars, starColour }, { figures }, { milkyWayBands }] = await Promise.all([
    import("@johnmorrisdotca/hoshi-stars"),
    import("@johnmorrisdotca/hoshi-stars/lines"),
    import("@johnmorrisdotca/hoshi-stars/milky-way"),
  ]);
  const list = stars();
  const positions = new Float32Array(list.length * 3);
  const colours = new Float32Array(list.length * 3);
  list.forEach((star, index) => {
    placed(skyDirection(star.rightAscension, star.declination), index * 3, positions);
    const [r, g, b] = toneOf(starColour(star), star.magnitude);
    colours[index * 3] = r;
    colours[index * 3 + 1] = g;
    colours[index * 3 + 2] = b;
  });
  const starsGeometry = new three.BufferGeometry();
  starsGeometry.setAttribute("position", new three.BufferAttribute(positions, 3));
  starsGeometry.setAttribute("color", new three.BufferAttribute(colours, 3));
  const points = new three.Points(starsGeometry, new three.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  points.frustumCulled = false;
  points.renderOrder = -1;

  const figure: Vec3[] = [];
  for (const one of figures()) for (const [a, b] of one.segments) {
    figure.push(skyDirection(a.rightAscension, a.declination), skyDirection(b.rightAscension, b.declination));
  }
  const band: Vec3[] = [];
  for (const level of milkyWayBands([0.35], { step: 2 })) for (const strip of level.strips) for (const edge of [strip.upper, strip.lower]) {
    for (let i = 1; i < edge.length; i += 1) {
      const prev = edge[i - 1]!;
      const next = edge[i]!;
      band.push(skyDirection(prev.rightAscension, prev.declination), skyDirection(next.rightAscension, next.declination));
    }
  }
  const group = new three.Group();
  group.add(points);
  group.add(linesOf(three, figure, 0x9bb0d0, 0.4));
  group.add(linesOf(three, band, 0xd5def2, 0.28));
  group.frustumCulled = false;
  group.renderOrder = -1;
  return group;
}

/** Keep the sky around the camera, inside the far plane, so a move through the system does not leave it behind. */
export function holdStarSky(group: Pick<SkyGroup, "position" | "scale">, camera: SkyCamera): void {
  group.position.set(camera.position.x, camera.position.y, camera.position.z);
  group.scale.setScalar(Math.max(camera.far * 0.6, 1));
}
