---
title: 大きさくらべ
section: how-to
order: 7
description: 太陽と、知られている最大級の星を、実際の大きさの比のままならべます。どの星も数字から描き、半径・誤差・論文を表示します。ズーム、回転、保存、印刷、ページへの入れ方もあります。
---

`<wakusei-lineup>` は、星を**実際の大きさの比のまま**、横または縦にならべます。どの星もこのパッケージの恒星の見た目で描き、半径を太陽の何倍か・何キロメートルか、その誤差、出典の論文を添えます。スライダーで、いちばん小さいものから最大の星まで、なめらかにズームできます。星はゆっくり回り、ドラッグするとつかんだ星を回せます。オプションで、このパッケージ自身のデータの地球と木星も加えられます。星は、ページに1つだけの WebGL を共有して描きます。ほかの要素と同じく、止まっているときや見えないときは何も描かないきまりです。

## 入っているもの

太陽、シリウスA、ベガ、アークトゥルス、アルデバラン、リゲル、アンタレス、ベテルギウス、そして知られている最大級の星 (おおいぬ座VY星、WOH G64、たて座UY星、ステファンソン2-18) です。`stars="bright"` は最初の8つ、`stars="largest"` は太陽と最大級の星、`stars="sun,rigel,antares"` は自分で選んだリストです (id は `LINEUP_STARS` にあります)。`planets` を付けると、地球 (赤道半径 6,378 km、太陽の0.00917倍) と木星 (71,492 km、太陽の0.103倍) が加わります。

## ズームのしくみ

天体は、小さいものから順に、横一列 (`layout="stack"` なら縦一列) にならびます。となり合う天体の間は、大きいほうの半径の4分の1です。ズームは0から1までの数字で、**半径の対数の目盛り**です。0ではいちばん小さい天体に、1では最大の天体にカメラを合わせます。その間は、写している範囲の大きさが天体の半径に届くたびに、カメラの中心がその天体で一休みしながら、次の天体へなめらかに移ります。地球からステファンソン2-18までは20万倍もちがうので、スライダーの大半は、太陽を写す大きさでは見えない星の間に使われます。太陽のとなりの地球は点にしか見えないので、小さすぎて見えない天体には輪で印を付けます。

`zoom="0.4"` か `at="betelgeuse"` で、カメラの最初の位置を決めます。どちらもなければ太陽です。幅の狭い画面では、写している天体が横にも収まるように、カメラがもっと引いた位置になります。

## 半径

どの半径も、**星の角直径を (あれば干渉計で) 測り、距離を使って半径を出した査読つき論文**の値です。インフォグラフィックや百科事典、ガイア・ヒッパルコス・ティコの天体カタログから読んだ値は使っていません。論文の距離がカタログの視差の場合は、論文が出した半径をここに打ち込み、視差の値は入れていません。表は `src/lineup/data.ts` の `LINEUP_STARS` に打ち込んであり、各行に半径、下と上の誤差、求め方、論文の ADS bibcode、読んだ日 (2026-11-09) があります。出典は `NOTICE.md` にまとめています。

| 星 | 半径 | 大きさの根拠 | 論文 | ADS bibcode |
|---|---|---|---|---|
| 太陽 | 太陽の1倍 | 定義 | Prša et al. 2016 | `2016AJ....152...41P` |
| シリウスA | 太陽の1.714倍 (±0.009) | 角直径と距離を測定 | Bond et al. 2017; Davis et al. 2011 | `2017ApJ...840...70B`, `2011PASA...28...58D` |
| ベガ | 太陽の2.726倍 (±0.006) | 角直径と距離を測定 | Monnier et al. 2012 | `2012ApJ...761L...3M` |
| アークトゥルス | 太陽の25.4倍 (±0.2) | 角直径と距離を測定 | Ramírez and Allende Prieto 2011 | `2011ApJ...743..135R` |
| アルデバラン | 太陽の44.2倍 (±0.9) | 角直径と距離を測定 | Richichi and Roccatagliata 2005 | `2005A&A...433..305R` |
| リゲル | 太陽の78.9倍 (±7.4) | 角直径と距離を測定 | Moravveji et al. 2012 | `2012ApJ...747..108M` |
| アンタレス | 太陽の680倍 (+139 −99) | 角直径と距離を測定 | Ohnaka et al. 2013 | `2013A&A...555A..24O` |
| ベテルギウス | 太陽の1,057倍 (+228 −162) | 角直径と距離を測定 | Haubois et al. 2009; Harper et al. 2017 | `2009A&A...508..923H`, `2017AJ....154...11H`, `2005ApJ...628..973L` |
| おおいぬ座VY星 | 太陽の1,420倍 (±120) | 角直径と距離を測定 | Wittkowski et al. 2012 | `2012A&A...540L..12W`, `2012ApJ...744...23Z` |
| WOH G64 | 太陽の1,540倍 (±77) | 明るさと温度から | Levesque et al. 2009 | `2009AJ....137.4744L`, `2008A&A...484..371O`, `2024A&A...691L..15O` |
| たて座UY星 | 太陽の1,708倍 (±192) | 角直径は測定、距離は視差ではない | Arroyo-Torres et al. 2013 | `2013A&A...554A..76A` |
| ステファンソン2-18 | 太陽の2,150倍 (+710 −290) | 明るさと温度から | Fok et al. 2012 | `2012ApJ...760...65F`, `2007ApJ...671..781D`, `2010PASJ...62..391D` |

