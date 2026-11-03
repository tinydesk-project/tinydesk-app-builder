/* Shared gradient controls for solid shapes and interactive controls. */
'use strict';
const gradientKinds=new Set(['rect','circle','bar','slider','gauge','button']);
const gradientHex=rgb=>'#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
const gradientRgb=hex=>[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16));
function gradientControls(root,values,apply){
 const section=document.createElement('fieldset');section.className='gradient-fields';
 const first=values[0]?.gradient,uniform=values.every(p=>JSON.stringify(p.gradient)===JSON.stringify(first));
 section.innerHTML='<legend>Gradient fill</legend><label class="field"><span>Use gradient'+(!uniform?' · mixed':'')+'</span><input id="gradientEnabled" type="checkbox" '+(first?'checked':'')+'></label><label class="field"><span>Start color</span><input id="gradientStart" type="color" value="'+gradientHex(first?.rgb1||[32,128,240])+'"></label><label class="field"><span>End color</span><input id="gradientEnd" type="color" value="'+gradientHex(first?.rgb2||[0,48,112])+'"></label><label class="field"><span>Direction</span><select id="gradientDirection"><option value="vertical">Top to bottom</option><option value="horizontal" '+(first?.across?'selected':'')+'>Left to right</option></select></label>';
 const enabled=section.querySelector('#gradientEnabled');enabled.indeterminate=!uniform;
 for(const el of section.querySelectorAll('input,select'))el.onchange=()=>{if(el!==enabled)enabled.checked=true;enabled.indeterminate=false;apply(enabled.checked?{rgb1:gradientRgb(section.querySelector('#gradientStart').value),rgb2:gradientRgb(section.querySelector('#gradientEnd').value),across:section.querySelector('#gradientDirection').value==='horizontal'}:null,({gradientStart:'rgb1',gradientEnd:'rgb2',gradientDirection:'across'}[el.id]||'enabled'));};
 (root.querySelector('.pixel-fields')||root).append(section);
}
window.TDGradientInspector=(root,op,apply)=>{
 if(!gradientKinds.has(op.op))return;
 if(op.op==='button'&&op.asset){const p=document.createElement('p');p.className='hint';p.textContent='The sprite sheet supplies this button’s gradient. Disable its image skin to use a geometric gradient fill.';root.append(p);return;}
 gradientControls(root,[op],apply);
};
window.TDGradientGroup=(root,items)=>{
 if(!items.every(i=>gradientKinds.has(i.p.op)&&!(i.p.op==='button'&&i.p.asset)))return;
 gradientControls(root,items.map(i=>i.p),(gradient,key)=>{const before=items.map(i=>({...i,old:TD.clone(i.p)}));for(const i of items){if(gradient)i.p.gradient=key==='enabled'?(i.p.gradient||TD.clone(gradient)):{...(i.p.gradient||gradient),[key]:TD.clone(gradient[key])};else delete i.p.gradient;}if(multiCommit(before)){snapshotFrom(before);render();}});
};
