/* Versioned serial/register contract shared by validation, UI and export. */
(function(root){
'use strict';
const runtime=typeof module!=='undefined'?require('./communication-runtime.js'):root.TDCommunicationRuntime;
const defaults={version:1,mode:'none',uart:1,tx:null,rx:null,baud:9600,bits:8,parity:'none',stop:1,de:-1,deActive:1,unit:1,pollMs:250,timeoutMs:300,retries:1,staleMs:2000,codec:'rtu',codecModule:'',framing:'newline',statusElement:'',registerCount:0,inputAlias:false};
const bindingDefaults={direction:'read',table:'hr',address:0,dataType:'u16',wordOrder:'high_first',gain:1,offset:0,decimals:0,prefix:'',suffix:'',event:'click',action:'value',writeValue:1,releaseValue:0,min:0,max:65535,initial:0};
const modes=['none','modbus_master','modbus_slave','uart_master','uart_slave'];
const supported=p=>['label','textbox','progress','checkbox','button'].includes(p.type)||['put','big','draw_text','font_text','picture','bar','gauge','slider','button'].includes(p.op);
const bindings=d=>d.windows.flatMap(w=>w.widgets.flatMap(o=>[...(o.binding?[{name:o.name,object:o,kind:o.type}]:[]),...o.paint.filter(p=>p.binding).map(p=>({name:p.name,object:p,kind:p.op}))]));
function validate(d){
 const c={...defaults,...d.communication},errors=[],warnings=[],bs=bindings(d),check=(test,msg)=>{if(!test)errors.push(msg);},int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
 check(c.version===1&&modes.includes(c.mode),'Communication: unsupported configuration version or mode.');
 if(c.mode==='none'){if(bs.length)warnings.push('Register bindings are inactive while Communications is None.');return {errors,warnings};}
 check(int(c.uart,0,2),'Communication: UART must be 0–2; available ports depend on the chip.');
 check(int(c.tx,0,48)&&int(c.rx,0,48)&&c.tx!==c.rx,'Communication: choose different TX/RX GPIO pins (0–48).');
 check(int(c.de,-1,48)&&![c.tx,c.rx].includes(c.de),'Communication: optional DE GPIO must differ from TX/RX.');
 check(int(c.baud,300,3000000)&&int(c.bits,5,8)&&['none','even','odd'].includes(c.parity)&&[1,2].includes(c.stop),'Communication: invalid baud/data bits/parity/stop bits.');
 check([0,1].includes(c.deActive)&&int(c.unit,1,247),'Communication: choose DE active 0/1 and station 1–247.');
 check(int(c.pollMs,50,60000)&&int(c.timeoutMs,20,10000)&&int(c.retries,0,3)&&int(c.staleMs,c.timeoutMs,600000),'Communication: invalid polling, timeout, retries or stale interval.');
 check(['rtu','json','custom'].includes(c.codec),'Communication: choose a supported UART codec.');
 if(c.mode.startsWith('modbus')||c.codec==='rtu')check(c.bits===8,'Modbus RTU requires 8 data bits.');
 if(c.mode.startsWith('uart')&&c.codec==='custom'){
  check(/^[A-Za-z_]\w{0,31}$/.test(c.codecModule)&&!['machine','tdui','_tdui','time','utime','json','ujson','struct','ustruct','sys','os','micropython','tinydesk','_tdapp_main','tdapp_boot'].includes(c.codecModule),'Custom UART codec needs its own Python module name.');
  check((d.modules||[]).includes(c.codecModule),'Declare the custom UART codec module in Export options.');
  check(['newline','idle'].includes(c.framing),'Custom UART framing must be newline or idle gap.');
 }
 check(bs.length<=128,'Communication: use at most 128 bound elements.');
 check(int(c.registerCount,0,1024)&&typeof c.inputAlias==='boolean','Communication: local holding bank must contain 0–1024 registers.');
 if(c.statusElement){const status=d.windows.flatMap(w=>w.widgets.flatMap(o=>[o,...o.paint])).find(p=>p.name===c.statusElement);check(status&&supported(status)&&!bs.some(b=>b.name===c.statusElement)&&!['progress','checkbox','button','slider','gauge','bar'].includes(status.op||status.type),'Communication: choose an unbound text element for connection status.');}
 for(const {name,object:p,kind}of bs){const b={...bindingDefaults,...p.binding},tag=(name||kind)+' register binding: ';
  check(supported(p)&&!!name,tag+'use a supported named element.');
  check(['read','write','readwrite'].includes(b.direction)&&['co','di','hr','ir'].includes(b.table),tag+'invalid direction/table.');
  check(['u16','i16','u32','i32','f32'].includes(b.dataType)&&['high_first','low_first'].includes(b.wordOrder),tag+'invalid data type/word order.');
  check(!['co','di'].includes(b.table)||b.dataType==='u16',tag+'bit tables use u16 (0 or 1).');
  check(int(b.address,0,['u32','i32','f32'].includes(b.dataType)?65534:65535),tag+'address is zero-based and must fit the data type.');
  check(Number.isFinite(b.gain)&&b.gain!==0&&Number.isFinite(b.offset)&&int(b.decimals,0,6),tag+'invalid scale/decimals.');
  check([b.min,b.max,b.initial,b.writeValue,b.releaseValue].every(Number.isFinite)&&b.min<=b.max,tag+'invalid numeric limits/defaults.');
  const raw=(b.initial-b.offset)/b.gain,limits={u16:[0,65535],i16:[-32768,32767],u32:[0,4294967295],i32:[-2147483648,2147483647],f32:[-3.4028234e38,3.4028234e38]}[b.dataType];
  check(limits&&raw>=limits[0]&&raw<=limits[1]&&b.initial>=b.min&&b.initial<=b.max&&(!['co','di'].includes(b.table)||raw===0||raw===1),tag+'initial value does not fit the configured type, limits or scaling.');
  check(typeof b.prefix==='string'&&typeof b.suffix==='string'&&b.prefix.length+b.suffix.length<=32,tag+'prefix/suffix must total at most 32 characters.');
  if(b.direction!=='read'){
   check(!['di','ir'].includes(b.table),tag+'discrete/input tables are read-only.');
   check(['button','checkbox','textbox','slider'].includes(kind),tag+'writing needs a button, checkbox, textbox or slider.');
   const events=kind==='button'?['click',...(p.op==='button'?['press','release']:[])]:kind==='textbox'?['enter']:['change'];
   check(events.includes(b.event),tag+'choose an event supported by this control.');
   check(['value','constant','toggle','momentary'].includes(b.action),tag+'invalid write action.');
   check(b.action!=='momentary'||p.op==='button',tag+'momentary writes need a canvas button with press/release events.');
  }
 }
 warnings.push('Serial I/O requires root and available UART/GPIO pins. Reserved console/RS-485 ports are rejected at runtime. Simulation uses an isolated register bank.');
 return {errors,warnings};
}
function preamble(d){return d.communication&&d.communication.mode!=='none'?runtime: '';}
function simulationModules(d){const c=d.communication;return (d.modules||[]).filter(n=>!(c?.mode.startsWith('uart')&&c.codec==='custom'&&c.codecModule===n&&!Object.values(d.handlers).some(h=>h.body.includes(n))));}
function setup(d,simulation=false){
 if(!d.communication||d.communication.mode==='none')return [];
 const literal=v=>v===null?'None':typeof v==='boolean'?(v?'True':'False'):Array.isArray(v)?'['+v.map(literal).join(',')+']':v&&typeof v==='object'?'{'+Object.entries(v).map(([k,x])=>JSON.stringify(k)+':'+literal(x)).join(',')+'}':JSON.stringify(v);
 const c={...defaults,...d.communication};if(c.mode.startsWith('modbus'))c.codec='rtu';
 return ['_td_link = _TDLink('+literal(c)+', simulated='+(simulation?'True':'False')+')',
 ...(c.statusElement?['_td_link.status_target = '+c.statusElement]:[]),
 ...bindings(d).map(({name,object:p,kind})=>'_td_link.bind('+name+', '+literal({...bindingDefaults,...p.binding})+', '+JSON.stringify(kind)+')'),
 '_td_link.start()',d.windows[0].name+'.every(10, _td_link.tick)'];
}
const api={defaults,bindingDefaults,modes,supported,bindings,validate,preamble,setup,simulationModules};if(typeof module!=='undefined')module.exports=api;else root.TDCommunications=api;
})(typeof window!=='undefined'?window:globalThis);
