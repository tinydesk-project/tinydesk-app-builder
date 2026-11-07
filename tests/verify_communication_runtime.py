"""Run a generated register UI and a compiled package in actual MicroPython."""
from pathlib import Path
import json
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from builder_helper import Simulation
from app_package import build,inspect
runtime=__import__('runtime_path').tdsim()
compiler=root.parent/'tinydesk/build-check-20261103/compiler/mpy_cross/mpy-cross.exe'
generated=json.loads(subprocess.check_output(['node','-e',r'''
const T=require('./core.js'),C=require('./communications.js'),d=T.initial(),w=d.windows[0];
d.name='register_demo';d.board=32000;w.fullscreen=true;
d.communication={...C.defaults,mode:'modbus_master',tx:17,rx:18,statusElement:'connection'};
w.widgets=[Object.assign(T.widget('label','reading',2,2),{binding:{...C.bindingDefaults,initial:25,decimals:1,suffix:' C'}}),
 T.widget('label','connection',2,3),
 Object.assign(T.widget('button','setpoint',2,5),{text:'Set 30',binding:{...C.bindingDefaults,direction:'write',action:'constant',writeValue:30}}),
 Object.assign(T.widget('checkbox','output',25,5),{text:'Output',checked:false,binding:{...C.bindingDefaults,direction:'readwrite',table:'co',address:1,max:1,event:'change'}})];
const cv=T.widget('canvas','controls',2,8);Object.assign(cv,{w:30,h:8});
cv.paint=[{...T.Pixels.defaults.slider,op:'slider',name:'level',x:1,y:1,w:20,h:3,binding:{...C.bindingDefaults,direction:'readwrite',address:2,max:100,event:'change'}}];w.widgets.push(cv);
if(T.validate(d).errors.length)throw Error(T.validate(d).errors.join('\n'));
process.stdout.write(JSON.stringify({project:d,source:T.generate(d,{bundle:true,simulation:true,embedRuntime:true}),hardware:T.generate(d,{bundle:true,embedRuntime:true})}));
'''],cwd=root,text=True,encoding='utf-8'))

probe='''
import json as _td_probe_json
assert _td_crc(b'123456789') == 19255
_td_req = _td_link._request('hr',0,words=[258,772])
assert _td_link._encode(_td_req) == _td_rtu(bytes((1,16,0,0,0,2,4,1,2,3,4)))
_td_link.codec='json'
_td_link.json=_td_probe_json
assert _td_probe_json.loads(_td_link._encode(_td_req))['values'] == [258,772]
_td_link.codec='rtu'
_td_link.pending=(_td_link._request('hr',0),_td_time.ticks_ms(),0)
_td_link.rx.extend(_td_rtu(bytes((1,3,2,0,25))))
_td_link._rtu_frames(_td_time.ticks_ms())
assert reading.text == '25.0 C'
_td_link._status('SIMULATED')

# Exercise the receive/parser path in real MicroPython, not CPython mocks.
class _ProbeUART:
    def __init__(self):self.sent=[]
    def write(self,data):self.sent.append(bytes(data));return len(data)
_slave=_TDLink(dict(_td_link.config,mode='modbus_slave',registerCount=600,inputAlias=True))
_slave.uart=_ProbeUART()
_words=bytes(v for i in range(123) for v in (0,i))
_full=_td_rtu(bytes((1,16,1,94,0,123,246))+_words)
for _at in range(0,len(_full),41):
    _slave.rx.extend(_full[_at:_at+41])
    _slave._rtu_frames(_td_time.ticks_ms())
assert not _slave.rx and _slave.bank[('hr',472)]==122
assert _slave.uart.sent==[_td_rtu(bytes((1,16,1,94,0,123)))]
_read=_td_rtu(bytes((1,4,1,94,0,2)))
_bad=_read[:-1]+bytes((_read[-1]^1,))
_slave.rx.extend(bytes((255,255))+_bad+_td_rtu(bytes((2,3,0,0,0,1)))+_read+_read)
_slave._rtu_frames(_td_time.ticks_ms())
assert not _slave.rx and _slave.errors>0 and len(_slave.uart.sent)==3
assert _slave.uart.sent[-1]==_td_rtu(bytes((1,4,4,0,0,0,1)))
def _td_probe():
    with open('/root/register_probe.json','w') as f:
        f.write(_td_probe_json.dumps([reading.text,_td_link.state,_td_link.bank[('co',1)],_td_link.bank[('hr',2)]]))
win.every(60,_td_probe)
'''
def with_probe(source):
    # Hardware-unavailable branch must retain its own ERROR state.
    actual=probe if 'simulated=True' in source else 'import json as _td_probe_json\n'+probe[probe.index('def _td_probe'):]
    return source.replace('\ntry:\n    tdui.run()',actual+'\ntry:\n    tdui.run()')
sim=Simulation(runtime)
try:
    sim.start({'source':with_probe(generated['source']),'cols':80,'rows':25})
    path=Path(sim.work.name)/'tinydesk_fs/root/register_probe.json'
    assert json.loads(path.read_text())==['25.0 C','SIMULATED',0,0]
    sim.exchange(['click=5,5','wait=180'])
    assert json.loads(path.read_text())[0]=='30.0 C'
    sim.exchange(['click=27,5','wait=180'])
    assert json.loads(path.read_text())[2]==1
    sim.exchange(['input='+b'\x1b[<0;5;11M\x1b[<32;23;11M\x1b[<0;23;11m'.hex(),'wait=180'])
    assert json.loads(path.read_text())[3]>=90
    # Host has no physical UART. A rejected port must leave timers/UI alive.
    sim.start({'source':with_probe(generated['hardware']),'cols':80,'rows':25})
    result=json.loads((Path(sim.work.name)/'tinydesk_fs/root/register_probe.json').read_text())
    assert result[0]=='--' and result[1]=='ERROR',result
finally:sim.stop()

binary=build(compiler,generated['project'],with_probe(generated['source']),{})
manifest,project,files=inspect(binary)
assert project['communication']['version']==1 and files['_tdapp_main.mpy'].startswith(b'M\x06')
with tempfile.TemporaryDirectory(prefix='td-register-app-') as tmp:
    fs=Path(tmp)/'tinydesk_fs/root';fs.mkdir(parents=True)
    (fs/'registers.tdapp').write_bytes(binary)
    subprocess.run([str(runtime),'auth=off','wait=500','key=Enter','wait=700',
        'type=py -m 1024 /root/registers.tdapp\\r','wait=2200','click=5,5','wait=200','save=output.bin'],
        cwd=tmp,capture_output=True,timeout=12,check=True)
    result=json.loads((fs/'register_probe.json').read_text())
    assert result[0]=='30.0 C' and result[1]=='SIMULATED'
    assert b'Traceback' not in (Path(tmp)/'output.bin').read_bytes()
print('PASS: actual MicroPython RTU receive parsing, fragmented 123-register writes, CRC recovery, UI bindings, unavailable-UART recovery and self-contained TDAPP.')
