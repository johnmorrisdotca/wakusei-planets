---
title: 数字から描く恒星
section: how-to
order: 6
description: どんな星も、温度・半径・階級・自転などの数字から、3Dでも線画でも描けます。測った部分と、見た目のために描いた部分を、正直に示します。
---

`<wakusei-body star="...">` は、惑星と同じやり方で恒星を描きます。回せる3D (`realistic`) か、輪郭の線画 (`line`) で、ページに1つだけの WebGL を共有して描きます。このパッケージは星の一覧を持っていません。数字を渡すと、その数字から描きます。写真をまねることはありません。

| 数字 | 決めるもの |
|---|---|
| `temperatureK` | 色 (その温度の黒体の色。3,600 K は赤、太陽は白っぽい黄色、ベガは青白い)。ふちの暗さも |
| `radiusSun` | 太陽と並べたときの大きさ。線画では、星のまわりに太陽・地球の軌道・木星の軌道の輪も描きます。ベテルギウスは太陽の約764倍の**半径**です。質量の11〜20倍は、別の数字です |
| `luminosityClass` | 表面の細かさ: `Ia`・`Iab`・`Ib` は大きなセルが少し、`III` はあらい、`V` は細かい、`D` (白色矮星) はなめらか |
| `rotationDays` | ページでの回り方: 速く自転する星ほど速く回ります。速さは実際より上げていて、そう書いてあります (太陽は実際の73,000倍)。数字がないときはゆっくり回し、そう書きます |
| `activity` | 黒点と、ふちのプロミネンス・フレア。ないときは、温度と階級から決めます。熱い星はなし、冷たい星や赤色矮星は多め |
| `oblateness` | つぶれた形と、極が熱く赤道が暗いこと (重力暗化)。ベガは約0.11、アルタイルは0.2 |
| `corona` | やわらかい光の強さ (0〜1) |
| `estimated` | 上の数字のうち、測定ではなく推定のもの。絵にもそう書きます |

## ふつうのページで

数字は属性に書き、`star` で星の名前をつけます。星の見た目は要素の中にあるので、スクリプトは1つで、天体ごとの読み込みはいりません。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star from its numbers, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm"></script>
  </head>
  <body>
    <wakusei-body star="Betelgeuse" temperature-k="3600" radius-sun="764" luminosity-class="Iab" look="realistic" size="320"></wakusei-body>
  </body>
</html>
```

`star` には、数字を JSON で入れることもできます (`star='{"temperatureK":3600,"radiusSun":764}'`)。`registerStarLook` (下) で登録した星の名前でも構いません。横に書いた属性が優先です。`star` プロパティにはオブジェクトを渡せます。数字が合わないときは、`data-error` に理由が出て、何も描きません。

## ES モジュールで

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star with Vite</title>
  </head>
  <body>
    <wakusei-body look="line"></wakusei-body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts no-run
import "@johnmorrisdotca/wakusei-planets/element";
import type { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";
import { starLook, type StarNumbers } from "@johnmorrisdotca/wakusei-planets";

const betelgeuse: StarNumbers = { name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab", estimated: ["radiusSun"] };

const star = document.querySelector<WakuseiBody>("wakusei-body")!;
star.star = betelgeuse;
console.log(starLook(betelgeuse).parts.map((part) => `${part.part}: ${part.status}`).join(", "));
```

## React

```tsx
import { useEffect } from "react";

const BETELGEUSE = { name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab" };

export function StarView({ star = BETELGEUSE, look = "line" }: { star?: typeof BETELGEUSE; look?: "line" | "realistic" }) {
  useEffect(() => {
    // The element needs a browser, so it is imported here, never at the top of the file: a server render never reaches an effect.
    void import("@johnmorrisdotca/wakusei-planets/element");
  }, []);
  return <wakusei-body star={JSON.stringify(star)} look={look} />;
}
```

React には、要素の型を一度だけ教えます:

```ts no-check
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wakusei-body": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { star?: string; look?: string; size?: number | string };
    }
  }
}
```

## Vue

```vue
<script setup lang="ts">
import { onMounted } from "vue";

withDefaults(defineProps<{ star?: object; look?: "line" | "realistic" }>(), {
  star: () => ({ name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab" }),
  look: "line",
});

// The element needs a browser: import it once the component is on the page, never while a server renders it.
onMounted(() => {
  void import("@johnmorrisdotca/wakusei-planets/element");
});
</script>

<template>
  <wakusei-body :star="JSON.stringify(star)" :look="look"></wakusei-body>
</template>
```

