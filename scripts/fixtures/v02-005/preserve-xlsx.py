"""Preserve native workbook features that Artifact Tool export did not retain.
Only merge the three authored text values; all other ZIP members stay byte-identical.
"""
import json,re,zipfile,html,shutil
from pathlib import Path
from openpyxl import load_workbook
out=Path('C:/tmp/v005/evidence');target=Path('C:/tmp/v005/instance/library/library/scientific-reading.xlsx')
authored=load_workbook(out/'xlsx-edited.xlsx')['文献']
shutil.copyfile(out/'xlsx-edited.xlsx',out/'xlsx-artifact-export.xlsx')
with zipfile.ZipFile(out/'xlsx-before.xlsx') as source,zipfile.ZipFile(out/'xlsx-preserved.xlsx','w') as dest:
    for member in source.infolist():
        data=source.read(member.filename)
        if member.filename=='xl/worksheets/sheet1.xml':
            text=data.decode('utf-8')
            for cell in ['G2','H2','I2']:
                pattern=r'(<c\b[^>]*\br="'+cell+r'"[^>/]*)(?:/>|>.*?</c>)'
                match=re.search(pattern,text)
                assert match,cell
                start=re.sub(r'\s+t="[^"]*"','',match[1]).rstrip()+' t="inlineStr">'
                replacement=start+'<is><t>'+html.escape(authored[cell].value)+'</t></is></c>'
                text=text[:match.start()]+replacement+text[match.end():]
            data=text.encode('utf-8')
        dest.writestr(member,data)
with zipfile.ZipFile(out/'xlsx-before.xlsx') as a,zipfile.ZipFile(out/'xlsx-preserved.xlsx') as b:
    changed=[name for name in a.namelist() if a.read(name)!=b.read(name)]
    assert changed==['xl/worksheets/sheet1.xml'],changed
shutil.copyfile(out/'xlsx-preserved.xlsx',target)
shutil.copyfile(target,out/'xlsx-edited.xlsx')
print(json.dumps({'changed_zip_members':changed,'reason':'artifact export did not preserve hidden identity sheet; merge only 3 authored cells into original package'}))
