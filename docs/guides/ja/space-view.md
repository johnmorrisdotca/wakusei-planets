---
title: 宇宙ビュー
section: how-to
order: 16
description: 地球・月・太陽・惑星を、好きな日時の場所に置きます。月の満ち欠けも、地球の昼の側も、本物の太陽の光から決まります。縮尺は二通り、時間は前にも後ろにも進み、地球から太陽系ぜんぶまでズームできます。
---

`@johnmorrisdotca/wakusei-planets/space/element` は `<wakusei-space>` を登録します。地球・月・太陽・ほかの7つの惑星・冥王星を、指定した日時の場所に置いて、three.js で描きます。ページで共有する WebGL コンテキストを1つだけ使います。月の満ち欠けも、地球の昼の側も、表ではなく光から決まります。地球から太陽系ぜんぶまでズームでき、時間は前にも後ろにも進められます。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Earth, the Moon and the planets on 2 November 2026</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/space/element/+esm"></script>
  </head>
  <body>
    <wakusei-space time="2026-11-02T14:00Z" speed="0" look="realistic" style="width: 420px"></wakusei-space>
  </body>
</html>
```

three が必要です (任意の peer 依存)。「表面の地図」の見た目の絵は、jsDelivr か、`texture-base` で指定したフォルダから読み込みます。天体はすべてこのパッケージの描画部品で描くので、`<wakusei-body>` と同じ見た目です ([自分の three.js シーンで使う](in-your-own-scene.md))。

## 位置

位置はこのパッケージ自前のモデルだけで求めます。太陽と惑星は VSOP87B、冥王星は JPL Horizons に合わせた表、月は ELP2000 です。J2000 の赤道座標での幾何学的な位置で、光行差や章動は入れていません。入れても約20秒角しか動かず、この縮尺ではピクセルの何分の一にもなりません。計算だけの関数は `@johnmorrisdotca/wakusei-planets/space` にあり、サーバーでも使えます。

```ts
import { frameAt, placeAround, placeSun } from "@johnmorrisdotca/wakusei-planets/space";

