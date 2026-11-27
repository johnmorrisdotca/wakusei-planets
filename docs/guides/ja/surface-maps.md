---
title: 天体の表面地図
section: how-to
order: 20
description: 天体の表面地図の出典、探査機が撮影した範囲、描き足した地形や単色で補った範囲を説明します。
---

[English](../surface-maps.md)

`realistic` と `painted` は同じ表面地図を使います。表には天体全体に貼る地図を天体ごとに載せています。撮影範囲は、地図に使った画像がどこをとらえているかを示します。全球モザイクにも、画像のない場所や解像度の異なる場所があります。割合は、「地図の高さ」や「平面地図」と記したものを除き、天体の表面積に対する値です。

## 地形の細かさはどこから来るか

鮮明な画像があるところは、そこに写った地形を使います。新しく作り直した衛星の地図で、画像がぼやけているところは、探査機がとらえた大まかな明暗や色を、分かる範囲で残しています。ぼやけた場所の細部と、一度も撮影されていない欠けた範囲の地形は、撮影された地形につながるように画像生成モデルで描いたもので、観測されたものではありません。一部の欠けた範囲は、周囲の地形に合わせた単色で補っています。天体ごとの処理は表に示しています。

| 天体 | 探査機と出典の地図 | 撮影範囲 | 加工と描き足し | 出典表記 |
|---|---|---|---|---|
| 太陽 | [Solar System Scope の太陽地図](https://www.solarsystemscope.com/textures/) | 探査機と撮影範囲の記載なし。 | 天体全体に貼る元画像の大きさを表示用に調整。 | Solar System Scope (CC BY 4.0) |
| 水星 | [Mercury Realistic 8K](https://sketchfab.com/3d-models/mercury-realistic-8k-215f364627054d25ae03bcd72afda714)。Solar System Scope の 8k Mercury と同じ。 | 天体全体に貼る地図には、探査機と撮影範囲の記載なし。 | 灰色の地図を表示用に調整。ズーム用タイルは [メッセンジャーの MDIS 画像](https://commons.wikimedia.org/wiki/File:Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_32ppd.jpg) の明暗と、元の地図の色を使用。 | Shady Tex、Solar System Scope (CC BY 4.0)。タイルの明暗は NASA / JHUAPL / Carnegie Institution of Washington。 |
| 金星 | マゼラン、[NASA/JPL の円筒図法レーダーモザイク](https://commons.wikimedia.org/wiki/File:Cylindrical_Map_of_Venus.jpg) と [PDS4 C3 MIDR](https://pds-geosciences.wustl.edu/missions/magellan/midr_pds4/index.htm) | 円筒図法の画像は、マゼランのレーダー画像を合成したもの。細かいタイルには、第1観測周期の6枚のモザイクを使用。この6枚で金星の表面積の約84%をおおう。 | 色はレーダー反射の強さを表す。拡大すると、データのある範囲では実測の細かい明暗が加わり、データのない範囲との境目では元の地図へなだらかに戻る。大きく拡大すると、C3モザイクの観測時に生じた細い縞が見えることがある。 | NASA / Jet Propulsion Laboratory、マゼラン・レーダー、NASA Planetary Data System |
| 地球 | [NASA Blue Marble Next Generation、2004年9月版](https://visibleearth.nasa.gov/images/73801) | 全球の合成画像。 | 陸上と海底の地形を含む元画像を使用。 | NASA Earth Observatory (Reto Stockli) |
| 月 | ルナー・リコネサンス・オービターの広角カメラ、[NASA CGI Moon Kit のカラー地図](https://svs.gsfc.nasa.gov/4720/) | 極を補った全球地図。撮影面積の数値は出典に記載なし。 | Moon Kit で両極を補ったカラーモザイクを使用。極域を拡大すると [LOLA の高度計データ](close-zoom.md) で斜面の陰影を描く。 | NASA Scientific Visualization Studio (Ernie Wright、Noah Petro) / LROC。極域の標高は LOLA チーム (NASA/GSFC) によるもので、NASA PDS が公開。 |
| 火星 | バイキング周回機、[カラー版 Mars Digital Image Mosaic 2.1](https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg) | 全球モザイク。細かいほうのモザイクは極に欠けた範囲がある。 | 黄土色に調整。ヘラス盆地の季節性の霜は盆地の色になじませ、極の氷は残した。 | NASA / JPL / USGS |
| フォボス | バイキング周回機、[フォボス全球モザイク、5 m](https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m) | 全球の明暗モザイク。撮影面積の数値は出典に記載なし。 | 天体の色に合わせて着色し、Gaskell の形状モデルに位置を合わせた。 | P. Stooke / USGS Astrogeology / DLR / NASA / JPL |
| ダイモス | バイキング周回機、[ダイモス全球モザイク、VIKING レイヤー](https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/deimos_simp_cyl.map&request=GetCapabilities&service=WMS) | 全球の明暗モザイク。撮影面積の数値は出典に記載なし。 | 天体の色に合わせて着色。経度を形状モデルにどう対応させるかは、元データからは確定できず、不確かさが残る。 | P. Stooke / USGS Astrogeology / NASA / JPL |
| ベスタ | ドーンのフレーミングカメラ、[USGS Gazetteer のベスタ写真地図](https://commons.wikimedia.org/wiki/File:Vesta_map_for_GeoHack.png) | 北端 (地図の高さの約7.5%) は影に入っていたため撮影されていない。それ以外は全球モザイク。 | 灰色にわずかに暖かみを加えた。北端は周囲の地形より少し暗い単色に徐々に移る。 | NASA / JPL-Caltech / UCLA / MPS / DLR / IDA。公開元は USGS Astrogeology。 |
| ケレス | ドーンの FC2、[2015年10月の全球モザイクと HAMO の南北極モザイク](https://dawngis.dlr.de/data/Ceres/mosaic_ceres.php) | 使用した地図は、南極付近の小さな欠損部 (表面積の約0.34%) を除き、ケレスの表面をおおう。この欠損部も後にドーンが撮影した。 | 極のモザイクを再投影し、公開済みの中緯度の地図に明暗を合わせた。欠損部は近くの観測地形の平均的な明るさになじませた。 | NASA / JPL-Caltech / UCLA / MPS / DLR / IDA (Roatsch ほか) |
| 木星 | [Nestaeric の木星の縞模様テクスチャ](https://sketchfab.com/3d-models/jupiter-6380860bdb4247b98b30643615c3afab) | 雲の縞模様を撮影した探査機と範囲は、出典に記載なし。 | 大赤斑を含む縞模様を使用。 | Nestaeric (CC BY 4.0) |
| イオ | ボイジャー1号とガリレオの SSI、[USGS の全球カラーモザイク、1ピクセルあたり1 km](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km) | ぼやけた場所や欠けた場所を含む全球モザイク。 | 画像の継ぎ目の明暗を調整。南部のにじみや引き伸ばされた筋を火山地形として描き直し、観測された大まかな色は残した。 | NASA / JPL / USGS Astrogeology |
| エウロパ | ボイジャーとガリレオの SSI、[USGS の全球モザイク、1ピクセルあたり500 m](https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m) | 氷が鮮明に写った場所、低解像度の場所、画像のない場所を含む全球モザイク。 | 観測された模様と主な氷の亀裂を残した。両極で細部を描き直し、南部の帯を含めて解像度の異なる画像の境目をなじませた。 | NASA / JPL / U.S. Geological Survey Astrogeology |
| ガニメデ | ボイジャー1・2号とガリレオの SSI、[USGS の全球モザイク、1ピクセルあたり1 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_global_mosaic_1km) と [カラーモザイク](https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif) | 南部のノイズが多いボイジャー画像など、ぼやけや欠損を含む全球モザイク。 | 観測された起伏と大まかな色を残し、極を中心にした地図の上でぼやけた場所や欠けた場所を描き直した。 | NASA / JPL / USGS Astrogeology |
| カリスト | ボイジャー1・2号とガリレオの SSI、[USGS の全球モザイク、1ピクセルあたり1 km](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km) | ぼやけや欠損を含む全球モザイク。 | 極を中心にした地図の上でぼやけた場所や欠けた場所を描き直した。南極と、赤道付近で解像度の異なる画像が接する境目も整えた。 | NASA / JPL / USGS Astrogeology |
| 土星 | [Solar System Scope の縞模様地図](https://www.solarsystemscope.com/textures/) と [Nestaeric の土星の極地図](https://sketchfab.com/3d-models/saturn-c09a1970148c43ad99db134a9d6d00b5) | 雲を撮影した探査機と範囲は、出典に記載なし。 | 縞模様に、両極から20°以内の再投影した画像を組み合わせた。北極には六角形がある。 | Solar System Scope、Nestaeric (CC BY 4.0) |
| ミマス | カッシーニの ISS、[2010年2月の地図 (PIA12780)](https://commons.wikimedia.org/wiki/File:Map_of_Mimas_2010-02_PIA12780.jpg) | 全球地図。撮影面積の数値は出典に記載なし。 | 地図の枠と文字を切り取った。 | NASA / JPL / Space Science Institute |
| エンケラドス | カッシーニ、[全球カラー地図 (PIA18435)](https://commons.wikimedia.org/wiki/File:Enceladus_Color_Map.jpg) | 全球モザイク。撮影面積の数値は出典に記載なし。 | 公転方向の後ろ側の半球を基準に経度を合わせ、疑似カラーをほぼ灰色に調整。 | NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute |
| テティス | カッシーニ、[全球カラー地図 (PIA18439)](https://commons.wikimedia.org/wiki/File:Tethys_Color_Map.jpg) | 全球モザイク。撮影面積の数値は出典に記載なし。 | オデュッセウスと公転方向の後ろ側の半球を基準に経度を合わせ、強調された色を抑えた。 | NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute (Paul Schenk) |
| ディオネ | カッシーニ、[全球カラー地図 (PIA18434)](https://commons.wikimedia.org/wiki/File:Dione_Color_Map.jpg) | 全球モザイク。撮影面積の数値は出典に記載なし。 | 公転方向の後ろ側の暗い半球を基準に経度を合わせ、強調された色を抑えた。 | NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute |
| レア | カッシーニ、[全球カラー地図 (PIA18438)](https://commons.wikimedia.org/wiki/File:Rhea_Color_Map.jpg) | 全球モザイク。撮影面積の数値は出典に記載なし。 | 公転方向の後ろ側の暗い半球を基準に経度を合わせ、疑似カラーを抑えた。 | NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute |
| タイタン | カッシーニの ISS、[近赤外線の全球表面モザイク、1ピクセルあたり4 km (PIA19658)](https://science.nasa.gov/resource/titan-mosaic-the-surface-under-the-haze/) | ぼやけや欠損を含む近赤外線の全球モザイク。 | 観測された地表の模様を残し、継ぎ目をなじませた。ぼやけた場所や欠けた場所に細部を描き足した。 | NASA / JPL-Caltech / Space Science Institute。USGS Astrogeology 経由。 |
| イアペトゥス | カッシーニ、[全球カラー地図 (PIA18436)](https://commons.wikimedia.org/wiki/File:Iapetus_Color_Map.jpg) | 全球モザイク。撮影面積の数値は出典に記載なし。 | 公転方向の前側にある暗いカッシーニ・レジオを基準に経度を合わせ、強調された色を抑えた。 | NASA / JPL-Caltech / Space Science Institute / Lunar and Planetary Institute |
| フェーベ | カッシーニの ISS、[全球モザイク、PDS COISS_3001 (SP_1M_0_0_SIMP.IMG)](https://pds-rings.seti.org/volumes/COISS_3xxx/COISS_3001/) | 北極の欠損と南端の不良画素を含む全球モザイク。 | 北極の欠損と南端の白い四角を描き直した。Gaskell の形状モデルとの経度の合わせ方はこれまでどおり。 | NASA / JPL / Space Science Institute / DLR とカッシーニ ISS チーム |
| 天王星 | [NestaEric の天王星の縞模様テクスチャ](https://sketchfab.com/3d-models/uranus-0009a69dbace44608c0bd09af9ba20db) | 雲の縞模様を撮影した探査機と範囲は、出典に記載なし。 | 明るい斑点を含む縞模様を使用。 | NestaEric (CC BY 4.0) |
| ミランダ | ボイジャー2号、[JPL が配布する USGS のモザイク (ura5vuu2.tif)](https://space.jpl.nasa.gov/tmaps/uranus.html) | 南側を撮影。撮影範囲の縁は不規則で、北側は写っていない。 | 北側を描き足し、溝が続くようにした。つなぎ目はボイジャー画像の縁に合わせた。筋や引き伸ばしのあった3か所を描き直した。 | NASA / JPL / USGS Astrogeology (Tammy Becker) |
| アリエル | ボイジャー2号、[JPL が配布する USGS のモザイク (ura1vuu2.tif)](https://space.jpl.nasa.gov/tmaps/uranus.html) | 南半球を撮影。北側は写っていない。 | 北側と、南側のぼやけた場所の細部を描き足し、観測された大まかな模様は残した。 | NASA / JPL / USGS Astrogeology (Tammy Becker) |
| ウンブリエル | ボイジャー2号、[JPL が配布する USGS のモザイク (ura2vuu2.tif)](https://space.jpl.nasa.gov/tmaps/uranus.html) | 南半球を撮影。北側は写っていない。 | 北側と、南側のぼやけた場所の細部を描き足し、観測された大まかな模様は残した。 | NASA / JPL / USGS Astrogeology (Tammy Becker) |
| ティタニア | ボイジャー2号、[JPL が配布する USGS のモザイク (ura3vuu2.tif)](https://space.jpl.nasa.gov/tmaps/uranus.html) | 南半球を撮影。北側は写っていない。 | 北側と、南側のぼやけた場所の細部を描き足し、観測された大まかな模様は残した。 | NASA / JPL / USGS Astrogeology (Tammy Becker) |
| オベロン | ボイジャー2号、[JPL が配布する USGS のモザイク (ura4vuu2.tif)](https://space.jpl.nasa.gov/tmaps/uranus.html) | 南半球を撮影。北側は写っていない。 | 北側と、南側のぼやけた場所の細部を描き足し、観測された大まかな模様は残した。 | NASA / JPL / USGS Astrogeology (Tammy Becker) |
| 海王星 | [Solar System Scope の海王星地図](https://www.solarsystemscope.com/textures/) | 探査機と撮影範囲の記載なし。 | 天体全体に貼る元画像の大きさを表示用に調整。 | Solar System Scope (CC BY 4.0) |
| トリトン | ボイジャー2号、[Paul Schenk のカラーモザイク、1ピクセルあたり600 m](https://science.nasa.gov/resource/map-of-triton/) | 北側 (平面地図の約28%) は極夜で、撮影されていない。 | 撮影された地形から、北側は少し暗い単色へ徐々に移る。 | NASA / JPL-Caltech / Lunar & Planetary Institute (Paul Schenk) |
| 冥王星 | ニュー・ホライズンズ、[LORRI/MVIC モザイク、1ピクセルあたり300 m](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m) と [Ralph/MVIC のカラー地図](https://science.nasa.gov/photojournal/pluto-color-map/) | 接近時に見えた半球と北極冠は鮮明。反対側は低解像度。南緯約30°より南は撮影画像がない。 | 南側と、反対側の細部を描き足した。反対側の観測された大まかな模様は残した。 | NASA / Johns Hopkins University Applied Physics Laboratory / Southwest Research Institute |
| カロン | ニュー・ホライズンズ、[LORRI/MVIC モザイク、1ピクセルあたり300 m](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m) と [カロンのカラー地図](https://www.iau.org/public/images/detail/iau1803c/) | 南側 (平面地図の約31%) は極夜で、撮影されていない。 | 北の赤い模様は残した。撮影された地形から、南側は少し暗い単色へ徐々に移る。 | NASA / JHUAPL / SwRI / USGS Astrogeology |

[NOTICE.md](../../../NOTICE.md) には、出典表記と利用条件の詳細、地図タイルの出典、土星の輪の画像、そしてベンヌ、エロス、アロコスの形状モデルに組み込んだ画像を載せています。

## 近づくズームでの地図の読み込み

ほとんどの天体は幅512ピクセルと1024ピクセルの WebP を `dist/textures/` に収録しています。ミランダ、アリエル、ウンブリエル、ティタニア、オベロンは512ピクセルの地図を収録しています。この5つの1024ピクセル版と、ズーム時の2048ピクセル版は、既定では対応する GitHub のリリースタグから jsDelivr を通して読み込みます。

`texture-base` を指定するページは、ページを見る人がズームできる範囲に必要な幅の画像を配信してください。幅の大きい WebP は同じフォルダーに置くか、`texture-far-base` で別のフォルダーを指定します。さらに細かいタイルを自分で配信する場合は、`tiles` でそのフォルダーを指定します。[近づくズームと地図のタイル](close-zoom.md) と [自分でサーバーを動かす](serve-it-yourself.md) を参照してください。
