# TinyDesk App Builder 0.5.0

## Group editing and gradient fills

Shift/Ctrl-click elements in the canvas or Outline to select a group. Drag an
empty canvas area for marquee selection, or focus the canvas and use Ctrl+A.
Full-canvas backgrounds remain selectable in Outline. The right Inspector
shows shared attributes only; different values are blank or marked Mixed.
Editing a shared field applies it to every selected element immediately.
Group bounds move/resize the selection together; its eight handles preserve
relative placement. Undo restores the whole operation. Groups stay inside one
window and cannot include both a canvas and its own child drawing elements.

Rectangles, circles, meters, sliders, gauges and geometric buttons offer
**Gradient fill** with start/end colors and direction. Sprite-sheet buttons
retain their image skin; disable the skin to use a geometric gradient. These
fills are rendered in native C without scattered dither pixels. The device's
256-color palette can still produce bands. Rectangles/buttons also expose
straight or rounded corners in the same Inspector, with immediate preview.
Try `examples/gradient_controls.json`.

Gradient projects declare the additive `gradient_fills` capability and reject
firmware without `tdui.SUPPORTS_GRADIENT_FILLS`. Older projects and packages
retain schema 1 / TDAPP 1 / API 1 / MPY 6.3. Text import and generated fonts
described below remain available.

App Builder's Run simulation opens the exported app directly in an isolated
development filesystem. Device desktop login is tested separately; the native
simulator supports `auth=on` for its test accounts. Application previews do not
change a board's login or kiosk settings.

## Text import and generated fonts

Use **Fonts** to choose a system family or import a `.ttf` / `.otf` font,
set its size (8–96 LCD pixels), select characters, and generate a preview.
Choose smooth 4-bit coverage or compact 1-bit glyphs. Add the result to the
project as a portable `.tdfont` asset. Generate one asset for each size;
all elements using that asset share one native font allocation.

Use **Add text** for typed/pasted text, or **Import image / text** for UTF-8
`.txt` files. Choose a generated font, wrapping and alignment. Select the
resulting text box in the canvas or Outline to edit its text, font, colors,
bounds and alignment in the fixed Inspector. Drag to move or resize it.
Existing terminal/pixel labels can be converted by choosing a generated font
in Inspector. Buttons and image labels accept the same fonts.

Fonts appear in **Assets**, with bitmap preview, pixel size, line height,
glyph count, bytes and usage links. Download/Import `.tdfont` to reuse a font
in another project. JSON and `.tdapp` include the bitmap data, so installed
apps do not depend on the original desktop font or a later Builder release.
The original TTF/OTF is not bundled. Keep it separately to generate more sizes.
The `examples/generated_fonts.json` project demonstrates text and buttons on
two pages; `examples/demo_text.txt` is an import sample.

Generated text needs firmware with **tdui.Font** and **Canvas.font_text**.
Glyph rasterization happens in C at the LCD/terminal's native pixel resolution,
with one drawing message per text box. Text boxes clip to their bounds;
increase the height when using a larger font. Include all characters used by
dynamic values; missing characters use `?`. Current limits are 512 glyphs,
256 KiB per font and 900 UTF-8 bytes per text element. Character-based bitmap
fonts do not provide complex-script shaping or import Nextion `.zi` files.
Raw terminal labels keep their original terminal font behavior.

An offline visual editor for TinyDesk MicroPython applications. Open **index.html** directly in Chrome, Edge, or Firefox. There is no build step, dependency installation, account, or network requirement.

Use **Dark mode / Light mode** in the header to change the editor's appearance. It initially follows your system theme and remembers your choice in this browser when storage is available. This preference is independent of the TinyDesk preview theme and is not included in exported designs.

The builder uses the TinyDesk website's logo/favicon and charcoal/blue dark
palette or white/teal light palette. These editor colors never alter app pixels.

## Build, inspect and distribute applications

The firmware lives in `tinydesk-project/tinydesk`; this builder is intended
for the separate `tinydesk-project/tinydesk-studio` repository. Private
application projects and controllers belong in their own repositories and
are opened with Import. They are never built-in Studio examples.

