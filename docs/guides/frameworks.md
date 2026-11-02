---
title: In React, Vue, Svelte and Angular
section: how-to
order: 4
description: A component for each framework, with the browser-only import done where a server render never reaches it.
---

`<wakusei-body>` is a custom element, so it works in any framework. The one rule is that it needs a browser: import it where a server render does not run (an effect, a mounted hook). Every component below was built and opened by the package's tests.

## React

```tsx
import { useEffect } from "react";

export function WakuseiBody({ body = "saturn", look = "line" }: { body?: string; look?: "line" | "realistic" }) {
  useEffect(() => {
    // The element needs a browser, so it is imported here, never at the top of the file: a server render never reaches an effect.
    void import("@johnmorrisdotca/wakusei-planets/element");
    void import("@johnmorrisdotca/wakusei-planets/all");
  }, []);
  return <wakusei-body body={body} look={look} />;
}
```

React needs to be told the tag's attributes. A type file does it:

```ts no-run
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wakusei-body": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { body?: string; look?: string; size?: number | string; time?: string; moons?: boolean };
    }
  }
}
```

The component renders to a string on a server and the element fills in when the page loads, so Next.js works the same way.

## Vue

```vue
<script setup lang="ts">
import { onMounted } from "vue";

withDefaults(defineProps<{ body?: string; look?: "line" | "realistic" }>(), { body: "saturn", look: "line" });

// The element needs a browser: import it once the component is on the page, never while a server renders it.
onMounted(() => {
  void import("@johnmorrisdotca/wakusei-planets/element");
});
</script>

<template>
  <wakusei-body :body="body" :look="look"></wakusei-body>
</template>
```

Tell Vue that the tag is not one of its own:

```ts no-check
import { createApp } from "vue";
import PlanetView from "./PlanetView.vue";

const app = createApp(PlanetView);
app.config.compilerOptions.isCustomElement = (tag) => tag === "wakusei-body";
app.mount("#app");
```

## Svelte

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  let { body = "saturn", look = "line" }: { body?: string; look?: "line" | "realistic" } = $props();

  // The element needs a browser: onMount never runs on the server.
  onMount(() => {
    void import("@johnmorrisdotca/wakusei-planets/element");
  });
</script>

<wakusei-body {body} {look}></wakusei-body>
```

## Angular

```ts no-run
import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-wakusei-body",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wakusei-body [attr.body]="body" [attr.look]="look"></wakusei-body>`,
})
export class WakuseiBodyComponent implements OnInit {
  @Input() body = "saturn";
  @Input() look: "line" | "realistic" = "line";

  ngOnInit(): void {
    // The element needs a browser: ngOnInit also runs when a server renders, so the import waits for one.
    if (typeof window !== "undefined") void import("@johnmorrisdotca/wakusei-planets/element");
  }
}
```

## Nuxt, SvelteKit, Next.js

The same components apply. Only the import of the element must stay inside the mounted hook, the effect or `onMount`.
