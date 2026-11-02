---
title: Viteやwebpackなどのバンドラーで使う
section: how-to
order: 3
description: バンドラーのアプリで要素をimportします。必要な天体だけを選び、線画だけのページに three.js を入れないようにします。
---

パッケージはESモジュールと型だけなので、バンドラーにプラグインは要りません。下の例は、どちらもパッケージのテストがビルドして、ブラウザーで開いています。

## Vite

要素を1回importしてタグを書きます。`lineSvg` などの関数は、パッケージの本体から読みます。

```ts no-run
import "@johnmorrisdotca/wakusei-planets/element";
import { lineSvg } from "@johnmorrisdotca/wakusei-planets";

const planet = document.querySelector("wakusei-body")!;
planet.setAttribute("tilt", "20");
console.log(lineSvg("saturn", { size: 64 }).startsWith("<svg"));
```

ページ:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wakusei Planets with Vite</title>
  </head>
  <body>
    <wakusei-body id="planet" body="saturn" look="line"></wakusei-body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

## webpack

```js no-run
import "@johnmorrisdotca/wakusei-planets/element";

const planet = document.createElement("wakusei-body");
planet.setAttribute("body", "saturn");
planet.setAttribute("look", "line");
document.body.append(planet);
```

設定:

```mjs
import { fileURLToPath } from "node:url";

export default {
  mode: "production",
  entry: "./src/index.js",
  output: { path: fileURLToPath(new URL("./dist", import.meta.url)), filename: "main.js" },
};
```

## 必要な天体だけ

天体ごとの陰影つきの見た目は、それぞれ別のエントリー (`@johnmorrisdotca/wakusei-planets/jupiter` など) で、`/all` はすべてを読み込みます。バンドラーはimportしたものだけを残します。線画だけのページは、どれもimportせず、three.js も読み込みません。陰影つきの天体を初めて描くときにだけ、要素が three.js を呼びます。

## 小さな three.js

要素は、初期設定では `three` 全体を読み込みます。天体が使う部分だけを再エクスポートするモジュールを渡すと、ライブラリ全体ではなく数百KBで済みます (デモの `demo/three-subset.ts` が一覧です)。

```ts no-check
import { setThreeLoader } from "@johnmorrisdotca/wakusei-planets/element";

setThreeLoader(() => import("./three-subset"));
```
