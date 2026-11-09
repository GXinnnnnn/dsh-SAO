# Runtime verification

Use Node.js 20 or later. Pure runtime tests require only built-in modules:

```sh
node --test tests/intensity.test.mjs tests/video-wallpaper.test.mjs tests/control-states.mjs tests/surface-opacity.test.mjs tests/wallpaper-scope.test.mjs
```

Browser tests use Playwright and an installed Chromium/Edge. Set `SAO_TEST_PLAYWRIGHT` and `SAO_PLAYWRIGHT_MODULE` to the Playwright module when it is not resolvable locally. `SAO_TEST_REACT_ROOT` points to a directory containing `react` and `react-dom` for the native model-range fixture. The tests use temporary contexts and simulated services; they never submit a model inference request.

```sh
node --test tests/control-browser.mjs tests/intensity-browser.test.mjs tests/appearance-browser.test.mjs tests/theme-profiles-browser.test.mjs
node --test tests/settings-style-browser.mjs tests/settings-segments-browser.mjs
```

For the native video test, set `SAO_TEST_VIDEO` to a local supported short MP4/WebM, or set `SAO_TEST_FFMPEG` to an FFmpeg executable and `SAO_TEST_FORMAT` to `mp4` or `webm`. Set `SAO_TEST_SIZE=3840x2160` or `5120x2880` to verify 4K/5K decoding and the bounded 1600px poster; the generated single-frame fixtures remain small. Without a media fixture or encoder, the native smoke test reports a skip; the pure lifecycle tests still run.

```sh
node --test tests/video-browser.test.mjs
```

Layout coverage includes one-line composer statistics at narrow widths with reachable horizontal overflow, native menu/settings exclusions, compact header pills with bottom clearance, and startup-only restoration.

Coverage includes provider-default effort handling, stale model selection, native pointer and keyboard commits, pending/error/cancellation, full/startup-only teardown, theme/reset generations, control state contrast, dangerous/disabled exclusions, glass dimensions and seams, video decoding/poster generation, bounded validation and resource cleanup, alpha composition, wallpaper geometry, and independent material defaults.

The settings segment suite also checks cache invalidation: status-only video notifications, same-id wallpaper hydration/poster replacement, resize and font changes, relative sample movement without size changes, rapid animation interruption, and reselecting the current category. Work counters verify that voice changes do not measure or repaint the preview and that unchanged notifications do not remeasure segment geometry. Motion assertions require two translation keyframes, 220ms easing, monotonic movement without deformation/overshoot, continuous rapid interruption and reduced-motion cancellation. Trusted local scroll events must not measure the preview, rewrite masks, resync global materials or measure/draw unrelated GPU surfaces; scrolling a real glass ancestor is a positive control. These assertions avoid machine-dependent timing thresholds; installed-GUI performance comparisons use the same viewport, selections, tracing and CPU rates before and after the change.

The theme-profile browser suite checks legacy migration (including follow-DSH null), per-mode accent persistence/reload, deep-cloned profiles, system/OS changes, real cross-tab storage events, current/global resets, queued and asynchronous native-theme races, service errors/disposal, startup-only mode, zero material work for accent-only changes and one coalesced pass for an effective theme change. Pure source-extraction fixtures supply a minimal native theme snapshot/media environment.
