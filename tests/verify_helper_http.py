"""Check the actual helper routes, including native compilation and packaging."""
import base64
import json
from pathlib import Path
import queue
import re
import socket
import subprocess
import sys
import tempfile
import threading
import urllib.error
import urllib.request

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from app_package import inspect
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
fixture=tempfile.TemporaryDirectory(prefix='studio-http-resources-')
folder=Path(fixture.name)
(folder/'declared.py').write_text('VALUE=42',encoding='utf-8')
(folder/'unrelated.py').write_text('VALUE="UNRELATED"',encoding='utf-8')
(folder/'fallback.ppm').write_bytes(b'P6\n1 1\n255\n\0\0\0')
process=subprocess.Popen([sys.executable,str(root/'tools/studio_simulator.py'),'--port',str(port),'--project-dir',str(folder)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
lines=queue.Queue();threading.Thread(target=lambda:lines.put(process.stdout.readline()),daemon=True).start()
try:
    assert b'http://' in lines.get(timeout=10)
    origin='http://127.0.0.1:'+str(port)
    html=urllib.request.urlopen(origin,timeout=5).read().decode()
    token=re.search(r'name="studio-simulation-token" content="([^"]+)"',html)[1]
    assert 'name="studio-simulation-protocol" content="3"' in html
    def post(route,body,auth=token):
        request=urllib.request.Request(origin+route,json.dumps(body).encode(),headers={'Origin':origin,'X-Studio-Token':auth,'Content-Type':'application/json'})
        return json.load(urllib.request.urlopen(request,timeout=25))
    binary=base64.b64decode(post('/compiler/compile',{'source':'print(42)','filename':'test.py'})['binary'])
    assert binary[:2]==b'M\x06' and binary[2]==0
    for arch,code in [('xtensawin',10),('rv32imc',11)]:
        native=base64.b64decode(post('/compiler/compile',{'source':'def compute(x):\n return x*x+1\nprint(compute(4))','compilation':{'mode':'native','arch':arch}})['binary'])
        assert (native[2]>>2)&0x2f==code and native[2]&3==3
    project={'version':1,'name':'http_test'}
    package=base64.b64decode(post('/package/build',{'project':project,'source':'print(42)'})['binary'])
    assert inspect(package)[1]==project
    external={'version':1,'name':'external_test','modules':['declared'],
              'assets':[{'name':'fallback.ppm','data':''}]}
    package=base64.b64decode(post('/package/build',{'project':external,'source':'import declared\nprint(declared.VALUE)',
        'assets':{'fallback.ppm':''},'paths':['/root/fallback.ppm']})['binary'])
    files=inspect(package)[2]
    assert set(files)=={'project.json','_tdapp_main.mpy','declared.mpy','fallback.ppm'}
    assert files['fallback.ppm']==(folder/'fallback.ppm').read_bytes()
    try:post('/compiler/compile',{'source':'pass'},'wrong-token')
    except urllib.error.HTTPError as e:assert e.code==403
    else:raise AssertionError('Unauthenticated compilation accepted')
    source='import tdui\nw=tdui.Window("HTTP test",40,10)\nw.label(2,2,"SIMULATION_OK",width=20)\ntdui.run()'
    body={'source':source,'cols':80,'rows':24}
    first=post('/simulation/start',body)
    assert first['session'] and b'SIMULATION_OK' in base64.b64decode(first['output'])
    frame=base64.b64decode(first['frame'])
    assert frame[:5]==b'TDCF\x01' and len(frame)==16+80*24*4
    second=post('/simulation/start',body)
    assert second['session']!=first['session']
    for route in ('poll','input','stop'):
        try:post('/simulation/'+route,{'session':first['session'],'data':'x'})
        except urllib.error.HTTPError as e:assert e.code==400
        else:raise AssertionError('Stale simulation session accepted')
    assert 'output' in post('/simulation/poll',{'session':second['session']})
    post('/simulation/stop',{'session':second['session']})
finally:
    process.terminate();process.wait(timeout=5);process.stdout.close()
    fixture.cleanup()
print('PASS: real helper HTTP compilation, app export, rendered simulation, restart/session isolation and token enforcement.')
