---
title: すべての天体のすべての場所を検索する
section: how-to
order: 21
description: "52の天体それぞれの一覧を、必要なときだけ取り寄せます。IAU 惑星地名辞典のすべての名前 (50の対象で16,108件。月の文字つきクレーター7,064件を含む)、すべての着陸・探査車・墜落・衝突地点、そして地表に残された機器。検索は英語と日本語で、IDは変わらず、各行に出典がつきます。"
---

`/places/search` は、ページの読者が場所を探して取っておけるようにするためのものです。月のクレーター、火星の尾根、探査車のパラシュート、リュウグウにあるはやぶさ2のターゲットマーカーなどです。52の天体それぞれの一覧があります。`/places/<body>` はこれまでどおりで、月・火星とほかの31の天体の大きな場所について、名前の由来までそろえた完全な記録です。検索用の一覧は漏れのないもので、1行はごく小さくしてあります。月の IAU 地名辞典の名前9,087件と地点110件は、2つの一覧に分けて、gzip で41 kB と98 kB です。

```ts
import { hitToPlace, loadPlaceSearch, placeHitUrl, resolvePlaceId, searchPlaces } from "@johnmorrisdotca/wakusei-planets/places/search";

const moon = await loadPlaceSearch("moon", { satellites: true });
for (const hit of searchPlaces(moon, "tycho", { limit: 3 })) console.log(hit.id, hit.typeWord.ja, hit.diameterKm, "km", hit.lat, hit.lon);
console.log(searchPlaces(moon, "静かの海")[0]?.name.en, "を日本語で探しました");
const mars = await loadPlaceSearch("mars");
const olympus = searchPlaces(mars, "オリンポス山")[0]!;
console.log(olympus.id, placeHitUrl(olympus), hitToPlace(olympus).feature?.typeWord.ja);
console.log(resolvePlaceId("mercury/kunisada-2"), "は、mercury/kunisada-2 で保存されたお気に入りの、今のIDです");
```

## 一覧

`loadPlaceSearch(body)` は一覧を1つ取り寄せます。初めてのときは専用のチャンクとして取り寄せるので、その天体を検索しないページには含まれません。返すのは行の並びで、先に地点が日付順、そのあとに名前のある地形が IAU 地名辞典の ID の順に並びます。順位をつけるのは `searchPlaces` です。月の文字つきクレーター (IAU 地名辞典で「Satellite Feature」と呼ばれる、ティコ A のように近くの名前つきクレーターにちなんで文字を付けたクレーター) は7,064行で、独立した一覧です。`loadPlaceSearch("moon", { satellites: true })` で加わります。どの一覧も `/places/search/<body>` (文字つきクレーターは `/places/search/moon-satellites`) という入口として単独でも使えるので、1つだけ直接 import するページに向いています。

| 天体 | 名前のある地形 | 地点 | 着陸予定 | 機器・部品 | gzip の kB |
|---|---|---|---|---|---|
| `moon` | 2,023 | 92 | 8 | 10 | 41 |
| `moon-satellites` | 7,064 |  |  |  | 98 |
| `mars` | 2,054 | 25 | 1 | 66 | 38 |
| `venus` | 1,985 | 18 |  |  | 30 |
| `mercury` | 613 | 1 |  |  | 13 |
| `titan` | 304 | 1 |  |  | 7 |
| `io` | 261 |  |  |  | 7 |
| `ganymede` | 196 |  |  |  | 6 |
| `ceres` | 149 |  |  |  | 5 |

ほかは1つあたり3〜4 kB で、いちばん小さいものは3 kB 未満です。名前のある地形は `callisto` 154、`rhea` 144、`europa` 129、`vesta` 106、`dione` 95、`enceladus` 87、`pluto` 73、`iapetus` 70、`triton` 63、`tethys` 53、`mimas` 42、`ariel` 26、`miranda` 18、`titania` 18、`charon` 15、`umbriel` 13、`oberon` 10 です。`eros` は地形41と地点1、`bennu` は地形36と地点1、`dimorphos` は地形11と地点1、`ryugu` は地形13と地点4と機器・部品2です。`jupiter` (地点2)、`saturn`、`tempel-1`、`67p` (それぞれ地点1) は、IAU 地名辞典に名前がないので地点だけです。さらに19の小さな天体があります。`lutetia` 37、`gaspra` 34、`ida` 25、`phoebe` 25、`steins` 24、`mathilde` 23、`phobos` 20、`itokawa` 17、`donaldjohanson` 10、`hyperion` 5、`dinkinesh` 4、`amalthea` 4、`janus` 4、`dactyl` 2、`deimos` 2、`didymos` 2、`epimetheus` 2、`proteus` 1、`thebe` 1 です。

