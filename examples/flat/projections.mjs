import { PROJECTIONS, graticule, projectMap, resampleMap, unprojectMap } from "@johnmorrisdotca/wakusei-planets/flat";

// Where Olympus Mons on Mars (18.65 degrees north, 133.8 degrees west) falls on each map, in radii from the middle, and the way back.
for (const projection of PROJECTIONS) {
  const { x, y } = projectMap(projection, -133.8, 18.65);
  const back = unprojectMap(projection, x, y);
  console.log(`${projection}: ${x.toFixed(2)}, ${y.toFixed(2)}; back at ${back.lat.toFixed(2)}, ${back.lon.toFixed(2)}`);
}

// The lines of a 30 degree grid on a Mollweide map, and a painted map of two pixels redrawn on it.
console.log(`${graticule("mollweide", 30).length} lines`);
const picture = { width: 2, height: 1, data: [255, 0, 0, 255, 0, 0, 255, 255] };
const answer = resampleMap(picture, "mollweide", 40, 20);
console.log(`${answer.length / 4} pixels, the corner is ${answer[3] === 0 ? "empty" : "drawn"}`);
