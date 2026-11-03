# Offline MicroPython compiler

Build target: **MicroPython `v1.29.0`**, **Emscripten/emsdk `4.0.13`**.

`mpy-cross.js` is not built in this package: Emscripten was not installed in the development environment. Its SHA-256 is therefore **not available**, rather than a placeholder checksum. `.mpy` export reports this missing artifact, and `verify_mpy.py` prints an explicit skip. Python/JSON export and the rest of Studio remain usable.

Activate emsdk 4.0.13, then run:

```sh
bash tools/build_mpy_cross_wasm.sh
python tests/verify_mpy.py
```

The script fetches the exact MicroPython tag into `.test-output/mpy-build`, builds a web/worker-only modularized compiler with embedded WebAssembly, copies the MIT license, and replaces this README with the artifact's actual SHA-256. Repackage `vendor/mpy-cross.js` with Studio after building. There is no npm dependency or runtime CDN request.

Sources: [MicroPython v1.29.0](https://github.com/micropython/micropython/tree/v1.29.0/mpy-cross), [emsdk releases](https://github.com/emscripten-core/emsdk/blob/main/emscripten-releases-tags.json).
Studio runtime simulation also bundles `@xterm/xterm` 6.0.0 and
`@xterm/addon-image` 0.9.0, fetched from their npm packages. Only their
browser JavaScript, CSS and licenses are retained under `xterm/` and
`xterm-image/`. The licenses are included in each directory. They display
the real simulator's VT/Sixel output; they do not execute Python.
