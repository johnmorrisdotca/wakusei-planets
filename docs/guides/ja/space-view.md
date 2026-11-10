---
title: 宇宙ビュー
section: how-to
order: 16
description: 地球・月・太陽・惑星を、好きな日時の場所に置きます。月の満ち欠けも、地球の昼の側も、本物の太陽の光から決まります。縮尺は二通り、時間は前にも後ろにも進み、地球から太陽系ぜんぶまでズームできます。
---

`@johnmorrisdotca/wakusei-planets/space/element` は `<wakusei-space>` を登録します。地球・月・太陽・ほかの7つの惑星・冥王星・ほかの8つの準惑星を、指定した日時の場所に置き、パッケージが知っているすべての衛星をその惑星のまわりに置いて、three.js で描きます。ページで共有する WebGL コンテキストを1つだけ使います。月の満ち欠けも、地球の昼の側も、表ではなく光から決まります。地球から太陽系ぜんぶまでズームでき、時間は前にも後ろにも進められます。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Earth, the Moon and the planets on 2 November 2026</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/space/element/+esm"></script>
  </head>
  <body>
    <wakusei-space time="2026-11-02T14:00Z" speed="0" look="realistic" style="width: 420px"></wakusei-space>
  </body>
</html>
```

three が必要です (任意の peer 依存)。表面の絵は、jsDelivr か、`texture-base` で指定したフォルダから読み込みます。この表示では、表面の絵を持つ天体は、どちらの見た目 (`look="realistic"` と `look="painted"`) でもその絵で描かれ、月も火星も同じです。カメラが近づくと、細かい地図のタイルもつきます。絵のない天体 (フォボス、ダイモス、天王星の衛星) は、数字から陰影をつけて描きます。自分の three.js のシーンで同じにするには、painter の context に `mapped: true` を渡します。天体はすべてこのパッケージの描画部品で描くので、`<wakusei-body>` と同じ見た目です ([自分の three.js シーンで使う](in-your-own-scene.md))。

## 位置

位置はこのパッケージ自前のモデルだけで求めます。太陽と惑星は VSOP87B、冥王星は JPL Horizons に合わせた表、月は ELP2000 です。J2000 の赤道座標での幾何学的な位置で、光行差や章動は入れていません。入れても約20秒角しか動かず、この縮尺ではピクセルの何分の一にもなりません。計算だけの関数は `@johnmorrisdotca/wakusei-planets/space` にあり、サーバーでも使えます。

```ts
import { frameAt, placeAround, placeSun } from "@johnmorrisdotca/wakusei-planets/space";

