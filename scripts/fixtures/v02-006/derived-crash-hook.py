"""Task-only fault injection, never shipped as installed engine code.

The default worker reaches the real default stage and publishes its permit.
Terminate that process at entry to the real enqueue, before it can mutate a
child job. No pipeline/launcher implementation is replaced.
"""
import json, os, sys
from pathlib import Path

root = Path('C:/tmp/v006/derived-fault-r4')
arm = root/'state/v006-fault-armed'
proof = root/'state/v006-derived-crash.json'
def trace(frame, event, _arg):
    if event == 'call' and frame.f_code.co_name == 'enqueue' and frame.f_code.co_filename.replace('\\','/').endswith('/scientific_reading/background_launcher.py') and arm.exists():
        request = frame.f_locals.get('request')
        if request and request.target_stage == 'xlsx_snapshot' and Path(request.payload['data_root']).resolve() == (root/'library').resolve():
            from scientific_reading.background_store import stable_job_id
            child = stable_job_id(request)
            permit = json.loads((root/'library/recovery-derived'/f'{child}.json').read_text())
            assert not (root/'library/jobs'/child).exists()
            arm.unlink()
            proof.write_text(json.dumps({'pid':os.getpid(),'point':'real_enqueue_entry_after_persisted_permit','childJobId':child,'permit':permit}),encoding='utf-8')
            os._exit(97)
    return trace
if root.resolve() in Path(sys.prefix).resolve().parents:
    sys.settrace(trace)
