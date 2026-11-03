/* The terminal's real 256-color palette, shared by all property editors. */
'use strict';
function showElementPalette(anchor,choose,special=[]){
 document.querySelector('.element-palette')?.remove();
 const panel=document.createElement('section');panel.className='element-palette';
 panel.innerHTML='<strong>Color palette</strong><button type="button" class="palette-close" aria-label="Close palette">×</button><label class="field">Custom color · nearest device color<input type="color" value="#ffffff"></label><div class="palette-grid"></div>';
 for(const [n,label] of special){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{choose(n);panel.remove();};panel.append(b);}
 const grid=panel.querySelector('.palette-grid');
 for(let i=0;i<256;i++){const b=document.createElement('button');b.type='button';b.style.background=color(i);b.title=i+' · '+color(i);b.setAttribute('aria-label','Palette color '+i);b.onclick=()=>{choose(i);panel.remove();};grid.append(b);}
 panel.querySelector('.palette-close').onclick=()=>panel.remove();
 panel.querySelector('input').onchange=e=>{
  const rgb=s=>s.startsWith('#')?[1,3,5].map(at=>parseInt(s.slice(at,at+2),16)):s.match(/\d+/g).map(Number),target=rgb(e.target.value);let best=0,distance=Infinity;
  for(let i=0;i<256;i++){const candidate=rgb(color(i)),d=candidate.reduce((sum,n,j)=>sum+(n-target[j])**2,0);if(d<distance){distance=d;best=i;}}
  choose(best);panel.remove();
 };
 (anchor.closest('.field')||anchor).after(panel);
}
document.querySelector('#inspector').addEventListener('click',e=>{
 const b=e.target.closest('[data-element-color],[data-color]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
 const key=b.dataset.elementColor||b.dataset.color;
 showElementPalette(b,value=>{
  const input=document.querySelector('#inspector [data-pixel-key="'+key+'"]');
  if(input){const css=color(value),rgb=css.startsWith('#')?[1,3,5].map(at=>parseInt(css.slice(at,at+2),16)):css.match(/\d+/g).map(Number);input.value=['rgb1','rgb2'].includes(key)?JSON.stringify(rgb):value;input.dispatchEvent(new Event('input',{bubbles:true}));b.style.background=value>=0?css:'transparent';}
  else{snapshot();current().obj[key]=value;render();}
 },b.dataset.elementColor?(key==='bg'?[[-1,'Theme default'],[-2,'Transparent']]:[]):[[-1,'Theme default']]);
},true);
