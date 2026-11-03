/* Shift-click, marquee selection, shared Inspector and group transforms. */
'use strict';
let multiRefs=[],multiDesign=design,multiDrag=null;
const multiKey=r=>r.widgetId+(r.index===undefined?'':'#'+r.index);
function multiResolve(ref){
 for(const win of design.windows){const cv=win.widgets.find(o=>o.id===ref.widgetId);if(!cv||!onPage(cv,win))continue;const p=ref.index===undefined?cv:cv.paint?.[ref.index];if(!p)return null;const local=TD.rect(cv,win,design),placed=layout.find(l=>l.obj.id===cv.id)?.r;if(!placed)return null;const origin={x:placed.x-local.x,y:placed.y-local.y},offset=ref.index===undefined?origin:{x:placed.x,y:placed.y},b=ref.index===undefined?local:drawingBounds(p);return {ref,win,cv,p,offset,origin,b:{x:b.x+offset.x,y:b.y+offset.y,w:b.w,h:b.h}};}
 return null;
}
function multiItems(){if(multiDesign!==design){multiRefs=[];multiDesign=design;}multiRefs=multiRefs.filter(r=>multiResolve(r));return multiRefs.map(multiResolve);}
function multiSet(refs){
 multiRefs=[...new Map(refs.map(r=>[multiKey(r),r])).values()];multiDesign=design;
 const owner=multiResolve(multiRefs.at(-1)||{});if(owner)multiRefs=multiRefs.filter(r=>multiResolve(r)?.win===owner.win);
 const parents=new Set(multiRefs.filter(r=>r.index===undefined).map(r=>r.widgetId));multiRefs=multiRefs.filter(r=>r.index===undefined||!parents.has(r.widgetId));
 const items=multiItems();if(items.length){selected=items.at(-1).cv.id;selectedAsset=null;drawingSelection=items.length===1&&items[0].ref.index!==undefined?{id:selected,index:items[0].ref.index}:null;}
 render();
}
function multiCandidates(){const {win}=current();return win.widgets.filter(o=>onPage(o,win)).flatMap(cv=>cv.type==='canvas'?cv.paint.flatMap((p,index)=>{const b=drawingBounds(p);return ['fill','rect','gradient','image','nine','picture'].includes(p.op)&&b.x===0&&b.y===0&&b.w===cv.w&&b.h===cv.h?[]:[{widgetId:cv.id,index}];}):[{widgetId:cv.id}]);}
function multiHit(pt){return multiCandidates().map(multiResolve).filter(Boolean).reverse().find(({b})=>pt.x>=b.x&&pt.y>=b.y&&pt.x<b.x+b.w&&pt.y<b.y+b.h)?.ref;}
function multiCommit(before){const errors=TD.validate(design).errors;if(errors.length){for(const item of before){if(item.ref.index===undefined)Object.assign(item.cv,item.old);else item.cv.paint[item.ref.index]=item.old;}toast(errors[0]);return false;}return true;}
const multiInspectorBase=renderInspector;
renderInspector=function(){
 const items=multiItems();if(items.length<2)return multiInspectorBase();
 const root=$('#inspector'),b=TDSelection.bounds(items.map(i=>i.b)),origin=items[0].origin;$('#typeTag').textContent='GROUP';$('.inspector-tabs').hidden=true;
 let html='<h2 class="object-name">'+items.length+' elements selected</h2><p class="hint">Shift-click to add/remove. Drag the group or its handles. Blank fields contain different values; editing applies to every selected element.</p><h3 class="group-title">GROUP BOUNDS · CELLS</h3>';
 for(const pair of [['x','y'],['w','h']]){html+='<div class="field-row">';for(const key of pair)html+='<label class="field"><span>'+({x:'X',y:'Y',w:'Width',h:'Height'}[key])+'</span><input type="number" step="0.5" data-group-bound="'+key+'" value="'+(b[key]-(origin[key]||0))+'"></label>';html+='</div>';}
 html+='<h3 class="group-title">COMMON ATTRIBUTES</h3>';
 const shared=TDSelection.common(items.map(i=>i.p));
 if(!shared.length)html+='<p class="hint">These elements have no common editable attributes.</p>';
 for(const field of shared){const {key,value,mixed}=field;let control;
  if(key==='font'){control='<select data-group-key="font"><option value="" '+(mixed?'selected':'')+'>'+(mixed?'Mixed fonts':'Choose font…')+'</option>'+fontOptions(mixed?'':value?.path||'').replace(/<option value="">.*?<\/option>/,'')+'</select>';}
  else if(typeof value==='boolean')control='<select data-group-key="'+key+'"><option value="" '+(mixed?'selected':'')+'>Mixed</option><option value="true" '+(!mixed&&value?'selected':'')+'>Yes</option><option value="false" '+(!mixed&&!value?'selected':'')+'>No</option></select>';
  else control='<input data-group-key="'+key+'" type="'+(typeof value==='number'?'number':'text')+'" placeholder="'+(mixed?'Mixed':'')+'" value="'+(mixed?'':esc(typeof value==='object'?JSON.stringify(value):value??''))+'">';
  html+='<label class="field"><span>'+esc(({fg:'Foreground',bg:'Background',color:'Fill color',down:'Pressed color',rim:'Border color',radius:'Corner radius',scale:'Text scale',text:'Text',maximum:'Maximum',value:'Value',visible:'Visible',checked:'Checked',secret:'Password field',align:'Horizontal alignment',valign:'Vertical alignment',wrap:'Wrap text',font:'Font'})[key]||key)+'</span>'+control+'</label>';
  if(['fg','bg','color','down','rim','track','edge','knob'].includes(key))html+='<button data-group-color="'+key+'">Palette · '+esc(key)+'</button>';
 }
 html+='<p id="groupError" role="alert"></p><button id="groupDelete">Delete selected</button><button id="groupClear">Clear selection</button>';
 root.innerHTML=html;
 window.TDGradientGroup?.(root,items);
 for(const el of root.querySelectorAll('[data-group-key]'))el.oninput=el.onchange=()=>{
  const key=el.dataset.groupKey,field=shared.find(f=>f.key===key);if(el.value===''&&typeof field.value!=='string')return;
  try{const value=key==='font'?{path:'/root/'+el.value}:typeof field.value==='number'?Number(el.value):typeof field.value==='boolean'?el.value==='true':Array.isArray(field.value)?JSON.parse(el.value):el.value;const before=items.map(i=>({...i,old:TD.clone(i.p)}));for(const i of items)i.p[key]=TD.clone(value);if(!multiCommit(before))return;snapshotFrom(before,'group:'+multiRefs.map(multiKey).join(',')+':'+key);const focused=document.activeElement===el,caret=el.selectionStart;render();if(focused){const next=root.querySelector('[data-group-key="'+key+'"]');next?.focus({preventScroll:true});if(next?.type==='text'&&caret!==null)next.setSelectionRange(caret,caret);}}catch(e){$('#groupError').textContent=e.message;}
 };
 for(const el of root.querySelectorAll('[data-group-bound]'))el.oninput=el.onchange=()=>{if(el.value==='')return;const key=el.dataset.groupBound,focused=document.activeElement===el;multiApplyBounds({...b,[key]:Number(el.value)+(origin[key]||0)},items,b);if(focused)root.querySelector('[data-group-bound="'+key+'"]')?.focus({preventScroll:true});};
 for(const el of root.querySelectorAll('[data-group-color]'))el.onclick=()=>showElementPalette(el,value=>{const input=root.querySelector('[data-group-key="'+el.dataset.groupColor+'"]');input.value=value;input.onchange();},el.dataset.groupColor==='bg'?[[-1,'Theme'],[-2,'Transparent']]:[]);
 $('#groupClear').onclick=()=>multiSet([]);$('#groupDelete').onclick=()=>multiDelete();
};
function snapshotFrom(before,group=null){const after=before.map(i=>({...i,now:TD.clone(i.ref.index===undefined?i.cv:i.cv.paint[i.ref.index])}));for(const i of before){if(i.ref.index===undefined)Object.assign(i.cv,i.old);else i.cv.paint[i.ref.index]=i.old;}snapshot(group);for(const i of after){if(i.ref.index===undefined)Object.assign(i.cv,i.now);else i.cv.paint[i.ref.index]=i.now;}}
function multiApplyBounds(target,items=multiItems(),b=TDSelection.bounds(items.map(i=>i.b))){
 if(![target.x,target.y,target.w,target.h].every(Number.isFinite)||target.w<=0||target.h<=0){toast('Use positive group dimensions.');return;}
 const before=items.map(i=>({...i,old:TD.clone(i.p)}));
 for(const i of items){const next=TDSelection.transform(i.p,i.b,b,target,i.offset);if(i.ref.index===undefined)Object.assign(i.cv,next);else i.cv.paint[i.ref.index]=next;}
 if(multiCommit(before)){snapshotFrom(before);render();}else render();
}
function multiDelete(){const items=multiItems();if(!items.length)return;snapshot();for(const cv of new Set(items.filter(i=>i.ref.index!==undefined).map(i=>i.cv)))for(const i of items.filter(i=>i.cv===cv&&i.ref.index!==undefined).sort((a,b)=>b.ref.index-a.ref.index))cv.paint.splice(i.ref.index,1);for(const {win,cv,ref}of items)if(ref.index===undefined)win.widgets=win.widgets.filter(o=>o!==cv);multiSet([]);}
const multiDrawBase=draw;
draw=function(){multiDrawBase();const items=multiItems();if(items.length>1){const b=multiDrag?.target||TDSelection.bounds(items.map(i=>i.b));ctx.save();ctx.strokeStyle='#ffe080';ctx.lineWidth=2;for(const i of items)ctx.strokeRect(i.b.x*10,i.b.y*20,i.b.w*10,i.b.h*20);ctx.setLineDash([5,3]);ctx.strokeRect(b.x*10,b.y*20,b.w*10,b.h*20);ctx.setLineDash([]);ctx.fillStyle='#ffe080';for(const h of TDGeometry.handles({w:b.w,h:b.h},b))ctx.fillRect(h.x*10-4,h.y*20-4,8,8);ctx.restore();}if(multiDrag?.marquee){const b=multiDrag.target;ctx.save();ctx.fillStyle='#5fafff22';ctx.strokeStyle='#5fafff';ctx.fillRect(b.x*10,b.y*20,b.w*10,b.h*20);ctx.strokeRect(b.x*10,b.y*20,b.w*10,b.h*20);ctx.restore();}};
const multiDownBase=canvas.onpointerdown,multiMoveBase=canvas.onpointermove,multiUpBase=canvas.onpointerup;
canvas.onpointerdown=e=>{
 if(e.button!==0||paintMode||e.altKey){multiRefs=[];return multiDownBase(e);}
 const pt=point(e,true),ref=multiHit(pt),items=multiItems(),extend=e.shiftKey||e.ctrlKey||e.metaKey;
 if(extend&&ref){let refs=items.length?multiRefs: drawingSelection?[{widgetId:drawingSelection.id,index:drawingSelection.index}]:current().obj.type?[{widgetId:selected}]:[];const key=multiKey(ref);multiSet(refs.some(r=>multiKey(r)===key)?refs.filter(r=>multiKey(r)!==key):[...refs,ref]);e.preventDefault();canvas.focus();return;}
 if(items.length>1){const b=TDSelection.bounds(items.map(i=>i.b)),rect=canvas.getBoundingClientRect(),tx=7*design.screen.w/rect.width,ty=7*design.screen.h/rect.height,handle=TDGeometry.handles({w:b.w,h:b.h},b).find(h=>Math.abs(pt.x-h.x)<=tx&&Math.abs(pt.y-h.y)<=ty);
  if(handle||ref&&multiRefs.some(r=>multiKey(r)===multiKey(ref))){multiDrag={start:pt,b,target:b,kind:handle?.kind,items:items.map(i=>({...i,old:TD.clone(i.p)}))};canvas.setPointerCapture(e.pointerId);canvas.focus();e.preventDefault();return;}
 }
 if(!ref){multiDrag={marquee:true,start:pt,target:{x:pt.x,y:pt.y,w:0,h:0},extend,previous:extend?multiRefs:[]};canvas.setPointerCapture(e.pointerId);canvas.focus();e.preventDefault();return;}
 multiRefs=[];return multiDownBase(e);
};
canvas.onpointermove=e=>{if(!multiDrag)return multiMoveBase(e);const pt=point(e,true),d=multiDrag;if(d.marquee)d.target={x:Math.min(pt.x,d.start.x),y:Math.min(pt.y,d.start.y),w:Math.abs(pt.x-d.start.x),h:Math.abs(pt.y-d.start.y)};else{const {win,origin}=d.items[0],size=TD.sizeOf(win,design),dx=pt.x-d.start.x,dy=pt.y-d.start.y,local={...d.b,x:d.b.x-origin.x,y:d.b.y-origin.y};if(d.kind){const next=TDGeometry.resize({op:'font_text',...local},local,d.kind,dx,dy,size.w,size.h);d.target={x:next.x+origin.x,y:next.y+origin.y,w:next.w,h:next.h};}else d.target={...d.b,x:origin.x+Math.max(0,Math.min(size.w-d.b.w,Math.round(local.x+dx))),y:origin.y+Math.max(0,Math.min(size.h-d.b.h,Math.round(local.y+dy)))};for(const i of d.items){const next=TDSelection.transform(i.old,i.b,d.b,d.target,i.offset);if(i.ref.index===undefined)Object.assign(i.cv,next);else i.cv.paint[i.ref.index]=next;}}draw();};
canvas.onpointerup=e=>{if(!multiDrag)return multiUpBase(e);const d=multiDrag;multiDrag=null;if(d.marquee){const b=d.target;multiSet([...d.previous,...multiCandidates().filter(r=>{const i=multiResolve(r);return i&&i.b.x>=b.x&&i.b.y>=b.y&&i.b.x+i.b.w<=b.x+b.w&&i.b.y+i.b.h<=b.y+b.h;})]);}else{for(const i of d.items){if(i.ref.index===undefined)Object.assign(i.cv,i.old);else i.cv.paint[i.ref.index]=i.old;}multiApplyBounds(d.target,d.items,d.b);}};
const multiCancelBase=canvas.onpointercancel;
function multiCancel(e){if(!multiDrag)return multiCancelBase?.(e);const d=multiDrag;multiDrag=null;if(d.items)for(const i of d.items){if(i.ref.index===undefined)Object.assign(i.cv,i.old);else i.cv.paint[i.ref.index]=i.old;}render();}
canvas.onpointercancel=multiCancel;
canvas.addEventListener('lostpointercapture',e=>{if(multiDrag)multiCancel(e);});
document.querySelector('#layers').addEventListener('click',e=>{const element=e.target.closest('[data-group-widget]');if(!element)return;if(e.shiftKey||e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();const ref={widgetId:element.dataset.groupWidget,...(element.dataset.groupIndex!==undefined?{index:Number(element.dataset.groupIndex)}:{})},key=multiKey(ref),refs=multiItems().length?multiRefs:drawingSelection?[{widgetId:drawingSelection.id,index:drawingSelection.index}]:[];multiSet(refs.some(r=>multiKey(r)===key)?refs.filter(r=>multiKey(r)!==key):[...refs,ref]);}else multiRefs=[];},true);
const multiLayersBase=renderLayers;
renderLayers=function(){multiLayersBase();for(const w of design.windows)for(const cv of w.widgets){const row=$('#layers [data-id="'+CSS.escape(cv.id)+'"]');if(!row)continue;row.dataset.groupWidget=cv.id;const group=row.nextElementSibling;if(group?.tagName==='DETAILS')group.querySelectorAll('.drawing-outline button').forEach((b,index)=>{b.dataset.groupWidget=cv.id;b.dataset.groupIndex=index;b.classList.toggle('multi-selected',multiRefs.some(r=>r.widgetId===cv.id&&r.index===index));});}};
document.addEventListener('keydown',e=>{if(e.target!==canvas||document.querySelector('dialog[open]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();e.stopImmediatePropagation();multiSet(multiCandidates());return;}if(multiItems().length<2)return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();multiDelete();}const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();e.stopImmediatePropagation();const b=TDSelection.bounds(multiItems().map(i=>i.b)),n=e.shiftKey?5:1;multiApplyBounds({...b,x:b.x+delta[0]*n,y:b.y+delta[1]*n});}},true);
document.querySelector('#pageTabs').addEventListener('click',()=>{multiRefs=[];},true);
render();