3列目は、その行の `basis` です。**定義** (太陽の公称半径、695,700 km)、**角直径と距離を測定**、**角直径は測定、距離は視差ではない** (たて座UY星: 半径は大きくずれているかもしれません)、**明るさと温度から** (WOH G64 とステファンソン2-18: 角直径は測られていないので大きさは推定で、絵とラベルに「推定」と出します) です。角直径の半分に距離をかけて出した半径は、テストで、その論文が使った距離と合うかを確かめています。論文の数字からここで計算した半径が2つあります (`how: "worked-out"`): ベテルギウスは、測った角直径の半分に論文の距離をかけたもの、ステファンソン2-18は、論文の光度と温度からステファン・ボルツマンの法則で出したものです。ベガは扁平率0.113 (赤道半径は太陽の2.726倍、極半径は2.418倍) で、空では極の方向から見えていますが、絵では極を立てて描きます。太陽は IAU の公称値です。

## 論文の意見が分かれるところ

ラベルにもそう書いてあり、各行の `note` と `others` に、英語と日本語で入っています。使う値は、いつも測定した値で、理由も書きます。

- **ベテルギウス**: 大きさは距離しだいですが、これほど大きい星の距離は測りにくいのです。測った角直径 (44.28 mas、Haubois ほか 2009) と、Harper ほか 2017 の距離 (222 pc) から、**太陽の1,057倍** (+228、-162) になります。同じ角直径でも、Harper ほかのもう一つの解 (190 pc) では太陽の約905倍です。Joyce ほか 2020 は、星のモデルと距離168 pcから764倍を出しています。モデルから出した大きさは測定ではないので、名前は挙げますが使いません。星のページの初期値 (シリウスA、ベテルギウス、リゲル、ベガ) はこの表を読むので、二つのページの数字は一致します。
- **たて座UY星**: 角直径 (5.48 mas、Arroyo-Torres ほか 2013) は測ってありますが、距離は測ってありません。論文の2.9 kpc は古い推定です。これで**太陽の1,708倍** (±192) になり、大きさが不確かだと行に書いてあります。ガイア時代の約1.8 kpc なら、同じ角直径で太陽の約1,060倍になります。Healy ほか 2024 は、測った大きさではなく、測光とガイアの距離から、改訂値の909倍を出しています。このくらべでは、測った角直径と、それを測った論文が使った距離を使います。太陽の900倍から1,700倍の間と考えてください。
- **おおいぬ座VY星**: 古い論文は距離を1.5 kpc として、もっと大きな星だと考えていました。Choi ほか 2008 と Zhang ほか 2012 の電波による視差で距離が約1.2 kpc になり、Wittkowski ほか 2012 がロスランド直径 (11.3 mas) を測って、**太陽の1,420倍** (±120) になりました。
- **WOH G64**: 星そのものの角直径は測られていません。2024年の2 masの画像 (Ohnaka ほか) は、星ではなくまわりのちりです。Levesque ほか 2009 が、スペクトルから温度3,400 K を出し、明るさを大マゼラン雲の距離50 kpc で使って、**太陽の1,540倍** (誤差5%、推定) としました。Ohnaka ほか 2008 はちりのモデルから1,730倍を出しており、この星は2009年から2016年の間に変化したので、決まった半径はありません。
- **ステファンソン2-18**: 角直径は測られておらず、距離は運動学的な値で約3分の1の不確かさがあり、温度はちりのモデルから出したものです (Fok ほか 2012)。**太陽の2,150倍** (+710、-290。誤差は距離だけから) は、ここでいちばん不確かな大きさで、これと別の星のどちらが最大かは、これらの数字しだいです。

