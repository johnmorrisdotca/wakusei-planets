---
title: どの惑星・衛星も平面地図で
section: how-to
order: 35
description: パッケージに絵のあるどの惑星・準惑星・衛星も、写真または線の地図で平面に表します。好きな時刻の昼と夜、日の出・日の入りの線、地点と地形の名前、月と火星を周回する探査機、ページ側で足せる印を描きます。WebGL を使わない canvas で、属性・凡例・イベントは chikyu-earth の平面地図と同じです。
---

`<wakusei-flat>` は、3D でも見られる天体の平面地図です。パッケージに絵のある28の惑星・準惑星・衛星 (水星から冥王星の衛星カロンまで。地球の月、火星・木星・土星・海王星の衛星も含みます) のどれでも、3D の表示と同じ表面の地図から描き、渡した時刻の太陽の向きに合わせて夜の側に陰をつけ、太陽が昇る・沈むところの線を引きます。見た目は **写真** (絵そのもの) と **地図** (同じ絵から描いた線の地図) の2つで、地図／写真を切り替えるボタンも、必要なら付けられます。月と火星では、周回機は時間が進むにつれて地図の上を動く点で、着陸地点・探査車の地点・墜落地点は地図の上の印です。どの天体にも、ページ側で自分の印を足せます。どれも押すとイベントが送られます。2枚の 2D canvas でできていて、WebGL も three.js も使いません。パッケージ以外に、追加で入れるものはありません。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flat maps of the Moon, Mars and Jupiter, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/flat/define/+esm"></script>
  </head>
  <body>
    <wakusei-flat body="moon" track></wakusei-flat>
    <wakusei-flat body="mars" time="2026-11-17T12:00:00Z" speed="0" footprint></wakusei-flat>
    <wakusei-flat body="jupiter" look="map" controls="centre look zoom key"></wakusei-flat>
  </body>
