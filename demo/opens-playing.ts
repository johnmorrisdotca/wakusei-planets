/**
 * Whether a view's clock starts running.
 * It runs when the address asks for play, and when the address names neither play, a date nor a speed and the reader has not asked for reduced motion.
 * A link that names a date or a speed, with play left out, stays still.
 */
export function opensPlaying(address: { play: string | null; time: string | null; speed: string | null }, reducedMotion: boolean): boolean {
  if (address.play === "on") return true;
  if (reducedMotion) return false;
  return address.play === null && address.time === null && address.speed === null;
}
