---
title: 空の出来事 (実験的)
section: how-to
order: 37
description: 春分・夏至・秋分・冬至、月の満ち欠け、食 (全球と観測地点)、暦日の出入り、合と衝、最大光度、秤動、月の近点・遠点と交点、最大離角を、任意の peer の astronomy-engine で。0.x では実験的です。
---

`@johnmorrisdotca/wakusei-planets/sky` は「いつ」に答えます。季節がいつ始まるか、月が新月・満月・弦のいつか、どの食がいつ起こり (自分の立つ場所からどう見えるかも)、あなたのタイムゾーンの暦日に天体がいつ出て入るか、惑星がいつ合や衝になるか、金星がどこまで明るくなるか、などです。0.x の間は**実験的**で、名前、探す期間、結果が 1.0 の前に変わることがあります (すべての export に `@experimental` が付いています)。[空のどこに惑星があるか](sky-bodies.md) が「ある瞬間に天体がどこにあるか」を答えるのに対し、この入口は「出来事が起こる瞬間」を見つけます。

これは [astronomy-engine](https://github.com/cosinekitty/astronomy) に型を付けた薄い層で、astronomy-engine は**任意の peer dependency** です。`/sky` を読み込まないページには必要ありません。パッケージのほかの部分もこれには届きません (すべての入口の import の連なりで、テストが確かめています)。

```sh
pnpm add astronomy-engine
```

受け付ける範囲は `>=2.1.19 <3` です。入れていないと、`/sky` を読み込んだ時点で、実行環境自身のエラーで止まり、そのエラーがパッケージ名を示します (Node では `Cannot find package 'astronomy-engine'`、バンドラでは `Could not resolve "astronomy-engine"`)。

```js
import { nextAlignment, riseSetTimes, seasons } from "@johnmorrisdotca/wakusei-planets/sky";

// The equinoxes and solstices of 2026, in UTC: plain Dates, no browser, no clock read. Needs the optional peer: pnpm add astronomy-engine
const year = seasons(2026);

console.log(`Spring equinox ${year.marchEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Summer solstice ${year.juneSolstice.toISOString().slice(0, 16)}Z`);
console.log(`Autumn equinox ${year.septemberEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Winter solstice ${year.decemberSolstice.toISOString().slice(0, 16)}Z`);

// Sunrise and sunset over a calendar day of a time zone (the zone is required): New York on 1 November 2026, the day the clocks go back.
const newYork = { observer: { latitude: 40.7128, longitude: -74.006 }, timeZone: "America/New_York" };
const day = riseSetTimes("sun", Date.UTC(2026, 10, 1, 12), newYork);
const clock = (date) => date.toLocaleTimeString("en-GB", { timeZone: newYork.timeZone, hour: "2-digit", minute: "2-digit" });
console.log(`Sunrise ${clock(day.rise)}, sunset ${clock(day.set)}`);

// Jupiter's opposition: its ecliptic longitude 180 degrees from the Sun's (not the closest approach of two bodies, which /nearest finds).
const opposition = nextAlignment("jupiter", Date.UTC(2026, 0, 1), { kind: "opposition" });
console.log(`Jupiter opposition ${opposition.time.toISOString().slice(0, 16)}Z`);
```

## ここにあるもの

| 関数 | 返すもの | 照らし合わせた相手 |
|---|---|---|
| `seasons(year)` | その年の春分、夏至、秋分、冬至を `Date` (UTC) で | 米国海軍天文台の表: 1900、2000、2026、2050 年の 16 件、最大のずれは 60 秒 (表は分単位) |
| `moonPhases(from, to)`、`nextMoonPhase(from, { phase, within })` | 期間内 (始まりは含み、終わりは含まない) の新月、上弦、満月、下弦、または次の一つを `Date` で | 米国海軍天文台の 2026 年の表: 50 件すべてが順序どおりで、エンジンは表の時刻より 11 から 80 秒後 (表は秒を落としています) |
| `findEclipses(from, to)` | 期間内 (始まりは含み、終わりは含まない) のすべての日食と月食: 種類、食の最大の瞬間、日食では食分の覆い (obscuration)、月食では**本影食分** (半影月食では負) | NASA の 2021 から 2030 年の食の予報: 日食 22 件と月食 22 件のすべてが種類も一致。食の最大は NASA の力学時から 69 秒を引いた時刻に対し、日食は 9 秒以内、月食は 13 秒以内。月食の本影食分は 22 件すべてが NASA の欄から 0.006 以内 |
| `nextRise`、`nextSet`、`nextTransit(body, from, { observer, within })` | 太陽、月、惑星の次の出、入り、子午線通過を、観測者に対して `Date` または `null` で | JPL Horizons の出・南中・入り: 東京での7惑星、2日分。42件すべてが Horizons の時刻の刻み (出と入りは事象の後の最初の分) の中に入る。太陽は `/suncalc` と 10 秒以内で一致 |
| `riseSetTimes(body, date, { observer, timeZone })` | 太陽、月、惑星の出・南中・入りを、IANA タイムゾーンの暦日 1 日分 (時計を変える日は 23 または 25 時間) で。`horizon` は `"crosses"`、または 1 日中出ている・沈んでいる天体では `"above"`・`"below"` (極地)。`timeZone` は必須 | 米国海軍天文台の 1 日用サービス: 2026年の時計変更日 2 日 (ニューヨークの 11 月 1 日と 3 月 8 日)、シドニー (10 月 4 日)、トロムソ (白夜、極夜、1 日中出ている月) の 22 件。最大 28.9 秒 (表は分単位)。台がそのゾーンの暦日の外に置く事象は、ここでは `null` |
| `nextAlignment(body, from, { kind, within })` | 太陽との次の合・衝・矩を**黄経で**: 年鑑や Horizons と同じ見かけの黄経。`{ time, kind, side, inferior }`。2 つの天体の最接近ではない (それは `/nearest`) | JPL Horizons の黄経、5 件 (木星と火星の衝、金星の外合と内合、土星の西矩): 最大 4.7 分。月の合・衝・矩は `nextMoonPhase` と 3 分以内で一致 |
| `nextPeakMagnitude("venus", from)` | 金星が最も明るくなる時刻と、その等級を `{ time, magnitude }` で。**金星のみ**: astronomy-engine がほかの天体に対応していないため (下記) | JPL Horizons の等級、2026年9月14〜30日: 曲線は平ら (3 日間で -4.804) で、その頂点から 1.9 日、0.029 等。エンジンの等級モデルのほうが 0.03 暗い |
| `localSolarEclipse(from, { observer, within })` | 観測者が見られる次の日食を、`partialBegin`、`centralBegin`、`peak`、`centralEnd`、`partialEnd` (NASA の C1、C2、最大、C3、C4) それぞれの時刻とそのときの太陽高度、食の覆い付きで | NASA GSFC の 2026年8月12日の中心線の表、大西洋とスペイン上の 6 地点 (NASA 自身の位置): どれも皆既で、最大は NASA の分から 7.1 秒以内 (エンジンは 6 点とも約 6.5 秒早い)、中心継続時間は 2.2 秒以内、太陽高度は 0.52 度以内 |
| `moonLibration(when)` | 地球の中心から見た月の秤動 (経度方向と緯度方向)、距離、大きさ | JPL Horizons、14日分: 経度は 0.007 度、緯度は 0.024 度、距離は 51 km 以内 (エンジンの月はなめらかに短め)。光学的秤動のみ |
| `lunarApsides(from, to)`、`lunarNodes(from, to)` | 期間内のすべての近地点と遠地点 (距離つき)、黄道面の横切り (昇交点・降交点) | JPL Horizons、2026年11月: 交点は 22 秒以内。近地点と遠地点は、Horizons で距離の変化率がゼロになる時刻から 6〜7 分 (極小は平らです。距離そのものは近地点で 1 km、遠地点で 42 km 以内) |
| `nextGreatestElongation(body, from)` | 水星または金星の次の最大離角: 時刻、角度、側 (`"east"` は宵の側、`"west"` は明けの側) | JPL Horizons の離角の系列、放物線の頂点: 2026年2月の水星は 4 分、0.0005 度以内。2026年8月の金星は 8 分、0.0008 度以内 |

## 新しい関数について

- **暦日。** `riseSetTimes` は `date` を含むそのゾーンの 1 日を、現地の 0 時から次の 0 時まで取ります。`date` はその日のどの瞬間でもかまいません。時計の切り替えで 0 時が飛ぶ日は、その日の最初の瞬間から始まります。`transit` は上の子午線通過で、太陽が地平線の下にあるときも返します (米国海軍天文台は載せません)。`"above"`・`"below"` は、出も入りもない日の昼の真ん中で、天体の中心と屈折つきの地平線を比べて決めます。
- **合・衝・矩。** 水星と金星の合は内合 (`inferior: true`、地球と太陽の間) か外合で、衝と矩はなく、尋ねると例外になります。太陽にもありません。月では、合が新月、衝が満月、矩が弦です。探索は 1 日ずつ進み 0.1 秒に収めるので、`from` の 4 分の 1 秒前までの事象は `from` に在るものとして数えます。`within.days` (既定 850) の中になければ `null` です。
- **最大光度、astronomy-engine の限界。** エンジンが最大光度を見つけられるのは金星だけです。水星の最大は外合 (見えない) で、外惑星と月は衝と満月で最大になり、それは `nextAlignment` と `nextMoonPhase` が返すからです。ほかの天体は、その旨を述べる `RangeError` になります。どの天体のどの瞬間の等級も `skyBody()` にあります。
- **観測地点の日食。** 高度はエンジンが返す、屈折つきの太陽の中心で、接触が地平線の下なら負です。食の一部または全部が見えないことがあります。金環食も同じ方法で求めます (`kind: "annular"`、環の段階は `centralBegin` と `centralEnd`) が、金環食の照合先は確かめていません。
- **月食の食分。** エンジンは返さないので、ラッパーがエンジン自身の影の幾何 (地球の半径に大気 88 km) から求め、テストが NASA の公表欄と照らします。日食の最大点での食分は返さず、覆い (obscuration) だけです。

## 約束事

新しい名前は API の約束の草案 (リポジトリの docs/design/api-conventions.md) に従います。角度は単位の接尾辞なしの度、長さは単位つき、時刻は `Date`、期間内に起こらない出来事は `null` です。古い `skyBodies` の項目には `Deg` の接尾辞が付いていて、1.0 までは両者が異なったままです。

## 既定で選んだもの (John の確認待ち)

この入口は、計画が勧める選択で作ってあります。どれも既定で、John の確認待ちです。

- `./sky` の入口と、任意の peer としての astronomy-engine (`peerDependencies` は `>=2.1.19 <3`、`peerDependenciesMeta` で optional);
- peer がないときは、ふつうの静的 import による実行環境自身のエラー。計画では最上位の `await import()` と専用のエラー文を勧めていましたが、パッケージのサイズ計測は ES2020 が対象で最上位 await を受け付けず (読者の ES2020 のバンドラも同じです)、計画の代案を使っています;
- 結果の型には `Deg` の接尾辞を付けない (`SkyBody` とは異なる);
- 出来事は 0.x の間 `@experimental`;
- 木星の衛星と星座は包まない。このパッケージ自身の衛星はすでにテスト済みで、星座の境界は hoshi-stars のものです。
