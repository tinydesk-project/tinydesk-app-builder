# Compatibility contract

App Builder 0.6.0 records independent versions rather than coupling apps to the
editor release:

| Contract | Current | Meaning |
| --- | --- | --- |
| App Builder | 0.6.0 | Editor/generator release |
| Project schema | 1 | Editable JSON structure; existing schema-1 fixtures remain supported |
| Application | User-controlled semantic version | Version of your design/behavior |
| TDAPP package | 1 | Binary container and checked-file manifest |
| tdui API contract | 1 | Existing TinyDesk drawing/event primitives |
| MicroPython bytecode ABI | 6.3 | Portable bytecode from MicroPython 1.29 |
| Local simulation helper | 3 | Frontend/helper protocol; requires tdsim native cell capture (TDCF 1) |

An exported application contains its generated layout, field helpers and
callbacks. It runs without Studio or the simulation service. Existing
`.py`/`.mpy` workflows remain supported. Studio updates do not silently
rewrite an app already installed on a board.

Portable bytecode remains the default. Optional native exports record
`project.compilation` and `runtime.native` with CPU architecture, ABI 6.3 and
the root requirement. The TDAPP bootstrap remains portable and rejects a wrong
CPU/ABI before extraction. Native dependencies are preserved without executing
them during import; mixing Xtensa and RISC-V modules in one app is rejected.
ESP32/S3/CrowPanel use `xtensawin`; C6 uses `rv32imc` without optional ISA flags.
This release adds no arbitrary raw-binary loader or direct C API linker.

The native cell snapshot and its browser renderer are development tools.
They do not change the firmware drawing API or a packaged application's
runtime requirements. TDCF 1 has a 16-byte header (`TDCF`, version 1, reserved,
little-endian columns/rows/cursor X/Y, cursor-visible flag, reserved), then
one four-byte cell per row/column (UTF-16 codepoint LE, palette FG, palette BG).

`provenance.createdWith` and `lastEditedWith` identify editor versions;
`application.version` is editable in Export options. The package manifest
records these versions, runtime capabilities and SHA-256 for every entry.
Identical inputs and compiler produce identical packages. App checksums
detect corruption; they are not signatures or a trust mechanism.

Importing a `.tdapp` recovers JSON and image assets without executing code.
Compiled dependency modules are preserved for another export. Their Python
source is not reconstructed: retain original source to change a dependency's
internal implementation. Layouts and exported handler bodies remain editable.

The runtime checks required drawing capabilities and bytecode major version
before installing package files. Future firmware with a different bytecode
ABI may require recompilation. It must keep API-1 behavior or explicitly
reject unsupported contracts; a promise of compatibility with every future
firmware would be misleading. New Studio controls can require a newer editor
even when they generate calls to the same underlying drawing API.

Before a release, run the canonical JSON/Python round trips, old and current
tdui fixtures, real control-event tests, deterministic package/integrity
tests and real simulation tests. Preserve those fixtures when evolving the
schema or generator; introduce explicit migrations for incompatible changes.

TDAPP v1 begins with an ordinary portable MicroPython bootstrap. Payloads
follow it; a UTF-8 JSON manifest lists names, offsets, lengths and hashes.
The final 16 bytes are ASCII `TDAPP001`, little-endian manifest offset and
little-endian manifest length. Paths are flat, bounded and checked. TinyDesk
streams verification and unpacking in 1 KiB blocks into a revision-specific
cache beside the app. Distribution is one file; execution uses filesystem
space for that cache. The container limit is 16 MiB / 128 entries. Board flash,
heap, canvas and image budgets still determine what an app can use.

Generated bitmap fonts are an additive API-1 capability. Projects use the
`font_text` drawing operation, or a `font: {path: ...}` reference on a button
or picture. Font assets use the immutable, validated TDFONT01 format. The
package declares the `font_text` runtime feature; the bootstrap and exported
Python reject firmware without this API before opening the app. Schema-1
projects without generated fonts keep their existing behavior. Font files
remain usable across editor updates without the original TTF/OTF installed.

Gradient shape/control fills are another additive API-1 capability. New
exports check `tdui.SUPPORTS_GRADIENT_FILLS`; their TDAPP manifests add
`runtime.capabilities: ["gradient_fills"]`. The bootstrap checks it before
extracting files. Projects without gradient fills omit this requirement.
Group selection changes the editor only; saved element geometry and fields
use the existing schema. There is no new group object for installed apps to
interpret, and installed apps never depend on the editor's selection state.
