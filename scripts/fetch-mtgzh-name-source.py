"""Fetch and verify the pinned Chinese database dump; never download card art."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile
import urllib.request

spec = json.loads(Path('scripts/localization/mtgzh-name-source.json').read_text())
destination = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/mtgzh-name-source')
destination.mkdir(parents=True, exist_ok=True)

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

if all((destination / name).is_file() and digest(destination / name) == expected
       for name, expected in spec['files'].items()):
    print('Verified existing MTGZH name source files.')
    sys.exit(0)

archive = destination / 'source.tar.gz'
if not archive.is_file() or digest(archive) != spec['archiveSha256']:
    temporary = destination / 'source.download'
    with urllib.request.urlopen(spec['archiveUrl'], timeout=60) as response, temporary.open('wb') as output:
        while block := response.read(1024 * 1024):
            output.write(block)
    if digest(temporary) != spec['archiveSha256']:
        raise ValueError('MTGZH archive hash mismatch')
    temporary.replace(archive)

with tarfile.open(archive) as bundle:
    # Read named members only; do not extract archive-provided paths.
    for name, expected in spec['files'].items():
        content = bundle.extractfile('./' + name).read()
        if hashlib.sha256(content).hexdigest() != expected:
            raise ValueError(f'{name}: source hash mismatch')
        (destination / name).write_bytes(content)
print(f'Verified {len(spec["files"])} MTGZH name source files.')
