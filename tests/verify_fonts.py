"""Run generated fonts, retained pages and updates inside a real TDAPP."""
from pathlib import Path
import base64
import json
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from app_package import build,inspect
runtime=max((root.parent/'tinydesk').glob('build*/tdsim.exe'),key=lambda p:p.stat().st_mtime)
compiler=root.parent/'tinydesk/build-check-20261103/compiler/mpy_cross/mpy-cross.exe'
project=json.loads((root/'examples/generated_fonts.json').read_text())
source=subprocess.check_output(['node','-e',"const T=require('./core.js'),fs=require('fs');process.stdout.write(T.generate(T.parse(fs.readFileSync('examples/generated_fonts.json','utf8')),{bundle:true}));"],cwd=root,text=True)
probe='''
for invalid in ('X' * 901, 'bad\\x00text'):
    try:
        canvas_1.font_text(_td_font_0, 0, 0, 20, 2, invalid)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid dynamic font text accepted')
_font_probe_count = [0]
def font_probe():
    _font_probe_count[0] += 1
    n = _font_probe_count[0]
    reading.set(text="NATIVE FONT\\n%d °C\\nFresh dynamic text" % n)
    details_reading.set(text="CACHED PAGE\\n%d °C\\nFresh dynamic text" % n)
    if n % 4 == 0:
        show_page("Details" if n % 8 == 4 else "Main", win)
    with open('/root/font_probe.txt', 'w') as f:
        f.write(str(n))
win.every(80, font_probe)
'''
source=source.replace('\ntdui.run()',probe+'\ntdui.run()')
assets={a['name']:base64.b64decode(a['data']) for a in project['assets']}
binary=build(compiler,project,source,assets)
manifest,recovered,files=inspect(binary)
assert 'font_text' in manifest['runtime']['features']
assert files['font_28.tdfont']==assets['font_28.tdfont']
assert recovered['assets'][0]['data']=='', 'Resource must be stored once in TDAPP'
with tempfile.TemporaryDirectory(prefix='td-fonts-') as tmp:
    fs=Path(tmp)/'tinydesk_fs/root';fs.mkdir(parents=True)
    (fs/'font_test.tdapp').write_bytes(binary)
    commands=[str(runtime),'size=80x24','sixel=10x20','wait=500','key=Enter','wait=700','type=py -m 1024 /root/font_test.tdapp\\r','wait=4500','save=terminal.bin','cells=font-frame.bin']
    result=subprocess.run(commands,cwd=tmp,capture_output=True,timeout=20,check=True)
    probe_path=fs/'font_probe.txt'
    assert probe_path.exists(),result.stdout.decode(errors='replace')
    assert int(probe_path.read_text())>=20,probe_path.read_text()
    cached=list(fs.glob('.tdapp-*/font_28.tdfont'))
    assert len(cached)==1 and cached[0].read_bytes()==assets['font_28.tdfont']
    terminal=(Path(tmp)/'terminal.bin').read_bytes()
    assert b'Traceback' not in terminal and b'no such font' not in terminal
    assert b'\x1bP0;1;0q' in terminal, 'Native font pictures were not rendered'
    assert (Path(tmp)/'font-frame.bin').read_bytes()[:4]==b'TDCF'
print('PASS: generated bitmap font bundled once, native rendering, 20+ dynamic updates and repeated retained page switches in real MicroPython TDAPP.')
