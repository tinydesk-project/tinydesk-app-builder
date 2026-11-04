/* Project bus settings and per-element register bindings in the fixed Inspector. */
'use strict';
const communicationButton=document.createElement('button');communicationButton.id='communicationSettings';communicationButton.textContent='Communications';
document.querySelector('#exportOptions').before(communicationButton);
const commModes={none:'None',modbus_master:'Modbus master (RTU)',modbus_slave:'Modbus slave (RTU)',uart_master:'UART master',uart_slave:'UART slave'};
function commSelect(key,label,value,choices){return '<label class="field"><span>'+esc(label)+'</span><select data-comm="'+key+'">'+choices.map(([k,v])=>'<option value="'+esc(k)+'" '+(String(value)===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';}
function commInput(key,label,value,type='number'){return '<label class="field"><span>'+esc(label)+'</span><input data-comm="'+key+'" type="'+type+'" value="'+esc(value??'')+'"></label>';}
communicationButton.onclick=()=>{
 if(document.querySelector('#rightPanel').classList.contains('collapsed'))document.querySelector('[aria-label="Open Inspector"]').click();
 document.querySelector('.inspector-tabs').hidden=true;document.querySelector('#typeTag').textContent='COMMUNICATION';
 const pane=document.querySelector('#inspector'),c={...TDCommunications.defaults,...design.communication};
 const choices=TDCommunications.bindings(design).map(b=>b.name);
 const texts=design.windows.flatMap(w=>w.widgets.flatMap(o=>[...(['label','textbox'].includes(o.type)?[o.name]:[]),...o.paint.filter(p=>p.name&&['put','big','draw_text','font_text','picture'].includes(p.op)).map(p=>p.name)]));
 pane.innerHTML='<h2>Communications</h2><p class="hint">One serial connection per app. Register addresses are zero-based. Settings and the runtime are included in every export.</p>'+commSelect('mode','App communication',c.mode,Object.entries(commModes))+
 (c.mode==='none'?'<p class="hint">No UART is opened. Existing element bindings are retained but inactive.</p>':
 '<h3>Serial port</h3>'+commInput('uart','UART number',c.uart)+commInput('tx','TX GPIO',c.tx)+commInput('rx','RX GPIO',c.rx)+commInput('baud','Baud rate',c.baud)+commSelect('bits','Data bits',c.bits,['5','6','7','8'].map(x=>[x,x]))+commSelect('parity','Parity',c.parity,[['none','None'],['even','Even'],['odd','Odd']])+commSelect('stop','Stop bits',c.stop,[['1','1'],['2','2']])+commInput('de','RS-485 DE GPIO (−1 = automatic / none)',c.de)+commSelect('deActive','DE active level',c.deActive,[['1','High'],['0','Low']])+
 '<p class="hint">Choose pins for your board. TinyDesk rejects reserved console/RS-485 UARTs and unavailable GPIOs; these settings do not change system reservations.</p>'+commInput('unit',c.mode.endsWith('master')?'Remote station / unit':'Own station / unit',c.unit)+
 (c.mode.endsWith('slave')?'<h3>Local register bank</h3>'+commInput('registerCount','Holding register count (0 = bound addresses only)',c.registerCount)+commSelect('inputAlias','FC04 input registers mirror holding bank',String(c.inputAlias),[['false','No'],['true','Yes']]):'')+
 '<h3>Timing</h3>'+commInput('pollMs','Polling interval (ms)',c.pollMs)+commInput('timeoutMs','Reply timeout (ms)',c.timeoutMs)+commInput('retries','Read retries (writes are not retried)',c.retries)+commInput('staleMs','Stale after (ms)',c.staleMs)+
 commSelect('statusElement','Connection status element',c.statusElement,[['','None'],...texts.filter(n=>!choices.includes(n)).map(n=>[n,n])])+
 (c.mode.startsWith('uart')?'<h3>UART protocol</h3>'+commSelect('codec','Register message format',c.codec,[['rtu','Modbus RTU register frames'],['json','JSON Lines registers'],['custom','Custom Python codec']])+ (c.codec==='custom'?commInput('codecModule','Codec module name',c.codecModule,'text')+commSelect('framing','Frame boundary',c.framing,[['newline','Newline'],['idle','Serial idle gap']])+'<button id="downloadCodecTemplate">Download codec template</button><p class="hint">Module exports encode(message) → bytes and decode(frame) → register message. Import its matching .mpy dependency or give its .py file to the local helper. The codec translates your wire format.</p>':''):'<p class="hint">Modbus uses RTU frames, CRC16 and 8 data bits. Tables: coils, discrete inputs, holding registers and input registers. Supported functions: 01–06, 15 and 16.</p>')+
 '<p class="hint">Select an element to set Register binding. Master modes poll the remote station; slave modes expose the app’s mapped local registers. The simulator always uses an isolated local bank. A timeout does not block page rendering; writes need a fresh device reply.</p>')+'<p role="alert" id="communicationErrors"></p>';
 pane.onchange=null;pane.parentElement.scrollTop=0;
 for(const input of pane.querySelectorAll('[data-comm]'))input.onchange=()=>{
  const next={...c};for(const el of pane.querySelectorAll('[data-comm]')){const key=el.dataset.comm;next[key]=typeof TDCommunications.defaults[key]==='boolean'?el.value==='true':typeof TDCommunications.defaults[key]==='number'||['tx','rx'].includes(key)?el.value===''?null:Number(el.value):el.value;}
  if(next.mode.startsWith('modbus')){next.bits=8;next.codec='rtu';}
  snapshot();
  const custom=next.mode.startsWith('uart')&&next.codec==='custom';
  if(c.managedCodecModule&&(!custom||next.codecModule!==c.managedCodecModule)){
   if(!Object.values(design.handlers).some(h=>h.body.includes(c.managedCodecModule)))design.modules=(design.modules||[]).filter(n=>n!==c.managedCodecModule);
   delete next.managedCodecModule;
  }
  if(custom&&/^[A-Za-z_]\w*$/.test(next.codecModule)&&!(design.modules||[]).includes(next.codecModule)){design.modules=[...(design.modules||[]),next.codecModule];next.managedCodecModule=next.codecModule;}
  design.communication=next;
  const scroll=[pane,pane.parentElement,document.querySelector('#rightPanel')].map(el=>[el,el.scrollTop]);
  update();
  if(['mode','codec'].includes(input.dataset.comm)){communicationButton.onclick();for(const[el,top]of scroll)el.scrollTop=top;}
  else{Object.assign(c,next);pane.querySelector('#communicationErrors').textContent=TDCommunications.validate(design).errors.join(' ');}
 };
 if(c.mode!=='none')pane.querySelector('#communicationErrors').textContent=TDCommunications.validate(design).errors.join(' ');
 const template=pane.querySelector('#downloadCodecTemplate');if(template)template.onclick=()=>download((c.codecModule||'my_uart_codec')+'.py','# Custom UART codec contract 1. Replace JSON with your device frame format.\nimport json\ndef encode(message):\n    return json.dumps(message).encode()\ndef decode(frame):\n    return json.loads(frame)\n','text/x-python');
};
window.TDRegisterInspector=(pane,p,save)=>{
 if(!design.communication||design.communication.mode==='none'||!TDCommunications.supported(p))return;
 const kind=p.op||p.type,bit=kind==='checkbox',b={...TDCommunications.bindingDefaults,...(kind==='button'?{direction:'write',action:'constant'}:{}),...(['checkbox','slider'].includes(kind)?{event:'change'}:kind==='textbox'?{event:'enter'}:{}),...(bit?{table:'co',max:1}:{}),...p.binding};
 const box=document.createElement('section');box.className='register-binding';pane.append(box);
 const select=(key,label,choices)=>'<label class="field"><span>'+esc(label)+'</span><select data-binding="'+key+'">'+choices.map(([v,label])=>'<option value="'+v+'" '+(b[key]===v?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>';
 const input=(key,label)=>'<label class="field"><span>'+esc(label)+'</span><input data-binding="'+key+'" type="'+(typeof b[key]==='number'?'number':'text')+'" value="'+esc(b[key])+'"></label>';
 box.innerHTML='<h3>Register binding</h3><label class="field check"><input id="registerEnabled" type="checkbox" '+(p.binding?'checked':'')+'>Bind element to '+esc(commModes[design.communication.mode])+'</label>';
 if(p.binding){
  box.innerHTML+=select('direction','Register access',[['read','Read → display'],...(['button','checkbox','textbox','slider'].includes(kind)?[['write','Write on event'],['readwrite','Read and write']]:[])])+select('table','Register table',[['co','Coils (0x)'],['di','Discrete inputs (1x)'],['hr','Holding registers (4x)'],['ir','Input registers (3x)']])+input('address','Register address (zero-based)')+
  select('dataType','Data type',[['u16','Unsigned 16 bit'],['i16','Signed 16 bit'],['u32','Unsigned 32 bit'],['i32','Signed 32 bit'],['f32','Float 32 bit']])+select('wordOrder','32-bit word order',[['high_first','High word first (ABCD)'],['low_first','Low word first (CDAB)']])+input('gain','Scale multiplier')+input('offset','Scale offset')+input('decimals','Decimal places')+input('prefix','Text prefix')+input('suffix','Text suffix')+input('min','Minimum writable value')+input('max','Maximum writable value')+input('initial','Initial / simulated value');
  if(b.direction!=='read')box.innerHTML+=select('event','Write event',kind==='button'?[['click','Click'],...(p.op==='button'?[['press','Press'],['release','Release']]:[])]:kind==='textbox'?[['enter','Enter']]:[['change','Change']])+select('action','Write action',[['value','Control value'],['constant','Constant'],['toggle','Toggle between constants'],...(p.op==='button'?[['momentary','Momentary (press / release)']]:[])])+input('writeValue','Write / pressed constant')+input('releaseValue','Off / released constant');
  box.innerHTML+='<p class="hint">Displayed = register × multiplier + offset. Writes apply the inverse scale and limits. 32-bit values use two registers. Master writes wait for a fresh reply; reads also verify write-only addresses. Slave bindings use local register values.</p>';
 }
 const commit=(binding,refresh=true)=>{const scroll=[pane,pane.parentElement,document.querySelector('#rightPanel')].map(el=>[el,el.scrollTop]);save(binding,refresh);for(const[el,top]of scroll)el.scrollTop=top;};
 box.querySelector('#registerEnabled').onchange=e=>commit(e.target.checked?b:null);
 for(const el of box.querySelectorAll('[data-binding]'))el.onchange=()=>{const next={...b};for(const input of box.querySelectorAll('[data-binding]'))next[input.dataset.binding]=typeof b[input.dataset.binding]==='number'?Number(input.value):input.value;commit(next,el.dataset.binding==='direction');};
};
const communicationInspectorBase=renderInspector;
renderInspector=function(){communicationInspectorBase();if(multiItems().length>1||tab!=='properties')return;const {obj:p}=current();if(!p.type||p.type==='canvas')return;window.TDRegisterInspector(document.querySelector('#inspector'),p,(binding,refresh)=>{snapshot();if(binding)p.binding=binding;else delete p.binding;if(refresh)render();else update();});};
