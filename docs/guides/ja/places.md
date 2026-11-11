---
title: 月、火星と31の天体の場所
section: how-to
order: 20
description: "33の天体の、すべての着陸地点・探査車・墜落・衝突・大気圏突入地点と、名前のある地形。位置、日付、運用者、出典付き。天体ごとに1つの表で、gzip で最大37 kB。最初に勧めたい場所には有名の印が付きます。そして任意の天体の太陽直下点、明暗境界線、地方太陽時。"
---

`/places` は、天体の表面で何がどこにあるかを扱います。`/places/moon`、`/places/mars` と、さらに31の入口 (`/places/venus`、`/places/titan`、`/places/pluto`、`/places/67p` など) は、それぞれ1つの一覧です。探査機が表面に達した場所 (着陸した、走行した、墜落した、狙って衝突させた)、大気の中で失われた場所、そして名前のある地形 (海、山、谷、大きなクレーター) が入っています。各場所には、緯度と経度、英語と日本語の名前、出どころがあり、読者が知っているものには `famous` の印が付いて、最初に勧める候補の一覧になります。`/places` は、記録の形、一覧の検索、大円距離、そしてあわせて必要になる補助関数 (太陽直下点、明暗境界線、任意の時刻の地方太陽時) を持ちます。DOM も three.js も使わず、どこでも動き、ページが読み込むのは表示する天体の分だけです。どの表も別々の入口で、`loadPlaces("moon")` が必要なときに1つを取り込みます。

```ts
import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
import { findPlace, isDaylight, localSolarTime, nearestPlace, placeDistanceKm } from "@johnmorrisdotca/wakusei-planets/places";

const eagle = findPlace(PLACES_MOON, "Apollo 11 lunar module")!;
const taurus = findPlace(PLACES_MOON, "Apollo 17 lunar module")!;
console.log(eagle.name.en, eagle.name.ja, eagle.lat.toFixed(3), eagle.lon.toFixed(3), eagle.date, eagle.operator, eagle.source.id);
console.log(Math.round(placeDistanceKm("moon", eagle, taurus)), "km from Apollo 17");
const now = Date.UTC(2026, 10, 11, 12);
console.log("Tranquility Base:", localSolarTime("moon", eagle.lon, now).toFixed(1), "o'clock by the Sun,", isDaylight("moon", eagle.lat, eagle.lon, now) ? "daylight" : "night");
console.log("nearest visited place to 20 N, 30.7 E:", nearestPlace(PLACES_MOON, 20, 30.7, "crewed", "landing", "rover")?.place.name.en);
```

## 一覧の中身

| 種類 | 内容 | 月 | 火星 |
|---|---|---|---|
| `crewed` | 人が乗った着陸 (アポロの月着陸船6機) | 6 | 0 |
| `landing` | 着陸後に動作した着陸機 | 22 | 12 |
| `rover` | そこを走った探査車。地表に着いた地点 (走行経路ではありません) | 13 | 7 |
| `impact` | 狙って表面に衝突させた探査機 | 14 | 0 |
| `crash` | 表面にぶつかって失われた探査機 (使用後に落とした上昇段、寿命の終わりの周回機、上段ロケットも) | 35 | 6 |
| `entry` | 大気の中で失われた探査機や周回機 (金星、木星、土星。下を参照) | 0 | 0 |
| `planned` | 発表されていて、まだ飛んでいない着陸 | 8 | 1 |
| `feature` | IAU の一覧にある名前のある地形 | 768 | 914 |

