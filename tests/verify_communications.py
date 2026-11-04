"""Exercise actual generated runtime across a deterministic paired UART wire."""
from pathlib import Path
import importlib.util
import json
import subprocess
import sys
import time
import types

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('communication',root/'runtime/communication.py')
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
now=0;period=1<<30
time.ticks_ms=lambda:now%period
time.ticks_diff=lambda a,b:(a-b+period//2)%period-period//2
time.ticks_add=lambda a,b:(a+b)%period
Link=runtime._TDLink
model=json.loads(subprocess.check_output(['node','-e',"const C=require('./communications.js');process.stdout.write(JSON.stringify([C.defaults,C.bindingDefaults]));"],cwd=root,text=True))
config,binding=model
assert runtime._td_crc(b'123456789')==0x4b37

class Wire:
    def __init__(self):self.rx=bytearray();self.peer=None;self.sent=[];self.open=True
    def write(self,data):self.sent.append(bytes(data));self.peer.rx.extend(data);return len(data)
    def any(self):return len(self.rx)
    def read(self,n):data=bytes(self.rx[:n]);del self.rx[:n];return data
    def deinit(self):self.open=False
    def flush(self):pass

class Field:
    def __init__(self):self.text='';self.value=0;self.values={'value':0};self.draws=0
    def set(self,**fields):self.values.update(fields);self.__dict__.update(fields);self.draws+=1

def pair(codec='rtu',start=0):
    global now
    now=start
    a,b=Wire(),Wire();a.peer=b;b.peer=a
    ports={1:a,2:b}
    sys.modules['machine']=types.SimpleNamespace(UART=lambda n,**kw:ports[n],Pin=None)
    master=Link({**config,'mode':'uart_master','codec':codec,'codecModule':'test_codec','tx':17,'rx':18,'pollMs':50,'timeoutMs':30,'staleMs':100,'retries':0})
    slave=Link({**config,'mode':'uart_slave','codec':codec,'codecModule':'test_codec','uart':2,'tx':17,'rx':18,'pollMs':50,'timeoutMs':30,'staleMs':100,'retries':0})
    label,edit=Field(),Field()
    reading={**binding,'initial':25,'decimals':1,'suffix':' C'}
    writing={**binding,'direction':'readwrite','event':'change'}
    master.bind(label,reading,'picture');slave.bind(edit,reading,'picture')
    master.start();slave.start()
    def advance(ms):
        global now
        for _ in range(0,ms,5):now+=5;master.tick();slave.tick()
    return master,slave,label,edit,a,b,advance

for codec in ('rtu','json'):
    master,slave,label,edit,a,b,advance=pair(codec)
    assert label.text=='--'
    try:master.write(binding,30)
    except OSError:pass
    else:raise AssertionError('Write accepted before any reply')
    advance(80)
    assert master.state=='ONLINE' and label.text=='25.0 C'
    master.write(binding,30);advance(80)
    assert slave.bank[('hr',0)]==30 and label.text=='30.0 C'
    draws=label.draws;advance(80);assert label.draws==draws,'Unchanged poll redrew the element'
    # Local slave controls update the same bank visible to the remote master.
    slave.write(binding,42);advance(80);assert label.text=='42.0 C'
    slave.close();advance(220)
    assert master.state in ('STALE','TIMEOUT') and label.text=='--'
    try:master.write(binding,50)
    except OSError:pass
    else:raise AssertionError('Stale write accepted')
    master.close();assert not a.open and not b.open
print('PASS: paired RTU/JSON master-slave reads, writes, local bank, no redundant draws, timeouts and stale write guard.')

master,slave,label,edit,a,b,advance=pair(start=period-25)
advance(80);assert master.state=='ONLINE' and label.text=='25.0 C'
print('PASS: serial scheduler survives MicroPython tick wraparound.')

master,slave,label,edit,a,b,advance=pair();advance(80)
assert master.rx_bytes>0 and master.tx_bytes>0 and slave.rx_bytes>0 and slave.tx_bytes>0
def failed_receive():raise OSError('receive diagnostic test')
b.any=failed_receive
before=slave.errors;slave.tick()
assert slave.errors==before+1 and slave.state=='ERROR' and 'receive diagnostic test' in slave.last_error
print('PASS: physical byte counters and receive-error diagnostics remain inspectable.')

# 32-bit ordering, negative values and inverse scaling round-trip.
for dtype,value in (('u16',32000),('i16',-100),('u32',2000000000),('i32',-1000000000),('f32',12.5)):
    for order in ('high_first','low_first'):
        p={**binding,'dataType':dtype,'wordOrder':order,'min':-1e12,'max':1e12,'gain':.5,'offset':2}
        words=master._words(p,value)
        master._store('hr',0,words)
        assert abs(master._value(p)-value)<.001
print('PASS: signed/unsigned 16/32-bit, float32, word swap and inverse scaling.')

# Validate slave frames independently of the GUI scheduler.
master,slave,label,edit,a,b,advance=pair()
slave.bank.update({('hr',1):0,('co',0):0,('co',1):0})
def request(body):
    b.sent.clear();slave._slave_reply(runtime._td_rtu(bytes(body)),now)
    return b.sent[-1] if b.sent else None
assert request([1,6,0,0,0,99])==runtime._td_rtu(bytes([1,6,0,0,0,99]))
assert slave.bank[('hr',0)]==99
assert request([1,16,0,0,0,2,4,0,10,0,11])==runtime._td_rtu(bytes([1,16,0,0,0,2]))
assert [slave.bank[('hr',i)] for i in range(2)]==[10,11]
assert request([1,15,0,0,0,2,1,3])==runtime._td_rtu(bytes([1,15,0,0,0,2]))
assert slave.bank[('co',0)]==slave.bank[('co',1)]==1
assert request([1,5,0,0,0,1])[1:3]==bytes([133,3])
assert request([1,3,0,90,0,1])[1:3]==bytes([131,2])
old=slave.bank.copy();request([1,16,0,1,0,2,4,0,1,0,2]);assert slave.bank==old,'Partial invalid write mutated bank'
bad=bytearray(runtime._td_rtu(bytes([1,6,0,0,0,55])));bad[-1]^=1
slave._slave_reply(bad,now);assert slave.bank==old
assert request([0,6,0,0,0,77]) is None and slave.bank[('hr',0)]==77
assert request([0,3,0,0,0,1]) is None
assert request([2,6,0,0,0,88]) is None and slave.bank[('hr',0)]==77
print('PASS: RTU FC05/06/15/16, exact acknowledgments, invalid coil values, illegal addresses, atomic rejection, CRC, broadcast and station isolation.')

# JSON and custom code share the explicit register-message contract.
sys.modules['test_codec']=types.SimpleNamespace(encode=lambda msg:json.dumps(msg).encode(),decode=lambda data:json.loads(data))
master,slave,label,edit,a,b,advance=pair('custom')
for link in (master,slave):
    link.config['codecModule']='test_codec';link.closed=False;link.start()
advance(80);assert label.text=='25.0 C'
master.write(binding,36);advance(80);assert label.text=='36.0 C'

# Existing handlers run, momentary release is paired, slider writes coalesce.
sim=Link({**config,'mode':'modbus_master'},True);control=Field();events=[]
control.on_press=lambda c:events.append('old press')
p={**binding,'direction':'write','action':'momentary','writeValue':1,'releaseValue':0}
sim.bind(control,p,'button');sim.start();control.on_press(control);assert sim.bank[('hr',0)]==1
control.on_release(control);assert sim.bank[('hr',0)]==0 and events==['old press']
master.queue=[];master.last_good=time.ticks_ms()
for value in range(30):master.write(binding,value,coalesce=True)
assert len(master.queue)==1 and master.queue[0]['values']==[29]
for value in range(15):master.write(binding,value)
try:master.write(binding,99)
except OSError:pass
else:raise AssertionError('Unbounded write queue')
print('PASS: custom codec, existing callbacks, momentary press/release, bounded/coalesced write queue.')

# Full PLC bank, aliased FC04 and FIFO-delivered long frames. No idle-gap
# assumption may truncate a valid request between its UART chunks.
now=0
rx,tx=Wire(),Wire();rx.peer=tx;tx.peer=rx
sys.modules['machine']=types.SimpleNamespace(UART=lambda n,**kw:rx,Pin=None)
full=Link({**config,'mode':'modbus_slave','unit':95,'tx':43,'rx':44,'registerCount':600,'inputAlias':True})
writes=[];reads=[];full.on_write=lambda table,addr,words:writes.append((table,addr,len(words)))
full.before_read=lambda table,addr,count:reads.append((table,addr,count));full.start()
body=bytes((95,16,1,94,0,123,246))+bytes(v for word in range(123) for v in (word>>8,word&255))
frame=runtime._td_rtu(body)
for pos in range(0,len(frame),41):
    rx.rx.extend(frame[pos:pos+41]);now+=30;full.tick()
assert rx.sent[-1]==runtime._td_rtu(bytes((95,16,1,94,0,123)))
assert writes==[('hr',350,123)] and full.bank[('hr',472)]==122
rx.rx.extend(runtime._td_rtu(bytes((95,4,1,94,0,123))));now+=10;full.tick()
assert rx.sent[-1][1:3]==bytes((4,246)) and reads[-1]==('hr',350,123)
assert len(rx.sent[-1])==251
print('PASS: 600-register bank, FC04 mirror, write/read hooks and 123-register request fragmented across 30 ms FIFO gaps.')
