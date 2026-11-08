---
title: 見た目と天体
section: how-to
order: 7
description: 見た目、天体ごとのエントリー、three.js、画像、ページを軽く保つ決まり。
---

## 見た目

- `line`: 輪郭の線画 (SVG文字列)。ほかには何も要りません。
- `realistic`: 写真の地図です。太陽の側から光が当たります。`painted` は同じ地図で、古いページがそのまま動くように残しています。デモには、この写真の地図用のボタンが「リアル」として一つだけあります。
- `illustrated`: 以前の `realistic` が描いていた絵で、絵の日本語名はイラストです。天体の色と表面の特徴から、シェーダーで計算します。既定の見た目ではありません。
- `painted`: 太陽、水星から冥王星までの惑星、ケレス、月、ガリレオ衛星の4つ、ミマス、エンケラドス、テティス、ディオネ、レア、タイタン、イアペトゥス、トリトン、カロンの、本物の表面の地図です。土星の輪は、カッシーニが撮った輪の写真から作っています。最初は小さい画像を描き、拡大すると、より細かい画像を取得します。取得できなければ陰影つきのままです。各地図の出典は NOTICE.md に書いてあります。

![地図つきの見た目の土星。輪はカッシーニの画像から。](../../images/hero-saturn-painted.png)

![地図つきの見た目の地球。NASA の Blue Marble の画像から。](../../images/hero-earth-painted.png)

![地図つきの見た目のイオ。地図つきの14の衛星のひとつ。](../../images/hero-io-painted.png)

![リアルの見た目の金星。雲の地図から。](../../images/hero-venus-realistic.png)

## 天体ごとに別のエントリー

線画以外の見た目は、天体ごとのコードとデータなので、importも別です。`@johnmorrisdotca/wakusei-planets/saturn`、ガリレオ衛星は `/moons-jupiter` です。`/all` はすべてをimportします。エントリーをimportしていない天体は、その色の簡単な球として描かれます。

## 地球

地球も、ほかの天体と同じように描きます。realistic と painted は、どちらも NASA の Blue Marble の写真で、ほかの天体と同じ光と自転で描き、まわりに空気の縁をつけます（数字だけでは大陸の形を正直に描けないので、どちらの見た目も写真を使います）。`/all` に含まれます。ページの WebGL は1つを共有し、天体の並びでは止まった絵が出ます。線画は、ふだんはこのパッケージ自身の輪郭です。ページに [chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth) の国境つきの地球儀もあれば、そちらを使います。そのためには `@johnmorrisdotca/chikyu-earth` (任意の依存、0.10.0 以降) を入れて、`/earth` と一緒にその要素をimportしてください。

```js no-check
import "@johnmorrisdotca/chikyu-earth/element";
import "@johnmorrisdotca/wakusei-planets/earth";
```

`/earth` は chikyu-earth を自分ではimportしないので、入っていないプロジェクトでもビルドでき、輪郭を描きます。あとから chikyu-earth の要素がページに来たときは、地球はその地球儀に切り替わります。

## 準惑星

冥王星のほかに、`ceres`、`orcus`、`haumea`、`quaoar`、`makemake`、`gonggong`、`eris`、`sedna` が、どの見た目でも描けます。位置は2026年6月のJPLの接触軌道要素から求めます (前後数年は合います)。大きさは NOTICE.md に挙げた論文の値です。ハウメア (1161 x 852 x 513 km、3.9時間で1回転) とクワオアーは、本当の細長い形で描きます。地図つきの見た目は、ケレス (探査機ドーンの地図) だけで、ケレスは realistic（デモの「リアル」）でもこの地図を使うので、どの見た目でも、オッカトル・クレーターの明るい点がある本物のケレスの姿になります。ほかの天体の表面は、発表されている色から描いた推定です。自転軸が測られていない天体は、軌道の極の向きにしています (どれかは NOTICE.md にあります)。ウェイウォト、シャンリュウ、S/2015 (136472) 1 は、日時つきの軌道が発表されていないので描きません。

## 衛星

どの衛星も、`body` に自分の名前を渡せば、どの見た目でも描けます。デモには衛星の並びもあります。火星: `phobos`、`deimos`。木星: `io`、`europa`、`ganymede`、`callisto`。土星: `mimas`、`enceladus`、`tethys`、`dione`、`rhea`、`titan`、`iapetus`。天王星: `miranda`、`ariel`、`umbriel`、`titania`、`oberon`。海王星: `proteus`、`triton`、`nereid`。冥王星: `charon`、`nix`、`hydra`。オルクス: `vanth`。ハウメア: `hiiaka`、`namaka`。エリス: `dysnomia`。地球の衛星は `moon` です。`?body=io` でデモがイオで開きます。

## WebGLは1つ、必要なときだけ描く

線画以外の天体は、kazoku-ui の共通レンダラーを通じて、1ページで1つの WebGL を共有します。選ばれているものが動き、ほかは絵です。`live="hover"` にすると、指した天体に渡され、`live="off"` なら絵だけです。何も変わらないときは何も描かず、アニメーションフレームも頼みません。動いている間も1秒に30回まで、キャンバスは1辺4096ピクセル・600万ピクセルまでに抑え、要素が消えるときはすべて解放します。見えていないとき、タブが隠れているときは描かず、WebGL が失われても自動で戻ります。

## 本当の大きさ

`scale-to="jupiter"` で、木星に対する本当の大きさで描きます。`radiusKm`、`tiltDeg`、`rotationHours` は `BODIES` にあります。