</html>
```

1つめの地図は、リアルタイムの月で、周回機それぞれの下に地上軌跡を描きます。2つめは、ある時刻で止めた火星で、周回機ごとの可視範囲を円で描きます。3つめは、線の地図の木星で、地図／写真のボタンと凡例がついています。バンドルするアプリでは `import "@johnmorrisdotca/wakusei-planets/flat/define"` でタグを登録します。`@johnmorrisdotca/wakusei-planets/flat` は DOM を使わない、計算だけの入口です。

## 何が表示されるか

- **地図。** 天体の表面の地図を、平面 (正距円筒図法: 横が経度、縦が緯度で、天体の全体を表し、左右はつながっています) で表示します。3D 表示と同じ地図で、パッケージの1024ピクセルの絵を使い、拡大して必要になったときは2048ピクセルの絵を使います。自分の絵を置くときは `texture-base` (と `texture-far-base`) で場所を指定します。指定しなければ、このバージョンの jsDelivr のフォルダから取得します。新しい絵はありません。3D 表示と同じファイルで、同じクレジットです (エウロパの絵は1024ピクセルだけです)。絵が取得できないときは、地面の色、経緯線、印、点だけを描き、そのことを表示します。
  - `look="photo"` (既定) は、絵そのものです。
  - `look="map"` は、その絵から手元で描く線の地図です。絵の明るさをなめらかにして、面積が同じになるように5つの暗い色合いに分け、色合いが変わる場所に薄い線を引きます。経緯線は30度ごと (拡大すると15度、10度ごと) で、度数を地図の縁に書きます。パッケージに地形の名前があるときは、それも表示します。色合いは絵自身の明暗に従います (月では海、火星では暗い地域、木星では縞)。惑星の輪郭線のデータはないので、線は絵の反射率の等高線です。
  - 地図／写真の切り替えボタンは `controls="... look"` で出します (既定には入っていないので、頼まなければボタンは増えません)。`look` はプロパティでもあります。`lookState` は今の状態 (`loading`、`map`、`photo`、`failed`) で、`wakusei-flat-look` が `{ look, state }` を送ります。
- **昼と夜。** 地図の各点について、その天体自身の極と自転から太陽の高さを求めます (`subSolarPoint` と同じ計算です)。夜の側は、はっきり暗くなり、日の出・日の入りの線 (太陽が地平線にある場所をつないだ円) を、暗いふちのついた淡い破線で引きます。黄色い点は、太陽が真上にある場所で、淡い輪がついています。空気のない天体 (月) では、昼と夜の境目は鋭く (地平線の下1度で完全な夜) なります。空気が厚いと光が広がるので、火星の夕暮れは8度の幅のグラデーション、金星とタイタンは10度、地球は12度です。`shade="off"` で、夜、線、太陽の点をなくします。
- **周回機。** 月と火星では、軌道データのある探査機ごとに、真下の地表の位置に点を描きます。塗りつぶした点ではなく輪のときは、位置がおおよそであることを表します (下を見てください)。`footprint` では、水平線から10度以上の高さに見える範囲を円で、`track` では1周分の地上軌跡を、後ろを破線、前を実線で描きます。軌跡は地図の左右の端 (経度180度) や極で切るので、地図を横切る線は出ません。
- **地点。** [地点のデータ](places.md) の着陸地点・探査車の地点・墜落地点・着陸予定地点・地形の名前を印にします。有人着陸は金色のひし形、着陸機は白、探査車は緑、墜落と衝突は×、着陸予定は破線の輪、地形の名前は小さな点です (海・クレーター・山脈。月に768、火星に914。水星、金星、ケレス、ベスタ、冥王星とカロン、イオ、エウロパ、ガニメデ、カリスト、タイタンなど土星と海王星の衛星の名前もパッケージにあります)。地球、天王星、海王星、フォボス、ダイモス、フェーベにはパッケージに地点がないので、絵と夜と、ページの印だけが出ます。写真では着陸地点などが既定で、地図では地形の名前も加わります (`places` で選べ、チップを押しても変わります)。名前を書く余地があるところにだけ印をつけます。
- **自分の印。** ページが地面に置きたいもの (お気に入り、衛星や周回機の場所、着陸機) は印にできます。下の「自分の印」を見てください。
- **凡例。** 地図の下 (上には重ねません) に、いま描いている印を、小さな絵と名前で並べます (英語・日本語): 太陽が真上にある場所、日の出・日の入りの線、夜の側、自分の場所、周回機 (うすいものも)、選んだもの、オンのときの可視範囲と地上軌跡、地図にある地点の種類、自分の印のグループ、そして絵の完全なクレジット。描いていないものは載せません。幅600px以上の地図では開いていて、それより狭い地図 (スマホ) では **凡例** ボタンを押すまで閉じています。コードからは `keyOpen` で切り替えます。`controls` に `key` を入れなければ、出しません。
- **クレジット。** 地図の下の端に小さな1行。線の地図も絵から描くので、どちらの見た目でも出ます。広い地図では `火星：NASA / USGS（パブリックドメイン）`、狭い地図では `火星：NASA / USGS` で、タップか押下で完全なクレジット (作者、ライセンス、CC BY 4.0 の絵なら変更点) が開きます。凡例にも完全なクレジットがあります。

## あるものと、ないもの

月のまわりでは、**LRO、チャンドラヤーン2号、ダヌリ、ARTEMIS P1、ARTEMIS P2** を描きます。**CAPSTONE** はパッケージにありますが、描ける楕円がなく (ハロー軌道は楕円ではなく、運用も2026年7月に終わりました)、描きません。火星のまわりでは、**MRO、マーズ・オデッセイ、MAVEN、マーズ・エクスプレス、ExoMars TGO、ホープ** を描きます。**天問1号** は公開された軌道データがないので、これも描きません。`orbiters` プロパティには描けるものだけが並びます。それ以外は、ページ側がパッケージのデータから名前を出せます (デモは、周回機の行の下に出しています)。

パッケージにないので地図にもないもの: そのほかの周回機 (たとえば、嫦娥計画の中継衛星「鵲橋2号」などの中国の月周回機)、運用を終えたかぐやなどの月周回機、引退した火星の周回機 (マーズ・グローバル・サーベイヤー、マンガルヤーンなど)、データを取得した2026年11月12日より後に打ち上げられた探査機です。軌道データは、JPL Horizons に合わせた平均軌道要素です。機ごとに、軌道を合わせた期間と、Horizons との誤差の実測値がついています。位置のずれが天体の半径の2%を超えるおそれのある探査機は、塗りつぶした点ではなく輪で描き、カードに「位置はおおよそ」と出します。2026年11月17日には、月の5機すべてと、火星の TGO と MAVEN がこれにあたります (月の5機は、合わせた1週間の期間が過ぎ、そのあとに測った最大の誤差が200〜240 km で、月の上限の35 km を超えています)。MAVEN の運用は2025年12月に終わったので、描かれるのは最後にいた平均軌道だけです。数字は [周回機のガイド](orbiters.md) にあります。

地点はパッケージ自身のデータです。月は着陸22、有人着陸6、探査車15、墜落・衝突49、着陸予定8、火星は着陸12、探査車7、墜落6、着陸予定1で、名前は英語と日本語がそろっています。ほかの天体には、地図に印をつける、その天体自身の着陸地点はまだありません。惑星そのものの地図は、[平面の太陽系図](flat-system.md) です。

## 天体

`body` には次のどれでも指定できます (既定は `moon`)。純粋な側の `FLAT_BODIES` の一覧と同じです。

| | |
|---|---|
| 惑星・準惑星 | `mercury`、`venus`、`earth`、`mars`、`ceres`、`jupiter`、`saturn`、`uranus`、`neptune`、`pluto` |
| 衛星 | `moon`、`phobos`、`deimos`、`io`、`europa`、`ganymede`、`callisto`、`mimas`、`enceladus`、`tethys`、`dione`、`rhea`、`titan`、`iapetus`、`phoebe`、`triton`、`charon` |
| 小天体 | `vesta` |

どの天体にも、パッケージ内の絵 (写真の見た目)、クレジット、太陽の位置を求める極と自転、その天体の薄明の幅があります。巨大ガス惑星・巨大氷惑星は雲の頂の絵で、`subSolarPoint` が使う自転に合わせて回るので、線と夜は、雲の上で太陽がある場所に合わせて引かれます。絵のうち6つ (水星、金星、木星、土星、天王星、海王星) は CC BY 4.0 で、残りはパブリックドメインです。どちらも、クレジットは地図に出し、線の地図にも付きます。太陽そのものは描きません (夜になる地面がないためです)。

## 属性

| 属性 | はたらき |
|---|---|
| `body` | 天体 (上を見てください)。既定は `moon` |
| `look` | `photo` (既定。絵そのもの) または `map` (線の地図)。chikyu-earth の `<chikyu-flat>` は描いた地図から始まりますが (そちらは絵が新しいため)、こちらは、要素がこれまで描いてきた絵が既定です |
| `center` | 真ん中の経度 (度)。既定は0。地図は天体を一周してつながります |
| `home-lon`, `home-lat` | 見る人の場所。ここでは選んだ地点です。2つそろったときだけ、印と「自分の場所」ボタンが出ます |
| `time` | `now`、ISO の日時、または1970年からのミリ秒。なければリアルタイム |
| `speed` | 1で実際の速さ、0で停止、86400で1秒に1日、負の数で逆戻り |
| `paused` | 速さを保ったまま時計を止めます。止まっている間は何も描きません |
| `footprint`, `track` | 可視範囲の円と地上軌跡。周回機を選んでいればその1機、選んでいなければすべて |
| `footprint-elevation` | 円を描くときの水平線からの高さ (度)。既定は10 |
| `selected` | 選ぶ周回機の id (`lro`) か、地点の id (`moon/apollo-11-lunar-module`) |
| `orbiters` | `all` (既定)、`off`、またはカンマで区切った id |
| `places` | 印をつける地点の種類。`landing` (有人着陸・着陸・探査車。写真での既定)、`crash`、`planned`、`feature`、いくつかの組み合わせ、`all`、`off`。指定しないときの地図の見た目では、地点と地形の名前を出します |
| `site-flags` | 着陸地点に、その国の国旗をつけます。地図の名前のそばとヒントに出ます (下の「着陸地点と国旗」を見てください) |
| `names` | `off` で印のそばの名前をなくします。数を書くと、その数までの名前を出します |
| `shade`, `dot-size`, `controls`, `lang` | 夜・日の出日の入りの線・太陽の点 (`off`)、点の大きさ、表示するボタン (`none`、または `centre zoom footprint track chips key look`。`look` 以外が既定)、`en` か `ja` (既定はページの言語) |
| `texture-base`, `texture-far-base` | 天体の絵がある場所 |

要素には、`look`、`lookState`、`keyOpen`、`center`、`zoom`、`time`、`speed`、`paused`、`selected`、`language`、`orbiters`、`places`、`layers`、`marks`、`groups` のプロパティと、`stats` プロパティ (描いた回数、地図を描いた回数、描いた周回機と印の数、どの見た目か、1回の描画にかかる時間、canvas の大きさ)、`setMarks(group, marks, label)` と `clearMarks(group)`、`placeOf(id)` (周回機や印が画面のどこにあるか)、`pick(id)` もあります。

### 見た目の指定

`--wakusei-flat-sea` と `--wakusei-flat-land` (線の地図でいちばん暗い色合いと明るい色合い。`#rrggbb`)、`--wakusei-flat-line` (色合いの境の線) は、線の地図を作るときに読みます。`--wakusei-flat-key-inset` (0) は凡例の左側にあける余白で、地図の左側にかぶさるカードがあるときに使います。`--wakusei-flat-aspect` (2 / 1)、`--wakusei-flat-aspect-narrow` (幅600px未満では 4 / 3)、`--wakusei-flat-radius` で、地図の形と角の丸みを決めます。要素に高さを与えると、地図はそれいっぱいに広がります。

