'use strict';
/* The QR code fields of a QR picture (an element made by TDQr.apply). */
window.TDQrInspector=(root,p,save)=>{
 if(p.op!=='picture'||!p.qr)return;
 const section=document.createElement('fieldset');section.className='gradient-fields';const q={...TDQr.defaults,...p.qr};
 section.innerHTML='<legend>QR code</legend><p class="hint">Generated as a small picture, one pixel per module, scaled by a whole number to the box: sharp and quick to load. Keep the box square (width in cells twice the height).</p><label class="field">QR text<input data-qr="text" maxlength="106"></label><label class="field">Dark modules<input type="color" data-qr="fg"></label><label class="field">Light modules<input type="color" data-qr="bg"></label><button type="button" id="applyQr">Update QR code</button>';
 for(const el of section.querySelectorAll('[data-qr]'))el.value=q[el.dataset.qr];
 const apply=()=>{try{const next={...q};for(const el of section.querySelectorAll('[data-qr]'))next[el.dataset.qr]=el.value;save(next);}catch(e){toast(e.message);}};
 section.querySelector('button').onclick=apply;for(const el of section.querySelectorAll('input[type=color]'))el.onchange=apply;
 const host=root.querySelector('.pixel-fields');if(host)host.before(section);else root.append(section);
};
