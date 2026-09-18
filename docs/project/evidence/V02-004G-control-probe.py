import importlib.util, json, sys, hashlib, traceback
from pathlib import Path
repo=Path('C:/Users/15694/Documents/ChatGPT/deep-literature-engine-v02-004g')
out=Path(__file__).resolve().parent/'V02-004G-control'
out.mkdir(exist_ok=True)
e=json.loads((repo/'docs/codex-v02/V02-004G-evidence/environment.json').read_text(encoding='utf-8'))
for name, sha in e['source_sha256'].items():
    assert hashlib.sha256((repo/('engine' if name.startswith('reader/') else 'engine/src')/name).read_bytes()).hexdigest()==sha, name
    assert hashlib.sha256((Path(sys.prefix)/'Lib/site-packages'/name).read_bytes()).hexdigest()==sha, name
spec=importlib.util.spec_from_file_location('g_control',repo/'scripts/v02-004g-audit.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.OUT=out
sys.argv=['control-probe','--expect-direct-safe']
red=False
try: m.main()
except AssertionError as error:
    assert str(error).startswith('REGRESSION:'), str(error)
    red=True
    print('EXPECTED RED:',error)
a=json.loads((out/'audit.json').read_text(encoding='utf-8'))
assert len(a['cases'])==6 and red
from scientific_reading.background_store import BackgroundJobStore
root=Path(a['root'])
pids=[]
for p in root.glob('**/launch.json'): pids.append(json.loads(p.read_text())['pid'])
for p in root.glob('*/provider-calls.jsonl'):
    pids.extend(json.loads(line)['pid'] for line in p.read_text().splitlines())
live=[p for p in pids if BackgroundJobStore._pid_is_alive(p)]
claims=list(root.glob('**/owner.json'))
assert not live and not claims
result={'sourceFilesVerified':len(e['source_sha256']),'redReproduced':red,'cases':list(a['cases']),'liveRecordedPids':live,'ownerClaims':len(claims),'sourceCommit':a['source_commit'],'python':sys.version,'note':'Source diagnosis only; red defect remains. Two real CLI recovery comparisons pass.'}
(out/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
