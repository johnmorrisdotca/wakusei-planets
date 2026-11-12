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
- **止まっているときは何もしない。** 印は、絵が描かれるとき (カメラが動いた、時計が進んだ、設定が変わった) にだけ配置されます。いくつかの SVG の図形と名前を1回の描画から次へ使い回し、動かすだけです。アニメーションはありません。読者の場所は脈打つのではなく、いちばん高くて明るいことで目立ちます。印はボタンではなく、ポインター操作も受けないので、押した操作は印を通り抜けてビューに届きます。
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

## ブラウザーなしで使う部分

`/earth-places` は、`readEarthPlaces` (属性のテキストを安全なリストにする) と、`layEarthPlaces(places, view, look, options)` を出しています。後者は、ビューが描くとおりの天体に対する chikyu-earth の `layoutPlaces` で、自分で場所を描くページやサーバー向けです。`/places` にはその土台の計算があります。`spotView` は `SurfaceView` (天体の中心、軸、カメラ、画面への投影) を、場所を置ける絵に変え (正射影でも透視投影でも)、`pointUnder` は、ある向き (たとえば太陽の向き) の真下の点の経度と緯度を返します。
