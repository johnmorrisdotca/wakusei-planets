---
title: ビューが見ている天体の面
section: how-to
order: 21
description: "真ん中にある天体のどの経度・緯度がカメラの真下にあるかを読み取り、ある地点をそこへ向けます。宇宙のビューにも天体の絵にもあります。メインのビューに合わせて動くカード上の絵や、その逆に使えます。"
---

`<wakusei-space>` と `<wakusei-body>` は、真ん中の天体のまわりを、ヨー（水平の回転）とチルト（上下の傾き）で回ります。この2つの数字だけでは、表面のどこを見ているのかは分かりません。星に対して固定したカメラの下では、天体が自転して動くからです。`subCameraPoint()` は、それを天体に固定した座標での経度（東）と緯度（北）で答えます。`faceTo({ lon, lat })` はその逆で、指定した地点をカメラの真下に向けます。

```ts no-run
import type { WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";

const space = document.querySelector<WakuseiSpace>("wakusei-space")!;
space.goTo("moon", { smooth: false });
space.faceTo({ lon: 30.8, lat: 20.2 }, { smooth: false });
console.log(space.subCameraPoint(), space.stats.camera.sub);
```

| 呼び出し | 対象 | 意味 |
|---|---|---|
| `subCameraPoint()` | `<wakusei-space>` | 表示している時刻に、真ん中の天体のカメラの真下にある地点 `{ lon, lat }`。何かに乗って見ている間は `null`。 |
| `faceTo(point, { smooth })` | `<wakusei-space>` | 地点がカメラの真下に来るように、天体のまわりでビューを回します。なめらかに動き（`smooth: false` や動きを減らす設定では一度に）、ズームはそのままです。乗っている間は `false`。 |
| `stats.camera.sub` | `<wakusei-space>` | 直前の描画での同じ地点。テストや表示に使います。 |
| `subCameraPoint()` | `<wakusei-body>` | 絵の真ん中にある地点。日付のポーズ（または肖像のポーズ）と、ビューの回転・傾き・ロールを含みます。星では `undefined`。 |
| `faceTo(point, { smooth })` | `<wakusei-body>` | 地点が真ん中に来るように天体を回します。名前のある場所に対する `goToPlace` と同じ動きです。 |

数だけを扱うページやサーバー向けに、`/space` から純粋な関数 `subCameraPoint(body, view, centre, anchor, time)` と `faceView(body, face, centre, anchor, time, from)` も使えます。

## 計算のしかた

ビューは、`center` の地点の地球上の方向からヨーとチルトを引いた方向にカメラを向けます。これは、カメラを最後に向けた瞬間（アンカー）に星から見えた方向です。その方向を、表示している時刻の天体自身の座標（極と本初子午線）に直します。極と本初子午線には自転が含まれ、月では本初子午線が地球への線から決まります。そのため、地球側から見た月では、地球の真下の地点が経度 0 になります。星に対して固定したカメラの下では、火星は1時間に14.6度動いて見えます。

## ビューに合わせて動くカードの絵

`subCameraPoint()` でビューを読み、`faceTo` で絵に渡します。読者が絵をドラッグしたら、絵の `subCameraPoint()` を読んで同じようにビューに渡します。どちらが変えたかを示す旗を持っておけば、2つが互いに応答し合うことはありません。もう一方は、地点が0.5度ほど動いたときだけ変えれば、止まっているときは何も描きません。

## 負担

どちらの呼び出しも、数個のベクトルの計算だけです。`faceTo` は `goToPlace` と同じなめらかな動きをし、そのほかには何も描きません。タイマーでは何も動きません。
