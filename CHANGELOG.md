# Changelog

App Builder's own versions, newest first. They follow
[Semantic Versioning](https://semver.org/); until 1.0.0 the editor may still
change between minor versions, but the apps it made keep running (see
[COMPATIBILITY.md](COMPATIBILITY.md)). Each release's test record is in
[VALIDATION.md](VALIDATION.md).

## 0.13.0 (unreleased)

* **Apps start faster:** an exported package checks its files once, then
  leaves a stamp (`.verified`) in its unpack folder; later starts only compare
  the sizes instead of hashing every asset again. A changed or damaged file
  still gets the full check and is unpacked again. Export again to get it.
* **Smoother, dependable resizing:** windows resize from every edge and
  corner, with half a cell of slack around the frame; labels, text boxes,
  progress bars, lists and canvases get resize handles (with a live size
  badge). A press on a window's frame no longer starts a selection
  rectangle instead (why resizing sometimes did nothing). While dragging,
  only the preview is redrawn, once a frame; the Python, checks and
  inspector catch up on release. Panel splitters lay out once a frame.

* **Apps use TinyDesk's app library:** exported apps `import tdapp` (frozen
  into TinyDesk 0.3 and later) for their canvas pages, gauges, sliders,
  panels, drawing batches and Modbus / UART links, instead of carrying a
  copy of that code. An app now holds only its layout, artwork, pages and
  handlers: the examples shrink to 1.5-9 KB (`register_panel` from 35 KB to
  under 5 KB). A library export names the `tdapp` version it needs and
  stops with "Update TinyDesk firmware" on older boards. **Export options →
  Copy the app runtime into the file** keeps the old self-contained export
  for firmware before 0.3. `tools/sync_tinydesk.py` now pins `tdapp.py` and
  `tdapp_contract.json` too, and a test checks every `tdapp` name an export
  uses against that contract.
* **Tests and helper find the right simulator:** `TDSIM`, else the newest
  `tdsim` of a `tinydesk-ux` or `tinydesk` checkout beside App Builder
  (`tests/runtime_path.py`, `tools/builder_helper.py`).

## 0.12.0

* **QR code element:** GUI elements → **QR code** adds a QR code (byte
  mode, level L, versions 1 to 5, up to 106 bytes; default
  `http://192.168.4.1`). It is a picture made from a generated PPM at one
  pixel per module with its quiet zone (about 5 KB for a 200 x 200 pixel
  code), which the device loads scaled by a whole number to the box: every
  module stays sharp and nothing new is needed in the firmware. The
  Inspector's **QR code** fields change the text and colors; keep the box
  square in pixels (on an 80 x 24 design, the width in cells twice the
  height). The encoder (`qr.js`) is checked against the QR standard's
  format table and, module for module, against an independent reference
  encoder (`tests/qr.test.cjs`).

## 0.11.0

* **Its own project:** TinyDesk Studio is now TinyDesk App Builder, in the
  repository `tinydesk-project/tinydesk-app-builder`, with its own versions
  and changelog. The helpers are `tools/builder_helper.py` (simulation,
  compiling, packages; was `studio_simulator.py`) and
  `tools/board_bridge.py` (board files; was `studio_bridge.py`); the
  token header is `X-Builder-Token`.
* **Pinned TinyDesk files:** `vendor/tinydesk/` holds the TinyDesk files the
  Builder builds against (the tdui contract, `tdui.py`, `pyui.c`,
  `tdsh_ftp.c`), copied by `tools/sync_tinydesk.py` from a named TinyDesk
  commit; CI checks they were not edited by hand. Exports are now verified
  against the current firmware's `tdui.py` (the old `reference/` copies
  were out of date).
* **Packages check the firmware's tdui version:** the bootstrap uses
  `tdui.API` and `tdui.CAPABILITIES` where the firmware has them (TinyDesk
  after 0.2.0) and the `SUPPORTS_` flags before that; an app that needs
  more says "Update TinyDesk" instead of failing later.
* **Saved work is safer:** the design is saved to this browser after a
  pause in editing, only when it opens again, and under `tdab.design`
  (designs, layout and theme saved by earlier versions are read once). A
  saved design that no longer opens is kept and offered as a download
  instead of being replaced by the example. When the browser cannot save,
  a message says so and the page asks before closing.
* **Faster editing of big projects:** dragging updates once per frame, and
  the code panel no longer builds the embedded design comments it hid
  (about 70% of its time on a large project).
* **No half-drawn values in apps:** an exported app draws each changing
  field (slider, gauge, bar, panel, text) as one tdui batch, and every value
  from a serial/register reply in one batch, so a frame never shows a
  field erased or half updated when values move fast. A field already on
  the drawing page no longer switches pages around each update, and an
  unchanged value sends nothing. Apps exported before need exporting again
  to get this.
* **Typed handler code is not lost:** closing the handler editor with Esc
  or × asks first when something was typed; Shift+Tab leaves the code box
  (Tab still indents); saving under the name of another handler asks
  before replacing its body.
* **What saves also imports:** designs up to 32 MB import (5 MB before,
  while a saved design could be larger); images, fonts and modules over
  the 16 MiB an app package holds are a design error.
* The × and · in the screen sizes and dialog close button showed as
  `Ã—` and `Â·` (double-encoded in earlier versions).
* CI runs every test file and the pinned-files check.

## Before 0.11.0

See [VALIDATION.md](VALIDATION.md): 0.10.0 bounded artwork reuse, 0.9.0
opt-in RGB pictures, 0.8.0 smooth surfaces and complete slave banks, 0.7.0
serial and register bindings, 0.6.x native packages and the element
clipboard, 0.5.0 shared attributes and gradient fills, 0.4.0 generated
fonts, and the 0.3 releases.
