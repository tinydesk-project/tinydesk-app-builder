/* Canvas layers are editable elements, with their own hit targets and outline. */
'use strict';
let drawingSelection=null;
let lastInspectedElement=null;
const elementInspectorBase=renderInspector;
renderInspector=function(){
 const {obj}=current();
 if(drawingSelection?.id===selected&&obj.type==='canvas'&&obj.paint[drawingSelection.index]){
  const key=selected+':'+drawingSelection.index;editPixel(drawingSelection.index);
  if(key!==lastInspectedElement){const root=document.querySelector('#inspector');root.scrollTop=0;root.parentElement.scrollTop=0;document.querySelector('#rightPanel').scrollTop=0;}
  lastInspectedElement=key;return;
 }
 drawingSelection=null;lastInspectedElement=null;document.querySelector('.inspector-tabs').hidden=false;elementInspectorBase();
};
document.querySelector('#layers').addEventListener('click',e=>{if(e.target.closest('[data-id]'))drawingSelection=null;},true);
function drawingBounds(p){
 const cells=['picture','button','slider','font_text','big','put','fill'].includes(p.op),k=cells?1:.5;
 if(p.op==='big'){const b=TD.bigLayout(p.text,p.scale,p.width);return{x:p.x,y:p.y,w:b.w,h:b.h};}
 if(p.op==='put')return{x:p.x,y:p.y,w:Array.from(p.text).length,h:1};
 if(p.op==='circle')return{x:(p.x-p.r)*k,y:(p.y-p.r)*k,w:(2*p.r+1)*k,h:(2*p.r+1)*k};
 if(p.op==='line')return{x:Math.min(p.x,p.x2)*k,y:Math.min(p.y,p.y2)*k,w:(Math.abs(p.x2-p.x)+1)*k,h:(Math.abs(p.y2-p.y)+1)*k};
 if(p.op==='draw_text'){const b=TD.Pixels.textSize(p.text,p.scale,p.small);return{x:p.x*k,y:p.y*k,w:b.w*k,h:b.h*k};}
 return{x:p.x*k,y:p.y*k,w:(p.w||1)*k,h:(p.h||1)*k};
}
const renderElementsBase=renderLayers;
renderLayers=function(){
 renderElementsBase();
 for(const win of design.windows)for(const cv of win.widgets.filter(o=>o.type==='canvas')){
  const parent=document.querySelector('#layers [data-id="'+CSS.escape(cv.id)+'"]');if(!parent)continue;
  const group=document.createElement('details');group.open=cv.id===selected||cv.page===activePage(win);const summary=document.createElement('summary');summary.textContent=cv.paint.length+' elements';group.append(summary);
  const list=document.createElement('div');list.className='drawing-outline';
  cv.paint.forEach((p,index)=>{
   const b=document.createElement('button');b.textContent='↳ '+(p.name||p.text||p.op).slice(0,48);b.title=p.op+' · '+p.x+', '+p.y;
   b.onclick=e=>{e.stopPropagation();selected=cv.id;drawingSelection={id:cv.id,index};pageViews.set(win.id,cv.page);render();};list.append(b);
  });group.append(list);parent.after(group);
 }
};
canvas.ondblclick=e=>{
 const p=point(e,true),l=hit(p);if(!l||l.obj.type!=='canvas')return;
 const x=p.x-l.r.x,y=p.y-l.r.y;
 for(let i=l.obj.paint.length-1;i>=0;i--){const b=drawingBounds(l.obj.paint[i]);if(x>=b.x&&y>=b.y&&x<b.x+b.w&&y<b.y+b.h){selected=l.obj.id;render();editPixel(i);break;}}
};
const elementDrawBase=draw;
draw=function(){
 elementDrawBase();if(!drawingSelection||drawingSelection.id!==selected)return;
 const item=layout.find(l=>l.obj.id===drawingSelection.id);const p=item?.obj.paint[drawingSelection.index];if(!p)return;
 const b=drawingBounds(p);ctx.save();ctx.strokeStyle='#ffe080';ctx.lineWidth=2;ctx.setLineDash([4,2]);ctx.strokeRect((item.r.x+b.x)*10,(item.r.y+b.y)*20,b.w*10,b.h*20);
 ctx.setLineDash([]);ctx.fillStyle='#ffe080';const size=7*canvas.width/canvas.getBoundingClientRect().width;
 for(const h of TDGeometry.handles(p,b))ctx.fillRect((item.r.x+h.x)*10-size/2,(item.r.y+h.y)*20-size/2,size,size);ctx.restore();
};
function elementHandle(point){
 if(!drawingSelection||drawingSelection.id!==selected)return null;
 const item=layout.find(l=>l.obj.id===selected),p=item?.obj.paint[drawingSelection.index];if(!p)return null;
 const rect=canvas.getBoundingClientRect(),tx=7*design.screen.w/rect.width,ty=7*design.screen.h/rect.height;
 return TDGeometry.handles(p,drawingBounds(p)).find(h=>Math.abs(point.x-item.r.x-h.x)<=tx&&Math.abs(point.y-item.r.y-h.y)<=ty);
}
function refreshElementGeometry(){
 const p=current().obj.paint?.[drawingSelection?.index];if(!p)return;
 for(const key of ['x','y','w','h','r','x2','y2']){const input=document.querySelector('#inspector [data-pixel-key="'+key+'"]');if(input&&key in p)input.value=p[key];}
}
const elementDownBase=canvas.onpointerdown,elementMoveBase=canvas.onpointermove,elementUpBase=canvas.onpointerup;
canvas.onpointerdown=e=>{
 if(e.button!==0||e.altKey||paintMode){drawingSelection=null;return elementDownBase(e);}
 const p=point(e,true),item=hit(p);
 const handle=elementHandle(p);
 if(handle){
  const cv=current().obj,operation=cv.paint[drawingSelection.index];drag={drawing:true,resize:handle.kind,recorded:false,start:p,operation:TD.clone(operation),bounds:drawingBounds(operation),canvas:cv,index:drawingSelection.index};
  canvas.focus();canvas.setPointerCapture(e.pointerId);e.preventDefault();return;
 }
 if(item?.obj.type==='canvas'){
  const x=p.x-item.r.x,y=p.y-item.r.y;
  for(let i=item.obj.paint.length-1;i>=0;i--){
   const operation=item.obj.paint[i],b=drawingBounds(operation);
   if(['rect','fill'].includes(operation.op)&&b.x===0&&b.y===0&&b.w===item.obj.w&&b.h===item.obj.h)continue;
   if(x>=b.x&&y>=b.y&&x<b.x+b.w&&y<b.y+b.h){
    selected=item.obj.id;drawingSelection={id:selected,index:i};
    drag={drawing:true,recorded:false,start:p,operation:TD.clone(operation),bounds:b,canvas:item.obj,index:i};
    render();canvas.focus();canvas.setPointerCapture(e.pointerId);e.preventDefault();return;
   }
  }
 }
 drawingSelection=null;elementDownBase(e);
};
canvas.onpointermove=e=>{
 if(!drag?.drawing){const h=elementHandle(point(e,true));if(h){canvas.style.cursor=h.kind==='start'||h.kind==='end'?'crosshair':h.kind+'-resize';return;}return elementMoveBase(e);}
 const p=point(e,true),start=drag.operation,b=drag.bounds,units=['picture','button','slider','font_text','big','put','fill'].includes(start.op)?1:2;
 if(drag.resize){
  const next=TDGeometry.resize(start,b,drag.resize,p.x-drag.start.x,p.y-drag.start.y,drag.canvas.w,drag.canvas.h);
  if(!drag.recorded&&JSON.stringify(next)===JSON.stringify(start))return;
  if(!drag.recorded){snapshot();drag.recorded=true;}drag.canvas.paint[drag.index]=next;drawSoon();refreshElementGeometry();return;
 }
 const dx=Math.max(-b.x,Math.min(drag.canvas.w-b.x-b.w,Math.round((p.x-drag.start.x)*units)/units)),dy=Math.max(-b.y,Math.min(drag.canvas.h-b.y-b.h,Math.round((p.y-drag.start.y)*units)/units));
 if(!drag.recorded&&(!dx&&!dy))return;
 if(!drag.recorded){snapshot();drag.recorded=true;}
 const target=drag.canvas.paint[drag.index];target.x=start.x+Math.round(dx*units);target.y=start.y+Math.round(dy*units);
 if(start.op==='line'){target.x2=start.x2+Math.round(dx*units);target.y2=start.y2+Math.round(dy*units);}
 drawSoon();refreshElementGeometry();
};
canvas.onpointerup=e=>{
 if(!drag?.drawing)return elementUpBase(e);
 drag=null;render();
};
document.addEventListener('keydown',e=>{
 if(!drawingSelection||e.target!==canvas||document.querySelector('dialog[open]'))return;
 const {obj}=current(),p=obj.paint?.[drawingSelection.index];if(!p)return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();snapshot();obj.paint.splice(drawingSelection.index,1);drawingSelection=null;render();return;}
 const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
 if(delta){e.preventDefault();e.stopImmediatePropagation();snapshot();const n=e.shiftKey?5:1;p.x+=delta[0]*n;p.y+=delta[1]*n;if(p.op==='line'){p.x2+=delta[0]*n;p.y2+=delta[1]*n;}render();}
},true);
const updateElementsBase=update;
update=function(){TDVersion.stamp(design);updateElementsBase();const badge=document.querySelector('.subbar .tag');if(badge)badge.textContent='app '+design.application.version+' · Builder '+TDVersion.VERSION.builder+' · schema '+design.version;};
render();
