# Runtime verification

Use Node.js 20 or later. Pure runtime tests require only built-in modules:

```sh
node --test tests/intensity.test.mjs tests/video-wallpaper.test.mjs tests/control-states.mjs tests/surface-opacity.test.mjs tests/wallpaper-scope.test.mjs
```

Browser tests use Playwright and an installed Chromium/Edge. Set `SAO_TEST_PLAYWRIGHT` and `SAO_PLAYWRIGHT_MODULE` to the Playwright module when it is not resolvable locally. `SAO_TEST_REACT_ROOT` points to a directory containing `react` and `react-dom` for the native model-range fixture. The tests use temporary contexts and simulated services; they never submit a model inference request.

```sh
node --test tests/control-browser.mjs tests/intensity-browser.test.mjs tests/appearance-browser.test.mjs tests/theme-profiles-browser.test.mjs tests/page-glass-browser.test.mjs
node --test tests/settings-style-browser.mjs tests/settings-segments-browser.mjs tests/settings-shell-browser.test.mjs
node --test tests/startup-exit-browser.test.mjs tests/startup-alpha-browser.test.mjs
```

For the native video test, set `SAO_TEST_VIDEO` to a local supported short MP4/WebM, or set `SAO_TEST_FFMPEG` to an FFmpeg executable and `SAO_TEST_FORMAT` to `mp4` or `webm`. Set `SAO_TEST_SIZE=3840x2160` or `5120x2880` to verify 4K/5K decoding and the bounded 1600px poster; the generated single-frame fixtures remain small. Without a media fixture or encoder, the native smoke test reports a skip; the pure lifecycle tests still run.

```sh
node --test tests/video-browser.test.mjs
```

Layout coverage includes one-line composer statistics at narrow widths with reachable horizontal overflow, native menu/settings exclusions, compact header pills with bottom clearance, and startup-only restoration.

Coverage includes provider-default effort handling, stale model selection, native pointer and keyboard commits, pending/error/cancellation, full/startup-only teardown, theme/reset generations, control state contrast, dangerous/disabled exclusions, glass dimensions and seams, video decoding/poster generation, bounded validation and resource cleanup, alpha composition, wallpaper geometry, and independent material defaults.

The settings segment suite also checks cache invalidation: status-only video notifications, same-id wallpaper hydration/poster replacement, resize and font changes, relative sample movement without size changes, rapid animation interruption, and reselecting the current category. Work counters verify that voice changes do not measure or repaint the preview and that unchanged notifications do not remeasure segment geometry. Motion assertions require two translation keyframes, 220ms easing, monotonic movement without deformation/overshoot, continuous rapid interruption and reduced-motion cancellation. Trusted local scroll events must not measure the preview, rewrite masks, resync global materials or measure/draw unrelated GPU surfaces; scrolling a real glass ancestor is a positive control. These assertions avoid machine-dependent timing thresholds; installed-GUI performance comparisons use the same viewport, selections, tracing and CPU rates before and after the change.

The liquid-optics browser suite (`node --test tests/liquid-optics-browser.test.mjs`) compares the accepted and current real WebGL renderer against grid and wallpaper sources. It checks a quiet flat center, changed edge refraction/reflections, light/dark composition, rounded and joined masks, opacity endpoints, context loss, render-key reuse, bounded surfaces and idle behavior. CPU submission/copy timing is reported separately from GPU execution time; performance evidence must identify which was measured.

The header-optics browser suite (`node --test tests/header-optics-browser.test.mjs`) compares the accepted first optics upgrade with the current shader on thin headers and ordinary cards. It uses actual WebGL output composed over unchanged material fill to measure broad edge whitening, directional highlights, quiet centers and patterned-background refraction. Native GUI evidence separately isolates the optical canvas, CSS pseudo-elements and selected controls; synthetic pixel statistics alone do not establish the source of a user-interface outline.

The page-glass browser suite exercises the actual appearance and WebGL sources with native CSS compositing. It checks conversation-to-white-page navigation and return, hidden/inert/aria-hidden/display/visibility lifecycle, display:contents outlets, nested dialogs and Browser panes, corner-only occlusion, exact white-page screenshot equality after changing the old wallpaper, GPU pixel changes when wallpaper becomes visible again, light/dark/custom tint, zero-alpha/off/frost/startup-only modes and disposal. Trusted settings-local scroll events must not trigger material/geometry/GPU work; scrolling a true optical ancestor is a positive control. `SAO_PAGE_GLASS_EVIDENCE` selects the external evidence folder.

The settings-shell browser suite verifies the shared native settings window before SAO has ever mounted, during SAO use, and after navigation to another category. It covers native role-dialog and dialog hosts, light/dark accents and surface color, scoped translucent navigation/cards, semantic content and native keyboard behavior, material/zero-opacity/startup-only/disposal lifecycle, and trusted local scrolling without extra material or GPU work.

The control browser suite uses the native 36×20 compact switch and its 16px thumb. It checks the selected switch's uniform single stroke and preserved knob across light/dark, twelve accents and rest/hover/press states. Enabled fill must match the active theme accent mixed with 8% black (6% on hover, 10% on press); thumb contrast is recorded without imposing the old translucent recipe's 3:1 guarantee. Native keyboard/focus, forced colors, unchanged inactive styles and native geometry, and disabled/danger exclusions remain covered. Other selected controls retain their own recipes.

The theme-profile browser suite checks legacy migration (including follow-DSH null), per-mode accent persistence/reload, deep-cloned profiles, system/OS changes, real cross-tab storage events, current/global resets, queued and asynchronous native-theme races, service errors/disposal, startup-only mode, zero material work for accent-only changes and one coalesced pass for an effective theme change. Pure source-extraction fixtures supply a minimal native theme snapshot/media environment.

The startup-exit browser suite builds the actual startup inputs in an isolated fixture, using Python and the original asset archive (`SAO_TEST_PYTHON` and `SAO_TEST_ARCHIVE`, default `C:/SAO/original/SAO.zip`). `SAO_TEST_EDGE` selects Edge and `SAO_EXIT_FIXTURE` selects evidence output. It compares geometric occupancy with actual rendered pixels, then verifies real WebGL/Canvas workers and main-thread fallback, protected opening, adaptive CSS dissolve, audio gain ramp, resource disposal, immediate skip/Escape, replay isolation, reduced motion and restored focus. Pixel readback belongs only to tests; production uses a bounded CPU mask.

The startup-alpha suite builds the same real startup sources, compares the opaque renderer path against the accepted baseline, measures real RGBA at background opacity 0/0.5/1, preserves streak colors and motion, and verifies a live changing DOM underlay while the foreground root remains fully visible. It covers WebGL and Canvas workers, both main-thread fallbacks, and resize. `SAO_ALPHA_FIXTURE` selects the external evidence directory; production does not read back or color-key canvas pixels. The appearance suite also keeps the startup overlay out of ordinary dialog glass.
