---
title: 自分の three.js シーンで使う
section: how-to
order: 9
description: 本物の太陽・惑星・冥王星・衛星を、すでにある three.js のシーンに置きます。chikyu-earth の宇宙ビューが例です。
---

`@johnmorrisdotca/wakusei-planets/painter` は、天体を半径 1 のオブジェクトとして作ります。それを自分のシーンで動かし、大きさを変え、光を当てます。自分では何も描きません。レンダラーもループも時計も持ちません。`<wakusei-body>` と同じ陰影つきの見た目と、同じ表面の地図を、遠近カメラ向けに描きます。

```ts
import * as THREE from "three";
import { painter } from "@johnmorrisdotca/wakusei-planets/painter";

const scene = new THREE.Scene();
const jupiter = painter.make(THREE, "Jupiter", { look: "realistic", invalidate: () => undefined });
scene.add(jupiter.object);
jupiter.object.position.set(40, 0, 0);
jupiter.object.scale.setScalar(2);
jupiter.update({ toSun: [-1, 0, 0], ms: Date.now(), radiusPx: 120 });
console.log(scene.children.length);
```

- `look` は `realistic` か `painted` です。地図が届くまでは陰影つきの見た目を出し、届いたら `invalidate` を呼ぶので、もう一度描いてください。
- 先に位置と大きさを決めてから、描くたびに `update` を呼びます。`toSun` は太陽への単位ベクトルで、シーンの軸は赤道座標 J2000 (y が上、x が春分点) とみなします。天体は `ms` の時刻の本当の自転軸と自転で回ります。
- `radiusPx` は、天体の半径が画面で何 CSS ピクセルあるかです。見えるときだけ、もっと細かい画像を読み込みます。天体が小さくなって数秒たつと、大きい画像は手放します。
- 太陽もほかの天体と同じ球です。`update` に `view` (カメラ) を渡すと、グローは自動でカメラのほうを向きます。球は太陽自身の極と本初子午線 (赤道で約25日に1回転) を保つので、時間とともに自転し、カメラを動かせば見える面も変わります。オブジェクトをカメラへ向けないでください。`billboard` は太陽に設定されなくなりました (以前は `true` で、視点をどう回しても同じ面が見えていました)。
- `painter.moons("Jupiter", ms)` は、惑星から見た各衛星の位置 (惑星の半径が単位) と大きさを近い順に返します。衛星も同じように `painter.make(THREE, "Io")` で作り、惑星の位置に、`offset` と描いた惑星の半径をかけたものを足した場所に置きます。
- 画像は標準では jsDelivr から読みます。`createPainter({ textureBase, farBase })` で自分のフォルダを指せます。
- 近いビューでは、`update` にカメラを渡します。`jupiter.update({ toSun, ms, radiusPx, view: { camera, width, height } })` のように書き、カメラの行列は最新の状態にして、大きさはCSSピクセルで渡します。ビューで大きく見える天体には、カメラに見えている部分の細かい地図のタイルが載ります。タイルはデモサイトの `tiles/` フォルダから、または `createPainter({ tiles: "/tiles/" })` で指したところから読みます (`"off"` でなし。自分の `textureBase` を渡したペインターは、場所を教えるまでタイルを使いません)。`painting.tiles` は窓がしていることを返し、`context.onLevels` はその天体のタイルのレベルを教えてくれます。`view` を渡さなければ、これまでどおり天体自身の絵で描きます。しくみは [近づくズームと地図のタイル](close-zoom.md) にあります。

渡す three.js には、天体が使う部品と `Group` が必要です。chikyu-earth の宇宙ビューは `setBodyPainter(painter)` でこのペインターを受け取り、太陽・惑星・冥王星・衛星を描きます (そちらのガイド「本物の惑星」を見てください)。
