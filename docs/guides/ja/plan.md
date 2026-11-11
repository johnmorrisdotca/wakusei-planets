---
title: 上から見た図
section: how-to
order: 21
description: 太陽系を真上から見た小さな図、またはひとつの惑星の衛星を、その惑星の北極の真上から見た図。好きな日付で描き、見ている天体に印をつけます。WebGL を使わない SVG で、小さな枠にも入る軽さです。距離は対数で圧縮するか、実際の縮尺で描きます。
---

`<wakusei-plan>` は、真上から見おろす地図です。惑星が太陽のまわりのどこにいるか、またはひとつの惑星のまわりに衛星がどこにいるかを描き、いま見ている天体に印をつけます。3D の表示のとなりに置く、「いまどこ?」の小さな図です。WebGL も three.js も使わない SVG で、幅200〜280ピクセルで読めるように作ってあります。位置は、渡した日時に合わせて、このパッケージ自身の計算 ([宇宙ビュー](space-view.md) と同じモデル) で求めます。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The solar system and Jupiter's moons from above, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/plan/element/+esm"></script>
  </head>
  <body>
    <wakusei-plan mark="mars" time="2026-11-11T12:00Z" size="240"></wakusei-plan>
    <wakusei-plan system="jupiter" mark="io" time="2026-11-11T12:00Z" size="240"></wakusei-plan>
  </body>
