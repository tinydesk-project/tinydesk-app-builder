'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('../core.js');
const original=T.parse(fs.readFileSync(__dirname+'/fixtures/pixel_controls.json','utf8'));
assert.deepEqual(T.validate(original).errors,[]);
assert.equal(T.usage(original).pixels,64*20*4+32*32); // one shared decoded image
const code=T.generate(original);
for(const op of new Set(original.windows.flatMap(w=>w.widgets.flatMap(o=>o.paint.map(p=>p.op)))))assert(code.includes('.'+op+'('),op);
assert.equal((code.match(/= tdui.Image.load/g)||[]).length,1);
assert(code.includes('with _td_batch():'));
assert(code.includes('if apply_button is None:'));
assert(code.includes('apply_button.draw()'));
assert(code.includes('bg=tdui.CLEAR'));
assert(code.includes('MAX_PIXELS'));
assert.deepEqual(T.parse(code),original);
assert.deepEqual(T.Pixels.textSize('12:3',2,true),{w:26,h:10});
assert.deepEqual(T.Pixels.textSize('A\nABC',1,false),{w:24,h:32});
function rejects(edit,pattern){const d=T.clone(original);edit(d);assert(T.validate(d).errors.some(e=>pattern.test(e)),JSON.stringify(T.validate(d)));}
rejects(d=>d.windows[0].widgets[0].paint[2].maximum=0,/maximum/);
rejects(d=>d.windows[0].widgets[0].paint[2].x=128,/bounds/);
rejects(d=>d.windows[0].widgets[0].paint[9].name='win',/Duplicate/);
rejects(d=>d.windows[0].widgets[0].paint[9].on_click='missing',/callback/);
rejects(d=>d.windows[0].widgets[0].paint[6].asset.w=4096,/Pixel budget/);
rejects(d=>d.windows[0].widgets[0].paint[7].src=[30,30,5,5],/sprite part/);
const masked=T.clone(original);for(const p of masked.windows[0].widgets[0].paint)if(p.asset)p.asset.key=[255,0,255];
assert.equal(T.usage(masked).pixels,64*20*4+2*32*32+4*16*3); // keyed picture background
const paged=T.clone(original),w=paged.windows[0],second=T.clone(w.widgets[0]);
w.pages.push({id:'second',name:'Second'});second.name=second.id='second_meter';second.page='second';
second.paint=second.paint.filter(p=>p.op!=='button');w.widgets.push(second);
assert.equal(T.usage(paged).pixels,2*64*20*4+32*32);
const bad=T.clone(original);bad.windows[0].widgets[0].paint[0].rgb1='bad';
assert.throws(()=>T.parse(JSON.stringify(bad)),/Invalid pixel/);
console.log('PASS: pixel operations, bounds, export, assets, masks, page budgets and malformed imports.');

const events=T.clone(original),btn=events.windows[0].widgets[0].paint[9];
for(const e of T.Pixels.buttonEvents){btn[e]='handle_'+e;events.handlers[btn[e]]={args:'button',body:'print("'+e+'")'};}
assert.deepEqual(T.validate(events).errors,[]);
for(const e of T.Pixels.buttonEvents){assert(T.generate(events).includes(e+'='+btn[e]));assert(T.handlerUsage(events).used.has(btn[e]));}
events.board=32000;
btn.asset={path:'/root/ui_skin.ppm',w:256,h:128,key:[255,0,255],dither:false};
btn.src=[0,0,64,64];btn.src_down=[64,0,64,64];btn.border=16;
assert.deepEqual(T.validate(events).errors,[]);
assert(T.generate(events).includes('sheet=_td_image_1'));
assert.equal(T.usage(events).pixels,T.usage(original).pixels+256*128*2+14*3*4);
btn.on_press=123;assert.throws(()=>T.parse(JSON.stringify(events)),/Invalid pixel/);
console.log('PASS: button lifecycle callbacks, skin export, background budgets and event imports.');