## 地球の平面地図と同じ

[chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth) には、地球のまわりの衛星を平面地図に表す `<chikyu-flat>` があります。この要素は、同じ意味の同じ属性名 (`look`、`center`、`home-lon`、`home-lat`、`time`、`speed`、`paused`、`footprint`、`track`、`selected`、`shade`、`dot-size`、`controls` とその `key`・`look`、`lang`)、chikyu の `chikyu-` を `wakusei-` に替えた同じイベント (`wakusei-flat-pick`、`wakusei-flat-view`、`wakusei-flat-filter`、`wakusei-flat-look`、宇宙ビューと同じ `wakusei-timechange`)、同じボタン・チップ・地図／写真のボタン・凡例・1行のクレジット、同じ点・輪・ヒントの見た目、同じ正距円筒図法の計算 (`projectFlat`、`unprojectFlat`、`zoomAbout`、`clampView`) を持ちます。地球・月・火星を1つの切り替えで選ばせるページは、いま表示している側の要素に同じ属性を設定し、同じイベントを受け取れば済みます。

```ts no-run
const maps = { earth: document.querySelector("chikyu-flat")!, moon: document.querySelector("wakusei-flat")! };
const pick = (event: Event) => console.log((event as CustomEvent<{ id: unknown; name: string | null; via: string }>).detail);
for (const map of Object.values(maps)) {
  map.addEventListener("chikyu-flat-pick", pick);
  map.addEventListener("wakusei-flat-pick", pick);
}
```

