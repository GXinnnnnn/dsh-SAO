"""Build the early startup face from verified original audio (Python stdlib)."""
from pathlib import Path
import argparse, base64, hashlib, json, zipfile
root = Path(__file__).resolve().parents[1]
local_archive = root.parent / 'original' / 'SAO.zip'
parser = argparse.ArgumentParser()
parser.add_argument('--archive', type=Path, default=local_archive if local_archive.exists() else Path('SAO.zip'))
args = parser.parse_args()
expected = {
    'kirito': ('LinkStart.SAO.Kirito.wav', '76b95783418d693017414b6e5039f19a9533e7b9f2e3c5c48527ecf7a3b1a2c5'),
    'asuna': ('LinkStart.SAO.Asuna.wav', 'fafaf001f3980d274a072e9d1364a0b98c5934fb442e169554c8af7b6a2399be'),
    'startup': ('Startup.SAO.NerveGear.wav', 'b593b79c9d3ad9a2c16c660760190bc28ab417c1d508595f1f61287415071b15')
}
media = {}
with zipfile.ZipFile(args.archive) as archive:
    for key, (filename, sha256) in expected.items():
        data = archive.read('SAO Utils 2/Packages/com.gpbeta.theme.sao/Sounds/' + filename)
        if hashlib.sha256(data).hexdigest() != sha256:
            raise ValueError('Unexpected audio content: ' + filename)
        media[key] = 'data:audio/wav;base64,' + base64.b64encode(data).decode('ascii')
source = (root / 'source' / 'startup.template.js').read_text(encoding='utf-8')
renderer = (root / 'source' / 'renderer.js').read_text(encoding='utf-8')
worker = renderer + '\n' + (root / 'source' / 'worker.js').read_text(encoding='utf-8')
# Internal content identity changes even when the public package version stays the same.
implementation = hashlib.sha256((source + renderer + worker + json.dumps(media, sort_keys=True)).encode('utf-8')).hexdigest()
for placeholder, value in [('__SAO_IMPLEMENTATION__', implementation), ('__SAO_MEDIA__', json.dumps(media, separators=(',', ':'))), ('__SAO_WORKER__', json.dumps(worker)), ('__SAO_RENDERER__', renderer)]:
    if source.count(placeholder) != 1:
        raise ValueError('Expected exactly one placeholder: ' + placeholder)
    source = source.replace(placeholder, value)
# Safe both as a normal JS file and a head-injected inline script.
(root / 'startup.js').write_text(source.replace('</script', '<\\/script'), encoding='utf-8')
print('Built startup.js: original audio verified; standalone renderer and worker embedded')