Vue には、このタグが要素だと一度だけ教えます:

```ts no-check
import { createApp } from "vue";
import StarView from "./StarView.vue";

const app = createApp(StarView);
app.config.compilerOptions.isCustomElement = (tag) => tag === "wakusei-body";
app.mount("#app");
```

## Angular

```ts no-check
import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-star-view",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wakusei-body [attr.star]="json" [attr.look]="look"></wakusei-body>`,
})
export class StarViewComponent implements OnInit {
  @Input() star = { name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab" };
  @Input() look: "line" | "realistic" = "line";

  get json(): string {
    return JSON.stringify(this.star);
  }

  ngOnInit(): void {
    // The element needs a browser: ngOnInit also runs when a server renders, so the import waits for one.
    if (typeof window !== "undefined") void import("@johnmorrisdotca/wakusei-planets/element");
  }
}
```

## Svelte

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  let { star = { name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab" }, look = "line" }: { star?: object; look?: "line" | "realistic" } = $props();

  // The element needs a browser: onMount never runs on the server.
  onMount(() => {
    void import("@johnmorrisdotca/wakusei-planets/element");
  });
</script>

<wakusei-body star={JSON.stringify(star)} {look}></wakusei-body>
```

## iframe で

埋め込みページは、同じ名前をアドレスで受け取ります: `star`・`temperature-k`・`radius-sun`・`luminosity-class`・`rotation-days`・`activity`・`oblateness`・`corona`・`estimated`・`look`。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/wakusei-planets/embed.html?star=Betelgeuse&temperature-k=3600&radius-sun=764&luminosity-class=Iab&look=line"
      title="Betelgeuse, drawn from its numbers"
      width="420"
      height="420"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

デモの[恒星のページ](https://johnmorrisdotca.github.io/wakusei-planets/star.html)は、設定した星について、このコードと上の他の書き方を書き出します。

## ページなしで

`starLook` が数字から計算し、`starLineSvg` が輪郭を描きます。どちらもブラウザはいりません:

```js
import { starLineSvg, starLook } from "@johnmorrisdotca/wakusei-planets";

const betelgeuse = starLook({ name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab", estimated: ["radiusSun"] });
const drawn = betelgeuse.parts.filter((part) => part.status === "illustrative").map((part) => part.part);

console.log(betelgeuse.colour, starLineSvg(betelgeuse).startsWith("<svg"), drawn.join(","));
```

いくつかの星を名前で描くページは、最初に一度だけ登録し、あとは名前だけ書きます:

```ts
import { registerStarLook, starLookOf } from "@johnmorrisdotca/wakusei-planets/look";

registerStarLook("Proxima Centauri", { temperatureK: 3042, radiusSun: 0.154, luminosityClass: "V", rotationDays: 83.5 });
console.log(starLookOf("proxima centauri")?.parts.length);
```

## 測った数字と、描いたもの

どの星にも `parts` があります。要素の `starLook` プロパティとラベルにも、*数字から描いた絵で、写真ではありません* と出ます。各部分は次の4つのどれかです:

- **測定値 (measured)**: あなたが渡した数字。
- **推定値 (estimated)**: あなたが渡し、`estimated` に書いた数字。
- **計算 (derived)**: その数字から決まった規則で出したもの (温度から色、ふちの暗さ、つぶれた星の熱い極)。
- **作りもの (illustrative)**: 見た目のために作ったもの: セルのもよう、黒点の場所、プロミネンスとフレア、まわりの光。数や細かさは数字に合わせますが、観測ではありません。

## 品質と速さ

星も、他の天体と同じ共有レンダラーを通ります。WebGL は1つ、1秒に30コマまで、止まっているときや見えないときは描かず、動きを減らす設定でも回り (速さは4分の1)、失ったコンテキストは戻します。`full` では表面がゆらぎ、活発な星のふちにプロミネンスとフレアが出ますが、コマを描いている間だけです。`quality="low"` (または `starLook(numbers, { quality: "low" })`) は、止まった表面とやわらかい光だけで、非力な端末向けです。メモリ 2 GB 以下、またはコア2つ以下の端末では、`quality="full"` と書かない限り、要素が自分で選びます。

## 太陽

太陽は、これまでどおり自分の見た目・地図・線画 (`body="sun"`) を持ち、変わりません。他の星と並べて星として描きたいときは、`STAR_SUN` に太陽の数字があります。
