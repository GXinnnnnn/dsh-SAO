"""Rebuild the self-contained client from the supplied SAO ZIP (Python stdlib)."""
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
source = (root / 'source' / 'client.template.js').read_text(encoding='utf-8')
if source.count('__SAO_MEDIA__') != 1:
    raise ValueError('Expected exactly one media placeholder')
renderer = (root / 'source' / 'renderer.js').read_text(encoding='utf-8')
if source.count('__SAO_RENDERER__') != 1:
    raise ValueError('Expected exactly one native renderer placeholder')
source = source.replace('__SAO_RENDERER__', renderer)
(root / 'client.js').write_text(source.replace('__SAO_MEDIA__', json.dumps(media, separators=(',', ':'))), encoding='utf-8')
print('Built client.js from verified archive audio')
