---
title: アーキテクチャ
section: explanation
order: 10
description: 事実、位置、線画、陰影つきの見た目、要素がどう組み合わさっているか、そして純粋な部分がどこでも動く理由を説明します。
---

Wakusei Planets は層になっていて、いちばん下の層はブラウザーのことを何も知りません。線画はただの文字列で、陰影つきの天体は同じ数値をシェーダーに渡したものです。

## 層

| 層 | 場所 | 内容 |
| --- | --- | --- |
| 事実 | `src/facts.ts` | 各天体の実際の大きさ、扁平率、自転軸の傾き、極、自転、色、表面の特徴。 |
| 位置 | `src/ephemeris.ts`、`src/data/orbits.ts` | 惑星の位置、衛星の母惑星まわりの位置、ある時刻に地球から見た天体の向き。 |
| 描画 | `src/pose.ts`、`src/line.ts` | `portrait` と `lineSvg`：向きを決め、SVG の文字列にします。 |
| 動く絵 | `src/live.ts`、`src/gate.ts` | 回る天体の計算を低い頻度で行い、フレームを毎秒30回までに抑えます。 |
| 見た目 | `src/scene/` | シェーダーのコード、天体ごとのレシピ、輪、three.js 用のオブジェクト。 |
| 天体ごと | `src/bodies/` | `jupiter.ts`、`saturn.ts`、衛星：それぞれが自分の見た目を登録します。 |
| 要素 | `src/element.ts`、`src/embed.ts` | `<wakusei-body>` と `embedCode`。 |

最初の4行は**純粋**です。同じ引数からは同じマークアップができ、ブラウザーなしで読み込めます。DOM が必要なのは要素とシーンのコードだけで、three.js が必要なのは陰影つきの見た目だけです。

```ts
import { apparent, BODIES, lineSvg } from "@johnmorrisdotca/wakusei-planets";

const saturn = apparent("saturn", Date.UTC(2026, 10, 2));
console.log(BODIES.saturn.radiusKm, saturn.subObserverLat.toFixed(1));
console.log(lineSvg("saturn", { size: 120, time: Date.UTC(2026, 10, 2) }).startsWith("<svg"));
```

## すべての見た目で同じ向き

日付が決まると、パッケージは見る人の座標系（x は右、y は上、z は手前）での極、本初子午線、太陽の方向を求めます。線画とシェーダーは同じ向きを使うので、線画と陰影つきで傾きが食い違うことはありません。光が届くまでの時間も考慮します。

```ts
import { portrait } from "@johnmorrisdotca/wakusei-planets";

const pose = portrait("uranus");
console.log(pose.pole.map((n) => n.toFixed(2)).join(", "));
```

## 天体ごとのエントリーポイント

陰影つきの見た目は、ひとつの天体のコードとデータです。土星だけを描くページにすべての天体を配るのは無駄なので、天体ごとに別のインポート（`/saturn`、`/jupiter`、`/moons-jupiter`）があり、`/all` はすべてを読み込みます。エントリーポイントの仕事はひとつで、天体のシェーダーと地図を `registerLook` で登録することです。要素は天体の名前で見た目を探します。エントリーポイントを読み込んでいない天体は、その色で照らした素朴な球として描かれます。

見た目の表は `globalThis` にあります。CDN のバンドラーはエントリーポイントごとにファイルの複製を作ることがあり、複製どうしでも見た目を共有しなければならないからです。

## ページにはWebGLコンテキストがひとつ

陰影つきの `<wakusei-body>` は、どれも kazoku-ui のレンダラーをページでひとつだけ使います。選ばれている天体が動き、ほかは止まった絵になります（`live="hover"` は、指した天体にコンテキストを渡します）。最後の要素がなくなると、レンダラーは解放されます。何も変わらない間は何も描きません。動く絵は毎秒30回まで描き、キャンバスは1辺4096ピクセル、合計600万ピクセルまでに抑えます。

```ts
import { BODIES, MOONS_OF } from "@johnmorrisdotca/wakusei-planets";

const bodies = Object.keys(BODIES).length;
const moons = Object.values(MOONS_OF).reduce((sum, list) => sum + list.length, 0);
console.log(bodies, "bodies;", moons, "moons");
```

