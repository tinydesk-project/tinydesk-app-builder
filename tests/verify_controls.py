"""Verify generated controls against the real tdui event dispatcher."""
import importlib.util
import subprocess
import sys
import verify_export as base
board=base.Board(32000)
api_spec=importlib.util.spec_from_file_location('tdui',base.SOURCE)
api=importlib.util.module_from_spec(api_spec);sys.modules['tdui']=api;api_spec.loader.exec_module(api);api.run=lambda:None
scope={};source=(base.ROOT/'examples/instrument_panel.py').read_text(encoding='utf-8');exec(compile(source,'instrument_panel.py','exec'),scope)
cv=scope['panel'];slider=scope['level_slider']
cv._event(api._EV_MOUSE,30,10,0,0,None)
cv._event(api._EV_MOUSE,64,10,0,2,None)
cv._event(api._EV_MOUSE,64,10,0,1,None)
assert slider.values['value']==100
assert scope['level_gauge'].values['value']==100
assert scope['level_meter'].values['value']==100
assert scope['level_label'].values['text']=='OUTPUT: 100%'
slider.enabled=False
cv._event(api._EV_MOUSE,30,10,0,0,None)
cv._event(api._EV_MOUSE,30,10,0,1,None)
assert slider.values['value']==100
scope['reset_level'](None)
assert slider.values['value']==0
# One field update is one batch: no frame can show it half drawn.
for name,value in (('level_gauge',42),('level_slider',57),('level_meter',13)):
    start=len(board.requests)
    scope[name].set(value=value)
    sent=[r[0] for r in board.requests[start:]]
    depth=0
    for i,op in enumerate(sent):   # one outer batch from the first request to the last
        depth+=(op==31)-(op==32)
        assert depth>0 or i==len(sent)-1,(name,sent)
    assert len(sent)>2 and sent[0]==31 and depth==0,(name,sent)
    start=len(board.requests);scope[name].set(value=value)
    assert len(board.requests)==start,'An unchanged value must send nothing'
depth=0
for request in board.requests:
    depth+=(request[0]==31)-(request[0]==32)
    assert depth>=0
assert depth==0
print('PASS: real slider drag/release, disabled behavior, gauge/meter/text binding, reset and balanced batches.')

# Exercise freshly generated optional appearance fields through real tdui,
# rather than only checking that the JSON/export strings contain them.
generated=subprocess.check_output(['node','-e',r'''
const fs=require('fs'),path=require('path'),root=process.argv[1],T=require(path.join(root,'core.js'));
const d=T.parse(fs.readFileSync(path.join(root,'examples/instrument_panel.json'),'utf8'));
for(const w of d.windows)for(const cv of w.widgets)for(const p of cv.paint||[])
 if(['slider','gauge'].includes(p.op)){p.radius=3;p.gradient={rgb1:[32,128,240],rgb2:[0,32,96],across:true};}
process.stdout.write(T.generate(d));
''',str(base.ROOT)],text=True,encoding='utf-8')
rounded={};exec(compile(generated,'rounded_controls.py','exec'),rounded)
for name in ('level_slider','level_gauge'):
    assert rounded[name].values['radius']==3
    rounded[name].set(value=88)
    assert rounded[name].values['value']==88
print('PASS: newly generated rounded/gradient slider and gauge updates execute through the actual tdui API.')
