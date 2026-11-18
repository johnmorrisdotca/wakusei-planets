---
title: 発見の記録
section: how-to
order: 16
description: 各惑星、準惑星、くわしく描く衛星が、いつ、どこで、どのように、だれによって見つかったか。最初の仮符号と名前の由来も、事実ごとに出どころをそえたデータです。
---

`/discovery` は、それぞれの天体がどのようにして見つかったかを、印刷や検索やカードに使えるデータにしたものです。日、場所、見つけた人、方法、最初の仮符号、番号、名前の由来が入っています。どの事実にも、どこから読んだかが書いてあるので、ページに出すこともできますし、読む人が確かめることもできます。

```ts
import { discoveryOf, DISCOVERY_SOURCES } from "@johnmorrisdotca/wakusei-planets/discovery";

const neptune = discoveryOf("neptune")!;
console.log(neptune.date?.value, neptune.place?.value, neptune.by?.value.join(", "));
console.log(neptune.nameOrigin?.value);
for (const note of neptune.notes) console.log(note);
const where = neptune.date!.source;
console.log("read from", DISCOVERY_SOURCES[where]![0]);
```

`discoveryOf(id)` は、`DISCOVERY_IDS` にある46個の天体の記録を返します。8つの惑星、9つの準惑星、月、そしてこのパッケージがくわしく描く28個の衛星です。`DISCOVERIES` は全部を順に並べたものです。項目は次のとおりで、読んだ出どころのどれにも載っていないものは `null` です。

| 項目 | 意味 |
|---|---|
| `ancient` | `true` は水星から土星まで、地球、月。記録のはじまる前から知られていて、日付も場所も発見者もありません |
| `date` | 日 (`1846-09-23`)。出どころが月までしか書いていないときは月 (`1989-06`)。出どころが挙げる観測の日で、天体だと気づいた日とはかぎりません。ほかの出どころと違うところは `notes` に書いてあります |
| `place` | 天文台、都市、探査機。出どころの書き方のままです |
| `by` | 発見者。出どころの書き方のままです (ハウメアは `null`。Gazetteer も JPL も人の名前を挙げていません) |
| `method` | 見つけた方法。`ancient`、`visual`、`calculation` (海王星)、`photographic`、`electronic`、`adaptive-optics`、`space-telescope`、`spacecraft`。これだけは、場所と日付からこのパッケージで割り出したもので、一覧から読んだものではありません。出どころは `derived` です |
| `designation` | 最初の仮符号。冥王星は `1930 BM`、カロンは `S/1978 P 1` |
| `number` | 小惑星番号 (`(134340)`)、またはその惑星の衛星としての番号 (`Saturn VI`) |
| `announced` | 2005年以降に見つかった衛星を発表した回報 |
| `namedBy` | 古い衛星に名前をつけた人 (Gazetteer が書いているとき) |
| `nameOrigin` | 名前の由来。出どころの文は写さず、このパッケージで書いた文です |
| `notes` | ほかの出どころと日付や功績が違うところ、項目に載せなかったこと |

## 事実の出どころ

| キー | 出どころ | 読んだ日 |
|---|---|---|
| `usgs` | 国際天文学連合の惑星系命名作業部会の Gazetteer of Planetary Nomenclature (USGS が運営、米国政府の著作物)。日、場所、発見者、各名前の由来 | 2026-11-18 |
| `jpl-sbdb` | JPL の Small-Body Database の発見記録で、小惑星センターが公表した内容です (番号のついた小惑星の最初の仮符号、日、場所、発見者) | 2026-11-18 |
| `jpl-ssd-moons` | JPL の Planetary Satellite Discovery Circumstances。衛星の仮符号と番号、それを知らせた回報 (`/moon-catalogue` と同じときに取得したものです) | 2026-11-11 |
| `wikidata` | Wikidata (CC0)。ほかの出どころに載っていないときだけ。海王星の発見者とされる4人、ヴァンスが見つかった日、いくつかの名前の由来 | 2026-11-18 |
| `derived` | ここで割り出したもので、公表されたものではありません。対象は `method` です | 2026-11-18 |

名前とアドレスは `DISCOVERY_SOURCES` にあります。記録は `scripts/make-discovery-data.py` が作ります。これは何も取ってこないので、事実を変えるときは、そのファイルを出どころといっしょに書き換えます。

どの観測を数えるかで日が分かれるところは、Gazetteer の日を使い、もうひとつの日を `notes` に書いています。冥王星は1930年1月23日で、乾板を撮った日です (Wikidata は1930年2月18日)。カロンは1978年4月13日です (Wikidata は6月22日)。イオは1610年1月8日 (Wikidata は7日)、ミマスは1789年7月18日 (Wikidata と Wikipedia は9月17日) です。ヴァンスの日は、Gazetteer に載っていないので Wikidata のものです。場所と方法も、どちらの出どころにも書いていないので、省いてあります。

だれの功績かで分かれるところは、`by` は Gazetteer か JPL に従い、残りを `notes` に書いています。海王星は、ベルリンで見つけた J.G. ガレです。Wikidata は、ほかにルヴェリエとアダムズ (どこにあるはずかを計算した人)、ダレストも功績者に挙げています。ハウメアには人の名前がなく、Wikidata が挙げる人は `notes` にあります。

## 載せていないこと

小惑星に番号がついた日と、名前がついた日は、この記録にありません。JPL の記録は、それを決めた小惑星センターの回報のまとまり (冥王星は `20060907/Numbers.arc`) を挙げていて、日は挙げていません。衛星の名前が認められた日を挙げている出どころも、読んだ中にはありません。あとから記録に足せます。
