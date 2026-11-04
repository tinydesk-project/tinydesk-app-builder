# Compatibility

An app made with App Builder must keep running when App Builder or TinyDesk
is updated. So the editor's version is not what an app depends on: it
depends on a few contracts, each with its own number.

| Contract | Now | What it covers |
| --- | --- | --- |
| App Builder | see `version.js` | the editor and generator; its own SemVer releases |
| Project schema | 1 | the editable JSON; older schema-1 files stay readable |
| Application | the app's own SemVer | your design and behaviour (Export options) |
| TDAPP package | 1 | the container and its checked-file manifest |
| tdui API | 1.0 | the TinyDesk drawing and event requests the app uses |
| MicroPython bytecode | 6.3 | `.mpy` from MicroPython 1.29 |
| Local helper protocol | 4 | the page and `tools/builder_helper.py` (RGB simulation frames) |

## Which firmware runs which app

TinyDesk writes its side down in `ports/common/python/tdui_contract.json`;
App Builder pins a copy in `vendor/tinydesk/` (see
`tools/sync_tinydesk.py`) and checks every export against that firmware's
`tdui.py`.

* **Firmware runs every package whose format it knows (1) and whose tdui
  API major number it has (1), whichever App Builder version made it.**
  Within API 1 nothing is removed or changes meaning; requests, widgets
  and events keep their numbers.
* **Additions** raise the API's minor number or add a capability
  (`tdui.CAPABILITIES`: `gradient_fills`, `rgb_pictures`). A package
  lists what it needs (`runtime.apiMinor`, `runtime.capabilities`,
  `runtime.features`); its bootstrap checks them before it unpacks
  anything and stops with "Update TinyDesk…" on older firmware. Firmware
  from before `tdui.API` counts as 1.0 with the `SUPPORTS_` flags.
* **A new major API number** (2) would come with a TinyDesk major
  release, and that release and the next one keep running API-1 apps.
  Until TinyDesk 1.0 the API stays 1.
* **Bytecode** is the part outside TinyDesk's control: a MicroPython
  release with another `.mpy` version needs apps compiled again. Version 6
  has held since MicroPython 1.19; TinyDesk changes it only in a major
  release and says so in its changelog. Keep the project JSON (or the
  `.tdapp`, which contains it) to export again.
* **App Builder** reads every older schema-1 project and `.tdapp`. A
  newer schema needs a migration in the editor, never a firmware change.

Native-code exports (`project.compilation`, `runtime.native`) record the
CPU (`xtensawin` for ESP32, ESP32-S3 and CrowPanel; `rv32imc` for the
ESP32-C6), ABI 6.3 and the need for root; the bootstrap rejects another
CPU or ABI before unpacking, and mixing CPUs in one app is refused.
Portable bytecode is the default and runs everywhere.

## TDAPP v1

A TDAPP begins with an ordinary portable MicroPython bootstrap, so
TinyDesk's `py` runs it like an `.mpy`. The payloads follow; then a UTF-8
JSON manifest (names, offsets, sizes, SHA-256); the last 16 bytes are
ASCII `TDAPP001`, the manifest's offset and its length (little-endian).
Paths are flat, bounded and checked; at most 16 MiB and 128 entries. The
bootstrap verifies every entry in 1 KiB blocks and unpacks into a
revision-specific cache beside the app (`.tdapp-<hash>`), so one file is
distributed and the cache takes file-system space. Checksums detect
corruption; they are not signatures.

The manifest's `studio` field is the App Builder version that last edited
the project (the field keeps its first name: renaming it would change
format 1). `application` is the app's name and version; `projectSchema`
and `runtime` are as above; `startup` describes kiosk artwork.

Importing a `.tdapp` recovers the JSON and images without running code.
Compiled dependency modules are kept for the next export; their Python
source is not rebuilt, so keep it to change them.

## Fonts and fills

Generated bitmap fonts (TDFONT01, immutable and validated) use the
`font_text` operation or a `font: {path: ...}` on a button or picture; the
package lists `font_text` in `runtime.features`. Gradient fills add the
`gradient_fills` capability. Projects without them keep their old output.
Group selection is editor-only and adds nothing to saved projects.

## Native cell frames (development only)

The helper's simulator sends the browser TDCF 1 frames: a 16-byte header
(`TDCF`, version 1, reserved, little-endian columns, rows, cursor x and y,
cursor-visible flag, reserved), then four bytes per cell (UTF-16 code
point LE, palette foreground, palette background). They are a development
tool and change nothing an installed app needs.

## Before a release

Run the canonical JSON/Python round trips, the old (`tests/reference/
tdui_0.2.0.py`) and current (`vendor/tinydesk/tdui.py`) tdui fixtures,
control-event tests, deterministic package and integrity tests, and the
simulation tests. Keep the fixtures when the schema or generator changes;
add explicit migrations for incompatible changes.
