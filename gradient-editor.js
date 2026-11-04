/* Shared gradient controls for solid shapes and interactive controls. */
'use strict';
const gradientKinds=new Set(['rect','circle','bar','slider','gauge','button']);
const gradientHex=rgb=>'#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
const gradientRgb=hex=>[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16));
function gradientControls(root,values,apply){
 const section=document.createElement('fieldset');section.className='gradient-fields';
 const first=values[0]?.gradient,all=key=>values.every(p=>JSON.stringify(p.gradient?.[key])===JSON.stringify(first?.[key]));
 const sameEnabled=values.every(p=>!!p.gradient===!!first);
 const hex=(key,fallback)=>all(key)?gradientHex(first?.[key]||fallback):'';
 const start=hex('rgb1',[32,128,240]),end=hex('rgb2',[0,48,112]),sameDirection=all('across');
 section.innerHTML='<legend>Gradient fill</legend><label class="field"><span>Use gradient'+(!sameEnabled?' · mixed':'')+'</span><input id="gradientEnabled" type="checkbox" '+(first?'checked':'')+'></label>'+[['Start','rgb1',start],['End','rgb2',end]].map(([name,key,value])=>'<label class="field"><span>'+name+' color</span><input id="gradient'+name+'" type="text" aria-label="Gradient '+name.toLowerCase()+' color" value="'+value+'" placeholder="Mixed"><input id="gradient'+name+'Picker" type="color" aria-label="Choose gradient '+name.toLowerCase()+' color" value="'+(value||'#2080f0')+'" '+(!value?'style="opacity:.3" title="Mixed colors; choose to apply"':'')+'></label>').join('')+'<label class="field"><span>Direction</span><select id="gradientDirection"><option value="" '+(!sameDirection?'selected':'')+'>Mixed</option><option value="vertical" '+(sameDirection&&!first?.across?'selected':'')+'>Top to bottom</option><option value="horizontal" '+(sameDirection&&first?.across?'selected':'')+'>Left to right</option></select></label><p class="hint">Blank fields have different values. Changing one field preserves the others on each element.</p>';
 const enabled=section.querySelector('#gradientEnabled');enabled.indeterminate=!sameEnabled;
 for(const el of section.querySelectorAll('input,select'))el.onchange=()=>{
  const key=({gradientStart:'rgb1',gradientEnd:'rgb2',gradientDirection:'across'}[el.id.replace('Picker','')]||'enabled');
  if(el.id.endsWith('Picker'))section.querySelector('#'+el.id.replace('Picker','')).value=el.value;
  if(key==='across'&&!el.value)return;
  if(['rgb1','rgb2'].includes(key)&&!/^#[0-9a-f]{6}$/i.test(section.querySelector('#'+el.id.replace('Picker','')).value)){el.setCustomValidity('Use #rrggbb.');el.reportValidity();return;}el.setCustomValidity('');
  if(el!==enabled)enabled.checked=true;enabled.indeterminate=false;
  apply(enabled.checked?{rgb1:gradientRgb(section.querySelector('#gradientStart').value||'#2080f0'),rgb2:gradientRgb(section.querySelector('#gradientEnd').value||'#003070'),across:section.querySelector('#gradientDirection').value==='horizontal'}:null,key);
 };
 for(const el of section.querySelectorAll('input[type="text"]'))el.oninput=()=>{if(/^#[0-9a-f]{6}$/i.test(el.value))el.onchange();};
 const host=root.querySelector('.pixel-fields')||root,actions=host.querySelector('#groupError');
 if(actions)actions.before(section);else host.append(section);
}
window.TDGradientInspector=(root,op,apply)=>{
 if(!gradientKinds.has(op.op)||op.surfaceStyle)return;
 if(op.op==='button'&&op.asset){const p=document.createElement('p');p.className='hint';p.textContent='Enabling a geometric gradient replaces this button image skin.';root.append(p);}
 gradientControls(root,[op],apply);
};
window.TDGradientGroup=(root,items)=>{
 if(!items.every(i=>gradientKinds.has(i.p.op)))return;
 gradientControls(root,items.map(i=>i.p),(gradient,key)=>{const before=items.map(i=>({...i,old:TD.clone(i.p)}));for(const i of items){if(gradient&&i.p.op==='button'&&i.p.asset){delete i.p.asset;delete i.p.src;delete i.p.src_down;delete i.p.border;}if(gradient)i.p.gradient=key==='enabled'?(i.p.gradient||TD.clone(gradient)):{...(i.p.gradient||gradient),[key]:TD.clone(gradient[key])};else delete i.p.gradient;}if(multiCommit(before)){snapshotFrom(before);render();}});
};
