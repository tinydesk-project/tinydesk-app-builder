# App Builder local validation

## 0.10.0: bounded artwork reuse

- Export options preserve Automatic, Off, 64 KiB and 128 KiB artwork-cache
  choices through JSON round trips. Explicit choices generate an optional
  runtime call for RGB PSRAM targets; older runtimes can omit the API.
- All 27 native tests, 14 Node suites and the editor syntax check pass. Lossless cache tests cover
  exact deduplication, bounded eviction, stale handles, long runs, disabled
  allocation and incompressible artwork. Mutable source images invalidate
  their references on hidden/copied pages.
- Actual MicroPython plus the CrowPanel painter produces identical pixels
  with reuse disabled/enabled, including hidden-value edits, pressed/released
  controls and a keypad. Idle warming and reuse counters are exercised.
- Actual canvas press/release handlers and MCU timestamps measured median
  handler-entry-to-LCD-submission times of 364 ms with reuse off, 320 ms at
  64 KiB and 260.5 ms at 128 KiB (30 page changes per setting). Native drawing
  medians were 224, 195 and 139.5 ms. A 600 ms quiet interval prevents
  overlapping requests and is excluded from timing. These device timestamps
  supersede UART-observed focus timing, which includes transport/sampling.
  The selected 128 KiB run reached 723 ms on its first heavier-page focus; it is
  not an instant-page guarantee. Touch sampling and the following LCD refresh
  are outside the submission measurement.
- Direct cached-run expansion avoids a temporary decoded image and extra
  PSRAM copy. Fully covered canvas backgrounds are omitted when the picture
  budget permits. Continuous-row LCD copies preserve moved image tiles and
  safe framebuffer ownership. Front/back visibility tests suppress duplicate
  submissions and present scenes already retained in the hidden buffer.
- An intermittent physical screen shift was reproduced with nine missed
  preparations and a 140.650 ms peak gap. Keeping UI rendering, LCD painting
  and RGB interrupt allocation on CPU 1 completed the same 180 page changes
  with no misses. The final selected setting also passed 180 automatic page
  changes with live bench values, zero allocation/sink failures, zero missed
  preparations and a 22.411 ms peak preparation gap. Free PSRAM was 771,088
  bytes, with a 622,592-byte largest block. Physical feedback was responsive
  and stable. The 24 MHz LCD timing was retained.
- The restored normal package passed 100 register cycles / 212 replies and
  a three-minute changing-value stream / 724 replies, with no protocol
  errors. Stream median/max round trips were 97.45/179.6 ms. The package's
  temporary profiling hooks were removed before these checks. Real-card
  timing and the external UART header remain separate commissioning checks.
- No new browser visual check is claimed; browser control remains unable to
  establish the current URL. Cache choices were verified through generated
  code and tests.

## 0.9.0: opt-in RGB pictures

- CrowPanel diagnostics identified memory exhaustion in the per-picture
  display cache: 3,400 failed allocations and a 1,568-byte largest free block.
  The shared RGB plane completed 21 page transitions with zero image/sink
  failures, at least 1,031,120 bytes free and a 737,280-byte largest block.
  Physical page transitions are confirmed free of overlapping artwork.
- The final normal package passes 100 register cycles / 212 replies and a
  three-minute changing-value stream / 262 replies, with no protocol failures.
  Maximum round trip was 1,322.5 ms under UI load; real-master timing and the
  external header remain unverified. The temporary auto-cycle/diagnostic
  register hook has been removed from the installed release.
- Kiosk splash and app pictures now both use RGB565 on PSRAM targets.
  A real-painter integration test verifies identical non-palette red before
  and after app startup; the physical logo color handoff is confirmed clean.

- All 26 native tests and 15 Node suites pass. Native tests cover RGB565 image
  ownership, memory release, transparent corners, partial overlap, page copy,
  canvas resize, generated-font alpha blending and direct LCD scanout.
  Further page tests replace earlier artwork without a capture-forced redraw,
  and send full-width RGB backgrounds through the real port cache in bounded
  strips. At font 20 the background render buffer is at most 64 KiB.
- Actual host MicroPython renders a multi-page private application with
  blue gradients and native rounded panels. Pixel checks compare RGB565
  output with the helper's RGBA PNG transport, and exercise pressed/released
  skins and page navigation without a traceback.
- Legacy exports retain palette mode and their existing allocation budgets.
  New RGB exports declare their firmware capability; small-target exports
  use the palette fallback. JSON round trips preserve the explicit choice.
- The browser visual check was not completed: computer control could not
  establish the current Chrome URL. Native captures and simulator transport
  checks do not establish browser presentation or physical LCD correctness.

