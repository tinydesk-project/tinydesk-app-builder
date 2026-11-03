'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('../core.js');
const d=T.parse(fs.readFileSync(__dirname+'/fixtures/pixel_controls.json','utf8'));
const shapes=d.windows[0].widgets[0].paint.filter(p=>['rect','circle','bar','button'].includes(p.op));
assert(shapes.length>=4);
for(const p of shapes)p.gradient={rgb1:[0,180,255],rgb2:[0,32,96],across:false};
assert.deepEqual(T.validate(d).errors,[]);
const code=T.generate(d);assert(code.includes('SUPPORTS_GRADIENT_FILLS'));assert(code.includes('gradient='));assert.deepEqual(T.parse(code),d);
for(const p of shapes){const old=p.gradient;p.gradient={...old,rgb1:[-1,5,6]};assert(!T.Pixels.shapeValid(p));p.gradient=old;}
console.log('PASS: gradient shape validation, firmware capability check and lossless export/import.');
