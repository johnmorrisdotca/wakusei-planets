---
title: 月と火星の周回機
section: how-to
order: 18
description: "月と火星を周回する13機の探査機が、ある時刻にどこにいるか。JPL Horizons に合わせた平均軌道要素から求め、数値と各機の情報を添え、どの経路が追跡ずみで、どれがモデルで、どれが経路なしかを正直に示します。"
---

`/orbiters` が扱うのは、月と火星のまわりで働く探査機です。月はルナー・リコネサンス・オービター、チャンドラヤーン2号、ダヌリ、ARTEMIS P1とP2、キャップストーン。火星はマーズ・リコネサンス・オービター、2001マーズ・オデッセイ、メイブン、マーズ・エクスプレス、エクソマーズ・トレース・ガス・オービター、ホープ、天問1号です。それぞれについて、ある時刻の位置、数値、分かっていることを返します。深宇宙の探査機 (ボイジャー、ニュー・ホライズンズ、ウェッブなど) は[有名な探査機](spacecraft.md)に、地球の人工衛星は chikyu-earth にあります。

```ts
import { ORBITER_IDS, orbiterFacts, orbiterNumbers, orbiterPosition, orbiterStatus } from "@johnmorrisdotca/wakusei-planets/orbiters";

const now = Date.UTC(2026, 10, 11, 12);
for (const id of ORBITER_IDS) {
  const facts = orbiterFacts(id);
  const numbers = orbiterNumbers(id, now);
  console.log(facts.name.ja, facts.centre, orbiterStatus(id, now), numbers ? `高度 ${numbers.altitudeKm.toFixed(0)} km、速度 ${numbers.speedKmS.toFixed(2)} km/s` : "経路なし");
}
const [x, y, z] = orbiterPosition("lro", now);
console.log("LROは月の中心から", Math.hypot(x, y, z).toFixed(0), "km");
```

## 経路はどこから来るか

経路は、天体をまわるケプラーの楕円で、天体自身の赤道を基準にした座標 (IAU の北極の向き) で表します。昇交点と近点は、経路に合わせて求めた速さで動きます。1機あたり9つの数で表し、`scripts/make-orbiter-data.py` が JPL Horizons の経路データに合わせて求めます。読み取った日の直前の数日分 (低い軌道は7日、マーズ・エクスプレスとホープは10日、ARTEMIS は14日) に合わせます。スクリプトは Mac から手で実行します。実行は月に1回ほど、または軌道変更のあとだけで、タイマーでは動かしません。ページがサーバーを呼ぶことはありません。天体の赤道を基準にすると、低い軌道の傾きは変わらず、昇交点は北極のまわりを一定の速さで回ります。黄道を基準にすると、どちらも大きく揺れ (TGO の傾きは1か月に数十度)、楕円では追えません。そのため、軌道要素の傾きは、各機関が示すのと同じ、天体の赤道に対する傾きです。位置は、天体の中心から測った km 単位の座標で、軸は J2000 の黄道と春分点です。`/roadster` と同じ軸で、`/space` の `eclipticToScene` で宇宙ビューの軸に変えられます。

時刻について。`Date` は UTC で、Horizons のベクトルと合わせた元期 (`epochJd`) は TDB です。このパッケージは、元期を使う前に 69.184 秒を足します (TAI − UTC の37秒と、TT − TAI の32.184秒。TDB と TT の差は2ミリ秒未満です)。足さないと、どの機も本来の位置から約69秒分の動きだけ遅れます。LRO で110 km、MRO で235 km です。

`orbiterElements(id)` は軌道要素を返します。合わせた期間 (`validFrom` から `fitUntil`)、そのあとに楕円をのばして使う日数の終わり (`validUntil`)、Horizons を読んだ日 (`retrieved`。要素の古さです)、Horizons の追跡データがどこまであるか (`trackedUntil`) もいっしょです。Horizons に対する誤差は2つあり、合わせた期間の中 (`fitErrorKm`) と、その後の日数 (`predictedErrorKm`) です。どちらも中央値と最大で、スクリプトが km 単位で測ります。

| 機 | tracked: 中央値、最大 | predicted: 中央値、最大 |
|---|---|---|
| LRO | 11、26 | 92、206 |
| チャンドラヤーン2号 | 12、38 | 112、244 |
| ダヌリ | 7、35 | 74、225 |
| MRO | 10、27 | 11、32 |
| オデッセイ | 9、15 | 19、49 |
| マーズ・エクスプレス | 7、19 | 8、28 |
| TGO | 8、16 | 9、28 |
| ホープ | 4、12 | 14、28 |

