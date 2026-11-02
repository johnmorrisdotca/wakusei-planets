# Notice

Wakusei Planets is original work by John Morris, under the MIT licence in `LICENSE`.

## The numbers

No picture is used by the line and shaded looks: they are drawn from numbers.

- **Sizes, flattening, axial tilt, poles and rotation**: the IAU Working Group on Cartographic Coordinates and Rotational Elements, B. A. Archinal et al. (2018), "Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015", Celestial Mechanics and Dynamical Astronomy 130:22, and NASA's planetary and satellite fact sheets (https://nssdc.gsfc.nasa.gov/planetary/factsheet/, read 2026-11-02). Facts are not copyrightable; the values were typed from these sources.
- **Planet positions**: JPL Solar System Dynamics, "Keplerian Elements for Approximate Positions of the Major Planets", Table 1, 1800 AD to 2050 AD (https://ssd.jpl.nasa.gov/planets/approx_pos.html, read 2026-11-02; Pluto from the same page's earlier edition). NASA/JPL content is not subject to copyright in the United States; credit: NASA/JPL-Caltech.
- **Moons' orbits**: JPL Solar System Dynamics, "Planetary Satellite Mean Elements" (https://ssd.jpl.nasa.gov/sats/elem/, read 2026-11-02), made into `src/data/orbits.ts` by `scripts/make-moon-data.py`. Credit: NASA/JPL-Caltech; the elements are from R. A. Jacobson and colleagues' ephemerides cited on that page.
- **The Moon's position**: the largest terms of the series in Jean Meeus, "Astronomical Algorithms" (2nd edition), chapter 47, written out here as numbers; the mean arguments are the standard ones.

The tests compare the Galilean moons and four planets with astronomy-engine (MIT, https://github.com/cosinekitty/astronomy), a development dependency that is never shipped.

## Surface pictures

None yet. When the painted looks arrive, each picture will be listed here with its source and licence, checked per file.

NASA says its content "generally are not subject to copyright in the United States" and asks for acknowledgement (https://www.nasa.gov/nasa-brand-center/images-and-media/). This package is not endorsed by NASA and uses none of NASA's insignia or logotype.
