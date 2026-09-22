"""Read-only proof over the actual three-domain package and installed roots."""
import json, sys, hashlib, sqlite3, zipfile
from pathlib import Path
source, target, package = map(Path, sys.argv[1:4])
digest=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((package/'manifest.json').read_text())
native=json.loads((package/'native.json').read_text())
handoff=json.loads((package/'handoff.json').read_text())
identity=json.loads((target/'.workbench.json').read_text())
assert identity['instanceId']!=manifest['source']['instanceId']
assert json.loads((target/'state/recovery-original-native.json').read_text())==native
assert json.loads((target/'state/recovery-original-handoff.json').read_text())==handoff
restored=json.loads((target/'state/handoff.json').read_text())
assert set(restored['tasks'])==set(handoff['tasks'])
assert restored['children']==handoff['children']
for key, binding in handoff['bindings'].items():assert restored['bindings'][key]==binding
parked=json.loads(Path('C:/tmp/v006/evidence/source/recovery-source-state.json').read_text())
task=next(t for t in restored['tasks'].values() if t['taskId']==parked['taskId'])
old=next(t for t in handoff['tasks'].values() if t['taskId']==parked['taskId'])
for key in ['operations','dispatches','cancelRequested','stopOperation']:
    assert task[key]==old[key],key
assert task['control']['stopRequested'] and task['control']['revision']==parked['expectedRevision']
unchanged=[]
relocated=[]
normal=json.loads(Path('C:/tmp/v006/evidence/source/normal-formula-outline.json').read_text())['paperId']
with zipfile.ZipFile(package/'library.zip') as archive:
    for info in archive.infolist():
        data=archive.read(info.filename)
        assert b'SYNTHETIC_CREDENTIAL_CANARY' not in data
        if info.filename.startswith('data/papers/'):
            relative=info.filename[5:]
            assert (source/'library'/relative).read_bytes()==data,relative
            if relative.split('/')[1]==normal or relative.endswith('/source.pdf'):
                restored_data=(target/'library'/relative).read_bytes()
                if restored_data!=data and relative.endswith('/job.json'):
                    expected_job=json.loads(data)
                    result=expected_job['stages']['full_read']['result']
                    for field in ['translations_json','highlights_json','reading_guide_json']:
                        original=Path(result[field])
                        result[field]=str(target/'library'/original.relative_to(source/'library'))
                    assert json.loads(restored_data)==expected_job,relative
                    relocated.append({'path':relative,'fields':['translations_json','highlights_json','reading_guide_json'],
                                      'sourceSha256':digest(data),'targetSha256':digest(restored_data)})
                else:
                    assert restored_data==data,relative
                    unchanged.append({'path':relative,'sha256':digest(data)})
for name in ['native.json','handoff.json','manifest.json']:
    assert b'SYNTHETIC_CREDENTIAL_CANARY' not in (package/name).read_bytes()
assert b'SYNTHETIC_CREDENTIAL_CANARY' in (source/'state/dsh-home/.credentials.yaml').read_bytes()
credentials=target/'state/dsh-home/.credentials.yaml'
assert not credentials.exists() or b'SYNTHETIC_CREDENTIAL_CANARY' not in credentials.read_bytes()
expected=['V02-006 synthetic personal thoughts','部分理解','V02-006 restart and recovery notes']
for root in [source,target]:
    with sqlite3.connect(f'file:{(root/"library/library.sqlite").as_posix()}?mode=ro',uri=True) as db:
        actual=list(db.execute('SELECT personal_thoughts,understanding_level,user_notes FROM items WHERE paper_id=?',(normal,)).fetchone())
        assert actual==expected,actual
        assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
result={'sourceInstanceId':manifest['source']['instanceId'],'targetInstanceId':identity['instanceId'],
        'sessionIds':[s['meta']['id'] for s in native['sessions']], 'originalNativeAndHandoffPreserved':True,
        'bindingsChildrenAndTaskIdsPreserved':True,'parkedPreparedUncertainAndStopFactsPreserved':True,
        'personalFields':expected,'credentialCanaryExcluded':True,'verifiedUnchangedScientificFiles':unchanged,
        'verifiedRelocatedMetadata':relocated}
print(json.dumps(result,ensure_ascii=False,indent=2))