- The outline exposes individual canvas elements. Select an element on the
  canvas or in the outline to edit its attributes in the fixed right pane.
  Drag to move; use edge/corner handles to resize sized controls. Lines have
  endpoint handles, and text size follows its content/font scale. Geometry
  edits apply directly and track mouse changes. Alt-click selects the canvas.
  Duplicate,
  delete and layer-order actions support Undo.
- The GUI gallery includes text, buttons, sliders, gauges, meters, panels
  and images. Native components include labels, checkboxes, textboxes,
  lists and progress indicators. Slider binding can update another named
  field without writing a callback manually; custom Python remains available.
- Import image / text accepts PNG, JPEG, WebP, BMP, binary PPM/PGM and text.
  Imported images are kept with JSON; ordinary raster images are converted
  to PPM, limited to 256×256 and exported without dithering by default.
  Transparent pixels use a color key. Preserve JSON or an app package.
- **Resources** lists required and embedded images. **Locate image** repairs
  a missing reference without adding another element. Importing a matching
  filename also repairs/replaces that resource; geometry is preserved.
- The left **Assets** tab lists imported/referenced images, retained text
  sources and declared/compiled modules, including external files. Search by
  name, then select a resource for its preview, size and element references in
  the fixed Inspector. Click a reference to edit that element. Locate/replace,
  download and removal of unused resources are available there. Components
  and Outline remain accessible through the neighboring tabs.
- Enabling the default button sprite sheet embeds the shared `ui_skin.ppm`
  automatically. Existing custom artwork with that filename is preserved.
  The helper also includes the public default skin for older external designs.
- Export options exposes the application version and dependency declarations.
  The visible badge and exported source record Studio/project/app versions.
- **Export app** creates one `.tdapp` containing checked bytecode, project
  JSON, resources and dependency modules. The board-files uploader also
  offers `.tdapp`. Launch with `py /root/my_app.tdapp`, or Run from Files
  on firmware supporting app packages.
- Import `.tdapp` reopens its design and preserves images/compiled modules
  for re-export. You do not need the original loose image files. Keep
  dependency source separately if you want to edit its internals.

Simulation, native `.mpy` compilation and `.tdapp` export use the optional
loopback helper. Start it with `python tools/studio_simulator.py`; use
`--runtime PATH_TO_TDSIM` and `--compiler PATH_TO_MPY_CROSS` if they are not
installed in the standard development locations. No cloud compilation is
used. The standalone editor still supports JSON/Python editing offline.
The separate optional WASM compiler enables `.mpy` export without the helper.

Read [COMPATIBILITY.md](COMPATIBILITY.md) for schema, API, bytecode and package
version rules. Old JSON/Python fixtures are retained and tested; installed
apps do not depend on future Studio releases. Run only apps you trust.

## Designing an app

### Runtime simulation and private projects

Run `python tools/studio_simulator.py`, open http://127.0.0.1:8773/ and
choose **Run simulation**. The generated Python executes in the actual
TinyDesk host runtime. Hardware timing and physical buses require board tests.
Use `--runtime PATH` for another tdsim build. Private application dependencies
can be supplied with repeatable `--project-dir PATH` options; they are copied
only into that simulation's temporary filesystem. Keep project JSON, code and
assets in your own separate repository. Studio contains generic examples only.

The current helper requires a recent `tdsim` supporting `cells=FILE` (TDCF v1).
Rebuild the host tool after updating TinyDesk, then restart the helper and reload
the browser. Native cells and Sixel pictures are composed into one visible
preview canvas; normal canvas backgrounds/large values do not depend on the
browser's DOM text layer. Integer cell geometry keeps native images aligned.
The helper/frontend protocol is 3; this is independent of the board's app API.

Simulation uses the same package-relative image paths as Export app. Missing
images or declared modules are reported before launching. Import the missing
resource, or restart the helper with its directory in `--project-dir PATH`.
Use **Resources → Locate image** when a local file has a different filename.
An empty metadata entry never overwrites a valid helper-directory resource.
After updating the helper, restart it and reload the editor; the project saved
in this browser is retained. Image filenames must be unique within one app.

The element Inspector applies corner styles immediately. Image-skinned buttons
show **Image skin corners**; choosing **Straight corners** or **Rounded corners**
switches to the button's geometric colors. The optional sprite-sheet checkbox
also applies immediately. Opaque elements drawn later can cover rounded panels;
check their backgrounds and layer order when a corner seems unchanged.

