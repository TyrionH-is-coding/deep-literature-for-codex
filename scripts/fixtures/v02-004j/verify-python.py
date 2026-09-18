"""Read-only verification of the I runtime and its recorded source manifest."""
import hashlib, importlib.metadata, json, pathlib, sys
import scientific_reading
a = pathlib.Path(sys.argv[1]).resolve()
env = json.loads((a / 'docs/codex-v02/V02-004I-evidence/environment.json').read_text())
audit = json.loads((a / 'docs/codex-v02/V02-004I-evidence/audit.json').read_text())
site = pathlib.Path(scientific_reading.__file__).parent.parent
assert site == pathlib.Path(env['site'])
assert sys.version == env['python']
for name, expected in env['source_sha256'].items():
    for root in (site, a / ('engine' if name.startswith('reader/') else 'engine/src')):
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, str(root / name)
for name, version in audit['versions'].items():
    assert importlib.metadata.version(name) == version, name
print(json.dumps(dict(executable=sys.executable, module=scientific_reading.__file__, python=sys.version,
                     files=len(env['source_sha256']), versions=audit['versions'])))
