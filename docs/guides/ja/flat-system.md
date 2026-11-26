---
title: 太陽系の平面図
section: how-to
order: 36
description: 太陽・惑星・小惑星帯・彗星・探査機 (テスラ・ロードスターを含む) を、好きな時刻の上から見た平面図で表します。内側の惑星が見えるよう距離を圧縮します。WebGL を使わない canvas で、属性とイベントは月と火星の平面地図と同じです。
---

`<wakusei-flat-system>` は、黄道の北極の上から見た太陽系を、動かして拡大して押せる地図にしたものです。中心に太陽があり、惑星は渡した時刻の位置に軌道つきで描かれます。準惑星といくつかの小天体、小惑星帯とカイパーベルト (点の集まり) もあり、34個の彗星は太陽に近いとき、尾を太陽と反対向きにのばします。探査機も描かれ、テスラ・ロードスターもその一つで、それぞれ全行程の軌跡を描けます。2枚の 2D canvas でできていて、WebGL も three.js も使いません。パッケージ以外に、追加で入れるものはありません。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The flat solar system, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/flat/system/define/+esm"></script>
  </head>
  <body>
    <wakusei-flat-system selected="roadster" track></wakusei-flat-system>
    <wakusei-flat-system time="2026-11-17T12:00:00Z" speed="0" layers="planets craft" spacing="true"></wakusei-flat-system>
  </body>
