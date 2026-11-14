---
title: 小天体と準惑星の事実
section: how-to
order: 35
description: ベスタ、パラス、ケイロン、ポルス、ハレー彗星と9つの準惑星の、軌道の大きさ、形、周期と発見を、数値ごとの誤差、元期、出典つきのデータとして返します。
---

`@johnmorrisdotca/wakusei-planets/minor-facts` の `MINOR_FACTS` は、小さな天体のカードに必要で、`bodyInfo` が返さない情報を持ちます。軌道の大きさと形、周期、だれがいつ見つけたかです。宇宙ビューが置く5つの小天体 (ベスタ、パラス、ケイロン、ポルス、ハレー彗星) と、9つの準惑星 (ケレス、冥王星、オルクス、ハウメア、クワオアー、マケマケ、ゴンゴン、エリス、セドナ) が対象です。`MINOR_FACT_IDS` が一覧で、`minorFacts(id)` は大文字小文字を問わず id で1つ探します。

```js
import { MINOR_FACTS, periodYears } from "@johnmorrisdotca/wakusei-planets/minor-facts";

// What is known of two small bodies: the size of the orbit (its semi-major axis), the period and who found it, each with the uncertainty the Small-Body Database gives. Plain data, no browser, no clock read.
for (const id of ["halley", "eris"]) {
  const body = MINOR_FACTS[id];
  const a = body.orbit.semiMajorAxisAu;
  console.log(`${body.designation}: semi-major axis ${a.value.toFixed(1)} au, period ${periodYears(body).toFixed(1)} years, found ${body.discovery.date} by ${body.discovery.by[0]} (read ${body.source.read})`);
}
```

数値はすべて `{ value, sigma }` です。値と、同じ単位の1シグマの誤差で、NASA/JPL の小天体データベース (Small-Body Database) が示すとおりです。データベースが誤差を示さないとき (冥王星の軌道がそうです) は `sigma: null` です。軌道 (`orbit.semiMajorAxisAu`、`eccentricity`、`perihelionAu`、`aphelionAu`、`periodDays`) は、データベースの接触軌道要素を、その元期 (`orbit.epoch`、ユリウス日) の値で持ちます。その時点から先は太陽の引力だけが働くとしたときの軌道です。実際の軌道は惑星の引力で少しずつ変わるので、数値はその時点のもので、いつでも通じるわけではありません。彗星の周期は特にそうです。元期は、冥王星 (2457588.5、2016年7月19日) とハレー彗星 (2439875.5、1968年1月20日) 以外は 2461200.5 (2026年6月9日) です。`periodYears(facts)` は、日で表した周期を365.25で割った年数で、データベースが示す値ではなく、ここで計算します。

`discovery` は、日付 (`YYYY-MM-DD`)、データベースの書き方での発見者の名前、データベースが挙げる場所で、データベースが示すとおりです。発見がデータベースにない天体にはありません (ここの天体にはすべてあります)。`source` は、その記録がどの回答から写されたか (もう一度得られる URL)、出典の名前、読んだ日 (2026年11月13日) を言います。出典と条件は NOTICE.md にあります。事実は1つの出典の言うことです。他の出典と違うところ (ハレー彗星をだれが見つけたかは、何を発見とするかによります) は、データベースの言うとおりにしています。

`/asteroids` には、ほかの100個ほどの天体が、それぞれの軌道要素、大きさ、発見の年とともにあります。この14個はそちらには重ねてありません。
