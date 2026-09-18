"""Test-only gate injection after a real worker reaches PDF gate; never used by product."""
import json, pathlib, sys
from scientific_reading.background_store import BackgroundJobStore
from scientific_reading.workspace import read_json_file, atomic_write_json
root, job = pathlib.Path(sys.argv[1]), sys.argv[2]
store = BackgroundJobStore(root)
state = store.load_status(job)
assert state.state == 'waiting_user' and state.reason_code == 'pdf_required'
store.transition(job, 'waiting_agent', reason_code='translate_full_read')
file = store.handle(job).reading_pipeline_path
pipeline = read_json_file(file)
pipeline['state'] = 'waiting_agent'
pipeline['required_action'] = dict(reason_code='translate_full_read')
atomic_write_json(file, pipeline)
print(json.dumps(dict(job=job, mode='synthetic agent gate; no model/tool advancement', state=store.load_status(job).to_dict())))