地点の記録には、`mission` (カタログでの天体の名前)、`operator` (カタログの機関・企業の符号)、`country`、`date` (UTC。時刻がわかる場合は分まで、わからない場合は日か月まで)、`outcome` (`crewed`、`soft`、`hard`、`impact`) があり、ある場合は着陸地点自身の名前 (`site`: `Statio Tranquillitatis`、`Octavia E. Butler Landing`)、カタログの `note`、わかっていれば動作を止めた時刻 (`until`) も付きます。地形には、IAU の分類とその平易な語 (英語と日本語)、大きさ (キロメートル)、名前が承認された日があります。月の地点は、6回の有人着陸、ソ連・米国・中国・インド・日本・イスラエルと民間の着陸機、探査車、そしてレインジャー、ルナ、ルナ・オービター、サターンの上段、LCROSS、GRAIL などの衝突地点です。火星には、マルス2号から祝融号までの着陸機と探査車、到着時に失われた機体 (マーズ・ポーラー・ランダー、2機のディープ・スペース2、ビーグル2、スキアパレッリ) があります。地形は、海と、IAU 惑星地名辞典にあるアルベド模様を除くすべての種類の地形、80 km 以上のクレーター、そして小さくても有名なもの (アリスタルコス、ケプラー、ジェゼロ) です。

## ほかの31の天体

どの天体にも独自の表があり、記録の形は同じです。表は `scripts/make-places-more-data.py` が、2026-11-11 の IAU 惑星地名辞典のファイルと、各地点の `source` に書かれた出典から作ります。

| 天体 | 地点 | 収録した地形 | 絞り込み | 有名 | gzip kB |
|---|---|---|---|---|---|
| 水星 | 1 | 401 (621件から) | 69 km 以上 | 11 | 26 |
| 金星 | 18 | 386 (1,985件から) | 種類ごとに大きい25件 | 13 | 21 |
| イオ |  | 261 |  | 8 | 14 |
| エウロパ |  | 129 |  | 9 | 7 |
| ガニメデ |  | 196 |  | 9 | 10 |
| カリスト |  | 154 |  | 4 | 7 |
| タイタン | 1 | 304 |  | 15 | 17 |
| エンケラドス |  | 87 |  | 7 | 6 |
| ミマス |  | 42 |  | 1 | 3 |
| テティス |  | 53 |  | 2 | 3 |
| ディオネ |  | 98 |  | 3 | 6 |
| レア |  | 144 |  | 4 | 9 |
| イアペトゥス |  | 70 |  | 5 | 4 |
| ミランダ |  | 18 |  | 4 | 1 |
| アリエル |  | 26 |  | 3 | 2 |
| ウンブリエル |  | 13 |  | 3 | 1 |
| ティタニア |  | 18 |  | 3 | 1 |
| オベロン |  | 10 |  | 4 | 1 未満 |
| トリトン |  | 63 |  | 7 | 4 |
| 冥王星 |  | 73 |  | 7 | 8 |
| カロン |  | 15 |  | 3 | 3 |
| ケレス |  | 149 |  | 8 | 10 |
| ベスタ |  | 106 |  | 5 | 7 |
| エロス | 1 |  |  | 1 | 1 未満 |
| リュウグウ | 4 |  |  | 2 | 1 未満 |
| ベンヌ | 1 |  |  | 1 | 1 未満 |
| ディモルフォス | 1 |  |  | 1 | 1 未満 |
| テンペル第1彗星 | 1 |  |  | 1 | 1 未満 |
| チュリュモフ・ゲラシメンコ彗星 | 1 |  |  | 1 | 1 未満 |
| 木星 | 2 |  |  | 1 | 1 未満 |
| 土星 | 1 |  |  | 1 | 1 未満 |

**地点。** 金星には、ソ連のベネラ7号から14号までの着陸機と2機のベガ着陸機 (ベネラ8・9・10・13・14号とベガ1・2号は、バシレフスキーとウェイツがマゼランのレーダー画像で更新した位置、ベネラ7・11・12号は GCAT)、4機のパイオニア・ヴィーナスのプローブ (大型プローブと北・昼側・夜側のプローブ。PDS のパイオニア・ヴィーナスのページにある衝突位置で、動作を続けたのは昼側プローブだけで、約1時間送信しました) と母船、そして大気の中で降下機がつぶれたベネラ4・5・6号の `entry` 地点があります。水星にはメッセンジャーの衝突、タイタンにはホイヘンス、エロスにはニア・シューメーカーの接地、リュウグウにははやぶさ2の2回のタッチダウン、衝突装置の人工クレーターとマスコット、ベンヌにはナイチンゲールでのオサイリス・レックスのサンプル採取、ディモルフォスにはDARTの衝突、テンペル第1彗星にはディープ・インパクトのインパクター、チュリュモフ・ゲラシメンコ彗星にはフィラエの最後の場所アビドス、木星にはガリレオのプローブと、そのあとに投入された周回機、土星にはカッシーニの最後の突入があります (最後の3つは `entry` です。置くべき表面がないからです)。`date` は、出典が時刻を示している場合は UTC で分まで入っています。月と火星は、すでに持っていたものです。

