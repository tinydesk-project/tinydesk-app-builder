'use strict';
const assert=require('node:assert/strict'),TD=require('../core.js'),C=require('../clipboard-model.js');
const d=TD.initial(),w=d.windows[0];d.board=32000;w.fullscreen=true;w.pages.push({id:'other',name:'Other'});
const cv=TD.widget('canvas','drawing',0,0);Object.assign(cv,{w:80,h:25,page:w.initialPage});w.widgets.push(cv);
const text={op:'put',name:'caption',x:2,y:3,text:'Count',fg:231,bg:-2};
const button={...TD.Pixels.defaults.button,op:'button',name:'action',x:4,y:6,w:12,h:3,text:'Apply',on_click:'clicked'};
cv.paint=[text,button];d.handlers.clicked={args:'button',body:'caption.set(text="Changed")\nhelper()'};d.handlers.helper={args:'',body:'pass'};
const items=cv.paint.map(p=>({kind:'paint',object:p,windowName:w.name,page:w.initialPage,bounds:{x:p.x,y:p.y,w:p.w||5,h:p.h||1},offset:{x:0,y:0}}));
const data=C.decode(C.encode(C.capture(d,items)));assert.equal(Object.keys(data.handlers).length,2);
let result=C.paste(d,data,{windowId:w.id,page:'other'},1),next=result.design;
const dest=next.windows[0].widgets.find(o=>o.type==='canvas'&&o.page==='other');assert(dest);assert.equal(dest.paint.length,2);
assert.equal(cv.paint.length,2,'Original project is immutable');assert.equal(dest.paint[0].bg,-2);assert.equal(dest.paint[0].x,2);assert.equal(dest.paint[0].y,3);
assert.notEqual(dest.paint[0].name,'caption');assert(next.handlers[dest.paint[1].on_click].body.includes(dest.paint[0].name+'.set('));
assert(!next.handlers[dest.paint[1].on_click].body.includes('\nhelper()'));assert.equal(d.handlers.clicked.body,'caption.set(text="Changed")\nhelper()');
assert.equal(TD.validate(next).errors.length,0);
result=C.paste(next,data,{windowId:w.id,page:'other',canvasId:dest.id},2);assert.notEqual(result.design.windows[0].widgets.find(o=>o.id===dest.id).paint[2].name,dest.paint[0].name);
// Pixel coordinates, circles and line endpoints keep their coordinate units.
const shapes=[{op:'line',x:2,y:4,x2:12,y2:10,color:231},{op:'circle',x:8,y:8,r:3,color:25,outline:false}];
const payload=C.capture(d,shapes.map(p=>({kind:'paint',object:p,windowName:w.name,page:w.initialPage,bounds:{x:1,y:1,w:8,h:6},offset:{x:0,y:0}})));
const shifted=C.paste(d,payload,{windowId:w.id,page:w.initialPage,canvasId:cv.id},1).design.windows[0].widgets.find(o=>o.id===cv.id).paint.slice(-2);
assert.deepEqual([shifted[0].x,shifted[0].y,shifted[0].x2,shifted[0].y2],[4,6,14,12]);assert.equal(shifted[1].x,10);assert.equal(shifted[1].r,3);
// Embedded artwork with a conflicting filename gets a new path, never replaces it.
const image={op:'picture',name:'art',x:1,y:1,w:4,h:2,text:'',fg:231,scale:0,border:0,src:null,asset:{path:'/root/logo.ppm',w:1,h:1,key:null,dither:false}};
d.assets=[{name:'logo.ppm',data:'QQ=='}];let art=C.capture(d,[{kind:'paint',object:image,windowName:w.name,bounds:{x:1,y:1,w:4,h:2},offset:{x:0,y:0}}]);
art.assets[0].data='Qg==';const withArt=C.paste(d,art,{windowId:w.id,page:w.initialPage,canvasId:cv.id}).design;
assert.equal(withArt.assets[0].data,'QQ==');assert.equal(withArt.assets.length,2);assert.equal(withArt.windows[0].widgets.find(o=>o.id===cv.id).paint.at(-1).asset.path,'/root/logo_copy1.ppm');
// A complete native widget/canvas clone has unique nested names and target page.
const whole=C.capture(d,[{kind:'widget',object:cv,windowName:w.name,bounds:{x:0,y:0,w:80,h:25},offset:{x:0,y:0}}]);
const clone=C.paste(d,whole,{windowId:w.id,page:'other'}).design.windows[0].widgets.at(-1);assert.equal(clone.page,'other');assert.notEqual(clone.id,cv.id);assert.notEqual(clone.paint[0].name,text.name);
assert.equal(C.decode('ordinary text'),null);
const quoted=TD.clone(data);quoted.handlers.clicked.body='caption.set(text="caption") # caption';
const q=C.paste(d,quoted,{windowId:w.id,page:'other'});
assert(q.design.handlers[q.design.windows[0].widgets.at(-1).paint[1].on_click].body.endsWith('text="caption") # caption'));
assert.throws(()=>C.decode('TinyDesk elements v1\n{"__proto__":{}}'),/Unsafe/);
assert.throws(()=>C.paste(d,data,{windowId:'missing',page:'other'}),/destination/);
const tooBig=TD.clone(data);tooBig.items[0].bounds.w=999;assert.throws(()=>C.paste(d,tooBig,{windowId:w.id,page:'other'}),/does not fit/);
console.log('PASS: element/group clipboard, unique names, callback closure/remapping, resources, pages, coordinates, canvas clones, immutable failure and unsafe input.');
