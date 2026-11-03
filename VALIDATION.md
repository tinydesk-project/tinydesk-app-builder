# App Builder local validation

## 0.6.0: native packages and consistent appearance

- Browser verified mixed corner styles/radii, immediate group corner edits,
  independent mixed gradient fields and preservation of different end colors
  after changing the common start color. Optional font fields stay visible.
- Generated-font example switches to Transparent in the Inspector and runs in
  the native simulator. This exposed and fixed a C fallback-label overflow;
  its regression checks cells outside a multiline transparent text rectangle.
  All 24 native tests pass after the fix, including the socket protocol test.
- Native exports compile for `xtensawin` and `rv32imc`. The actual browser
  Export app download was inspected and contains native C6 code, editable JSON,
  assets and a matching CPU/ABI manifest. Its bootstrap remains bytecode.
- `verify_native_package.py` covers deterministic output, preserved native
  dependencies, mixed-CPU/unsupported-ABI rejection, wrong-target rejection
  before extraction and clear desktop-simulation diagnostics.
- HTTP compiler tests cover both native targets. Portable export/control/pixel,
  package and real font runtime tests pass. Nine Node suites pass, including
  new optional-field and rounded slider/gauge checks.
- File-size comparison on the unchanged gradient-controls example: portable
  main 2,737 B, Xtensa native 10,221 B, C6 native 10,089 B. These measurements
  do not establish a whole-GUI speedup or executable-RAM fit for a larger app.
- Actual native package execution succeeded on the 4 MB ESP32, 240 MHz,
  using its existing root session/firmware. An identical integer loop ran
  20,000 iterations in 167,592 us bytecode versus 39,924 us native (best of
  three, GC before each), both returning 23,280: approximately 4.2x faster
  for this calculation. A portable dependency and the native main shared the
  same TDAPP container. The legacy loader used an `.mpy` filename for that
  container; current TinyDesk also recognizes `.tdapp`. Temporary files and
  its cache were removed afterwards. C6 native execution and whole-GUI
  performance have not been measured; native export remains opt-in.

## 0.5.0: shared attributes, gradient fills and runtime integration

- Browser verified Shift/Outline group selection, mixed shared fields, live
  Inspector edits, group move/resize and Undo. Full-canvas backgrounds remain
  selectable in Outline without intercepting marquee selection.
- Nine Node suites cover model/export round trips, pixels, geometry, resources,
  startup, frame compositing, fonts, selection and gradients.
- Real MicroPython export, controls, pixel/package/font loading, simulation
  and HTTP helper checks pass. An external private project completes repeated
  page transitions with changing dummy readings; it is not included here.
- TinyDesk's fresh host build passes all 24 tests, including socket-dependent
  Modbus tests outside the sandbox. Its standalone shell passes nine tests,
  including the production account store with real SHA-256 and mock NVS.
- Fresh firmware builds fit the existing partitions on ESP32 4 MB, ESP32 with
  PSRAM, ESP32-C6, ESP32-S3 and CrowPanel. Final app-only transfers and startup
  screens were verified on the latter four. The 4 MB ESP32 still needs manual
  download-mode entry. Full flash backups and account data are preserved.
- Existing device passwords were not reset. Physical password/login and
  remembered-startup checks remain separate from app simulation; the helper
  explicitly starts the development runtime in app-preview mode.
- Native compiler/package export works. The optional offline WASM compiler
  check skips because `vendor/mpy-cross.js` is not installed.

## 0.4.0: text import and generated fonts

- Browser verified system-font generation, TTF import, 28 px / 4-bit and
  40 px / 1-bit glyphs, text-file import, immediate Inspector font changes,
  asset metadata/previews and native simulation. Existing 0.3.6 cell/image
  compositing is preserved.
- `tests/fonts.test.cjs`: binary format round trips, malformed/truncated
  files, Unicode fallback, multiline/wrapping metrics, shared resources,
  button font export and package-relative font paths.
- `tests/verify_fonts.py`: real MicroPython TDAPP loads a font bundled once,
  renders native pictures, rejects oversized/NUL dynamic text, updates
  values at least 20 times and changes retained pages repeatedly.
