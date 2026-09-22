"""Build only synthetic parser/PDF inputs. No library or job-state writes."""
import sys, json, io, zipfile, hashlib, textwrap, re
from pathlib import Path
import pip._vendor.distlib
root=Path(sys.argv[1]).resolve()
assert root == Path('C:/tmp/v005/instance').resolve()
control=root/'v005-provider'; control.mkdir(exist_ok=True)
fixture=Path(__file__).parent
records=[]
for case in ['formula-outline','figures-captions','superscript-text']:
    source=fixture/(case+'.json'); payload=json.loads(source.read_text(encoding='utf-8'))
    (control/source.name).write_bytes(source.read_bytes())
    # Small self-owned PDF with the corresponding English text. Layout/provider
    # output is synthetic, explicitly not a test of OCR or scientific quality.
    lines=['V02-005 SYNTHETIC DEMO / parser and translations are fixtures','']
    for item in payload['content_items']:
        text=item.get('text') or ' '.join(item.get('image_caption', item.get('table_caption',[])))
        text=re.sub('<[^>]+>','',text).encode('ascii','replace').decode()
        lines.extend(textwrap.wrap(text,88)); lines.append('')
    pages=[lines[i:i+48] for i in range(0,len(lines),48)]
    objects=[b'',b'',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    kids=[]
    for page in pages:
        page_id=len(objects)+1; stream_id=page_id+1; kids.append(page_id)
        stream='BT /F1 10 Tf 40 800 Td 14 TL\n'
        for line in page:
            escaped=line.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
            stream+='('+escaped+') Tj T*\n'
        raw=(stream+'ET').encode('ascii')
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_id} 0 R >>'.encode())
        objects.append(b'<< /Length '+str(len(raw)).encode()+b' >>\nstream\n'+raw+b'\nendstream')
    objects[0]=b'<< /Type /Catalog /Pages 2 0 R >>'
    objects[1]=('<< /Type /Pages /Kids ['+' '.join(f'{n} 0 R' for n in kids)+f'] /Count {len(kids)} >>').encode()
    pdf=b'%PDF-1.4\n'; offsets=[0]
    for n,obj in enumerate(objects,1):
        offsets.append(len(pdf));pdf+=f'{n} 0 obj\n'.encode()+obj+b'\nendobj\n'
    xref=len(pdf);count=len(objects)+1
    pdf+=f'xref\n0 {count}\n0000000000 65535 f \n'.encode()+b''.join(f'{o:010} 00000 n \n'.encode() for o in offsets[1:])+f'trailer\n<< /Size {count} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    target=control/(case+'.pdf');target.write_bytes(pdf)
    records.append({'case':case,'pdf':str(target),'sha256':hashlib.sha256(pdf).hexdigest(),'fixture_sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
launcher=Path(pip._vendor.distlib.__file__).parent/'t64.exe'
buf=io.BytesIO()
with zipfile.ZipFile(buf,'w') as z:
    z.writestr('__main__.py','CONTROL = '+repr(str(control))+'\n'+(fixture/'provider.py').read_text(encoding='utf-8'))
target=root/'library/.mineru-venv/Scripts/mineru.exe';target.parent.mkdir(parents=True,exist_ok=True)
target.write_bytes(launcher.read_bytes()+('#!'+sys.executable+'\n').encode()+buf.getvalue())
(control/'mode.json').write_text(json.dumps({'case':'formula-outline','fail_once':False}))
print(json.dumps({'records':records,'provider':str(target),'provider_sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
