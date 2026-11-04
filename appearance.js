/* Native-resolution image presets reuse the existing picture API. */
(function(root){
'use strict';
const clone=p=>JSON.parse(JSON.stringify(p));
const clearName='td_clear_text.ppm';
const clearResource={name:clearName,originalName:clearName,mime:'image/x-portable-pixmap',data:'UDYKMSAxCjI1NQr/AP8='};
function supportsTransparent(p){return ['put','big','draw_text','font_text'].includes(p.op)||p.op==='picture'&&!!p.text;}
function resourceFor(assets,source,preferred=source.name){
 const same=(assets||[]).find(a=>a.data&&a.data===source.data);if(same)return clone(same);
 let name=preferred,n=2;const dot=preferred.lastIndexOf('.'),stem=preferred.slice(0,dot),ext=preferred.slice(dot);
 while((assets||[]).some(a=>a.name===name))name=stem+'_'+(n++)+ext;
 return {...clone(source),name};
}
function textBackground(p,transparent,resourceName=clearName){
 const next=clone(p);
 if(p.op==='picture'){
  if(transparent){
   if(p.bg!==-2)next.opaquePicture={asset:clone(p.asset),src:p.src??null,border:p.border??0,...(p.edgeSlices?{edgeSlices:true}:{})};
   next.asset={path:'/root/'+resourceName,w:1,h:1,key:[255,0,255],dither:false};next.src=null;next.border=0;next.bg=-2;delete next.edgeSlices;
  }else if(next.opaquePicture){Object.assign(next,next.opaquePicture);delete next.opaquePicture;delete next.bg;}
 }else next.bg=transparent?-2:p.bg>=0?p.bg:25;
 return next;
}
function smoothPanel(p,resourceName='ui_skin.ppm'){
 const cells=p.op==='picture';const x=cells?p.x:Math.floor(p.x/2),y=cells?p.y:Math.floor(p.y/2);
 return {op:'picture',edgeSlices:true,name:p.name||'',x,y,w:cells?p.w:Math.max(1,Math.ceil((p.x+p.w)/2)-x),h:cells?p.h:Math.max(1,Math.ceil((p.y+p.h)/2)-y),
  text:p.text||'',fg:p.fg??231,scale:p.scale??0,border:16,src:[0,0,64,64],asset:{path:'/root/'+resourceName,w:256,h:128,key:[255,0,255],dither:false}};
}
const api={clearResource,resourceFor,supportsTransparent,textBackground,smoothPanel};if(typeof module!=='undefined')module.exports=api;else root.TDAppearance=api;
})(typeof window!=='undefined'?window:globalThis);
