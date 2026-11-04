"""Check entry-page visibility and timed handoff in the real runtime."""
from pathlib import Path
import json,sys,subprocess,tempfile,base64
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from builder_helper import Simulation
with tempfile.TemporaryDirectory() as folder:
    project=Path(folder)/'project.json';source=Path(folder)/'app.py'
    script='''const TD=require('./core.js'),fs=require('fs');const d=TD.initial(),w=d.windows[0];
w.pages.push({id:'welcome',name:'Welcome'});
const label=TD.widget('label','welcome_label',2,2);label.page='welcome';label.text='WELCOME';w.widgets.push(label);
d.startup={mode:'custom',page:'welcome',durationMs:600,image:''};
w.events.on_ready='startup_probe';
d.handlers.startup_probe={args:'win',body:"import time\\ntime.sleep_ms(1100)\\nwith open('/root/entry.txt','w') as f:\\n    f.write(str(welcome_label.visible)+','+str(heading.visible))\\nwin.after(1000, final_probe)"};
d.handlers.final_probe={args:'',body:"with open('/root/final.txt','w') as f:\\n    f.write(str(welcome_label.visible)+','+str(heading.visible))"};
fs.writeFileSync(process.argv[1],JSON.stringify(d));'''
    subprocess.run(['node','-e',script,str(project)],cwd=root,check=True)
    subprocess.run(['node',str(root/'tools/export_project.cjs'),str(project),str(source)],check=True)
    sim=Simulation(max((root.parent/'tinydesk').glob('build*/tdsim.exe'),key=lambda p:p.stat().st_mtime))
    try:
        result=sim.start({'source':source.read_text(encoding='utf-8'),'cols':80,'rows':25})
        sim.exchange(['wait=1200'])
        files=Path(sim.work.name)/'tinydesk_fs/root'
        assert (files/'entry.txt').exists(),repr(base64.b64decode(result['output'])[-2500:])
        assert (files/'entry.txt').read_text()=='True,False'
        assert (files/'final.txt').read_text()=='False,True'
    finally:sim.stop()
print('PASS: custom page appears first, on_ready sees it, and timed handoff shows the normal page in real MicroPython.')


"""A hidden startup may take longer than the native frame-hold watchdog."""
from pathlib import Path
import subprocess, tempfile

root=Path(__file__).resolve().parents[1]
runtime=max((root.parent/'tinydesk').glob('build*/tdsim.exe'),key=lambda p:p.stat().st_mtime)
source=subprocess.check_output(['node','-e',"const T=require('./core.js'),d=T.initial();d.startup={mode:'custom',page:d.windows[0].initialPage,durationMs:0,image:''};process.stdout.write(T.generate(d,{embedDesign:false}));"],cwd=root).decode()
# Slow storage/initialization happens after the short create/minimize batch.
source=source.replace('# --- tdui-editor layout end ---', 'import time\ntime.sleep_ms(5500)\n# --- tdui-editor layout end ---')
source=source.replace('tdui.run()', "def finish():\n    with open('/root/startup-ok.txt','w') as f:\n        f.write('READY')\n    win.close()\nwin.after(100,finish)\ntdui.run()")
with tempfile.TemporaryDirectory(prefix='td-startup-') as work:
    fs=Path(work)/'tinydesk_fs/root';fs.mkdir(parents=True)
    (fs/'app.py').write_text(source,encoding='utf-8')
    p=subprocess.run([str(runtime),'size=80x24','auth=off','wait=500','key=Enter','wait=700',r'type=py -m 512 /root/app.py\r','wait=7000','save=output.bin'],cwd=work,capture_output=True,timeout=15,check=True)
    assert (fs/'startup-ok.txt').read_text()=='READY',p.stdout
    assert b'partial drawing released' not in (Path(work)/'output.bin').read_bytes()
print('PASS: 5.5-second hidden startup reaches its ready timer without a drawing-batch timeout.')
