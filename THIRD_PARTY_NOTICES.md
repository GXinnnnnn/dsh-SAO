# Third-party notices / 第三方素材说明

## SAO Utils / NERvGear

The original desktop utility and native scene were supplied in a user-owned copy of the SAO Utils distribution. SAO Utils is associated with GPBeta / NERvGear. Public project references:

- https://github.com/NERvGear/SAO-Utils
- https://nvg.dev/core/sao-utils/
- Author's scene demonstration: https://www.bilibili.com/video/BV1TZ4y1Q7UL/

This repository contains a newly written WebGL / DSH implementation informed by static analysis and controlled captures of the native scene. It does not contain the original ZIP, DLLs, executables or a claim to the upstream source code. The original scene's design and any applicable third-party rights remain with their owners.

## Embedded recordings

The prebuilt client embeds these files unchanged from `SAO Utils 2/Packages/com.gpbeta.theme.sao/Sounds/`:

| File | SHA-256 |
| --- | --- |
| LinkStart.SAO.Kirito.wav | 76b95783418d693017414b6e5039f19a9533e7b9f2e3c5c48527ecf7a3b1a2c5 |
| LinkStart.SAO.Asuna.wav | fafaf001f3980d274a072e9d1364a0b98c5934fb442e169554c8af7b6a2399be |
| Startup.SAO.NerveGear.wav | b593b79c9d3ad9a2c16c660760190bc28ab417c1d508595f1f61287415071b15 |

These are pre-existing recordings, not voices or effects created by this project. Their creators and rights holders retain their rights. No confirmed redistribution authorization for these recordings was found in the supplied package; the project does not represent that GPBeta controls the underlying SAO recording rights. The new-code MIT license does not apply to these files, their Base64 representation, or the corresponding audio bytes in client.js.

SAO / Sword Art Online character names and related marks belong to their respective owners. This fan project is not affiliated with or endorsed by those owners, GPBeta, or DeepSeek.

## Runtime

The plugin uses React provided by DSH at runtime. It does not vendor React or the DSH runtime in the plugin release.

版权信息用于说明来源，不构成对第三方素材的授权。完整插件不能作为全量 MIT 内容使用或再许可。
