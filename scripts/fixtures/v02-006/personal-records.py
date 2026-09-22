"""Own synthetic instance only: author 3 values in the product's XLSX contract."""
import json, sys, zipfile, shutil, sqlite3
from pathlib import Path
from xml.etree import ElementTree as ET
root=Path(sys.argv[1]); out=Path('C:/tmp/v006/evidence/source')
target=root/'library/library/scientific-reading.xlsx'
values=['V02-006 synthetic personal thoughts','部分理解','V02-006 restart and recovery notes']
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
if sys.argv[2]=='author':
    from openpyxl import load_workbook
    book=load_workbook(target)
    sheet=book['文献']
    row=next(r[0].row for r in sheet if any(c.value=='A Compact Review Fixture for Structured Equations' for c in r))
    shutil.copyfile(target,out/'xlsx-before.xlsx')
    with zipfile.ZipFile(target) as source, zipfile.ZipFile(out/'xlsx-authored.xlsx','w') as dest:
        for entry in source.infolist():
            data=source.read(entry.filename)
            if entry.filename=='xl/worksheets/sheet1.xml':
                tree=ET.fromstring(data)
                for col,value in zip('GHI',values):
                    cell=tree.find('.//m:c[@r="'+col+str(row)+'"]',ns)
                    assert cell is not None
                    for child in list(cell): cell.remove(child)
                    cell.set('t','inlineStr')
                    ET.SubElement(ET.SubElement(cell,'{'+ns['m']+'}is'),'{'+ns['m']+'}t').text=value
                data=ET.tostring(tree,encoding='utf-8',xml_declaration=True)
            dest.writestr(entry,data)
    shutil.copyfile(out/'xlsx-authored.xlsx',target)
    print(json.dumps({'cells':['G'+str(row),'H'+str(row),'I'+str(row)],'values':values},ensure_ascii=False))
else:
    with sqlite3.connect(f'file:{(root/"library/library.sqlite").as_posix()}?mode=ro',uri=True) as conn:
        actual=list(conn.execute('SELECT personal_thoughts,understanding_level,user_notes FROM items WHERE paper_id=?',('title_d8b339a0356f',)).fetchone())
    assert actual==values,actual
    print(json.dumps({'values':actual,'readOnlyVerification':True},ensure_ascii=False))