- Native `test_font`: glyph validation, 1-/4-bit coverage, UTF-8 fallback,
  clipping, alignment and word wrapping. `test_pyui` checks long native
  labels, shared page copies, replacement and full memory-budget recovery.
- All 19 host tests pass with local sockets enabled, including `test_proto`.
  The socket-dependent test fails under sandbox restrictions; no Modbus code
  was changed for it.
- Node core/pixel/geometry/resource/startup/frame checks, Python current and
  legacy export/control/package/simulation/HTTP checks pass. The private
  external project passes ten HOME/POWER round trips with updating readings.
- Fresh host build: `tinydesk/build-fonts-20261103`. CrowPanel and ESP32-S3
  firmware builds include native fonts and retain their prior display setup.
- Application-only firmware flashes verified on COM22 and COM19. CrowPanel
  keeps its existing dummy package/splash/settings. The S3 bench loads a
  temporary 4-bit font, renders through `Canvas.font_text`, closes via timer,
  frees the font and removes its test files. Font rendering was also visually
  verified in the browser simulator; the physical CrowPanel font demo was
  not substituted for its running private dummy app.

## Earlier validation

- 127 core checks: canonical JSON/Python round trips, layout/resource
  limits, pages, window operations, handler wiring and import rejection.
- Pixel model and actual tdui API checks: pictures, image masks, batching,
  press/release/click/cancel, disabled and removed controls.
- Ten canonical exports compile and run against current and legacy tdui
  API snapshots, including cached pages and fallback paths.
- New controls: real slider drag/release, disabled behavior, gauge/meter/
  label binding, reset events and balanced drawing batches.
- 30 local board-bridge checks, including token/origin validation, passive
  FTP behavior, transfer limits and idle cleanup.
- TDAPP: deterministic builds, project/image/module recovery, corruption
  rejection, compiled dependency preservation and actual MicroPython launch.
- Simulation: generated app execution, Python timers, slider mouse input,
  embedded resources and isolated restart in the TinyDesk host runtime.
- HTTP helper: native bytecode compilation, binary app export and rejection
  of an invalid token, covering the real routes used by the browser.
- Browser checks: individual element editor, slider binding selector, image
  import, project recovery from a binary app and native `.mpy` export.
- Fixed inspector checks: selection opens no dialog; changing Width updates
  the canvas immediately. Mouse resize changed a button from 22×3 to 24×4,
  dragging updated X/Y, and Undo restored the previous geometry. Numeric
  bounds, snapping, anchor preservation, circles and line endpoint resizing
  are covered by `tests/geometry.test.cjs`.

Commands:

```text
node tests/core.test.cjs
node tests/pixels.test.cjs
node tests/geometry.test.cjs
python tests/verify_export.py
python tests/verify_pixels.py
python tests/verify_controls.py
python tests/verify_bridge.py
python tests/verify_package.py
python tests/verify_simulation.py
python tests/verify_helper_http.py
```

The last three checks require the matching native compiler and TinyDesk
host runtime. Local-network tests may need permission outside a restricted
sandbox. The optional standalone WASM compiler is a separate build; the
local helper provides native compilation when that bundle is absent.

This document records local checks, not a published GitHub release or a
claim of exhaustive hardware validation. Device timing, input hardware and
physical interfaces still need tests on the intended board.

## App Builder 0.3.2

Verified custom startup page visibility and its timed transition in real
MicroPython (`tests/verify_startup.py`), plus optional/status modes and invalid
configuration rejection (`tests/startup.test.cjs`). HTTP checks now run
rendered apps, repeat launches and reject stale input/poll/stop sessions.
The helper chooses the newest host build and prints its exact runtime path.
Browser checks confirmed repeated Run/Stop, fixed Inspector color selection
and straight/rounded corners.

TDAPP tests verify cache reuse without rewriting valid files and repair of
damaged cached bytecode. Embedded artwork is stored once as checked package
files, with metadata retained in project JSON. Install / kiosk computes its
artwork cache path from the exact package manifest.

