import sys,json,subprocess
from pathlib import Path
from scientific_reading.background_models import BackgroundRequest
from scientific_reading.background_store import BackgroundJobStore
from scientific_reading.xlsx_snapshot import XlsxSnapshotService
root=Path(sys.argv[1]);assert (root/'.v02-004d-test-instance').read_text()=='synthetic-only'
data=root/'library';state=json.loads((root/'v3d-conflict.json').read_text());pid=state['paper_id']
store=BackgroundJobStore(data);job=store.create_or_get(BackgroundRequest(pid,'xlsx_snapshot','d'*64,{'data_root':str(data),'derived_pipeline':True})).job_id
p=subprocess.run([sys.executable,'-I','-X','utf8','-m','scientific_reading.worker','--data-root',str(data),'--job-id',job],capture_output=True,text=True,encoding='utf-8');assert p.returncode==2,(p.stdout,p.stderr)
s=store.load_status(job).to_dict();assert s['state']=='waiting_user';assert s['required_input']['conflict_details'][0]['paper_id']==pid
opened=[]
def opener(target,row):opened.append({'path':str(target),'row':row});return True
located=XlsxSnapshotService(data).locate(pid,opener=opener);assert located['paper_id']==pid and located['row']>=2
print(json.dumps({'worker':s,'locate':located,'openerCalls':opened,'scope':'Installed locate resolves real workbook row; native Excel opener replaced with task-local recording fixture, Office launch not verified.'},ensure_ascii=False,indent=2))
