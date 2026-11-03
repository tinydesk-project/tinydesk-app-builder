'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('../core.js');
const d=T.parse(fs.readFileSync(__dirname+'/fixtures/pixel_controls.json','utf8'));
const shapes=d.windows[0].widgets[0].paint.filter(p=>['rect','circle','bar','button'].includes(p.op));
assert(shapes.length>=4);
for(const p of shapes)p.gradient={rgb1:[0,180,255],rgb2:[0,32,96],across:false};
assert.deepEqual(T.validate(d).errors,[]);
const code=T.generate(d);assert(code.includes('SUPPORTS_GRADIENT_FILLS'));assert(code.includes('gradient='));assert.deepEqual(T.parse(code),d);
for(const p of shapes){const old=p.gradient;p.gradient={...old,rgb1:[-1,5,6]};assert(!T.Pixels.shapeValid(p));p.gradient=old;}
const controls=T.parse(fs.readFileSync(__dirname+'/../examples/instrument_panel.json','utf8'));
for(const w of controls.windows)for(const cv of w.widgets)for(const p of cv.paint||[])if(['slider','gauge'].includes(p.op)){p.radius=3;p.gradient={rgb1:[32,128,240],rgb2:[0,32,96],across:true};}
assert.deepEqual(T.validate(controls).errors,[]);
const rounded=T.generate(controls);assert(rounded.includes('"radius": 3'));assert(rounded.includes('bg, radius=radius, gradient=gradient'));assert(rounded.includes('track, radius=radius, gradient=gradient'));
assert.deepEqual(T.parse(rounded),controls);
console.log('PASS: gradient shape validation, firmware capability check and lossless export/import.');
