# Third-party notices / 第三方素材说明

## SAO Utils / NERvGear

The original desktop utility and native scene were supplied in a user-provided copy of the SAO Utils distribution. SAO Utils is associated with GPBeta / NERvGear. Public project references:

- https://github.com/NERvGear/SAO-Utils
- https://nvg.dev/core/sao-utils/
- Author's scene demonstration: https://www.bilibili.com/video/BV1TZ4y1Q7UL/

This repository contains a newly written WebGL / DSH implementation informed by static analysis and controlled captures of the native scene. It does not distribute the original ZIP, DLLs, executables or upstream native source code. The original scene's design and any applicable third-party rights remain with their owners.

## Embedded recordings

The prebuilt [startup script](startup.js) and [client script](client.js) include these original WAV recordings from the archive directory `SAO Utils 2/Packages/com.gpbeta.theme.sao/Sounds/`:

| File | SHA-256 |
| --- | --- |
| LinkStart.SAO.Kirito.wav | 76b95783418d693017414b6e5039f19a9533e7b9f2e3c5c48527ecf7a3b1a2c5 |
| LinkStart.SAO.Asuna.wav | fafaf001f3980d274a072e9d1364a0b98c5934fb442e169554c8af7b6a2399be |
| Startup.SAO.NerveGear.wav | b593b79c9d3ad9a2c16c660760190bc28ab417c1d508595f1f61287415071b15 |

The selectable Kirito / Asuna voices and NerveGear sound are pre-existing recordings, not voices or effects created by this project. The [audio build script](source/build.py) verifies their original WAV bytes and embeds them unchanged. Runtime code reads PCM16 samples into AudioContext buffers; it does not synthesize replacement voices. The Kirito file is 176510 bytes and the NerveGear file is 688006 bytes.

Their creators and rights holders retain their rights. No confirmed redistribution authorization for these recordings was found in the supplied package; the project does not represent that GPBeta controls the underlying SAO recording rights. The new-code MIT license does not apply to these recordings, their Base64 representation, or the corresponding audio bytes in generated scripts.

## Extracted application icon

The plugin icon was extracted from `SAOHF.exe`, Windows resource **RT_GROUP_ICON 101**, language **1033**. The extracted [ICO](icon.ico) is retained, together with the exact 256×256 PNG image from that resource, distributed as [icon.png](icon.png) and [assets/icon.png](assets/icon.png). [Icon provenance](assets/icon-source.json) records the resource identity.

SHA-256 of the exact 256×256 PNG:

```text
d024cfb3ee2750f9bdb429ef4f8a77402d65aca65cccd1a4ce24a3b7112b9c72
```

The source EXE is excluded from the public package. The icon is third-party material, not original artwork created by this project. Extraction and attribution do not establish redistribution permission; no confirmed authorization is asserted. The new-code MIT license does not cover this icon or its ICO/PNG representations.

## Built-in wallpapers and uploaded media

The nine built-in wallpapers come from separately supplied source images. The original four source files are `SAO (1).jpg`, `SAO (1).png`, `SAO (2).jpg` and `SAO (3).jpg`; preparation leaves the original images unchanged. [Wallpaper provenance](assets/wallpapers/provenance.json) records all nine source filenames, source and output SHA-256 values, and delivery dimensions. The [preparation script](source/prepare-wallpapers.py) documents conversion.

Supplying images locally, resizing, converting to WebP, packaging or recording hashes does not grant copyright or redistribution rights. No license grant for these wallpapers or their depicted characters, artwork or marks is asserted. They are excluded from the new-code MIT license. Custom image and video uploads are stored in the user's local browser IndexedDB and are not uploaded to a server by this feature; users and original rights holders retain their respective rights. This project grants no rights in uploaded media.

## ACG-album liquid-glass adaptation — MIT

The rounded-distance lens / shader and shared-renderer design in [the liquid-glass source](source/liquid-glass.js) are adapted from [ACG-album](https://github.com/GXinnnnnn/ACG-album), upstream path `src/ui/liquid-glass.js`.

Copyright (c) 2026 友利奈绪的胖次 (GXinnnnnn) — https://github.com/GXinnnnnn

The source retains the complete upstream MIT copyright and permission notice, including its warranty disclaimer. It is also included in the generated client containing this adaptation. The notice is reproduced below for attribution; this does not change [LICENSE](LICENSE) or extend code licensing to third-party assets.

```text
MIT License

Copyright (c) 2026 友利奈绪的胖次 (GXinnnnnn)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The adaptation samples the selected wallpaper using a shared GPU renderer, with a CSS fallback when unavailable. It does not capture DOM content, conversations or other plugins.

## Liquid optics research references

The 1.0.6 optical refinement studies public rendering techniques, including the convex lens profile explained by [Kube](https://kube.io/blog/liquid-glass-css-svg/), [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react), [shuding/liquid-glass](https://github.com/shuding/liquid-glass), and the transmission materials in [Three.js](https://github.com/mrdoob/three.js) and [Drei](https://github.com/pmndrs/drei). These are references for independent equations and engineering comparison; their source code, dependencies and assets are not included in this refinement. No license is inferred for the Kube article/repository. The existing ACG adaptation attribution and license above remain applicable.

This plugin uses its own rounded-boundary mask, independently derived convex quartic profile and Snell refraction, with bounded edge-only channel offsets and directional reflections. It does not snapshot the document or create one rendering context per control. Page-backed windows keep the host's native CSS background.

## Fonts, runtime and other rights

The client uses host-provided React and the DSH runtime; it does not bundle either. The default font name is 方正兰亭圆_准, resolved through locally installed families 方正兰亭圆_GBK_准 / `FZLanTingYuan-M-GBK`. No font files are copied, bundled or redistributed. Referring to installed fonts grants no font license.

SAO / Sword Art Online character names and related marks belong to their respective owners. This fan project is not affiliated with or endorsed by those owners, GPBeta, or DeepSeek.

版权信息用于说明来源，不构成对第三方原声、图标、壁纸、角色或商标的授权。新编写集成代码与 ACG 适配代码的 MIT 许可不涵盖上述第三方素材，完整插件不能作为全量 MIT 内容使用或再许可。详见 [LICENSE](LICENSE)。
