/* File identity is shared by image import, simulation and package export. */
(function(root){
 'use strict';
 const basename=path=>path.split('/').pop();
 function required(design){
  const paths=new Map();
  for(const w of design.windows)for(const o of w.widgets)for(const p of o.paint||[]){
   for(const resource of [p.asset,p.font].filter(Boolean)){
   const name=basename(resource.path);
   if(paths.has(name)&&paths.get(name)!==resource.path)throw Error('Image filenames must be unique: '+name);
   paths.set(name,resource.path);}
  }
  if(design.startup?.image&&!paths.has(design.startup.image))paths.set(design.startup.image,design.startup.image);
  return paths;
 }
 function inventory(design){
  const files=new Map([...(design.assets||[]),...(design.binaryDependencies||[])].map(f=>[f.name,f])),paths=required(design),uses=new Map();
  for(const win of design.windows)for(const widget of win.widgets)for(const [index,p] of (widget.paint||[]).entries()){
   for(const name of new Set([p.asset&&basename(p.asset.path),p.font&&basename(p.font.path),p.sourceAsset].filter(Boolean))){
   if(!uses.has(name))uses.set(name,[]);
   uses.get(name).push({windowId:win.id,widgetId:widget.id,index,page:widget.page,label:p.name||p.text||p.op,asset:p.asset});}
  }
  const modules=new Set((design.modules||[]).map(n=>n+'.mpy'));
  return [...new Set([...paths.keys(),...uses.keys(),...files.keys(),...modules])].map(name=>{
   const file=files.get(name),data=file?.data||'',references=uses.get(name)||[],kind=/\.tdfont$/i.test(name)?'font':/\.mpy$/i.test(name)?'module':file?.mime==='text/plain'||/\.txt$/i.test(name)?'text':'image';
   return {name,kind,required:paths.has(name)||modules.has(name)||references.length>0,embedded:!!data,
    originalName:file?.originalName||name,bytes:Math.max(0,Math.floor(data.length*3/4)-(data.endsWith('==')?2:data.endsWith('=')?1:0)),
    w:file?.w||references[0]?.asset?.w,h:file?.h||references[0]?.asset?.h,uses:references,file,
    startup:design.startup?.image===name};
  });
 }
 function storeImage(design,file,target=null){
  const paths=required(design),files=design.assets||[],old=files.find(f=>f.name===file.originalName)||files.find(f=>f.originalName===file.originalName);
  // An exact required filename takes priority over the old importer's
  // asset_N aliases. Re-import repairs that reference without adding a widget.
  const name=target||(paths.has(file.originalName)?file.originalName:old?.name)||file.name;
  if(!name||name==='.'||name==='..'||/[\\/:\0]/.test(name)||new TextEncoder().encode(name).length>64)throw Error('Use an image filename up to 64 bytes without path separators.');
  const prior=files.find(f=>f.name===name);
  const resource={...prior,...file,name};
  design.assets=[...files.filter(f=>f.name!==name),resource];
  return {name,linked:paths.has(name),replaced:!!prior};
 }
 const api={required,inventory,storeImage};
 if(typeof module!=='undefined')module.exports=api;else root.TDResources=api;
})(typeof window!=='undefined'?window:globalThis);