</html>
```

最初の地図は現在の時刻で動き、テスラ・ロードスターを選んで、その車の全行程を描いています。2番目はある時刻で止め、惑星と探査機だけを、実際の距離の比で描きます。バンドルして使うアプリでは、`import "@johnmorrisdotca/wakusei-planets/flat/system/define"` でタグを登録します。`@johnmorrisdotca/wakusei-planets/flat/system` は DOM のない計算部分です。

## 天体の値か、別の要素か

`<wakusei-flat>` は天体の表面の地図です。経度が横、緯度が縦で、天体自身の画像を使い、横にぐるりとつながり、夜の側に太陽の位置から陰をつけます。太陽系にはそのどれもありません。画像も、つながりも、緯度もなく、位置は黄道面の中の半径と向きです。`<wakusei-flat body="sun">` にすると、1,600行ある最初の地図の中に2つ目の地図を入れることになるので、独立した要素 `<wakusei-flat-system>` にしました。作り方は `<wakusei-flat>` と同じ (同じ時計、2枚の canvas、同じ操作、イベント、キーボード) で、2つが並ぶ名前にしてあります。意味が同じ属性とイベントは、名前も同じです。

## 縮尺

太陽系はほとんど空っぽです。海王星は水星の78倍も太陽から遠くにあります。そこで距離は、[上から見た図](plan.md)と同じ対数 (`planRadius`) で圧縮します。天体は、太陽から端までのうち `ln(1 + d / 0.1 au) / ln(1 + 端 / 0.1 au)` の位置に置かれます。どの惑星にも場所ができ、内側は広く、外側は狭くなり、並びは距離の順のままです。向きは変えません。端を50 auにすると、地球は端までの39%、木星は64%、海王星は92%の位置です。地図には1・5・10・30・100 auの輪と距離が書かれ、足もとの行にどちらの縮尺かが書かれます。間隔ではなく、順番と向きを読んでください。`spacing="true"` にすると実際の距離の比になり、内側の惑星は中心に集まります。「圧縮表示」ボタンで切り替えます。

**端** は、表示している惑星・準惑星・探査機がすべて入る、50・100・200・500・1,000・2,000 auのうち最小のものです (`extent` で自分で決められます)。すべての層を出すと、ボイジャー1号が地図の面で約140 au先にいるので200 auになり、探査機を消すと50 auです。端より遠い彗星や小惑星帯の天体は描かず、軌道の線は端で切れます。

## 描くもの

- **惑星** (8個と冥王星) は、このパッケージ自身の位置 (VSOP87B、冥王星は近似テーブル) に、軌道の線つきで置かれます (`orbits="off"` で線を消します)。
- **準惑星と小天体**: ケレス、オルクス、ハウメア、クワオアー、マケマケ、ゴンゴン、エリス、セドナと、小惑星のベスタとパラス、ケンタウルス族のキロンとフォルスです。位置は、`/tables` を読み込んでいれば近似テーブルから、なければある時点の軌道要素から求め、その前後数年は使えます。
- **小惑星帯など** (`layers` に `belts`): メインベルト、ヒルダ群、木星トロヤ群、ケンタウルス族、古典的・共鳴・散乱円盤のカイパーベルトが、[小惑星帯の案内](belts.md)の色の点の集まりで描かれます。パッケージの標本で、知られている150万個のうち3,340個です。木星のところの隙間や、木星の60度前と後ろのトロヤ群の2つの群れといった形は見えますが、本当の密度ではありません。点はひとつずつ押せます。層を初めてオンにしたときに、軌道要素 (gzip で約70 kB) を取得します。
- **彗星**: [彗星の案内](comets.md)の34個で、JPLの軌道要素による二体運動です。尾は太陽と反対向きで、近日点で最長になります。`track` をつけるか選ぶと、端までの軌道を描きます。
- **探査機**: [探査機の案内](spacecraft.md)の19機で、テスラ・ロードスター (名前は車のもので、運転席のスターマンは facts にあります) は白い縁つきの赤で描きます。軌道データがその時刻を含む間だけ描きます (カッシーニとガリレオはずっと前に終わり、ほかは打ち上げから)。`track` をつけるか選ぶと全行程を、通ってきた部分は破線、これからの部分は実線で描きます。位置が予測である探査機 (2018年の観測からのHorizonsの予測である車と、運用が終わったあとの探査機) は、平面地図のおおよその周回機と同じく、輪で描きます。層を初めてオンにしたときに、探査機の軌道データを取得します。

## 属性

| 属性 | はたらき |
|---|---|
| `time` | `now`、ISOの日時、または1970年からのミリ秒。省略すると現在の時刻で動きます |
| `speed` | 1は実時間、0は停止、86400は1秒で1日、負の値は逆向き |
| `paused` | 時計を止め、速さは保ちます。止めている間は何も描きません |
| `selected` | 選んだ天体のid: `earth`、`halley`、`roadster`、または小惑星帯の天体の名前 |
| `center` | 地図の中心にして追いかける天体、または `sun` (既定)。ドラッグすると外れます |
| `layers` | `planets dwarfs belts comets craft`。既定はすべて、`off` で何も出しません |
| `craft`, `comets`, `belts` | どれを出すか: `all`、`off`、またはカンマで区切ったid |
| `orbits` | `off` で惑星と準惑星の軌道の線を消します |
| `track` | 選んだ探査機の全行程と選んだ彗星の軌道。何も選んでいなければ、出ているすべてのもの |
| `spacing` | `squeezed` (既定) または `true` |
| `extent` | 端の距離 (au)。省略すると自動 |
| `names` | `off` で天体の横の名前を消す、または名前の最大数 |
| `dot-size`, `controls`, `lang` | 点の大きさ、出す操作 (`none`、または `centre zoom orbits track scale chips` のいくつか)、`en` か `ja` (既定はページの言語) |

`footprint`、`shade`、`home-lon`、`home-lat` は表面の地図のためのもので、ここでは読みません。要素には、`selected`、`center`、`zoom`、`time`、`speed`、`paused`、`language`、`layers`、`extent` のプロパティと、`bodies` (描いたもの。種類・層・距離つき)、`stats` (描いた回数、地図を描いた回数、描いた天体と小惑星帯の点の数、1回に何ミリ秒かかるか、canvas の大きさ)、`placeOf(id)` (天体の画面上と au での位置)、`auAt(x, y)` (箱の中の点の距離)、`pick(id)` もあります。

## 平面地図と同じところ

`time`、`speed`、`paused`、`selected`、`dot-size`、`controls`、`lang`、`track`、`names` の名前と意味は `<wakusei-flat>` と同じで、イベントも同じです。`wakusei-flat-pick` (`detail` は `{ kind, id, name, layer, belt, distanceAu, x, y, predicted, via }`。`kind` は `star`、`planet`、`dwarf-planet`、`asteroid`、`centaur`、`comet`、`spacecraft`、`belt`。`via` は `hover`、`tap`、`key`。何もないところを押すと `id: null`)、`wakusei-flat-filter` (`{ layers }`)、`wakusei-flat-view` (`{ center, x, y, zoom }`)、`wakusei-timechange` (`{ time, running, paused }`) です。表示中の要素がどちらでも、ページは同じ属性を設定し、同じリスナーを使えます。ドラッグで動かし、2本指でピンチし、プラスとマイナスのボタンやキーで拡大・縮小 (最大8倍)、Control か Command を押しながらホイールでも拡大します。キーボードでは、地図が1つの部品です。Tab で移り、矢印キー、Page Up と Page Down、Home と End で左から右へ天体を順に移り、Enter で選び、Escape で外します。移るたびにライブリージョンで読み上げます。何千もある小惑星帯の天体はポインターだけで選べ、小惑星帯のチップはボタンです。

```ts no-run
import "@johnmorrisdotca/wakusei-planets/flat/system/define";