### Current tdui drawing

Select a canvas and choose **Pixel drawing / button / picture**. Add or
edit `rect` (radius and outline), `line`, `circle`, `gradient`, `draw_text`,
`bar`, `image`, `nine`, `picture` and `button` operations. Shape positions
and sizes are pixels (2×2 per cell); pictures and canvas buttons use cells.
Keep bar X and width even for symmetric ends in Normal pictures. Pixel
text supports scale and the small font; `tdui.text_size(text, scale, small)`
gives its dimensions when writing dynamic handlers. Background −2 is
`tdui.CLEAR`, leaving the pixels visible behind text.

Images have a board path, decoded width/height, optional RGB colour key
and dithering flag. Copy the PPM, PGM or BMP to that path. Identical image
settings share one `Image.load()` at startup. The preview shows image
bounds with an IMAGE placeholder: it does not read the board's files.
Pixel text fonts and gradients in the browser preview are approximate;
use the simulator and physical terminal for final rendering checks.

`picture` offers source rectangles, nine-slice borders and a label. It
uses Sixel at terminal resolution where supported and block pixels in
PuTTY. A canvas `button` has a stable Python variable and optional callback
(a handler taking `button`); it is created once and later painters call
`.draw()`. Buttons belong to the canvas page on which they were created.
The `pixel_controls` example exercises all drawing operations. Supply
`/root/picture.ppm` (decoded to 32×32) for its three image placements.

Canvas painters and page changes use a reusable batch context. With
current firmware the desktop sends no intermediate frame; older cell-only
designs keep a no-op compatibility context. Pixel designs require current
firmware and fail clearly before creating a layout if its API is missing.
For a dynamic value, update the existing bar instead of clearing a canvas:

```python
with meter.batch():
    meter.bar(4, 14, 80, 4, value, maximum=100, edge=120, radius=1)
    meter.put(2, 10, "%3d%%" % value, 231, tdui.CLEAR)
```

Keep batches below **1000 ms**; do not sleep, poll, load files or open a
blocking dialog inside them. Timeout releases partial drawing and reports
an error. Exceptions release drawing too; batches do not roll back.
Images/buttons/page registries are allocated at startup and reused. User
handlers remain user code: avoid creating widgets, images or growing
collections in animation loops. Numeric/string updates may create temporary
Python values, which garbage collection reclaims.

The resource counter and generated guards check both `MAX_CELLS` and
`MAX_PIXELS`: **2000 cells / 16384 pixel bytes** for small boards,
**32000 / 2097152** for PSRAM. Pixel layers count all allocated canvas
pages (four bytes per cell); images cost width×height bytes, doubled for
a keyed transparency mask. These budgets do not include the Python heap.
Use the **80×24 · CrowPanel font 20** or **100×30 · CrowPanel** presets
for those layouts.

Choose a target and screen dimensions. **2,000 cells** covers TinyDesk 0.2.0, ESP32-C6, and 4 MB ESP32 boards. **32,000 cells** is for boards with PSRAM and TinyDesk firmware after 0.2.0. Older 8,000-cell projects migrate to this target on import. Every picture of a paged canvas counts (`width × height × pages`). Generated Python checks `getattr(tdui, "MAX_CELLS", 2000)` against the actual canvas cells used and raises a clear `OSError` if firmware is too old for the design.

Add windows and drag or click components into them. The inspector edits cell positions, content, xterm colors, visibility, events, and timers. Negative native-widget positions anchor to the right or bottom; nonpositive sizes follow the corresponding edge.

Select a canvas and enable **Paint cells** to stamp text and colors. A single-character brush can fill its entire area. Canvas color and visibility controls describe the initial design; TinyDesk ignores canvas `.color()` and `.visible` at runtime. Use `fill()`/`clear()` in handlers to change its appearance. Page switching handles canvas visibility automatically, using cached pictures when the firmware supports them.

**Events & timers** edits Python handler bodies. Keep them quick and nonblocking. ASCII Python identifiers support up to 32 characters; `show_page`, `canvas_page`, `_TD_PAGES` and names starting `_td_` are reserved for generated page helpers. Arbitrary handler syntax and runtime behavior still need testing on TinyDesk.

