/* Common controls use the same drawing operations as imported projects. */
'use strict';
const gallery=document.createElement('section');gallery.className='control-gallery';gallery.innerHTML='<h3>GUI elements</h3>';
for(const [label,kind] of [['Text','text'],['Button','button'],['Slider','slider'],['Gauge','gauge'],['Meter','bar'],['Rectangle','rect'],['Smooth panel','smooth_panel'],['QR code','qr'],['Image','image']]){
 const button=document.createElement('button');button.textContent=label;button.onclick=()=>{
  if(kind==='image'){assetImportTarget=null;assetInput.click();return;}
  snapshot();const cv=assetCanvas();
  if(kind==='qr'){/* 200 x 200 px with PSRAM, 100 x 100 px (about 10 KB) on small boards; within the canvas */
   let w=Math.min(design.board>2000?20:10,cv.w-2,2*(cv.h-2));w-=w%2;if(w<4)throw Error('This canvas is too small for a QR code.');
   const made=TDQr.apply({name:unique('qr'),x:Math.min(2,cv.w-w),y:Math.min(2,cv.h-w/2),w,h:w/2},{});if(!design.assets?.some(a=>a.name===made.file.name))TDResources.storeImage(design,made.file);cv.paint.push(made.element);render();editPixel(cv.paint.length-1);return;}
  if(kind==='smooth_panel'){const resource=TDAppearance.resourceFor(design.assets,TDBuiltinAssets['ui_skin.ppm'],'td_smooth_panel.ppm');if(!design.assets?.some(a=>a.name===resource.name))TDResources.storeImage(design,resource);const p=TDAppearance.smoothPanel({op:'rect',name:unique('panel'),x:2,y:2,w:Math.min(40,cv.w*2-2),h:Math.min(12,cv.h*2-2)},resource.name);cv.paint.push(p);render();editPixel(cv.paint.length-1);return;}
  const p=kind==='text'?{op:'put',name:unique('text'),x:1,y:1,text:'Label',fg:231,bg:25}:{op:kind,...TD.clone(TD.Pixels.defaults[kind]),name:unique(kind)};
  if(kind==='gauge'){p.w=Math.min(p.w,cv.w*2);p.h=Math.min(p.h,cv.h*2);}
  else if('w' in p)p.w=Math.min(p.w,kind==='button'||kind==='slider'?cv.w:cv.w*2);
  if('h' in p)p.h=Math.min(p.h,kind==='button'||kind==='slider'?cv.h:cv.h*2);
  cv.paint.push(p);render();editPixel(cv.paint.length-1);
 };gallery.append(button);
}
document.querySelector('#palette').after(gallery);
