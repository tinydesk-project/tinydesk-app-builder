"""Exercise generated pixels and the current Python API, not a replacement API."""
import importlib.util
import sys
from pathlib import Path
import verify_export as base

board = base.Board(32000)
transport = sys.modules['_tdui']
images = []
transport.image_load = lambda ident, path, key, dither, w, h: (images.append((ident, path, key, dither, w, h)) or (w, h))
spec = importlib.util.spec_from_file_location('tdui', base.SOURCE)
api = importlib.util.module_from_spec(spec)
sys.modules['tdui'] = api
spec.loader.exec_module(api)
base.install_tdapp()
assert api.render_cache(64) is None, 'Optional cache must tolerate an older native module'
assert api.render_cache_info() == (0,) * 12
assert api.scanout_info() == (0,) * 8
assert api.scanout_timing() == (0,) * 4
transport.scanout_timing=lambda:(1,2,3,4)
assert api.scanout_timing()==(1,2,3,4)
del transport.scanout_timing
transport.scanout_info=lambda:tuple(range(8))
assert api.scanout_info()==tuple(range(8))
del transport.scanout_info
cache_calls=[]
transport.render_cache=lambda kb,warm:cache_calls.append((kb,warm))
api.render_cache(0,False);assert cache_calls==[(0,False)]
del transport.render_cache
api.run = lambda: None
scope = {}
source = (base.FIXTURES / 'pixel_controls.py').read_text(encoding='utf-8')
exec(compile(source, 'pixel_controls.py', 'exec'), scope)
cv, button = scope['meter'], scope['apply_button']
assert len(images) == 1
assert len(cv._buttons) == 1
assert {24,25,26,27,28,29,30,31,32,33} <= {r[0] for r in board.requests}
depth = 0
for r in board.requests:
    depth += (r[0] == 31) - (r[0] == 32)
    assert depth >= 0
assert depth == 0
for _ in range(100):
    scope['_td_paint_meter']()
    scope['show_page']('Main')
assert len(cv._buttons) == 1 and scope['apply_button'] is button and len(images) == 1
board.requests.clear()
cv.bar(0,0,20,4,50,edge=120)
colors = cv._bar_colors
for i in range(100):
    cv.bar(0,0,20,4,i,edge=120)
assert cv._bar_colors is colors, 'unchanged style must not allocate each update'
assert len(board.requests) == 101 and all(r[0] == 33 for r in board.requests)
for value, amount in ((-5,0),(150,1000)):
    cv.bar(0,0,20,4,value)
    assert board.requests[-1][8] == amount
try:
    with cv.batch():
        with cv.batch():
            raise ValueError('test')
except ValueError:
    pass
assert [r[0] for r in board.requests[-4:]] == [31,31,32,32]
assert cv.batch() is api.batch(), 'batch contexts are reused'
assert api.text_size('12:3',2,True) == (26,10)

# Two buttons at the same coordinates on different pages. A hidden button
# must not steal the click or draw its label into the current draw page.
w = api.Window('Pages',20,10)
c = w.canvas(0,0,20,8,pages=2)
hits = []
b0 = c.button(0,0,8,3,'First',lambda b:hits.append(0),color=25,down=18)
c.draw_to(1)
b1 = c.button(0,0,8,3,'Second',lambda b:hits.append(1),color=25,down=18)
c.show(1)
c._event(api._EV_MOUSE,2,1,0,0,None)
c._event(api._EV_MOUSE,2,1,0,1,None)
assert hits == [1]
b0.text = 'Hidden'
assert c.drawing == 1 and c.showing == 1
assert len(c._buttons) == 2
assert [r[0] for r in board.requests[-1:]] == [32]
print('PASS: generated pixel calls, one-time images/buttons, cached styles, batch exceptions and page clicks.')

# Press/release are separate from click, including release outside and removal.
events = []
b1.on_press = lambda b: events.append('press')
b1.on_release = lambda b: events.append('release')
b1.on_cancel = lambda b: events.append('cancel')
b1.on_click = lambda b: events.append('click')
for xy, expected in (((2,1), ['press','release','click']), ((19,7), ['press','release','cancel'])):
    events.clear()
    c._event(api._EV_MOUSE,2,1,0,0,None)
    c._event(api._EV_MOUSE,2,1,1,1,None) # a different mouse button must not release
    assert events == ['press'] and c._held is b1
    c._event(api._EV_MOUSE,*xy,0,1,None)
    assert events == expected and c._held is None
b1.enabled = False
events.clear()
c._event(api._EV_MOUSE,2,1,0,0,None)
assert not events
b1.enabled = True
c._event(api._EV_MOUSE,2,1,0,0,None)
b1.remove()
assert events == ['press','cancel'] and c._held is None
print('PASS: press, release, click, outside cancellation, disabled and removed controls.')

# Text updates inside press handlers retain the down appearance.
c.show(1)
b2 = c.button(0,0,8,3,'Hold',color=25,down=18)
b2.on_press = lambda b: setattr(b, 'text', 'Pressed')
board.requests.clear()
c._event(api._EV_MOUSE,2,1,0,0,None)
rects = [r for r in board.requests if r[0] == api._RECT]
assert len(rects) >= 2 and all(r[8] == 18 for r in rects)
c._event(api._EV_MOUSE,2,1,0,1,None)
print('PASS: label changes retain pressed appearance.')

# New image-backed text/panels must execute against tdui's real signatures:
# editor-only restoration metadata must never leak into Canvas.picture kwargs.
import subprocess
generated = subprocess.check_output(['node', '-e', r'''
const T=require('./core.js'), A=require('./appearance.js'), d=T.initial();
d.board=32000;d.windows[0].fullscreen=true;
const c=T.widget('canvas','appearance_canvas',0,0);Object.assign(c,{w:40,h:15});
const panel=A.smoothPanel({op:'rect',name:'smooth_panel',x:0,y:0,w:80,h:20});
const label=A.textBackground({...panel,name:'clear_label',x:3,y:3,w:25,h:2,text:'Transparent'},true);
c.paint=[panel,label];d.windows[0].widgets=[c];
process.stdout.write(T.generate(d,{embedDesign:false}));
'''], cwd=base.ROOT, text=True, encoding='utf-8')
board.requests.clear()
appearance = {}
exec(compile(generated, 'appearance.py', 'exec'), appearance)
picture_requests = [r for r in board.requests if r[0] == api._PICTURE]
assert len(picture_requests) == 10, 'Nine panel pieces and one clear label'
assert {(r[4], r[5]) for r in picture_requests[:9]} == {(x,y) for x in (0,2,38) for y in (0,1,9)}
assert picture_requests[-1][10][10:] == b'Transparent'
appearance['clear_label'].set(text='Updated')
assert board.requests[-2][10][10:] == b'Updated'
appearance['smooth_panel'].set(w=4, h=2)
assert len([r for r in board.requests if r[0] == api._PICTURE]) == 12, 'Small panels safely fall back to one image'
print('PASS: smooth panel edge pieces, clear image-backed label updates, real tdui signatures and small-panel fallback.')

