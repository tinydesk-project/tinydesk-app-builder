"""Verify generated controls against the real tdui event dispatcher."""
import importlib.util
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
depth=0
for request in board.requests:
    depth+=(request[0]==31)-(request[0]==32)
    assert depth>=0
assert depth==0
print('PASS: real slider drag/release, disabled behavior, gauge/meter/text binding, reset and balanced batches.')
