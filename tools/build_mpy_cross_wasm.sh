#!/usr/bin/env bash
# Developer-only build. End users need only the resulting SINGLE_FILE bundle.
set -euo pipefail
MICROPYTHON_TAG=v1.29.0
EMSDK_VERSION=4.0.13
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$ROOT/.test-output/mpy-build"
mkdir -p "$WORK" "$ROOT/vendor"
command -v emcc >/dev/null || { echo "Emscripten $EMSDK_VERSION is required. Activate that pinned emsdk release first." >&2; exit 2; }
emcc --version | head -n1 | grep -F "$EMSDK_VERSION" >/dev/null || { echo "Activate emsdk $EMSDK_VERSION (this build is pinned)." >&2; exit 2; }
if [[ ! -d "$WORK/micropython/.git" ]]; then
    git clone --depth 1 --branch "$MICROPYTHON_TAG" https://github.com/micropython/micropython.git "$WORK/micropython"
fi
test "$(git -C "$WORK/micropython" describe --tags --exact-match)" = "$MICROPYTHON_TAG"
# Work from a private copy: do not patch a user's MicroPython checkout.
python3 - "$WORK/micropython/mpy-cross/mpconfigport.h" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text()
marker = '// TinyDesk App Builder web bytecode-only build'
if marker not in s:
    s += '\n' + marker + '\n'
    for name in ('MICROPY_EMIT_X64', 'MICROPY_EMIT_X86', 'MICROPY_EMIT_THUMB',
                 'MICROPY_EMIT_ARM', 'MICROPY_EMIT_XTENSA', 'MICROPY_EMIT_XTENSAWIN',
                 'MICROPY_EMIT_RV32', 'MICROPY_EMIT_RV64', 'MICROPY_EMIT_INLINE_THUMB',
                 'MICROPY_EMIT_INLINE_XTENSA', 'MICROPY_EMIT_INLINE_RV32'):
        s += '#undef %s\n#define %s (0)\n' % (name, name)
    p.write_text(s)
PY
# Avoid the host Makefile's ELF map-file flags. No fetch, npm or external WASM
# file is needed by the output, including when it is loaded through file://.
make -C "$WORK/micropython/mpy-cross" -j"${JOBS:-2}" \
    CC=emcc LD=emcc SIZE=true \
    BUILD="$WORK/build" PROG="$ROOT/vendor/mpy-cross.js" LDFLAGS_ARCH= \
    CFLAGS_EXTRA="-DMICROPY_NLR_SETJMP=1" \
    LDFLAGS_EXTRA="-sSINGLE_FILE=1 -sMODULARIZE=1 -sEXPORT_NAME=createMpyCross -sENVIRONMENT=web,worker -sWASM_ASYNC_COMPILATION=0 -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=33554432 -sSTACK_SIZE=2097152 -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain"
cp "$WORK/micropython/LICENSE" "$ROOT/vendor/MICROPYTHON-LICENSE.txt"
python3 - "$ROOT/vendor" "$MICROPYTHON_TAG" "$EMSDK_VERSION" <<'PY'
import hashlib
from pathlib import Path
import sys
folder = Path(sys.argv[1])
digest = hashlib.sha256((folder / 'mpy-cross.js').read_bytes()).hexdigest()
(folder / 'README.md').write_text(
    '# Offline MicroPython compiler\n\nMicroPython tag: `%s`\n\nEmscripten/emsdk: `%s`\n\n'
    'SHA-256 of `mpy-cross.js`: `%s`\n\n'
    'Built with SINGLE_FILE=1, MODULARIZE=1 and web/worker-only glue. '
    'Use `bash tools/build_mpy_cross_wasm.sh` to reproduce this artifact. '
    'MicroPython is MIT licensed; see MICROPYTHON-LICENSE.txt.\n'
    % (sys.argv[2], sys.argv[3], digest), encoding='utf-8')
print('Built vendor/mpy-cross.js; SHA-256 ' + digest)
PY
