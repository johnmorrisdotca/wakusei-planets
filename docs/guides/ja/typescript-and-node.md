---
title: TypeScriptとNode
section: how-to
order: 6
description: サーバーで天体をSVG文字列として描きます。衛星の位置を調べ、型を使います。
---

本体のエントリーにはDOMもブラウザーのグローバルもないので、サーバー、ビルド、テストで同じ線画と同じ計算ができます。

## サーバーで

```mjs
import { apparent, lineSvg } from "@johnmorrisdotca/wakusei-planets";

// A server draws the same SVG a browser does: pure, no DOM, no browser globals.
const svg = lineSvg("saturn", { size: 240, time: Date.UTC(2026, 10, 2, 12) });
const page = `<!doctype html><title>Saturn</title>${svg}`;
console.log(page.length > 1000, apparent("saturn", Date.UTC(2026, 10, 2, 12)).subObserverLat.toFixed(0));
```

## 型

関数とオプションにはすべて型があり、天体でない名前はコンパイルエラーになります。

```ts no-run
import { BODIES, lineSvg, system, type BodyId, type LineOptions } from "@johnmorrisdotca/wakusei-planets";
import type { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";

const options: LineOptions = { size: 240, time: Date.UTC(2026, 10, 2, 12), moons: true };
const id: BodyId = "jupiter";
const svg: string = lineSvg(id, options);
const io = system("jupiter", options.time ?? 0).moons[0];
console.log(svg.length > 1000, BODIES[id].name.en, io?.id);

export function tilt(element: WakuseiBody): void {
  element.setView({ tilt: 20 });
}

export function misspelt(): string {
  // @ts-expect-error "pluton" is not a body
  return lineSvg("pluton");
}
```

## 本体のエントリーにあるもの

`BODIES` は、天体ごとの半径、扁平率、自転軸の傾き、極、自転、色、輪、線画の特徴を持っています。`apparent(id, time)` は、地球から見た天体の向き・満ち欠け・大きさを返します。`system(planet, time)` は、惑星と衛星を、惑星の半径を単位に、見る人の座標で返します。`orbitPath` は衛星1つの軌道、`lineSvg` は線画です。計算の部分は `Date.now()` と同じ、1970年からのミリ秒を受け取ります。
