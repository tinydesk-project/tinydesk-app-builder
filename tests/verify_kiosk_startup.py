"""A kiosk loading picture must disappear once an application owns the screen."""
from pathlib import Path
import os,subprocess,tempfile,re
root=Path(__file__).resolve().parents[1]
runtime=max((root.parent/'tinydesk').glob('build*/tdsim.exe'),key=lambda p:p.stat().st_mtime)
with tempfile.TemporaryDirectory(prefix='kiosk-transition-') as tmp:
    files=Path(tmp)/'tinydesk_fs/root';files.mkdir(parents=True)
    (files/'logo.ppm').write_bytes(b'P6\n10 20\n255\n'+bytes([255,0,0])*200)
    (files/'app.py').write_text('''import tdui, time
with tdui.batch():
    time.sleep_ms(1100) # Deliberately exceed the ordinary 1 s drawing limit.
    win=tdui.Window('Startup handoff',80,24)
    win.fullscreen()
    canvas=win.canvas(0,0,80,24)
    canvas.fill(0,0,80,24,' ',231,17)
tdui.run()
''')
    env={**os.environ,'TINYDESK_KIOSK':'/root/app.py','TINYDESK_KIOSK_SPLASH':'/root/logo.ppm','TINYDESK_KIOSK_HIDE_STATUS':'1'}
    result=subprocess.run([str(runtime),'size=80x24','sixel=10x20','wait=1000','save=before.bin','wait=3000','save=after.bin'],cwd=tmp,env=env,capture_output=True,timeout=12,check=True)
    before=(Path(tmp)/'before.bin').read_bytes();after=(Path(tmp)/'after.bin').read_bytes()[len(before):]
    assert b'q"1;1;10;20' in before,'Loading logo missing'
    assert b'q"1;1;10;20' not in after,'Loading logo painted over application'
    assert b'Traceback' not in after
    assert re.search(rb'\x1b\[[0-9;]*48;5;17m',after),'App did not paint its blue background: '+repr(after[-1000:])
print('PASS: loading logo appears before launch and is absent from app frames; first-window construction is batched.')
