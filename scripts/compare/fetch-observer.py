"""Optional network refresh of the checked-in JPL apparent, airless horizon fixture.
No library under comparison is used to construct this independent reference.
"""
import json, pathlib, urllib.parse, urllib.request
from datetime import datetime, timezone
root=pathlib.Path(__file__).resolve().parents[2]
r=json.loads((root/'test/data/horizons.json').read_text())
dates=sorted(set(r['planetDates']+r['moonDates']))
observer={'latitude':35.,'longitude':-105.,'heightM':0.}
common={'format':'json','OBJ_DATA':"'NO'",'MAKE_EPHEM':"'YES'",'EPHEM_TYPE':"'OBSERVER'",'TIME_TYPE':"'UT'",'CENTER':"'coord@399'",'COORD_TYPE':"'GEODETIC'",'SITE_COORD':"'-105,35,0'",'QUANTITIES':"'4'",'APPARENT':"'AIRLESS'",'ANG_FORMAT':"'DEG'",'TIME_DIGITS':"'FRACSEC'",'EXTRA_PREC':"'YES'",'CSV_FORMAT':"'YES'",'CAL_FORMAT':"'JD'",'TLIST':"'"+' '.join(f'{datetime.fromisoformat(d.replace("Z","+00:00")).timestamp()/86400+2440587.5:.9f}' for d in dates)+"'"}
out={'source':'https://ssd.jpl.nasa.gov/api/horizons.api','retrieved':datetime.now(timezone.utc).date().isoformat(),'parameters':common,'observer':observer,'commands':{'sun':'10','moon':'301'},'dates':dates,'bodies':{}}
for name,code in [('sun','10'),('moon','301')]:
    query={**common,'COMMAND':f"'{code}'"}
    data=json.load(urllib.request.urlopen(out['source']+'?'+urllib.parse.urlencode(query),timeout=120))
    text=data.get('result','')
    if '$$SOE' not in text: raise RuntimeError(text[:1500])
    rows=[]
    for line in text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
        fields=line.split(',')
        # JD, solar-presence, lunar-presence, azimuth, elevation, trailing empty.
        rows.append({'azimuth':float(fields[3]),'altitude':float(fields[4])})
    if len(rows)!=len(dates):raise RuntimeError('missing observer rows')
    out['bodies'][name]=rows
(root/'scripts/compare/horizons-observer.json').write_text(json.dumps(out,indent=2)+'\n')
print('wrote scripts/compare/horizons-observer.json')
