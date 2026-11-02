# Third-party notices / 第三方素材说明 · 3.0.0

## SAO Utils / NERvGear

The original desktop utility and native scene were supplied in a user-provided copy of the SAO Utils distribution. SAO Utils is associated with GPBeta / NERvGear. Public project references:

- https://github.com/NERvGear/SAO-Utils
- https://nvg.dev/core/sao-utils/
- Author's scene demonstration: https://www.bilibili.com/video/BV1TZ4y1Q7UL/

This repository contains a newly written WebGL / DSH implementation informed by static analysis and controlled captures of the native scene. It does not distribute the original ZIP, DLLs, executables or upstream source code. The original scene's design and any applicable third-party rights remain with their owners.

## Embedded recordings

The prebuilt [startup.js](startup.js) embeds only these two original WAV files from the archive directory `SAO Utils 2/Packages/com.gpbeta.theme.sao/Sounds/`:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| LinkStart.SAO.Kirito.wav | 176510 | 76b95783418d693017414b6e5039f19a9533e7b9f2e3c5c48527ecf7a3b1a2c5 |
| Startup.SAO.NerveGear.wav | 688006 | b593b79c9d3ad9a2c16c660760190bc28ab417c1d508595f1f61287415071b15 |

These pre-existing recordings are not voices or effects created by this project. The original WAV bytes are verified by the build script and embedded unchanged. Runtime code reads their PCM16 samples into AudioContext buffers for playback; it does not synthesize replacement voices. No other character recording is included in the 3.0.0 build.

Their creators and rights holders retain their rights. No confirmed redistribution authorization for these recordings was found in the supplied package; the project does not represent that GPBeta controls the underlying SAO recording rights. The new-code MIT license does not apply to these recordings, their Base64 representation, or the corresponding audio bytes in the generated startup script.

## Extracted application icon

The plugin icon was extracted from `SAOHF.exe`, Windows resource **RT_GROUP_ICON 101**, language **1033**. The extracted [ICO](icon.ico) is retained, together with the exact 256×256 PNG image from that resource, distributed as [icon.png](icon.png) and [assets/icon.png](assets/icon.png).

SHA-256 of the exact 256×256 PNG:

```text
d024cfb3ee2750f9bdb429ef4f8a77402d65aca65cccd1a4ce24a3b7112b9c72
```

The source EXE is excluded from the public package. The icon is third-party material, not original artwork created by this project. Extraction and attribution do not establish redistribution permission; no confirmed authorization is asserted. The new-code MIT license does not cover this icon or its ICO/PNG representations.

## Runtime and attribution limits

The startup implementation uses browser APIs including Worker, OffscreenCanvas, WebGL and AudioContext. It does not use or vendor React, and does not bundle the DSH runtime.

SAO / Sword Art Online character names and related marks belong to their respective owners. This fan project is not affiliated with or endorsed by those owners, GPBeta, or DeepSeek.

版权信息用于说明来源，不构成对第三方声音、图标、角色或商标的授权。新编写集成代码的 MIT 许可不涵盖上述第三方内容，完整插件不能作为全量 MIT 内容使用或再许可。详见 [LICENSE](LICENSE)。
