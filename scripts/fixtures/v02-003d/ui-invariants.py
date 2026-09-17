import sys,json,sqlite3,hashlib
from pathlib import Path
root=Path(sys.argv[1]);assert (root/'.v02-003d-test-instance').read_text()=='synthetic-only'
with sqlite3.connect(root/'library/library.sqlite') as c: rows=c.execute('SELECT paper_id,personal_thoughts,understanding_level,user_notes FROM items ORDER BY paper_id').fetchall()
print(json.dumps({'personalFieldsSha256':hashlib.sha256(json.dumps(rows,ensure_ascii=False).encode()).hexdigest(),'workbookSha256':hashlib.sha256((root/'library/library/scientific-reading.xlsx').read_bytes()).hexdigest(),'papers':len(rows)}))
