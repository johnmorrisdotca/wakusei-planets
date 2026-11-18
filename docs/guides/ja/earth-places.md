---
title: 現在地と、地球の上の場所
section: how-to
order: 21
description: "宇宙ビューの地球に、読者自身の場所と、読者が覚えておく場所の印を付けます。ビーム、ピン、リングのどれかが地面から立ち上がり、地球と一緒に回り、裏側では隠れ、夜側では暗くなり、名前はほかの名前と重なりません。配置は chikyu-earth のものを任意のピア依存で使います。読者の場所はページが尋ね、このパッケージは保存も送信もしません。"
---

[English](../earth-places.md)

`<wakusei-space>` は、地球の上に場所の印を付けられます。読者がいる場所と、読者が覚えておく場所です。どの場所も、地面から立つ小さな印になり、地球と一緒に回り、裏側へ回ると隠れ、どれだけ拡大してもピクセルでの大きさは変わりません。リスト、見た目、配置は chikyu-earth の `places` と同じです。配置は chikyu-earth 自身のもの (`/markers`) で、任意のピア依存を通して使い、コピーはしていません。

```js no-check
import "@johnmorrisdotca/wakusei-planets/space/element";
import "@johnmorrisdotca/wakusei-planets/earth-places";

const space = document.querySelector("wakusei-space");
space.earthPlaces = [
  { id: "me", lon: -79.4, lat: 43.7, label: "現在地", kind: "here" },
  { id: "tokyo", lon: 139.69, lat: 35.69, label: "東京" },
];
```

```html
<wakusei-space
  earth-places='[{"id":"me","lon":-79.4,"lat":43.7,"label":"現在地","kind":"here"},{"id":"tokyo","lon":139.69,"lat":35.69,"label":"東京"}]'
  earth-places-look="beam"
  style="width: 420px; height: 420px"
></wakusei-space>
```

| 属性 | プロパティ | 意味 |
|---|---|---|
| `earth-places` | `earthPlaces` | 場所の JSON 配列。それぞれ `{ id, lon, lat, label, kind, color }`。プロパティに入れると属性に書かれ、空のリストを入れると属性が消えます。 |
| `earth-places-look` | `earthPlacesLook` | `beam` (既定): 地面から立ち上がる光の柱と、足もとのリング。`pin`: 細い棒と丸い頭。`ring`: 地面のリングだけ。それ以外は `beam` です。 |

属性名が `places` ではなく `earth-places` なのは、この要素の `places` がすでに、見ている天体の上の印の層 (`landing crash planned feature`、[月、火星と31の天体の場所](places.md)) を選ぶ属性だからです。2つは一緒に使えます。`places` が月に印を付け、`earth-places` が地球に印を付けます。

## インストール

```sh
npm install @johnmorrisdotca/wakusei-planets @johnmorrisdotca/chikyu-earth
```

`import "@johnmorrisdotca/wakusei-planets/earth-places"` を読み込むと、ページ上のすべての `<wakusei-space>` が chikyu-earth (0.36.0 以降) の場所の読み取りと配置を使えるようになります。独立した入口にしてあるので、場所に印を付けないページはそれを一切読み込まず、このパッケージのほかの部分は chikyu-earth を読み込まないので、入れていないプロジェクトでもビルドできます。この import がないと、属性は何も描かず、`earthPlaces` は空として読めます。

## 描かれるもの

- **種類。** `kind: "here"` は読者自身の場所で、背が高く、明るく、リングが大きくなります。それ以外の場所は `favourite` で、低く、細く、控えめです。色は、要素かページの `--wakusei-place-here` と `--wakusei-place-favourite` で決まります。`color` で場所ごとに色を付けられます (16進カラー、数字だけの `rgb()` か `hsl()`、または色の名前。それ以外は無視されます)。
- **カメラがどこを向いていても、地球の上に。** 印は地球自身の地面に従うので、カメラが経度10度、緯度20度の真上にあれば、そこにある場所は絵の真ん中に来ます。地球が画面上で半径40 CSS ピクセル以上あるあいだ描かれ、カメラがどの天体を見ていても同じです。太陽系全体のビューでは地球は点になるので、何も置かれません。
- **名前。** 場所の `label` は、余地があれば印の上に出ます。`here` が先、次に与えた順です。名前はほかの場所の名前や天体の名前 (月、地球自身) と重ならず、余地がなければ名前だけ省かれて印は描かれます。名前はページ自身のフォント (`--wakusei-place-font`) で測られます。
- **夜は暗く。** 地球の夜側にある場所は半分の強さで描かれ、名前も少し暗くなりますが、読めます。`light="lit"` のときは何も暗くなりません。
- **印は最大32個。** 見えている場所のうち、先頭の32個 (`here` が先、次に与えた順) が立ちます。見えている場所の残りは `earthPlacesShown.omitted` に数えられ、描かれません。大事な場所を先に並べてください。リストは5,000件で切られ、経度が -180 から 180、緯度が -90 から 90 の外にある場所は無視されます。
- **止まっているときは何もしない。** 印は、絵が描かれるとき (カメラが動いた、時計が進んだ、設定が変わった) にだけ配置されます。いくつかの SVG の図形と名前を1回の描画から次へ使い回し、動かすだけです。アニメーションはありません。読者の場所は脈打つのではなく、いちばん高くて明るいことで目立ちます。印はボタンではなく、ポインター操作も受けないので、押した操作は印を通り抜けてビューに届きます。動かさずに軽く押して、描かれた名前か足もとのリングの上で終わったときだけ、`wakusei-body-place` イベントになります (下を見てください)。
- **置いたものを調べる。** `space.earthPlacesShown` が、直前の描画で置いたものを返します。`{ marks: [{ id, kind, x, y, named }], omitted }` で、各印の足もとの位置は、ビューの左上からの CSS ピクセルです。

