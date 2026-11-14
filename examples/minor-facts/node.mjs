import { MINOR_FACTS, periodYears } from "@johnmorrisdotca/wakusei-planets/minor-facts";

// What is known of two small bodies: the size of the orbit (its semi-major axis), the period and who found it, each with the uncertainty the Small-Body Database gives. Plain data, no browser, no clock read.
for (const id of ["halley", "eris"]) {
  const body = MINOR_FACTS[id];
  const a = body.orbit.semiMajorAxisAu;
  console.log(`${body.designation}: semi-major axis ${a.value.toFixed(1)} au, period ${periodYears(body).toFixed(1)} years, found ${body.discovery.date} by ${body.discovery.by[0]} (read ${body.source.read})`);
}
