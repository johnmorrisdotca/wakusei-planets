---
title: 月と火星の場所
section: how-to
order: 20
description: "月と火星の、すべての着陸地点・探査車・墜落・衝突地点と、名前のある地形。位置、日付、運用者、出典付き。表は gzip で33 kB と36 kB。そして任意の天体の太陽直下点、明暗境界線、地方太陽時。"
---

`/places` は、月と火星の表面で何がどこにあるかを扱います。`/places/moon` と `/places/mars` は、それぞれ1つの一覧です。探査機が表面に達した場所 (着陸した、走行した、墜落した、狙って衝突させた) と、名前のある地形 (海、山、谷、大きなクレーター) が入っています。各場所には、緯度と経度、英語と日本語の名前、出どころがあります。`/places` は、レコードの形、一覧の検索、大円距離、そして並んで必要になる補助関数 (太陽直下点、明暗境界線、任意の時刻の地方太陽時) を持ちます。DOM も three.js も使わず、どこでも動き、ページが払うのは表示する天体の分だけです。2つの表は別々の入口で、`loadPlaces("moon")` が必要なときに1つを取り込みます。

```ts
import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
import { findPlace, isDaylight, localSolarTime, nearestPlace, placeDistanceKm } from "@johnmorrisdotca/wakusei-planets/places";

const eagle = findPlace(PLACES_MOON, "Apollo 11 lunar module")!;
const taurus = findPlace(PLACES_MOON, "Apollo 17 lunar module")!;
console.log(eagle.name.en, eagle.name.ja, eagle.lat.toFixed(3), eagle.lon.toFixed(3), eagle.date, eagle.operator, eagle.source.id);
console.log(Math.round(placeDistanceKm("moon", eagle, taurus)), "km from Apollo 17");
const now = Date.UTC(2026, 10, 11, 12);
console.log("Tranquility Base:", localSolarTime("moon", eagle.lon, now).toFixed(1), "o'clock by the Sun,", isDaylight("moon", eagle.lat, eagle.lon, now) ? "daylight" : "night");
console.log("nearest visited place to 20 N, 30.7 E:", nearestPlace(PLACES_MOON, 20, 30.7, "crewed", "landing", "rover")?.place.name.en);
```

## 一覧の中身

| 種類 | 内容 | 月 | 火星 |
|---|---|---|---|
| `crewed` | 人が乗った着陸 (アポロの月着陸船6機) | 6 | 0 |
| `landing` | 着陸後に動作した着陸機 | 22 | 12 |
| `rover` | そこを走った探査車。地表に着いた地点 (走行経路ではありません) | 13 | 7 |
| `impact` | 狙って表面に衝突させた探査機 | 14 | 0 |
| `crash` | 表面にぶつかって失われた探査機 (使用後に落とした上昇段、寿命の終わりの周回機、上段ロケットも) | 35 | 6 |
| `planned` | 発表されていて、まだ飛んでいない着陸 | 0 | 0 |
| `feature` | IAU の一覧にある名前のある地形 | 768 | 914 |

地点のレコードには、`mission` (カタログでの天体の名前)、`operator` (カタログの機関・企業の符号)、`country`、`date` (UTC。時刻がわかる場合は分まで、わからない場合は日か月まで)、`outcome` (`crewed`、`soft`、`hard`、`impact`) があり、ある場合は着陸地点自身の名前 (`site`: `Statio Tranquillitatis`、`Octavia E. Butler Landing`)、カタログの `note`、わかっていれば動作を止めた時刻 (`until`) も付きます。地形には、IAU の分類とその平易な語 (英語と日本語)、大きさ (キロメートル)、名前が承認された日があります。月の地点は、6回の有人着陸、ソ連・米国・中国・インド・日本・イスラエルと民間の着陸機、探査車、そしてレインジャー、ルナ、ルナ・オービター、サターンの上段、LCROSS、GRAIL などの衝突地点です。火星には、マルス2号から祝融号までの着陸機と探査車、到着時に失われた機体 (マーズ・ポーラー・ランダー、2機のディープ・スペース2、ビーグル2、スキアパレッリ) があります。地形は、Gazetteer のアルベド模様を除くすべての種類の地形、80 km 以上のクレーター、そして小さくても有名なもの (アリスタルコス、ケプラー、ジェゼロ) です。

