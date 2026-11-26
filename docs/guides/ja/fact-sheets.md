---
title: ファクトシート
section: how-to
order: 15
description: 太陽、惑星、冥王星のファクトシートを、日本語と英語のデータとして提供します。
---

`/fact-sheets` は、惑星についてのページがたいてい載せていることを、印刷や検索やカードに使えるデータにしたものです。大きさ、太陽からの距離、1年と1日の長さ、知られている衛星の数、NASA の公式ページ、日本語と英語の短い説明が入っています。ブラウザー用のコードはないので、サーバーでも動きます。

```ts
import { factSheet } from "@johnmorrisdotca/wakusei-planets/fact-sheets";

const mars = factSheet("mars");
console.log(mars.name.en, mars.name.ja);
console.log(Math.round(mars.radius.km), Math.round(mars.distanceFromSun.miles / 1e6), mars.yearDays, mars.rotationHours.toFixed(1));
console.log(mars.knownMoons, mars.moonsReadOn, mars.nasaPage);
console.log(mars.description.ja);
```

`factSheet` には `"sun"`、`"mercury"` から `"neptune"` まで、または `"pluto"` を渡します。呼ぶたびに新しいオブジェクトを返し、それ以外の id は、その id を示す `RangeError` を投げます。フィールドは次のとおりです。

| フィールド | 意味 |
|---|---|
| `radius` | 赤道半径。`km` と `miles` |
| `distanceFromSun` | 平均距離。`au`、`km`、`miles` (太陽は 0) |
| `yearDays` | 恒星年 (地球の日数)。太陽は `null` |
| `rotationHours`、`retrograde` | 恒星に対して1回自転する時間と、逆向きに自転するか (金星、天王星、冥王星)。太陽日の長さではありません |
| `knownMoons`、`moonsReadOn` | 知られている衛星の数と、その数を読み取った日付。衛星が見つかるたびに数は増えます。`/moon-catalogue` と同じ数です |
| `nasaPage` | その天体についての NASA の公式ページ |
| `description` | 私たち自身の言葉による短い説明。`en` と `ja` |

## 準惑星と小天体の軌道

`minorFact(id)` (id は `MINOR_FACT_IDS`) は、冥王星以外の準惑星と、このパッケージが描く小天体について、カードに出せる楕円です。ケレス、オルクス、ハウメア、クワオアー、マケマケ、ゴンゴン、エリス、セドナ、ベンヌ、エロス、ベスタ、パラス、ケイロン、フォルス、ハレー彗星、アロコスです。`aAu` は軌道長半径、`perihelionAu` は楕円が太陽にいちばん近づく距離で、どちらも天文単位です。`periodDays` は恒星周期 (日) です。これらは、パッケージがすでに持っている接触軌道要素で (`NOTICE.md`)、新しく合わせたものではありません。冥王星は `factSheet` のままです。1年の長さはそこにあり、位置は合わせた表から出すので、一つの楕円ではありません。いつ、だれが見つけたかは `/discovery` の `discoveryOf` です。

```ts
import { minorFact } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
import { discoveryOf } from "@johnmorrisdotca/wakusei-planets/discovery";

const vesta = minorFact("vesta");
console.log(vesta.name.en, vesta.aAu, vesta.periodDays);
console.log(discoveryOf("vesta")!.date?.value, discoveryOf("vesta")!.by?.value.join(", "));
```

## 事実の出どころ

半径と自転は IAU の作業部会の値、距離は JPL の近似軌道要素です (どちらもすでにパッケージに入っています。`NOTICE.md` を参照)。1年の長さは NASA の惑星ファクトシート、衛星の数は JPL の惑星衛星のページの値です。リンクは NASA のページへ移動するだけで、中身は写していません。説明はここで書いたもので、NASA、IAU、百科事典、ほかのパッケージの文章は写していません。

## npm-solar-system から移るとき

npm-solar-system の `getMars()` などを使っていたなら、同じ事実とそれ以上が入っています。ES モジュール専用ですが、Node 22.12 以降なら ES モジュールを `require()` できるので、`const { factSheet } = require("@johnmorrisdotca/wakusei-planets/fact-sheets")` も使えます。まだないもの: 流星群の一覧とデモページ。