**地形。** IAU 惑星地名辞典のもので、分類、その平易な語 (英語と日本語)、大きさ (キロメートル。直径、または線状地形の長さ。**IAU 惑星地名辞典に値がない場合は 0**で、トリトンの多くの地形がそうです)、名前が承認された日、そしてここで新しく加わった `origin` (名前の由来。IAU 惑星地名辞典の記述で、英語。月と火星の表にはありません) があります。**絞り込み:** 地形が400件までの天体はすべて収録します (最大はタイタンの304件とイオの261件)。水星は621件あり、大きい400件 (69 km 以上) を残します。金星は1,985件あり、21の種類ごとに大きい25件、合計386件を残します (大きさが、種類によって幅だったり長さだったりするので、大きさだけで切ると、クレーターとコロナがすべて消えてしまいます)。有名なものは必ず入れます。月と火星は、これまでのままです。日本語名は、片仮名の通称があるごく一部 (天体全体で約60件。確認が必要です) に付け、ほかは月と火星と同じく IAU のラテン語などの名前のままです。

**有名。** (`famous: true`) は、ページが最初に勧められる場所の印で、月 (30件: アポロの月着陸船6機、ルナ2号と9号、サーベイヤー1号、ルノホート1号、嫦娥4号と5号、チャンドラヤーン3号、SLIM、オデュッセウス、ティコ、コペルニクス、アリスタルコス、ケプラー、シャクルトン、クラヴィウス、プラトン、ツィオルコフスキー、大きな海) と火星 (28件: マルス3号から祝融号までの着陸機と探査車、オリンポス山、マリネリス峡谷、ゲール、ジェゼロ、ヘラス、タルシスの火山、大きな平原) を含め、すべての天体に付けています。どの天体でも短い一覧です (30件まで)。水星はカロリス平原とメッセンジャーの衝突、金星はマクスウェル山脈、マート山、ベネラ9号、イオはロキ・パテラとペレ、エウロパはコナマラ・カオス、タイタンはクラーケン海とホイヘンス、冥王星はスプートニク平原、ケレスはオッカトルとアフナ山です。

**名前。** どの場所にも英語名があり、日本語名は、ある場合はその通称です。月の海、湖、入江、沼、大洋、主な山脈、読者が知っているクレーターと火星の地形 (月に126件、火星に38件。静かの海、嵐の大洋、アルプス谷、ティコ、オリンポス山、マリネリス峡谷、ヘラス平原) です。地形の名前は、よく知られたもの以外は IAU のラテン語名のままです。`findPlace` は、英語、日本語、ラテン語の形のどれでも見つけます (「Mare Tranquillitatis」も「静かの海」も)。

**着陸の予定** (`kind: "planned"`) は、月に8件、火星に1件です。どれも各機関や運用会社自身のページから、2026-11-11 に人の手で入力しました (ニュースサイトは使いません)。Astrobotic の Griffin Mission One (Nobile)、Intuitive Machines の IM-3 (Reiner Gamma) と IM-4 (Mons Mouton)、Blue Origin の Blue Moon MK1 Endurance (Shackleton のそばの尾根)、NASA の VIPER (Mons Mouton)、Firefly の Blue Ghost ミッション2、3、4 (Nassau、Gruithuisen Domes、Haworth)、ESA の Rosalind Franklin 探査車 (Oxia Planum) です。着陸する点を書いたページはないので、どれもページが挙げた場所の中心 (IAU の地名集の値) に置き、`approximate` (おおよそ) の印を付けています。`planned` には、ページにある日付 (年)、`dateOf` (ほとんどは `launch` で、打ち上げの年です (NASA の予定のページが打ち上げの年を書いているため)。VIPER と Rosalind Franklin だけは `landing` で、着陸の年です)、`status` (機関自身のページで予定が遅れたものは `slipped`。Griffin、IM-3、Blue Ghost ミッション2)、`read` (読んだ日) があり、記録の `source.url` がそのページです。地名集に名前のある場所を挙げていないミッションは入れていません。嫦娥7号、チャンドラヤーン4号、LUPEX、アルテミス4号は地域しか書いておらず、嫦娥8号の Leibnitz-Beta Plateau は IAU が決めた名前ではありません。`node scripts/check-planned.ts` (`pnpm places:planned`) は、日付が過ぎたものと、読んでから40日を超えたものを出します。毎月の見直しに使います。