## 読者自身の場所

このパッケージがブラウザーに読者の位置を尋ねることはありません。尋ねるのはページで、読者が求めたときだけです。

```js no-check
import { nearby } from "@johnmorrisdotca/chikyu-earth/markers";

document.querySelector("#here").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition((position) => {
    const at = nearby({ lon: position.coords.longitude, lat: position.coords.latitude });
    space.earthPlaces = [{ id: "here", lon: at.lon, lat: at.lat, label: "現在地", kind: "here" }];
  });
});
```

- **押されたときに尋ねる。** `getCurrentPosition` は読者自身のクリックから呼び、ブラウザーの確認が、読者が求めたあとに出るようにします。消す方法も用意してください (`space.earthPlaces = []`)。
- **丸める。** `nearby(point, km)` は、場所を約 `km` キロメートル四方の格子 (既定は10) に置くので、印がどの通りかまで示すことはありません。描くときも保存するときも、先に丸めてください。
- **端末の中にとどめる。** 要素は何も保存せず、何も送りません。読者が共有を選ばないかぎり、読者の場所をページのアドレスに入れたり、サーバーに送ったりしないでください。
- **お気に入り** は `kind: "here"` でない場所すべてです。このパッケージに独自のリストや選択画面はなく、ページが読者のリストを作り、変わるたびに全体を渡します。

## 月・火星・ほかの天体の上の場所

`bodyPlaces` (属性は `body-places`) は、ビューが描くほかのすべての天体に対する、同じ層です。`{ body, id, lon, lat, label, kind, color }` の一覧で、`body` は天体のID (`moon`、`mars`、`ceres`、`io`)、残りは `earthPlaces` と同じです。同じ import (`@johnmorrisdotca/wakusei-planets/earth-places`。chikyu-earth の配置を使うので、新しいピアは要りません) が必要で、見た目 (`earth-places-look`)、色、名前、上限、読み取りも同じです (`/earth-places` の `readBodyPlaces` が一覧を天体ごとに分けて、それぞれを `readEarthPlaces` に渡します)。場所は、カメラが見ている天体の地面か、半径が画面で40 CSS ピクセル以上に見えている惑星・月・カタログの衛星の地面に立ちます。裏側と、ほかの天体の円盤の下では隠れ、天体の名前の上には重ならず、全体で最大32個が立ち、読者の `here` が先です。`earth` の項目は描かれません。地球の場所は `earthPlaces` です。着陸地点に降りたビューの空には、まだ光の柱はありません。

`space.bodyPlacesShown` は、置いたものを `{ marks: [{ body, id, kind, x, y, named }], omitted }` で返します。

場所になるのは `/places/search` の行です。`loadPlaceHits(ids)` は、お気に入りのページが保存したID (このリリースのものでも 0.66.0 のものでも。古いIDは今のIDに直します) を行にし、必要な一覧だけを取り寄せます。`hitToBodyPlace(hit, { lang, kind, color })` は、行から場所を作ります。

```ts no-run
import "@johnmorrisdotca/wakusei-planets/space/element";
import "@johnmorrisdotca/wakusei-planets/earth-places";
import { hitToBodyPlace, loadPlaceHits } from "@johnmorrisdotca/wakusei-planets/places/search";

const saved = ["moon/tycho", "mars/olympus-mons", "moon/apollo-11-lunar-module"];
const space = document.querySelector("wakusei-space")!;
space.bodyPlaces = (await loadPlaceHits(saved)).map((hit) => hitToBodyPlace(hit, { lang: "ja" }));
```

## 光の柱を押す

動かさずに (6ピクセル未満) 軽く押して、描かれた名前か足もとのリングの上で終わると、`wakusei-body-place` が送られます (バブリングあり、composed)。`detail: { body, id, kind, x, y }` で、天体 (地球の場所は `earth`)、与えたままの場所の `id`、`kind` (`here` か `favourite`)、ビューの左上から CSS ピクセルで測った足もとの位置です。ほかには何も起きません。押したら何をするか (最初の押しで選び、2度目で移動する、場所を開く、など) はページが決めます。層自身はポインター操作を受けないので、名前の上から始めたドラッグはこれまでどおりビューを回し、印への軽い押しは、その下の天体を押したことにもなりません。押した点に複数の印があるときは、いちばん近いものが選ばれ、消えかけの印は押せません。光の柱をキーボードで押す方法はありません (見るためのもので、支援技術には隠してあります)。同じ場所をボタンの一覧としても出してください。chikyu-earth の `chikyu-place-click` も、`id` と `kind` を同じように持ちます。

## ブラウザーなしで使う部分

`/earth-places` は、`readEarthPlaces` (属性のテキストを安全なリストにする) と、`layEarthPlaces(places, view, look, options)` を出しています。後者は、ビューが描くとおりの天体に対する chikyu-earth の `layoutPlaces` で、自分で場所を描くページやサーバー向けです。`/places` にはその土台の計算があります。`spotView` は `SurfaceView` (天体の中心、軸、カメラ、画面への投影) を、場所を置ける絵に変え (正射影でも透視投影でも)、`pointUnder` は、ある向き (たとえば太陽の向き) の真下の点の経度と緯度を返します。
