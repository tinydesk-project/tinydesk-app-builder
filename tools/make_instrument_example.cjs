const fs=require('node:fs'),path=require('node:path'),T=require('../core.js'),V=require('../version.js');
const d=T.initial();d.name='instrument_panel';d.board=32000;d.windows=[T.windowModel()];d.handlers={};const w=d.windows[0];Object.assign(w,{title:'Instrument panel',fullscreen:true,w:80,h:24});d.screen={w:80,h:24};
const c=T.widget('canvas','panel',0,0);Object.assign(c,{w:80,h:24,bg:17});w.widgets=[c];
c.paint=[{op:'rect',...T.Pixels.defaults.rect,x:0,y:0,w:160,h:48,color:17},
 {op:'put',x:2,y:1,text:'INSTRUMENT PANEL / SIMULATED',fg:231,bg:17},
 {op:'gauge',...T.Pixels.defaults.gauge,name:'level_gauge',x:4,y:8,w:44,h:32,value:40},
 {op:'slider',...T.Pixels.defaults.slider,name:'level_slider',x:30,y:9,w:35,h:3,value:40,on_change:'level_changed'},
 {op:'bar',...T.Pixels.defaults.bar,name:'level_meter',x:60,y:28,w:70,h:4,value:40,color:220,edge:228,track:237},
 {op:'put',name:'level_label',x:30,y:5,text:'OUTPUT: 40%',fg:231,bg:17},
 {op:'button',...T.Pixels.defaults.button,name:'reset_button',x:30,y:18,w:18,h:3,text:'Reset',on_click:'reset_level'}];
d.handlers={level_changed:{args:'slider',body:'value = slider.values["value"]\nlevel_gauge.set(value=value)\nlevel_meter.set(value=value)\nlevel_label.set(text="OUTPUT: %d%%" % value)'},reset_level:{args:'button',body:'level_slider.set(value=0)\nlevel_changed(level_slider)'}};
V.stamp(d);const check=T.validate(d);if(check.errors.length)throw Error(check.errors.join('\n'));
fs.writeFileSync(path.join(__dirname,'../examples/instrument_panel.json'),JSON.stringify(d,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'../examples/instrument_panel.py'),T.generate(d));