違うのは、選べるものです。衛星の `id` は、地球側では衛星のカタログ番号、こちらでは周回機や地点の名前で、`detail.kind` (`orbiter`、`place`、`mark`) で何かが分かります。もう1つの違いは既定の見た目で、あちらは `map`、こちらは `photo` です。

## イベント

- `wakusei-flat-pick`: 押せるものすべてに共通の、1つのイベントです。対象は、周回機、地点データの地点 (着陸、探査車、墜落、クレーター、山)、着陸地点、ページが足した印です。`detail` は `{ kind, id, name, body, lat, lon, altitudeKm, status, placeKind, place, site, mark, via }` で、`kind` は `orbiter`、`place`、`mark` です (印では `mark` が記録で、渡した `data` も入ります)。地点では、`place` が地点データの記録 (2つの言語の名前、種類、ミッション、運用者、国、日付、地形の種類と大きさ)、`site` が [`/landing-sites`](landing-sites.md) の着陸地点 (名前、日付、運用機関、国と国旗のコード、座標の出典) で、着陸地点であるとき (着陸機、および同じ場所の探査車や降下ステージ) だけ入ります。該当しないときは、どちらも含まれません。`via` は `hover`、`tap`、`key` です。何もない場所をタップすると `id: null` が送られ、選択が解けます。ポインターの下にあるものの名前は要素自身が出します (ヒントと輪)。カードはページが作るもので、デモのように、イベントから組み立ててください。
- `wakusei-flat-filter`: チップで表示するものが変わったとき: `{ orbiters, layers }`。
- `wakusei-flat-look`: 見た目、またはその状態が変わったとき: `{ look, state }`。
- `wakusei-flat-view`: 見る人が地図を動かしたり拡大したりしたとき: `{ center, zoom }`。
- `wakusei-timechange`: `{ time, running, paused }`。時間が進んでいる間、1秒に4回まで。

