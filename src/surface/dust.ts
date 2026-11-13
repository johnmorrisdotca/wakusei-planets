// The dust a wheel throws: grains in free flight. On the Moon there is no air, so a grain thrown up and back goes in a clean parabola at the Moon's gravity and falls where it falls: no cloud, no drift. The field is
// a fixed pool of grains, each with a place, a velocity and an age; a step moves them and lets them go when they reach the ground or are old. Made, not measured: how many grains, how fast, how big. No DOM.

/** The Moon's surface gravity, m/s2. */
const G = 1.62;

/**
 * A pool of grains in flight, made with `new DustField(size, seed)`: `size` is how many grains it holds (the oldest is reused when it is full) and `seed` makes the scatter the same for the same drive.
 *
 * @param size - How many grains the pool holds.
 * @param seed - A seed for the scatter.
 *
 * @example
 * ```ts
 * import { DustField } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const dust = new DustField(64, 1);
 * dust.emit([0, 0.3, 0], [2, 1.5, 0], 2);
 * dust.step(0.5, () => 0);
 * console.log(dust.live, dust.position[1]!.toFixed(2));
 * ```
 */
export class DustField {
  /** Each grain's place, three numbers (east, up, north), and its velocity; a grain not in flight sits far below the ground. */
  readonly position: Float32Array;
  readonly velocity: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  #next = 0;
  #seed: number;
  /** The grains in flight. */
  live = 0;

  /**
   * @param size - How many grains the pool holds; the oldest is reused when it is full.
   * @param seed - A seed for the scatter, so the same drive is the same.
   */
  constructor(size: number, seed = 1) {
    this.position = new Float32Array(size * 3).fill(0);
    this.velocity = new Float32Array(size * 3);
    this.age = new Float32Array(size).fill(1e9);
    this.life = new Float32Array(size).fill(0);
    this.#seed = seed >>> 0 || 1;
    for (let i = 0; i < size; i += 1) this.position[i * 3 + 1] = -1e5;
  }

  /** A number from 0 to 1 that is the same for the same seed (mulberry32). */
  #random(): number {
    this.#seed = (this.#seed + 0x6d2b79f5) >>> 0;
    let t = this.#seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Throw one grain: from a place, with a velocity, scattered a little, for up to `life` seconds.
   *
   * @param from - East, up, north in metres.
   * @param velocity - East, up, north in metres a second.
   * @param life - The longest it flies, in seconds.
   */
  emit(from: readonly [number, number, number], velocity: readonly [number, number, number], life: number): void {
    const i = this.#next;
    this.#next = (this.#next + 1) % this.age.length;
    const scatter = 0.35;
    this.position.set(from, i * 3);
    this.velocity[i * 3] = velocity[0] + (this.#random() - 0.5) * scatter * 2;
    this.velocity[i * 3 + 1] = velocity[1] * (0.7 + 0.6 * this.#random());
    this.velocity[i * 3 + 2] = velocity[2] + (this.#random() - 0.5) * scatter * 2;
    this.age[i] = 0;
    this.life[i] = life * (0.6 + 0.4 * this.#random());
  }

  /**
   * Move every grain on: its velocity falls at the Moon's gravity and it goes where the velocity takes it; a grain that reaches the ground, or is older than its life, is let go.
   *
   * @param dt - Seconds.
   * @param ground - The ground's height over the site's ground at a place.
   */
  step(dt: number, ground: (east: number, north: number) => number): void {
    let live = 0;
    for (let i = 0; i < this.age.length; i += 1) {
      if (this.age[i]! >= this.life[i]!) continue;
      this.age[i]! += dt;
      this.velocity[i * 3 + 1]! -= G * dt;
      const [x, y, z] = [this.position[i * 3]! + this.velocity[i * 3]! * dt, this.position[i * 3 + 1]! + this.velocity[i * 3 + 1]! * dt, this.position[i * 3 + 2]! + this.velocity[i * 3 + 2]! * dt];
      if (this.age[i]! >= this.life[i]! || y < ground(x, z)) {
        this.age[i] = 1e9;
        this.position[i * 3 + 1] = -1e5;
        continue;
      }
      this.position[i * 3] = x;
      this.position[i * 3 + 1] = y;
      this.position[i * 3 + 2] = z;
      live += 1;
    }
    this.live = live;
  }
}
