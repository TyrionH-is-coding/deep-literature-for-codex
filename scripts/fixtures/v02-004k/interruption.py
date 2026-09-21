"""Explicit crash fault, separate from cooperative user-stop acceptance."""
import sys,json,io,zipfile,hashlib,time,os,signal
from pathlib import Path
from scientific_reading.library_service import LibraryService
from scientific_reading.models import PaperMetadata
from scientific_reading.workspace import PaperWorkspace
from scientific_reading.reading_pipeline import ReadingPipeline
from scientific_reading.reading_control import ReadingControl
from scientific_reading.background_launcher import process_start_identity
root=Path(sys.argv[1]);mode=sys.argv[2];data=root/'library';control=root/'v004k-interruption'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,indent=2),encoding='utf-8')
if mode=='prepare':
 control.mkdir(exist_ok=False);seed=read(root/'v004k-stage'/read(root/'v02-fixture.json')['run_id']/'seed.json');lib=LibraryService(data);meta=PaperMetadata(title='A Compact Review Fixture for Structured Equations',doi='10.5555/v004k-real-worker-interruption');paper=lib.ingest(meta)['paper_id'];lib.move_items([paper],seed['folder']);lib.close();ws=PaperWorkspace.create_for_paper_id(data,paper,meta);ws.source_pdf.write_bytes(Path(seed['source']).read_bytes())
 exe=data/'.mineru-venv/Scripts/mineru.exe';(control/'original-provider.exe').write_bytes(exe.read_bytes())
 source="""import sys,os,json,time
from pathlib import Path
if '--version' in sys.argv: print('mineru 9.4.0'); raise SystemExit(0)
root=Path(CONTROL)
with (root/'calls.jsonl').open('a') as f:f.write(json.dumps({'pid':os.getpid(),'args':sys.argv})+'\\n')
if not (root/'released').exists():
 (root/'held.json').write_text(json.dumps({'pid':os.getpid()}))
 deadline=time.monotonic()+180
 while not (root/'released').exists():
  if time.monotonic()>deadline:raise TimeoutError('crash fixture hold')
  time.sleep(.05)
out=Path(sys.argv[sys.argv.index('-o')+1]);out.mkdir(parents=True,exist_ok=True)
(out/'fixture_content_list.json').write_text(json.dumps(json.loads((root/'content.json').read_text())['content_items']))
"""
 import pip._vendor.distlib
 launcher=Path(pip._vendor.distlib.__file__).parent/'t64.exe';buf=io.BytesIO()
 with zipfile.ZipFile(buf,'w') as z:z.writestr('__main__.py','CONTROL='+repr(str(control))+'\n'+source)
 exe.write_bytes(launcher.read_bytes()+('#!'+sys.executable+'\n').encode()+buf.getvalue());(control/'content.json').write_bytes(Path(__file__).with_name('formula-outline.json').read_bytes());value={'paper':paper,'folder':seed['folder'],'pdf_sha256':hashlib.sha256(ws.source_pdf.read_bytes()).hexdigest(),'provider_sha256':hashlib.sha256(exe.read_bytes()).hexdigest()};write(control/'seed.json',value)
elif mode=='crash':
 parent=sys.argv[3];p=ReadingPipeline(data);owner=ReadingControl(p.job_store,parent).load()['worker'];assert owner and owner['identity'] and process_start_identity(owner['pid'])==owner['identity'];before=p.job_store.load_status(parent).to_dict();assert before['state']=='running';assert (control/'held.json').exists()
 # Only the registered worker with matching creation identity is terminated.
 os.kill(owner['pid'],signal.SIGTERM);deadline=time.monotonic()+15
 while process_start_identity(owner['pid'])==owner['identity']:
  assert time.monotonic()<deadline;time.sleep(.05)
 (control/'released').write_text('release orphan synthetic provider after worker crash')
 held=read(control/'held.json');deadline=time.monotonic()+15
 while p.job_store._pid_is_alive(held['pid']):
  assert time.monotonic()<deadline;time.sleep(.05)
 value={'fault':'forced registered worker exit; never a user-stop action','owner':owner,'before':before,'after':p.job_store.load_status(parent).to_dict(),'source':read(control/'seed.json')};write(control/'crash.json',value)
elif mode=='restore-provider':
    original=control/'original-provider.exe';target=data/'.mineru-venv/Scripts/mineru.exe';target.write_bytes(original.read_bytes());value={'restored':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
elif mode=='inspect':
 p=ReadingPipeline(data);parent=sys.argv[3];state=p.inspect(parent).to_dict();value={'pipeline':state,'control':ReadingControl(p.job_store,parent).read(),'calls':[json.loads(x) for x in (control/'calls.jsonl').read_text().splitlines()]}
else:raise ValueError(mode)
print(json.dumps(value))