どの一覧にも、デコーダーと種類の言葉が約2 kB ずつ入っています。バンドラーは、これを一覧どうしで共有します。一覧の最後にある19の小さな天体は新しく加わったものです。IAU 地名辞典はそれらの地形に名前を付けていますが、`/places/<body>` にはその完全な記録がないので、検索用の一覧がすべてです。パックとニクスの一覧はありません。IAU 地名辞典にあるどの名前も、位置が分からないからです (下の「名前はあるが位置がないもの」を見てください)。

1行 (`PlaceHit`) には次のものがあります。

- `id`: `<body>/<slug>`。`/places/<body>` が同じ場所に使っているIDです。お気に入りにはこれを保存します。
- `name`: 英語と日本語の名前。地形の日本語名は、パッケージ自身が持っているもの (月の126件と火星の38件。読者が知っているティコやオリンポス山など) で、ほかの地形は `/places` と同じく IAU の名前のままです。
- `kind` (`crewed`、`landing`、`rover`、`crash`、`impact`、`entry`、`planned`、`feature`、または新しい `hardware`)、`typeWord` (英語と日本語のやさしい言葉。地形なら種類で、`crater`、`plain`、`satellite crater`。地点なら種類で、`rover`、`crash site`)、地形には `type` (IAU 地名辞典自身の呼び名。`Crater, craters`)。
- `lat` と `lon`: 惑星中心緯度と、-180 から 180 の東経。地形は1000分の1度まで、地点は完全な一覧と同じです。
- `diameterKm`: 地形の大きさ。IAU 地名辞典に大きさがなければ 0。地点には、完全な記録と同じく `date` と `approximate` があります。
- `source`: 行の出典と、そのファイルを読んだ日。地形の `ref` は IAU 地名辞典の地形IDで、`placeHitUrl(hit)` はその IAU 地名辞典のページです (名前の由来と承認日はそこにあります)。地点の出典は `PLACES_CREDITS` のどれかです。

`searchPlaces(hits, text)` は、英語名と日本語名を、大文字小文字とアクセント記号を無視して照合します。名前全体が一致するものが先で、次に入力で始まる名前、次に入力で始まる単語を含む名前、最後に入力を含む名前の順です。訪れた地点は地形より先に、大きい地形は小さい地形より先に並びます。複数の天体の一覧をまとめて渡すと、すべてを検索できます。`hitToPlace(hit)` は、行を `Place` にして返します。`Place` を受け取るパッケージのほかの部分 (`placeMarks`、`goToPlace` に渡す独自の一覧) で使います。検索用の一覧には由来と承認日がないので、`origin` はなく `approved` は空です。

## 変わらないID

今日保存したお気に入りは、更新のあとでも見つかる必要があります。0.66.0 のすべてのID (4,654件) が一覧にあり、テストがそのすべてを確かめています。新しいIDは `<body>/<IAU 地名辞典の clean name のスラッグ>` です。それがほかの場所に使われているときは `<body>/<スラッグ>-<IAU 地名辞典の地形ID>` で、連番は使いません。連番は行の順に左右されるので、それに頼るIDは動いてしまうことがあるからです。

0.66.0 のIDのうち10件には連番がついていました (`mercury/kunisada-2`、`dione/haemon-2` と、ほかに8件)。IAU 地名辞典のシェープファイルは、境界をまたぐ地形を、1つの地形IDのまま2つの部分に分けて持っていて、パッケージはその部分ごとに載せていました。検索用の一覧ではその地形は1行で、`resolvePlaceId` が古いIDを今生きているIDに直します。IAU が地形の名前を変えたとき (アロコスの `Akasa Linea` は2025年12月に `Akasa Collum` になりました) も、ここでIDを付け替えます。IDを保存するページは、読み戻したIDのそれぞれに `resolvePlaceId` を呼んでください。

本当に別々の2つの場所 (着陸機の `mars/schiaparelli` とクレーターの `mars/schiaparelli-2`、`moon/falcon` と `moon/falcon-2`) は、IDが2つのまま残ります。

## 機器・部品 (hardware)

