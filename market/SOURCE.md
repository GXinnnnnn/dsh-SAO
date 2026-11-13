# Source and build

The root package is `@local/dsh-sao-link-start` and the standalone market package is `@local/dsh-sao-market`; both use version `1.0.6` and provide the same features.

The prebuilt runtime is included. `index.js` injects `startup.js` in the document head before frontend initialization. `client.js` registers the package with the DSH ModuleLoader and uses the host's React for settings, appearance and model intensity controls.

- `source/startup.template.js`, `renderer.js` and `worker.js` produce the native-restoration startup runtime.
- `source/settings-panel.js`, `appearance.js`, `liquid-glass.js`, `control-states.js`, `video-wallpaper.js` and `model-intensity.js` produce the client runtime.
- `assets/wallpapers/` contains the nine shipped wallpaper copies; the adjacent provenance record identifies their sources and hashes.

Startup presents the native-restoration Link Start scene. Settings expose automatic playback, Kirito/Asuna voice, sound, volume and an actual startup preview; voice follows the startup toggle.

Appearance defaults are accent `#8CC8F4` and wallpaper `builtin-3` (SAO · 03). Composer and component backgrounds keep their 10% transparency defaults. Settings sliders use compact, softly separated label/slider/value/reset rows and wrap in narrow panels without endpoint labels.

Liquid glass uses stronger wallpaper refraction and edge highlights; frosted glass uses diffuse blur. Right-sidebar tabs, including Context, Files, Changes, Task Manager, side chat and Diagnostics, share the selected material across their full content surface. The Browser tab keeps its original appearance. The right scene follows the conversation by default; independent material profiles start at 30% transparency / 0px blur for liquid and 50% / 0px for frosted. Each material remembers its own transparency and blur, and per-setting reset restores that material's initial value.

An open right sidebar docked beside the conversation joins along a flat inner edge without a dividing line or doubled corners. The right-scene upper-right corner stays square in docked and fullscreen layouts to align with the native frame; the remaining outer rounding and edge highlights are preserved. Browser, floating and fullscreen panes retain their own frames.

Right-sidebar context cards follow the right material by default and can independently select liquid, frosted or original appearance. The four choices use compact 40px-high, single-line controls that wrap in narrow panels. Their own material profiles start at 20% transparency / 0px blur for liquid and 35% / 0px for frosted, with separate memory and per-setting reset.

Liquid context cards sit above a continuous full-right background, including beneath the cards. Their tint is compensated for the underlying scene: an 80%-opaque card above a 70%-opaque base keeps the intended 80% combined tint instead of becoming 94% opaque. Card bevels sample the tinted right-scene background so their edges blend with the same scene. Frosted context cards retain independent single-fill footprints, clipped to their scroll containers and frame; gutters and the area outside rounded corners retain the right-scene material.

The entire task panel uses DSH's native ongoing-goal strip material. Chat turn-trigger cards, including Continue goal, follow component background transparency and add 5 percentage points on hover without reducing text opacity.

## Build the theme client

Python 3 and its standard library are sufficient. From either package directory, run:

```sh
python source/build-theme.py
```

This command uses the included `startup.js` and wallpapers. It needs no original audio archive and does not rebuild or modify `startup.js`. In the repository root it builds both packages and copies root screenshots to the market package. In the standalone market package it rebuilds that package only. `python source/build-market.py` is an equivalent compatibility entry point.

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

## Feature isolation and video resources

`featureMode` is `all` or `startup-only` in the existing v4 preferences. `dsh-sao-mode-change` notifies independent control and model modules. Startup-only removes the appearance stylesheet, owned DOM markers, wallpaper and liquid canvases, and unmounts the model slider without writing the host theme.

Local MP4/WebM uploads are stored as a Blob plus one WebP poster in the existing IndexedDB store. Validation caps file size at 200 MiB, duration at 30 seconds, long edge at 5120px and short edge at 2880px, supporting 4K/5K landscape and portrait media with bounded metadata/frame waits and cleanup on every path. One native muted looping player supplies motion; the liquid shader samples only a static poster whose long edge is at most 1600px. Hidden pages, unfocused windows and zero wallpaper opacity pause playback. Reduced-motion, static quality and inactive video selection unload the media source. No promise of a fixed CPU/GPU cost or maximum source framerate is made; source videos are not transcoded.

The conversation header is the host's native `[data-conversation-tabs]` view slot: `ui-chat` registers Chat, `ui-trajectory` registers Trajectory, `dsh-context` registers Context/Fleet, and the official experimental statistics client registers Stats. SAO styles these native tab semantics without replacing view registration or navigation. Composer readouts are the official `ui-chat` StatsPills and `ui-conversation` ContextMeter; SAO locally promotes secondary/tertiary ink to the active theme's primary ink and uses weight 600. The verified legacy `.GRgSLq_dock` fallback covers hosts before `data-composer-dock`; startup-only removes all of these rules.

Reference designs: [DSH Transparent UI](https://github.com/WYH66666666/DSH-Transparent-UI-Plugin) and [kimino theme](https://github.com/niiang/dsh-kimino-theme). Control states use verified native semantics and limited class fallbacks. Future native markup changes may require updating those fallbacks.

Performance references: [HTML video](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video), [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).

## GUI adaptation and presentation

Startup uses one aspect-aware projection for both WebGL rendering and the CPU light-occupancy meter. The native focal scale is preserved for ordinary and portrait viewports; 21:9 and 32:9 layouts use proportional cover. The root ResizeObserver and visualViewport resize listener follow the actual visible surface during window resizing and orientation changes, with bounded backing resolution and cleanup on disposal. Background alpha and the foreground dissolve share the viewport and animation clock.

Settings respond to their content-container width, including narrow side panels inside a wide desktop viewport. Voice, volume and preview controls remain reachable; segment labels and slider rows can wrap. Keyboard focus, reduced motion and click/Escape skip have dedicated behavior.

Global control rules exclude native menus and the SAO settings tree. Header view pills own their compact geometry and bottom spacing; the composer dock stays on one line, offers horizontal scrolling when constrained, and honors hidden/empty/pocket states.

The native settings window shares one 32px glass frame and a CSS backdrop, with a transparent inner root. Internal groups use 22px corners and neutral hairlines, with 16px controls and small check markers. The shared shell uses the current accent; its GPU exclusion and transparency tokens keep the material in one layer. Startup-only mode retains the settings page's own presentation.

Conversation header tabs have a transparent group, a 1.5% resting fill, a 13% selected tint and one 14%-alpha one-pixel concentric inset stroke. Hover and pressed states vary the fill; keyboard focus and forced colors have visible indicators.

Liquid optics combine a flat center, curved Snell-refraction edges, directional reflections and bounded edge dispersion. Native selected and focus states remain semantic controls above the material. Page-backed windows sample their visible page. Startup background alpha is independent of the streaks; content-derived implementation identities register the active replay runtime, and host HTML injection reads the current script on each request. Light and dark accents have independent saved profiles.

Patch releases increment from 1.0.6; major new features increment to 1.1.0.