## ふつうのページで

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The size line-up, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/lineup/+esm"></script>
  </head>
  <body>
    <wakusei-lineup stars="bright" planets at="betelgeuse" size="720"></wakusei-lineup>
  </body>
</html>
```

要素は `<wakusei-lineup>` です。エントリポイント `/lineup` に、星の見た目、地球と木星の見た目、要素が入っていて、three.js は3Dを表示するときにだけ読み込みます。

| 属性 | はたらき |
|---|---|
| `stars` | `all` (初期値)、`bright`、`largest`、またはカンマ区切りの id |
| `planets` | 地球と木星を加えます (`planets="off"` で外します) |
| `layout` | `row` (初期値) または `stack` |
| `zoom` / `at` | カメラの最初の位置: 0から1、または天体の id (初期値は太陽) |
| `turn` | `off` で、天体が自分で回るのを止めます。動きを減らす設定のときは、`on` でない限り回りません |
| `look` | 惑星の見た目: `realistic` (初期値) または `painted` (地球の地図はパブリックドメイン。木星は Nestaeric、CC BY 4.0 で、変更も書きます) |
| `labels` | `off` でラベルを隠します |
| `controls` | `none` でズームのスライダーを隠します |
| `size`、`lang` | 横のピクセル数 (720)、`en` または `ja` |
| `quality` | `full` または `low` (非力な端末向けの、動かない表面。メモリ2 GB以下かコア2つ以下なら自動で選ぶ) |
| `live` | `always` (初期値)、`hover`、`off`: ページに1つの WebGL をいつ使うか |

星をドラッグすると回せます (タッチ画面では横になぞります)。Ctrl・Command・Alt を押しながらのホイールでズームします。要素にフォーカスがあるときは、矢印キーで次の天体へ、`+` と `-` で少しズーム、Home と End で両端へ、ダブルクリックですべての星を元に戻します。`zoomTo("betelgeuse")` はそこへ移り (動きを減らす設定なら一瞬で)、着いた時点で完了します。`zoom` はズームの値 (数字)、`focused` は写っている天体の id で、変わるたびに `wakusei-lineup-zoom` が送られます。

## ES モジュールで

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The size line-up with Vite</title>
  </head>
  <body>
    <wakusei-lineup stars="bright" planets></wakusei-lineup>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts no-run
import "@johnmorrisdotca/wakusei-planets/lineup";
import type { WakuseiLineup } from "@johnmorrisdotca/wakusei-planets/lineup";

const lineup = document.querySelector<WakuseiLineup>("wakusei-lineup")!;
// glide from the Sun up to Betelgeuse; the zoom slider, a drag on a star and the keys work by themselves
void lineup.zoomTo("betelgeuse");
lineup.addEventListener("wakusei-lineup-zoom", (event) => console.log((event as CustomEvent<{ focus: string }>).detail.focus));
```

## React

```tsx
import { useEffect } from "react";

export function LineupView({ stars = "bright", planets = true, at = "betelgeuse" }: { stars?: string; planets?: boolean; at?: string }) {
  useEffect(() => {
    // The element needs a browser, so it is imported here, never at the top of the file: a server render never reaches an effect.
    void import("@johnmorrisdotca/wakusei-planets/lineup");
  }, []);
  return <wakusei-lineup stars={stars} planets={planets ? "" : undefined} at={at} />;
}
```

React には、この要素の型を一度だけ教えます:

```ts no-check
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wakusei-lineup": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { stars?: string; planets?: string; layout?: string; at?: string; zoom?: number | string; turn?: string; size?: number | string };
    }
  }
}
```

## Vue

```vue
<script setup lang="ts">
import { onMounted } from "vue";

withDefaults(defineProps<{ stars?: string; planets?: boolean; at?: string }>(), { stars: "bright", planets: true, at: "betelgeuse" });

// The element needs a browser: import it once the component is on the page, never while a server renders it.
onMounted(() => {
  void import("@johnmorrisdotca/wakusei-planets/lineup");
});
</script>

<template>
  <wakusei-lineup :stars="stars" :planets="planets ? '' : undefined" :at="at"></wakusei-lineup>
</template>
```

Vue には、このタグが要素だと一度だけ教えます:

```ts no-check
import { createApp } from "vue";
import LineupView from "./LineupView.vue";

const app = createApp(LineupView);
app.config.compilerOptions.isCustomElement = (tag) => tag === "wakusei-lineup";
app.mount("#app");
```