Ctrl/Cmd+Z undoes. Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes, including while editing properties. A continuous field edit, drag, or paint stroke is one step. The unsaved handler editor retains native text undo. Arrow keys move a selected widget; Shift moves five cells. Delete removes it.

## Resizing the workspace and windows

Drag the inner edge of either sidebar, the separator above Generated Python, or the separator between Components and Outline. Double-click a handle to restore that panel's default size. Sidebars have a 180 px minimum; the code panel has a 120 px minimum. The layout reserves approximately 320×200 px for the design area when the viewport can accommodate it.

Each panel's header has a collapse button. Click the resulting thin strip to reopen it. **Ctrl+Alt+1** toggles Components/Outline, **Ctrl+Alt+2** the Inspector, and **Ctrl+Alt+3** Generated Python. Focusable separator handles have accessible labels, orientation, and current sizes. Arrow keys move them by 16 px; Shift+arrows move them by 64 px.

Panel sizes, the Components/Outline split, and manual collapsed states are remembered separately from the design. With storage blocked, the editor uses defaults and changes still work for the session. Below 900 px, the sidebars start collapsed and reopen as overlays. On very short screens, code can also open as an overlay. Scrolling stays inside panels rather than creating horizontal page scroll.

In the preview, drag a window's right edge, bottom edge, or bottom-right corner to change its client dimensions. It snaps to whole cells, displays the size near the corner, and updates the Inspector live. A drag is one undo step. Width/height remain within 1–300 × 1–150 and the design screen's available area. Fixed widgets may become out of bounds, which produces the same validation errors as typing smaller dimensions. Anchored widgets retain their negative coordinates and relative sizes and follow the resize.

Drag a title bar to set X/Y. Hold **Alt while releasing** to return to a centered position, or use **Center window** in the Inspector. Fullscreen layouts fill the chosen screen and do not have draggable frames. The window's runtime Resizable flag is unchanged by design-time resizing.

Manual panel checklist:

1. Drag all four separators, including over the preview and code; confirm no text selection or lost drag. Double-click to reset.
2. Tab to each handle. Check arrows, Shift+arrows, and the announced size. Collapse/reopen all three panels using both buttons and shortcuts.
3. Reload and check saved sizes and collapsed states. Disable browser storage for a local test and confirm the defaults and controls still work without errors.
4. At widths below 900 px, check collapsed sidebars, overlay opening, and no horizontal page scroll. At a short height, open and close Generated Python.
5. Resize and move a designed window. Check whole-cell values, live anchors, one undo/redo step, Alt-release centering, and bounds warnings.

## Pages

Each window starts with a **Main** page. Add, rename, and remove pages in the window inspector, or add them with **＋** above the preview. Page tabs above the preview select the layout you are designing. Selecting a widget in the outline also opens its page.

Each widget belongs to a page or **All pages**, which is useful for navigation and shared controls. Removing a page moves its widgets to the first remaining page, preserving the work. Choose **Startup page** in the window inspector; changing the design-view tab does not change startup behavior.

Enable **Generate tab buttons** to create navigation on a chosen cell row. A negative row counts from the bottom. Generated tabs consume widget slots and must fit within the window. Alternatively, give a button a **Switch to page on click** action. Its own `on_click` handler, if set, runs before the page switch.

In a custom handler, call `show_page("Settings")` for the first window, or `show_page("Settings", other_window)` for another window. Page names are case-sensitive. Unknown pages raise `ValueError`.

Generated page functions change native widgets' `.visible`. On firmware with `Canvas.draw_to`, canvases on distinct layout pages at the same X/Y/width/height share **one canvas with multiple pictures** (up to 16). Each picture is painted once at startup. Switching selects both the drawing and shown picture in **one atomic PAGE request**, with no clear, repaint, or move for a shared rectangle present on the destination page. The helper uses the supplied API's `_req2(19, ...)` to combine drawing and showing in one request; the public `draw_to()` and `show()` calls would send two.

The variable names you chose remain available. On newer firmware they alias that shared canvas, and drawing normally affects the current drawing page. To update a hidden picture, use the return value of:

```python
canvas_page(main_canvas, "Settings").put(1, 1, "Updated", 115, 234)
show_page("Settings")
```