const system = document.querySelector("wakusei-flat-system")!;
system.addEventListener("wakusei-flat-pick", (event) => {
  const { name, kind, distanceAu } = (event as CustomEvent).detail;
  if (name !== null) console.log(`${name}, a ${kind}, ${distanceAu.toFixed(2)} au from the Sun`);
});
system.center = "roadster";
```

## 時間と描画

地図は [宇宙ビュー](space-view.md) と同じ時計を使います。2回見た間に実際に過ぎた時間だけ進み、フレームごとの刻みでは進みません。位置は、描くたびにその正確な時刻で求めます。動いている時計は、地図でいちばん速い水星が半ピクセル動くたびに描き直します (最大でフレームごとに1回、最低でも30秒に1回)。1秒に10日以上の速さでは、惑星がとんでしまうので、各天体のうしろに短い尾の線を引きます。止めた時計、一時停止、画面の外にスクロールした地図、見えないタブでは何も描かず、そのとき要素にタイマーもありません。canvas は600万ピクセル、一辺4,096ピクセルの中におさまります。円盤・輪・軌道の線は、表示、縮尺、層が変わったときだけ描き直し (線は地図の時間で1年に1回)、動くものは別の canvas に描きます。

## 言葉

言葉は英語と日本語 (`lang`) で、`SYSTEM_WORDS` と `saySystem` にあります。惑星・準惑星・彗星・探査機の名前は、パッケージ自身の表から、求めた言語で出します。輪のラベルはどちらの言語でも「1 au」です。au はIAUの記号で、日本の天文学でも同じ書き方をします。

## ブラウザなしで

```js
import { loadSpacecraft } from "@johnmorrisdotca/wakusei-planets/spacecraft";
import { squeezeAu, systemMarks } from "@johnmorrisdotca/wakusei-planets/flat/system";

// The flat solar system needs no browser: where the Tesla Roadster and the Earth are on the map for a date, and how far out the map squeezes each.
await loadSpacecraft("roadster");
const marks = systemMarks(Date.UTC(2026, 10, 17), { layers: ["planets", "craft"], craft: ["roadster"] });
const car = marks.find((mark) => mark.id === "roadster");
const earth = marks.find((mark) => mark.id === "earth");

console.log(`The Tesla Roadster is ${car.distanceAu.toFixed(2)} au from the Sun, the Earth ${earth.distanceAu.toFixed(2)} au`);
console.log(`With the edge at 50 au, the Earth is ${Math.round(squeezeAu(1, 0, 50, "squeezed").r * 100)} per cent of the way out, squeezed, and ${Math.round(squeezeAu(1, 0, 50, "true").r * 100)} per cent to scale`);
```

出力:

```text
The Tesla Roadster is 1.39 au from the Sun, the Earth 0.99 au
With the edge at 50 au, the Earth is 39 per cent of the way out, squeezed, and 2 per cent to scale
```

`systemMarks` がある時刻のすべての位置を求めます (探査機は先に `loadSpacecraft` が必要です)。`systemBelts` は小惑星帯の天体の位置、`systemOrbit`、`systemCometOrbit`、`craftPath` は線、`projectSystem`、`unprojectSystem`、`zoomSystemAbout`、`clampSystemView` は表示の計算です。

## 正確なところと、そうでないところ

惑星の位置はその時刻に対して正確です (光が届くまでの時間は考慮していません)。地図は上から見た図なので、黄道面から大きくはずれた天体 (冥王星、セドナ、彗星、面の外の探査機) は面の真上の位置に描き、縮尺に使う距離は面の中の距離です。デモのカードには3次元の距離が出ます。彗星はある時点の軌道要素による二体運動で、その前後1年以内なら使えます (どこまでかは[彗星の案内](comets.md)にあります)。小惑星帯は標本で、二体運動です。テスラ・ロードスターの位置は予測で、2018年の観測から年月がたつほど実際の車とずれます。
