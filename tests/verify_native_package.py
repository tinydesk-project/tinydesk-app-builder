"""Native MPY targets, dependency preservation and pre-extraction rejection."""
import base64
from pathlib import Path
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from app_package import build, inspect, compile_source, mpy_arch
from builder_helper import Simulation
compiler=max((root.parent/'tinydesk').glob('build*/compiler/mpy_cross/mpy-cross.exe'),key=lambda p:p.stat().st_mtime)
runtime=max((root.parent/'tinydesk').glob('build*/tdsim.exe'),key=lambda p:p.stat().st_mtime)
source='def compute(x):\n return x*x+1\nprint(compute(4))\n'
modules={arch:compile_source(compiler,source,compilation={'mode':'native','arch':arch}) for arch in ('xtensawin','rv32imc')}
for arch,code in [('xtensawin',10),('rv32imc',11)]:
    assert mpy_arch(modules[arch])==code and modules[arch][2]&3==3
    project={'version':1,'name':'native_test','compilation':{'mode':'native','arch':arch}}
    binary=build(compiler,project,source)
    manifest,recovered,files=inspect(binary)
    assert recovered==project and binary[2]==0, 'Bootstrap stays portable'
    assert manifest['runtime']['native']=={'arch':arch,'id':code,'requiresRoot':True}
    assert mpy_arch(files['_tdapp_main.mpy'])==code
    repacked=build(compiler,{'version':1,'name':'native_dependency'},'import compute',binaries={'compute.mpy':modules[arch]})
    assert inspect(repacked)[2]['compute.mpy']==modules[arch]
    assert inspect(repacked)[0]['runtime']['native']['id']==code
    assert repacked==build(compiler,{'version':1,'name':'native_dependency'},'import compute',binaries={'compute.mpy':modules[arch]})
try:build(compiler,{'version':1,'name':'mixed'},'pass',binaries={k+'.mpy':v for k,v in modules.items()})
except ValueError as e:assert 'same CPU' in str(e)
else:raise AssertionError('Mixed architectures accepted')
for bad in ({'mode':'native','arch':'armv7m'},{'mode':'invalid'}):
    try:compile_source(compiler,source,compilation=bad)
    except ValueError:pass
    else:raise AssertionError('Unsupported target accepted')
bad=bytearray(modules['xtensawin']);bad[2]^=1
try:mpy_arch(bad)
except ValueError:pass
else:raise AssertionError('Wrong native ABI accepted')

# The Windows development runtime has no native emitter. The package should
# explain the mismatch before creating a cache or executing a dependency.
if sys.platform=='win32':
    with tempfile.TemporaryDirectory(prefix='tdapp-native-') as tmp:
        fs=Path(tmp)/'tinydesk_fs/root';fs.mkdir(parents=True)
        (fs/'native.tdapp').write_bytes(binary)
        result=subprocess.run([str(runtime),'auth=off','wait=500','key=Enter','wait=700','type=py -m 512 /root/native.tdapp\\r','wait=1700','shot'],cwd=tmp,capture_output=True,timeout=12,check=True)
        assert b'TDAPP needs native rv32imc' in result.stdout
        assert not list(fs.glob('.tdapp-*')), 'Wrong-target package extracted files'

# ESP native dependencies need an explicit portable simulation implementation.
sim=Simulation(runtime)
body={'source':'import compute','cols':80,'rows':24,'modules':['compute'],
      'binaries':[{'name':'compute.mpy','data':base64.b64encode(modules['xtensawin']).decode()}]}
try:
    try:sim.start(body)
    except ValueError as e:assert 'targets ESP hardware' in str(e)
    else:raise AssertionError('ESP module launched in desktop simulator')
finally:sim.stop()
print('PASS: native code headers, CPU/ABI validation, deterministic packages, preserved dependencies, wrong-target rejection before extraction and clear simulation diagnostics.')