`canvas_page` changes the drawing destination without changing the shown picture. Call it again for the shown page before drawing there, or call `show_page`, which resets both destinations. Mouse callbacks are routed to the shown layout page's handler. Dynamic drawing is retained in cached pictures until overwritten.

Generated code detects `_TD_PAGES = hasattr(tdui.Canvas, "draw_to")`. Without it (TinyDesk 0.2.0), aliases become separate canvases. Page switches clear and park inactive canvases at `_TD_PARK = 1000`, restore active positions, and repaint their designs. Use the returned object from `canvas_page` so your handler also targets the correct separate canvas on older firmware. Dynamic edits on this fallback are replaced when the static design is repainted. The two paths consume the same cell budget.

All-pages and unshared canvases keep one picture. On newer firmware inactive canvases are parked without erasing the cached picture; a shared rectangle absent from a destination page must also be parked. Parking prevents blank canvas cells from covering another page, since TinyDesk draws canvases regardless of `.visible`.

All pages' widgets and canvases exist at once and count toward the limits. Generated tabs count too. A list consumes two widget slots; the validator conservatively counts a canvas as one, following the brief, although the supplied Python Canvas class consumes zero native widget slots. Overlaps are warned only for widgets that can appear together. See **examples/two_pages.json** and **examples/two_pages.py** for a working layout with overlapping canvases.

## Big text

Select a canvas, enable **Paint cells**, and choose **Big text**. Set text, scale **1–4**, width **0–64 characters**, foreground and background, then click to place it. The inspector shows the resulting columns × rows; placements that do not fit are refused. Width 0 uses the natural size. A positive width right-aligns with blank leading characters or trims from the left. One operation accepts up to 64 characters.

The preview uses the exact 3×5 pixel font from `reference/pyui.c`, packing two pixel rows into `▀`, `▄`, and `█` cells. Digits, A–Z, `- + % / . :` and spaces are supported; lowercase becomes uppercase, other characters become `?`. Periods and colons are narrow. Generated painters use `cv.big(...)` when available, or identical precomputed `put()` rows on TinyDesk 0.2.0.

Import **examples/six_page_hmi.json** for a 100×30 fullscreen example with six cached pages and big numbers (18,000 cells, PSRAM target). Its Python file runs through either API path when the board has enough canvas cells.

## Handlers and renames

Unused handlers appear as **Unused** in the Events tab, with a delete action. They stay in the saved design but are omitted from Python by default. Helper functions referenced by used handlers are retained. **Export options → Keep unused handlers in the file** includes the entire library when needed.

Deleting a widget retains its name for missing-reference warnings. A lightweight identifier scan also warns about references such as `deleted_label.text`. These are warnings, not a full Python name analysis. When a variable is renamed, leaving its name field offers **Update references** to replace whole-word occurrences in handler bodies. Review replacements in user code, including comments and string literals.

## Files and export options

**Save JSON** preserves the complete editable project, including pages and unused handlers. Browser storage also saves the design when available; keep portable JSON copies.

**Export Python** creates a ready-to-run file. Copy it to the board and run:

```text
py /root/Desktop/app.py
```

The executable code ends in `tdui.run()`. With **Embed design for re-import** enabled (the default), wrapped JSON comments follow that call. Each generated line is at most 100 characters, except user-authored handler lines. Long strings are split into adjacent Python literals without changing their value. Turn embedding off for a smaller file; save JSON separately to reopen the design.

Import accepts JSON, the new numbered comments (`# tdui-editor design 1/N: ...`), and the old single-line design comment. Python import restores the embedded design, not arbitrary edits made to generated Python outside it. Files without metadata give a message to import JSON instead.

Errors in resource limits, coordinates, names, and text sizes block Python and .mpy export. Overlaps, unused handlers, and missing widget references are warnings. JSON can always be saved while a design is unfinished.

## Compiled .mpy export

**Export .mpy** validates the design, compiles the generated Python, and downloads `<name>.mpy`. The compiler loads only on the first request, from a local SINGLE_FILE JavaScript/WebAssembly bundle; no runtime network service is used. After compilation the code header shows the `.py` and `.mpy` byte sizes. Compiler diagnostics, including the source line number, appear with design errors. Board files offers the same `.py` / `.mpy` choice for current-design uploads.

**Optional standalone WASM compiler:** the local helper already provides working native `.mpy` compilation. To also enable compilation from `file://` without the helper, build `vendor/mpy-cross.js`. Activate **emsdk 4.0.13**, then run:

