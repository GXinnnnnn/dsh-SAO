"""Build the included appearance client with Python's standard library."""
from pathlib import Path
import base64
import copy
import json
import shutil

root = Path(__file__).resolve().parents[1]
root_manifest = json.loads((root / 'package.json').read_text(encoding='utf-8'))
standalone_market = root_manifest.get('repository', {}).get('directory') == 'market'

wallpapers = []
for i in range(1, 10):
    data = (root / 'assets' / 'wallpapers' / f'{i}.webp').read_bytes()
    wallpapers.append({'id': f'builtin-{i}', 'name': f'SAO · {i:02}', 'src': 'data:image/webp;base64,' + base64.b64encode(data).decode('ascii')})
previews = []
for ident, name in [('1', 'native'), ('2', 'thin')]:
    data = (root / 'assets' / 'animation-previews' / f'{name}.webp').read_bytes()
    previews.append({'id': ident, 'src': 'data:image/webp;base64,' + base64.b64encode(data).decode('ascii')})
startup = (root / 'startup.js').read_text(encoding='utf-8')
settings = (root / 'source' / 'settings-panel.js').read_text(encoding='utf-8')
runtime = '\n'.join((root / 'source' / name).read_text(encoding='utf-8') for name in ['liquid-glass.js', 'appearance.js', 'model-intensity.js'])

targets = [(root, root_manifest['name'])]
if not standalone_market:
    market = root / 'market'
    market.mkdir(exist_ok=True)
    market_manifest_path = market / 'package.json'
    market_name = json.loads(market_manifest_path.read_text(encoding='utf-8'))['name'] if market_manifest_path.is_file() else '@local/dsh-sao-market'
    targets.append((market, market_name))

for target, package in targets:
    if target != root:
        for rel in ['index.js', 'startup.js', 'icon.png', 'icon.ico', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'screenshots.json', 'SOURCE.md']:
            shutil.copy2(root / rel, target / rel)
        for rel in ['locale', 'assets', 'source']:
            shutil.copytree(root / rel, target / rel, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        # The market README is maintained separately; its links stay package-local.
    code = "window.__ModuleLoader__.load({id:" + json.dumps(package) + ", factory(require) {\nconst React = require('react');\nconst WALLPAPERS = " + json.dumps(wallpapers, ensure_ascii=False, separators=(',', ':')) + ';\nconst ANIMATION_PREVIEWS = ' + json.dumps(previews, separators=(',', ':')) + ';\n' + settings + '\n' + runtime + '\nreturn {inject:[\'slots\',\'theme\',\'sessions\',\'modelDirectories\',\'remote\',\'remote.session\'], apply(ctx) {\n' + startup + '\ntry { applySAOAppearance(ctx, React, WALLPAPERS, ANIMATION_PREVIEWS); applySAOModelIntensity(ctx, React); } catch (error) { console.error("dsh-SAO appearance initialization failed", error); throw error; }\n}};\n}});\n'
    (target / 'client.js').write_text(code, encoding='utf-8', newline='')
    manifest = copy.deepcopy(root_manifest)
    manifest['name'] = package
    manifest['exports']['./client'] = './client.js'
    if 'client.js' not in manifest['files']:
        manifest['files'].append('client.js')
    if target != root or standalone_market:
        manifest['repository']['directory'] = 'market'
    (target / 'package.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='')
    (target / 'cordis.patch.yml').write_text("- insert:\n    - id: sao-link-start\n      name: '" + package + "'\n", encoding='utf-8', newline='')
    print(package, len(code), 'characters')
