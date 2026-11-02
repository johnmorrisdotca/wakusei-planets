---
title: HTMLページにCDNから入れる
section: how-to
order: 2
description: scriptタグ1つで、jsDelivrやunpkgから惑星をページに入れます。陰影つきも同じです。
---

ビルドのないページは、CDNからパッケージを読み込みます。下の例は、すべてパッケージのテストがブラウザーで動かしています。CDNの応答は、ビルドしたパッケージから作っています。

## jsDelivrから

jsDelivrは、アドレスの最後が `/+esm` だと、パッケージと依存を1つのモジュールにまとめます。タグは1つで足ります。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wakusei Planets from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm"></script>
  </head>
  <body>
    <wakusei-body body="saturn" look="line" size="320"></wakusei-body>
  </body>
</html>
```

## unpkgから

unpkgはパッケージのファイルをそのまま配り、`?module` を付けると、中の裸のimportをunpkgのアドレスに直します。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wakusei Planets from unpkg</title>
    <script type="module" src="https://unpkg.com/@johnmorrisdotca/wakusei-planets/dist/element.js?module"></script>
  </head>
  <body>
    <wakusei-body body="saturn" look="line" size="320"></wakusei-body>
  </body>
</html>
```

## 陰影つきの天体

陰影つきの見た目は three.js で描きます。jsDelivrの `/+esm` が three.js も持ってきます (three.js はパッケージの任意の依存なので、線画だけのページは読み込みません)。天体ごとの陰影つきの見た目は別ファイルで、要素の横に読み込みます。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A shaded Jupiter from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/jupiter/+esm"></script>
  </head>
  <body>
    <wakusei-body body="jupiter" look="realistic" size="360"></wakusei-body>
  </body>
</html>
```

1ページに天体がたくさんあっても、WebGLは1つを共有します。いま選ばれているものだけが動き、ほかは止まった絵です。詳しくは [見た目と天体](looks-and-bodies.md) を見てください。