## 天体の上の印

`<wakusei-body>` と `<wakusei-space>` の `places` は、陰影つきの見た目のときに、天体の上に場所の小さく控えめな印を付けます。`<wakusei-space>` では、見ている天体に付けます。種類ごとに別々にオンにできます。`landing` (有人着陸、着陸機、探査車)、`crash` (墜落、衝突、大気圏で消えた場所)、`planned` (予定)、`feature` (地形) です。値なしの `places` か `all` で、すべての種類が付きます。

```html
<wakusei-body body="moon" look="painted" places="landing crash"></wakusei-body>
<wakusei-space places="landing planned"></wakusei-space>
<script type="module">
  import { setPlacesLoader } from "@johnmorrisdotca/wakusei-planets/element";
  import { loadPlaces } from "@johnmorrisdotca/wakusei-planets/places";

  setPlacesLoader(loadPlaces);
  const moon = document.querySelector("wakusei-body");
  moon.addEventListener("wakusei-place", (event) => console.log(event.detail.body, event.detail.place.name.ja, event.detail.place.date));
  await moon.goToPlace("Apollo 11 lunar module");
  await document.querySelector("wakusei-space").goToPlace("パーシビアランス", { body: "mars" });
</script>
```

- **一覧はページが読み込みます。** 要素は表を持っていないので、印を使わないページには表が入りません。`setPlacesLoader(loadPlaces)` (`/element` か `/space/element` から。どちらで呼んでも両方に効きます) を呼ぶと、要素は必要になったときに、その天体の一覧を別のチャンクとして読み込みます。一覧を返す自分の関数を渡すこともできます。呼ぶまでは、印は付きません。
- **印は天体といっしょに回り**、裏側と、円盤のふちの近くでは隠れます。画面での半径が 40 CSS ピクセルより小さい天体には付けません。名前のある地形は、画面で 14 ピクセル以上の大きさになると印が付きます (`famous` のものは大きさに関係なく付きます)。なので、拡大すると印が増えます。印どうしは 12 ピクセル以上離し (探査機の場所、有名なもの、大きい地形の順に優先)、一度に付けるのは、天体の半径 4 ピクセルにつき1個までです (少なくとも8個、多くても60個)。小さい天体でも、印が多くなりすぎません。
- **印にカーソルを合わせるか、フォーカスするか、タッチすると**、名前と短い説明 (`有人着陸、1969年`、`着陸予定 (2027年打ち上げ)`、`クレーター、93 km`) が要素の `lang` で出ます。印はボタンなので、キーボードで移動でき、画面読み上げソフトは名前と説明を読みます。印が出ている間、要素の役割は `img` ではなく `group` になります。
- **クリックか Enter** で `wakusei-place` (バブルし、composed) が届きます。`detail: { body, place, x, y }` に、場所の記録全体と印の位置があります。
- **`goToPlace(名前か id)`** は、`<wakusei-body>` を回して、その場所を円盤の真ん中に持ってきます。`<wakusei-space>` では `goToPlace(名前, { body })` で、その天体まで行き、カメラを場所の真上に置きます。どちらも目で追える速さで動きます。動きを減らす設定にしている人や、`smooth: false` のときは、すぐに移ります。自分で回る天体は、そこからまた回り続けます (`turn="0"` なら止まったままです)。
- **見た目。** 印は要素のパーツ (`::part(place)`、`::part(place-tip)`) で、色は `--wakusei-place-landing`、`--wakusei-place-crash`、`--wakusei-place-planned`、`--wakusei-place-feature`、名前のフォントは `--wakusei-place-font` (なければページのゴシック体) です。
- **印のために描くことはありません。** 印は、表示がもともと描くたびに、その上に置き直すだけです。印を指したり名前を出したりしても、描き直しは起きません。`placesShown` プロパティは、いま付いている印 (場所の id、種類、位置) の一覧で、テストや、自分で描くページに使えます。

