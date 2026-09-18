"""Synthetic metadata only; Handoff invokes the real JS/Python start and worker."""
import json, pathlib, sys
from scientific_reading.library_service import LibraryService
from scientific_reading.models import PaperMetadata
root = pathlib.Path(sys.argv[1]).resolve()
assert not root.exists()
library = LibraryService(root)
folder = library.create_folder('V02-004J synthetic')['folder_id']
papers = [library.ingest(PaperMetadata(title='V02-004J synthetic ' + str(n)))['paper_id'] for n in range(2)]
library.move_items(papers, folder)
library.close()
print(json.dumps(dict(root=str(root), folder=folder, papers=papers)))
