---
title: データの入口：外部のデータを受け取る
section: how-to
order: 32
description: 自分で用意した天体の地図や小天体を、ライセンスと出典つきのソースとしてパッケージに渡す方法、ソースをオフにする方法、いま画面にあるのは誰のデータかをページが示す方法を説明します。使う側は、「非営利のみ」や「同一条件で共有」のソースも渡せます。その場合、出典の横にライセンスが表示されます。
---

[English](../data-door.md)

パッケージは描くだけで、データは使う側が用意します。`@johnmorrisdotca/wakusei-planets/door`は、天体のより細かい地図や小天体のリストを渡すための唯一の入口です。同じ入口が、いま画面にあるのは誰のデータかも示します。ソースがなければ、パッケージはこれまでと同じものを、パッケージ自身のデータから描きます。そのデータは、表面の地図、そこから切り出した細かい地図のタイル、位置の計算のもとになる級数です（`OWN_SOURCES`。`NOTICE.md`の内容をもとに書いています）。パッケージに同梱するのは、そのまま再配布できるデータだけです。渡すソースは、「非営利のみ」でも「同一条件で共有」でもかまいません。その場合、出典の行には、ライセンスの横にその条件も表示されます。

型（`SourceInfo`、`Licence`、`RecordSource`、`TileSource`、`Credit`、`MapPlace`、`ImageTile`）と4つの小さな関数（`validateSource`、`creditLine`、`loadRecords`、`createTileStore`）は、ファミリー共通のデータの入口です。1つのファイルを、変更せずに各パッケージへコピーします（`src/data-door.ts`。kazoku-uiの`templates/data-door.ts`から）。入口はそれらを再エクスポートするので、`import`は1つで足ります。

## 小天体

小天体のソースは、メモリに収まるリストで、レコードは最大200,000件（`MAX_RECORDS`）です。ソースを追加したときに1回だけ読み込みます。レコードは`SmallBody`で、`name`（名前）と、ある元期での軌道要素から成ります。`a`（天文単位）、`e`（離心率）、`i`、`node`、`peri`、`M0`（`i`以降は度）、`epoch`（ユリウス日）、そして絶対等級の`H`です。`<wakusei-space>`は、これらを点として1回の描画命令（インスタンス描画）でまとめて描きます。各天体の位置は、軌道要素と日付からGPUが計算するので、日付が変わってもCPUでの計算は要りません。明るい天体（`H`が小さいもの）ほど大きな点になります。軌道は二体問題の楕円なので、天体は軌道要素が示す場所にあり、惑星の摂動は考えません。数値が有限でないレコード、名前が文字列でないレコード、軌道が楕円でないレコードは、除外し、その数を数えます。

`info`は、そのソースが何であるかを伝えます。`id`（小文字の英字、数字、ハイフン。ビューの中で重複しないもの）、日本語と英語の`name`と`credit`（空にはできません）、`licence`（名前とリンク。「非営利のみ」や「同一条件で共有」のときは、`nonCommercial`か`shareAlike`を付けます）、ソースのページ（`url`）、取得した日（`retrieved`）です。

```js
import { createSourceBook, creditLine, smallBodyAt } from "@johnmorrisdotca/wakusei-planets/door";

// A source of your own: here two small bodies held in memory (the second has a number that is not one, so it is left out). A real one would read a catalogue, and says whose it is and under what licence.
const mine = {
  kind: "records",
  info: {
    id: "my-rocks",
    name: { en: "My rocks", ja: "私の小天体" },
    credit: { en: "My rocks, A. Person (2026)", ja: "私の小天体（A. Person、2026年）" },
    licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
    url: "https://example.org/my-rocks",
    retrieved: "2026-11-10",
  },
  records: () => [
    { name: "Ceres", a: 2.7656, e: 0.0795, i: 10.588, node: 80.25, peri: 73.3, M0: 291.4, epoch: 2461000.5, H: 3.34 },
    { name: "Broken", a: Number.NaN, e: 0.1, i: 5, node: 0, peri: 0, M0: 0, epoch: 2461000.5, H: 12 },
  ],
};

// An element keeps a book like this one: `space.addSource(mine)` is `book.addSource(mine)`.
const book = createSourceBook();
book.addSource(mine);
await book.ready();
const [ceres] = book.smallBodies();
const [x, y, z] = smallBodyAt(ceres, 2461000.5);
console.log(`${book.smallBodies().length} small body, ${book.stats().records["my-rocks"].skipped} left out: ${ceres.name} is ${Math.hypot(x, y, z).toFixed(2)} au from the Sun`);
const credits = [{ source: mine.info, own: false, used: book.smallBodies().length }];
console.log(creditLine(credits, "en"));
console.log(creditLine(credits, "ja"));

book.enableSource("my-rocks", false);
console.log(`${book.smallBodies().length} small bodies with the source off`);
```

`createSourceBook`は、要素がソースを保持するソースブックです。要素の`addSource`は、ソースブックの`addSource`と同じです。ソースは追加するときに`validateSource`で検査されるので、空の出典、ライセンスなし、idの重複、関数の欠けは、最初の描画ではなく、その場で`TypeError`になります。`readSmallBodies(source, signal)`は、ソース1つをソースブックと同じやり方で読み込み、`smallBodyAt(body, julianDate)`は、ある日付での天体の位置（J2000の黄道座標での太陽中心の位置、天文単位）を返します。点を描くシェーダーが解くのと同じ軌道です。

## 天体の地図

