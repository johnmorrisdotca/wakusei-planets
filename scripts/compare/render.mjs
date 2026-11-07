// The same data feeds both translations; only the surrounding prose differs.
export const START='<!-- comparison:start -->';
export const END='<!-- comparison:end -->';
const names={wakusei:'wakusei',astronomyEngine:'astronomy-engine',solarsystem:'solarsystem',suncalc:'suncalc'};
const n=x=>x.toFixed(3);
function table(rows,limits,ja){
  const headings=ja?['天体','wakusei（秒角）','上限','astronomy-engine','solarsystem','suncalc']:['Body','wakusei (arcsec)','Limit','astronomy-engine','solarsystem','suncalc'];
  return ['| '+headings.join(' | ')+' |','|---|---:|---:|---:|---:|---:|',...rows.map(r=>{
    const cells=['wakusei','astronomyEngine','solarsystem','suncalc'].map(k=>r.errors[k]?n(r.errors[k].maxArcsec):'—');
    if(['ceres','eris'].includes(r.body))cells[2]+='†';
    return `| ${r.body} | ${cells[0]} | ${limits[r.body]===undefined?'—':n(limits[r.body])} | ${cells.slice(1).join(' | ')} |`;
  })].join('\n');
}
function sizes(data,ja){
 const head=ja?'| パッケージ・版 | 測定したコード | gzip（バイト） | ライセンス |':'| Package/version | Measured code | Gzip bytes | Licence |';
 const profiles=ja?{wakusei:'メイン全出力＋/suncalc 全出力＋全ての任意テーブル',astronomyEngine:'ESM エントリーの全出力',solarsystem:'Python 全モジュールのソース（下記参照）',suncalc:'ESM エントリーの全出力'}:{wakusei:'All main exports + all /suncalc exports + both optional tables',astronomyEngine:'All ESM entry exports',solarsystem:'All Python module source (see caveat)',suncalc:'All ESM entry exports'};
 return [head,'|---|---|---:|---|',...Object.entries(data.packages).map(([k,v])=>`| ${names[k]} ${v.version} | ${profiles[k]} | ${v.gzipBytes.toLocaleString('en-US')} | ${v.license} |`)].join('\n');
}
export function render(data,limits,ja=false){
 const geometric=data.summary.filter(r=>r.group!=='apparentAirlessTopocentric');
 const horizon=data.summary.filter(r=>r.group==='apparentAirlessTopocentric');
 const modern=data.modernSummary.filter(r=>r.errors.astronomyEngine||r.errors.solarsystem||r.errors.suncalc);
 const alt=['ceres','eris'].map(body=>`${body}: ${n(Math.max(...data.rows.filter(r=>r.body===body).map(r=>r.alternatives.solarsystemOfDateArcsec)))}`).join('; ');
 const body=ja?`
## 他のパッケージとの比較

同じ日時を各パッケージに渡し、JPL Horizons との方向のずれを測定しました。以下は**この少数の日付での一致度**であり、全期間での保証でも、観測そのものに対する精度の証明でもありません。小さい値ほど良い結果です。未対応・未測定は「—」で、ゼロ誤差という意味ではありません。

測定した wakusei は package.json 上の版 ${data.packages.wakusei.version}、**未リリースのソース [${data.packages.wakusei.sourceRevision.slice(0,7)}](https://github.com/johnmorrisdotca/wakusei-planets/tree/${data.packages.wakusei.sourceRevision})** です。同じ版番号の古い npm リリースの測定値という意味ではありません。

### 共有できる 1950–2050 年のサンプル

全期間の最大値だけでは、対応期間外の呼び出しや暦の問題が順位を支配します。まず 1950 年以降、2050-01-01T12:00:00Z までの共通サンプルを示します。天体によって日付とサンプル数は異なります。planet は3日、dwarf は4日、moon は5日、horizon は6日です。

${table(modern,limits,true)}

**Astronomy Engine が良い場合もあります。** この部分集合では地球・地心の太陽と、ガリレオ衛星4個すべてで最大誤差が小さくなりました。全期間でも地球・地心の太陽・ガニメデ・カリストでは Astronomy Engine が勝ちます。wakusei は地球以外の8行（惑星と冥王星）と地球の月で小さい最大誤差を示しますが、個々の日付で常に勝つわけではありません。サイズでも勝者ではありません。

### 幾何学的位置：全ての参照日

単位はすべて秒角です。惑星は1800–2050年の5日、準惑星は1900–2099年の6日、衛星は1900–2100年の7日です。太陽は惑星と同じ5日に地心から測定します。ベクトルは地球のベクトルの符号を反転したものなので、その方向誤差は地球と同じで、独立した証拠ではありません。これらの期間はパッケージ共通の保証範囲ではありません。

${table(geometric,limits,true)}

惑星・準惑星は太陽中心、衛星は親天体中心（Nix・Hydra は冥王星系の重心）、太陽は地球中心です。参照は J2000 平均黄道の幾何学的ベクトルです。木星から冥王星は惑星単体の中心ではなく、惑星系の重心が Horizons の対象です。公開 API が明示しない中心の違いも小さな誤差に寄与し得ます。距離の誤差は順位付けしません。wakusei は全ての任意テーブルを読み込みます。Astronomy Engine の HelioVector・GeoMoon・JupiterMoons は J2000 赤道から固定黄道傾斜角で回転します。Python solarsystem は precession=False の平均日付黄道座標を IAU 1976 歳差・平均黄道傾斜角で J2000 に変換します。緯度を捨てる経度差ではなく、正規化した3次元ベクトル間の角度を安定な atan2 式で求めます。

† Ceres・Eris の Python スコアは、元期付き軌道要素を固定 J2000 座標と解釈した値です。公開 API はこの2天体の座標系を明確に保証していないため、確定的な順位には使いません。日付黄道と解釈した場合の全期間最大値は ${alt} 秒角です。両方の解釈を結果 JSON に保持しています。

Python パッケージの内部ユリウス日は、1800年のサンプルで2日、1900年1月のサンプルで1日早い値になります。入力日は修正していません。これは全期間表の大きな誤差の一因であり、通常期間の軌道精度だけを示す数値ではありません。Chiron は Python 側にありますが、共有できる参照・wakusei の実装がないため採点しません。

### 観測者から見た太陽・月：別の量

SunCalc の公開 API は視位置の地平座標を返すため、幾何学的な惑星表には混ぜません。既存の惑星・月の日付の和集合9日を使い、北緯35°・東経−105°・楕円体高0mで Horizons の視位置・大気差なしの方位角と高度を別途取得しました。各ライブラリーの大気差だけを数値的に取り除き、視差・光行差・光行時間・恒星時モデルの差は残して比較します。地平線より下も含み、天候や大気モデル自体の精度は測りません。

${table(horizon,limits,true)}

SunCalc 2.1.2 の TT−UT 多項式は約1900–2150年を対象とし、1800年は範囲外です。上の全期間値にはその外挿も含まれるため、通常期間の精度として宣伝してはいけません。1950–2050年の結果は最初の表にあります。この比較は方向だけです。出没時刻・食・位相の精度は証明しません。

### サイズ・ライセンス・再現

${sizes(data,true)}

JavaScript は esbuild 0.25.12 で全出力を ESM にバンドルして最小化し、gzip level 9 で圧縮します。wakusei の測定にはこの表で使う任意データと /suncalc を含み、メインの SVG・天体情報も含みます。Python はファイル名順の .py 全文を連結した gzip であり、JS バンドルとの単純な大小比較には使えません。どの値も言語ランタイム・インストール用メタデータ・画像を除きます。Python や Node の版によって gzip が少し変わることがあります。root の依存関係と src/ は変更していません。記録環境は Node ${data.runtime.node}、Python ${data.runtime.python} です。再現確認では gzip の64バイト以内の差だけを許し、最小化コードのバイト数とソースの指紋は一致を求めます。

同じ UTC インスタントを渡します。wakusei は理論を TT で実行し、Astronomy Engine は自身の Delta-T モデル、SunCalc は自身の TT−UT 多項式を使います。Python solarsystem は UT の日数をそのまま理論に使います。歴史的な Horizons の UT は近代的な UTC と同一ではなく、UT1・地球姿勢・将来の Delta-T の扱いも誤差に含まれます。入力時刻を調整して相手の結果を良くすることはしていません。同じ UTC 入力でも、内部の TT の仮定が一致するとは限りません。

リポジトリーのルートから次の順に実行します（Node 24以上、Python 3.12以上）。初回のインストールだけネットワークが必要です。通常の比較は保存した参照を使うためオフラインで実行できます。

~~~sh
pnpm install --frozen-lockfile
pnpm --dir scripts/compare install --frozen-lockfile --ignore-scripts
python3 -m venv scripts/compare/.venv
scripts/compare/.venv/bin/python -m pip install --require-hashes --only-binary=:all: --no-deps -r scripts/compare/requirements.txt
node scripts/compare/run.mjs
node scripts/compare/run.mjs --check
pnpm check
pnpm docs:check
~~~

Windows の仮想環境は Scripts/python.exe を使います。COMPARE_PYTHON で Python の実行ファイルを明示できます。run.mjs は results.json とこの英日セクションを生成します。--check は生成済みの値と文書が一致するか確認します。test/comparison.test.ts は第三者のインストールなしで、同じ参照日の wakusei の値が公開上限を超えないことを検査します。上限は自動で緩めません。

参照ベクトル・APIパラメーター・全ての日付ごとの誤差とワースト日付は scripts/compare/ にあります。新しい地平座標の参照を取得する場合だけ python3 -I scripts/compare/fetch-observer.py を実行します。浮動小数点の丸めによるゼロを避けるため、極小の角度にも acos を使いません。Horizons ベクトルは0.1km単位に丸められています。適合テーブルは同じ Horizons を元に作ったものなので、この表はその参照への一致度を示します。全期間の精度、未知の日付での精度、パッケージ全体の優劣はこの少数の点だけでは証明できません。

出典：[Astronomy Engine API](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md)、[solarsystem](https://github.com/IoannisNasios/solarsystem/blob/master/README.md)、[SunCalc](https://github.com/mourner/suncalc/blob/master/README.md)、[Schlyter の日付座標系・暦の範囲](https://stjarnhimlen.se/comp/ppcomp.html)、[Horizons の定義](https://ssd.jpl.nasa.gov/horizons/manual.html)。

### 実行していないもの：README の主張だけ

[Caelis Engine](https://github.com/HermeticaLabs/caelis-engine/blob/main/README.md) は AGPL-3.0 で、VSOP87B と ELP/MPP02-LLR を使うと説明しています。[Pyswisseph](https://github.com/astrorigin/pyswisseph/blob/master/README.rst) は AGPL-3.0 で、JPL DE431 に基づく高精度エフェメリスと説明しています。[ephemeris](https://github.com/hemantgoswami/ephemeris/blob/master/README.md) は Moshier 系の実装と説明し、元の [README](https://github.com/mivion/ephemeris/blob/master/README.md) は GPL-2 を明記しています。これらは2026-11-07に確認した**公開READMEの主張**で、今回の測定値ではありません。どれもインストール・実行していません。各 README にこの表と同じ条件の数値上限はないため、誤差の数値を作って補うことはしません。
`:`
## Compared with other packages

We passed the same instants to each package and measured its direction error against JPL Horizons. These are **agreements on this sparse sample**, not guarantees over a whole date range or proof against physical observations. Smaller is better. A dash means unsupported or not measured, never zero error.

Measured wakusei code: package.json version ${data.packages.wakusei.version}, **unreleased source revision [${data.packages.wakusei.sourceRevision.slice(0,7)}](https://github.com/johnmorrisdotca/wakusei-planets/tree/${data.packages.wakusei.sourceRevision})**. This is not a claim about the older npm release with that version label.

### Shared samples from 1950–2050

A full-range maximum can be dominated by out-of-range calls or calendar bugs. Start with the shared samples from 1950 through 2050-01-01T12:00:00Z. Dates and counts differ by body: 3 planet dates, 4 dwarf dates, 5 moon dates, and 6 horizon dates.

${table(modern,limits,false)}

**Astronomy Engine wins some comparisons.** In this subset it has smaller maximum errors for Earth, the geocentric Sun, and all four Galilean moons. Across the full fixture it also wins Earth, the geocentric Sun, Ganymede and Callisto. Wakusei has smaller maxima for the other eight planet/Pluto rows and Earth's Moon, but does not win at every individual date. It is not the smallest package, either.

### Geometric positions: all reference dates

Every error is in arcseconds. Planets use 5 dates across 1800–2050; dwarfs 6 across 1900–2099; moons 7 across 1900–2100. The geocentric Sun uses the same 5 dates as Earth. Its vector is the negative Earth vector, so its direction error duplicates Earth rather than adding independent evidence. These spans are not a shared validity guarantee from the packages.

${table(geometric,limits,false)}

Planets and dwarfs are heliocentric; moons are relative to their parent (Nix/Hydra to the Pluto-system barycentre); the Sun is geocentric. The reference is geometric J2000 mean ecliptic. For Jupiter through Pluto the Horizons target is the planetary-system barycentre, not the isolated planet centre; unexposed native centre conventions may contribute to small differences. Radius/distance errors are not ranked. Wakusei loads both optional tables. Astronomy Engine's HelioVector, GeoMoon and JupiterMoons are rotated from J2000 equatorial axes by the fixed obliquity. Python solarsystem uses precession=False; mean ecliptic-of-date directions are rotated to J2000 with IAU 1976 precession and mean obliquity. We measure the stable atan2 angle between normalized 3D vectors, not just longitude differences that discard latitude.

† The Python Ceres/Eris values interpret the epoch-based orbital elements as fixed J2000 axes. The public API does not clearly guarantee the frame for these two bodies, so they are not definitive rankings. Interpreting them as ecliptic of date gives full-range maxima of ${alt} arcsec instead. Both interpretations are retained in the result JSON.

The Python package's internal Julian date is two days early at the 1800 sample and one day early at the January 1900 sample. We do not repair its input date. This contributes to the large full-range errors; they do not describe orbital-model accuracy alone in its normal period. Chiron exists in the Python package but has no shared reference or wakusei implementation here, so is not scored.

### Observer Sun/Moon directions: a separate quantity

SunCalc's public API returns apparent horizontal directions, so it is not mixed into the geometric planet table. For the union of the existing planet and Moon dates (9 instants), a separate Horizons request gives apparent AIRLESS azimuth/elevation at latitude 35°, longitude −105°, ellipsoidal height 0 m. We numerically remove only each package's atmospheric correction, retaining its native parallax, aberration, light-time and sidereal-time models. Below-horizon cases remain included. This does not measure weather or the accuracy of an atmospheric model itself.

${table(horizon,limits,false)}

SunCalc 2.1.2's TT−UT polynomial targets approximately 1900–2150; 1800 is outside it. Its full-range values above include that extrapolation and must not be advertised as normal-period accuracy. The shared 1950–2050 results are in the first table. Only directions are tested: these numbers do not establish rise/set, eclipse or phase accuracy.

### Size, licences and reproduction

${sizes(data,false)}

JavaScript sizes bundle every export as ESM with esbuild 0.25.12, minify, then gzip at level 9. The wakusei profile includes the optional data used by these rows, /suncalc, and the main entry's SVG/facts API. Python is a gzip of all .py module source, concatenated in filename order; it is not directly comparable to a JS bundle. Every size excludes language runtimes, installation metadata and images. Gzip can vary slightly with Python/Node versions. Root dependencies and src/ are unchanged. Sizes were recorded with Node ${data.runtime.node} and Python ${data.runtime.python}; reproduction accepts up to 64 bytes of gzip variation but requires identical minified bytes and source fingerprints.

Each package receives the same UTC instant. Wakusei runs its theories in TT; Astronomy Engine uses its own Delta-T model; SunCalc uses its TT−UT polynomial; Python solarsystem uses UT day counts directly in its theory. Historical Horizons UT is not identical to modern UTC; UT1/Earth-orientation handling and future Delta-T differences also enter the errors. We do not adjust input clocks to improve a competitor's score. Equal UTC inputs do not imply identical internal TT assumptions.

Run from the repository root (Node 24+, Python 3.12+). Initial installation needs the network; ordinary comparisons use checked-in references and run offline.

~~~sh
pnpm install --frozen-lockfile
pnpm --dir scripts/compare install --frozen-lockfile --ignore-scripts
python3 -m venv scripts/compare/.venv
scripts/compare/.venv/bin/python -m pip install --require-hashes --only-binary=:all: --no-deps -r scripts/compare/requirements.txt
node scripts/compare/run.mjs
node scripts/compare/run.mjs --check
pnpm check
pnpm docs:check
~~~

On Windows use Scripts/python.exe in the virtual environment; COMPARE_PYTHON can name an explicit interpreter. run.mjs writes results.json and these English/Japanese sections. --check verifies the stored scores and generated documentation. test/comparison.test.ts recomputes wakusei's column on the same dates without installing third-party comparators; published limits are never relaxed automatically.

scripts/compare/ retains reference vectors, request parameters, per-date errors and worst dates. Only to refresh the additional horizon reference, run python3 -I scripts/compare/fetch-observer.py. Small angles use atan2 rather than acos to avoid cancellation to zero. The geometric Horizons vectors are rounded to 0.1 km. The fitted tables were built from Horizons too, so this measures agreement with that parent ephemeris. Sparse samples cannot prove full-range precision, precision at unseen dates, or blanket superiority of a package.

Sources: [Astronomy Engine API](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md), [solarsystem](https://github.com/IoannisNasios/solarsystem/blob/master/README.md), [SunCalc](https://github.com/mourner/suncalc/blob/master/README.md), [Schlyter’s mean-of-date conventions and calendar range](https://stjarnhimlen.se/comp/ppcomp.html), [Horizons definitions](https://ssd.jpl.nasa.gov/horizons/manual.html).

### Not executed: README claims only

[Caelis Engine](https://github.com/HermeticaLabs/caelis-engine/blob/main/README.md) is AGPL-3.0 and advertises VSOP87B plus ELP/MPP02-LLR. [Pyswisseph](https://github.com/astrorigin/pyswisseph/blob/master/README.rst) is AGPL-3.0 and describes a high-precision ephemeris based on JPL DE431. [ephemeris](https://github.com/hemantgoswami/ephemeris/blob/master/README.md) describes a Moshier-derived implementation; its upstream [README](https://github.com/mivion/ephemeris/blob/master/README.md) declares GPL-2. These are **publisher README claims**, reviewed 2026-11-07, not measurements from this run. None was installed or executed. The linked READMEs do not provide bounds under this table's conditions; we do not invent numeric scores for them.
`;
 return `${START}\n${body.trim()}\n${END}`;
}