Firmware host tests: all 17 passed with local TCP allowed. CrowPanel
firmware builds with image snapshots pinned during LCD painting and image
tiles preserved under the terminal cursor. Generic kiosk artwork was
checked through the real image decoder and native-resolution picture output.
Physical LCD appearance still needs visual confirmation after flashing.

Startup transition regression checks: `verify_kiosk_startup.py` confirms
loading artwork is absent from later application frames. `verify_startup.py`
checks that initialization callbacks run outside the drawing batch, including
a deliberately slow callback. Initial window construction has a bounded
5 s allowance; normal drawing keeps its 1 s watchdog.

## App Builder 0.3.3

Simulation now generates package-relative resource paths, checks required
images/modules before starting, and detects an outdated helper in the UI.
`verify_simulation.py` decodes a real imported image whose board path has a
nested directory, and verifies missing dependencies fail before launch.
Simulation, HTTP/session isolation and TDAPP launch tests pass, alongside
core (127 checks), pixel, geometry and startup Node checks.

Browser verification covered image skin -> straight -> rounded -> image skin,
with immediate drawing and handler preservation. Sprite-sheet toggles now
commit immediately. New geometric controls use sizes/radii that visibly round
on the device grid; existing designs keep their stored geometry. Layers drawn
later can still intentionally cover a shape's corners. A private project was
restored after diagnostic edits and ran successfully with changing dummy values
and mouse navigation to TEMP. Its images and dependencies remain private.
No firmware or board settings were changed for this release.

## App Builder 0.3.4

Fixed the import failure that renamed a required image into an unrelated
asset_N file. Imports now repair exact filenames and legacy original-name
aliases, while Resources / Locate image supports explicitly relinking another
local filename. Existing elements and their decoded geometry are retained.
`resources.test.cjs` covers repair, replacement, aliases, inventory, collisions
and geometry preservation; it is included in CI. The real MicroPython
simulation check now imports through that resource logic and decodes the
result, including an extracted-metadata / external-file fallback case.

Empty extracted image/module metadata no longer erases a valid local file.
Export resolves only declared modules from local directories. TDAPP retains
one checked copy of embedded dependencies rather than duplicating their base64
inside extracted project JSON. Package, HTTP/session, real simulation, export,
pixel/control and bridge checks pass. A private self-contained JSON passed ten
HOME/POWER round trips with changing readings and no helper project directory.

Chrome UI inspection was stopped by Computer Use because it could not verify
the current URL. These changes were checked through source, resource tests,
the actual HTTP helper and MicroPython; no new browser screenshot is claimed.

## App Builder 0.3.6

All imported/referenced images, retained text sources and declared/compiled
modules appear in the left Assets pane. Selection opens previews, size,
embedding status, locate/replace/download and element references in the fixed
Inspector. Reference links return to an editable element; removal is restricted
to unused resources and supports Undo. Components and Outline have their own
tabs. New text imports keep their source files; portable .mpy imports are stored
as compiled dependencies. Default button artwork embeds automatically and also
ships in the helper's generic examples; existing custom skins are preserved.

Verified both editor appearances against the live TinyDesk documentation site.
The exact existing logo icon/favicon are reused. Browser screenshots cover the
complete six-resource private inventory, skin preview and usage list in light
and dark themes. Private screenshot artifacts stay outside this repository.

The reported Chrome screen had native-image parts but lost ordinary cells.
Inspection of its actual helper capture found 82 white blocks and 605 blue
background cells: app-side drawing was present. The final preview composites
native TDCF cell snapshots and decoded Sixel into one visible canvas outside
xterm's DOM stacking. Cell metrics are aligned before startup; the terminal
remains as an invisible input/decoder surface. Protocol 3 rejects an outdated
helper, and old runtimes fail with a clear rebuild message.

User confirmed Chrome: "All visible now" on 0.3.6. Browser verification also
covers image/cell compositing and mouse navigation in the in-app browser.
Native frame validation/block geometry, image/module inventory, core127,
pixel/geometry/startup, actual MicroPython simulation, HTTP/session, package,
export/control checks and all 18 firmware host tests passed. Private simulation
checks native blue/white cells and ten HOME/POWER round trips. Hardware and
installed application API/ABI were not changed for this update.
