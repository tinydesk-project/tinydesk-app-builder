# Changelog

App Builder's own versions, newest first. They follow
[Semantic Versioning](https://semver.org/); until 1.0.0 the editor may still
change between minor versions, but the apps it made keep running (see
[COMPATIBILITY.md](COMPATIBILITY.md)). Each release's test record is in
[VALIDATION.md](VALIDATION.md).

## 0.11.0 (unreleased)

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
* CI runs every test file and the pinned-files check.

## Before 0.11.0

See [VALIDATION.md](VALIDATION.md): 0.10.0 bounded artwork reuse, 0.9.0
opt-in RGB pictures, 0.8.0 smooth surfaces and complete slave banks, 0.7.0
serial and register bindings, 0.6.x native packages and the element
clipboard, 0.5.0 shared attributes and gradient fills, 0.4.0 generated
fonts, and the 0.3 releases.
