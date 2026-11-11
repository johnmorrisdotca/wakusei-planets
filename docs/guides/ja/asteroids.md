---
title: 小惑星と遠くの小天体
section: how-to
order: 19
description: "JPL の小天体データベースから、小惑星・ケンタウルス族・太陽系外縁天体を約100個。軌道、大きさ、訪れた探査機、任意の日の位置を求めます。表 (約17 kB) は /asteroids だけが持ちます。"
---

`/asteroids` は、104個の小天体のセットです。大きい主小惑星帯の小惑星、探査機が訪れた天体 (エロス、イトカワ、リュウグウ、ベンヌ、アロコスなど)、有名な地球接近小惑星 (アポフィス、2024 YR4、ファエトン)、木星のトロヤ群 (ルーシー探査機の目標、ヘクトル、アキレス)、ケンタウルス族、太陽系外縁天体を含みます。各記録には、軌道 (ある時刻の接触軌道要素。2026-11-11 に JPL の小天体データベースから読み取り)、情報源が示す範囲での大きさ・自転・明るさ・色の分類、訪れた探査機、発見の年があります。DOM も three.js も使わず、どこでも動き、読み込みの手順も要りません。表 (gzip で約17.6 kB) はこの入口だけが持ち、`/asteroids` を読み込まないページには入りません。

```ts
import { asteroidDistances, asteroidPositionAu, findAsteroid } from "@johnmorrisdotca/wakusei-planets/asteroids";

const eros = findAsteroid("Eros")!;
const day = new Date("2026-11-11T12:00:00Z");
const d = asteroidDistances(eros, day);
console.log(eros.name.en, eros.name.ja, "is a", eros.group, "asteroid, found in", eros.discoveryYear, "and visited by", eros.missions[0]!.name);
console.log("it is", d.sunAu.toFixed(2), "au from the Sun and", d.earthAu.toFixed(2), "au from the Earth;", d.lightMinutes.toFixed(1), "light minutes");
console.log("x, y, z in au:", asteroidPositionAu(eros, day).map((au) => au.toFixed(3)).join(", "));
```

## セットの内容

| 種類 | 数 | 例 |
|---|---|---|
| `main-belt` (主小惑星帯) | 38 | ヒギエア、インテラムニア、プシケ、ガスプラ、イダ、ルテティア、シュテインス |
| `near-earth` (地球接近) | 29 | エロス、イトカワ、リュウグウ、ベンヌ、アポフィス、2024 YR4、ファエトン、ディディモス、カモオアレワ |
| `trojan` (トロヤ群) | 16 | ヘクトル、アキレス、パトロクロス、エウリュバテス、ポリュメレ、レウコス、オルス |
| `centaur` (ケンタウルス族) | 7 | カリクロー、ネッソス、アスボルス |
| `trans-neptunian` (太陽系外縁) | 14 | アロコス、サラキア、ヴァルナ、イクシオン、ヴァルダ、アルビオン、レレアークーホヌア |

地球接近小惑星には `group` もあります。アティラ群1、アテン群4、アポロ群20、アモール群4です。このパッケージがすでに持つ天体は重ねて入れていません。ケレス、パラス、ベスタ、ケイロン、ポルス、ハレー彗星、冥王星、準惑星のオルクス、ハウメア、クワオアー、マケマケ、ゴンゴン、エリス、セドナには、それぞれ詳しい別の表があります (そのため、ここで最も大きい小惑星は4番目に大きいヒギエアから始まります)。`hazardous` は、JPL が「潜在的に危険な小惑星」とする印です。`H`、`diameterKm`、`albedo`、`rotationHours`、`spectral`、発見の年は、情報源に値がなければ省いています。

## 使える関数

| 関数 | 返すもの |
|---|---|
| `ASTEROIDS` と `asteroidList()` | すべての記録 |
| `asteroidsOfKind(kind, group?)` | 1つの種類 (または地球接近小惑星の1つの群) の天体 |
| `findAsteroid(query)` | id、番号、仮符号、英語名・日本語名で記録を探す (大文字小文字、アクセント、空白は問いません) |
| `asteroidPositionAu(body, when)` と `asteroidPosition(body, when)` | 太陽からの x, y, z。天文単位 (`heliocentric` と同じ単位) またはキロメートルで、J2000黄道座標 |
| `asteroidDistances(body, when)` | 太陽と地球からの距離 (au、km、月までの距離の倍数) と光の到達時間 |
| `asteroidOrbitPoints(body, count)` | 軌道を1周する点。線を描くためのもの |
| `asteroidPeriodDays(body)` | 周期 (日) |
| `asteroidFromElements(name, elements)` | 自分の天体の記録。種類は軌道から求めます |
| `asteroidAsSmallBody(body)` | 同じ軌道を、データの入口の `SmallBody` として返す。`<wakusei-space>` の点と一緒に描くためのもの |

```ts
import { asteroidFromElements, asteroidOrbitPoints, asteroidsOfKind } from "@johnmorrisdotca/wakusei-planets/asteroids";

for (const a of asteroidsOfKind("near-earth", "Aten")) console.log(a.name.en, a.hazardous ? "(potentially hazardous)" : "");
const mine = asteroidFromElements("2026 XX", { epochJd: 2461200.5, a: 1.8, e: 0.4, i: 12, node: 80, peri: 120, ma: 10 });
console.log(mine.kind, mine.group, asteroidOrbitPoints(mine, 90).length, "points on its orbit");
```

## どのくらい正確か

動きは二体問題です。軌道要素からケプラーの方程式をこのパッケージ自身の解法で解き、惑星の引力は含みません。元期 (2026-06-09) では JPL Horizons と 0.0000001 au 未満で一致します。元期から離れると誤差は増えます。あらゆる種類の16天体で、各元期の1年前から1年後までの5つの時刻に、(惑星の影響を含む) Horizons の位置と比べた最大の誤差は、半年以内で 0.001 au (15万 km)、1年以内で 0.004 au (60万 km) でした。主小惑星帯の小惑星が最も悪く、ほかはその4分の1未満です。`ASTEROID_ACCURACY` がこの数値を示します。1年を超える日付や惑星の近くでは、位置は目安としてお使いください。2029年の接近を2026年の軌道要素から求めることはしません。アポフィスの地球接近は `/approaches` にあります。

軌道要素は、どれも2026-06-09の接触軌道要素です。ベンヌと 2018 AG37 の軌道解はほかの年のものなので、その日付の Horizons の接触軌道要素を使っています。`ASTEROIDS_FETCHED` は記録を読み取った日付です。天体が観測されるたびに軌道は改良されます。

## 数値の出どころ

軌道と物理量は小天体データベースのクエリ API から、発見日はその API から、2026-11-11 に `scripts/make-asteroids-data.py` で取得しました。このスクリプトは Horizons との誤差も測り、`src/data/asteroids.ts` を書き出します。NASA のデータは米国政府の著作物でパブリックドメインです。[NOTICE.md](../../../NOTICE.md) に書いてあります。ミッションとその年は事実そのものです。まだ先の訪問には `planned` の印が付いています。