地図のソースは、タイルのソースです。`need(place, detail)`は、ある範囲に必要なタイルのキーを返します。`load(key, signal)`は、タイル1枚を`ImageTile`（幅、高さ、画像）として取得します。`bytes(tile)`は、メモリの上限の計算のために、そのタイルがメモリ上で占める大きさを返します。ソースは、どの天体のものか（`body`。`"mars"`のように1つ、またはフォルダ全体なら`"*"`）と、どのレイヤーか（`layer`）も示します。`colour`は表面の画像で、パッケージが描きます。`height`は起伏で、まだ描きません。範囲はファミリー共通の`MapPlace`（経度と緯度、度）で、詳細度は、レベルの番号ではなく、円周全体の画素数です。タイルのピラミッド（階層構造）はパッケージ独自のものです。レベルLは円周が`2048 * 2^L`画素で、512画素のタイルに分けられ、列0は経度-180度、行0は緯度90度から始まり、タイルのキーは`level/column/row`で終わります。`mapKeys(place, detail, levels)`はそのキーを返すので、自分のソースの`need`をこれで作れます。ある天体の地図のソースは、その天体についてはパッケージのタイルのフォルダの代わりになります。視野に入っているタイルの窓は、これまでどおり、天体自身の2048画素の画像の上に重ねられます。

`tilesSource(base)`は、パッケージ自身のフォルダをソースにしたものです。`manifest.json`と、天体、レベル、場所ごとの`<body>/<level>/<column>/<row>.webp`というタイルから成ります。`tiles`属性が意味するのはこれで、属性は短い書き方として残ります。`tiles="/my-tiles/"`と`addSource(tilesSource("/my-tiles/"))`は同じ意味です。

## 要素で使う

`<wakusei-body>`は地図のソースを受け取り、`<wakusei-space>`は地図のソースと小天体のソースを受け取ります。どちらも同じメソッドを使えます。

```js no-run
import { creditLine } from "@johnmorrisdotca/wakusei-planets/door";
import "@johnmorrisdotca/wakusei-planets/space/element";

const space = document.querySelector("wakusei-space");
const remove = space.addSource(mine); // checked at once; returns the way to take it away
space.addEventListener("wakusei-creditschange", () => (credit.textContent = creditLine(space.credits(), "en")));
space.enableSource("my-rocks", false); // a layers panel's switch
```

`sources`はプロパティです（属性ではありません。データは文字列ではないからです）。リストを代入するとソースが置き換わり、1つでも拒否されたら何も変わりません。`removeSource(id)`と、`addSource`が返す`remove()`はソースを取り除きます。`enableSource(id, false)`はソースをオフにしますが、ビューには残します。属性`data="own"`は、パッケージ自身のもの以外のソースを、すべてまとめて無視します。

## いま画面にあるのは誰のデータか

`credits()`は、直前に描いたフレームに、点かタイルを1つ以上提供したソースを、パッケージ自身のものを先にして一覧にします。`painted`の見た目で描かれた天体の表面の画像、天体の上にタイルの窓があるときの細かい地図のタイル、宇宙ビューの位置の計算、そして渡したソースのうち、点やタイルを提供したものです。`creditLine(credits, "en" | "ja")`は、それぞれのライセンスを横に添えた1行にします。「表面の地図：…（CC BY 4.0）／私の小天体（A. Person、2026年）（CC BY-NC 4.0、非営利のみ）」のようになります（英語では、セミコロンでつないで最後にピリオドを付けます）。要素は、ソースの組が変わったときに（毎フレームではなく）`detail: { credits }`つきの`wakusei-creditschange`を送ります。

## オフにする

`remove()`、`removeSource(id)`、`enableSource(id, false)`、`data="own"`は、どれも同じことをします。そのソースの読み込みを中止し（`AbortSignal`）、タイルとレコードを解放し、窓や点を画面から外して、描き直し、出典を取り下げます。絵は最初のものに戻り、もう一度オンにしたソースは、もう一度読み込まれます。

## 上限

- **メモリ。** ビューのタイル全部で、予算は1つです（`TILE_BUDGET_BYTES`）。デコード済みタイルで48 MBで、画像はミップマップを含めて数えます（元のバイト数の4/3）。最後に使われた時刻が最も古いタイルから手放し、いま視野の窓が必要とするタイルは手放しません。収まらない窓は、中途半端に描かず、天体はいまある画像のままです。ビューにあるすべての天体のタイルが、この予算を分け合います。
- **リクエスト。** ソース1つにつき、同時に進む読み込みは最大6件です（`MAX_IN_FLIGHT`）。読み込みが始まるのは、ビューが変わったときだけで、静止しているときは何も送りません。失敗した窓は、ビューが変わるまで再び求めません。タイマーでは求めません。
- **不正なデータ。** 例外を投げる、空で返る、画像でない、サイズが数でないタイルは、ソースブックの`stats().failed`に数えられ、描かれません。数値が有限でない小天体は、除外し、その数を数えます。
- **ライセンス条件。** パッケージ自身のソースは、「非営利のみ」でも「同一条件で共有」でもありません。それはテストで確かめています。使う側のソースはどちらでもかまいません。その場合、出典の行にそう表示されます。

## これまでと変わらないこと

属性も関数も、すべてこれまでどおりです。ソースがなければ、絵は同じもので、同じタイルから描かれ、`credits()`にはパッケージ自身のソースだけが並びます。`tiles`、`texture-base`、`texture-far-base`の意味も変わりません。1つだけ違うのは、作れなかったタイルの窓を、30秒後にもう一度試すことはなくなったことです。ビューが変わったときに、もう一度試します。
