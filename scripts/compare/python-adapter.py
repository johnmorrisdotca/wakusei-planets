"""Public API adapter only. No third-party implementation is copied here."""
import json, sys, gzip, pathlib, hashlib, platform, zlib
from datetime import datetime
import solarsystem

def args(iso):
    d=datetime.fromisoformat(iso.replace('Z','+00:00'))
    return dict(year=d.year,month=d.month,day=d.day,hour=d.hour,minute=d.minute+d.second/60+d.microsecond/60000000,UT=0,dst=0)

request=json.load(sys.stdin)
rows={}
for iso in request['dates']:
    # Ask for native mean-of-date axes, then rotate in the independent JS adapter.
    h=solarsystem.Heliocentric(**args(iso),precession=False,view='horizontal')
    rows[iso]={'planets':{k.lower():v for k,v in h.planets().items()},'moon':solarsystem.Moon(**args(iso),topographic=False).position(), 'julianDate':h.d+2451543.5}
root=pathlib.Path(solarsystem.__file__).parent
payload=b''.join(p.name.encode()+b'\n'+p.read_bytes()+b'\n' for p in sorted(root.glob('*.py')))
print(json.dumps({'version':solarsystem.__version__,'python':platform.python_version(),'zlib':zlib.ZLIB_VERSION,'sourceGzipBytes':len(gzip.compress(payload,compresslevel=9,mtime=0)),'sourceSha256':hashlib.sha256(payload).hexdigest(),'rows':rows},allow_nan=False))
