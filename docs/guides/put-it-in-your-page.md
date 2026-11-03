---
title: Put it in your page
section: how-to
order: 3
description: Set up a body in the demo, then copy working code for plain HTML, an ES module, React, Vue, Angular, Svelte or an iframe.
---

The demo's "Put it in your page" section is a configurator. Set up the body above it (which body, its look, the sky and date, the moons, whether it turns), choose a size, then pick how your page is made. The code and the picture beside it change with every choice, and the credits that go with the picture are under the code.

The same text is made by `embedCode`, so a page of your own can offer the same choice:

```ts
import { embedCode, embedCredit, EMBED_KINDS } from "@johnmorrisdotca/wakusei-planets";

const choices = { body: "jupiter", look: "realistic", time: "now", moons: true, size: 320 } as const;
for (const kind of EMBED_KINDS) console.log(kind, embedCode(choices, kind).length);
console.log(embedCredit(choices));
```

- `html`: script tags from jsDelivr (the element, and the body's own shaded look when the look is not a line drawing) and the element.
- `module`: the same imports and a few lines that make the element.
- `react`, `vue`, `angular`, `svelte`: a component that imports the element once it is in a browser, never on a server.
- `iframe`: the demo's `embed.html` with the choices in its address, for a page with no scripts.

Every snippet is tested: the package's tests build the React component and render it, compile the Vue and Svelte components, parse the Angular template and the ES module, and read the iframe's address the way the embed page does. Moons need a date, so `moons` is written only with a `time`. A moon's shaded look is in its planet's file (`moons-jupiter`), which the snippet imports for you.