```sh
bash tools/build_mpy_cross_wasm.sh
python tests/verify_mpy.py
```

The script builds MicroPython **v1.29.0**, disables native emitters, and writes a web/worker-only, modularized, embedded-WASM bundle. It records the actual SHA-256, MicroPython tag and emsdk version in `vendor/README.md`, and copies the MicroPython license. After building, include the `vendor` folder when repackaging Studio. End users then need only the browser, including from `file://`; no compiler installation is needed.

`.mpy` gives faster startup, less RAM while loading, and no Python source on the board. It does **not** make the application's running code faster. The bytecode version must match the firmware: the supplied TinyDesk specification uses MicroPython 1.29.0 / bytecode version 6 on TinyDesk 0.2.0 and later. Studio produces default bytecode without native emitters (features byte 0).

Comments are not retained in bytecode: **Embed design for re-import** applies only to `.py`. **Save JSON** is the way to reopen a design exported as `.mpy`; compiled files cannot be imported as editable projects.

## Board files and FTP upload

The **Board files** button opens an optional file manager. The editor works entirely without its helper; no helper request is made until you connect. The helper needs only Python 3's standard library:

```text
python tools/studio_bridge.py
python tools/studio_bridge.py --port 9000
python tools/studio_bridge.py --max-upload 8388608
```

The default address is `http://127.0.0.1:8765`. The helper binds to **127.0.0.1 only** and prints a random token in a “Paste this token into Studio” line. Paste it into the panel and set Helper port if changed. Tokens and passwords are kept only in session memory, never in browser storage or log files. The password field is cleared after connecting.

On the board, log in as root and run `ftp start`. Enter the board's network host, FTP port (normally 21), user (normally root), and password in Studio. Root's factory password must have been changed on the board first. Root starts in `/root`; other users start in and are confined to `/home/<name>` by the board.

**FTP sends the password unencrypted. Use it only on a network you trust.**

Open folders or use the path bar and Up button. Refresh, create folders, rename, download, and delete are available from the list. Delete requires a confirmation naming the item; only empty folders can be removed. Names with spaces and UTF-8 are supported. Dates are omitted because this FTP server supplies placeholder dates.

Use **Upload files**, or drop files onto the list. Files queue one at a time, with individual progress and final OK/error messages. “100%” means bytes reached the helper; the transfer remains pending while FTP and `SIZE` verification finish. Existing files require replacement confirmation. The default upload limit is 4 MB per file; `--max-upload` changes that byte limit. Transfers use binary `TYPE I` and passive FTP. Resuming transfers is not supported.

**Upload the current design** offers a **Design format** choice, `.py` or `.mpy`, using the same validation, generator, compiler and filename as the corresponding export button. It refuses the same layout/resource errors, asks before replacing a file, and displays the command to run it from the selected board folder, for example `py /root/Desktop/device_monitor.py` or `py /root/Desktop/device_monitor.mpy`.

The helper holds at most one FTP connection. Connect replaces the existing session, Disconnect closes it, and an idle session closes after about 30 seconds. Enter the password again to reconnect. Errors retain the board's reply text. No real-board connection is needed for the included tests.

Every API operation requires the printed token in `X-Studio-Token`. Browser origins are limited to `null` (local files), `http://localhost` and `http://127.0.0.1`, including local ports. Browser CORS preflights cannot contain the token value: they only advertise the allowed methods/headers and perform no FTP operation. The actual request still requires the token. The helper also rejects nonlocal Host headers. If the helper is stopped, the panel explains how to start it while the rest of Studio stays usable.

## Verification

The ZIP includes the tests, their bundled fixtures, and a copy of the real TinyDesk Python API used for verification. Node.js and Python 3 run the tests; compiler checks also need the built vendor artifact:

```text
node --check app.js
node tests/core.test.cjs
node tests/pixels.test.cjs
python tests/verify_export.py
python tests/verify_pixels.py
python tests/verify_bridge.py
python tests/verify_mpy.py
```

The test scripts return nonzero on failure and print one summary line on success; Node's syntax check is silent on success. They run independently. Temporary compiler output goes under `.test-output/`; the temporary files and the directory, if empty, are removed after compilation. Existing unrelated artifacts are retained. Bridge tests open loopback sockets, so a restricted execution sandbox may require local-network permission.