## 0.8.0: smooth surface styling and complete slave banks

- All Node suites pass, including solid/gradient surface generation,
  selectable corners/colors, preserved fonts/callbacks, resource identity
  and a transparency-key collision regression.
- Host MicroPython export/pixel checks and all 26 native tests pass with
  expanded PSRAM picture budgets. The package test covers saved startup
  tracebacks in addition to deterministic packaging and cache repair.
- Communication tests cover a 600-register holding bank, FC04 alias,
  read/write hooks and a 123-register write fragmented across FIFO reads.
- Browser checks cover the fixed Smooth surface controls, asset cleanup and
  private project export. Physical CrowPanel Welcome-to-Home startup is
  confirmed. A private application's original register map passes 100 update
  cycles / 212 replies on isolated onboard UART: FC03/04/06/16, 123-register
  block transfer, CRC/broadcast/station handling and exception replies.
  Its external adapter and real machine have not been verified.
- Physical controls in that private app read back the selected setpoint/PID
  request while measurements continued updating. A ten-minute onboard UART
  run completed 768 cycles / 1,546 replies with zero protocol failures; the
  maximum round trip was 709.3 ms under UI load. Real-controller timeout and
  external-header electrical compatibility remain separate checks.
- `verify_startup.py` adds a deliberate 5.5-second setup delay: the hidden
  window reaches its ready timer without exceeding the drawing-batch watchdog.
  Retained pages are prepared outside the short creation/reveal frame holds.
- Communication checks verify physical RX/TX byte counters and retained
  receive-error details, including failures after the UART opens successfully.
- Actual MicroPython receive-parser tests cover fragmented maximum FC16
  requests, CRC recovery, foreign-station data and concatenated replies.
  A cursor replaces unsupported bytearray item/slice deletion and compacts the
  unconsumed tail once per parser call.

## 0.7.0: paste placement and serial/register bindings

- All 13 Node suites pass. Clipboard checks cover cross-page position
  preservation and one-cell source-page offsets; browser checks confirmed
  (3,4) → (3,4) across pages and (3,4) → (4,5) on the source page.
- `verify_communications.py` passes with paired deterministic UART transports:
  RTU/JSON/custom codecs, master/slave reads/writes, CRC/station/address/length
  rejection, signed/unsigned/float values, word order and scaling, atomic write
  rejection, no redundant redraws, stale-write guards, bounded/coalesced queues,
  callback preservation and timer wraparound.
- `verify_communication_runtime.py` executes generated code in real host
  MicroPython and a compiled TDAPP: RTU CRC/encoding/reply and JSON encoding,
  decimal labels, button/checkbox/slider register writes, and continued UI/timer
  operation after physical UART open is rejected. Simulator source uses the
  isolated bank; hardware export does not silently select simulation.
- Browser verified the fixed communication settings pane, UART slave/custom
  codec controls, named element binding fields, live address edits and exports.
- Fresh TinyDesk host build `build-builder-20261104`: all 26 native tests pass,
  including the local-socket `test_proto`. The new native Files test exercises
  the compiled-file Run menu, F9 shell command and TDAPP double-click launch.
- No MCU was flashed or physical machine UART driven for this release. Real
  wiring/device timing and new firmware deployment remain hardware checks.

## 0.6.1: element clipboard, transparent picture labels and smooth panels

- All 12 Node suites pass, including new clipboard and appearance suites.
- Browser verified single/group Ctrl+C/V, cross-page paste creating a canvas,
  selection after paste, one-step Undo, unique names, and ordinary input-text
  copying. Group image-backed text switched solid/transparent without errors.
- Rectangle-to-smooth-panel and button-to-skin conversions embed the public
  default artwork. The browser simulator renders smooth native edges and a
  transparent picture label; pressing the button changes its text correctly.
- The exact browser-exported TDAPP ran in real host MicroPython. Native output
  contains all eight panel corner/edge pieces after drawing an interior label,
  a skinned button, and changed label artwork after its click callback.
- `verify_pixels.py` executes newly generated named panel/transparent-label
  code against the actual tdui signatures, checks nine pieces, updates, and
  small-panel fallback. Editor restoration metadata never reaches C API kwargs.
- `verify_export.py`, `verify_controls.py`, `verify_fonts.py`,
  `verify_simulation.py` and `verify_package.py` pass. Windows native compiler
  and simulator checks ran outside the sandbox's DLL relocation restriction.
- Geometric shapes retain the canvas grid resolution. Smooth panels/buttons
  use artwork through existing firmware APIs; no firmware change or new board
  performance claim is part of this release. Panel picture budgets are checked
  before export, including the limit shared by visible windows.

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
