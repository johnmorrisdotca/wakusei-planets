---
title: 月と火星の周回機
section: how-to
order: 18
description: "月と火星を周回する13機の探査機が、ある時刻にどこにいるか。JPL Horizonsに合わせた平均軌道要素から求め、数値と各機の情報を添え、どの経路が追跡ずみで、どれがモデルで、どれがないかを正直に示します。"
---

`/orbiters` は、月と火星のまわりで働く探査機を知っています。月はルナー・リコネサンス・オービター、チャンドラヤーン2号、ダヌリ、ARTEMIS P1とP2、キャップストーン。火星はマーズ・リコネサンス・オービター、2001マーズ・オデッセイ、メイヴン、マーズ・エクスプレス、エクソマーズ・トレース・ガス・オービター、ホープ、天問1号です。それぞれについて、ある時刻の位置、数値、分かっていることを返します。深宇宙の探査機 (ボイジャー、ニュー・ホライズンズ、ウェッブなど) は[探査機](spacecraft.md)に、地球の人工衛星は chikyu-earth にあります。

```ts
import { ORBITER_IDS, orbiterFacts, orbiterNumbers, orbiterPosition, orbiterStatus } from "@johnmorrisdotca/wakusei-planets/orbiters";

const now = Date.UTC(2026, 10, 11, 12);
for (const id of ORBITER_IDS) {
  const facts = orbiterFacts(id);
  const numbers = orbiterNumbers(id, now);
  console.log(facts.name.ja, facts.centre, orbiterStatus(id, now), numbers ? `高度 ${numbers.altitudeKm.toFixed(0)} km、${numbers.speedKmS.toFixed(2)} km/s` : "経路なし");
}
const [x, y, z] = orbiterPosition("lro", now);
console.log("LROは月の中心から", Math.hypot(x, y, z).toFixed(0), "km");
```

## 経路はどこから来るか

経路は、天体をまわるケプラーの楕円で、昇交点と近点が決まった速さで動きます。1機あたり9つの数で、`scripts/make-orbiter-data.py` が JPL Horizons の経路データに合わせて求めます。読み取った日の直前の数日分 (低い軌道は7日、マーズ・エクスプレスとホープは10日、ARTEMISは14日) に合わせます。スクリプトは Mac から手で動かします。月に1回ほど、または軌道変更のあとで、タイマーでは動かしません。ページがサーバーを呼ぶことはありません。位置は天体の中心からのキロメートルで、黄道座標 J2000 です。`/roadster` と同じ軸で、`/space` の `eclipticToScene` で宇宙ビューの軸に変えられます。

`orbiterElements(id)` は軌道要素を返します。合わせた期間 (`validFrom`、`validUntil`)、Horizons の追跡データがどこまであるか (`trackedUntil`)、期間内での Horizons に対する楕円の誤差 (`fitErrorKm`、中央値と最大) もいっしょです。2026-11-11 の時点で、最大誤差は低い円軌道 (LRO、チャンドラヤーン2号、ダヌリ、MRO、オデッセイ) で33から54 km、ホープで9 km、マーズ・エクスプレスで16 kmでした。平均の楕円では TGO (146 km。昇交点が1日に2.2度動きます) と ARTEMIS P1、P2 (10,000 kmの軌道で約3,000 km。地球に引かれて揺れます) を追えないので、これらは `modelled` (モデル) と示します。

## tracked、predicted、modelled、none

`orbiterStatus(id, when)` は、その時刻の位置がどのくらい信じられるかを返し、ページは探査機のそばにそれを示します。

| 状態 | 意味 |
|---|---|
| `tracked` | 合わせた期間の中で、Horizons の追跡データがある日まで |
| `predicted` | 期間の中で、追跡データより後。Horizons 自身の予測に合わせたもの |
| `modelled` | 平均の軌道だけ。期間の外、楕円の誤差が上限を超える機、追跡が終わった機 (メイヴンは2025年12月に交信が途絶え、2026年にNASAがミッションを終えたので、最後の軌道を保ちます) |
| `none` | 経路なし。キャップストーンの近直線ハロー軌道は楕円ではなく、ミッションも完了しています。天問1号の公開された記録は、ボランティアによる巡航の追跡だけで、到着で終わります |

推測を生のデータのように見せることはありません。`modelled` の機は暗く描き、モデルだと示します。`none` の機は情報だけを持ち、印は描きません。

## 数値と情報

`orbiterNumbers(id, when)` は、天体の平均表面からの高さ、速さ、周期、軌道傾斜角を返します。`orbiterPath(id, when, points)` は線を描くための、1周分の軌道の点。`orbiterSpeed` は速さだけです。`orbiterFacts(id)` (と `ORBITER_FACTS`) は、英語と日本語の名前、運用者、打ち上げ (日付、ロケット、射場)、記載どおりの観測機器、その機についての一行 (私たちの言葉で)、ミッションの状態 (`flying` か `ended`、注記つき) を持ちます。すべて、その機の JPL Horizons のオブジェクトページから、`NOTICE.md` にある日に読んで書きました。ページにない事実は書きません。

## 更新

```sh
python3 -I scripts/make-orbiter-data.py --cache .cache/horizons-orbiters
```

1機につきヘッダーの要求が1回とベクトルの要求が1回、2秒おきです。答えはキャッシュするので、2回目の実行は何も要求しません。スクリプトは各フィットの誤差を出し、Horizons が追跡しなくなった機を知らせ、`src/data/orbiters.ts` と `test/data/orbiters-horizons.json` のテスト用の点を書き直します。`pnpm test` がすべての機をそれらと照らし合わせます。
