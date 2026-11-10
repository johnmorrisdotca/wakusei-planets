import { createSourceBook, creditLine, smallBodyAt } from "@johnmorrisdotca/wakusei-planets/door";

// A source of your own: here two small bodies held in memory (the second has a number that is not one, so it is left out). A real one would read a catalogue, and says whose it is and under what licence.
const mine = {
  kind: "records",
  info: {
    id: "my-rocks",
    name: { en: "My rocks", ja: "私の小天体" },
    credit: { en: "My rocks, A. Person (2026)", ja: "私の小天体（A. Person、2026年）" },
    licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
    url: "https://example.org/my-rocks",
    retrieved: "2026-11-10",
  },
  records: () => [
    { name: "Ceres", a: 2.7656, e: 0.0795, i: 10.588, node: 80.25, peri: 73.3, M0: 291.4, epoch: 2461000.5, H: 3.34 },
    { name: "Broken", a: Number.NaN, e: 0.1, i: 5, node: 0, peri: 0, M0: 0, epoch: 2461000.5, H: 12 },
  ],
};

// An element keeps a book like this one: `space.addSource(mine)` is `book.addSource(mine)`.
const book = createSourceBook();
book.addSource(mine);
await book.ready();
const [ceres] = book.smallBodies();
const [x, y, z] = smallBodyAt(ceres, 2461000.5);
console.log(`${book.smallBodies().length} small body, ${book.stats().records["my-rocks"].skipped} left out: ${ceres.name} is ${Math.hypot(x, y, z).toFixed(2)} au from the Sun`);
const credits = [{ source: mine.info, own: false, used: book.smallBodies().length }];
console.log(creditLine(credits, "en"));
console.log(creditLine(credits, "ja"));

book.enableSource("my-rocks", false);
console.log(`${book.smallBodies().length} small bodies with the source off`);
