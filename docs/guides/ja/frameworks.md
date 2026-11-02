---
title: React・Vue・Svelte・Angularで使う
section: how-to
order: 4
description: フレームワークごとのコンポーネントです。ブラウザー専用のimportは、サーバー描画が通らない場所に置きます。
---

`<wakusei-body>` はカスタム要素なので、どのフレームワークでも動きます。ただ1つの決まりは、ブラウザーが要るということです。サーバー描画が動かない場所 (エフェクトやマウント後の処理) でimportしてください。下のコンポーネントは、すべてパッケージのテストがビルドして開いています。

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

Reactにはタグの属性を教える必要があります。型ファイルで教えます。

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

サーバーでは文字列に描画され、ページが読み込まれると要素が中身を作ります。Next.jsも同じです。

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

このタグがVueのものでないことを伝えます。

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

## Nuxt、SvelteKit、Next.js

同じコンポーネントが使えます。要素のimportだけは、マウント後の処理、エフェクト、`onMount` の中に置いてください。
