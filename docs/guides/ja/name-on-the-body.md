---
title: 天体に名前を書く
section: how-to
order: 7
description: 天体の名前をその球面に書きます。映画のタイトルのように天体に重なり、天体とともに回るか、見る人のほうを向いたままになります。四つの見た目、一つ・両側・全周、赤道か極の近く、ページの言語とフォントで書けます。
---

`<wakusei-body>` と `<wakusei-space>` に `body-label="painted"` をつけると、陰影つきの見た目の天体の球面に、その名前を書きます。大きな文字が表面に沿って置かれ、表面が透けて見え、天体とともに回ります。映画が対象の上にタイトルを重ねるのと同じです。既定ではオフ (天体の横の名前はそのまま) で、画面上で小さすぎる天体には何も描きません。描画はファミリー共通の `@johnmorrisdotca/kazoku-ui/body-label` なので、ここで描く地球の名前と chikyu-earth の地球の名前は同じ見た目になります。

```html
<wakusei-body body="mars" look="realistic" body-label="painted"></wakusei-body>

<wakusei-space time="2026-11-02T14:00Z" body-label="etched" body-label-repeat="both" lang="ja"></wakusei-space>
```

オンにしたときの既定は John の選んだ組み合わせです。**Michroma、`painted`、強さは半分、名前は一つ、赤道上、天体とともに回る**。

## 属性

名前はファミリー共通の標準で、二つの要素でも chikyu-earth でも同じです。

| 属性 | 値 |
|---|---|
| `body-label` | 見た目。`painted` (表面の上に淡い文字)、`etched` (文字の部分だけ表面が明るくなる)、`outline` (文字の輪郭だけ)、`burned` (表面より暗い文字)。属性がない、またはこれ以外の値なら、名前は書きません。 |
| `body-label-strength` | どのくらいはっきり出すか。0 から 1、既定は `0.5` |
| `body-label-repeat` | `once` (既定、一つ)、`both` (反対側にもう一つ。天体が回っても必ずどちらかが見える)、`around` (ぐるり一周に入るだけ並べる) |
| `body-label-latitude` | 帯の緯度 (度)。`0` (既定) は赤道、`55` は北極の近く、`-55` は南極の近く。赤道から 70 度以内 |
| `body-label-facing` | つけると、名前の下で天体が回っても、名前は見る人のほうを向いたままです |
| `body-label-font` | Michroma の代わりに使う、ページが読み込み済みの CSS フォントファミリー |
| `body-label-fallback-font` | そのフォントにない文字 (日本語など) に使うファミリー (`"Noto Sans JP"`) |
| `body-label-tone` | 文字の色合い。`auto` (既定。明るい天体には暗い文字、暗い天体には淡い文字)、`light` と `dark` はどちらかに固定します |

プロパティ `bodyLabel` は同じ内容を一つのオブジェクトで受け取ります (`space.bodyLabel = { look: "painted", strength: 0.5, repeat: "once", latitude: 0, facing: false, font: "Michroma", fallbackFont: "", tone: "auto" }`)。`null` なら名前なし。設定すると属性より優先されます (要素が属性を読むのに使うのは `/painter` の `readNameLabel(el)` です)。

## どの天体でも読める文字

淡い天体 (天王星、金星、土星、太陽、氷の衛星) では淡い文字が消え、暗い天体では暗い文字が消えます。そこで既定では、目立つほうの色合いの文字になります。`body-label-tone="auto"` は天体の平均色 (`BODIES[id].colour`) を見て、相対輝度が 0.5 より高ければ暗い文字、低ければ淡い文字にします。暗い文字になるのは、金星、土星、天王星、太陽、イオ、エウロパ、エンケラドス、テティス、ディオネ、レア、トリトン、ヒドラ、エリス、ハウメアで、火星、月、地球、水星、木星、海王星、冥王星、ガニメデ、カリスト、タイタンなどは淡い文字になります。強さはどの天体でも同じ意味で、0.5 なら天王星でも火星でも表面との差は同じです。暗い文字は `burned`、淡い文字は `painted` の見た目なので、`auto` が見た目を変えるのは `painted` だけで、明るい天体では `burned` になります。ページが指定した `etched`、`burned`、`outline` はそのまま描かれます。`light` か `dark` を指定すると、どの見た目よりも優先されます (`outline` は色合いが一つだけなのでそのままです)。どの天体でも同じ色合いにしたいページは、`body-label-tone="light"` か `"dark"` (`bodyLabel` のプロパティ `tone`) を指定します。`/painter` の `nameTone(colour)` と `nameLabelLook(options, colour)` は、同じ決まりをふつうの値に当てはめるものです。いま描かれている見た目は `stats.label.look` と `stats.bodyLabels.focus.look` で分かります。

