/* Common controls use the same drawing operations as imported projects. */
'use strict';
const gallery=document.createElement('section');gallery.className='control-gallery';gallery.innerHTML='<h3>GUI elements</h3>';
for(const [label,kind] of [['Text','text'],['Button','button'],['Slider','slider'],['Gauge','gauge'],['Meter','bar'],['Panel','rect'],['Image','image']]){
 const button=document.createElement('button');button.textContent=label;button.onclick=()=>{
  if(kind==='image'){assetImportTarget=null;assetInput.click();return;}
  snapshot();const cv=assetCanvas();
  const p=kind==='text'?{op:'put',name:unique('text'),x:1,y:1,text:'Label',fg:231,bg:25}:{op:kind,...TD.clone(TD.Pixels.defaults[kind]),name:unique(kind)};
  if(kind==='gauge'){p.w=Math.min(p.w,cv.w*2);p.h=Math.min(p.h,cv.h*2);}
  else if('w' in p)p.w=Math.min(p.w,kind==='button'||kind==='slider'?cv.w:cv.w*2);
  if('h' in p)p.h=Math.min(p.h,kind==='button'||kind==='slider'?cv.h:cv.h*2);
  cv.paint.push(p);render();editPixel(cv.paint.length-1);
 };gallery.append(button);
}
document.querySelector('#palette').after(gallery);