計算だけの部分は `/places` にもあります。`placeMarks(list, layers, view, radiusKm)` は、自分で描く表示に付ける印を選びます (天体の軸、目の位置、投影を渡します)。`surfacePoint` は場所を天体の楕円体の上に置き、`turnToPlace` は `<wakusei-body>` が使う回し方です。

## どこにあるか、どこまで確かか

場所の `lat` は惑星中心緯度で北が正、`lon` は -180 から 180 の東経です。月の経度は平均地球・極軸系、火星の経度は IAU の座標系です。IAU 惑星地名辞典は火星の経度を 0 から 360 の東経で書いていて、変換してあります。**火星の場所はすべて惑星中心緯度です。** IAU 惑星地名辞典の地形はそうです。着陸機は、緯度が惑星中心のものである出典を1つ選ぶか、惑星測地緯度のものを tan(惑星中心緯度) = 0.98826 × tan(惑星測地緯度) で変換しています (IAU 2000 の半径 3396.19 km と 3376.2 km。緯度20度で 0.2 度の差があり、北ほど大きくなります)。どちらかは `source.latitude` に書いてあります。`planetocentric` (NSSDCA のバイキングのページ、Mars Orbital Data Explorer にあるスピリット、オポチュニティ、マーズ・パスファインダーの電波追跡による位置)、`converted` (フェニックス。68.22 N と書かれていて惑星測地緯度とみなし、ここでは 67.99 N)、`not stated` (GCAT の行と、NASA GISS のインサイトの値。それぞれのページに座標の定義が書かれていないもの) です。火星の5件が GCAT の位置から動きました。バイキング1号が 24 km、マーズ・パスファインダーとソジャーナが 22 km (GCAT のパスファインダーは惑星測地緯度の 19.33 N)、フェニックスが 14 km、インサイトが 3 km です。

月の地点の位置は、NASA の「月面の人工物の衝突と探査機の表」(LRO の画像による位置を載せたもの) のものです。GCAT にある探査機の位置がこの表にあるときは、表の位置を記録に使い (`source.id` は `nssdca`)、GCAT 自身の値が 0.05 度を超えて違うときは `gcatPosition` に残します。これで GCAT の月の位置のうち18件が置き換わりました。そのうち3件はカタログの明らかな誤りで、ページに描くと赤道や本初子午線の反対側に出てしまうものでした。サーベイヤー1号 (カタログは北緯 2.47 度、NASA の表は南緯 2.47 度)、IM-2 アテナ (西経 29.2 度に対して東経 29.2 度)、アポロ16号の子衛星 (0, 0 と記載) です。表では大まかな位置しかない探査機や、カタログにしかない探査機もあり、それらの記録には `approximate: true` が付きます。これは1度以下の精度で書かれた位置にも付き、実際の場所は点から数十 km 離れていることがあります (ルナ2号、ルナ7号、ルナ8号、ひてん、ルナ・プロスペクター、チャンドラヤーン1号の衝突機。火星ではマルス2号、マルス6号、ディープ・スペース2とポーラー・ランダー。位置が1度以下の精度で与えられています)。ルナ9号にも付けています。その位置は最初のソ連の報告のもので、NASA の表は着陸機がその地点にはないと述べています (カタログとは 0.75 度、23 km 違います)。そのほかの火星の地点は GCAT のものです。