const frame = frameAt(Date.UTC(2026, 10, 2, 14));
const sun = placeSun("compressed", frame.sun);
const [x, y, z] = placeAround("compressed", sun, [frame.planets.mars[0] - frame.sun[0], frame.planets.mars[1] - frame.sun[1], frame.planets.mars[2] - frame.sun[2]]);
console.log(Math.hypot(x - sun[0], y - sun[1], z - sun[2]).toFixed(0));
```

`frameAt(ms)` は、地球の中心から見た太陽・月・惑星の位置 (天文単位) です。テスト用の別ライブラリ astronomy-engine と比べて、太陽と月は100分の1度以内、惑星は数100分の1度以内で合います。`createTrack(stepMs)` は、本当に計算した2つの時刻のあいだを補います。1秒に1日進めても、計算は1秒に約2回で、描くたびに計算し直すことはありません。

## 縮尺は二通り

宇宙はほとんど空っぽなので、本当の縮尺ではほとんど真っ暗で、天体は点に見えます。この要素は両方を持っていて、`scale` で切り替えます。初期値は本当の距離 (`true`) です。

| `scale` | 距離 | 大きさ |
|---|---|---|
| `true` (初期値) | 距離も大きさも本物で、地球の赤道半径が1です | 本物の大きさ。惑星は点のように小さく、太陽は光る点です。半径が画面で4CSSピクセルに満たない天体には、名前に加えて、その場所のまわりに輪も描くので、どの惑星も見失いません |
| `compressed` | 向きはすべて本物です。月は地球の半径の3.5倍の所に (本当は60倍)、太陽は70倍の所に (本当は23,500倍) 描きます。惑星は太陽から本物の向きに、70に天文単位の距離の0.45乗をかけた半径の所へ置くので、地球の軌道が70、海王星が約320です (本当は30倍)。太陽・天体・軌道の線は同じ一つの変換 (`placeBodies`、`orbitLine`) を通るので、地球もふくめ、どの天体も自分の軌道の線の上にいます。惑星の衛星は、本当の距離だとなりの惑星の軌道をこえてしまうときは近くに描きます (`moonDistance`)。いちばん遠い衛星はすき間の3分の1、ほかは順番をそのままに | 太陽が5、月が0.273 (地球と並べたときの本当の大きさ。地球の4分の1ほど)、惑星が0.4から1.8 (地球の半径を1として。実際より大きめ) |

いま使っている縮尺の名前は、要素の画面にいつも表示されます。「本当の距離」か「距離を縮めて表示」です (`lang="ja"` なら日本語になり、`space.scaleNames = { true: "..." }` でページ独自の言葉にでき、`::part(scale)` で行の見た目を変えられます)。以前の初期値のままにしたいページは `scale="compressed"` と書きます。`space.placeOf(id)` は、天体がいま画面のどこにあるか (要素の中での中心と半径、CSSピクセル) を返します。

## 時間

`time` は ISO 形式の日時 (`2026-11-02T14:00Z`) か `now` です。`speed` は1秒に進むゲーム内の秒数です。`1` は実際と同じ、`0` は止める、`3600` は1秒で1時間、`86400` は1秒で1日、マイナスは逆戻りです。`time` を変えると、カメラは地面の同じ場所をもう一度向きます。地球は本物の自転で回り、月はいつも同じ面を地球に向け、各惑星は太陽の光を受けるので、金星は三日月に、月は半月になります。

`light="lit"` にすると、カメラの側から昼の光が当たっているように、すべての天体を照らします (太陽は自分で光ります)。夜の側を見ても真っ黒になりません。どちらでも、天体は本当の位置のままです。

## ズーム、天体を見る、名前

この要素は、ドラッグ、ピンチ、Ctrl とホイール、キーを自分で受けます ([ズームと移動](zoom-and-pan.md))。範囲は100万分の1 (太陽系ぜんぶが見えるところまでカメラを引く) から3倍までです。上限は、カメラが天体に着くところです。カメラは、見ている天体の半径の `3.4 / zoom` 倍の所にいて、ズーム1でその天体が画面いっぱいになります。カメラは表面から1.05半径より近づかないので、約3.2を超えても何も動きません。3倍では、表面は地図のタイルがいちばん細かいところまでくっきり見えます (タイルがあるのは、地球と、`painted` の見た目の火星と月です。[近づくズームと地図のタイル](close-zoom.md))。タイルは、カメラがそこまで近づいたときだけ、見えている部分ぶんを取ります。ボタンがほしいときは、ファミリーの `<kazoku-view-controls for="space">` を横に置きます。バーも同じ範囲を読みます。`zoom-min` と `zoom-max` はどちらにつけても範囲が変わり、`controls="none"` で要素自身の手を外せます。`space.zoomFor("moon" | "sun" | "inner" | "solar-system" | "earth" | "jupiter-moons")` は、いまの縮尺と時刻で、空のその部分が収まるズームを返します。`space.controller.set({ zoom })` (バーがあるときは `controls.controller.set({ zoom }, true, "jump")`) でそこへ行きます。`space.setView(コントロールの値)` は、カメラを天体のまわりで回します (`roll` は画面を時計まわりに回し、`panX` と `panY` は、絵の中のすべてをちょうどそのCSSピクセル分、右と下を正として、奥行きに関係なく動かします)。カメラは星に固定されているので、時間が進むと地球はカメラの下で回ります。

`space.body = "jupiter"` で、カメラをその天体に向けます。大文字でも小文字でも、英語でも日本語でも、この表示にある天体ならどれでも使えます (`earth`、`sun`、`moon`、`mercury` から `neptune`、`pluto`、それに `titan` のような惑星の衛星)。天体でない名前を入れても何も変わりません。各天体の横の名前はボタンです (Tab と Enter)。ドラッグではない押し方で天体を押すと、`wakusei-body-click` が `{ id, name, kind, host, radiusKm, distanceKm }` つきで発火します (キーボードでは `wakusei-body-focus`)。同じ値は `space.bodyInfo(id)` でも得られます。`space.bodyNames = { mars: "火星" }` や `lang="ja"` で表示する言葉を変えられます。

名前は重なりません。2つの名前の枠が重なるときは、大事なほうだけを出し、出さない名前は輪も出しません。優先は、見ている天体、太陽、惑星、月の順で、同じ順なら画面で大きいほうが残ります。衛星は惑星に、惑星は太陽に場所をゆずり、ズームインすると名前が戻ります。`@johnmorrisdotca/wakusei-planets/space` の `chooseLabels(boxes)` は、同じ決まりを四角形の一覧にそのまま使えます。

惑星が数ピクセルの大きさになると、そのまわりに近い衛星が現れます。位置はこのパッケージの衛星モデルが出します (`zoomFor("jupiter-moons")`)。地球と惑星が太陽のまわりを回る道と、月が地球のまわりを回る道は、`orbits="off"` にしない限り描きます。どの線も天体と同じ変換を通るので、どちらの縮尺でも、天体は自分の線の上にいます。`stats.orbits` は、描いた線と、各天体が自分の線からどれだけ離れているか (線の半径に対する割合。線の上なら0.01未満) を返します。月の線は、月がいる場所から恒星月1つぶんの道で、時計が数日進むたびに計算し直します。点は `moonOrbit(ms)` で得られます。

## すべての天体

この表示は、パッケージが知っているすべての天体、47個を出します。太陽、8つの惑星、9つの準惑星 (冥王星、ケレス、オルクス、ハウメア、クワオアー、マケマケ、ゴンゴン、エリス、セドナ)、29の衛星です。`/space/element` の `SPACE_BODIES` は、シーンの中に置く19個の一覧で (準惑星は接触軌道要素から。2026年の前後数年ぶんで有効です)、衛星はどれも本当の軌道で、それぞれの惑星のまわりに置きます。どれも表示の中心にでき、行き先に選べ、めぐることができ、乗って見られます (`space.ride("ceres")`、`space.ride("titan")`、`space.ride("vanth")`)。画面で小さすぎて見えない準惑星 (半径が半ピクセルに満たないもの) は描かず、名前と輪だけを出し、見に行くまで絵も作りません。衛星は、惑星が数ピクセルの大きさになると描きます。`orbits` がオンなら、準惑星の軌道の線も出ます。`space.zoomFor("mars-moons")` (`jupiter`、`saturn`、`uranus`、`neptune`、`pluto`、`orcus`、`haumea`、`eris` も) は、惑星とその近い衛星が収まるズームを返します。

デモの選び方は、横に並んだ3回のクリックです。種類 (太陽と惑星、準惑星、衛星)、衛星ならそれが回る惑星、そして天体です。横には名前 (英語でも日本語でも) でさがす欄があり、衛星のある惑星には「衛星もいっしょに」ボタンが出ます。自分の選び方を作るときは、`space.bodyList()` がそのデータです。

## 天体へ行く、天体をめぐる

天体かその名前を最初に押すと、その天体が選ばれます。同じ内容の `wakusei-body-select` が発火し (ページのカードに使えます)、`space.selected` で読めますが、表示は動きません。選ばれた天体をもう一度押すか、`space.goTo("saturn")` を呼ぶと、その天体が表示の中心になります。カメラは約1秒でそこへ滑るように動き (動きを減らす設定の人や `{ smooth: false }` のときは一瞬で移ります)、ズームは1に戻って天体ぜんたいが見え (`{ zoom }` で別の値も指定できます)、時間が進んでもその天体を追います。押してほかの場所に飛ぶことはなく、すでに中心にある天体を押しても何も起こりません。`goTo` は、そこへ行けるかどうかを返します。`<kazoku-view-controls>` を要素に結びつけているときは、ズームの状態をバーが持つので、イベントが運ぶ値をページが `controls.controller.set({ zoom }, true, "jump")` で反映します。

めぐる順番は一つに決まっています。太陽、水星、金星、地球、月、火星、フォボス、ダイモス、木星とその衛星、と外へ進み、各惑星の次にその衛星が近い順に来ます (全体は `/space` の `HOP_ORDER` です)。`space.next()` と `space.previous()` は、次の天体と前の天体へ行き、最後からは太陽にもどります。どちらも、行った先の `BodyInfo` を返します。中心が変わるたびに `wakusei-hop` が `{ current, previous, next }` (それぞれ `BodyInfo`。`goTo` やめぐる操作がズームを求めたときは `zoom` も) つきで発火するので、矢印を2つ置いて、それぞれの行き先の名前を見せられます。`space.hopper` はいつでも同じ値を返します。`space.bodyList()` はジャンプ用の一覧で、行けるすべての天体を順番に、種類 (`kind`: `star`、`planet`、`dwarf-planet`、`moon`) と、衛星なら `host` つきで返します。`/space` の `findBody("Saturn")` と `findBody("土星")` は、人が入力した言葉から天体を読み取ります。

## 全画面

`immersive` (属性、または `space.immersive`) をつけると、要素は全画面の表示になります。入れ物の大きさに、どんな形でもぴったり広がり (`width: 100%; height: 100%`。ページが幅と高さを決めれば、属性なしでも同じです)、ホイールだけで拡大縮小し、どこをドラッグしても (タッチのドラッグも) 回ります。ページはスクロールしません。`immersive` がないときは kazoku-ui の決まりのままで、Ctrl、Command、Alt のどれかを押しながらホイールを回すと拡大縮小し、ホイールだけならページがスクロールします。ズーム1では、見ている天体は表示の短いほうの辺に収まるので、縦長の窓でも横長の窓でも切れません (土星は環ごと収まります)。`zoom-min` まで引くと、カメラは太陽系ぜんぶが見えるところまで下がります。

```html
<style>
  html, body { margin: 0; height: 100%; background: #04060c; }
  wakusei-space { position: fixed; inset: 0; }
</style>
<wakusei-space immersive time="now" speed="3600"></wakusei-space>
```

ページ [space-full.html](https://johnmorrisdotca.github.io/wakusei-planets/space-full.html) がこの形で、下にファミリーの表示コントロールが重なります。`@johnmorrisdotca/kazoku-ui/testing` の `checkGestures` は、このページで通ります。例外は1つだけで、ホイールだけでの移動 (パン) です。このページではホイールだけで拡大縮小するためです。

## プロパティ、イベント、stats

属性は `center` (`"lon,lat"`)、`time`、`speed`、`scale` (`true` か `compressed`。初期値は `true`)、`look` (`realistic` か `painted`)、`light`、`labels` と `orbits` (`off` で隠す)、`lang`、`texture-base`、`texture-far-base`、`max-texture`、`tiles` (細かい地図のタイルの場所。`off` でなし) です。イベントは `wakusei-view` (表示が変わった: `yaw`、`tilt`、`zoom`)、`wakusei-ready`、`wakusei-unavailable`、`wakusei-state`、`wakusei-timechange` (日付が変わった: 時間が進む間は1秒に4回まで、止まったときに1回、`{ time, running }`)、`wakusei-time` (時計が1ステップ進むたび)、`wakusei-body-click`、`wakusei-body-focus` です。`stats` には `state`、`draws`、`contexts`、`canvas`、`distance`、`time`、`lookups`、`camera`、`bodies`、`tiles` があります。

## 乗って見る

`space.ride("moon")`、`space.ride("io")`、`space.ride({ at })` で、カメラを動く点に乗せ、その点が回る天体を見ます。詳しくは [乗って見る](ride-along.md) をどうぞ。

## 負荷の上限

このパッケージの3D表示と同じ決まりを守り、`pnpm test:freeze` で確かめています。共有レンダラーで WebGL コンテキストは1つ、キャンバスは1辺4096ピクセル以内かつ600万ピクセル以内、止まっている間は何も描かず、1秒に30フレームまで、実際の時間なら1分に1回だけ描き直し、画面の外では描かず、要素を外せばすべて解放し、失われたコンテキストは自動で戻します。
