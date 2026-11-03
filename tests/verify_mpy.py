"""Verify the offline web compiler through Node; no third-party test packages."""
import importlib.metadata
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'tests/fixtures'


def run(args, cwd):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding='utf-8')


def native_compiler(temp):
    executable = shutil.which('mpy-cross')
    candidates = [[executable]] if executable else []
    try:
        if importlib.metadata.version('mpy-cross') == '1.29.0':
            candidates.append([sys.executable, '-m', 'mpy_cross'])
    except importlib.metadata.PackageNotFoundError:
        pass
    for command in candidates:
        version = run(command + ['--version'], temp)
        if version.returncode == 0 and 'v1.29.0' in version.stdout + version.stderr:
            return command
    return None


def verify():
    if not (ROOT / 'vendor/mpy-cross.js').is_file():
        print('SKIP: vendor/mpy-cross.js is missing (Emscripten unavailable); '
              'build with tools/build_mpy_cross_wasm.sh, then rerun .mpy verification.')
        return
    assert shutil.which('node'), 'Node is required to test the web compiler'
    with tempfile.TemporaryDirectory(prefix='tinydesk-mpy-') as folder:
        temp = Path(folder)
        native = native_compiler(temp)
        count = 0
        for fixture in sorted(FIXTURES.glob('*.py')):
            source = temp / fixture.name
            source.write_bytes(fixture.read_bytes())
            wasm = temp / (fixture.stem + '.web.mpy')
            result = run(['node', str(ROOT / 'tests/compile_mpy.cjs'), str(source), str(wasm)], temp)
            assert result.returncode == 0, result.stderr
            data = wasm.read_bytes()
            assert len(data) >= 4 and data[:3] == bytes((ord('M'), 6, 0)), (fixture.name, data[:4])
            if native:
                output = fixture.stem + '.native.mpy'
                result = run(native + ['-o', output, fixture.name], temp)
                assert result.returncode == 0, result.stderr
                assert data == (temp / output).read_bytes(), fixture.name + ' differs from native 1.29.0'
            count += 1
        bad = temp / 'bad.py'
        bad.write_text('x = 1\n\ndef broken(:\n    pass\n', encoding='utf-8')
        result = run(['node', str(ROOT / 'tests/compile_mpy.cjs'), str(bad), str(temp / 'bad.mpy')], temp)
        assert result.returncode != 0 and 'line 3' in result.stderr, result.stderr
    comparison = 'byte-identical to native 1.29.0' if native else 'native comparison SKIP (mpy-cross 1.29.0 not installed)'
    print('PASS: %d .mpy fixtures, version-6 bytecode headers and syntax line diagnostics; %s.' % (count, comparison))


if __name__ == '__main__':
    verify()
