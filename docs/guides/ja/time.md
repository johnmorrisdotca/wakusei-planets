---
title: 時刻
section: how-to
order: 14
description: ユリウス日、暦、時刻系、恒星時、火星の時刻。数キロバイトで、依存はありません。
---

`/time` には、空の計算に必要な時計の知識がすべて入っています。ユリウス日 ([julian](https://www.npmjs.com/package/julian) パッケージの関数も同じ名前で)、グレゴリオ暦とユリウス暦、うるう秒を含む時刻系 (UTC、UT1、TAI、GPS、TT、TDB)、恒星時、火星の時刻です。どこでも動き、自分以外は読み込まず、gzip で約3 kB です。

時刻は `Date` か、1970年からのミリ秒です。これは JavaScript が数える UTC で、うるう秒は数えません。`Date` は書き換えません。無効な値は、その値を入れた `RangeError` になります。

```ts
import { convertTimeScale, fromCalendar, greenwichMeanSiderealTime, marsSolDate, toCalendar, toJulianDate } from "@johnmorrisdotca/wakusei-planets/time";

const sputnik = Date.UTC(1957, 9, 4, 19, 26, 24);
console.log(toJulianDate(sputnik).toFixed(2));                       // 2436116.31
console.log(toCalendar(sputnik).day, new Date(fromCalendar({ year: 333, month: 1, day: 27 }, "julian")).toISOString());
console.log((convertTimeScale(Date.UTC(2026, 10, 7), "utc", "tt") - Date.UTC(2026, 10, 7)) / 1000);   // 69.184
console.log((greenwichMeanSiderealTime(Date.UTC(1987, 3, 10)) / 15).toFixed(4), marsSolDate(Date.UTC(2021, 1, 18, 20, 55)).toFixed(1));
```

## ユリウス日

| 関数 | 返すもの |
|---|---|
| `toJulianDate(when)` と `fromJulianDate(jd)` | 数値のユリウス日と、その逆 |
| `julian(when)` と `toDate(jd)` | 小数6桁の文字列のユリウス日と、`Date` に戻す関数 (julian パッケージのもの) |
| `toJulianDay(when)`、`toMillisecondsInJulianDay(when)`、`fromJulianDayAndMilliseconds(day, ms)` | ユリウス通日 (正午に始まる) とその中のミリ秒、桁を失わずに戻す関数 |
| `modifiedJulianDate(when)` | ユリウス日から 2,400,000.5 を引いたもの |
| `julianCenturies(when, scale?)`、`julianMillennia(when, scale?)` | J2000.0 からの世紀数と千年紀数。`scale` が `"utc"` でなければ地球時 |
| `J2000_JD`、`J2000_MS`、`B1950_JD`、`UNIX_EPOCH_JULIAN_DATE` | 元期 |

240万台のユリウス日を1つの数にすると、ミリ秒の約10分の1の精度しか残りません。大事なときは `toJulianDay` と `toMillisecondsInJulianDay` の組を持ってください。`fromJulianDayAndMilliseconds` は、どの時刻でも同じミリ秒に戻します。

### julian から移るとき

同じ名前を `/time` から import してください。`julian(date)`、`toDate`、`toJulianDay`、`toMillisecondsInJulianDay`、`fromJulianDayAndMilliseconds` は、1969年12月31日の正午以降のどの時刻でも julian と同じ答えを返し、ミリ秒の数値も受け取れます。それより前の時刻では、julian は 0 に向かって切り捨てるため、日が1つ大きく、ミリ秒が負になります。ここでは日は切り下げで、ミリ秒は常に 0 から1日の間です。だから `fromJulianDayAndMilliseconds(toJulianDay(t), toMillisecondsInJulianDay(t))` はどの時刻でも `t` に戻ります (julian の README が約束していることです)。`julian()` の文字列は、どの時刻でも同じです。`toDate` は1ミリ秒未満を四捨五入しますが、julian は `Date` に切り捨てさせます。

## 暦

`toCalendar(when, calendar?)` と `fromCalendar(civil, calendar?)` は、時刻と、UTC の年・月・日・時・分・秒・ミリ秒を行き来します。暦は `"auto"` (既定: 1582年10月4日まではユリウス暦、10月15日からはグレゴリオ暦)、または全期間に使う `"gregorian"` と `"julian"` です。年は天文学の数え方で、紀元前1年が 0、紀元前2年が -1 です。`Date` が扱える範囲 (-271821年から275760年) で動きます。

```ts
import { dayOfWeek, dayOfYear, daysInMonth, fromCalendar, isLeapYear, toCalendar } from "@johnmorrisdotca/wakusei-planets/time";

console.log(toCalendar(fromCalendar({ year: 1582, month: 10, day: 4 }) + 86_400_000));   // 1582年10月15日: 間の10日はありません
console.log(dayOfWeek(Date.UTC(1954, 5, 30)), dayOfYear(Date.UTC(1988, 3, 22)), daysInMonth(1582, 10), isLeapYear(1900), isLeapYear(1900, "julian"));
```

存在しない日 (4月31日、平年の2月29日、`auto` での1582年10月5日から14日) は、日付を入れた `RangeError` になります。`dayOfWeek` は日曜日が 0 です。

## 時刻系

| 時刻系 | 意味 | UTC からの差 |
|---|---|---|
| `utc` | 時計の時刻。JavaScript はうるう秒を数えません | 0 |
| `ut1` | 地球の自転による時刻。UTC との差は 0.9秒以内 | `dut1` (IERS の値。省くと 0) |
| `tai` | 原子時 | うるう秒の合計。1972年は10秒、2017年から37秒 |
| `gps` | GPS 時 | TAI より19秒前 (2017年から UTC より18秒先) |
| `tt` | 地球時。惑星の理論が使う時刻 | TAI に 32.184秒を足したもの。2017年から 69.184秒 |
| `tdb` | 太陽系重心力学時 | TT に最大1.7ミリ秒の項を足したもの |

`convertTimeScale(when, from, to, { dut1 })` は、どの2つの時刻系の間でも時刻を移します。返る数は移した先の時刻系の時計で読んだ値なので、差を足すか引くだけです。`deltaT(when, dut1?)` は TT − UT1 の秒数、`taiMinusUtc` と `ttMinusUtc` は差、`tdbMinusTt` は小さな項です。

数値の出どころ: うるう秒は IERS の Bulletin C で、1972年から正確です。1972年より前は、Espenak と Meeus (NASA) の式の ΔT です。2017年の最後のうるう秒より後は、JPL Horizons と同じく 69.184秒のままにしています。これからのうるう秒はわからないからです。地球の自転は遅くなっているので、ΔT の予測では2050年には数秒以上大きくなります。UT1 は、`dut1` (IERS が毎週出しています) を渡さなければ UTC と同じ値です。

## 恒星時

`greenwichMeanSiderealTime(when, dut1?)`、`greenwichApparentSiderealTime(when, dut1?)`、`localSiderealTime(when, longitude, { apparent?, dut1? })` は、星に対する地球の自転を 0 から 360 の度で返します (15 で割ると時間)。見かけの恒星時は分点差 `equationOfTheEquinoxes(when)` (最大で約1秒) を足したものです。Meeus の計算例とは100分の1秒 (平均恒星時)、astronomy-engine とは1000分の1度で一致します。

## 火星の時刻

`marsSolDate(when)`、`coordinatedMarsTime(when)` (火星の本初子午線の、0 から 24 の時間)、`marsLocalMeanSolarTime(when, longitude)` は Allison と McEwen (2000) に従います。1ソルは 88,775.244秒です。キュリオシティは、ゲール・クレーターに現地の平均太陽時で約15時に着陸しました。テストでこれを確かめています。

## ここにないもの

将来のうるう秒、2017年より先の ΔT の予測、アト秒からギガ年までの単位換算はありません。UT1 には IERS 自身の数値が必要で、それは毎週変わるので同梱していません。
