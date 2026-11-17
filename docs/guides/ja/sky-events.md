---
title: 空の出来事 (実験的)
section: how-to
order: 37
description: 今は春分・夏至・秋分・冬至。これから増える空の出来事を、任意の peer の astronomy-engine で。0.x では実験的です。
---

`@johnmorrisdotca/wakusei-planets/sky` は「いつ」に答えます。季節がいつ始まるか、そして追加されるにつれて、月の満ち欠け、食、惑星の出入りです。0.x の間は**実験的**で、名前、探す期間、結果が 1.0 の前に変わることがあります (すべての export に `@experimental` が付いています)。[空のどこに惑星があるか](sky-bodies.md) が「ある瞬間に天体がどこにあるか」を答えるのに対し、この入口は「出来事が起こる瞬間」を見つけます。

これは [astronomy-engine](https://github.com/cosinekitty/astronomy) に型を付けた薄い層で、astronomy-engine は**任意の peer dependency** です。`/sky` を読み込まないページには必要ありません。パッケージのほかの部分もこれには届きません (すべての入口の import の連なりで、テストが確かめています)。

```sh
pnpm add astronomy-engine
```

受け付ける範囲は `>=2.1.19 <3` です。入れていないと、`/sky` を読み込んだ時点で、実行環境自身のエラーで止まり、そのエラーがパッケージ名を示します (Node では `Cannot find package 'astronomy-engine'`、バンドラでは `Could not resolve "astronomy-engine"`)。

```js
import { seasons } from "@johnmorrisdotca/wakusei-planets/sky";

// The equinoxes and solstices of 2026, in UTC: plain Dates, no browser, no clock read. Needs the optional peer: pnpm add astronomy-engine
const year = seasons(2026);

console.log(`Spring equinox ${year.marchEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Summer solstice ${year.juneSolstice.toISOString().slice(0, 16)}Z`);
console.log(`Autumn equinox ${year.septemberEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Winter solstice ${year.decemberSolstice.toISOString().slice(0, 16)}Z`);
```

## ここにあるもの

| 関数 | 返すもの | 照らし合わせた相手 |
|---|---|---|
| `seasons(year)` | その年の春分、夏至、秋分、冬至を `Date` (UTC) で | 米国海軍天文台の表: 1900、2000、2026、2050 年の 16 件、最大のずれは 60 秒 (表は分単位) |

## 約束事

新しい名前は API の約束の草案 (リポジトリの docs/design/api-conventions.md) に従います。角度は単位の接尾辞なしの度、長さは単位つき、時刻は `Date`、期間内に起こらない出来事は `null` です。古い `skyBodies` の項目には `Deg` の接尾辞が付いていて、1.0 までは両者が異なったままです。

## 既定で選んだもの (John の確認待ち)

この入口は、計画が勧める選択で作ってあります。どれも既定で、John の確認待ちです。

- `./sky` の入口と、任意の peer としての astronomy-engine (`peerDependencies` は `>=2.1.19 <3`、`peerDependenciesMeta` で optional);
- peer がないときは、ふつうの静的 import による実行環境自身のエラー。計画では最上位の `await import()` と専用のエラー文を勧めていましたが、パッケージのサイズ計測は ES2020 が対象で最上位 await を受け付けず (読者の ES2020 のバンドラも同じです)、計画の代案を使っています;
- 結果の型には `Deg` の接尾辞を付けない (`SkyBody` とは異なる);
- 出来事は 0.x の間 `@experimental`;
- 木星の衛星と星座は包まない。このパッケージ自身の衛星はすでにテスト済みで、星座の境界は hoshi-stars のものです。
