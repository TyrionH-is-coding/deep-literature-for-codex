"""Synthetic input and read-only assertions; production modules come from -I installed Python."""
import sys,json,hashlib,sqlite3,io,zipfile,subprocess,time
from pathlib import Path
from scientific_reading.library_service import LibraryService
from scientific_reading.models import PaperMetadata
from scientific_reading.workspace import PaperWorkspace
from scientific_reading.reading_pipeline import ReadingPipeline
root=Path(sys.argv[1]); mode=sys.argv[2]; data=root/'library'; control=root/'v004k-stage'; control.mkdir(exist_ok=True)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
if mode=='prepare':
    info=read(root/'v02-fixture.json'); lib=LibraryService(data); folder=lib.create_folder('V02-004K installed control '+str(time.time_ns()))['folder_id'];
    other=lib.ingest(PaperMetadata(title='V02-004K unaffected paper'))['paper_id'];lib.move_items([info['paper_id'],other],folder);lib.close()
    base=PaperWorkspace(data/'papers'/info['paper_id']); old=base.root/'generations'/info['pdf_sha256'][:16]
    # Old generation was committed by real parser-normalizer/translation/renderer APIs in engine-probe.py.
    protected={str(p.relative_to(root)):sha(p) for p in old.rglob('*') if p.is_file() and p.name!='job.json'}
    # Valid incremental PDF comment changes source identity; preserve all original xref offsets.
    source=base.source_pdf.read_bytes()+b'\n% V02-004K next candidate source\n';base.source_pdf.write_bytes(source)
    lib=LibraryService(data);lib.record_pdf_attachment(info['paper_id'],sha(base.source_pdf),len(source));lib.close()
    import pip._vendor.distlib
    launcher=Path(pip._vendor.distlib.__file__).parent/'t64.exe';buf=io.BytesIO()
    provider=Path(__file__).with_name('provider.py').read_text(encoding='utf-8')
    provider='CONTROL = '+repr(str(control))+'\n'+provider
    with zipfile.ZipFile(buf,'w') as z:z.writestr('__main__.py',provider)
    target=data/'.mineru-venv/Scripts/mineru.exe';target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(launcher.read_bytes()+('#!'+sys.executable+'\n').encode()+buf.getvalue())
    (control/'content.json').write_bytes(Path(__file__).with_name('formula-outline.json').read_bytes())
    write(control/'mode.json',{'hold':True,'fail':False})
    value={'paper':info['paper_id'],'other':other,'folder':folder,'source':str(base.source_pdf),'source_sha256':sha(base.source_pdf),'protected':protected,'reader':info['reader'],'reader_sha256':info['reader_sha256'],'provider':str(target),'provider_sha256':sha(target)};write(control/'seed.json',value)
elif mode=='snapshot':
    value=read(control/'seed.json');assert sha(Path(value['source']))==value['source_sha256'];assert all(sha(root/p)==s for p,s in value['protected'].items())
    with sqlite3.connect(data/'library.sqlite') as c:
        c.row_factory=sqlite3.Row;row=dict(c.execute('SELECT * FROM items WHERE paper_id=?',(value['paper'],)).fetchone());row['reader_path']=c.execute("SELECT rel_path FROM artifacts WHERE paper_id=? AND kind='reader'",(value['paper'],)).fetchone()[0]
    value={'source_sha256':value['source_sha256'],'protected_count':len(value['protected']),'reader_sha256':sha(Path(value['reader'])),'library':row}
    if len(sys.argv)>3:
        p=ReadingPipeline(data);parent=sys.argv[3];value['pipeline']=p.inspect(parent).to_dict();handle=p.job_store.handle(parent)
        generation=data/'papers'/value['pipeline']['paper_id']/'generations'/value['pipeline']['source_pdf_sha256'][:16]
        assert generation.is_dir() and sha(generation/'source.pdf')==value['pipeline']['source_pdf_sha256'];value['generation_path']=str(generation)
        value['json_hashes']={f.name:sha(f) for f in handle.root.glob('*.json')};value['events']=p.job_store.read_events(parent)
        value['checkpoints']={str(f.relative_to(data)):read(f) for f in (data/'papers').glob('**/job.json')}
        value['committed_assets']={str(f.relative_to(data)):sha(f) for f in (data/'papers').rglob('*') if f.is_file() and ('parsed' in f.parts or f.name.endswith('.translation.json'))}
elif mode=='translation-input':
    from scientific_reading.full_read_models import FULL_TRANSLATION_CONTRACT_VERSION
    state=ReadingPipeline(data).inspect(sys.argv[3]);source=read(Path(state.required_action['source_manifest_path']))
    value={'full_translation':{'contract_version':FULL_TRANSLATION_CONTRACT_VERSION,'batch_id':source['batch_id'],'source_sha256':source['source_sha256'],'translations':[{'block_id':b['block_id'],'source_text':b['english'],'translation_zh':'' if b.get('source_type')=='reference' else '合成验收译文：'+b['english'],'highlight':'none'} for b in source['blocks']]}}
elif mode=='direct-reject':
    parent=sys.argv[3];p=ReadingPipeline(data);handle=p.job_store.handle(parent);before={str(f):sha(f) for f in list(handle.root.glob('*.json'))+list((data/'papers').glob('**/job.json'))}
    try:p.advance(parent,{})
    except RuntimeError as e:assert str(e)=='full_read_pipeline_resume_required';error=str(e)
    else:raise AssertionError('illegal direct advance accepted')
    after={f:sha(Path(f)) for f in before};assert before==after;value={'error':error,'unchanged_files':len(before),'before':before,'after':after,'inspect':p.inspect(parent).to_dict()}
elif mode=='release':
    (control/'release').write_text('release current synthetic provider');value={'released':True}
elif mode=='native-seed':
    lib=LibraryService(data);folder=lib.create_folder('V004K queue control '+str(time.time_ns()))['folder_id'];papers=[lib.ingest(PaperMetadata(title='V004K queue fixture '+str(time.time_ns())+' '+str(n)))['paper_id'] for n in range(2)];lib.move_items(papers,folder);lib.close();value={'folder':folder,'papers':papers}
elif mode=='fault-prepare':
    seed=read(control/'seed.json');lib=LibraryService(data);meta=PaperMetadata(title='A Compact Review Fixture for Structured Equations',doi='10.5555/v004k-interruption');paper=lib.ingest(meta)['paper_id'];lib.move_items([paper],seed['folder']);lib.close();ws=PaperWorkspace.create_for_paper_id(data,paper,meta);ws.source_pdf.write_bytes(Path(seed['source']).read_bytes());write(control/'mode.json',{'hold':False,'fail':True});value={'paper':paper,'folder':seed['folder']}
else:raise ValueError(mode)
print(json.dumps(value,ensure_ascii=False))