</html>
```

1つめの図は、黄道の北極の真上から見た太陽系で、火星に印がついています。2つめは、木星の北極の真上から見た木星の衛星で、イオに印がついています。

## 2つの図

**太陽系** (`system="sun"`、初期値)。真ん中に太陽があり、8つの惑星と冥王星が反時計まわりにまわります。惑星はそれぞれ、`time` の位置に点があり、軌道が線で引かれます。`mark` の天体には輪がつき、名前は太字になり、軌道は強調色になります。この9つ以外の天体も、印をつけると図に加わります。準惑星 (ケレス、エリス、セドナ)、小天体 (ハレー彗星、ケイロン)、[`/spacecraft`](spacecraft.md) の探査機 (`voyager1` など) です。`mark` に衛星を指定すると、その衛星がまわる惑星に印がつくので、3D の表示で追いかけている天体の id を、そのまま3D の表示と図の両方に渡せます。

**ひとつの惑星の衛星** (`system="jupiter"`、または衛星をもつ惑星・準惑星: `earth`、`mars`、`jupiter`、`saturn`、`uranus`、`neptune`、`pluto`、`orcus`、`haumea`、`eris`)。真ん中にその惑星があり、各衛星がそのまわりをまわります。惑星の北極 (IAU の北極) の真上から見るので、見えるのは、その北極のまわりを衛星がまわる向きです。地球・火星・木星・土星の衛星は反時計まわりです。天王星は IAU の北極を軸に逆向きに自転していて (自転軸が98度かたむいています)、衛星も天王星の自転と同じ向きにまわるので、この図では時計まわりになります。海王星の自転と逆向きにまわるトリトンも、オルクスのヴァントも、ハウメアの2つの衛星 (ヒイアカとナマカ) も、時計まわりです。すべての衛星の向きは、テストで確かめています。`mark` には衛星か惑星を指定します。ほかの惑星の衛星を指定しても、どの天体にも印はつきません。

## 属性

| 属性 | はたらき |
|---|---|
| `system` | `sun` (初期値)、または衛星をもつ惑星・準惑星 |
| `mark` | 図の主役の天体 (大文字小文字は問いません): `mars`、`ceres`、`halley`、`io`、`voyager1` |
| `time` | ISO の日時、または 1970年からのミリ秒 (数字だけの値は、いつでもミリ秒です。`2026` は 1970年の初めから2秒たった時刻で、年ではありません)。省略するか `now` にすると、最初に描いた時刻になり、そのあとは止まったままです。動かすには `time` をもう一度設定します |
| `spacing` | `squeezed` (初期値) または `true` |
| `names` | `off` にすると、印をつけた天体のほかは名前を隠します |
| `lang` | `en` または `ja`。省略するとページの `lang` |
| `size` | 幅のピクセル数。初期値は 240 (`--wakusei-size` でも同じ) |
| `theme` | `light` または `dark`。省略するとページの配色 |

要素には、`time` プロパティ (数または `"now"`)、`plan` プロパティ (最後に描いた図: 点・軌道・縁の距離)、`draws` (描いた回数) もあります。

## 圧縮と実際の縮尺

太陽系はほとんど空っぽです。海王星は水星の78倍も太陽から遠くにあります。240ピクセルで実際の縮尺にすると、水星・金星・地球・火星は、太陽から4ピクセル以内にかたまってしまいます。そこで図には2つの距離の描き方があり、どちらを使っているかを図の下の行に書きます。

- **圧縮 (初期値)**。天体を、距離の対数で決めた位置に置きます: `ln(1 + d / inner) / ln(1 + 縁 / inner)`。`inner` は太陽系では 0.1 au、衛星の図ではその惑星の半径1つ分です。内側の惑星にはたっぷり、外側の惑星には少しだけ場所がとれ、並びは距離の順のままです。軌道の線も同じように圧縮します (軌道の各点を、真ん中から引いた線にそって動かします)。だから圧縮した軌道は、ゆがんだ楕円であって、円で置きかえたものではありません。距離は実際の比にならないので、すきまの大きさではなく、順番と向きを読んでください。
- **実際の縮尺** (`spacing="true"`)。天体を、距離を縁の距離で割った位置に置きます。すきまは正しく、内側の惑星は真ん中にかたまります。

縁を 50 au にした図で、各惑星が、真ん中から縁までの道のりの何%のところに来るかを表にしました。

| 天体 | 距離 (au) | 圧縮 | 実際の縮尺 |
|---|---|---|---|
| 水星 | 0.39 | 25% | 0.8% |
| 金星 | 0.72 | 34% | 1.4% |
| 地球 | 1.00 | 39% | 2.0% |
| 火星 | 1.52 | 45% | 3.0% |
| 木星 | 5.20 | 64% | 10% |
| 土星 | 9.54 | 73% | 19% |
| 天王星 | 19.2 | 85% | 38% |
| 海王星 | 30.1 | 92% | 60% |
| 冥王星 (平均) | 39.5 | 96% | 79% |

**縁の距離**。太陽系では、すべての点が入る最小の距離を、50、100、200、500、1,000、2,000 au の中から選びます。8つの惑星と冥王星なら 50 au、セドナやエリスなら 100、ボイジャー1号なら 200 です。縁は段ごとにしか変わらないので、天体を次々に選んでも、惑星の位置は変わりません。2,000 au より遠い天体は縁に置きます。縁をこえる軌道は、縁で切れます。衛星の図では、いちばん遠い衛星の最遠点の8%外側が縁です。木星の図は木星半径の28.7倍まで、海王星の図は421倍まで (ネレイドがそこまで行きます) 届きます。

## 変わったときだけ描く

要素には、タイマーもアニメーションもありません。大きさが決まって見えるようになったときに1回描き、そのあとは `system`、`mark`、`time`、`spacing`、`names`、`lang`、`size`、`theme` のどれかが変わったとき (`lang` を持たない場合は、ページの `lang` が変わったときも) だけ描き直します。すでにある値をもう一度書いても、何も変わりません。いちどにいくつ変えても、描くのは1回です。要素が見えないとき (スクロールで外れたとき、別のタブを見ているとき) は描かず、また見えたときに、最新の状態を描きます。時間を進めるページは、好きな頻度で `time` を設定できます。設定1回の手間は、小さな SVG (文字で約 15 kB) と、天体の位置の計算 (約1ミリ秒) だけです。軌道の線は、太陽系では図の時刻の1年ごと、衛星では1週間ごとに引き直し、覚えておきます。ずれは1ピクセルに満たないので、1日ずつ進める時計でも、毎回は計算しません。

## 点を押す

点を押すと、要素から `wakusei-plan-pick` が送られ、`detail: { id, kind }` がついてきます (`kind` は `planet`、`moon`、`dwarf-planet`、`comet`、太陽なら `star` など)。図は自分では印を変えません。ページが決めて、`mark` を設定します。点はそれぞれ、天体の名前がついたボタンです (スクリーンリーダーはその名前を読み上げます)。Tab で移動でき、Enter か Space で押せます。図を描き直しても、フォーカスはその点に残ります。

```ts no-run
import type { WakuseiPlan } from "@johnmorrisdotca/wakusei-planets/plan/element";

