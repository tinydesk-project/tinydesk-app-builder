/* Imported resources live in project JSON and travel with .tdapp exports. */
'use strict';
const imagePreviews=new WeakMap();
window.TDAssetPreview=asset=>{
 const file=(design.assets||[]).find(f=>asset&&f.name===asset.path.split('/').pop());if(!file)return null;
 if(imagePreviews.has(file))return imagePreviews.get(file);
 imagePreviews.set(file,null);
 try{
  const data=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));
  if(data[0]===66&&data[1]===77){
   const view=new DataView(data.buffer),offset=view.getUint32(10,true),dib=view.getUint32(14,true),w=view.getInt32(18,true),signedH=view.getInt32(22,true),h=Math.abs(signedH),depth=view.getUint16(28,true),stride=Math.ceil(w*depth/32)*4;
   if(dib<40||w<1||h<1||w>512||h>512||![8,24].includes(depth)||view.getUint32(30,true)!==0||offset+stride*h>data.length)return null;
   const surface=document.createElement('canvas');surface.width=w;surface.height=h;const context=surface.getContext('2d'),rgba=context.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const at=offset+(signedH>0?h-1-y:y)*stride+x*depth/8,index=depth===8?14+dib+data[at]*4:at;
    if(index+2>=data.length)return null;
    const r=data[index+2],g=data[index+1],b=data[index];rgba.data.set([r,g,b,asset.key&&r===asset.key[0]&&g===asset.key[1]&&b===asset.key[2]?0:255],(y*w+x)*4);
   }
   context.putImageData(rgba,0,0);imagePreviews.set(file,surface);return surface;
  }
  const header=new TextDecoder().decode(data.slice(0,256)).match(/^P([56])\s+(\d+)\s+(\d+)\s+255\s/);
  if(!header)return null;const channels=header[1]==='5'?1:3,w=Number(header[2]),h=Number(header[3]);if(w*h>512*512||data.length<header[0].length+w*h*channels)return null;
  const surface=document.createElement('canvas');surface.width=w;surface.height=h;const context=surface.getContext('2d'),rgba=context.createImageData(w,h);
  for(let i=0;i<w*h;i++){const at=header[0].length+i*channels,r=data[at],g=channels===1?r:data[at+1],b=channels===1?r:data[at+2];rgba.data.set([r,g,b,asset.key&&r===asset.key[0]&&g===asset.key[1]&&b===asset.key[2]?0:255],i*4);}
  context.putImageData(rgba,0,0);imagePreviews.set(file,surface);return surface;
 }catch(e){return null;}
};
const assetInput=document.createElement('input');assetInput.type='file';assetInput.hidden=true;assetInput.accept='image/png,image/jpeg,image/webp,image/bmp,.ppm,.pgm,.txt,.mpy,.tdfont,.ttf,.otf';document.body.append(assetInput);
const assetButton=document.createElement('button');assetButton.textContent='Import image / text';assetButton.id='importAsset';document.querySelector('#import').after(assetButton);
let assetImportTarget=null;
assetButton.onclick=()=>{assetImportTarget=null;assetInput.click();};
assetInput.oncancel=()=>{assetImportTarget=null;};
const resourceButton=document.createElement('button');resourceButton.textContent='Resources';resourceButton.id='resources';assetButton.after(resourceButton);
resourceButton.onclick=()=>{
 try{
  const files=TDResources.inventory(design);
  openModal('Project resources','<p>Images, imported text and compiled modules travel with your project. The left Assets pane shows every resource and the elements using it.</p><div id="resourceList">'+(files.length?files.map((f,i)=>'<p><b>'+esc(f.name)+'</b> · '+(f.embedded?'Embedded in project':'External / not embedded')+' <button data-locate-resource="'+i+'">'+(f.embedded?'Replace':'Locate file')+'</button></p>').join(''):'<p>No resources yet. Use Import image / text to add one.</p>')+'</div>');
  document.querySelector('#resourceList').onclick=e=>{const b=e.target.closest('[data-locate-resource]');if(!b)return;assetImportTarget=files[Number(b.dataset.locateResource)].name;assetInput.click();};
 }catch(e){toast(e.message);}
};
function assetCanvas(){
 const c=current();if(c.obj.type==='canvas')return c.obj;
 const page=activePage(c.win),found=c.win.widgets.find(o=>o.type==='canvas'&&o.page===page);if(found){selected=found.id;return found;}
 const cv=TD.widget('canvas',unique('canvas'),0,0),size=TD.sizeOf(c.win,design);Object.assign(cv,{w:size.w,h:size.h,page});c.win.widgets.push(cv);selected=cv.id;return cv;
}
assetInput.onchange=async()=>{
 const file=assetInput.files?.[0];if(!file)return;
 try{
  if(file.size>4*1024*1024)throw Error('Import an image or text file up to 4 MiB.');
  const targetInfo=assetImportTarget?TDResources.inventory(design).find(f=>f.name===assetImportTarget):null;
  if(/\.(ttf|otf)$/i.test(file.name)){await openFontEditor(file);return;}
  if(/\.tdfont$/i.test(file.name)||targetInfo?.kind==='font'){
   if(targetInfo&&targetInfo.kind!=='font')throw Error('Choose a file matching the resource type. Import fonts as new assets.');
   const data=new Uint8Array(await file.arrayBuffer());TDFonts.decode(data);snapshot();
   TDResources.storeImage(design,{name:file.name,originalName:file.name,mime:'application/x-tinydesk-font',data:bytes64(data)},assetImportTarget);
   render();toast('Font embedded. Choose it in the text or button Inspector.');return;
  }
  if(/\.mpy$/i.test(file.name)||targetInfo?.kind==='module'){
   if(targetInfo&&targetInfo.kind!=='module')throw Error('Choose an image or text file for this resource.');
   const data=new Uint8Array(await file.arrayBuffer()),name=assetImportTarget||file.name,module=name.replace(/\.mpy$/i,'');
   if(data.length>2*1024*1024)throw Error('Choose a compiled module up to 2 MiB.');
   if(!name.endsWith('.mpy')||!TD.identifier(module)||data.length<4||data[0]!==77||data[1]!==6||(data[2]!==0&&(![10,11].includes((data[2]>>2)&0x2f)||(data[2]&3)!==3||(data[2]&0x40))))throw Error('Choose MicroPython v6 bytecode or an MPY 6.3 native module for ESP32/S3 (xtensawin) or C6 (rv32imc).');
   snapshot();design.binaryDependencies=[...(design.binaryDependencies||[]).filter(f=>f.name!==name),{name,originalName:file.name,data:bytes64(data)}];
   design.modules=[...new Set([...(design.modules||[]),module])];
   if(document.querySelector('#resourceList'))document.querySelector('#modal').close();
   render();toast('Embedded module '+name+'.');return;
  }
  if(file.name.toLowerCase().endsWith('.txt')){
   if(file.size>256*1024)throw Error('Choose a text source up to 256 KiB.');
   if(targetInfo&&targetInfo.kind!=='text')throw Error('Choose an image to repair this resource.');
   const lines=(await file.text()).replace(/\r/g,'').split('\n');snapshot();
   const data=new Uint8Array(await file.arrayBuffer()),name=assetImportTarget||file.name;
   if(/[\\/:\0]/.test(name)||new TextEncoder().encode(name).length>64)throw Error('Use a text filename up to 64 bytes.');
   design.assets=[...(design.assets||[]).filter(f=>f.name!==name),{name,originalName:file.name,mime:'text/plain',data:bytes64(data)}];
   if(!assetImportTarget){render();openTextImport(lines.join('\n'),name);return;}
   if(document.querySelector('#resourceList'))document.querySelector('#modal').close();
   render();toast('Text source embedded. Copied labels remain individually editable.');return;
  }
  if(targetInfo?.kind==='text')throw Error('Choose a .txt file to replace this text source.');
  let data,w,h,key=null;
  if(/\.(ppm|pgm)$/i.test(file.name)){
   data=new Uint8Array(await file.arrayBuffer());
   const match=new TextDecoder().decode(data.slice(0,256)).match(/^P[56]\s+(\d+)\s+(\d+)\s+255\s/);
   if(!match)throw Error('Use a binary P6 PPM or P5 PGM with an uncommented header and max value 255.');
   w=Number(match[1]);h=Number(match[2]);if(w>512||h>512||w<1||h<1)throw Error('Use an image up to 512 × 512.');
   if(data.length<match[0].length+w*h*(data[1]===53?1:3))throw Error('The image pixel data is truncated.');
  }else{
   const image=await createImageBitmap(file),ratio=Math.min(1,256/image.width,256/image.height);
   w=Math.max(1,Math.round(image.width*ratio));h=Math.max(1,Math.round(image.height*ratio));
   const surface=document.createElement('canvas');surface.width=w;surface.height=h;const context=surface.getContext('2d');context.drawImage(image,0,0,w,h);image.close();
   const rgba=context.getImageData(0,0,w,h).data,header=new TextEncoder().encode('P6\n'+w+' '+h+'\n255\n');data=new Uint8Array(header.length+w*h*3);data.set(header);
   for(let i=0;i<w*h;i++){const at=header.length+i*3;if(rgba[i*4+3]<128){data.set([255,0,255],at);key=[255,0,255];}else data.set(rgba.subarray(i*4,i*4+3),at);}
  }
  const suggested=file.name.replace(/\.[^.]*$/,'')+(/\.pgm$/i.test(file.name)?'.pgm':'.ppm');
  snapshot();const {name,linked}=TDResources.storeImage(design,{name:suggested,originalName:file.name,mime:'image/x-portable-pixmap',w,h,data:bytes64(data)},assetImportTarget);
  if(linked){
   if(document.querySelector('#modal[open]')&&document.querySelector('#resourceList'))document.querySelector('#modal').close();
   render();toast('Updated '+name+'. Existing elements now use the embedded image.');return;
  }
  const cv=assetCanvas();
  cv.paint.push({op:'picture',...TD.clone(TD.Pixels.defaults.picture),name:unique('image'),x:0,y:0,w:Math.min(cv.w,Math.max(1,Math.ceil(w/10))),h:Math.min(cv.h,Math.max(1,Math.ceil(h/20))),asset:{path:'/root/'+name,w,h,key,dither:false},text:'',border:0});
  render();toast('Image stored with your project. Export app includes it automatically.');
 }catch(e){toast(e.message);}finally{assetInput.value='';assetImportTarget=null;}
};
draw(); /* Restore embedded image previews after a reload too. */