const frame = frameAt(Date.UTC(2026, 10, 2, 14));
const sun = placeSun("compressed", frame.sun);
const [x, y, z] = placeAround("compressed", sun, [frame.planets.mars[0] - frame.sun[0], frame.planets.mars[1] - frame.sun[1], frame.planets.mars[2] - frame.sun[2]]);
console.log(Math.hypot(x - sun[0], y - sun[1], z - sun[2]).toFixed(0));
```

`frameAt(ms)` は、地球の中心から見た太陽・月・惑星の位置 (天文単位) です。テスト用の別ライブラリ astronomy-engine と比べて、太陽と月は100分の1度以内、惑星は数100分の1度以内で合います。`createTrack(stepMs)` は、本当に計算した2つの時刻のあいだを補います。1秒に1日進めても、計算は1秒に約2回で、描くたびに計算し直すことはありません。

## 縮尺は二通り

宇宙はほとんど空っぽなので、本当の縮尺では点が2つ見えるだけです。この要素は両方を持っていて、`scale` で切り替えます。

| `scale` | 距離 | 大きさ |
|---|---|---|
| `compressed` (初期値) | 向きはすべて本物です。月は地球の半径の3.5倍の所に (本当は60倍)、太陽は70倍の所に (本当は23,500倍) 描きます。惑星は太陽から本物の向きに、70に天文単位の距離の0.45乗をかけた半径の所へ置くので、地球の軌道が70、海王星が約320です (本当は30倍)。太陽・天体・軌道の線は同じ一つの変換 (`placeBodies`、`orbitLine`) を通るので、地球もふくめ、どの天体も自分の軌道の線の上にいます。惑星の衛星は、本当の距離だとなりの惑星の軌道をこえてしまうときは近くに描きます (`moonDistance`)。いちばん遠い衛星はすき間の3分の1、ほかは順番をそのままに | 太陽が5、月が0.9、惑星が0.4から1.8 (地球の半径を1として。実際より大きめ) |
| `true` | 距離も大きさも本物で、地球の赤道半径が1です | 本物の大きさ。惑星は点のように小さく、太陽は光る点です。名前で場所を示します |

縮めた縮尺のときは、ページに「縮めた縮尺」と書いておきます。デモもそうしています。

## 時間

`time` は ISO 形式の日時 (`2026-11-02T14:00Z`) か `now` です。`speed` は1秒に進むゲーム内の秒数です。`1` は実際と同じ、`0` は止める、`3600` は1秒で1時間、`86400` は1秒で1日、マイナスは逆戻りです。`time` を変えると、カメラは地面の同じ場所をもう一度向きます。地球は本物の自転で回り、月はいつも同じ面を地球に向け、各惑星は太陽の光を受けるので、金星は三日月に、月は半月になります。

`light="lit"` にすると、カメラの側から昼の光が当たっているように、すべての天体を照らします (太陽は自分で光ります)。夜の側を見ても真っ黒になりません。どちらでも、天体は本当の位置のままです。

## ズーム、天体を見る、名前

この要素は、ドラッグ、ピンチ、Ctrl とホイール、キーを自分で受けます ([ズームと移動](zoom-and-pan.md))。範囲は100万分の1 (太陽系ぜんぶが見えるところまでカメラを引く) から3倍までです。上限は、カメラが天体に着くところです。カメラは、見ている天体の半径の `3.4 / zoom` 倍の所にいて、ズーム1でその天体が画面いっぱいになります。カメラは表面から1.05半径より近づかないので、約3.2を超えても何も動きません。ボタンがほしいときは、ファミリーの `<kazoku-view-controls for="space">` を横に置きます。バーも同じ範囲を読みます。`zoom-min` と `zoom-max` はどちらにつけても範囲が変わり、`controls="none"` で要素自身の手を外せます。`space.zoomFor("moon" | "sun" | "inner" | "solar-system" | "earth" | "jupiter-moons")` は、いまの縮尺と時刻で、空のその部分が収まるズームを返します。`space.controller.set({ zoom })` (バーがあるときは `controls.controller.set({ zoom }, true, "jump")`) でそこへ行きます。`space.setView(コントロールの値)` は、カメラを天体のまわりで回します (`roll` は画面を時計まわりに回し、`panX` と `panY` は、絵の中のすべてをちょうどそのCSSピクセル分、右と下を正として、奥行きに関係なく動かします)。カメラは星に固定されているので、時間が進むと地球はカメラの下で回ります。

`space.body = "jupiter"` で、カメラをその天体に向けます (`earth`、`sun`、`moon`、`mercury` から `neptune`、`pluto`)。各天体の横の名前はボタンです (Tab と Enter)。ドラッグではない押し方で天体を押すと、`wakusei-body-click` が `{ id, name, radiusKm, distanceKm }` つきで発火します (キーボードでは `wakusei-body-focus`)。同じ値は `space.bodyInfo(id)` でも得られます。`space.bodyNames = { mars: "火星" }` や `lang="ja"` で表示する言葉を変えられます。

惑星が数ピクセルの大きさになると、そのまわりに近い衛星が現れます。位置はこのパッケージの衛星モデルが出します (`zoomFor("jupiter-moons")`)。地球と惑星が太陽のまわりを回る道は、`orbits="off"` にしない限り描きます。

## プロパティ、イベント、stats

属性は `center` (`"lon,lat"`)、`time`、`speed`、`scale`、`look` (`realistic` か `painted`)、`light`、`labels` と `orbits` (`off` で隠す)、`lang`、`texture-base`、`texture-far-base`、`max-texture` です。イベントは `wakusei-view` (表示が変わった: `yaw`、`tilt`、`zoom`)、`wakusei-ready`、`wakusei-unavailable`、`wakusei-state`、`wakusei-timechange` (日付が変わった: 時間が進む間は1秒に4回まで、止まったときに1回、`{ time, running }`)、`wakusei-time` (時計が1ステップ進むたび)、`wakusei-body-click`、`wakusei-body-focus` です。`stats` には `state`、`draws`、`contexts`、`canvas`、`distance`、`time`、`lookups`、`camera`、`bodies` があります。

## 乗って見る

`space.ride("moon")`、`space.ride("io")`、`space.ride({ at })` で、カメラを動く点に乗せ、その点が回る天体を見ます。詳しくは [乗って見る](ride-along.md) をどうぞ。

## 負荷の上限

このパッケージの3D表示と同じ決まりを守り、`pnpm test:freeze` で確かめています。共有レンダラーで WebGL コンテキストは1つ、キャンバスは1辺4096ピクセル以内かつ600万ピクセル以内、止まっている間は何も描かず、1秒に30フレームまで、実際の時間なら1分に1回だけ描き直し、画面の外では描かず、要素を外せばすべて解放し、失われたコンテキストは自動で戻します。
