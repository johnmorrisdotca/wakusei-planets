---
title: 困ったとき
section: troubleshooting
order: 10
description: 天体が出ない、のっぺりしている、動かないときに確かめること。
---

## 何も出ない

コンソールを開いてください。線画に必要なのは要素のスクリプトだけです。タグが `<wakusei-body>` であること (`wakusei-planets` ではありません)、`body` が `BODIES` にある名前であることを確かめてください。

## 陰影つきがただの球になる

天体のエントリーをimportしていません。要素の横で `@johnmorrisdotca/wakusei-planets/jupiter` (か `/all`) をimportしてください。

## 陰影つきを頼んだのに線画になる

ブラウザーが WebGL を使えません。要素は `data-state="unavailable"` でそれを知らせ、線画を表示します。

## 動かない

仕様です。絵は何かが変わったときだけ描きます。`turn="12"` か `rate` を付けるか、読む人の操作部品を使ってください。動きを減らす設定の人には、自動では動かしません。

## 陰影つきが2つあるのに、片方が絵になる

WebGL はページで1つです。選ばれているものが動きます。`live="hover"` にすると、指したものに渡されます。

## CDNのページで three.js が読み込まれない

jsDelivr の `/+esm` のアドレスか、`three` のインポートマップを使ってください。
