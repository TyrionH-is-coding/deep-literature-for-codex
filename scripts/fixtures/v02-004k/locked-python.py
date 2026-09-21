import sys,json,importlib.metadata
from pathlib import Path
from urllib.parse import urlparse,unquote
from pip._vendor.packaging.requirements import Requirement
from pip._vendor.packaging.utils import parse_wheel_filename
rows=[]
for line in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    if not line.strip() or line.startswith('#'):continue
    req=Requirement(line.split(' --hash=')[0])
    if req.marker and not req.marker.evaluate():continue
    actual=importlib.metadata.version(req.name)
    if req.url:
        expected=str(parse_wheel_filename(unquote(Path(urlparse(req.url).path).name))[1]);assert actual==expected,(req.name,actual,expected)
    else:assert actual in req.specifier,(req.name,actual,str(req.specifier))
    rows.append({'name':req.name,'version':actual})
print(json.dumps({'locked':rows,'all':sorted([{'name':d.metadata['Name'],'version':d.version} for d in importlib.metadata.distributions()],key=lambda d:d['name'])}))
