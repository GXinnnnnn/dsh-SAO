# Source and build

The root package is `@local/dsh-sao-link-start` and the standalone market package is `@local/dsh-sao-market`; both retain version `3.0.0` and provide the same features.

The prebuilt runtime is included. `index.js` injects `startup.js` in the document head before frontend initialization. `client.js` registers the package with the DSH ModuleLoader and uses the host's React for settings, appearance and model intensity controls.

- `source/startup.template.js`, `renderer.js`, `thin-renderer.js` and `worker.js` produce the startup runtime.
- `source/settings-panel.js`, `appearance.js`, `liquid-glass.js` and `model-intensity.js` produce the client runtime.
- `assets/wallpapers/` contains the nine shipped wallpaper copies. `assets/animation-previews/` contains renderer-generated preview images; the adjacent provenance records identify their sources and hashes.

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
