"""Installed synthetic PDF gate for UI regression; no download or credential use."""
import sys,json
from pathlib import Path
import scientific_reading
from scientific_reading.library_service import LibraryService
from scientific_reading.models import PaperMetadata
from scientific_reading.background_models import BackgroundRequest
from scientific_reading.background_store import BackgroundJobStore
root=Path(sys.argv[1]).resolve()
assert (root/'.v02-003d-test-instance').read_text()=='synthetic-only'
assert Path(scientific_reading.__file__).resolve().is_relative_to(root/'releases')
data=root/'library';lib=LibraryService(data)
pid=lib.ingest(PaperMetadata(title='V02-003D synthetic PDF gate',doi='10.9999/v3d-pdf-gate'))['paper_id']
store=BackgroundJobStore(data);job=store.create_or_get(BackgroundRequest(pid,'full_read','e'*64,{'data_root':str(data)})).job_id
store.transition(job,'running');store.transition(job,'waiting_user',reason_code='pdf_required',required_input={'accepted_types':['application/pdf']})
assert lib.update_active_job(pid,job);lib.close()
print(json.dumps({'paper_id':pid,'job_id':job,'fixture':'persisted synthetic PDF gate; no network action triggered'}))
