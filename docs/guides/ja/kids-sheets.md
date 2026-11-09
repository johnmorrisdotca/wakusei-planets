---
title: こどもの ぬりえ
section: how-to
order: 20
description: 太陽・惑星・大きな衛星の印刷できるぬりえです。太い線、本当の色、3つのことがらがついています。A4 と US レター、英語と日本語、できあがりの PDF もあります。
---

`/sheets` は、太陽、8つの惑星、冥王星、月、イオ、エウロパ、ガニメデ、カリスト、タイタン、トリトン、カロンのぬりえを1まいずつ作ります。すべての惑星を同じ縮尺で一列にならべたぬりえも1まいあります。ぬりえは、色をぬる子どものためのものです。太い黒い線の大きな絵 (まわりの線は1.2 mm、中の線は1 mm)、その天体の本当の色の四角と名前、大きな字の3つのことがらがのっています。絵はパッケージ自身の数値 (大きさ、傾き、リング、地形) からかいていて、だれかの絵をなぞったり写したりはしていません。ことがらも同じ数値から計算しています。

絵のまわり (ブランド「Space Program X」、パッケージ名、タイトル、「なまえ:」のらんがあるヘッダーと、クレジット、バージョン、日付、デモへの QR コードがあるフッター) は kazoku-ui の印刷パートで、`kid` (こども用) の文字です。名前は 28 pt、本文は 18 pt、線は 1.2 mm です。

## できあがりの PDF

どのぬりえも、A4 と US レター、英語と日本語の PDF があります。デモといっしょに CI で作って公開しています。[英語の一覧](https://johnmorrisdotca.github.io/wakusei-planets/pdf/)と[日本語の一覧](https://johnmorrisdotca.github.io/wakusei-planets/pdf/ja.html)です。どれも1ページです。

## デモ

[ぬりえのページ](https://johnmorrisdotca.github.io/wakusei-planets/kids.html)で、印刷されるとおりのぬりえを見られます。天体 (またはすべての惑星) と紙をえらんで、「いんさつ / PDFで ほぞん」をおします。ブラウザの印刷画面から PDF にほぞんできるので、PDF 用のライブラリはいりません。ページの言語 (ヘッダーの言語ボタン) がぬりえの言語になります。

## 自分のページで

```ts
import { KIDS_SHEETS, kidsFacts, kidsRoom, kidsSvg } from "@johnmorrisdotca/wakusei-planets/sheets";

console.log(KIDS_SHEETS.length, "sheets:", KIDS_SHEETS.slice(0, 4).join(", "), "...");
console.log(kidsFacts("saturn", "en").join(" "));

const room = kidsRoom("letter");
const svg = kidsSvg("saturn", { ...room, lang: "ja" });
console.log(svg.length > 1000, svg.includes("ぬってね！"));
```

`kidsSvg(id, { widthMm, heightMm, lang })` は、ぬりえの SVG 1つです。単位はミリメートルなので、絵の1ミリは紙の1ミリです。ブラウザはいりません。`kidsRoom(page, orientation)` は、ページの本文の広さの見つもりです (A4 と Letter で測った値)。

印刷するときは `kidsSheet` でページ全体を作ります。ページの本文の本当の広さをはかる (ぬりえを一瞬、見えないところに置いてはかる) ので、絵は印刷されるとおりの大きさでかかれます。

```ts no-run
import { printCss, printSheet } from "@johnmorrisdotca/kazoku-ui/print";
import { kidsLayout, kidsSheet } from "@johnmorrisdotca/wakusei-planets/sheets";

const options = { page: "letter", language: "ja" } as const;
const style = document.createElement("style");
style.textContent = printCss(kidsLayout("mars", options));
document.head.append(style);

const sheet = kidsSheet("mars", options);
document.body.append(sheet);
document.querySelector("#print")?.addEventListener("click", () => printSheet(sheet));
```

`kidsLayout` は `printCss` に、紙、向き (すべての惑星のぬりえは横向きで印刷します)、文字の大きさをわたします。`page` は `a4`、`letter`、`a3`、`tabloid` です。

## ぬりえにのっているもの

- **絵。** 天体のまわりの線と大きな地形です。しま (木星、土星、海王星)、暗い地域 (月、火星)、クレーター、ひび (エウロパ)、地球の陸、冥王星のハート、土星と天王星のリングなどです。ぬるには小さすぎる地形は大きくするか、はぶきます。2つの地形は重ねません。太陽には光線があります。
- **ぬってね！** その天体の本当の色の四角が2〜4つ、名前つきでならびます。
- **3つのことがら。** 惑星は、よこはばと地球とのくらべ、自転にかかる時間、太陽を1しゅうする時間です。衛星は、よこはば、惑星を1しゅうする時間、惑星に見せている面です。太陽は、よこはば、自転にかかる時間、地球からのきょりです。よこはばは3けたまで、年の長さは軌道の大きさから計算しています (ケプラーの第三法則)。
- **すべての惑星。** 8つの惑星を同じ縮尺で一列にならべ、下に番号を、そのしたに名前を順番にならべます。3つのことがらのひとつは、この縮尺だと太陽がどれだけ大きいかです。

日本語はやさしいことばで、ほとんどひらがなです。名前は、読み (ひらがな) のあとのかっこに漢字を入れています。

## テスト

ぬりえは、ブラウザなしで (すべてのぬりえ、すべての紙、2つの言語、線の太さ、ことがらと数値、文字と広さ、ならべたぬりえの縮尺)、そして Chromium と WebKit で (ページ、印刷用のコピー、印刷されるとおりの大きさの絵) テストしています。Chromium では、すべてのぬりえを A4、Letter、A3、Tabloid の PDF にして、紙の大きさとページ数を調べます。どれも1ページです。