## Angular

```ts no-check
import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-lineup-view",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wakusei-lineup [attr.stars]="stars" [attr.planets]="planets ? '' : null" [attr.at]="at"></wakusei-lineup>`,
})
export class LineupViewComponent implements OnInit {
  @Input() stars = "bright";
  @Input() planets = true;
  @Input() at = "betelgeuse";

  ngOnInit(): void {
    // The element needs a browser: ngOnInit also runs when a server renders, so the import waits for one.
    if (typeof window !== "undefined") void import("@johnmorrisdotca/wakusei-planets/lineup");
  }
}
```

## Svelte

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  let { stars = "bright", planets = true, at = "betelgeuse" }: { stars?: string; planets?: boolean; at?: string } = $props();

  // The element needs a browser: onMount never runs on the server.
  onMount(() => {
    void import("@johnmorrisdotca/wakusei-planets/lineup");
  });
</script>

<wakusei-lineup {stars} planets={planets ? "" : undefined} {at}></wakusei-lineup>
```

## iframe で

埋め込みページは、アドレスに `lineup=1` を付けると、同じ名前の指定を受け付けます: `stars`、`planets=1`、`layout`、`zoom`、`at`、`turn=off`、`look`、`labels`、`lang`。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The size line-up in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/wakusei-planets/embed.html?lineup=1&stars=bright&planets=1&at=betelgeuse"
      title="Wakusei Planets size line-up"
      width="720"
      height="405"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

デモの[大きさくらべのページ](https://johnmorrisdotca.github.io/wakusei-planets/lineup.html)は、設定したとおりのこのコードと、上のほかの方法のコードを書き出します。

## 画像で保存、ポスターで印刷

ページのボタンは、kazoku-ui の2つの部品を使います。`picture()` は、いまの絵を SVG で返します (星は画像、ラベルはベクターの文字)。`toSvg()` と `toPng(scale)` は、同じ絵を文字列と PNG で返します。ページは SVG を kazoku-ui の `saveImage` に渡し、A4 かUSレターのポスターには `buildSheet` と `printSheet` を使います。写っている星の名前、半径、出典が情報の欄に入り、ページへの QR コードも付きます。

```ts no-run
import "@johnmorrisdotca/wakusei-planets/lineup";
import type { WakuseiLineup } from "@johnmorrisdotca/wakusei-planets/lineup";
import { buildSheet, printSheet } from "@johnmorrisdotca/kazoku-ui/print";

const lineup = document.querySelector<WakuseiLineup>("wakusei-lineup")!;
const svg = await lineup.picture();
svg.setAttribute("style", "display:block;width:100%;height:100%");
const holder = document.createElement("div");
holder.style.cssText = "position:absolute;inset:0";
holder.append(svg);
printSheet(buildSheet({ page: "letter", orientation: "landscape", title: "Size line-up", pages: [holder] }));
```

## ページなしで

表と計算にブラウザはいりません。`lineupBodies`、`lineupText`、`placeLineup`、`lineupView`、`lineupProject`、`lineupLabels` は、どれも純粋な関数です。

```js
import { lineupBodies, lineupText } from "@johnmorrisdotca/wakusei-planets";

// The table of radii needs no browser: the largest known stars, smallest first, with the error and the source of each.
const largest = lineupBodies({ set: "largest" }).at(-1);
const text = lineupText(largest, "en");

console.log(`${text.name}: ${text.radius}, ${text.km}, ${text.source}`);
```

## 速さとメモリ

すべての天体は1つの three.js のシーンにあり、共有レンダラーで描きます。WebGL は1つ、キャンバスは600万ピクセル以内・一辺4096ピクセル以内で、止まっているとき、要素が見えないとき、タブが隠れているときは何も描きません。失われたコンテキストは復旧し、ジオメトリ・マテリアル・テクスチャはすべて解放します。小さすぎて見えない星 (半径5分の1ピクセル未満) と画面の外の星は、まったく描きません。ページが見えている間、天体は回ります。`turn="off"` で止めると、絵を動かしたときだけ描きます。この要素は独自のフレーム上限を持たず、何かが動いている間だけ、共有レンダラーに次のフレームを頼みます。

## 測ったものと、描いたもの

どの星も、温度 (色)、半径 (大きさ)、光度階級 (表面の細かさ) から描きます。細胞のようなもよう、黒点、光は、[星のページ](star-look.md)と同じく作りものです。大きさは表の値で、それぞれどのくらい確かかは表に書いてあります。
