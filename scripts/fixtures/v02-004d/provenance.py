import sys,json,zipfile,hashlib,importlib.metadata
from pathlib import Path
import scientific_reading
root=Path(sys.argv[1]);i=json.loads((root/'installation.json').read_text());site=Path(scientific_reading.__file__).parent.parent
plugin=Path(i['dsh']).parent
# Find pinned package through the installed release runtime, never a source checkout.
runtime=Path(i['python']).parents[2];plugin=runtime/'npm/node_modules/@dsh-external/dsh-scientific-reading'
wheel=next((plugin/'dist/python').glob('*.whl'))
checked=[]
with zipfile.ZipFile(wheel) as z:
 for name in z.namelist():
  if name.startswith(('scientific_reading/', 'reader/')) and name.endswith('.py'):
   a=hashlib.sha256(z.read(name)).hexdigest();b=hashlib.sha256((site/name).read_bytes()).hexdigest();assert a==b,name;checked.append({'file':name,'sha256':a})
print(json.dumps({'executable':sys.executable,'engine':scientific_reading.__file__,'distributionVersion':importlib.metadata.version('dsh-scientific-reading-engine'),'wheel':str(wheel),'wheelSha256':hashlib.sha256(wheel.read_bytes()).hexdigest(),'files':checked,'python':sys.version},indent=2))
