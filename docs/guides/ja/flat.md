---
title: 月と火星の平面地図
section: how-to
order: 35
description: 月または火星を平面の地図で表します。好きな時刻の昼と夜、着陸地点・探査車の地点・墜落地点の印、その上を動く周回機とその可視範囲・地上軌跡を描きます。WebGL を使わない canvas で、属性とイベントは chikyu-earth の平面地図と同じです。
---

`<wakusei-flat>` は、3D でも見られる天体の平面地図です。月または火星を、3D の表示と同じ表面の地図から描き、渡した時刻の太陽の向きに合わせて夜の側に陰をつけます。周回機は、時間が進むにつれて地図の上を動く点で、着陸地点・探査車の地点・墜落地点は地図の上の印です。どちらも押すとイベントが送られます。2枚の 2D canvas でできていて、WebGL も three.js も使いません。パッケージ以外に、追加で入れるものはありません。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Moon and Mars on flat maps, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/flat/define/+esm"></script>
  </head>
  <body>
    <wakusei-flat body="moon" track></wakusei-flat>
    <wakusei-flat body="mars" time="2026-11-17T12:00:00Z" speed="0" footprint></wakusei-flat>
  </body>
</html>
```

1つめの地図は、リアルタイムの月で、周回機それぞれの下に地上軌跡を描きます。2つめは、ある時刻で止めた火星で、周回機ごとの可視範囲を円で描きます。バンドルするアプリでは `import "@johnmorrisdotca/wakusei-planets/flat/define"` でタグを登録します。`@johnmorrisdotca/wakusei-planets/flat` は DOM を使わない、計算だけの入口です。

## 何が表示されるか

- **地図。** 天体の表面の地図を、平面 (正距円筒図法: 横が経度、縦が緯度で、天体の全体を表し、左右はつながっています) で表示します。3D 表示と同じ地図で、パッケージの1024ピクセルの絵を使い、拡大して必要になったときは2048ピクセルの絵を使います。自分の絵を置くときは `texture-base` (と `texture-far-base`) で場所を指定します。指定しなければ、このバージョンの jsDelivr のフォルダから取得します。絵が取得できないときは、地面の色と印と点だけを描き、そのことを表示します。
- **昼と夜。** 地図の各点について、その天体自身の極と自転から太陽の高さを求めます (`subSolarPoint` と同じ計算なので、黄色い太陽の印は、太陽が真上にある場所です)。月には空気がないので、昼と夜の境目は鋭く (地平線の下1度で完全な夜)、火星は塵で日没のあともしばらく空が明るいので、夕暮れは8度の幅のグラデーションです。`shade="off"` で夜の陰をなくします。
- **周回機。** 軌道データのある探査機ごとに、真下の地表の位置に点を描きます。塗りつぶした点ではなく輪のときは、位置がおおよそであることを表します (下を見てください)。`footprint` では、水平線から10度以上の高さに見える範囲を円で、`track` では1周分の地上軌跡を、後ろを破線、前を実線で描きます。軌跡は地図の左右の端 (経度180度) や極で切るので、地図を横切る線は出ません。
- **地点。** [地点のデータ](places.md) の着陸地点・探査車の地点・墜落地点・着陸予定地点を印にします。有人着陸は金色のひし形、着陸機は白、探査車は緑、墜落と衝突は×、着陸予定は破線の輪です。地形の名前 (海・クレーター・山脈。月に768、火星に914) は、指定したときだけ表示し、名前を書く余地があるところにだけ印をつけます。

## あるものと、ないもの

月のまわりでは、**LRO、チャンドラヤーン2号、ダヌリ、ARTEMIS P1、ARTEMIS P2** を描きます。**CAPSTONE** はパッケージにありますが、描ける楕円がなく (ハロー軌道は楕円ではなく、運用も2026年7月に終わりました)、描きません。火星のまわりでは、**MRO、マーズ・オデッセイ、MAVEN、マーズ・エクスプレス、ExoMars TGO、ホープ** を描きます。**天問1号** は公開された軌道データがないので、これも描きません。`orbiters` プロパティには描けるものだけが並びます。それ以外は、ページ側がパッケージのデータから名前を出せます (デモは、周回機の行の下に出しています)。

パッケージにないので地図にもないもの: そのほかの周回機 (たとえば、嫦娥計画の中継衛星「鵲橋2号」などの中国の月周回機)、運用を終えたかぐやなどの月周回機、引退した火星の周回機 (マーズ・グローバル・サーベイヤー、マンガルヤーンなど)、データを取得した2026年11月12日より後に打ち上げられた探査機です。軌道データは、JPL Horizons に合わせた平均軌道要素です。機ごとに、軌道を合わせた期間と、Horizons との誤差の実測値がついています。位置のずれが天体の半径の2%を超えるおそれのある探査機は、塗りつぶした点ではなく輪で描き、カードに「位置はおおよそ」と出します。2026年11月17日には、月の5機すべてと、火星の TGO と MAVEN がこれにあたります (月の5機は、合わせた1週間の期間が過ぎ、そのあとに測った最大の誤差が200〜240 km で、月の上限の35 km を超えています)。MAVEN の運用は2025年12月に終わったので、描かれるのは最後にいた平均軌道だけです。数字は [周回機のガイド](orbiters.md) にあります。

地点はパッケージ自身のデータです。月は着陸22、有人着陸6、探査車13、墜落・衝突49、着陸予定8、火星は着陸12、探査車7、墜落6、着陸予定1で、名前は英語と日本語がそろっています。水星や金星など、ほかの天体にはまだ対応していません。`body` は `moon` か `mars` です。平面の太陽系図は、また別の作業です。

## 属性

| 属性 | はたらき |
|---|---|
| `body` | `moon` (既定) または `mars` |
| `center` | 真ん中の経度 (度)。既定は0。地図は天体を一周してつながります |
| `home-lon`, `home-lat` | 見る人の場所。ここでは選んだ地点です。2つそろったときだけ、印と「自分の場所」ボタンが出ます |
| `time` | `now`、ISO の日時、または1970年からのミリ秒。なければリアルタイム |
| `speed` | 1で実際の速さ、0で停止、86400で1秒に1日、負の数で逆戻り |
| `paused` | 速さを保ったまま時計を止めます。止まっている間は何も描きません |
| `footprint`, `track` | 可視範囲の円と地上軌跡。周回機を選んでいればその1機、選んでいなければすべて |
| `footprint-elevation` | 円を描くときの水平線からの高さ (度)。既定は10 |
| `selected` | 選ぶ周回機の id (`lro`) か、地点の id (`moon/apollo-11-lunar-module`) |
| `orbiters` | `all` (既定)、`off`、またはカンマで区切った id |
| `places` | 印をつける地点の種類。`landing` (有人着陸・着陸・探査車。既定)、`crash`、`planned`、`feature`、いくつかの組み合わせ、`all`、`off` |
| `names` | `off` で印のそばの名前をなくします。数を書くと、その数までの名前を出します |
| `shade`, `dot-size`, `controls`, `lang` | 夜 (`off`)、点の大きさ、表示するボタン (`none`、または `centre zoom footprint track chips`)、`en` か `ja` (既定はページの言語) |
| `texture-base`, `texture-far-base` | 天体の絵がある場所 |

要素には、`center`、`zoom`、`time`、`speed`、`paused`、`selected`、`language`、`orbiters`、`places`、`layers` のプロパティと、`stats` プロパティ (描いた回数、地図を描いた回数、描いた周回機と印の数、1回の描画にかかる時間、canvas の大きさ)、`placeOf(id)` (周回機や印が画面のどこにあるか)、`pick(id)` もあります。

## 地球の平面地図と同じ

[chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth) には、地球のまわりの衛星を平面地図に表す `<chikyu-flat>` があります。この要素は、同じ意味の同じ属性名 (`center`、`home-lon`、`home-lat`、`time`、`speed`、`paused`、`footprint`、`track`、`selected`、`shade`、`dot-size`、`controls`、`lang`)、chikyu の `chikyu-` を `wakusei-` に替えた同じイベント (`wakusei-flat-pick`、`wakusei-flat-view`、`wakusei-flat-filter`、宇宙ビューと同じ `wakusei-timechange`)、同じボタン・チップ・点・輪・ヒントの見た目、同じ正距円筒図法の計算 (`projectFlat`、`unprojectFlat`、`zoomAbout`、`clampView`) を持ちます。地球・月・火星を1つの切り替えで選ばせるページは、いま表示している側の要素に同じ属性を設定し、同じイベントを受け取れば済みます。

```ts no-run
const maps = { earth: document.querySelector("chikyu-flat")!, moon: document.querySelector("wakusei-flat")! };
const pick = (event: Event) => console.log((event as CustomEvent<{ id: unknown; name: string | null; via: string }>).detail);
for (const map of Object.values(maps)) {
  map.addEventListener("chikyu-flat-pick", pick);
  map.addEventListener("wakusei-flat-pick", pick);
}
```

違うのは、選べるものです。衛星の `id` は、地球側では衛星のカタログ番号、こちらでは周回機や地点の名前で、`detail.kind` (`orbiter` か `place`) でどちらかが分かります。

## イベント

- `wakusei-flat-pick`: ポインターの下にある、タップした、またはキーボードで移った周回機や地点。`detail` は `{ kind, id, name, body, lat, lon, altitudeKm, status, placeKind, via }` で、`via` は `hover`、`tap`、`key` です。何もない場所をタップすると `id: null` が送られ、選択が解けます。ポインターの下にあるものの名前は要素自身が出します (ヒントと輪)。タップで何をするかはページが決めます。
- `wakusei-flat-filter`: チップで表示するものが変わったとき: `{ orbiters, layers }`。
- `wakusei-flat-view`: 見る人が地図を動かしたり拡大したりしたとき: `{ center, zoom }`。
- `wakusei-timechange`: `{ time, running, paused }`。時間が進んでいる間、1秒に4回まで。

## 時間

この地図は [宇宙ビュー](space-view.md) と同じ時計を使います。前回の描画から実際に経った時間の分だけ、設定した速さで進めます。1コマごとに決まった量を進めることはしないので、1秒に1日の速さは、どんなマシンでも1秒に1日です。周回機は、描くたびにその時刻の正確な位置を求めるので、どの速さでも、点が軌道の後ろにずれたり外れたりしません。速い時計では、点が1コマの間に大きく跳ぶので、点の後ろに短い尾を描きます。時計が進んでいるときは、周回機が半ピクセル動くたびに描き (最大で1コマごと、最低でも1秒に1回)、止めた時計、一時停止、画面の外、隠れたタブでは何も描かず、タイマーも動きません。

## タッチ、キーボード、言葉

ドラッグで動かし、2本の指でピンチすると拡大・縮小します。プラスとマイナスのボタン (`+` と `-` のキーも) で拡大・縮小し、Control か Command を押しながらホイールでも拡大・縮小できます。ホイールだけではページがスクロールします。キーボードでは、地図全体が1つの部品として扱われます。Tab で入り、矢印キー、Page Up、Page Down、Home、End で左から右へ周回機や印を順に移り、Enter で選び、Escape で抜けます。移るたびに、スクリーンリーダー向けのライブリージョンで読み上げます (「ルナー・リコネサンス・オービター、月の周回機、高度 113 km」)。表示する言葉は英語と日本語 (`lang`) で、天体・周回機・地点の名前は、パッケージ自身の表から、指定した言語で出します。

## ブラウザなしで

```js
import { flatOrbiter, flatSun, hasPath } from "@johnmorrisdotca/wakusei-planets/flat";

