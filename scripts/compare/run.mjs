// Reproducible development benchmark. Never imported by the package runtime.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import * as A from 'astronomy-engine';
import * as S from 'suncalc';
import { ourVector, ourHorizontal } from './our.mjs';
import { render, START, END } from './render.mjs';
import { AU_KM, EPS0, RAD, arcsec, direction, dateEclipticToJ2000, rotateX, removeRefraction } from './math.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const referenceBytes=readFileSync(new URL('../../test/data/horizons.json',import.meta.url));
const reference=JSON.parse(referenceBytes);
const observerBytes=readFileSync(new URL('horizons-observer.json',import.meta.url));
const observer=JSON.parse(observerBytes);
const limits=json('limits.json');
const dates=[...new Set([...reference.planetDates,...reference.moonDates,...reference.dwarfDates])].sort();
const python=process.env.COMPARE_PYTHON || fileURLToPath(new URL(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python',import.meta.url));
const pythonRun=spawnSync(python,['-I',fileURLToPath(new URL('python-adapter.py',import.meta.url))],{input:JSON.stringify({dates}),encoding:'utf8'});
if(pythonRun.status!==0)throw new Error(`Set up scripts/compare/.venv first: ${pythonRun.stderr || pythonRun.error}`);
const py=JSON.parse(pythonRun.stdout);
const columns=['wakusei','astronomyEngine','solarsystem','suncalc'];
const rows=[];
const aeVector=(v)=>rotateX([v.x*AU_KM,v.y*AU_KM,v.z*AU_KM],-EPS0);
function record(body,group,date,target,vectors) {
  const errors=Object.fromEntries(columns.map(k=>[k,vectors[k]===undefined?null:arcsec(vectors[k],target)]));
  const alternatives = ['ceres','eris'].includes(body) && vectors.solarsystem ? { solarsystemOfDateArcsec: arcsec(dateEclipticToJ2000(vectors.solarsystem,Date.parse(date)),target) } : undefined;
  rows.push({body,group,date,reference:target,vectors,errors,...(alternatives?{alternatives}:{})});
}
for(const [group,dateKey] of [['planets','planetDates'],['dwarfs','dwarfDates'],['moons','moonDates']]) {
  for(const [body,samples] of Object.entries(reference[group])) {
    for(let i=0;i<samples.length;i++) {
      const date=reference[dateKey][i], ms=Date.parse(date), time=A.MakeTime(new Date(ms));
      const vectors={wakusei:ourVector(body,ms,group)};
      const name=body[0].toUpperCase()+body.slice(1);
      if(group==='planets')vectors.astronomyEngine=aeVector(A.HelioVector(A.Body[name],time));
      else if(body==='moon')vectors.astronomyEngine=aeVector(A.GeoMoon(time));
      else if(['io','europa','ganymede','callisto'].includes(body))vectors.astronomyEngine=aeVector(A.JupiterMoons(time)[body]);
      const native=body==='moon'?py.rows[date].moon:group!=='moons'?py.rows[date].planets[body]:undefined;
      if(native){
        const km=direction(native[0],native[1],native[2]*(body==='moon'?6378.14:AU_KM));
        vectors.solarsystem=['ceres','eris'].includes(body)?km:dateEclipticToJ2000(km,ms);
      }
      record(body,group,date,samples[i],vectors);
    }
  }
}
// Geometric geocentric Sun: negative of Earth's heliocentric vector, same instant.
for(let i=0;i<reference.planetDates.length;i++) {
  const date=reference.planetDates[i],ms=Date.parse(date);
  record('sun','geocentricSun',date,reference.planets.earth[i].map(x=>-x),{
    wakusei:ourVector('sun',ms,'geocentricSun'),
    astronomyEngine:aeVector(A.HelioVector(A.Body.Earth,new Date(ms))).map(x=>-x),
    solarsystem:dateEclipticToJ2000(direction(py.rows[date].planets.earth[0],py.rows[date].planets.earth[1],py.rows[date].planets.earth[2]*AU_KM),ms).map(x=>-x),
  });
}
// Native SunCalc 2.1.2 positions contain refraction. Remove ONLY the atmospheric
// correction numerically (Meeus 16.4), then compare apparent AIRLESS topocentric
// directions. This preserves the native parallax, sidereal-time and body models.
const suncalcRefraction=alt=>0.0002967/Math.tan(Math.max(0,alt)*RAD+0.00312536/(Math.max(0,alt)*RAD+0.08901179))/RAD;
for(const body of ['sun','moon'])for(let i=0;i<observer.dates.length;i++) {
  const date=observer.dates[i], d=new Date(date),{latitude:lat,longitude:lon,heightM}=observer.observer;
  const key=body==='sun'?'getPosition':'getMoonPosition';
  const sc=S[key](d,lat,lon);
  const place=new A.Observer(lat,lon,heightM);
  const eq=A.Equator(body==='sun'?A.Body.Sun:A.Body.Moon,d,place,true,true);
  const ae=A.Horizon(d,place,eq.ra,eq.dec);
  const target=observer.bodies[body][i];
  record(`${body} (horizon)`,'apparentAirlessTopocentric',date,direction(target.azimuth,target.altitude),{
    wakusei:ourHorizontal(body,date,observer.observer),
    astronomyEngine:direction(ae.azimuth,ae.altitude),
    suncalc:direction(sc.azimuth,removeRefraction(sc.altitude,suncalcRefraction)),
  });
}
function aggregate(samples) {
  const result=[];
  for(const body of [...new Set(samples.map(r=>r.body))]) {
    const group=samples.filter(r=>r.body===body);
    result.push({body,group:group[0].group,count:group.length,errors:Object.fromEntries(columns.map(k=>{
      const cells=group.filter(r=>r.errors[k]!==null);
      const worst=cells.reduce((a,b)=>!a||b.errors[k]>a.errors[k]?b:a,null);
      return [k,worst?{maxArcsec:worst.errors[k],worstDate:worst.date,samples:cells.length}:null];
    }))});
  }
  return result;
}
async function size(entry){
  const result=await build({entryPoints:[entry],bundle:true,minify:true,format:'esm',platform:'node',write:false,logLevel:'silent',metafile:true});
  const data=result.outputFiles[0].contents;
  return {minifiedBytes:data.byteLength,gzipBytes:gzipSync(data,{level:9}).byteLength,sourceFiles:Object.keys(result.metafile.inputs).length};
}
// Virtual entry preserves ALL exports of each measured API; no function subset cherry-picking.
async function ourSize(){
  const result=await build({stdin:{contents:`export * from './src/index.ts'; export * as sky from './src/suncalc.ts'; import './src/tables/all.ts';`,resolveDir:root},bundle:true,minify:true,format:'esm',platform:'node',write:false,logLevel:'silent'});
  return {minifiedBytes:result.outputFiles[0].contents.length,gzipBytes:gzipSync(result.outputFiles[0].contents,{level:9}).length,bundleSha256:createHash('sha256').update(result.outputFiles[0].contents).digest('hex')};
}
const previous=process.argv.includes('--check')?json('results.json'):null;
const sourceRevision=previous?.packages.wakusei.sourceRevision || spawnSync('git',['log','-1','--format=%H','--','src'],{cwd:root,encoding:'utf8'}).stdout.trim();
if(!/^[a-f0-9]{40}$/.test(sourceRevision))throw new Error('cannot identify measured model source revision');
const output={schemaVersion:1,runtime:{node:process.version,python:py.python},observerFixtureSha256:createHash('sha256').update(observerBytes).digest('hex'),fixtureSha256:createHash('sha256').update(referenceBytes).digest('hex'),
  configuration:{vectorUnits:'km for geometric vectors; unit local north/east/up directions for horizon rows',pythonMoonEarthRadiusKm:6378.14,frame:'geometric J2000 mean ecliptic; separate apparent airless topocentric horizon rows',observer:observer.observer,solarsystemPrecession:false,solarsystemFrames:{planetsAndMoon:'mean ecliptic of date',ceresAndEris:'fixed J2000 element-frame interpretation; alternative of-date scores retained'}},
  packages:{
    wakusei:{version:json('../../package.json').version,sourceRevision,license:'MIT',...await ourSize()},
    astronomyEngine:{version:'2.1.19',license:'MIT',...await size(fileURLToPath(import.meta.resolve('astronomy-engine')))},
    solarsystem:{version:py.version,license:'MIT',gzipBytes:py.sourceGzipBytes,sourceSha256:py.sourceSha256},
    suncalc:{version:'2.1.2',license:'BSD-2-Clause',...await size(fileURLToPath(import.meta.resolve('suncalc')))},
  },
  calendarOffsets:dates.map(date=>({date,days:py.rows[date].julianDate-(Date.parse(date)/86400000+2440587.5)})),
  summary:aggregate(rows),modernSummary:aggregate(rows.filter(r=>r.date>='1950'&&r.date<='2050-01-01T12:00:00Z')),rows};
for(const row of output.summary) {
  const limit=limits[row.body];
  if(limit!==undefined&&row.errors.wakusei.maxArcsec>limit)throw new Error(`${row.body}: ${row.errors.wakusei.maxArcsec} arcsec > published ${limit}`);
}
const resultFile=new URL('results.json',import.meta.url);
if(process.argv.includes('--check')) {
  if(previous.fixtureSha256!==output.fixtureSha256)throw new Error('Horizons fixture changed: rerun comparison and review limits');
  if(previous.observerFixtureSha256!==output.observerFixtureSha256)throw new Error('observer reference changed: regenerate and review');
  if(previous.rows.length!==output.rows.length)throw new Error('sample coverage changed');
  if(previous.packages.wakusei.bundleSha256!==output.packages.wakusei.bundleSha256)throw new Error('measured source bundle changed: regenerate and review');
  for(const k of columns){
    const a=output.packages[k],b=previous.packages[k];
    if(a.version!==b.version || a.license!==b.license || Math.abs(a.gzipBytes-b.gzipBytes)>64 || a.minifiedBytes!==b.minifiedBytes || a.sourceSha256!==b.sourceSha256)throw new Error(`package/profile drift: ${k}`);
  }
  for(const row of output.rows){
    const old=previous.rows.find(r=>r.body===row.body&&r.date===row.date);
    if(!old)throw new Error(`unrecorded sample ${row.body} ${row.date}`);
    for(const k of columns){
      if((row.errors[k]===null)!==(old.errors[k]===null))throw new Error(`coverage drift ${row.body} ${k}`);
      if(row.errors[k]!==null&&Math.abs(row.errors[k]-old.errors[k])>0.00001)throw new Error(`result drift ${row.body} ${row.date} ${k}; rerun and review`);
    }
  }
  console.log('comparison reproduces within 0.00001 arcsec; published wakusei limits pass');
} else {
  writeFileSync(resultFile,JSON.stringify(output,null,2)+'\n');
  console.log('wrote scripts/compare/results.json');
}
for(const row of output.summary)console.log(row.body,columns.map(k=>row.errors[k]?.maxArcsec.toFixed(3)??'—').join(' | '));
console.log('gzip bytes:',Object.fromEntries(Object.entries(output.packages).map(([k,v])=>[k,v.gzipBytes])));

for(const ja of [false,true]) {
  const path=new URL(`../../docs/guides/${ja?'ja/':''}accuracy.md`,import.meta.url);
  const original=readFileSync(path,'utf8');
  const section=render(previous || output,limits,ja);
  const start=original.indexOf(START),end=original.indexOf(END);
  if((start<0)!==(end<0) || end>=0&&end<start)throw new Error('comparison section markers are incomplete');
  const next=start<0?original.trimEnd()+'\n\n'+section+'\n':original.slice(0,start)+section+original.slice(end+END.length);
  if(process.argv.includes('--check')) { if(next!==original)throw new Error(`generated comparison docs drift: ${ja?'Japanese':'English'}`); }
  else writeFileSync(path,next);
}
