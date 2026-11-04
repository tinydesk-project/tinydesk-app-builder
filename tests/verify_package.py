"""TDAPP integrity, project recovery and real MicroPython execution."""
from pathlib import Path
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from app_package import build,inspect,deployment
runtime=max((root.parent/'tinydesk').glob('build*/tdsim.exe'),key=lambda p:p.stat().st_mtime)
compiler=root.parent/'tinydesk/build-check-20261103/compiler/mpy_cross/mpy-cross.exe'
project={'version':1,'name':'package_test','provenance':{'lastEditedWith':'0.3.0'},'application':{'version':'1.0.0'}}
source="""import helper
with open('result.txt','w') as f:
    f.write(helper.VALUE)
"""
binary=build(compiler,project,source,{'image.ppm':b'P6\n1 1\n255\n\0\0\0'},{'helper.py':"VALUE='PACKAGE_OK'"})
manifest,recovered,files=inspect(binary)
assert recovered==project and files['image.ppm'].startswith(b'P6')
assert binary==build(compiler,project,source,{'image.ppm':files['image.ppm']},{'helper.py':"VALUE='PACKAGE_OK'"}), 'Same inputs must produce identical packages'
repacked=build(compiler,project,source,{'image.ppm':files['image.ppm']},binaries={'helper.mpy':files['helper.mpy']})
assert inspect(repacked)[2]['helper.mpy']==files['helper.mpy']
startup={**project,'startup':{'mode':'custom','page':'welcome','durationMs':1000,'image':'image.ppm'},'assets':[{'name':'image.ppm','data':'embedded-copy'}],'binaryDependencies':[{'name':'helper.mpy','data':'embedded-module-copy'}]}
with_art=build(compiler,startup,source,{'image.ppm':files['image.ppm']},{'helper.py':"VALUE='PACKAGE_OK'"})
meta,saved,entries=inspect(with_art)
assert saved['assets'][0]['data']=='' and entries['image.ppm']==files['image.ppm']
assert saved['binaryDependencies'][0]['data']=='' and entries['helper.mpy']==files['helper.mpy']
assert startup['assets'][0]['data']=='embedded-copy','Packaging must not mutate editable input'
assert startup['binaryDependencies'][0]['data']=='embedded-module-copy'
instructions=deployment(with_art,'test.tdapp')
assert 'kiosk.status = 0' in instructions and '/image.ppm' in instructions and 'kiosk.app = /root/test.tdapp' in instructions
assert meta['startup']==startup['startup']
damaged=bytearray(binary);damaged[manifest['files'][1]['offset']]^=1
try:inspect(damaged)
except ValueError:pass
else:raise AssertionError('Damaged payload accepted')
with tempfile.TemporaryDirectory(prefix='tdapp-test-') as tmp:
    fs=Path(tmp)/'tinydesk_fs/root';fs.mkdir(parents=True)
    (fs/'test.tdapp').write_bytes(binary)
    result=subprocess.run([str(runtime),'wait=500','key=Enter','wait=700','type=py -m 512 /root/test.tdapp\\r','wait=1700','shot'],cwd=tmp,capture_output=True,timeout=12)
    found=list(fs.glob('.tdapp-*/result.txt'))
    assert found and found[0].read_text()=='PACKAGE_OK',result.stdout.decode(errors='replace')
    helper=found[0].parent/'helper.mpy';modified=helper.stat().st_mtime_ns
    subprocess.run([str(runtime),'wait=500','key=Enter','wait=700','type=py -m 512 /root/test.tdapp\\r','wait=1700'],cwd=tmp,capture_output=True,timeout=12,check=True)
    assert helper.stat().st_mtime_ns==modified,'Valid cache must not be rewritten on restart'
    helper.write_bytes(b'broken cache')
    subprocess.run([str(runtime),'wait=500','key=Enter','wait=700','type=py -m 512 /root/test.tdapp\\r','wait=1700'],cwd=tmp,capture_output=True,timeout=12,check=True)
    assert helper.read_bytes()==files['helper.mpy'],'Damaged cached code must be repaired from the verified package'
    failed=build(compiler,project,"raise RuntimeError('startup diagnostic test')")
    (fs/'failed.tdapp').write_bytes(failed)
    subprocess.run([str(runtime),'wait=500','key=Enter','wait=700','type=py -m 512 /root/failed.tdapp\\r','wait=1700'],cwd=tmp,capture_output=True,timeout=12,check=True)
    errors=list(fs.glob('.tdapp-*/startup-error.txt'))
    assert len(errors)==1 and 'RuntimeError: startup diagnostic test' in errors[0].read_text(), 'Kiosk startup failures must leave an inspectable traceback'
print('PASS: TDAPP round trip, bundled module/image, checksum rejection and actual MicroPython launch.')
