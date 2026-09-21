# CONTROL is embedded by the synthetic executable launcher; no production module substitution.
import sys,os,json,time
from pathlib import Path
if '--version' in sys.argv:
    print('mineru 9.4.0');raise SystemExit(0)
root=Path(CONTROL);args=sys.argv;output=Path(args[args.index('-o')+1]);mode=json.loads((root/'mode.json').read_text())
with (root/'calls.jsonl').open('a',encoding='utf-8') as f:f.write(json.dumps({'pid':os.getpid(),'argv':args,'mode':mode})+'\n')
if mode['fail'] and not (root/'failed-once').exists():
    (root/'failed-once').write_text('synthetic external provider interruption');raise SystemExit(19)
if mode['hold']:
    (root/'held.json').write_text(json.dumps({'pid':os.getpid(),'point':'external provider parse before commit'}));deadline=time.monotonic()+180
    while not (root/'release').exists():
        if time.monotonic()>deadline:raise TimeoutError('fixture hold timeout')
        time.sleep(.05)
output.mkdir(parents=True,exist_ok=True);payload=json.loads((root/'content.json').read_text(encoding='utf-8'))
(output/'fixture_content_list.json').write_text(json.dumps(payload['content_items']),encoding='utf-8')