**計画中の着陸**は、まだ収録していません。日付は動くので、機関自身の発表を人の手で入力し、読んだ日を添えたもの (`planned: { date, status, read }`) だけを収録することにしています。まだ1件もないので、`placesOfKind(places, "planned")` は今は空です。

## どこにあるか、どこまで確かか

場所の `lat` は惑星中心緯度で北が正、`lon` は -180 から 180 の東経です。月の経度は平均地球・極軸系、火星の経度は IAU の座標系です。Gazetteer は火星の経度を 0 から 360 の東経で書いていて、変換してあります。火星の緯度は、出典によって惑星中心のものと惑星測地のものがあり、どちらかが書かれていないこともあります。火星では2つは最大 0.2 度 (12 km) 違うので、火星の地点は数 km の精度で、NASA 自身のページが食い違う場合は数十 km です (下記)。

月の地点の位置は NASA のものです。LRO の画像による位置を載せた NASA の「月面の人工物の衝突と探査機の表」です。GCAT にある探査機の位置がこの表にあるときは、表の位置を記録に使い (`source.id` は `nssdca`)、GCAT 自身の値が 0.05 度を超えて違うときは `gcatPosition` に残します。これで GCAT の月の位置のうち18件が置き換わりました。そのうち3件はカタログの明らかな誤りで、ページに描くと赤道や本初子午線の反対側に出てしまうものでした。サーベイヤー1号 (カタログは北緯 2.47 度、NASA の表は南緯 2.47 度)、IM-2 アテナ (西経 29.2 度に対して東経 29.2 度)、アポロ16号の子衛星 (0, 0 と記載) です。表では大まかな位置しかない探査機や、カタログにしかない探査機もあり、それらのレコードには `approximate: true` が付きます。これは1度以下の精度で書かれた位置にも付き、実際の場所は点から数十 km 離れていることがあります (ルナ2号、ルナ7号、ルナ8号、ひてん、ルナ・プロスペクター、チャンドラヤーン1号の衝突機。火星ではマルス2号、マルス6号、ディープ・スペース2とポーラー・ランダー)。ルナ9号にも付けています。その位置は最初のソ連の報告のもので、NASA の表は着陸機がその地点にはないと述べています (カタログとは 0.75 度、23 km 違います)。火星の地点は GCAT のものですが、バイキング1号だけは NASA 自身の値 (北緯 22.27 度、西経 47.95 度。バイキング1号着陸機のページによる。GCAT は 22.67) です。バイキング2号とマーズ・パスファインダーは、GCAT と NASA のバイキング・パスファインダーのページが示す位置にあります。NASA GISS の火星着陸機の一覧はこの2つについて 0.6 度と 0.3 度ずれていて、これは NASA 自身のページが互いに食い違い、どの緯度かが必ずしも書かれていないためです。

テストは、12の場所を、表がその位置を取った出典とは別の出典に対して確かめます。NASA のアポロ11号、アポロ17号、バイキング1号のページ、IAU Gazetteer の名前のある着陸地点 (Statio Tranquillitatis、Guang Han Gong、嫦娥4号・5号・6号とチャンドラヤーン3号の Statio)、NASA GISS の火星着陸機の一覧 (キュリオシティ、パーサヴィアランス、スピリット、オポチュニティ、フェニックス、インサイト、祝融号) です。0.011 度 (330 m) 以内で一致しますが、インサイト (0.05 度、3 km)、マーズ・パスファインダー、バイキング2号、ルナ9号は例外で、その許容値はテストに書いてあります。

## 検索