## 自分の印

印は、名前のついた地面の1点です。印のグループを要素に渡すと、絵の上に描き、ポインターを重ねたとき、押したとき、キーボードで移ったとき (地図に Tab で入り、矢印キー) に名前を出し、読み上げ、凡例にグループのラベルで載せ、`wakusei-flat-pick` を `kind: "mark"` で送ります。衛星の直下点、お気に入りの場所、周回機、着陸機など、ページが地図に置きたいものを受け入れる入口です。印を動かすときは、新しい場所で `setMarks` をもう一度呼びます。次のコマで描き、何も変わらないときは何も描きません。

```ts no-run
import "@johnmorrisdotca/wakusei-planets/flat/define";

const map = document.querySelector("wakusei-flat")!;
map.setAttribute("body", "mars");
map.setMarks("favourites", [
  { id: "olympus", lat: 18.65, lon: -133.8, name: { en: "Olympus Mons", ja: "オリンポス山" }, shape: "diamond", colour: "#ffd23f", labelled: true },
  { id: "valles", lat: -13.9, lon: -59.2, name: { en: "Valles Marineris", ja: "マリネリス峡谷" }, shape: "star", data: { note: "the great canyon" } },
], { en: "My favourites", ja: "お気に入り" });
map.addEventListener("wakusei-flat-pick", (event) => {
  const { kind, mark } = (event as CustomEvent).detail;
  if (kind === "mark") console.log(mark.name, mark.data);
});
```

印は `{ id, lat, lon, name, group?, shape?, colour?, size?, labelled?, data? }` です。`id` は要素の中で一意で (同じ id の後の印は前の印を置き換えます)、`name` は文字列か `{ en, ja }`、`shape` は `dot` (既定)、`ring`、`diamond`、`square`、`cross`、`star`、`colour` は CSS の色、`size` は半径のピクセル数 (2から12、既定4) です。`labelled` は、余地があれば名前を印のそばに書きます。不正な印 (id や名前がない、場所が数でない) は捨て、経度は一周に収め、緯度は極で止めます。`map.marks` は印の一覧、`map.groups` はグループの一覧で、`clearMarks("favourites")` で1グループ、`clearMarks()` で全部を消します。確認には、純粋な側の `readMarks` と `markName` を使います。

## 着陸地点と国旗

`/landing-sites` の着陸地点 (月に28件、火星に11件) は、「アポロ11号 月着陸船」ではなく「アポロ11号」のように、着陸地点自身の名前で、着陸機の上に1回だけ表示します。`site-flags` を指定すると、それぞれにその国の国旗がつきます。地図では名前のそばに、ヒントでは先頭に `<hata-flag>` 要素が出ます。3D 表示の `site-flags` と同じやり方です。国旗は `@johnmorrisdotca/hata` のもので、ページ側で読み込みます (`import "@johnmorrisdotca/hata/element/define"`)。このパッケージは hata に依存しません。この要素が定義されていなければ何も描かず、名前だけが残ります。着陸地点と同じ場所にある探査車や降下ステージは、その着陸地点の一部として扱い、押すと同じ `site` が送られます。

```ts no-run
import "@johnmorrisdotca/hata/element/define";
import "@johnmorrisdotca/wakusei-planets/flat/define";

const map = document.querySelector("wakusei-flat")!;
map.toggleAttribute("site-flags", true);
map.addEventListener("wakusei-flat-pick", (event) => {
  const { kind, place, site } = (event as CustomEvent).detail;
  if (kind === "place") console.log(place.name.en, site?.agency.en, site?.country, site?.date);
});
```