const plan = document.querySelector<WakuseiPlan>("wakusei-plan")!;
plan.addEventListener("wakusei-plan-pick", (event) => plan.setAttribute("mark", (event as CustomEvent<{ id: string }>).detail.id));
```

## 明るい配色、暗い配色、言語

配色はページの `color-scheme` に従います。ファミリーのテーマ切り替えもこの仕組みなので、`data-theme="dark"` のページでは、何も書かなくても暗い図になります。要素に `theme="light"` や `theme="dark"` を書くと、どちらかに固定できます。図には専用の背景 (`--wakusei-plan-bg`) があるので、明るいページ、暗いページ、色のついたパネルの上のどれでも同じように読めます。`--wakusei-plan-ink`、`-muted`、`-line`、`-sun`、`-dot`、`-mark` を設定すると、好きな色にできます。名前は、パッケージのデータにある各天体の名前を英語か日本語で出します。縮尺の行と、スクリーンリーダー向けの説明も同じ言語です。

名前は重ならないように選びます。印をつけた天体がいちばん優先で、次に太陽、惑星、準惑星、その他の順です。優先度の高い名前に重なってしまう名前は出しません。`names="off"` では、印をつけた天体だけに名前が出ます。

## 正確なところ、そうでないところ

点は正確です。どれも、その時刻のパッケージ自身の位置です (惑星は VSOP87B、冥王星は当てはめた表、衛星は衛星の理論。[精度](accuracy.md) を見てください)。ケレス、エリス、セドナ、ハレー彗星、ケイロンなどの準惑星や小天体は、1つの時点の接触軌道要素で計算します (前後数年は合います)。当てはめた表を読み込んだときだけ、表で計算します。`<wakusei-plan>` は、その天体の表を、初めて印をつけたときに読み込みます。`planAt` では、`@johnmorrisdotca/wakusei-planets/tables` (または `/tables/ceres`、`/tables/dwarfs`、`/tables/minor`) を自分で import します。探査機の経路は、その探査機に初めて印をつけたときに読み込み、1機につき1回だけ読み込みます。キーボードで選んだ点には、フォーカスの輪が出ます。どの点も、押せる範囲は24ピクセル四方です。光が届くまでの時間は考えていません。点はどれも同じ大きさで描くので、点の大きさは天体の大きさを表しません。図は真上から見た平面なので、黄道面から大きく上や下にある天体 (冥王星、セドナ、探査機) は、その面に落とした場所に描かれ、距離もその面の上での距離です。探査機は、その時刻が経路の記録の範囲に入っているときだけ描かれます。

## ブラウザなしで

計算だけの部分は `@johnmorrisdotca/wakusei-planets/plan` です。`planAt` が図を計算し、`planSvg` が SVG の文字として描き (README、サーバー、印刷に)、`planText` と `planName` が言葉を返し、`planRadius` と `planSunExtent` が距離の描き方を決めます。Node など、どこでも動きます。

```js
import { planAt, planSvg } from "@johnmorrisdotca/wakusei-planets/plan";

// The plan needs no browser: where Mars and Io are on the drawing for a date, and the drawing itself as SVG text.
const time = Date.UTC(2026, 10, 11);
const sky = planAt(time, { mark: "mars" });
const mars = sky.dots.find((dot) => dot.id === "mars");
const io = planAt(time, { system: "jupiter", mark: "io", spacing: "true" }).dots.find((dot) => dot.id === "io");

console.log(`Mars: ${mars.distance.toFixed(2)} au from the Sun, ${Math.round(Math.hypot(mars.x, mars.y) * 100)} per cent of the way to the edge (${sky.extent} au)`);
console.log(`Io: ${io.distance.toFixed(1)} Jupiter radii from Jupiter's centre`);
console.log(`The SVG is ${planSvg(sky, { size: 240 }).startsWith("<svg") ? "an <svg>" : "not an SVG"}`);
```

出力は次のとおりです。

```text
Mars: 1.60 au from the Sun, 46 per cent of the way to the edge (50 au)
Io: 5.9 Jupiter radii from Jupiter's centre
The SVG is an <svg>
```
