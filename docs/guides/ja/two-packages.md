---
title: なぜパッケージが2つあるのか
section: explanation
order: 8
description: wakusei-planets と chikyu-earth がそれぞれ何をするか、どちらを入れればよいか、1つだけで使うときと2つ一緒に使うときを説明します。
---

太陽、惑星、その衛星は、この wakusei-planets にあります。人が暮らす場所としての地球は [chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth) にあります。国、昼と夜、街の明かり、雲、場所の目印、地球を回る人工衛星です。どちらも1つだけで動き、ページが両方を使いたいときは一緒に使えます。

## 決まり

- **chikyu-earth は、地球だけに興味がある人のためのものです。** 地球をくわしく扱うものは、すべてこちらにあります。
- **wakusei-planets は、地球以外の天体と太陽系のためのものです。** 太陽、8つの惑星、準惑星、衛星、ある日にそれぞれがどこにあるか、そしてその間の宇宙です。地球もここにありますが、ほかの天体と同じ1つの天体としてです。大きさ、傾き、自転、軌道の上の位置、宇宙から見た写真です。
- **依存は一方向だけです。** wakusei-planets は chikyu-earth を使ってもよく (任意の依存)、chikyu-earth は wakusei-planets を必要としません。

新しい機能をどちらに入れるかは、「片方のパッケージだけを入れた人が、それでもほしいと思うか」で決めます。世界の国の地図は、木星のことを考えない人もほしがるので chikyu-earth です。今夜の火星の位置は、国を描かない人もほしがるので wakusei-planets です。

## どこに何があるか

| ほしいもの | パッケージ |
|---|---|
| 国の入った地球儀 (地球と同じ速さで回る) | chikyu-earth |
| 地球の昼と夜、街の明かり、雲 | chikyu-earth |
| 場所の目印、地球の上を飛ぶ眺め | chikyu-earth |
| 人工衛星 (宇宙ステーション、地球を回る Starlink) | chikyu-earth |
| 太陽、惑星、準惑星、衛星 (3つの見た目) | wakusei-planets |
| ある日の各天体の位置、極の向き、満ち欠け、環 | wakusei-planets |
| ある場所から見た太陽と月 (日の出、月の出、月相、`/suncalc`) | wakusei-planets |
| 時刻系、暦、恒星時 (`/time`) | wakusei-planets |
| ほかの惑星と同じ見た目で描く地球 | wakusei-planets |
| 中を飛んで回れる太陽系の場面 | chikyu-earth の宇宙ビューから、こちらへ移しているところ |

## wakusei-planets だけを使う

このパッケージは、chikyu-earth がなくてもすべて動きます。地球はほかの天体と同じように描きます。realistic と painted は NASA の Blue Marble の写真で、線画はこのパッケージ自身の輪郭です。

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/earth/+esm"></script>
<wakusei-body body="earth" look="realistic"></wakusei-body>
```

バンドラーを使うときは `npm install @johnmorrisdotca/wakusei-planets` だけです。npm と pnpm は任意の依存を入れません。このパッケージは chikyu-earth をimportしないので、ビルドがそれを求めることはありません (`pnpm test:usage` の確認が、chikyu-earth のない状態で `/earth` をバンドルして描いています)。

## chikyu-earth だけを使う

地球をくわしく扱いたいときは `@johnmorrisdotca/chikyu-earth` だけを入れます。このパッケージはimportしません。使い方は chikyu-earth 自身の README とガイドにあります。

## 2つを一緒に使う

両方を入れます。

```sh
npm install @johnmorrisdotca/wakusei-planets @johnmorrisdotca/chikyu-earth
```

- **地球の線画が、chikyu-earth の国の入った地球儀になります。** `/earth` と一緒に chikyu-earth の要素をimportすると、ページの `<wakusei-body body="earth" look="line">` はすべてそれを描きます。importしなければ、線画の地球はこのパッケージの輪郭のままです。あとから要素が来たときは、地球はそちらに切り替わります。

```js no-check
import "@johnmorrisdotca/chikyu-earth/element";
import "@johnmorrisdotca/wakusei-planets/element";
import "@johnmorrisdotca/wakusei-planets/earth";
```

- **realistic と painted の地球は、このパッケージのままです。** となりのほかの惑星と同じ見た目になります。
- **ページの WebGL は1つです。** どちらのパッケージも kazoku-ui の共有レンダラーで描くので、惑星と地球儀が並ぶページでも、WebGL は1つ、負荷の上限も1つです。
- **宇宙ビュー。** 今は chikyu-earth の `<chikyu-space>` が、このパッケージのペインター (`setBodyPainter`。chikyu-earth のガイド「The real Sun, planets, Pluto and moons」) で太陽と惑星を描いています。太陽系を1か所にまとめるため、このビューはこのパッケージへ移しているところです。移ったら、このガイドと「アップグレード」に切り替え方を書きます。chikyu-earth には地球と人工衛星が残ります。

## なぜ1つにしないのか

ある町の日の出のページ、土星の環についての学校のページ、今夜の空の星図が、世界の国の輪郭や人工衛星の計算まで読み込むべきではありません。国の地図も、惑星の理論まで読み込むべきではありません。2つに分けると、片方だけがほしい人には小さいままです。共有の部分 (レンダラー、表示の操作、テーマと言語) は kazoku-ui から来るので、両方を使っても、それぞれを1つずつ使うより重くなりません。
