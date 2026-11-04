# Source and build

The root package is `@local/dsh-sao-link-start` and the standalone market package is `@local/dsh-sao-market`; both retain version `3.0.0` and provide the same features.

The prebuilt runtime is included. `index.js` injects `startup.js` in the document head before frontend initialization. `client.js` registers the package with the DSH ModuleLoader and uses the host's React for settings, appearance and model intensity controls.

- `source/startup.template.js`, `renderer.js`, `thin-renderer.js` and `worker.js` produce the startup runtime.
- `source/settings-panel.js`, `appearance.js`, `liquid-glass.js` and `model-intensity.js` produce the client runtime.
- `assets/wallpapers/` contains the nine shipped wallpaper copies. `assets/animation-previews/` contains renderer-generated preview images; the adjacent provenance records identify their sources and hashes.

Appearance defaults are accent `#8CC8F4` and wallpaper `builtin-3` (SAO · 03). Composer and component backgrounds keep their 10% transparency defaults. Settings sliders use compact, softly separated label/slider/value/reset rows and wrap in narrow panels without endpoint labels.

Liquid glass uses stronger wallpaper refraction and edge highlights; frosted glass uses diffuse blur. Right-sidebar tabs, including Context, Files, Changes, Task Manager, side chat and Diagnostics, share the selected material across their full content surface. The Browser tab keeps its original appearance. The right scene follows the conversation by default; independent material profiles start at 30% transparency / 0px blur for liquid and 50% / 0px for frosted. Each material remembers its own transparency and blur, and per-setting reset restores that material's initial value.

An open right sidebar docked beside the conversation joins along a flat inner edge without a dividing line or doubled corners; the outer rounded frame and edge highlights remain. Browser, floating and fullscreen panes retain their own frames.

Right-sidebar context cards follow the right material by default and can independently select liquid, frosted or original appearance. The four choices use compact 40px-high, single-line controls that wrap in narrow panels. Their own material profiles start at 20% transparency / 0px blur for liquid and 35% / 0px for frosted, with separate memory and per-setting reset.

Liquid context cards sit above a continuous full-right background, including beneath the cards. Their tint is compensated for the underlying scene: an 80%-opaque card above a 70%-opaque base keeps the intended 80% combined tint instead of becoming 94% opaque. Card bevels sample the tinted right-scene background so their edges blend with the same scene. Frosted context cards retain independent single-fill footprints, clipped to their scroll containers and frame; gutters and the area outside rounded corners retain the right-scene material.

The entire task panel uses DSH's native ongoing-goal strip material. Chat turn-trigger cards, including Continue goal, follow component background transparency and add 5 percentage points on hover without reducing text opacity.

## Build the theme client

Python 3 and its standard library are sufficient. From either package directory, run:

```sh
python source/build-theme.py
```

This command uses the included `startup.js`, wallpapers and animation previews. It needs no original audio archive and does not rebuild or modify `startup.js`. In the repository root it builds both packages and copies root screenshots to the market package. In the standalone market package it rebuilds that package only. `python source/build-market.py` is an equivalent compatibility entry point.

ModuleLoader IDs are read from each package's manifest; the version and existing export aliases are retained. Generated files contain no timestamps. Each package keeps its own README and package-local screenshot links.

## Rebuild startup audio and animation

Rebuilding `startup.js` requires an externally supplied original `SAO.zip`; that archive is not distributed here:

```sh
python source/build.py --archive /path/to/SAO.zip
python source/build-theme.py
```

The script reads the three original WAV files under `SAO Utils 2/Packages/com.gpbeta.theme.sao/Sounds/`, verifies their SHA-256 values and embeds their unchanged bytes. The required filenames and hashes are recorded in `THIRD_PARTY_NOTICES.md` and `source/build.py`.

The optional `source/prepare-wallpapers.py` uses Pillow and separately supplied source images in a sibling `image` directory. It is unnecessary for the theme build; the prepared wallpapers are included.

New integration code and the liquid-glass adaptation retain their respective MIT notices. Embedded audio, icons, wallpapers and other pre-existing material have separate rights and exclusions; see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).
