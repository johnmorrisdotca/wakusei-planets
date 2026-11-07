// Shared physical meanings; no runtime imports or branded-number conversions.
/** Geodetic degrees north/east and optional metres above the WGS 84 ellipsoid.
 * Direction-only rotations ignore height. Parallax uses ellipsoidal height.
 * Event dip retains the supplied height as height above the visible horizon;
 * no geoid or terrain correction is inferred from these coordinates.
 */
export interface Observer { latitude: number; longitude: number; heightM?: number }
/** Right ascension [0,360) and declination [-90,90], in degrees; frame belongs to the caller. */
export interface EquatorialAngles { rightAscension: number; declination: number }
/** Azimuth clockwise from north and altitude, both in degrees. */
export interface HorizontalAngles { azimuth: number; altitude: number }
