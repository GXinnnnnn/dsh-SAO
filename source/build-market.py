"""Build the self-contained Skin Market bundle from the verified root startup.

Run after build.py. No original program is executed; no package installation.
"""
from pathlib import Path
import hashlib, json, shutil

root = Path(__file__).resolve().parents[1]
target = root / 'market'
target.mkdir(exist_ok=True)
pkg = json.loads((root / 'package.json').read_text(encoding='utf-8'))
startup = (root / 'startup.js').read_bytes()
name = '@local/dsh-sao-market'
manifest = {
    'name': name, 'version': pkg['version'], 'private': True,
    'type': 'module', 'description': pkg['description'],
    'author': pkg['author'], 'license': pkg['license'],
    'repository': {**pkg['repository'], 'directory': 'market'},
    'homepage': pkg['homepage'], 'icon': './icon.png',
    'exports': {'.': './index.js', './client': './client.js', './icon': './icon.png',
                './package.json': './package.json', './locale/*.json': './locale/*.json'},
    'files': ['index.js', 'client.js', 'startup.js', 'cordis.patch.yml', 'icon.png',
              'icon.ico', 'locale', 'assets', 'screenshots.json', 'README.md',
              'LICENSE', 'THIRD_PARTY_NOTICES.md', 'SOURCE.md', 'BUILD.json'],
    'dsh': {'bundle': {'patch': './cordis.patch.yml'},
            'client': {'platform': 'web', 'inject': [], 'external': [], 'immediately': True}}
}
(target / 'package.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(target / 'cordis.patch.yml').write_text("- insert:\n    - id: sao-link-start\n      name: '@local/dsh-sao-market'\n", encoding='utf-8')
# A real client entry: plays the complete startup when Host injection was absent,
# shares its once-per-document guard with the early Host entry, and stops on dispose.
client = ("window.__ModuleLoader__.load({id: '@local/dsh-sao-market', factory() {\n"
          "  return { apply(ctx) {\n" + startup.decode('utf-8') +
          "\n    ctx.on('dispose', () => window[Symbol.for('dsh.sao.startup.v3')]?.stop?.());\n"
          "  } };\n}});\n")
(target / 'client.js').write_text(client, encoding='utf-8', newline='')
for relative in ['index.js', 'startup.js', 'icon.png', 'icon.ico', 'LICENSE',
                 'THIRD_PARTY_NOTICES.md', 'screenshots.json']:
    shutil.copy2(root / relative, target / relative)
for directory in ['locale', 'assets']:
    shutil.copytree(root / directory, target / directory, dirs_exist_ok=True)
(target / 'README.md').write_text('''# dsh-SAO

DSH 皮肤市场适配包：只播放仿刀剑神域启动动画和原声，结束后显示 DSH。没有主题覆盖、设置或常驻控件。

![dsh-SAO 启动场景](assets/startup.png)

在 DSH 添加插件中安装此子目录，或者使用 DSH Skin Market 中的 dsh-SAO：

```text
github:GXinnnnnn/dsh-SAO#main&path:/market
```

市场会为安装目标锁定真实提交。不要同时启用仓库根目录包和此适配包，切换前停用或移除原副本。

Host 在前端模块启动之前注入遮罩和声音；Web 客户端提供完整的播放回退和卸载清理。两个入口使用同一个文档级播放标记，Host 已开始或完成时，客户端不会重复播放。Esc 可跳过，动画结束会清理画面、Worker、GPU、声音和事件。

覆盖 DSH 内容窗口，不能先于原生窗口或 Host 就绪，不能强制操作系统全屏。浏览器音频策略可能要求点击后播放声音。

本包由仓库根目录的 `source/build-market.py` 从同一 `startup.js` 生成。内部 package 版本用于安装系统，展示名称固定为 dsh-SAO。场景、原声和提取图标与根目录包相同。新集成代码为 MIT，第三方原声和提取图标不在该许可内，授权情况见 LICENSE 和 THIRD_PARTY_NOTICES.md。本项目不代表 DSH、市场或原素材权利方背书。
''', encoding='utf-8')
(target / 'SOURCE.md').write_text('''# dsh-SAO 市场构建来源

此包从仓库根目录的预构建 startup.js 生成，没有修改原生场景方程、音频或图标。
重建：在仓库根目录运行 `python source/build-market.py`。
原始移植参数、音频与素材哈希见 https://github.com/GXinnnnnn/dsh-SAO/blob/main/SOURCE.md 。

index.js 是实际 Host 入口；client.js 是完整动画的 Web 回退入口。客户端 ctx dispose 会调用同一动画实例的 stop，释放运行中的资源。一次页面加载只播放一次，重新启用不会额外重播。
''', encoding='utf-8')
(target / 'BUILD.json').write_text(json.dumps({
    'builder': 'source/build-market.py',
    'startupSha256': hashlib.sha256(startup).hexdigest(),
    'clientSha256': hashlib.sha256((target / 'client.js').read_bytes()).hexdigest(),
    'iconSha256': hashlib.sha256((target / 'icon.png').read_bytes()).hexdigest()
}, indent=2) + '\n', encoding='utf-8')
assert (target / 'startup.js').read_bytes() == startup
print(json.dumps({'package': name, 'startupBytes': len(startup), 'target': str(target)}, indent=2))