## 文字

文字は、要素の `lang` の言語での天体の名前です。英語なら大文字で `EARTH`、日本語なら `地球`。Michroma にはラテン文字しかないので、日本語は `body-label-fallback-font` で、指定がなければページのサンセリフで描きます。painter を使って自分で描くページ (`painter.make(three, "Mars", { label: { look: "painted", text: "HOME" } })`) は、好きな文字列を書けます。

## フォント

Michroma (Vernon Adams、SIL Open Font License 1.1) は、この書体で名前を初めて書くときに一度だけ、kazoku-ui の持つコピーから 64 kB を取得します。`body-label-font` で自分のフォントを指定したときは取得しません。届くまでは何も描かず、名前の用意ができるとビューが自分で描き直します。ラベルはこのファイルを kazoku-ui のモジュールのとなり (`fonts/Michroma-Regular.ttf`) に探します。バンドラーがファイルを一緒に運ばないときは、最初の名前を書く前に `/painter` の `setBodyLabelFontUrl("/fonts/Michroma-Regular.ttf")` で置き場所を教えてください。ライセンスは `NOTICE.md` にあります。

## 決まりごと

- 名前は天体と同じ光で照らされます。太陽の光なので、夜の側にある名前は暗くなります (宇宙ビューの `light="lit"` では天体と同じく見る人の側から照らします)。
- 画面上の半径が 24 CSS ピクセルより小さい天体には名前を書きません (`bodyLabel` の `minRadiusPx`)。遠くの準惑星、小さな衛星、太陽系全体の眺めはそのままで、ズームすると名前が現れます。土星の環は帯の外側にあります。太陽の名前はその円盤の上に、陰をつけず明るく描きます。
- 宇宙ビューでは、球面に名前を書いている天体の横の名前と点は、フェードで消えます (動きを減らす設定では一瞬で)。天体が上の項目の大きさより小さくなると、フェードで戻ります。`labels-always` をつけると、どちらも出したままにします。
- 一つだけ書いた名前は、半分の時間は向こう側にあります。`body-label-repeat="both"` でどちらかが見えるようにするか、`body-label-facing` で見る人のほうを向かせます。
- 止まっているときは何も描き直しません。設定を変えると、名前を書いた一枚のテクスチャだけを描き直します。`pnpm test:freeze` が確かめます。
- `<wakusei-body>` の `stats.label` と `<wakusei-space>` の `stats.bodyLabels` (描かれている名前の数と、見ている天体の名前) は、いま描いているものを返します。返すのは文字と、見る人のほうを向くときの極まわりの回転です。

## 自分のシーンで

painter では、`make` が受け取るコンテキストの `label` が名前で、あとから変えたり外したりするのは painting の `setLabel`、書いてある内容を読むのは `painting.label` です。painter は天体を照らすのと同じ向きで名前を照らすので、three.js のライトは要りません。three.js の一部だけを渡すページ (`setThreeLoader`) は、名前を描くために `CanvasTexture`・`SRGBColorSpace`・`NormalBlending` を加えてください。足りないと天体は名前なしで描かれ、コンソールに警告が一度だけ出ます。

```ts no-run
import * as THREE from "three";
import { painter } from "@johnmorrisdotca/wakusei-planets/painter";

const mars = painter.make(THREE, "Mars", { look: "painted", label: { look: "painted", lang: "en" } });
mars.setLabel({ look: "etched", repeat: "both", strength: 0.8 });
console.log(mars.label?.text);
```
