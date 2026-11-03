"""Prepare wallpaper delivery copies; source images remain untouched."""
from pathlib import Path
from PIL import Image, ImageOps
import hashlib, json
root = Path(__file__).resolve().parents[1]
folder = root / 'assets' / 'wallpapers'
folder.mkdir(parents=True, exist_ok=True)
source = root.parent / 'image'
# Keep the original four IDs stable; additions follow in this explicit order.
files = [
    'SAO (1).jpg',
    'SAO (1).png',
    'SAO (2).jpg',
    'SAO (3).jpg',
    'p2618837824.jpg',
    'ANIME-PICTURES.NET_-_223635-2560x1600-sword+art+online-a-1+pictures-yuuki+asuna-single-long+hair-blush.png',
    '797442.png',
    '632078.png',
    'p2544087357.jpg',
]
source_hashes = {
    name: hashlib.sha256((source / name).read_bytes()).hexdigest()
    for name in files
}
rows = []
for i, name in enumerate(files, 1):
    path = source / name
    with Image.open(path) as original:
        im = ImageOps.exif_transpose(original).convert('RGB')
        im.thumbnail((3840, 2160), Image.Resampling.LANCZOS)
        target = folder / f'{i}.webp'
        im.save(target, 'WEBP', quality=90, method=6)
        with Image.open(target) as output:
            output.verify()
        with Image.open(target) as output:
            output.load()
            if output.size != im.size:
                raise RuntimeError(f'Output dimensions differ: {target.name}')
        rows.append({
            'id': f'builtin-{i}',
            'source': name,
            'sourceSha256': source_hashes[name],
            'file': target.name,
            'size': im.size,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'sizeBytes': target.stat().st_size,
        })
for name in files:
    if hashlib.sha256((source / name).read_bytes()).hexdigest() != source_hashes[name]:
        raise RuntimeError(f'Source changed during preparation: {name}')
(folder / 'provenance.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(rows, ensure_ascii=False, indent=2))