`hardware` は新しい `PlaceKind` で、地表に残された機器と、地表に落ちた部品です。検索用の一覧にだけあります (`/places/<body>` にはありません。場所の印をつけるページには届きません)。78行で、すべて GCAT (J. McDowell の着陸機カタログ。planet4589.org/space/gcat、CC BY 4.0、2026-11-18 更新) からで、位置は GCAT のもの (GCAT が1度以下で示しているものは `approximate`)、日付もつきます。

- **月 (10件):** アポロ11号の受動地震計とレーザー反射器 (EASEP)、アポロ12・14・15・16・17号の実験装置群 (ALSEP)、アポロ14号の機材運搬用手押し車 (MET)、イーグルカム (オデュッセウスから放出)、嫦娥6号の分離カメラ (Yidong Xiangji)。
- **火星 (66件):** 天問1号の分離カメラ (Fenli) と、マルス2・3・6号、バイキング1・2号、マーズ・パスファインダー、マーズ・ポーラー・ランダー、ビーグル2、スピリット、オポチュニティ、フェニックス、キュリオシティ、スキアパレッリ、インサイト、パーシビアランス、天問1号の降下で地表に落ちた部品です。ヒートシールド、バックシェル、パラシュート、巡航ステージ、エアロシェルとそのカバー、バランスウェイト、ソ連の着陸機の推進装置、パーシビアランスのベリーパンとヘリコプターのカバーがあります。
- **リュウグウ (2件):** はやぶさ2のターゲットマーカー A と B。

載せていないもの: GCAT に位置がない部品、宇宙服と生命維持装置、GCAT がほかの記録に付属させている部品。HAKUTO-R ミッション1に載って降り、その衝突で壊れた2台の探査車、ラシードと SORA-Q は、`/places/moon` に `rover` として入りました (月の探査車は13台から15台になりました)。

## 名前はあるが位置がないもの

IAU 地名辞典には、どのファイルにも位置がない承認済みの名前が16件あります。これらは一覧にありません。

- シェープファイルで中心が北緯0度・東経0度で、境界もないもの: Gleti と Metztli (ニクス)、Bogle、Butz、Lob (パック)、Fab Dorsum (ディンキネシュ)、Afar Lobus と Olduvai Lobus (ドナルドジョハンソン)。
- アロコスと Selam (ディンキネシュの衛星) にはシェープファイルがありません (IAU 地名辞典のそれぞれのページに名前が並び、どれも中心は 0.00、0.00 です): アロコスの Akasa Collum、Ka'an Arcus、Sky、Weeyo Lobus、Wenu Lobus と、Selam の Lẹwa Lobus、Piękna Lobus、Uwoduhi Dorsum。

どの出典にも位置がない地点も、同じように載せていません。ベネラ3号、マーズ・クライメイト・オービター、NASA の表で「不明」とされている月の14機、パイオニア・ヴィーナス・オービター、マゼラン、ビーナス・エクスプレスの落下、フォボス計画の失敗です。出典に位置がないとき、このページは推測しません。

## 数字の出どころ

- **地形:** IAU 惑星地名辞典 (USGS Astrogeology、パブリックドメイン)。50の対象の中心点シェープファイルを2026-11-18 に読みました (16,128行。位置のない行と2つ目の部分を除いて16,108件)。それぞれに IAU 地名辞典の地形IDがあります。ファイル自身の言葉では「東経、惑星中心緯度」です。ベスタの経度は、`/places/vesta` と同じく、IAU 地名辞典がこの小惑星につけた独自の座標系のものです。天体ごとの一覧は漏れがありません。`/places/<body>` の絞り込み (月の80 km 未満のクレーター、金星の各種類25件) はここにはありません。
- **地点:** `/places/<body>` の完全な一覧で、ラシードと SORA-Q を除いて変わりません。着陸予定の9件はページを2026-11-18 に読み直しました。日付も場所も2026-11-11 のとおりでした。
- **種類のやさしい言葉**はパッケージの表のものです。それまでの一覧に要らなかった4種類は、`Satellite Feature` (satellite crater、付随クレーター)、`Saxum` (boulder、岩塊)、`Lobus` (lobe、ローブ)、`Collum` (neck、くびれ) です。
- **作った scripts:** `scripts/make-places-search-data.py` (機器・部品は `make-places-added-data.py`)。IAU 地名辞典のファイルと GCAT のカタログから作ります。スクリプト自身は何も取り寄せません。

## 入力がまちがっているとき

`loadPlaceSearch` は、知らない天体を `RangeError` で拒否します。`searchPlaces` は、入力が空のときと、一致するものがないときに `[]` を返します。`resolvePlaceId` は、知らないIDをそのまま返します。