## 時間

この地図は [宇宙ビュー](space-view.md) と同じ時計を使います。前回の描画から実際に経った時間の分だけ、設定した速さで進めます。1コマごとに決まった量を進めることはしないので、1秒に1日の速さは、どんなマシンでも1秒に1日です。周回機は、描くたびにその時刻の正確な位置を求めるので、どの速さでも、点が軌道の後ろにずれたり外れたりしません。速い時計では、点が1コマの間に大きく跳ぶので、点の後ろに短い尾を描きます。時計が進んでいるときは、周回機が半ピクセル動くたびに描き (最大で1コマごと、最低でも1秒に1回)、止めた時計、一時停止、画面の外、隠れたタブでは何も描かず、タイマーも動きません。

## タッチ、キーボード、言葉

ドラッグで動かし、2本の指でピンチすると拡大・縮小します。プラスとマイナスのボタン (`+` と `-` のキーも) で拡大・縮小し、Control か Command を押しながらホイールでも拡大・縮小できます。ホイールだけではページがスクロールします。キーボードでは、地図全体が1つの部品として扱われます。Tab で入り、矢印キー、Page Up、Page Down、Home、End で左から右へ周回機や印を順に移り、Enter で選び、Escape で抜けます。移るたびに、スクリーンリーダー向けのライブリージョンで読み上げます (「ルナー・リコネサンス・オービター、月の周回機、高度 113 km」)。表示する言葉は英語と日本語 (`lang`) で、天体・周回機・地点の名前は、パッケージ自身の表から、指定した言語で出します。

## どの天体も、いろいろな図法で

`<wakusei-flat>` は、1度が縦にも横にも同じ長さの地図 (正距円筒図法) で描きます。DOM を使わない `/flat` の入口には、ほかの天体の描かれた地図 (`textures/` に絵のある25天体、水星から冥王星の衛星カロンまで) を5つの図法で平面に投影する計算もあり、デモの平面地図のページには、それを使うパネルがあります。天体と図法を選び、地図の中心を動かし、経緯線を選ぶと、表示している時刻に太陽が真上にある場所が輪で示されます。

| 図法 | 保たれるもの | 形 |
|---|---|---|
| `equirectangular` (正距円筒図法) | 絵のまま | 幅が高さの2倍の長方形 |
| `mercator` (メルカトル図法) | 角度 (小さな形はそのまま)。極は無限遠になるため、北緯・南緯85.05度までを描く | 正方形 |
| `sinusoidal` (サンソン図法) | 面積。どの緯線も本当の長さ | 葉の形 |
| `mollweide` (モルワイデ図法) | 面積 | 幅が高さの2倍の楕円 |
| `azimuthal` (正距方位図法) | 中心からの距離 (中心は極を含む任意の点) | 円形。中心の反対側の点が縁 |

`projectMap(projection, lon, lat, centre)` は経度・緯度から地図上の位置を、`unprojectMap(projection, x, y, centre)` は地図上の位置から経度・緯度を求めます。位置は、地図の中心からの半径を単位にした値です (x は東、y は北)。`unprojectMap` は、葉の形・楕円・円の外では `null` を返します。`graticule(projection, step, centre)` は経線と緯線を、地図の端 (円形の図法では縁) をまたぐところで切った折れ線として返し、メルカトル図法では極に線を引きません。`mapOutline` は地図の縁の線、`fitMap` と `mapPixels` は地図を枠に収め、`mapSun` は地図上の太陽直下点を返します。`resampleMap(picture, projection, width, height, { centre, zoom })` は、天体の描かれた地図 (ピクセル。`ImageData` または RGBA のバイト列) を、その図法で描いた同じ天体の絵に変換して返します。ピクセルの間は滑らかに補間し、左右の継ぎ目では反対側へ回り込み、極では端の値を保ち、地図の形の外は透明です。ページも canvas も依存パッケージも要りません。

