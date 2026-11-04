"""The kiosk splash and an RGB app must show the same unquantized color."""
from pathlib import Path
import os,subprocess,tempfile
root=Path(__file__).resolve().parents[1]
runtime=max((root.parent/'tinydesk').glob('build*/tdsim_lcd.exe'),key=lambda p:p.stat().st_mtime)
with tempfile.TemporaryDirectory(prefix='kiosk-colors-') as folder:
    work=Path(folder);fs=work/'tinydesk_fs/root';fs.mkdir(parents=True)
    (fs/'splash.ppm').write_bytes(b'P6\n32 16\n255\n'+bytes((237,18,22))*32*16)
    (fs/'app.py').write_text('''import time, tdui
time.sleep_ms(1000)
tdui.enable_rgb_pictures()
with tdui.batch():
    win = tdui.Window('RGB kiosk test', 80, 24)
    win.fullscreen()
    cv = win.canvas(0, 0, 80, 24)
    cv.fill(0, 0, 80, 24, ' ', 231, 0)
    image = tdui.Image.load('/root/splash.ppm', dither=False)
    cv.picture(image, 38, 11, 4, 1)
tdui.run()
''',encoding='utf-8')
    env={**os.environ,'TINYDESK_KIOSK':'/root/app.py','TINYDESK_KIOSK_SPLASH':'/root/splash.ppm','TINYDESK_KIOSK_HIDE_STATUS':'1'}
    result=subprocess.run([str(runtime),'size=80x24','sixel=10x20','auth=off','wait=500','lcdshot=splash.ppm','wait=4500','lcdshot=app.ppm','save=terminal.bin'],cwd=work,env=env,capture_output=True,timeout=15,check=True)
    def pixel(name):
        data=(work/name).read_bytes().split(b'\n',3)[3];at=(230*800+400)*3;return tuple(data[at:at+3])
    assert pixel('splash.ppm')==pixel('app.ppm')==(239,16,16),(pixel('splash.ppm'),pixel('app.ppm'))
    assert b'Traceback' not in (work/'terminal.bin').read_bytes(),result.stdout[-3000:]
print('PASS: kiosk-to-app color is identical RGB565, including the non-palette red channel.')
