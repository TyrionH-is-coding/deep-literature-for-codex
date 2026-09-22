# CONTROL is embedded into a test-only MinerU executable by prepare.py.
# Only the external parser is synthetic; the installed default worker stays intact.
import sys, os, json
from pathlib import Path
if '--version' in sys.argv:
    print('mineru 9.5.0 synthetic-v02-005'); raise SystemExit(0)
control = Path(CONTROL)
args = sys.argv
pdf = Path(args[args.index('-p') + 1])
output = Path(args[args.index('-o') + 1])
mode = json.loads((control/'mode.json').read_text())
with (control/'calls.jsonl').open('a', encoding='utf-8') as f:
    f.write(json.dumps({'pid':os.getpid(), 'argv':args, 'mode':mode})+'\n')
if mode.get('fail_once') and not (control/'failed-once').exists():
    (control/'failed-once').write_text('intentional synthetic provider exit 19')
    raise SystemExit(19)
case = mode['case']
payload = json.loads((control/(case+'.json')).read_text(encoding='utf-8'))
output.mkdir(parents=True, exist_ok=True)
(output/'fixture_content_list.json').write_text(json.dumps(payload['content_items']), encoding='utf-8')
for relative, content in payload['asset_files'].items():
    target = output/relative
    assert target.resolve().is_relative_to(output.resolve())
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')
