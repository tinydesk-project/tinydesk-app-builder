'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('../core.js'),C=require('../communications.js');
const d=T.initial(),w=d.windows[0];w.fullscreen=true;d.board=32000;
w.widgets=[Object.assign(T.widget('label','reading',2,2),{binding:{...C.bindingDefaults,initial:25,suffix:' C',decimals:1}}),T.widget('label','connection',2,3),Object.assign(T.widget('button','setpoint',2,5),{binding:{...C.bindingDefaults,direction:'write',action:'constant',writeValue:30}})];
for(const mode of C.modes){d.communication={...C.defaults,mode,tx:17,rx:18,statusElement:'connection'};assert.deepEqual(T.validate(d).errors,[]);const code=T.generate(d);assert.equal(code.includes('class _TDLink:'),mode!=='none');assert.deepEqual(T.parse(code),d);if(mode!=='none'){assert(code.includes('_td_link.bind(reading,'));assert(code.includes('simulated=False'));assert(T.generate(d,{simulation:true}).includes('simulated=True'));}}
assert.equal(C.preamble(d),fs.readFileSync(__dirname+'/../runtime/communication.py','utf8'));
d.communication.tx=d.communication.rx;assert(T.validate(d).errors.some(s=>s.includes('TX/RX')));d.communication.tx=17;
d.communication.codec='custom';d.communication.codecModule='my_codec';assert(T.validate(d).errors.some(s=>s.includes('Declare')));d.modules=['my_codec'];assert.deepEqual(T.validate(d).errors,[]);
assert.deepEqual(C.simulationModules(d),[]);d.handlers.codec_helper={args:'',body:'my_codec.decode(b"test")'};assert.deepEqual(C.simulationModules(d),['my_codec']);delete d.handlers.codec_helper;
w.widgets[2].binding.table='ir';assert(T.validate(d).errors.some(s=>s.includes('read-only')));w.widgets[2].binding.table='hr';
w.widgets[0].binding.gain=0;assert(T.validate(d).errors.some(s=>s.includes('scale')));w.widgets[0].binding.gain=1;
d.communication.statusElement='reading';assert(T.validate(d).errors.some(s=>s.includes('unbound text')));d.communication.statusElement='connection';
w.widgets[0].binding.initial=-1;assert(T.validate(d).errors.some(s=>s.includes('initial value')));w.widgets[0].binding.initial=25;
w.widgets[0].binding.prefix='true null false';assert(C.setup(d).join('\n').includes('true null false'));
const bad=T.clone(d);bad.communication.statusElement='x);exec("bad")';assert(T.validate(bad).errors.some(s=>s.includes('unbound text')));
console.log('PASS: versioned serial modes, named bindings, isolated simulation, zero-cost None, export/import, validation and exact bundled runtime.');
