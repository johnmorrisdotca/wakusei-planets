---
title: 着陸地点と国旗
section: how-to
order: 22
description: "月と火星に軟着陸し、その後も通信できたすべての着陸 (全部で39件) を、小さな一覧にまとめました。英語と日本語の名前、日付、位置、運用した機関、国旗のコードで表した国、各座標の出典ページがあります。3D の月と火星では、着陸地点の名前が国旗といっしょに点の横に出ます。"
---

[English](../landing-sites.md)

`/landing-sites` は、成功した着陸の短い一覧です。**月に28件、火星に11件**あり、それぞれにカードや平面の地図に必要なものだけが入っています。ただのデータ (DOM も three.js も使わず、gzip で約5 kB) で、場所の表とは別に位置を持つものではありません。どの着陸地点の位置も、場所の表 (`/places/moon`、`/places/mars`) の位置と同じで、テストで二つを突き合わせています。そのため、カードに出る着陸地点は、3D の天体の上の着陸地点と同じです。

```ts
import { findLandingSite, flagCodeOf, landingSitesOf } from "@johnmorrisdotca/wakusei-planets/landing-sites";

const eagle = findLandingSite("Apollo 11")!;
console.log(eagle.name.en, eagle.name.ja, eagle.date, eagle.lat, eagle.lon, eagle.agency.en, eagle.country, flagCodeOf(eagle.country));
console.log(eagle.source.name, eagle.source.url);
console.log(landingSitesOf("mars").map((site) => `${site.name.en} (${site.country})`).join(", "));
```

## 入っているもの

| | 着陸地点 |
|---|---|
| 月、有人 | アポロ11、12、14、15、16、17号 |
| 月、ソ連 | ルナ9、13、16、17、20、21、23、24号 |
| 月、米国 | サーベイヤー1、3、5、6、7号と、IM-1 オデュッセウス、ブルーゴースト ミッション1、IM-2 アテナ |
| 月、中国・インド・日本 | 嫦娥3、4、5、6号、チャンドラヤーン3号、SLIM |
| 火星 | マルス3号 (着陸の約20秒後に通信が途絶えた)、バイキング1号と2号、マーズ・パスファインダー、スピリット、オポチュニティ、フェニックス、キュリオシティ、インサイト、パーシビアランス、祝融号 |

探査機が表面に降り立ち、その後も通信できたと、いずれかの出典が述べているものを一覧に入れています。墜落したり降下中に失われたりしたもの (ルナ5、7、8号、マルス2号、マーズ・ポーラー・ランダー、ビーグル2、スキアパレッリ、HAKUTO-R、チャンドラヤーン2号のヴィクラム) は入っていません。それらは場所の表に墜落として入っています。マルス6号は、降下中にデータを送り、地表に達したところで通信が途絶えました。場所の表には大まかな位置の着陸として入っていますが、着陸後に通信できたと述べる出典がないので、ここには入れていません。探査車は独立した着陸地点ではなく、着陸機の `alsoAt` に入っています。これから飛ぶ着陸機は場所の表に `planned` として入っていて、ここにはありません。月でいちばん新しいのはブルーゴースト ミッション1とIM-2 (2025年3月) で、NASA の月の着陸の表にそれより新しい軟着陸はありません。

## 一つの記録

```ts
import type { LandingSite } from "@johnmorrisdotca/wakusei-planets/landing-sites";

const site: LandingSite = {
  id: "moon/apollo-17",                       // <天体>/<スラッグ>
  place: "moon/apollo-17-lunar-module",       // 場所の表の同じ場所
  alsoAt: ["moon/apollo-17-lunar-rover"],     // 同じ地点にある他の場所: 探査車、降下ステージ
  body: "moon",
  name: { en: "Apollo 17", ja: "アポロ17号" },
  date: "1972-12-11T19:54Z",                  // UTC
  lat: 20.1911, lon: 30.7723,                 // 惑星中心緯度、東経、-180から180
  agency: { en: "NASA", ja: "NASA" },
  country: "US",                              // ISO 3166-1 alpha-2。ソ連は SU
  stand: "apollo-17",                         // ここに立てる: 立ち位置ビューでの id
  source: { name: "NASA NSSDCA, Table of Anthropogenic Impacts and Spacecraft on the Moon", url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html" },
  page: "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1972-096C",
};
console.log(site.id);
```

`source` は数値を読み取った出典で、どの記録にもあります。`checkedAgainst` は同じ場所を示すもう一つの NASA のページです (記録自身の出典が GCAT の場合は、0.01度の桁まで一致する NASA のページです)。`page` はミッションの NSSDCA のページで、開けるものだけに付けています。`approximate` は出典が「約」と書いているものに付いています (ルナ9号は最初のソ連の報告にもとづく位置で、本当の位置から10 km 以上離れていそうです。マルス3号も同じです)。`note` は、出典が述べている場合に、着陸のその後を英語の一言で伝えます。