平均の楕円では ARTEMIS P1、P2 (10,000 km の軌道で約3,000 km。地球に引かれて揺れます) を追えないので、これらは `modelled` (モデル) と示します。数値は2026-11-12に読んだファイルのものです。スクリプトが書き直します。

## tracked、predicted、modelled、none

`orbiterStatus(id, when)` は、その時刻の位置がどのくらい信頼できるかを返し、ページでは探査機の横に表示します。

| 状態 | 意味 |
|---|---|
| `tracked` | 楕円を合わせた期間の中 (`fitUntil` まで)。ここでの Horizons に対する誤差が `fitErrorKm` です |
| `predicted` | その期間のあと、期間と同じ日数だけ。同じ楕円をそのままのばしたもので、ここでの誤差も同じやり方で Horizons と比べて測り、`predictedErrorKm` に入れます (大きくなります。低い軌道では2〜5倍です) |
| `modelled` | 平均の軌道だけ。当てはまるのは、どちらの期間にも入らない時刻、楕円の誤差が上限を超える機、追跡が終わった機です (メイブンは2025年12月に交信が途絶え、2026年に NASA がミッションを終えたので、最後の軌道のまま示します) |
| `none` | 経路なし。キャップストーンの近直線ハロー軌道は楕円ではなく、ミッションも完了しています。天問1号の公開された記録は、ボランティアによる巡航の追跡だけで、到着で終わります |

`tracked` は、合わせた期間の中で楕円が Horizons の経路に沿うという意味です。その経路は機関が測った値ですが、読んだ日の直前の数日は機関の予測です (Horizons の追跡データがどこで終わったかは `trackedUntil` が示します)。推測を実測のように見せることはありません。`modelled` の機は暗く描きます。`predicted` の機も、合わせた期間のあとの最大誤差 (`predictedErrorKm.max`) がその天体の平均半径の2% (月で約35 km、火星で約68 km) より大きければ暗く描きます (`orbiterDim(id, when)`、`ORBITER_DIM_SHARE`)。どちらも、その状態であることを示し、状態に合った誤差を添えます (`orbiterNumbers(id, when).errorKm` は、その状態での最大誤差で、`modelled` のときは `null` です)。`none` の機は情報だけを持ち、印は描きません。

## 数値と情報

`orbiterNumbers(id, when)` は、天体の平均表面からの高さ、速さ、周期、天体の赤道に対する軌道の傾きを返します。`orbiterPath(id, when, points)` は、線を描くための、1周分の軌道上の点を返します。`orbiterSpeed` は速さだけを返します。`orbiterFacts(id)` (と `ORBITER_FACTS`) は、英語と日本語の名前、ボタンやラベル用の短い名前 (`LRO`、`TGO`)、運用者、打ち上げ (日付、ロケット、射場)、記載どおりの観測機器、その機についての一行 (私たちの言葉で)、ミッションの状態 (`flying` か `ended`、注記つき) を持ちます。すべて、その機の JPL Horizons のオブジェクトページを、`NOTICE.md` に記した日付に読んで書き写したものです。ページにない事実は書きません。

## 真下の地点と、ある場所の上を次に通る時刻

```ts
import { orbiterElements, orbiterGround, orbiterGroundTrack, orbiterNextPass } from "@johnmorrisdotca/wakusei-planets/orbiters";

const now = Date.UTC(2026, 10, 12);
const below = orbiterGround("mro", now)!;
console.log("MROの真下は", below.lat.toFixed(1), below.lon.toFixed(1));
const trip = orbiterElements("mro")!.periodDays * 86_400_000;
console.log("1周分の真下の道すじ:", orbiterGroundTrack("mro", now, now + trip, 120).length, "点");
// パーシビアランスが着陸したジェゼロ・クレーター (/places の場所をそのまま使えます)
const pass = orbiterNextPass("mro", { lat: 18.4446, lon: 77.4508 }, now)!;
console.log("ジェゼロの上を次に通るのは", new Date(pass.highest).toISOString(), "高さ", pass.elevationDeg.toFixed(0), "度、", pass.status);
```

`orbiterGround(id, when)` は、探査機の真下の地点 (天体の中心から測った緯度と、東経) を、天体の IAU の北極と本初子午線から求めます。月の小さな揺れ (1〜2度) は入れていません。`orbiterGroundTrack(id, from, to, points)` は、その地点をつないだ線です。軌道の下で天体が回るので、1周ごとに赤道を横切る場所が西へずれます (MRO では1周に約27度)。`orbiterNextPass(id, place, when, { minElevationDeg, withinDays })` は、天体の平均の球面上のある場所から見て、`when` から後で探査機が `minElevationDeg` (初期値10度) より高く上る最初の時刻を探し、上る時刻、いちばん高い時刻とその高さ、沈む時刻を返します。探すのは `withinDays` 日先まで (初期値30日。ゆっくり回る月では、極軌道の探査機が同じ場所の上に戻るのは約2週間ごとです)。`when` の時点ですでに空にいれば、その通過を返します。低い軌道の探査機が空にいるのは2〜3分、遠くをまわるホープは何時間もです。データの期間よりずっと先の通過は `modelled` の経路から求めたもので、`status` がそう示します。

