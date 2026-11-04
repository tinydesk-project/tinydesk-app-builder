/* Normal text/code clipboard behavior remains native to the browser. */
'use strict';
let elementClipboard=null;const elementPasteCounts=new Map();
function clipboardContext(target){return !document.querySelector('dialog[open]')&&!target?.isContentEditable&&!target?.closest('input,textarea,select,pre,[contenteditable="true"]')&&!window.getSelection()?.toString();}
function clipboardItems(){
 let items=multiItems();
 if(items.length<2){const {obj:o}=current();const ref=drawingSelection?.id===selected?{widgetId:selected,index:drawingSelection.index}:o.type?{widgetId:selected}:null;items=ref?[multiResolve(ref)].filter(Boolean):[];}
 return items.sort((a,b)=>a.win.widgets.indexOf(a.cv)-b.win.widgets.indexOf(b.cv)||(a.ref.index??-1)-(b.ref.index??-1));
}
function copyElements(){
 const items=clipboardItems();elementClipboard=TDClipboard.capture(design,items.map(i=>({kind:i.ref.index===undefined?'widget':'paint',object:i.p,windowName:i.win.name,page:activePage(i.win),bounds:{...i.b,x:i.b.x-i.origin.x,y:i.b.y-i.origin.y},offset:{x:i.offset.x-i.origin.x,y:i.offset.y-i.origin.y}})));
 elementPasteCounts.clear();toast(items.length+' element'+(items.length===1?'':'s')+' copied.');return TDClipboard.encode(elementClipboard);
}
function pasteElements(data){
 if(!data)throw Error('Copy TinyDesk elements first, then select a destination page.');
 const {win,obj}=current(),key=win.id+'|'+activePage(win),step=(elementPasteCounts.get(key)||0)+1,result=TDClipboard.paste(design,data,{windowId:win.id,page:activePage(win),canvasId:obj.type==='canvas'?obj.id:null},step);
 snapshot();design=result.design;elementPasteCounts.set(key,step);drawingSelection=null;multiRefs=[];selectedAsset=null;selected=result.refs.at(-1).widgetId;render();multiSet(result.refs);canvas.focus();toast(result.refs.length+' element'+(result.refs.length===1?'':'s')+' pasted.');
}
document.addEventListener('copy',e=>{if(!clipboardContext(e.target)||!clipboardItems().length)return;try{const text=copyElements();e.clipboardData.setData('text/plain',text);e.preventDefault();}catch(error){toast(error.message);}});
document.addEventListener('cut',e=>{if(!clipboardContext(e.target)||!clipboardItems().length)return;try{const text=copyElements();e.clipboardData.setData('text/plain',text);e.preventDefault();const items=clipboardItems();multiRefs=items.map(i=>i.ref);multiDesign=design;multiDelete();}catch(error){toast(error.message);}});
document.addEventListener('paste',e=>{if(!clipboardContext(e.target))return;try{const data=TDClipboard.decode(e.clipboardData.getData('text/plain'));if(!data)return;e.preventDefault();pasteElements(data);}catch(error){e.preventDefault();toast(error.message);}});
// Chromium may omit a native copy event for a focused canvas/Outline button
// without a text selection. Handle those element shortcuts explicitly.
document.addEventListener('keydown',e=>{
 if(!(e.ctrlKey||e.metaKey)||e.altKey||!clipboardContext(e.target))return;
 const key=e.key.toLowerCase();if(!['c','v','x'].includes(key))return;
 if(key!=='v'&&!clipboardItems().length)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(key==='v'){
  (async()=>{try{let data=elementClipboard;try{const external=TDClipboard.decode(await navigator.clipboard.readText());if(external)data=external;}catch(e){}pasteElements(data);}catch(e){toast(e.message);}})();
 }else try{const text=copyElements();navigator.clipboard?.writeText(text).catch(()=>{});if(key==='x'){multiRefs=clipboardItems().map(i=>i.ref);multiDesign=design;multiDelete();}}catch(e){toast(e.message);}
},true);
const clipboardBar=document.createElement('div');clipboardBar.className='element-clipboard';
clipboardBar.innerHTML='<button id="copyElements" title="Copy selected elements (Ctrl+C)">Copy</button><button id="pasteElements" title="Paste elements on this page (Ctrl+V)">Paste</button>';
document.querySelector('#pageTabs').after(clipboardBar);
document.querySelector('#copyElements').onclick=async()=>{try{const text=copyElements();try{await navigator.clipboard.writeText(text);}catch(e){toast('Elements copied inside Builder. Use Paste to insert them.');}}catch(e){toast(e.message);}};
document.querySelector('#pasteElements').onclick=async()=>{try{let data=elementClipboard;try{const external=TDClipboard.decode(await navigator.clipboard.readText());if(external)data=external;}catch(e){}pasteElements(data);}catch(e){toast(e.message);}};
