/* Persistent file inventory, with asset details in the fixed Inspector. */
'use strict';
const assetHost=document.querySelector('#componentsPane'),componentContent=document.createElement('div');
componentContent.id='componentContent';while(assetHost.firstChild)componentContent.append(assetHost.firstChild);
assetHost.append(componentContent);
const assetTabs=document.createElement('div');assetTabs.className='left-tabs';assetTabs.setAttribute('role','tablist');assetTabs.setAttribute('aria-label','Components and assets');
assetTabs.innerHTML='<button id="componentsTab" role="tab" aria-controls="componentContent">Components</button><button id="outlineTab" role="tab" aria-controls="outlinePane">Outline</button><button id="assetsTab" role="tab" aria-controls="assetsContent">Assets <span id="assetCount">0</span></button>';
assetHost.prepend(assetTabs);
const assetContent=document.createElement('div');assetContent.id='assetsContent';assetContent.setAttribute('role','tabpanel');
assetContent.innerHTML='<div class="asset-controls"><div class="asset-toolbar"><input id="assetSearch" type="search" aria-label="Search assets" placeholder="Find a file…"><button id="addAsset" title="Import image, text or compiled module" aria-label="Import asset">＋</button></div><p class="asset-help">Select a file to see its uses.</p></div><div id="assetList"></div>';
assetHost.append(assetContent);
let selectedAsset=null,assetView=TDResources.inventory(design).length?'assets':'components',assetSignature='',assetFiles=null,assetBinaries=null;
function showAssetView(view){assetView=view;componentContent.hidden=view!=='components';assetContent.hidden=view!=='assets';const panel=document.querySelector('#leftPanel');panel.classList.toggle('asset-mode',view==='assets');panel.classList.toggle('outline-mode',view==='outline');for(const name of ['components','outline','assets'])document.querySelector('#'+name+'Tab').setAttribute('aria-selected',String(view===name));}
document.querySelector('#componentsTab').onclick=()=>{selectedAsset=null;showAssetView('components');renderInspector();};
document.querySelector('#outlineTab').onclick=()=>{selectedAsset=null;showAssetView('outline');renderInspector();};
document.querySelector('#assetsTab').onclick=()=>{showAssetView('assets');renderAssetList(true);};
document.querySelector('#addAsset').onclick=()=>{assetImportTarget=null;assetInput.click();};
function assetSize(bytes){return bytes<1024?bytes+' B':(bytes/1024).toFixed(1)+' KB';}
function renderAssetList(force=false){
 try{
  const files=TDResources.inventory(design),query=document.querySelector('#assetSearch').value.toLowerCase();
  const signature=JSON.stringify(files.map(f=>[f.name,f.kind,f.embedded,f.bytes,f.uses.map(u=>[u.widgetId,u.index,u.page,u.label]),f.startup]))+query+(selectedAsset||'');
  document.querySelector('#assetCount').textContent=files.length;
  if(!force&&signature===assetSignature&&assetFiles===design.assets&&assetBinaries===design.binaryDependencies)return;
  assetSignature=signature;assetFiles=design.assets;assetBinaries=design.binaryDependencies;
  const list=document.querySelector('#assetList');list.replaceChildren();
  for(const file of files.filter(f=>(f.name+' '+f.originalName+' '+f.kind).toLowerCase().includes(query))){
   const b=document.createElement('button');b.className='asset-row'+(file.name===selectedAsset?' selected':'');b.title=file.name;b.dataset.assetName=file.name;
   b.innerHTML='<span class="asset-thumb" aria-hidden="true">'+(file.kind==='font'?'Aa':file.kind==='module'?'MPY':file.kind==='text'?'TXT':'IMG')+'</span><span class="asset-summary"><strong>'+esc(file.name)+'</strong><small>'+esc(file.kind)+(file.w?' · '+file.w+'×'+file.h:'')+' · '+(file.uses.length?file.uses.length+' uses':file.startup?'Startup':file.required?'Required':'Unused')+'</small><span class="asset-status '+(file.embedded?'embedded':'external')+'">'+(file.embedded?'Embedded · '+assetSize(file.bytes):'External · locate to bundle')+'</span></span>';
   if(file.kind==='image'&&file.embedded){const preview=window.TDAssetPreview({path:'/root/'+file.name,key:null});if(preview){const img=document.createElement('img');img.src=preview.toDataURL();img.alt='';b.querySelector('.asset-thumb').replaceChildren(img);}}
   b.onclick=()=>{selectedAsset=file.name;renderAssetList(true);renderInspector();};list.append(b);
  }
  if(!list.children.length){const p=document.createElement('p');p.className='asset-help';p.textContent=files.length?'No matching files.':'No resources yet. Import an image, text file or .mpy module.';list.append(p);}
  if(selectedAsset&&!files.some(f=>f.name===selectedAsset))selectedAsset=null;
 }catch(e){document.querySelector('#assetList').textContent=e.message;}
}
document.querySelector('#assetSearch').oninput=()=>renderAssetList(true);
function inspectAsset(){
 const file=TDResources.inventory(design).find(f=>f.name===selectedAsset);if(!file){selectedAsset=null;return assetInspectorBase();}
 document.querySelector('#typeTag').textContent='ASSET';document.querySelector('.inspector-tabs').hidden=true;
 const root=document.querySelector('#inspector');
 root.innerHTML='<h2 class="object-name asset-name">'+esc(file.name)+'</h2><p class="object-desc">'+esc(file.kind)+' · '+(file.embedded?'Embedded · '+assetSize(file.bytes):'External; locate to keep it with this project')+'</p><div id="assetPreview"></div><p class="asset-help">Original: '+esc(file.originalName)+(file.w?'<br>Source: '+file.w+' × '+file.h+' pixels':'')+'</p><div class="asset-actions"><button id="assetLocate" class="primary">'+(file.embedded?'Replace file':'Locate file')+'</button><button id="assetDownload" '+(!file.embedded?'disabled':'')+'>Download</button><button id="assetRemove" '+(file.required?'disabled':'')+'>Remove unused</button></div><h3 class="group-title">'+(file.kind==='module'?'APPLICATION DEPENDENCY':'USED BY '+file.uses.length+' ELEMENTS')+'</h3><div id="assetUses"></div>'+(file.startup?'<p class="asset-help">Also used as kiosk loading artwork.</p>':'')+(file.kind==='module'?'<p class="asset-help">Declared application module. Keep its editable source separately. The compiled dependency travels with JSON and .tdapp exports.</p>':'');
 if(file.kind==='image'&&file.embedded){const canvas=window.TDAssetPreview({path:'/root/'+file.name,key:null});if(canvas){const img=document.createElement('img');img.src=canvas.toDataURL();img.alt=file.name;root.querySelector('#assetPreview').append(img);}}
 if(file.kind==='font'&&file.embedded){
  const font=TDFontPreview({path:file.name});
  if(font){const canvas=document.createElement('canvas');canvas.width=480;canvas.height=Math.max(100,font.height*3+16);canvas.style.maxWidth='100%';canvas.setAttribute('aria-label','Generated bitmap font preview');TDFonts.paint(canvas.getContext('2d'),font,'TinyDesk 123.4 °C\n'+Array.from(font.glyphs.keys(),cp=>String.fromCodePoint(cp)).join(''),8,8,464,canvas.height-16,'#fff','#111','left','top',true);root.querySelector('#assetPreview').append(canvas);const info=document.createElement('p');info.className='hint';info.textContent=font.size+' px font · '+font.height+' px line height · '+font.glyphs.size+' glyphs · '+font.bpp+' bit coverage. Loaded once into native graphics memory.';root.querySelector('#assetPreview').append(info);}
 }
 for(const use of file.uses){const b=document.createElement('button');b.className='asset-use';b.textContent=use.label+' · '+(use.page||'All pages');b.onclick=()=>{selectedAsset=null;selected=use.widgetId;drawingSelection={id:selected,index:use.index};pageViews.set(use.windowId,use.page);render();};root.querySelector('#assetUses').append(b);}
 root.querySelector('#assetLocate').onclick=()=>{assetImportTarget=file.name;assetInput.click();};
 root.querySelector('#assetDownload').onclick=()=>{const bytes=Uint8Array.from(atob(file.file.data),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes]));const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 root.querySelector('#assetRemove').onclick=()=>{if(file.required)return;snapshot();design.assets=(design.assets||[]).filter(f=>f.name!==file.name);design.binaryDependencies=(design.binaryDependencies||[]).filter(f=>f.name!==file.name);selectedAsset=null;render();};
}
const assetInspectorBase=renderInspector;
renderInspector=function(){return selectedAsset?inspectAsset():assetInspectorBase();};
const assetUpdateBase=update;
update=function(){assetUpdateBase();renderAssetList();if(selectedAsset)inspectAsset();};
for(const event of ['pointerdown','click'])document.addEventListener(event,e=>{if(e.target.closest('#layers,#pageTabs,#palette,.control-gallery,#screen,#addWindow'))selectedAsset=null;},true);
showAssetView(assetView);renderAssetList(true);