**月の数値の出どころ。** NASA NSSDCA の「月面の人工物の衝突と探査機の表」(2026-11-17 に読み取り) と、ここの月の記録すべてを1行ずつ突き合わせました (28件すべて一致)。**火星:** パスファインダー、スピリット、オポチュニティ、フェニックスは Mars Orbital Data Explorer の着陸地点の一覧、バイキングは NASA NSSDCA のバイキングのページ、インサイトは NASA GISS の Mars24 の着陸機の一覧、マルス3号、キュリオシティ、パーシビアランス、祝融号は GCAT (J. McDowell、CC BY 4.0) で、それぞれ NASA の Mars24 か ODE のページと突き合わせています。火星の緯度は惑星中心緯度です。出典が惑星測地緯度で書いている場合 (フェニックスの北緯68.22度) は、記録の `note` に書いてあります。

## 国と国旗

`country` は ISO 3166-1 の英大文字2字で、ソ連は `SU` です (ISO 3166-3 が旧コードとして残している記号です)。`flagCodeOf(country)` は国旗の要素が受け取るコードを返します (GCAT が日本に使う1字の `J` は `JP` になります)。表示する国旗がないときは `undefined` です。

国旗は `@johnmorrisdotca/hata` のもので、その `<hata-flag>` 要素が描きます。絵文字ではなく、SVG の本物の国旗です (Windows は国旗の絵文字を描きません)。**このパッケージは hata に依存しません。** このパッケージが重ねる印は DOM の要素で、場所に国があり国旗がオンのとき、印は `<hata-flag code="US" border>` を持ちます。ページが `@johnmorrisdotca/hata/element/define` を読み込んでいれば国旗が出て、そうでなければ名前だけです。誰も定義していない要素は何も描かないからです。ソ連の国旗も hata のもの (`SU`) です。複数の国の機関 (ESA) の国旗はないので、そうした着陸地点は名前だけを表示します。

## 3D の月と火星の国旗

`<wakusei-body>` と `<wakusei-space>` の `site-flags` (プロパティは `siteFlags`) を、`places` をオンにして使います。

```html
<script type="module">
  import "@johnmorrisdotca/wakusei-planets/element";
  import { loadPlaces } from "@johnmorrisdotca/wakusei-planets/places";
  import { setPlacesLoader } from "@johnmorrisdotca/wakusei-planets/element";
  import "@johnmorrisdotca/hata/element/define"; // 国旗。省くと名前だけが出ます

  setPlacesLoader(loadPlaces);
</script>
<wakusei-body body="moon" look="painted" places="landing" site-flags style="width: 480px; height: 480px"></wakusei-body>
```

- 国のある場所のツールチップ (ホバー、フォーカス、タッチで出るもの) には、名前の前にその国の国旗が付きます。
- 天体が十分に大きく表示される (画面上で半径110 CSS ピクセル以上) と、各着陸地点の名前が国旗といっしょに点の右に出ます。右に場所がなければ左に出ます。点や別の名前に重なる名前は出しません。もっと拡大すると、出せる名前が増えます。名前の言語はビューの `lang` に従います。
- 描く速さも回数も変わりません。ラベルは、付いている点といっしょに動きます。
- 印を押すと、これまでと同じ `wakusei-place` イベントが出て、その `detail` に `site` が加わりました。着陸地点ならその記録、そうでない場所 (墜落地点、探査車、地形) なら `undefined` です。これを使って、ページはカードを出せます。カードには名前、日付、機関、国旗のコード、出典を載せられます。

```ts no-run
const body = document.querySelector("wakusei-body")!;
body.addEventListener("wakusei-place", (event) => {
  const { site } = (event as CustomEvent<{ site?: import("@johnmorrisdotca/wakusei-planets/landing-sites").LandingSite }>).detail;
  if (site !== undefined) console.log(`${site.name.ja}、${site.agency.ja}、${site.date.slice(0, 4)}年`, site.source.url);
});
```

7つのサイトは立てる場所でもあります。アポロ15号、16号、17号、嫦娥3号、4号、キュリオシティ、パーシビアランスの記録にはそれぞれ `stand` があり (`stand: "apollo-17"`、`"perseverance"` など)、その値が `<wakusei-surface site>` と `land(space, "perseverance")` (`/surface/land`) が受け取る id です。印と立ち位置の表示は同じサイトで、地点も着陸の時刻も同じです（テストで固定しています）。地面を実測してあるのはアポロ17号だけで、残る6か所は高さのモデルが追加されるまで平らな代用の地面に立ちます（「月面と火星に立つ」を参照）。

## 費用

`/landing-sites` は gzip で約5 kB の表ひとつで、コードは三つの検索だけです。印の費用はこれまでと同じです。`site-flags` がオフなら何も変わりません。オンのときも、印の名前と国旗は小さな要素二つで、印を置くのと同じ描画の中で置かれます。