**月と火星以外の天体。** 地形はすべて IAU 惑星地名辞典の中心点です。そのシェープファイルは「東経、惑星中心緯度」(IAU 惑星地名辞典自身のページにそう書かれています) で、-180 から 180 の東経で保持しています (金星・水星・衛星の 0 から 360 は変換しています)。ベスタの経度は、IAU 惑星地名辞典の小惑星用の座標系のものです。地点の `source.latitude` は、出典が示していない場合は `not stated` です (これらの天体の地点は、PDS のファイルが惑星中心と書くニアを除いてすべて)。巨大惑星の突入点は NASA の表記のままです (ガリレオのプローブは北緯 6.5 度、西経 4.4 度、カッシーニは北緯 9.4 度、西経 53 度。どちらのページも座標系を書いていません)。出典の位置が GCAT より確かなときはそれを使い、2つが 0.05 度を超えて違うときは GCAT の値を `gcatPosition` に残します。ベネラ9号と10号は 1.0 度と 0.8 度、ベガ2号は 3.5 度、パイオニア・ヴィーナスの母船は 6 度、カッシーニは 7.5 度、パイオニア・ヴィーナスの北プローブは 69 度違います。GCAT は北プローブの緯度と経度を逆に書いているようです (GCAT は北緯 4.4 度、東経 60.1 度、PDS は北緯 59.3 度、東経 4.8 度)。メッセンジャー、ホイヘンス、DART は GCAT と一致します。**確かさが低いもの:** ベネラ4号から7号、11号、12号、ベンヌのナイチンゲール、木星のガリレオ周回機は、GCAT の丸めた値です (`approximate`)。エロスへのニアの接地は NASA の PDS のファイル (南緯 37.2 度、西経 278.4 度、つまり東経 81.6 度) から入力しましたが、そのファイルは自動読み取りを拒否したため、ページとは照合していません。フィラエのアビドスは、論文が先行論文を引用した値で、彗星固定座標系です。テンペル第1彗星の衝突点は2013年の形状モデルの座標系です (古いモデルでは南緯 26 度、東経 15 度でした)。ガリレオ周回機の経度はカタログのものです。糸川 (はやぶさの2回のタッチダウンとミネルバ)、フィラエの最初の接地点アジルキア、ロゼッタの最後の降下、ミネルバII の探査ロボット、マゼラン・パイオニア・ヴィーナス周回機・ビーナス・エクスプレスの最後の位置は収録していません。確かめられる位置が見つからなかったからです。テストは、これらの位置を、入力したとおりに、記録に書かれた出典とともに固定しています。

テストは、21の位置を、表がその位置を取った出典とは別の出典に対して確かめます。NASA のアポロ11号、アポロ17号、バイキング1号のページ、IAU 惑星地名辞典の名前のある着陸地点 (Statio Tranquillitatis、Guang Han Gong、嫦娥4号・5号・6号とチャンドラヤーン3号の Statio)、NASA GISS の火星着陸機の一覧 (キュリオシティ、パーシビアランス、スピリット、オポチュニティ、フェニックス、祝融号)、Mars Orbital Data Explorer のバイキングの位置、NSSDCA のマーズ・パスファインダーのページ (惑星測地緯度の値で、テストが変換します) です。0.012 度 (火星で 700 m、月で 360 m) 以内で一致しますが、ルナ9号 (0.8) とマーズ・パスファインダー (0.3。着陸前にバイキングの画像から出した推定値) は例外です。

## 検索

```ts
import { PLACES_MARS } from "@johnmorrisdotca/wakusei-planets/places/mars";
import { findPlace, listPlaces, placesNear, placesOfKind } from "@johnmorrisdotca/wakusei-planets/places";

console.log(placesOfKind(PLACES_MARS, "rover").map((place) => place.name.en).join(", "));
const jezero = findPlace(PLACES_MARS, "Jezero")!;
console.log(jezero.feature?.diameterKm, "km;", placesNear(PLACES_MARS, jezero.lat, jezero.lon, 3).filter((n) => n.place.kind !== "feature").map((n) => n.place.name.en));
console.log((await listPlaces("moon", "crash", "impact")).length, "crash and impact sites on the Moon");
```

