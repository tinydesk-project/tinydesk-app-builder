/* Pure common-property and group-transform rules. Coordinates are cells. */
(function(root){
 'use strict';
 const skip=new Set(['id','name','op','type','x','y','w','h','x2','y2','r','page','events','paint','items','asset','sourceAsset','src','src_down','goToPage','opaquePicture','edgeSlices','binding']);
 const cells=p=>!p.op||['picture','button','slider','font_text','put','big','fill'].includes(p.op);
 const applicable=(p,key)=>!p.type||['fg','bg','visible'].includes(key)||key==='text'&&['label','button','checkbox','textbox'].includes(p.type)||key==='checked'&&p.type==='checkbox'||key==='secret'&&p.type==='textbox'||key==='value'&&p.type==='progress';
 const Pixels=typeof module!=='undefined'?require('./pixels.js'):root.TDPixels;
 const fontKinds=['put','big','draw_text','font_text','button','picture'];
 const supportsCorners=p=>['rect','bar','button','slider','gauge'].includes(p.op);
 const supportsTransparent=p=>['put','big','draw_text','font_text'].includes(p.op)||p.op==='picture'&&!!p.text;
 function properties(p){
  const out={...p};
  if(p.op&&Pixels.defaults[p.op])Object.assign(out,Pixels.defaults[p.op],p);
  if(supportsCorners(p)&&!Object.hasOwn(out,'radius'))out.radius=0;
  if(fontKinds.includes(p.op)&&!Object.hasOwn(out,'font'))out.font=null;
  return out;
 }
 function common(items){
  if(!items.length)return[];
  const values=items.map(properties);
  return [...new Set(values.flatMap(Object.keys))].filter(k=>!skip.has(k)&&!k.startsWith('on_')&&values.every(p=>applicable(p,k)&&Object.hasOwn(p,k)&&(k==='font'||typeof p[k]===typeof values[0][k]))&&(values[0][k]===null||typeof values[0][k]!=='object'||k==='font'||Array.isArray(values[0][k]))).map(key=>({key,value:values[0][key],mixed:values.some(p=>JSON.stringify(p[key])!==JSON.stringify(values[0][key]))}));
 }
 function bounds(items){return {x:Math.min(...items.map(b=>b.x)),y:Math.min(...items.map(b=>b.y)),w:Math.max(...items.map(b=>b.x+b.w))-Math.min(...items.map(b=>b.x)),h:Math.max(...items.map(b=>b.y+b.h))-Math.min(...items.map(b=>b.y))};}
 function transform(p,b,group,target,offset={x:0,y:0}){
  const out=JSON.parse(JSON.stringify(p)),u=cells(p)?1:2,sx=target.w/group.w,sy=target.h/group.h;
  const x=v=>Math.round((target.x+(v-group.x)*sx-offset.x)*u),y=v=>Math.round((target.y+(v-group.y)*sy-offset.y)*u);
  if(p.op==='line'){out.x=x(offset.x+p.x/2);out.y=y(offset.y+p.y/2);out.x2=x(offset.x+p.x2/2);out.y2=y(offset.y+p.y2/2);return out;}
  if(p.op==='circle'){out.x=x(offset.x+p.x/2);out.y=y(offset.y+p.y/2);out.r=Math.max(0,Math.round(p.r*Math.min(sx,sy)));return out;}
  out.x=x(b.x);out.y=y(b.y);
  if('w' in p)out.w=Math.max(1,Math.round(p.w*sx));
  if('h' in p)out.h=Math.max(1,Math.round(p.h*sy));
  if(['big','draw_text'].includes(p.op))out.scale=Math.max(1,Math.min(p.op==='big'?4:8,Math.round(p.scale*Math.min(sx,sy))));
  if('radius' in p)out.radius=Math.max(0,Math.round(p.radius*Math.min(sx,sy)));
  return out;
 }
 const api={common,bounds,transform,supportsCorners,supportsTransparent};if(typeof module!=='undefined')module.exports=api;else root.TDSelection=api;
})(typeof window!=='undefined'?window:globalThis);