## 更新

```sh
pnpm orbiters:refresh
```

これは `python3 -I scripts/make-orbiter-data.py --brief --cache ~/.cache/wakusei-planets/horizons-orbiters` を実行し、最後に1機につき1行を表示します。各行には、その機の状態、合わせた期間とそのあとの最大誤差、それぞれがいつまでかが出ます (`--brief` なしでは途中経過も表示します)。合わせた結果が使えるのは、読み取った日から1〜2週間です。そのため、メンテナーが Mac から月に1回ほど実行し、パッチ版をリリースします。ワークフローでは動かさず、ページがそのためにサーバーを呼ぶこともありません。1機につき要求は4回です (オブジェクトのページ、合わせた期間、そのあとの日数、UTC の暦の日時で尋ねるテスト用の4点)。1回に1つずつ、2秒おきに、一般的な User-Agent で送ります。キャッシュはリポジトリの外に置くので、2回目の実行は何も要求しません。スクリプトは合わせた結果ごとの誤差を表示し、Horizons が追跡しなくなった機を知らせ、`src/data/orbiters.ts` と、`test/data/orbiters-horizons.json` にあるテスト用の点を書き直します。`pnpm test` がすべての機をそれらと照らし合わせます。

## 宇宙ビューで

`<wakusei-space orbiters>` (または `space.orbiters = true`) は、経路のある各機を、表示している日付に表が示す位置に小さな点として描きます。どちらの縮尺でも天体に合わせた大きさで、軌道の線の上に置き、横にページの言語で名前を出します。描くのは、月か火星が画面で半径24 CSSピクセル以上になってからです (それより遠いと、点がすべて天体の点に重なります)。`orbiterDim` で暗くなる経路 (`modelled`、または誤差の大きい `predicted`) は暗く描き、`none` の機は描きません。初期値はオフで、このモジュールは初めて表示するときに読み込みます。`stats.orbiters` が、描いたもの (描いた機の数、各機の状態、暗く描いた機、軌道の線の数、真下の道すじの点の数) を返します。

- `orbiter="mro"` (または `space.orbiter`) で1機を選ぶと、その機の線を明るく描きます。
- `orbiter-lines="all|chosen|none"` (または `space.orbiterLines`) で、すべての機の軌道の線 (初期値)、選んだ機の線だけ、線なし、を選べます。惑星と衛星の線 (`orbits`) とは別です。
- `orbiter-track` (または `space.orbiterTrack = true`) で、選んだ機の真下の道すじを天体の上に描きます。表示している時刻の1周前から1周後までです。
- 1機に乗って見るには `space.ride(orbiterRidePoint("lro"), { around: "moon" })` と書きます。カメラは機の位置から月を見ます ([乗って見る](ride-along.md))。

デモの「周回機」ボタンを押すと、天体ごとの探査機の列 (短い名前、`orbiterFacts(id).short`)、線と道すじの切りかえ、選んだ機に乗って見るボタン、選んだ機のカードが出ます。カードには、その機の情報、数値、経路のもとになったデータといつまで使えるか、アポロ11号かパーシビアランスの着陸地点の上を次に通る時刻が出ます。どれもアドレスに残ります。

`space.paint = { id: "lro", length: "1d", swath: "track" }` は、その機の地上軌跡を、周回している天体の表面に塗ります。`length` は時計の時間で `1d` (初期値)、`1w`、`1m` です。`swath` は `track` (機の真下の点) か `coverage` (機が地平線から10度以上の高さに見える地面) です。`space.clearPaint()` で消え、別の機を選ぶと前の軌跡は消えます。`length` より古い部分は薄れて落ちます。フレームのあいだの軌道も埋めるので、速い時計でも線は切れず、時計を戻すと軌跡も戻ります。時刻が進んでいるあいだは、描くフレームごとに絵を1回送り、止まっているときと塗っていないときは送りません。塗りを消すと、グラフィックスカード上の絵と球も解放します。軌道に沿った線になるよう、標本は機の1周の3分の1より離さずに取るので、速い時計でも線は軌道をたどります。日付変更線の分割と、見える範囲の半径は `@johnmorrisdotca/wakusei-planets/ground-track` にあり、DOM も three.js も使いません。
