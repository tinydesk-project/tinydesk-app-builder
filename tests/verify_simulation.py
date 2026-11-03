"""Verify the actual simulator with a generic app and no private dependencies."""
from pathlib import Path
import base64
import sys
import subprocess
import json
import tempfile
import time
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from studio_simulator import Simulation
sim=Simulation(max((root.parent/'tinydesk').glob('build*/tdsim.exe'),key=lambda p:p.stat().st_mtime))
source=(root/'examples/instrument_panel.py').read_text(encoding='utf-8')
probe='''
def probe_value():
    with open('/root/probe.txt','w') as f:
        f.write(str(level_slider.values['value']))
tdui.every(100,probe_value)
'''
source=source.replace('\ntdui.run()',probe+'\ntdui.run()')
asset={'name':'test.ppm','data':base64.b64encode(b'P6\n1 1\n255\n\0\0\0').decode()}
try:
    sim.start({'source':source,'cols':80,'rows':24,'assets':[asset]})
    work=Path(sim.work.name);value=work/'tinydesk_fs/root/probe.txt'
    assert (value.parent/'test.ppm').read_bytes().startswith(b'P6')
    def wait_for(expected):
        end=time.monotonic()+3
        while time.monotonic()<end:
            sim.exchange([])
            if value.exists() and value.read_text()==expected:return
            time.sleep(.1)
        raise AssertionError(value.read_text() if value.exists() else 'timer did not run')
    wait_for('40')
    sim.exchange(['input='+b'\x1b[<0;31;11M\x1b[<32;65;11M\x1b[<0;65;11m'.hex()])
    wait_for('100')
    sim.stop();assert not work.exists()
    sim.start({'source':source,'cols':80,'rows':24})
    work=Path(sim.work.name);value=work/'tinydesk_fs/root/probe.txt';wait_for('40')
    # Exercise generated package-relative image loading, not just copying an
    # unused file. The board path intentionally has a directory absent here.
    image_project=json.loads(subprocess.check_output(['node','-e',r'''
const T=require('./core.js'),R=require('./resources.js'),d=T.initial(),c=T.widget('canvas','picture_canvas');
c.x=c.y=0;c.w=30;c.h=10;c.page='main';
c.paint=[{op:'image',...T.clone(T.Pixels.defaults.image),asset:{path:'/root/images/test.ppm',w:1,h:1,key:null,dither:false}}];
d.windows[0].widgets=[c];
R.storeImage(d,{name:'test.ppm',originalName:'test.ppm',data:Buffer.from('P6\n1 1\n255\n\0\0\0').toString('base64')});
process.stdout.write(JSON.stringify({source:T.generate(d,{bundle:true}),assets:d.assets,paths:[...R.required(d).values()]}));
'''],cwd=root,text=True))
    image_source=image_project['source']
    image_source=image_source.replace('\ntdui.run()',"\nwith open('/root/image_loaded.txt','w') as f: f.write('OK')\ntdui.run()")
    sim.start({**image_project,'source':image_source,'cols':80,'rows':24,'protocol':2})
    assert (Path(sim.work.name)/'tinydesk_fs/root/image_loaded.txt').read_text()=='OK'
    with tempfile.TemporaryDirectory(prefix='studio-external-') as directory:
        (Path(directory)/'test.ppm').write_bytes(base64.b64decode(asset['data']))
        sim.project_dirs=[Path(directory)]
        sim.start({**image_project,'source':image_source,'cols':80,'rows':24,
                   'assets':[{'name':'test.ppm','data':''}]})
        assert (Path(sim.work.name)/'tinydesk_fs/root/image_loaded.txt').read_text()=='OK'
        sim.stop()
    sim.project_dirs=[]
    for fields, message in (({'paths':['/root/images/missing.ppm']},'Missing simulation image: missing.ppm'),
                            ({'modules':['missing_controller']},'Missing simulation module: missing_controller')):
        try:sim.start({'source':image_source,'cols':80,'rows':24,**fields})
        except ValueError as error:assert message in str(error)
        else:raise AssertionError('Missing dependency accepted')
        assert sim.process is None
finally:sim.stop()
print('PASS: real simulation, timers, slider mouse input, package-relative image decoding, missing dependencies and isolated restart.')
