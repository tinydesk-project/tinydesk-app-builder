# TinyDesk App Builder serial/register runtime contract 1.
# Embedded in exported apps, so later Builder updates cannot replace this code.
import time as _td_time
import struct as _td_struct


def _td_crc(data):
    crc = 65535
    for value in data:
        crc ^= value
        for _ in range(8):
            crc = (crc >> 1) ^ (40961 if crc & 1 else 0)
    return crc


def _td_rtu(data):
    crc = _td_crc(data)
    return bytes(data) + bytes((crc & 255, crc >> 8))


class _TDLink:
    def __init__(self, config, simulated=False):
        self.config, self.simulated = config, simulated
        self.master = config['mode'].endswith('master')
        self.codec = config['codec']
        self.uart = self.de = self.custom = None
        self.bank, self.bindings, self.queue = {}, [], []
        for i in range(config.get('registerCount',0)):
            self.bank[('hr',i)] = 0
        self.on_write = self.before_read = None
        self.frames = self.errors = 0
        self.rx_bytes = self.tx_bytes = 0
        self.rendered = {}
        self.rx = bytearray()
        self.pending = None
        self.index = self.sequence = self.last_rx = self.last_sent = 0
        self.last_good = None
        self.next_poll = 0
        self.state, self.last_error = 'STARTING', ''
        self.status_target = None
        self.closed = False
        c = config
        bits = 1 + c['bits'] + c['stop'] + (c['parity'] != 'none')
        self.gap = max(2, (bits * 3500 + c['baud'] - 1) // c['baud'])

    def _status(self, state, error=''):
        changed = (state, error) != (self.state, self.last_error)
        self.state, self.last_error = state, str(error)[:120]
        if changed and self.status_target is not None:
            if hasattr(self.status_target, 'set'):
                self.status_target.set(text=state)
            else:
                self.status_target.text = state

    def start(self):
        now = _td_time.ticks_ms()
        self.last_rx = self.last_sent = self.next_poll = now
        if self.simulated:
            self._status('SIMULATED')
        else:
            try:
                from machine import UART, Pin
                c = self.config
                if c['de'] >= 0:
                    self.de = Pin(c['de'], Pin.OUT, value=1-c['deActive'])
                self.uart = UART(c['uart'], baudrate=c['baud'], bits=c['bits'],
                    parity={'none': None, 'even': 0, 'odd': 1}[c['parity']],
                    stop=c['stop'], tx=c['tx'], rx=c['rx'], timeout=0,
                    timeout_char=0, rxbuf=512)
                if self.codec in ('json', 'custom'):
                    import json
                    self.json = json
                if self.codec == 'custom':
                    self.custom = __import__(c['codecModule'])
                    if not callable(getattr(self.custom, 'encode', None)) or not callable(getattr(self.custom, 'decode', None)):
                        raise ValueError('UART codec needs encode(message) and decode(frame)')
                self._status('WAIT' if self.master else 'LISTENING')
            except Exception as error:
                if self.uart:
                    self.uart.deinit()
                self.uart = None
                if self.de:
                    self.de.value(1-self.config['deActive'])
                self._status('ERROR', error)
        for element, spec, kind in self.bindings:
            if spec['direction'] != 'write':
                if self.simulated or not self.master:
                    self._display(element, spec, kind, self._value(spec))
                else:
                    self._display(element, spec, kind, None)

    def bind(self, element, spec, kind):
        self.bindings.append((element, spec, kind))
        for i, value in enumerate(self._words(spec, spec['initial'])):
            self.bank.setdefault((spec['table'], spec['address']+i), value)
        if spec['direction'] == 'read':
            return
        if spec['action'] == 'momentary':
            for attr, release in (('on_press', False), ('on_release', True)):
                self._wrap(element, spec, kind, attr, release)
        else:
            attr = {'click': 'on_click', 'press': 'on_press', 'release': 'on_release',
                    'change': 'on_change', 'enter': 'on_enter'}[spec['event']]
            self._wrap(element, spec, kind, attr, False)

    def _wrap(self, element, spec, kind, attr, release):
        old = getattr(element, attr, None)
        def event(control):
            if old:
                old(control)
            try:
                action = spec['action']
                if action == 'momentary':
                    value = spec['releaseValue'] if release else spec['writeValue']
                elif action == 'constant':
                    value = spec['writeValue']
                elif action == 'toggle':
                    value = spec['releaseValue'] if self._value(spec) == spec['writeValue'] else spec['writeValue']
                elif kind == 'checkbox':
                    value = int(control.checked)
                elif kind == 'slider':
                    value = control.values['value']
                else:
                    value = float(control.text)
                self.write(spec, value, coalesce=kind == 'slider')
            except Exception as error:
                self._status('WRITE ERROR', error)
        setattr(element, attr, event)

    def _words(self, spec, value):
        if not spec['min'] <= value <= spec['max']:
            raise ValueError('Value outside configured limits')
        raw = (value-spec['offset']) / spec['gain']
        dtype = spec['dataType']
        if spec['table'] in ('co', 'di'):
            if raw not in (0, 1):
                raise ValueError('Bit must be 0 or 1')
            return [int(raw)]
        if dtype == 'f32':
            data = _td_struct.pack('>f', raw)
            words = [data[0]*256+data[1], data[2]*256+data[3]]
        else:
            raw = int(round(raw))
            low, high = {'u16': (0,65535), 'i16': (-32768,32767),
                         'u32': (0,4294967295), 'i32': (-2147483648,2147483647)}[dtype]
            if not low <= raw <= high:
                raise ValueError('Value does not fit register data type')
            words = [raw & 65535] if dtype.endswith('16') else [(raw >> 16) & 65535, raw & 65535]
        return words[::-1] if spec['wordOrder'] == 'low_first' else words

    def _value(self, spec):
        count = 2 if spec['dataType'] in ('u32','i32','f32') else 1
        words = [self.bank[(spec['table'],spec['address']+i)] for i in range(count)]
        if spec['wordOrder'] == 'low_first':
            words.reverse()
        raw = words[0] if count == 1 else words[0]*65536+words[1]
        if spec['dataType'] == 'i16' and raw >= 32768:
            raw -= 65536
        elif spec['dataType'] == 'i32' and raw >= 2147483648:
            raw -= 4294967296
        elif spec['dataType'] == 'f32':
            raw = _td_struct.unpack('>f', bytes((words[0]>>8,words[0]&255,words[1]>>8,words[1]&255)))[0]
        value = raw*spec['gain']+spec['offset']
        if value != value or value in (float('inf'), -float('inf')):
            raise ValueError('Non-finite register value')
        return value

    def _display(self, element, spec, kind, value):
        key = id(element)
        if key in self.rendered and self.rendered[key] == value:
            return
        if value is None:
            if kind not in ('progress','checkbox','slider','bar','gauge'):
                if hasattr(element, 'set'):
                    element.set(text='--')
                else:
                    element.text = '--'
            self.rendered[key] = value
            return
        if kind in ('progress','slider','bar','gauge'):
            if hasattr(element, 'set'):
                element.set(value=int(value))
            else:
                element.value = max(0,min(100,int(value)))
        elif kind == 'checkbox':
            element.checked = bool(value)
        else:
            text = spec['prefix'] + ('%.*f' % (spec['decimals'],value)) + spec['suffix']
            if hasattr(element, 'set'):
                element.set(text=text)
            else:
                element.text = text
        self.rendered[key] = value

    def _refresh(self):
        for element, spec, kind in self.bindings:
            if spec['direction'] != 'write':
                self._display(element,spec,kind,self._value(spec))

    def write(self, spec, value, coalesce=False):
        words = self._words(spec, value)
        if spec['table'] not in ('co','hr'):
            raise ValueError('Read-only register table')
        if self.simulated or not self.master:
            self._store(spec['table'],spec['address'],words)
            self._refresh()
            return
        now = _td_time.ticks_ms()
        if self.last_good is None or _td_time.ticks_diff(now,self.last_good) > self.config['staleMs']:
            raise OSError('Write blocked: no fresh reply from device')
        req = self._request(spec['table'],spec['address'],words=words)
        if coalesce:
            self.queue = [r for r in self.queue if (r['table'],r['address']) != (req['table'],req['address'])]
        if len(self.queue) >= 16:
            raise OSError('Register write queue full')
        self.queue.append(req)

    def _store(self, table, address, words):
        for i, word in enumerate(words):
            self.bank[(table,address+i)] = word

    def _checked_store(self, table, address, words, enforce_limits=False):
        old = [self.bank.get((table,address+i),0) for i in range(len(words))]
        self._store(table,address,words)
        try:
            for element,spec,kind in self.bindings:
                size = 2 if spec['dataType'] in ('u32','i32','f32') else 1
                if spec['table']==table and spec['address']<address+len(words) and spec['address']+size>address:
                    value=self._value(spec)
                    if enforce_limits and spec['direction']!='read' and not spec['min']<=value<=spec['max']:
                        raise ValueError('Remote write outside configured limits')
        except Exception:
            self._store(table,address,old)
            raise

    def _request(self, table, address, count=1, words=None):
        self.sequence = self.sequence % 65535 + 1
        return {'id': self.sequence, 'unit': self.config['unit'], 'op': 'read' if words is None else 'write',
                'table': table, 'address': address, 'count': count if words is None else len(words),
                'values': words or []}

    def _encode(self, req):
        if self.codec != 'rtu':
            payload = self.custom.encode(req) if self.custom else self.json.dumps(req).encode()
            return bytes(payload) + (b'\n' if self.codec == 'json' or self.config['framing'] == 'newline' else b'')
        fc = {'co':1,'di':2,'hr':3,'ir':4}[req['table']]
        address, count = req['address'], req['count']
        head = bytes((req['unit'],fc,address>>8,address&255,count>>8,count&255))
        if req['op'] == 'write':
            words = req['values']
            if count == 1:
                value = (65280 if words[0] else 0) if req['table'] == 'co' else words[0]
                head = bytes((req['unit'],5 if req['table']=='co' else 6,address>>8,address&255,value>>8,value&255))
            elif req['table'] == 'co':
                data = bytearray((count+7)//8)
                for i, word in enumerate(words):
                    data[i//8] |= bool(word) << (i%8)
                head = bytes((req['unit'],15,address>>8,address&255,count>>8,count&255,len(data)))+data
            else:
                head = bytes((req['unit'],16,address>>8,address&255,count>>8,count&255,count*2))
                head += bytes(v for word in words for v in (word>>8,word&255))
        return _td_rtu(head)

    def _send(self, data, now):
        if len(data) > 512:
            raise ValueError('Serial frame exceeds 512 bytes')
        if self.de:
            self.de.value(self.config['deActive'])
        try:
            if self.uart.write(data) != len(data):
                raise OSError('Incomplete UART write')
            self.tx_bytes += len(data)
            if self.de:
                self.uart.flush()
        finally:
            if self.de:
                self.de.value(1-self.config['deActive'])
        self.last_sent = _td_time.ticks_ms()

    def _master_reply(self, data, now):
        if self.pending is None:
            return
        req, sent, retry = self.pending
        if self.codec != 'rtu':
            reply = self.custom.decode(data) if self.custom else self.json.loads(data)
            if not reply or not isinstance(reply,dict):
                return
            if reply.get('id') != req['id'] or reply.get('unit') != req['unit']:
                return
            if reply.get('error'):
                raise OSError('Remote exception %s' % reply['error'])
            words = reply.get('values',[]) if req['op']=='read' else req['values']
            if req['op']=='write' and reply.get('ok') is not True:
                raise ValueError('Write acknowledgment missing')
        else:
            if len(data)<5 or _td_crc(data[:-2]) != data[-2]+data[-1]*256 or data[0]!=req['unit']:
                return
            fc = {'co':1,'di':2,'hr':3,'ir':4}[req['table']] if req['op']=='read' else (5 if req['table']=='co' else 6) if req['count']==1 else (15 if req['table']=='co' else 16)
            if data[1] == fc|128:
                if len(data) != 5:
                    return
                raise OSError('Modbus exception %d' % data[2])
            if data[1]!=fc:
                return
            if req['op']=='write':
                if data != self._encode(req)[:6]+_td_rtu(self._encode(req)[:6])[-2:]:
                    return
                words = req['values']
            else:
                size = (req['count']+7)//8 if fc<3 else req['count']*2
                if len(data)!=size+5 or data[2]!=size:
                    return
                words = [(data[3+i//8]>>(i%8))&1 for i in range(req['count'])] if fc<3 else [data[3+i*2]*256+data[4+i*2] for i in range(req['count'])]
        if len(words) != req['count'] or any(not isinstance(v,int) or not 0<=v<=(1 if req['table'] in ('co','di') else 65535) for v in words):
            raise ValueError('Invalid register response')
        self._checked_store(req['table'],req['address'],words)
        self.pending = None
        self.last_good = now
        self._status('ONLINE')
        self._refresh()

    def _serve(self, req):
        table, address, count = req['table'],req['address'],req['count']
        if table=='ir' and self.config.get('inputAlias',False):
            table='hr'
        if table not in ('co','di','hr','ir') or not 1<=count<=125 or not 0<=address<=65535 or address+count>65536:
            return {'error':3}
        if any((table,address+i) not in self.bank for i in range(count)):
            return {'error':2}
        if req['op'] == 'write':
            words = req['values']
            if table not in ('co','hr') or len(words)!=count or any(not isinstance(v,int) or not 0<=v<=(1 if table=='co' else 65535) for v in words):
                return {'error':3}
            try:
                self._checked_store(table,address,words,True)
            except (ValueError, OverflowError):
                return {'error':3}
            self._refresh()
            if self.on_write:
                self.on_write(table,address,words)
            return {'ok':True}
        if req['op'] != 'read':
            return {'error':1}
        if self.before_read:
            self.before_read(table,address,count)
        return {'values':[self.bank[(table,address+i)] for i in range(count)]}

    def _slave_reply(self, data, now):
        if self.codec != 'rtu':
            req = self.custom.decode(data) if self.custom else self.json.loads(data)
            if not req or not isinstance(req,dict):
                return
            if req.get('unit') != self.config['unit']:
                return
            result = self._serve(req)
            result.update(id=req['id'],unit=req['unit'])
            self._send(self.custom.encode(result)+(b'\n' if self.config['framing']=='newline' else b'') if self.custom else self.json.dumps(result).encode()+b'\n',now)
        else:
            if len(data)<8 or _td_crc(data[:-2])!=data[-2]+data[-1]*256 or data[0] not in (0,self.config['unit']):
                return
            unit, fc = data[0],data[1]
            address, count = data[2]*256+data[3],data[4]*256+data[5]
            table = {1:'co',2:'di',3:'hr',4:'ir',5:'co',6:'hr',15:'co',16:'hr'}.get(fc)
            words = []
            error = 0
            if fc in (1,2,3,4) and len(data)==8:
                op='read'
            elif fc in (5,6) and len(data)==8:
                op='write'
                if fc==5 and count not in (0,65280):
                    error=3
                words=[int(bool(count)) if fc==5 else count];count=1
            elif fc in (15,16) and len(data)>=9 and len(data)==data[6]+9 and data[6]==((count+7)//8 if fc==15 else count*2):
                op='write'
                words=[(data[7+i//8]>>(i%8))&1 for i in range(count)] if fc==15 else [data[7+i*2]*256+data[8+i*2] for i in range(count)]
            else:
                op='invalid';error=1 if table is None else 3
            if unit==0 and op!='write':
                return
            result={'error':error} if error else self._serve({'table':table,'address':address,'count':count,'op':op,'values':words})
            if unit==0:
                if not result.get('error'):
                    self.last_good=now;self.frames+=1;self._status('ONLINE')
                return
            if result.get('error'):
                reply=bytes((unit,fc|128,result['error']))
            elif op=='write':
                reply=data[:6]
            elif fc<3:
                packed=bytearray((count+7)//8)
                for i,value in enumerate(result['values']):
                    packed[i//8] |= bool(value) << (i%8)
                reply=bytes((unit,fc,len(packed)))+packed
            else:
                reply=bytes((unit,fc,count*2))+bytes(v for word in result['values'] for v in (word>>8,word&255))
            self._send(_td_rtu(reply),now)
        self.last_good=now
        self.frames+=1
        self._status('ONLINE')

    def _rtu_frames(self,now):
        # Explicit lengths tolerate UART FIFO chunks without treating a pause
        # between chunks as the end of a request. Bound resynchronization work.
        # MicroPython bytearray does not implement item/slice deletion.
        # Scan with a cursor, then copy only the unconsumed tail once.
        b,pos=self.rx,0
        try:
            for _ in range(64):
                left=len(b)-pos
                if left<2:break
                if b[pos] not in ((self.config['unit'],) if self.master else (0,self.config['unit'])):
                    pos+=1;continue
                fc=b[pos+1]
                if self.master and fc&128:
                    size=5
                elif self.master and fc in (1,2,3,4):
                    if left<3:break
                    size=b[pos+2]+5
                elif not self.master and fc in (15,16):
                    if left<7:break
                    size=b[pos+6]+9
                else:
                    size=8
                if size>256:
                    pos+=1;self.errors+=1;continue
                if left<size:break
                frame=bytes(b[pos:pos+size])
                if _td_crc(frame[:-2])!=frame[-2]+frame[-1]*256:
                    pos+=1;self.errors+=1;continue
                pos+=size
                if self.master:self._master_reply(frame,now)
                else:self._slave_reply(frame,now)
        finally:
            if pos:self.rx=b[pos:]

    def tick(self):
        if self.closed or self.simulated or not self.uart:
            return
        now=_td_time.ticks_ms()
        try:
            n=min(512,self.uart.any())
            if n:
                data=self.uart.read(n)
                if data:
                    self.rx.extend(data);self.rx_bytes+=len(data);self.last_rx=now
                if len(self.rx)>512:
                    self.rx=bytearray();raise ValueError('RX frame overflow')
            newline=self.codec=='json' or self.codec=='custom' and self.config['framing']=='newline'
            if self.codec=='rtu':
                self._rtu_frames(now)
                if self.rx and _td_time.ticks_diff(now,self.last_rx)>max(350,self.config['timeoutMs']):
                    self.rx=bytearray();self.errors+=1
            elif self.rx and (b'\n' in self.rx if newline else _td_time.ticks_diff(now,self.last_rx)>=self.gap):
                if newline:
                    frame,rest=bytes(self.rx).split(b'\n',1);self.rx=bytearray(rest)
                else:
                    frame=bytes(self.rx);self.rx=bytearray()
                if self.master:
                    self._master_reply(frame,now)
                else:
                    self._slave_reply(frame,now)
            if self.pending and _td_time.ticks_diff(now,self.pending[1])>=self.config['timeoutMs']:
                req,sent,retry=self.pending
                if req['op']=='read' and retry<self.config['retries']:
                    self._send(self._encode(req),now);self.pending=(req,now,retry+1)
                else:
                    self.pending=None;self._status('TIMEOUT','Device did not acknowledge request')
                    self.next_poll=_td_time.ticks_add(now,self.config['pollMs'])
            if self.last_good is not None and _td_time.ticks_diff(now,self.last_good)>self.config['staleMs']:
                if self.state!='STALE':
                    self._status('STALE')
                    for element,spec,kind in self.bindings:
                        if spec['direction']!='write':
                            self._display(element,spec,kind,None)
                self.queue=[]
            if self.master and not self.pending and not self.rx and _td_time.ticks_diff(now,self.last_sent)>=self.gap and _td_time.ticks_diff(now,self.last_rx)>=self.gap:
                req=self.queue.pop(0) if self.queue else None
                if req is None and self.bindings and _td_time.ticks_diff(now,self.next_poll)>=0:
                    element,spec,kind=self.bindings[self.index%len(self.bindings)]
                    self.index+=1
                    req=self._request(spec['table'],spec['address'],2 if spec['dataType'] in ('u32','i32','f32') else 1)
                    self.next_poll=_td_time.ticks_add(now,self.config['pollMs'])
                if req:
                    self._send(self._encode(req),now);self.pending=(req,now,0)
        except Exception as error:
            self.errors+=1
            self.pending=None
            self._status('ERROR',error)
            self.next_poll=_td_time.ticks_add(now,self.config['pollMs'])

    def close(self):
        self.closed=True
        self.queue=[]
        if self.de:
            self.de.value(1-self.config['deActive'])
        if self.uart:
            self.uart.deinit()
            self.uart=None
