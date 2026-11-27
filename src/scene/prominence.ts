import { cross, type Vec3 } from "../vec.ts";

/**
 * Where the prominences sit, so they stay on the surface as the star turns.
 * `spin` is the longitude facing the camera, `pole` is that pole's angle in the glow plane, and `tilt` is how far the pole leans toward the camera (1 looks straight at it).
 */
export function prominenceFrame(pole: Vec3, meridian: Vec3, glowRotationZ = 0): { spin: number; pole: number; tilt: number } {
  const east = cross(pole, meridian);
  const face = east[2] * east[2] + meridian[2] * meridian[2];
  const sky = Math.atan2(meridian[1], meridian[0]);
  const spin = face > 1e-4 ? Math.atan2(east[2], meridian[2]) : -sky;
  const px = pole[0];
  const py = pole[1];
  const screen = px * px + py * py > 1e-8 ? Math.atan2(py, px) : 0;
  return { spin, pole: screen - glowRotationZ, tilt: pole[2] };
}
