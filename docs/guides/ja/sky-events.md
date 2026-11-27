---
title: 空の出来事 (実験的)
section: how-to
order: 37
description: 春分・夏至・秋分・冬至、月の満ち欠け、食 (世界全体と観測地点ごと)、暦日ごとの天体の出入り、合と衝、最大光度、秤動、月の近地点・遠地点と交点、最大離角を、任意の peer の astronomy-engine で。0.x では実験的です。
---

`@johnmorrisdotca/wakusei-planets/sky` は「いつ」に答えます。季節がいつ始まるか、月がいつ新月、満月、上弦・下弦になるか、どの食がいつ起こるか (自分の立つ場所からどう見えるかも)、自分のタイムゾーンの暦日に天体がいつ出ていつ沈むか、惑星がいつ合や衝になるか、金星がどれだけ明るくなるか、月の秤動、近地点・遠地点、交点、水星と金星の最大離角、などです。0.x の間は**実験的**で、名前、探す期間、結果が 1.0 の前に変わることがあります (すべての export に `@experimental` が付いています)。[空のどこに惑星があるか](sky-bodies.md) が「ある瞬間に天体がどこにあるか」を答えるのに対し、この入口は「出来事が起こる瞬間」を見つけます。

これは [astronomy-engine](https://github.com/cosinekitty/astronomy) に型を付けた薄い層で、astronomy-engine は**任意の peer dependency** です。`/sky` を読み込まないページには必要ありません。パッケージのほかの部分が `/sky` を読み込むこともありません (すべての入口の import の依存関係をたどって、テストが確かめています)。

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
| `seasons(year)` | その年の春分、夏至、秋分、冬至を `Date` (UTC) で | 米国海軍天文台の表: 1900、2000、2026、2050年の 16件、最大のずれは 60秒 (表は分単位) |
| `moonPhases(from, to)`、`nextMoonPhase(from, { phase, within })` | 期間内 (始まりは含み、終わりは含まない) の新月、上弦、満月、下弦、または次の一つを `Date` で | 米国海軍天文台の 2026年の表: 50件すべてが順序どおりで、エンジンは表の時刻より 11 から 80秒後 (表は秒を落としています) |
| `moonAge(when)` | 直前の新月からの日数。国立天文台の正午月齢は、この日数を日本時間の正午で取り、小数第1位に四捨五入したもの | 暦象年表 令和8年 (2026) の1月の正午月齢: 1日は 12.1、18日は 29.1、19日は 0.3、31日は 12.3 |
| `moonLunation(when)` | ブラウンの朔望月番号。1923年1月17日の新月を 1 として、いまの朔望月が何番目か。番号は新月のたびに進む。この新月より前は 0 と負の数 | 2000年1月6日の新月は 953。2026年1月18日の新月は 1275。その1時間前は 1274。1923年1月16日の正午は 0 |
| `moonPhaseName(when, "en" \| "ja")` | 周期を8等分した姿の英語名。日本語は国立天文台が呼び名を付けている姿だけ (新月、三日月、上弦、満月、下弦)。上弦と満月の間の月、満月と下弦の間の月、東側が細く光っている月は、表に呼び名がないので `null` | 呼び名は国立天文台の「月はいつどんなふうに見える？」の表。姿の境は、エンジンの位相角を、周期を8等分した位置で区切ったもの |
| `findEclipses(from, to)` | 期間内 (始まりは含み、終わりは含まない) のすべての日食と月食: 種類、食の最大の瞬間、日食では太陽の欠けた面積の割合 (obscuration)、月食では**本影食分** (半影月食では負) | NASA の 2021 から 2030年の食の予報: 日食 22件と月食 22件のすべてで種類が一致。食の最大は NASA の力学時から 69秒を引いた時刻に対し、日食は 9秒以内、月食は 13秒以内。月食の本影食分は 22件すべてが NASA の欄から 0.006 以内 |
| `nextRise`、`nextSet`、`nextTransit(body, from, { observer, within })` | 太陽、月、惑星の次の出、入り、子午線通過を、観測者に対して `Date` または `null` で | JPL Horizons の出・南中・入り: 東京での7惑星、2日分。42件すべてが Horizons の時刻の刻み (出と入りは事象の後の最初の分) の中に入る。太陽は `/suncalc` と 10秒以内で一致 |
| `riseSetTimes(body, date, { observer, timeZone })` | 太陽、月、惑星の出・南中・入りを、IANA タイムゾーンの暦日 1日分 (通常は 24時間、夏時間の切り替え日は 23 または 25時間) で。`horizon` は `"crosses"`、または 1日中出ている・沈んでいる天体では `"above"`・`"below"` (極地)。`timeZone` は必須 | 米国海軍天文台の 1日用サービス: 2026年の夏時間の切り替え日 2日 (ニューヨークの 11月 1日と 3月 8日)、シドニー (10月 4日)、トロムソ (白夜、極夜、1日中出ている月) の 22件。最大 28.9秒 (表は分単位)。米国海軍天文台がそのタイムゾーンの暦日の外に置く事象は、ここでは `null` |
| `bestTimeToLook(body, date, { observer, timeZone })` | その暦日で見るのにいちばんよい瞬間。天体が地平線の上にあり、太陽の中心が地平線から 6度以上下がっているあいだ（常用薄明の終わり）で、天体がいちばん高いとき。その区間に南中が入るときは南中、入らないときは南中に近い端。暗い空に出ていない日は `null`。太陽は例外を投げる（暗い空を背景にして見る天体だから） | 2026年1月15日、バンクーバーから見た木星: いちばんよい時刻は南中で、太陽は地平線の約 60度下。緯度89度の6月21日は暗い空がないので `null` |
| `nextSolarTransit(body, from)` | 水星または金星の次の太陽面通過（地球の中心から見て、太陽の面を横切るとき）。始まり、中心どうしがいちばん近づく瞬間、終わり、中心どうしの最小の角距離 (分角)。ほかの天体は例外を投げる。南中 (`nextTransit`) ではない | 2019年11月11日の水星と2012年6月6日の金星: 中心どうしがいちばん近づく瞬間は、NASA が分単位で示している時刻 (15:19 と 01:29 UTC) から2分以内 |
| `nextAlignment(body, from, { kind, within })` | 太陽との次の合・衝・矩を**黄経で**: Astronomical Almanac や Horizons と同じ見かけの黄経。`{ time, kind, side, inferior }`。2 つの天体の最接近ではありません (それは `/nearest` が求めます) | JPL Horizons の黄経、5件 (木星と火星の衝、金星の外合と内合、土星の西矩): 最大 4.7分。月の合・衝・矩は `nextMoonPhase` と 3分以内で一致 |
| `nextPeakMagnitude("venus", from)` | 金星が最も明るくなる時刻と、その等級を `{ time, magnitude }` で。**金星のみ**: astronomy-engine がほかの天体に対応していないため (下記) | JPL Horizons の等級、2026年9月14〜30日: 曲線は平ら (3日間で -4.804) で、その頂点から 1.9日、0.029 等。エンジンの等級モデルのほうが 0.03 暗い |
| `localSolarEclipse(from, { observer, within })` | 観測者が見られる次の日食を、`partialBegin`、`centralBegin`、`peak`、`centralEnd`、`partialEnd` (NASA の C1、C2、最大、C3、C4) それぞれの時刻とそのときの太陽高度、太陽の欠けた面積の割合 (obscuration) つきで | NASA GSFC の 2026年8月12日の中心線の表、大西洋とスペイン上の 6 地点 (NASA 自身の位置): どれも皆既で、最大は NASA の表の時刻 (分単位) から 7.1秒以内 (エンジンは 6 点とも約 6.5秒早い)、中心食の継続時間は 2.2秒以内、太陽高度は 0.52度以内 |
| `moonLibration(when)` | 地球の中心から見た月の秤動 (経度方向と緯度方向)、距離、大きさ | JPL Horizons、14日分: 経度は 0.007度、緯度は 0.024度、距離は 51 km 以内 (エンジンの月はなめらかに短め)。光学的秤動のみ |
| `lunarApsides(from, to)`、`lunarNodes(from, to)` | 期間内のすべての近地点と遠地点 (距離つき)、黄道面の横切り (昇交点・降交点) | JPL Horizons、2026年11月: 交点は 22秒以内。近地点と遠地点は、Horizons で距離の変化率がゼロになる時刻から 6〜7分 (極値の近くは平らです。距離そのものは近地点で 1 km、遠地点で 42 km 以内) |
| `nextGreatestElongation(body, from)` | 水星または金星の次の最大離角: 時刻、角度、側 (`"east"` は東方で夕方の空、`"west"` は西方で明け方の空) | JPL Horizons の離角の系列、放物線の頂点: 2026年2月の水星は 4分、0.0005度以内。2026年8月の金星は 8分、0.0008度以内 |

## 新しい関数について

- **暦日。** `riseSetTimes` は `date` を含むそのゾーンの 1日を、現地の 0 時から次の 0 時まで取ります。`date` はその日のどの瞬間でもかまいません。時計の切り替えで 0 時が飛ぶ日は、その日の最初の瞬間から始まります。`transit` は南中 (上方の子午線通過) で、太陽が地平線の下にあるときも返します (米国海軍天文台は載せません)。`"above"`・`"below"` は、出も入りもない日のその日の真ん中の時刻に、天体の中心と大気差を含めた地平線を比べて決めます。
- **合・衝・矩。** 水星と金星の合は内合 (`inferior: true`、地球と太陽の間) か外合で、衝と矩はなく、指定すると例外を投げます。太陽にもありません。月では、合が新月、衝が満月、矩が上弦・下弦です。探索は 1日刻みで進み、0.1秒の精度まで絞り込むので、`from` の 4分の 1秒前までの事象は `from` の時刻にあるものとして数えます。`within.days` (既定 850) の中になければ `null` です。
- **最大光度、astronomy-engine の限界。** エンジンが最大光度を見つけられるのは金星だけです。水星の最大は外合のとき、外惑星と月の最大は衝と満月のときで、それは `nextAlignment` と `nextMoonPhase` が返すからです。ほかの天体は、そう伝える `RangeError` を投げます。どの天体のどの瞬間の等級も `skyBody()` にあります。
- **観測地点の日食。** 高度は、エンジンが返す大気差を含めた太陽の中心の高度で、接触が地平線の下なら負です。食の一部または全部が見えないことがあります。金環食も同じ方法で求めます (`kind: "annular"`、環の段階は `centralBegin` と `centralEnd`) が、金環食については、照らし合わせる基準を確かめていません。
- **月食の食分。** エンジンは返さないので、このパッケージがエンジン自身の影の形 (地球の半径に大気の層の 88 km を加えたもの) から求め、テストが NASA の公表している表の列と照らします。日食では最大の瞬間の食分は返さず、欠けた面積の割合 (obscuration) だけです。

## 約束事

新しい名前は API の約束事の草案 (リポジトリの docs/design/api-conventions.md) に従います。角度は単位の接尾辞なしの度、長さは単位つき、時刻は `Date`、期間内に起こらない出来事は `null` です。古い `skyBodies` の項目には `Deg` の接尾辞が付いていて、1.0 までは両者が異なったままです。

## 既定値

この入口の選択は次のとおりです。

- `./sky` の入口と、任意の peer としての astronomy-engine (`peerDependencies` は `>=2.1.19 <3`、`peerDependenciesMeta` で optional)。
- peer がないときは、ふつうの静的 import による実行環境自身のエラー。トップレベルの `await import()` と専用のエラー文のほうが親切ですが、パッケージのサイズ計測は ES2020 が対象でトップレベル await を受け付けず (読者の ES2020 のバンドラーも同じです)、使えません。
- 結果の型には `Deg` の接尾辞を付けない (`SkyBody` とは異なる)。
- 出来事は 0.x の間 `@experimental`。
- 木星の衛星と星座は、このパッケージでは扱わない。このパッケージ自身の衛星はすでにテスト済みで、星座の境界は hoshi-stars のものです。