The Node tests cover example/all-widget/page round trips, boundary limits, UTF-8, escaping, bounds and anchors, names, malformed imports, PSRAM layouts, pages, handlers, firmware guards, two blank lines between top-level functions, pure window move/resize gestures, one undo step per drag, FTP LIST parsing, and breadcrumbs. Canonical JSON/Python fixtures live under `tests/fixtures/`, including an old-format import fixture.

Python verification `py_compile`s every fixture, then executes exports against both the new `reference/tdui.py` (identical to `tests/reference/tdui.py`) and the round-3 snapshot `tests/reference/tdui_0.2.0.py`. `_tdui.send` models separate drawing/shown pictures, PAGE, PAGE_COPY, BIG and resize; `_tdui.recv` replays events. CPython compatibility adapters provide `micropython.const` and `time.ticks_*`; the actual widgets, dispatcher, and timers run unchanged. A recording `run()` verifies startup without an endless loop.

The tests cover callbacks, repeated/one-shot timers, both page paths, exact per-cell pictures, one PAGE request per shared rectangle without repainting, hidden dynamic edits, callback routing, independent picture copies, resizing all pictures and firmware guards. Big-text expectations are independently rasterized from the C font at several scales and widths. `verify_mpy.py` compiles every fixture through `mpy.js`, checks the version-6 header/features byte, and checks syntax-error line numbers. If native `mpy-cross` **1.29.0** is installed, it also compares every output byte; otherwise that comparison is explicitly skipped. A missing vendor compiler explicitly skips the entire `.mpy` suite.

These tests do not emulate the native desktop or ESP32 heap. Physical-board verification remains necessary for hardware access, runtime memory and dynamic user code. Keep runtime messages within 1,024 bytes and menus within 20 items.

`verify_bridge.py` starts a standard-library fake FTP server matching the supplied `reference/tdsh_ftp.c`: one client, passive-only, fixed LIST columns, no MLSD. HTTP tests cover tokens, allowed/refused origins, connect/reconnect, UTF-8 names, binary upload and download, exact `SIZE` verification, generated-design byte preservation, rename, mkdir, delete, rmdir, 550 errors, upload limits, explicit disconnect, and idle cleanup. The C reference is read-only. A real TinyDesk board remains the final interoperability check.


## Button events and clean skins

Select a canvas, choose **Pixel drawing / button / picture**, and select
**button**. Position, size, name and text are shown first. Expand appearance
for colors, rounded ends, text scale, or an optional sprite sheet. The skin
preset uses `/root/ui_skin.ppm`, magenta transparency, no dithering, and
separate normal/pressed sprite regions. Copy that image to the board;
Studio's preview marks image bounds and does not read board files.

Each button has **on_press**, **on_release**, **on_click**, and **on_cancel**
sections. Choose a starter action (set text, switch page, close window,
log, or custom Python), then edit the Python body. Saving creates and
connects the named functions in the exported app. Existing handler names
can be reused; edits to a shared handler affect every control using it.
Blank names disconnect an event. The JSON preserves bodies and wiring.

Release always follows a captured press, even outside the canvas/window.
Click follows release inside; cancel follows release outside or removal of
a held button. Native text buttons keep their click event; choose canvas
buttons when separate press/release actions are needed. Window close/key/
resize, canvas mouse, checkbox/list/textbox events and one-shot/repeating
window timers remain in **Events & timers**. Use timers for ongoing work,
short callbacks for UI updates, and `on_close` for cleanup. Custom Python
can use board APIs, but its hardware behavior needs board testing.

Open `examples/button_events.json` for three skinned buttons on different
backgrounds and a status label driven by all four events. Export Python,
copy it and `tinydesk/examples/python/ui_skin.ppm` to `/root`, then run
`py -m 512 /root/button_events.py` on a PSRAM board. Cell-only and smaller
pixel designs can target the smaller boards; the editor checks both budgets.
Keyed pictures reserve another `4 * width * height` bytes for their exact
background (cell dimensions), included in the resource counter. Disable
dithering for clean UI fills; 256-color gradients may retain color bands.

See [the complete build, simulation, installation and kiosk guide](guide.html).