`findPlace(list, text)` は、id (`mars/perseverance`)、大文字小文字を区別しない英語名、日本語名のどれでも受け付けます。`placesOfKind(list, ...kinds)` は絞り込み、`placesNear(list, lat, lon, withinDeg)` はある角度以内の場所を近い順に返し、`nearestPlace(list, lat, lon, ...kinds)` は指定した種類のうち最も近いものを返します (アポロの地点のまわりには名前のある地形が多いので、着陸地点がほしいときは訪れた種類を指定してください)。`listPlaces(body, ...kinds)` と `loadPlaces(body)` は、必要なときに表を取り込みます。`placeDistanceKm(body, a, b)` は、その天体の赤道半径の球での地表上の大円距離です (a と b は、場所か `{ lat, lon }`)。

## 天体上の太陽

```ts
import { subSolarPoint, terminator } from "@johnmorrisdotca/wakusei-planets/places";

const day = Date.UTC(2026, 10, 11, 12);
const sun = subSolarPoint("mars", day);
console.log("The Sun is overhead at", sun.lat.toFixed(1), "N,", sun.lon.toFixed(1), "E on Mars");
console.log(terminator("moon", day, 36).length, "points on the Moon's terminator");
```

`subSolarPoint(body, when)` は太陽が真上にある地点で、このパッケージ自身の暦と、その天体の IAU の極と本初子午線から求めます。`terminator(body, when, points)` はそこから90度の大円で、地図や地球儀に線を引くためのものです。`localSolarTime(body, lon, when)` は、その経度での、天体自身の太陽日の時刻です (太陽が真上で12時、東へ15度ごとに1時間遅くなります)。`isDaylight(body, lat, lon, when)` は、なめらかな地平線の上に太陽の中心があるかどうかです。この2つの天体だけでなく、パッケージが極を持つ天体なら使えます。`angleBetween` は2点間の角度です。

## 入力が正しくないとき

`Date` でも数でもない `when` は `TypeError`、無効な値や有限でない値は `RangeError` です。有限の数でない緯度や経度は `RangeError` です。場所を持たない天体 (`loadPlaces("earth")`、`placeDistanceKm("earth", ...)`) は、持っている天体の名前を書いた `RangeError` です。`BODIES` に半径のない天体 (エロス、リュウグウ、ベンヌ、ディモルフォスと2つの彗星。球ではありません) の距離も `RangeError` です。`findPlace` は知らない名前に `undefined` を返し、`nearestPlace` は空の一覧に `undefined` を返します。

## 数値の出どころ

場所を表示するページは、各出典に対する表示義務があります。`/places` の `PLACES_CREDITS` が、表が使う `source.id` ごとに、表示する文、ライセンス、アドレスを持っています。着陸機カタログの表示はライセンスの条件です。「data from GCAT (J. McDowell, planet4589.org/space/gcat)」です。

月の地点の位置は、NASA の NSSDCA の「月面の人工物の衝突と探査機の表」(<https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html>、米国政府の著作物) です。日付、運用者、国、着陸地点の名前、火星の地点は、GCAT (General Catalog of Artificial Space Objects。J. McDowell) のもので、CC BY 4.0 で公開されています。出典の表示は「data from GCAT (J. McDowell, planet4589.org/space/gcat)」です。名前のある地形は、USGS 天体地質学科学センターが管理する IAU 惑星地名辞典 (<https://planetarynames.wr.usgs.gov/>、米国パブリックドメイン) のものです。ほかの天体の地点は、NASA の Photojournal とミッションのページ (メッセンジャー、ホイヘンス、ガリレオ、カッシーニ)、惑星データシステムのパイオニア・ヴィーナスのまとめ、NASA 技術報告書サーバー (金星の着陸機)、各記録の `source.url` にある論文 (DART、テンペル第1彗星、フィラエ) から入力し、日付、運用者、そのほかは GCAT のものです。`scripts/make-places-data.py` が月と火星の表を、`scripts/make-places-more-data.py` がほかの天体の表を出典のファイルから作り、`scripts/make-places-checks.py` がテストの使う第二の出典のファイルを作ります。それぞれをどう読んだかは [NOTICE.md](../../../NOTICE.md) にあります。ページに表示する、カタログの技術的な天体名に代わる名前と、日本語の名前は、このパッケージで定めたものです。
