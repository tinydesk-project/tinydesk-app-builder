/* Element clipboard data is parsed as data, never executed. */
(function(root){
'use strict';
const TD=typeof module!=='undefined'?require('./core.js'):root.TD;
const prefix='TinyDesk elements v1\n';
function guard(v){if(v&&typeof v==='object')for(const k of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Unsafe clipboard property.');guard(v[k]);}}
function capture(d,items){
 if(!items.length)throw Error('Select an element or group first.');
 const handlers={},wanted=new Set(),assets=new Set();
 function scan(v){if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if(k==='events')Object.values(x).forEach(n=>wanted.add(n));else if(k.startsWith('on_')&&typeof x==='string'&&x)wanted.add(x);if((k==='path'||k==='sourceAsset')&&typeof x==='string')assets.add(x.split('/').pop());scan(x);}}
 for(const i of items)scan(i.object);
 for(const n of wanted){if(!Object.hasOwn(d.handlers,n))continue;handlers[n]=TD.clone(d.handlers[n]);for(const token of d.handlers[n].body.match(/[A-Za-z_]\w*/g)||[])if(Object.hasOwn(d.handlers,token))wanted.add(token);}
 return {format:'tinydesk-elements',version:1,windowName:items[0].windowName,page:items[0].page??items[0].object.page??null,
  items:TD.clone(items),handlers,assets:TD.clone((d.assets||[]).filter(a=>assets.has(a.name))),
  modules:TD.clone(d.modules||[]),binaryDependencies:TD.clone(d.binaryDependencies||[])};
}
function encode(data){return prefix+JSON.stringify(data);}
function decode(text){
 if(typeof text!=='string'||!text.startsWith(prefix))return null;
 if(text.length>16*1024*1024)throw Error('Element clipboard exceeds 16 MiB.');
 const data=JSON.parse(text.slice(prefix.length));guard(data);
 if(data.format!=='tinydesk-elements'||data.version!==1||!Array.isArray(data.items)||!data.items.length||data.items.length>2000||!data.handlers||!Array.isArray(data.assets)||!Array.isArray(data.modules)||!Array.isArray(data.binaryDependencies))throw Error('Invalid element clipboard.');
 for(const i of data.items)if(!['paint','widget'].includes(i.kind)||!i.object||![i.bounds?.x,i.bounds?.y,i.bounds?.w,i.bounds?.h,i.offset?.x,i.offset?.y].every(Number.isFinite)||i.bounds.w<=0||i.bounds.h<=0)throw Error('Invalid clipboard geometry.');
 return data;
}
function paste(original,data,target,step=1){
 data=decode(encode(data));const d=TD.clone(original),w=d.windows.find(w=>w.id===target.windowId);
 if(!w||!w.pages.some(p=>p.id===target.page))throw Error('Choose a destination page.');
 const used=new Set(d.windows.flatMap(w=>[w.name,w.id,...w.widgets.flatMap(o=>[o.name,o.id,...o.paint.map(p=>p.name).filter(Boolean)])]).concat(Object.keys(d.handlers)));
 function unique(name){const stem=String(name||'element').replace(/[^A-Za-z0-9_]/g,'_').slice(0,24)||'element';let n=1,value;do{value=stem+'_copy'+n++;}while(used.has(value));used.add(value);return value;}
 const map=new Map(),copied=TD.clone(data.items);
 for(const i of copied){const objects=i.kind==='widget'?[i.object,...(i.object.paint||[])]:[i.object];for(const p of objects){if(p.name){const next=unique(p.name);map.set(p.name,next);p.name=next;}if(p.id)p.id=p.name||unique(p.id);}}
 const handlerMap=new Map(Object.keys(data.handlers).map(n=>[n,unique(n)]));
 const remap=new Map([...map,...handlerMap]);if(data.windowName)remap.set(data.windowName,w.name);
 function references(v){if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if(k==='events'){for(const ev of Object.keys(x))if(handlerMap.has(x[ev]))x[ev]=handlerMap.get(x[ev]);}else if(k.startsWith('on_')&&handlerMap.has(x))v[k]=handlerMap.get(x);references(x);}}
 for(const i of copied)references(i.object);
 for(const[n,h]of Object.entries(data.handlers)){
  const body=h.body.replace(/'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|#[^\n]*|\b[A-Za-z_]\w*\b/g,n=>remap.get(n)||n);
  d.handlers[handlerMap.get(n)]={args:h.args,body};
 }
 const paths=new Map();d.assets=d.assets||[];
 for(const a of data.assets){
  let name=a.name;const old=d.assets.find(x=>x.name===name);
  if(old&&old.data&&a.data&&old.data!==a.data){const dot=name.lastIndexOf('.'),stem=dot<0?name:name.slice(0,dot),ext=dot<0?'':name.slice(dot);let n=1;do{name=stem.slice(0,45)+'_copy'+(n++)+ext;}while(d.assets.some(x=>x.name===name));paths.set(a.name,name);}
  if(!d.assets.some(x=>x.name===name))d.assets.push({...a,name});
 }
 function resources(v){if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if((k==='path'||k==='sourceAsset')&&typeof x==='string'){const name=x.split('/').pop();if(paths.has(name))v[k]=x.slice(0,x.length-name.length)+paths.get(name);}resources(x);}}
 for(const i of copied)resources(i.object);
 d.modules=[...new Set([...(d.modules||[]),...data.modules])];d.binaryDependencies=d.binaryDependencies||[];
 for(const b of data.binaryDependencies){const old=d.binaryDependencies.find(x=>x.name===b.name);if(old&&old.data&&b.data&&old.data!==b.data)throw Error('A different '+b.name+' module already exists in this project.');if(!old)d.binaryDependencies.push(TD.clone(b));}
 let cv=w.widgets.find(o=>o.id===target.canvasId&&o.type==='canvas'&&o.page===target.page);
 if(copied.some(i=>i.kind==='paint')&&!cv){cv=TD.widget('canvas',unique('canvas'),0,0);Object.assign(cv,TD.sizeOf(w,d),{page:target.page});w.widgets.push(cv);}
 const group={x:Math.min(...copied.map(i=>i.bounds.x)),y:Math.min(...copied.map(i=>i.bounds.y))};
 group.w=Math.max(...copied.map(i=>i.bounds.x+i.bounds.w))-group.x;group.h=Math.max(...copied.map(i=>i.bounds.y+i.bounds.h))-group.y;
 const onlyPaint=copied.every(i=>i.kind==='paint'),area=onlyPaint?TD.rect(cv,w,d):{x:0,y:0,...TD.sizeOf(w,d)};
 if(group.w>area.w||group.h>area.h)throw Error('The copied group does not fit this destination. Choose a larger canvas or page.');
 const offset=data.windowName===w.name&&data.page===target.page?step:0;
 const dx=Math.max(area.x-group.x,Math.min(area.x+area.w-group.x-group.w,offset)),dy=Math.max(area.y-group.y,Math.min(area.y+area.h-group.y-group.h,offset));
 const refs=[];
 for(const i of copied){const p=i.object;
  if(i.kind==='widget'){
   p.x=i.bounds.x+dx;p.y=i.bounds.y+dy;p.page=target.page;
   if(p.goToPage&&!w.pages.some(x=>x.id===p.goToPage))p.goToPage=null;
   w.widgets.push(p);refs.push({widgetId:p.id});
  }else{
   const r=TD.rect(cv,w,d),u=TD.Pixels.cellUnits(p)||['put','big','fill'].includes(p.op)?1:2;
   const tx=Math.round((i.offset.x+dx-r.x)*u),ty=Math.round((i.offset.y+dy-r.y)*u);
   p.x+=tx;p.y+=ty;if(p.op==='line'){p.x2+=tx;p.y2+=ty;}
   cv.paint.push(p);refs.push({widgetId:cv.id,index:cv.paint.length-1});
  }
 }
 const result=TD.validate(d);if(result.errors.length)throw Error(result.errors[0]);
 return {design:d,refs};
}
const api={capture,encode,decode,paste};if(typeof module!=='undefined')module.exports=api;else root.TDClipboard=api;
})(typeof window!=='undefined'?window:globalThis);