## 動く絵はほとんど前の計算の延長

向きと衛星は約1秒に1回、一から計算し直します。その間は、天体の自転と各衛星の母惑星まわりの動きを、その結果から先へ進めるだけです。そのため1フレームの費用は、ベクトルを数回回す程度です。天体暦の計算は一度もしません（`src/live.ts`）。

## 自分のシーンで

`painter.make` は、天体を半径1のオブジェクトとして、自分の three.js のシーンに渡します。シーン自身の座標軸で照らされ、レンダラー、ループ、時計は持ちません。置く、大きさを決める、照らす、`update` を呼ぶといったことは、呼び出す側で行います。[自分の three.js シーンで使う](in-your-own-scene.md)を参照してください。

## データ

大きさ、扁平率、極、自転は IAU の値と NASA の資料です。水星から海王星の位置は VSOP87B を短くしたもの、冥王星は Horizons に合わせた表、月の位置は月理論 ELP2000-82B を大きい540項に短くしたもの、ほかの衛星は JPL Horizons の位置に合わせた軌道です。衛星の表は `scripts/make-moon-data.py` が作り、手では編集しません。`test/accuracy.test.ts` が、すべての天体を限度の中に保ちます ([精度](accuracy.md))。出典のない事実は、推測せずに省きます。出どころは[しくみ](how-it-works.md)にあります。

## 科学計算の座標系とモデルの選択

時計は UTC を TT に変換します。`src/sidereal.ts` は平均黄道傾斜、IAU 1980 の章動項、折り返す前の平均恒星時角を一か所で定義します。`src/sky/frames.ts` は、J2000 平均黄道座標 → J2000 平均赤道座標 → 日付の平均赤道座標（IAU 1976 歳差）→ 日付の真赤道座標（章動）の回転を担当します。月理論の ELP 黄道歳差は別のモデルなので、赤道歳差と統合しません。

空の計算エンジンは必要な光行差・光行時間を加え、地表観測者の視差、真赤道座標から地平座標への回転を行います。大気差は独立した計算です。`/coordinates` は対応する**平均**座標系だけを回転し、地平座標には平均恒星時を使います。視差・章動・大気差を追加しません。SunCalc 1 と 2 の単位、方位角の原点、起きない現象の表現、一日の定義は各ラッパーに置き、科学計算エンジンはラッパーを読み込みません。

`CoordinateObserver` とエンジンの `Observer` は同じ型です。緯度・経度は測地座標の度数、任意の `heightM` は WGS 84 楕円体からのメートルです。赤経・赤緯は度数の方向型を共有し、距離は `distanceKm` または `distanceAu` と明記します。`/coordinates` は高さを検証するだけで回転には使いません。空のエンジンは視差に使います。互換性のため、SunCalc の `getTimes` は同じ入力値を見える地平線からの高さとして地平線の伏角にも使います。ジオイドや地形の補正は推測しません。二つの高さ基準を同じとするのは従来の近似であり、自動変換ではありません。

```ts
import { heliocentric } from "@johnmorrisdotca/wakusei-planets";

const when = Date.UTC(2026, 10, 7);
console.log(heliocentric.model("ceres", when));
await import("@johnmorrisdotca/wakusei-planets/tables/ceres");
console.log(heliocentric.model("ceres", when));
```

`heliocentric.model(body, milliseconds)` は、**現在**登録されている表と TT の区間範囲に基づき、位置を返す理論を報告します。水星から海王星は `vsop87b`、冥王星は内蔵の `chebyshev` 表を優先します。登録された準惑星の表は範囲内でだけ使います。範囲外では準惑星が `osculating-elements`、冥王星が `approximate-elements` に戻ります。表を読み込んだ後や時刻を変えた後は再照会してください。位置と読み込みの動作は変わらず、この照会が任意の表を読み込むこともありません。

`worstArcseconds` はフィットに使わず保留した標本で測った最大誤差で、全日付の保証ではありません。冥王星は 0.14637″ です。VSOP87B と軌道要素による代替計算には対応する保留標本の上限がないため `null` を返します。[精度比較](accuracy.md) は Horizons に対する別の疎な日付集合の測定で、こちらも全期間の最大誤差を保証しません。