```js
import { PROJECTIONS, graticule, projectMap, resampleMap, unprojectMap } from "@johnmorrisdotca/wakusei-planets/flat";

// Where Olympus Mons on Mars (18.65 degrees north, 133.8 degrees west) falls on each map, in radii from the middle, and the way back.
for (const projection of PROJECTIONS) {
  const { x, y } = projectMap(projection, -133.8, 18.65);
  const back = unprojectMap(projection, x, y);
  console.log(`${projection}: ${x.toFixed(2)}, ${y.toFixed(2)}; back at ${back.lat.toFixed(2)}, ${back.lon.toFixed(2)}`);
}

// The lines of a 30 degree grid on a Mollweide map, and a painted map of two pixels redrawn on it.
console.log(`${graticule("mollweide", 30).length} lines`);
const picture = { width: 2, height: 1, data: [255, 0, 0, 255, 0, 0, 255, 255] };
const answer = resampleMap(picture, "mollweide", 40, 20);
console.log(`${answer.length / 4} pixels, the corner is ${answer[3] === 0 ? "empty" : "drawn"}`);
```

出力は次のとおりです。

```text
equirectangular: -2.34, 0.33; back at 18.65, -133.80
mercator: -2.34, 0.33; back at 18.65, -133.80
sinusoidal: -2.21, 0.33; back at 18.65, -133.80
mollweide: -2.03, 0.36; back at 18.65, -133.80
azimuthal: -2.07, 0.97; back at 18.65, -133.80
18 lines
800 pixels, the corner is empty
```

`<wakusei-flat>` 自体は、今も正距円筒図法の地図だけを描きます。移動、選択、地上軌跡のどれも正距円筒図法の地図を前提にしているため、要素に `projection` 属性を持たせるのは大きな変更になり、今回は含みません。

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

太陽と、昼と夜の境の線は、この地図のどの天体でも求められます。線の地図の描き方も、絵のピクセルへの単純な計算です。

```js
import { MAP_LAND, MAP_SEA, flatSun, flatSunRate, sunriseLine, toneMap, toneRamp } from "@johnmorrisdotca/wakusei-planets/flat";

// Where the Sun is overhead on Venus, Mars and Titan, how fast it crosses the ground, and the sunrise line round it.
const when = Date.UTC(2026, 10, 12, 12);
for (const body of ["venus", "mars", "titan"]) {
  const sun = flatSun(body, when);
  const line = sunriseLine(sun, 72);
  console.log(`${body}: the Sun is over ${sun.lat.toFixed(1)}, ${sun.lon.toFixed(1)}, crossing ${(flatSunRate(body, when) * 3600).toFixed(2)} degrees an hour; the line has ${line.length} points`);
}

// The line map of a picture four pixels wide, from black to white: the same four pixels in the dark tones of the ramp, every one opaque.
const pixels = new Uint8ClampedArray([10, 10, 10, 255, 90, 90, 90, 255, 160, 160, 160, 255, 250, 250, 250, 255]);
const map = toneMap(pixels, 4, 1);
console.log(`${map.length / 4} pixels, opaque: ${map.every((value, i) => i % 4 !== 3 || value === 255)}; the ramp has ${toneRamp(MAP_SEA, MAP_LAND).length} tones`);
```

出力は次のとおりです。

```text
venus: the Sun is over -0.2, -146.2, crossing 0.13 degrees an hour; the line has 73 points
mars: the Sun is over 8.7, 156.2, crossing 14.60 degrees an hour; the line has 73 points
titan: the Sun is over -8.3, 112.9, crossing 0.94 degrees an hour; the line has 73 points
4 pixels, opaque: true; the ramp has 5 tones
```

この入口には、ほかに `flatBody` (天体の半径、薄明の幅、周回機)、`shadeNight` (ピクセルの格子に夜の陰をつける)、`circleOutline` (可視範囲の円を平面地図の線にする)、`flatTrack` と `trackPieces` (地上軌跡を平面地図用に切る)、見た目 (`readLook`、`toneMap`、`toneRamp`、`bandEdges`、`pictureWidth`、`creditWho`、`creditLicence`)、印 (`readMarks`、`markName`)、言葉 (`FLAT_WORDS`、`say`、`coordinateText`、`gridText`) があります。