// The flat map needs no browser: where the Sun is overhead on the Moon at the Apollo 11 landing, and where two orbiters are over the ground now.
const landing = flatSun("moon", Date.UTC(1969, 6, 20, 20, 17, 40));
const time = Date.UTC(2026, 10, 12);
const lro = flatOrbiter("lro", time);
const mro = flatOrbiter("mro", time);

console.log(`Apollo 11: the Sun is overhead at ${landing.lon.toFixed(0)} degrees east, ${Math.abs(landing.lat).toFixed(0)} degrees from the equator`);
console.log(`LRO is ${lro.altitudeKm.toFixed(0)} km up, MRO ${mro.altitudeKm.toFixed(0)} km`);
console.log(`Tianwen-1 has a path to draw: ${hasPath("tianwen-1")}`);
```

出力は次のとおりです。

```text
Apollo 11: the Sun is overhead at 103 degrees east, 0 degrees from the equator
LRO is 113 km up, MRO 244 km
Tianwen-1 has a path to draw: false
```

この入口には、ほかに `flatBody` (天体の半径と周回機)、`shadeNight` (ピクセルの格子に夜の陰をつける)、`circleOutline` (可視範囲の円を平面地図の線にする)、`flatTrack` と `trackPieces` (地上軌跡を平面地図用に切る)、言葉 (`FLAT_WORDS`、`say`、`coordinateText`) があります。