```ts
import { PLACES_MARS } from "@johnmorrisdotca/wakusei-planets/places/mars";
import { findPlace, listPlaces, placesNear, placesOfKind } from "@johnmorrisdotca/wakusei-planets/places";

console.log(placesOfKind(PLACES_MARS, "rover").map((place) => place.name.en).join(", "));
const jezero = findPlace(PLACES_MARS, "Jezero")!;
console.log(jezero.feature?.diameterKm, "km;", placesNear(PLACES_MARS, jezero.lat, jezero.lon, 3).filter((n) => n.place.kind !== "feature").map((n) => n.place.name.en));
console.log((await listPlaces("moon", "crash", "impact")).length, "crash and impact sites on the Moon");
```

`findPlace(list, text)` は、id (`mars/perseverance`)、大文字小文字を区別しない英語名、日本語名のどれでも受け付けます。`placesOfKind(list, ...kinds)` は絞り込み、`placesNear(list, lat, lon, withinDeg)` はある角度以内の場所を近い順に返し、`nearestPlace(list, lat, lon, ...kinds)` は指定した種類のうち最も近いものを返します (アポロの地点のまわりには名前のある地形が多いので、着陸地点がほしいときは訪れた種類を指定してください)。`listPlaces(body, ...kinds)` と `loadPlaces(body)` は、必要なときに表を取り込みます。`placeDistanceKm(body, a, b)` は、その天体の赤道半径の球での地表上の大円距離です (a と b は、場所か `{ lat, lon }`)。

## 天体上の太陽

```ts
import { subSolarPoint, terminator } from "@johnmorrisdotca/wakusei-planets/places";

const day = Date.UTC(2026, 10, 11, 12);
const sun = subSolarPoint("mars", day);
console.log("The Sun is overhead at", sun.lat.toFixed(1), "N,", sun.lon.toFixed(1), "E on Mars");
console.log(terminator("moon", day, 36).length, "points on the Moon's terminator");
```

`subSolarPoint(body, when)` は太陽が真上にある地点で、このパッケージ自身の暦と、その天体の IAU の極と本初子午線から求めます。`terminator(body, when, points)` はそこから90度の大円で、地図や地球儀に線を引くためのものです。`localSolarTime(body, lon, when)` は、その経度での、天体自身の太陽日の時刻です (太陽が真上で12時、東へ15度ごとに1時間遅くなります)。`isDaylight(body, lat, lon, when)` は、なめらかな地平線の上に太陽の中心があるかどうかです。この2つの天体だけでなく、パッケージが極を持つ天体なら使えます。`angleBetween` は2点間の角度です。

## 入力が正しくないとき

`Date` でも数でもない `when` は `TypeError`、無効な値や有限でない値は `RangeError` です。有限の数でない緯度や経度は `RangeError` です。場所を持たない天体 (`loadPlaces("venus")`、`placeDistanceKm("venus", ...)`) は、持っている2つの天体の名前を書いた `RangeError` です。`findPlace` は知らない名前に `undefined` を返し、`nearestPlace` は空の一覧に `undefined` を返します。

## 数値の出どころ

月の地点の位置は、NASA の NSSDCA の「月面の人工物の衝突と探査機の表」(<https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html>、米国政府の著作物) です。日付、運用者、国、着陸地点の名前、火星の地点は、GCAT (General Catalog of Artificial Space Objects。J. McDowell。data from GCAT (J. McDowell, planet4589.org/space/gcat)) のもので、クリエイティブ・コモンズ表示 4.0 ライセンスで公開されています。名前のある地形は、USGS 天文地質学科学センターが管理する IAU 惑星命名辞典 (<https://planetarynames.wr.usgs.gov/>、米国パブリックドメイン) のものです。`scripts/make-places-data.py` が2つの表を出典のファイルから作り、`scripts/make-places-checks.py` がテストの使う第二の出典のファイルを作ります。それぞれをどう読んだかは [NOTICE.md](../../../NOTICE.md) にあります。ページに表示する、カタログの技術的な天体名に代わる名前と、日本語の名前は、ここで書いたものです。
