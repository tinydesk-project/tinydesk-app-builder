/* Shared design model and MicroPython generator. No network or runtime dependencies. */
(function(root){
'use strict';
const Pixels=typeof module!=='undefined'?require('./pixels.js'):root.TDPixels;
const Fonts=typeof module!=='undefined'?require('./fonts.js'):root.TDFonts;
const Communications=typeof module!=='undefined'?require('./communications.js'):root.TDCommunications;
const TYPES=['label','button','checkbox','textbox','progress','list','canvas'];
const EVENTS={window:{on_ready:'win',on_close:'win',on_key:'win, key',on_resize:'win, w, h'},label:{},button:{on_click:'button'},checkbox:{on_change:'box'},textbox:{on_enter:'textbox',on_change:'textbox'},progress:{},list:{on_select:'items',on_activate:'items'},canvas:{on_mouse:'cv, x, y, button, action'}};
const KEYWORDS=new Set(('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield').split(' '));
const identifier=s=>typeof s==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)&&!KEYWORDS.has(s);
const bytes=s=>new TextEncoder().encode(s).length;
const py=v=>typeof v==='boolean'?(v?'True':'False'):v===null?'None':JSON.stringify(v);
const clone=v=>JSON.parse(JSON.stringify(v));
function widget(type,name,x=2,y=2){return {id:name,type,name,x,y,w:type==='canvas'?24:type==='list'?20:18,h:type==='canvas'?4:4,text:{label:'Label',button:'Button',checkbox:'Enabled',textbox:'',progress:'',list:'',canvas:''}[type],checked:false,secret:false,value:65,fg:-1,bg:-1,visible:true,events:{},page:'main',goToPage:null,items:['First item','Second item','Third item'],paint:[]};}
function windowModel(n=1){return {id:'window_'+n,name:n===1?'win':'win_'+n,title:n===1?'Device monitor':'Window '+n,w:62,h:19,x:null,y:null,resizable:true,fullscreen:false,events:{},timers:[],widgets:[],pages:[{id:'main',name:'Main'}],initialPage:'main',tabs:{enabled:false,row:-1}};}
function initial(){const w=windowModel();w.widgets=[Object.assign(widget('label','heading',3,1),{text:'DEVICE MONITOR',w:28,fg:115}),Object.assign(widget('label','subtitle',3,2),{text:'ESP32 / System overview',w:40,fg:244}),Object.assign(widget('label','device_label',3,4),{text:'Device name',w:20}),Object.assign(widget('textbox','device_name',3,5),{text:'workbench-01',w:25}),Object.assign(widget('checkbox','auto_refresh',3,7),{text:'Auto refresh',checked:true}),Object.assign(widget('label','load_label',3,9),{text:'Memory usage   65%',w:25}),Object.assign(widget('progress','memory',3,10),{w:25,value:65,fg:78}),Object.assign(widget('button','refresh',3,13),{text:'Refresh',events:{on_click:'refresh_device'}}),Object.assign(widget('button','close_button',17,13),{text:'Close',events:{on_click:'close_app'}}),Object.assign(widget('list','devices',33,4),{w:25,h:5,items:['workbench-01','sensor-node-02','display-node-03']}),Object.assign(widget('canvas','status',33,11),{w:25,h:4,paint:[{op:'fill',x:0,y:0,w:25,h:4,ch:' ',fg:115,bg:234},{op:'put',x:2,y:1,text:'● SYSTEM ONLINE',fg:115,bg:234},{op:'put',x:2,y:2,text:'All services healthy',fg:244,bg:234}]}),Object.assign(widget('label','footnote',3,17),{text:'Ready. Waiting for input.',w:50,fg:244})];return normalize({version:1,name:'device_monitor',screen:{w:80,h:25},board:2000,theme:'dark',windows:[w],handlers:{refresh_device:{args:'button',body:'memory.value = (memory.value + 5) % 101\nload_label.text = "Memory usage   %d%%" % memory.value\nfootnote.text = "Updated successfully."'},close_app:{args:'button',body:'win.close()'}}});}
function sizeOf(w,d){return w.fullscreen?{w:d.screen.w,h:d.screen.h}:{w:Math.max(14,w.w),h:Math.max(2,w.h)};}
function rect(o,win,d){const c=sizeOf(win,d),x=o.x<0?c.w+o.x:o.x,y=o.y<0?c.h+o.y:o.y;let w=['button','checkbox'].includes(o.type)?Array.from(o.text).length+4:o.w;let h=['list','canvas'].includes(o.type)?o.h:1;if(o.type!=='canvas'&&w<=0)w=c.w+w-x;if(o.type!=='canvas'&&h<=0)h=c.h+h-y;return {x,y,w:Math.max(0,w),h:Math.max(0,h)};}

const BIG_FONT={" ":["...","...","...","...","..."],"0":["###","#.#","#.#","#.#","###"],"1":[".#.","##.",".#.",".#.","###"],"2":["###","..#","###","#..","###"],"3":["###","..#",".##","..#","###"],"4":["#.#","#.#","###","..#","..#"],"5":["###","#..","###","..#","###"],"6":["###","#..","###","#.#","###"],"7":["###","..#",".#.",".#.",".#."],"8":["###","#.#","###","#.#","###"],"9":["###","#.#","###","..#","###"],"-":["...","...","###","...","..."],"+":["...",".#.","###",".#.","..."],"%":["#.#","..#",".#.","#..","#.#"],"/":["..#","..#",".#.","#..","#.."],".":[".",".",".",".","#"],":":[".","#",".","#","."],"?":["##.","..#",".#.","...",".#."],"A":[".#.","#.#","###","#.#","#.#"],"B":["##.","#.#","##.","#.#","##."],"C":[".##","#..","#..","#..",".##"],"D":["##.","#.#","#.#","#.#","##."],"E":["###","#..","##.","#..","###"],"F":["###","#..","##.","#..","#.."],"G":[".##","#..","#.#","#.#",".##"],"H":["#.#","#.#","###","#.#","#.#"],"I":["###",".#.",".#.",".#.","###"],"J":["..#","..#","..#","#.#",".#."],"K":["#.#","#.#","##.","#.#","#.#"],"L":["#..","#..","#..","#..","###"],"M":["#.#","###","###","#.#","#.#"],"N":["##.","#.#","#.#","#.#","#.#"],"O":[".#.","#.#","#.#","#.#",".#."],"P":["##.","#.#","##.","#..","#.."],"Q":[".#.","#.#","#.#","##.",".##"],"R":["##.","#.#","##.","#.#","#.#"],"S":[".##","#..",".#.","..#","##."],"T":["###",".#.",".#.",".#.",".#."],"U":["#.#","#.#","#.#","#.#","###"],"V":["#.#","#.#","#.#","#.#",".#."],"W":["#.#","#.#","###","###","#.#"],"X":["#.#","#.#",".#.","#.#","#.#"],"Y":["#.#","#.#",".#.",".#.",".#."],"Z":["###","..#",".#.","#..","###"]};
function bigLayout(text,scale=1,width=0){
    scale=Math.max(1,Math.min(4,Math.trunc(scale)||1));width=Math.max(0,Math.min(64,Math.trunc(width)||0));
    let chars=Array.from(String(text)).slice(0,64);
    if(width){chars=chars.slice(-width);while(chars.length<width)chars.unshift(' ');}
    if(!chars.length)return {w:0,h:0,rows:[]};
    const glyphs=chars.map(ch=>{const c=ch.charCodeAt(0);return BIG_FONT[c>=97&&c<=122?String.fromCharCode(c-32):ch]||BIG_FONT['?'];});
    const columns=glyphs.reduce((n,g)=>n+g[0].length*scale,0)+(glyphs.length-1)*scale;
    const rows=Array.from({length:Math.ceil(5*scale/2)},()=>Array(columns).fill(' '));let x=0;
    for(const glyph of glyphs){
        for(let y=0;y<5*scale;y+=2)for(let c=0;c<glyph[0].length*scale;c++){
            const top=glyph[Math.floor(y/scale)][Math.floor(c/scale)]==='#';
            const bottom=y+1<5*scale&&glyph[Math.floor((y+1)/scale)][Math.floor(c/scale)]==='#';
            rows[y/2][x+c]=[' ','▀','▄','█'][Number(top)+Number(bottom)*2];
        }
        x+=glyph[0].length*scale+scale;
    }
    return {w:columns,h:rows.length,rows:rows.map(row=>row.join(''))};
}
function canvasGroups(w){
    const groups=[];
    for(const o of w.widgets.filter(o=>o.type==='canvas')){
        let group=o.page===null?null:groups.find(g=>g.members[0].page!==null&&g.x===o.x&&g.y===o.y&&g.w===o.w&&g.h===o.h&&!g.members.some(m=>m.page===o.page));
        if(!group){group={x:o.x,y:o.y,w:o.w,h:o.h,members:[],pages:0};groups.push(group);}
        group.members.push(o);group.pages++;
    }
    return groups;
}

function usage(d){return {windows:d.windows.length,widgets:d.windows.reduce((n,w)=>n+pageTabs(w,d).length+w.widgets.reduce((n,o)=>n+(o.type==='list'?2:1),0),0),cells:d.windows.reduce((n,w)=>n+canvasGroups(w).reduce((n,g)=>n+g.w*g.h*g.pages,0),0),pixels:Pixels.pixelBytes(d,canvasGroups)};}
function pictureUsage(d){
    const count=p=>p.op==='picture'?(p.edgeSlices&&p.w>=5&&p.h>=3?9:1):p.op==='font_text'||p.op==='button'&&(p.asset||p.font)?1:0;
    let retained=0,visible=0;
    for(const w of d.windows){
        const n=o=>(o.paint||[]).reduce((sum,p)=>sum+count(p),0);
        retained+=w.widgets.reduce((sum,o)=>sum+n(o),0);
        visible+=Math.max(0,...pagesOf(w).map(page=>w.widgets.filter(o=>o.visible&&(o.page===null||o.page===page.id)).reduce((sum,o)=>sum+n(o),0)));
        if(d.colorMode==='rgb565'&&d.board>2000)visible+=canvasGroups(w).reduce((n,g)=>n+Math.ceil(g.h/2),0);
    }
    return {retained,visible};
}
function validate(d){normalize(d);const errors=[],warnings=[],names=new Set(['tdui','time','machine','asyncio','show_page','canvas_page','_TD_PARK','_TD_PAGES']);const error=s=>errors.push(s);const number=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;const name=(n)=>{if(!identifier(n)||n.length>32)error('Invalid Python identifier (use at most 32 ASCII characters): '+n);if(n.startsWith('_td_'))error('Names beginning _td_ are reserved for page helpers: '+n);if(names.has(n))error('Duplicate or reserved name: '+n);names.add(n);};const text=(s,max,label)=>{if(bytes(s)>max)error(label+' exceeds '+max+' UTF-8 bytes.');if(/[\0\r\n]/.test(s))error(label+' must be a single line without NUL.');};
const communication=Communications.validate(d);errors.push(...communication.errors);warnings.push(...communication.warnings);
if(!number(d.screen.w,20,300)||!number(d.screen.h,5,150))error('Screen must be 20–300 columns × 5–150 rows.');
if(d.compilation&&(!['bytecode','native'].includes(d.compilation.mode)||d.compilation.mode==='native'&&!['xtensawin','rv32imc'].includes(d.compilation.arch)))error('Choose a supported compiled app target.');
if(d.renderCache!==undefined&&!['auto',0,64,128].includes(d.renderCache))error('Choose Auto, Off, 64 KiB or 128 KiB for the render cache.');
if(d.application&&!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(d.application.version))error('Application version must use major.minor.patch, for example 1.0.0.');
if(d.startup){
 const s=d.startup;
 if(!['status','custom'].includes(s.mode)||!number(s.durationMs,0,600000))error('Startup screen needs a mode and a duration of 0–600,000 ms.');
 if(s.mode==='custom'&&!d.windows[0]?.pages.some(p=>p.id===s.page))error('Custom startup page does not exist in the first window.');
 if(s.image&&!d.assets?.some(a=>a.name===s.image))error('Startup artwork must be an imported project image.');
}
for(const f of Fonts.assets(d)){const file=d.assets?.find(a=>a.name===f.path.split('/').pop());if(file?.data){try{Fonts.decode(Uint8Array.from(typeof atob==='function'?atob(file.data):Buffer.from(file.data,'base64').toString('binary'),c=>c.charCodeAt(0)));}catch(e){error('Invalid generated font '+f.path+': '+e.message);}}else warnings.push('Font '+f.path+' is external; import it to make a portable project.');}
const u=usage(d);if(u.windows<1||u.windows>4)error('Use 1–4 windows.');if(u.widgets>48)error('Widget budget exceeded: '+u.widgets+'/48 (lists count as two).');if(u.cells>d.board)error('Canvas budget exceeded: '+u.cells+'/'+d.board+' cells.');
if(u.pixels>(d.board===2000?16384:2097152))error('Pixel budget exceeded: '+u.pixels+' bytes (canvas pages and image masks included).');
const pictures=pictureUsage(d),pictureLimit=d.board===2000?48:512;
if(pictures.retained>pictureLimit)error('Native picture budget exceeded: '+pictures.retained+'/'+pictureLimit+' across cached pages (smooth panels use nine).');
if(pictures.visible>(d.board===2000?64:128))error('Visible native picture budget exceeded: '+pictures.visible+'/'+(d.board===2000?64:128)+'. Reduce pictures or smooth panels on a page.');
for(const w of d.windows)for(const o of w.widgets)for(const p of o.paint){
    if(p.op!=='button'&&p.name)name(p.name);
    if(p.op==='slider'&&(!p.name||p.on_change&&(!d.handlers[p.on_change]||d.handlers[p.on_change].args.split(',').length!==1)))error('Slider needs a name and an optional one-argument change handler.');
    if(p.op==='button'){name(p.name);for(const event of Pixels.buttonEvents)if(p[event]&&(!d.handlers[p[event]]||d.handlers[p[event]].args!=='button'))error(p.name+': '+event+' callback must name a handler taking button.');}
}
for(const w of d.windows){name(w.name);text(w.title,31,w.name+' title');if(!number(w.w,1,300)||!number(w.h,1,150))error(w.name+': client size must be 1–300 × 1–150.');for(const a of ['x','y'])if(w[a]!==null&&!number(w[a],0,32767))error(w.name+': '+a+' must be blank (centered) or a positive coordinate.');if(!w.fullscreen&&(w.w+2>d.screen.w||w.h+2>d.screen.h-1))error(w.name+': framed window does not fit the screen above the taskbar.');if(!w.fullscreen&&((w.x!==null&&w.x+w.w+2>d.screen.w)||(w.y!==null&&w.y+w.h+2>d.screen.h-1)))error(w.name+': position places its frame outside the screen.');
for(const o of w.widgets){name(o.name);if(!number(o.x,-300,300)||!number(o.y,-150,150)||!number(o.w,-300,300)||!number(o.h,-150,150))error(o.name+': coordinates and dimensions must be whole cells in range.');const r=rect(o,w,d),c=sizeOf(w,d);if(r.w<1||r.h<1||r.x<0||r.y<0||r.x+r.w>c.w||r.y+r.h>c.h)error(o.name+': widget must fit inside '+w.name+'.');if(o.type==='canvas'&&(o.x<0||o.y<0||o.w<1||o.h<1))error(o.name+': canvases need nonnegative positions and positive sizes.');if(o.type==='list'&&r.w<2)error(o.name+': a list needs at least two columns.');if(['label','button','checkbox','textbox'].includes(o.type))text(o.text,63,o.name+' text');if(!number(o.value,0,100))error(o.name+': progress value must be 0–100.');for(const k of ['fg','bg'])if(!number(o[k],-1,255))error(o.name+': colors must be -1 or 0–255.');if(o.type==='list'){if(o.items.length>1000)error(o.name+': lists support at most 1,000 items.');if(o.items.reduce((n,s)=>n+bytes(s)+1,0)>16384)error(o.name+': list strings exceed the desktop’s 16 KB pool.');o.items.forEach((s,i)=>text(s,900,o.name+' item '+(i+1)));}
if(o.type==='canvas'){for(const p of o.paint){if(Pixels.isPixel(p)){Pixels.validate(p,o,error);continue;}if(!number(p.x,0,o.w-1)||!number(p.y,0,o.h-1))error(o.name+': paint starts outside the canvas.');if(p.op==='big'){text(p.text,1024,o.name+' big text');if(Array.from(p.text).length>64||!number(p.scale,1,4)||!number(p.width,0,64))error(o.name+': big text needs ≤64 characters, scale 1–4, width 0–64.');const b=bigLayout(p.text,p.scale,p.width);if(p.x+b.w>o.w||p.y+b.h>o.h)error(o.name+': big text exceeds canvas bounds.');}else if(p.op==='put'){text(p.text,1024,o.name+' paint text');if(p.x+Array.from(p.text).length>o.w)error(o.name+': painted text exceeds canvas width.');}else{if(!number(p.w,1,o.w)||!number(p.h,1,o.h)||p.x+p.w>o.w||p.y+p.h>o.h)error(o.name+': fill exceeds canvas bounds.');if(Array.from(p.ch).length!==1)error(o.name+': fill must use one character.');}for(const k of ['fg','bg'])if(!number(p[k],-2,255))error(o.name+': paint color out of range.');}}
}
const pageIds=new Set(w.pages.map(p=>p.id));if(w.pages.length<1||w.pages.length>16||pageIds.size!==w.pages.length||new Set(w.pages.map(p=>p.name)).size!==w.pages.length)error(w.name+': use 1–16 pages with unique names and IDs.');for(const p of w.pages){text(p.name,63,w.name+' page name');if(!p.name.trim())error(w.name+': page names cannot be empty.');}if(!pageIds.has(w.initialPage))error(w.name+': startup page does not exist.');for(const o of w.widgets){if(o.page!==null&&!pageIds.has(o.page))error(o.name+': page does not exist.');if(o.goToPage!==null&&(o.type!=='button'||!pageIds.has(o.goToPage)))error(o.name+': button page target does not exist.');}if(!Number.isInteger(w.tabs.row))error(w.name+': tab row must be an integer.');for(const o of pageTabs(w,d)){const r=rect(o,w,d),c=sizeOf(w,d);if(r.x+r.w>c.w||r.y<0||r.y>=c.h)error(w.name+': generated page tabs do not fit the chosen row.');}const visible=[...w.widgets,...pageTabs(w,d)].filter(o=>o.visible);for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=rect(visible[i],w,d),b=rect(visible[j],w,d);if((visible[i].page===null||visible[j].page===null||visible[i].page===visible[j].page)&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)warnings.push(visible[i].name+' overlaps '+visible[j].name+'.');}
for(const t of w.timers)if(!number(t.ms,1,2147483647))error(w.name+': timer interval must be 1–2,147,483,647 ms.');}
for(const [n,h] of Object.entries(d.handlers)){name(n);for(const p of h.args.split(',').map(s=>s.trim()).filter(Boolean))if(!identifier(p)||p.length>32)error(n+': invalid handler parameter '+p);if(new Set(h.args.split(',').map(s=>s.trim())).size!==h.args.split(',').length)error(n+': duplicate handler parameters.');if(!/^([A-Za-z_][A-Za-z0-9_]*(, *)?)*$/.test(h.args))error(n+': invalid handler parameters.');if(!h.body.trim())error(n+': handler body is empty.');const imports=[...h.body.matchAll(/^\s*(?:import\s+([^\n]+)|from\s+(\w+)\s+import)/gm)];for(const m of imports){const modules=m[2]?[m[2]]:m[1].split(',').map(s=>s.trim().split(/\s/)[0]);if(modules.some(s=>!['tdui','time','machine','asyncio',...(d.modules||[])].includes(s)))error(n+': declare application modules in Export options before importing them.');}if(/\x00|\r/.test(h.body))error(n+': handler contains invalid control characters.');if(/:=/.test(h.body))error(n+': use plain MicroPython syntax without walrus operators.');
// Literal dialogs can be checked offline; arbitrary runtime expressions cannot.
for(const m of h.body.matchAll(/tdui\.(msgbox|confirm|inputbox)\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)){const literal=s=>s.slice(1,-1).replace(/\\n/g,'\n');if(bytes(literal(m[2]))>31)error(n+': dialog title exceeds 31 bytes.');if(bytes(literal(m[3]))>1024)error(n+': dialog message exceeds 1,024 bytes.');}
if(/tdui\.(msgbox|confirm|inputbox|menu)\s*\(/.test(h.body))warnings.push(n+': keep runtime messages ≤1,024 bytes and menus ≤20 items; dynamic expressions require board testing.');}
for(const w of d.windows){for(const obj of [w,...w.widgets])for(const [event,fn] of Object.entries(obj.events)){if(!fn)continue;if(!Object.hasOwn(d.handlers,fn))error(obj.name+': missing handler '+fn);else if(d.handlers[fn].args.replace(/\s/g,'').split(',').filter(Boolean).length!==EVENTS[obj===w?'window':obj.type][event].split(',').length)error(fn+': handler parameters do not match '+event+'.');}for(const t of w.timers)if(!Object.hasOwn(d.handlers,t.fn)||d.handlers[t.fn].args.trim())error(w.name+': timer handler must exist and accept no parameters.');}
for(const n of handlerUsage(d).unused)warnings.push('Unused handler: '+n+'.');for(const [n,h] of Object.entries(d.handlers))for(const ref of missingReferences(d,h))warnings.push(n+': references missing widget '+ref+'.');return {errors:[...new Set(errors)],warnings:[...new Set(warnings)],usage:u};}
function pagesOf(w){return w.pages||[{id:'main',name:'Main'}];}
function optionsOf(d){return Object.assign({embedDesign:true,keepUnusedHandlers:false},d.options);}
function normalize(d){
    if(d.board===8000)d.board=32000;
    d.options=optionsOf(d);
    d.knownNames=d.knownNames||[];
    for(const w of d.windows){
        w.pages=pagesOf(w);
        w.initialPage=w.initialPage||w.pages[0].id;
        w.tabs=Object.assign({enabled:false,row:-1},w.tabs);
        for(const o of w.widgets){
            if(o.page===undefined)o.page=w.pages[0].id;
            if(o.goToPage===undefined)o.goToPage=null;
        }
    }
    return d;
}
function pageTabs(w,d){
    if(!w.tabs?.enabled)return [];
    const c=sizeOf(w,d),row=w.tabs.row<0?c.h+w.tabs.row:w.tabs.row;
    let x=0;
    return pagesOf(w).map((p,i)=>{
        const o=widget('button','_td_tab_'+w.name+'_'+i,x,row);
        o.text=p.name;o.page=null;o.goToPage=p.id;o.generated=true;
        x+=Array.from(p.name).length+5;
        return o;
    });
}
function codeTokens(body){
    return body.replace(/'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|#[^\n]*/g,' ');
}
function handlerUsage(d){
    const used=new Set();
    for(const w of d.windows){
        for(const o of [w,...w.widgets])for(const fn of Object.values(o.events))if(fn)used.add(fn);
        for(const t of w.timers)used.add(t.fn);
        for(const o of w.widgets)for(const p of o.paint)if(p.op==='button')for(const event of Pixels.buttonEvents)if(p[event])used.add(p[event]);
        for(const o of w.widgets)for(const p of o.paint)if(p.op==='slider'&&p.on_change)used.add(p.on_change);
    }
    // Keep helper functions called by handlers, including recursive references.
    const queue=[...used];
    for(let i=0;i<queue.length;i++){
        const body=codeTokens(d.handlers[queue[i]]?.body||'');
        for(const token of body.match(/[A-Za-z_][A-Za-z0-9_]*/g)||[]){
            if(Object.hasOwn(d.handlers,token)&&!used.has(token)){used.add(token);queue.push(token);}
        }
    }
    return {used,unused:Object.keys(d.handlers).filter(n=>!used.has(n))};
}
function missingReferences(d,handler){
    const body=codeTokens(handler.body);
    const known=new Set(['tdui','time','machine','asyncio','self','cls',
        ...Object.keys(d.handlers),...handler.args.split(/\s*,\s*/),
        ...d.windows.flatMap(w=>[w.name,...w.widgets.map(o=>o.name)])]);
    for(const h of Object.values(d.handlers))for(const m of codeTokens(h.body).matchAll(/\bglobal\s+([A-Za-z_][\w, ]*)/g))for(const n of m[1].split(',').map(s=>s.trim()))known.add(n);
    for(const m of body.matchAll(/\b([A-Za-z_]\w*)\s*(?:=(?!=)|:=)|\bfor\s+([A-Za-z_]\w*)\s+in/g))known.add(m[1]||m[2]);
    const missing=new Set();
    const tokens=new Set(body.match(/[A-Za-z_][A-Za-z0-9_]*/g)||[]);
    for(const n of d.knownNames||[])if(!known.has(n)&&tokens.has(n))missing.add(n);
    for(const m of body.matchAll(/\b([A-Za-z_]\w*)\.(?:text|checked|value|visible|color|put|fill|clear|selected|items|append|focus|close)\b/g))if(!known.has(m[1]))missing.add(m[1]);
    return [...missing];
}
function renameReferences(d,from,to){
    if(!identifier(from)||!identifier(to))throw Error('Use valid Python identifiers.');
    const pattern=new RegExp('\\b'+from+'\\b','g');
    for(const h of Object.values(d.handlers))h.body=h.body.replace(pattern,to);
}
// Python literals are split before escaping, so a backslash or Unicode character
// is never cut in half. Adjacent Python string literals join without allocation.
function inlineValue(value){return Array.isArray(value)?'['+value.map(inlineValue).join(', ')+']':value&&typeof value==='object'?'{'+Object.entries(value).map(([k,v])=>py(k)+': '+inlineValue(v)).join(', ')+'}':py(value);}
function stringChunks(value,width){
    const chunks=[];let chunk='';
    for(const ch of value){if(py(chunk+ch).length>width){chunks.push(py(chunk));chunk='';}chunk+=ch;}
    if(chunk)chunks.push(py(chunk));
    return chunks;
}
function valueLines(value,width=70){
    if(value&&typeof value==='object'&&!Array.isArray(value)){
        return ['{',...Object.entries(value).flatMap(([k,v])=>{const a=valueLines(v,width-8-py(k).length);a[0]='    '+py(k)+': '+a[0];for(let i=1;i<a.length;i++)a[i]='    '+a[i];a[a.length-1]+=',';return a;}),'}'];
    }
    if(Array.isArray(value)){
        const compact=inlineValue(value);
        if(compact.length<=width)return [compact];
        return ['[',...value.flatMap(v=>{const a=valueLines(v,width-5).map(s=>'    '+s);a[a.length-1]+=',';return a;}),']'];
    }
    if(typeof value!=='string'||py(value).length<=width)return [py(value)];
    return ['(',...stringChunks(value,width-4).map(s=>'    '+s),')'];
}
function generate(input,overrides={}){
    const d=normalize(clone(input)),opts=Object.assign(optionsOf(d),overrides);
    const lines=['# Generated by TinyDesk App Builder.','import tdui','','_TD_PARK = 1000',
        '','_TD_PAGES = hasattr(tdui.Canvas, "draw_to")'];
    if(d.provenance)lines.splice(1,0,('# App Builder '+d.provenance.lastEditedWith+' / project schema '+d.version+' / app '+(d.application?.version||'0.1.0')).replace(/[\r\n]/g,' '));
    const {cells,pixels}=usage(d),images=Pixels.assets(d),fonts=Fonts.assets(d);
    if(d.colorMode==='rgb565'&&d.board>2000){
        lines.push('if not getattr(tdui, "SUPPORTS_RGB_PICTURES", False):','    raise OSError("Update TinyDesk firmware for RGB565 pictures.")','tdui.enable_rgb_pictures()');
        if(typeof d.renderCache==='number')lines.push('if hasattr(tdui, "render_cache"):','    tdui.render_cache('+py(d.renderCache)+', '+(d.renderCache?'True':'False')+')');
    }
    const pictureBudget=pictureUsage(d);if(pictureBudget.retained>192||pictureBudget.visible>64)lines.push('if getattr(tdui, "MAX_PICTURES", 192) < '+pictureBudget.retained+' or getattr(tdui, "MAX_VISIBLE_PICTURES", 64) < '+pictureBudget.visible+':','    raise OSError("Update TinyDesk firmware for this many smooth surfaces.")');
    const communicationRuntime=Communications.preamble(d);if(communicationRuntime)lines.push(communicationRuntime);
    const fontRef=p=>p.font?'_td_font_'+fonts.findIndex(f=>f.path===p.font.path):null;
    if(fonts.length)lines.push('if not hasattr(tdui, "Font"):', '    raise OSError("Update TinyDesk firmware for generated bitmap fonts.")');
    const modern=d.windows.some(w=>w.widgets.some(o=>o.paint.some(Pixels.isPixel)));
    if(d.windows.some(w=>w.widgets.some(o=>o.paint.some(p=>p.gradient))))lines.push('if not getattr(tdui, "SUPPORTS_GRADIENT_FILLS", False):','    raise OSError("Update TinyDesk firmware for gradient fills.")');
    if(modern)lines.push('if not hasattr(tdui.Canvas, \"bar\"):', '    raise OSError(\"Design needs TinyDesk with batch and pixel widgets.\")');
    if(pixels)lines.push('if getattr(tdui, \"MAX_PIXELS\", 0) < '+pixels+':', '    raise OSError(\"Design needs '+pixels+' pixel bytes.\")');
    if(cells)lines.splice(d.provenance?3:2,0,'',
        'if getattr(tdui, "MAX_CELLS", 2000) < '+cells+':',
        '    raise OSError("Design needs '+cells+' canvas cells; update TinyDesk firmware.")');
    const deferred=[],pageWiring=[];
    const arg=(value,key=null)=>({value,key});
    function call(head,args,indent=''){
        const compact=indent+head+'('+args.map(a=>typeof a==='string'?a:
            (a.key?a.key+'=':'')+inlineValue(a.value)).join(', ')+')';
        if(compact.length<=100){lines.push(compact);return;}
        const parts=args.map(a=>{
            if(typeof a==='string')return [a];
            const prefix=a.key?a.key+'=':'';
            const v=valueLines(a.value,100-indent.length-4-prefix.length-1);
            v[0]=prefix+v[0];return v;
        });
        lines.push(indent+head+'(');
        for(const part of parts){const out=part.map(s=>indent+'    '+s);out[out.length-1]+=',';lines.push(...out);}
        lines.push(indent+')');
    }
    function stringStatement(prefix,value,suffix=''){
        const compact=prefix+py(value)+suffix;
        if(compact.length<=100){lines.push(compact);return;}
        const indent=prefix.match(/^\s*/)[0];
        lines.push(prefix+'(',...stringChunks(value,100-indent.length-4).map(s=>indent+'    '+s),
            indent+')'+suffix);
    }
    function paint(o,indent){
        lines.push(indent+'with _td_batch():');indent+='    ';
        call(o.name+'.fill',[arg(0),arg(0),arg(o.w),arg(o.h),arg(' '),arg(o.fg),arg(o.bg)],indent);
        for(const p of o.paint){
            if(p.name&&p.op!=='button'){lines.push(indent+p.name+'.draw()');continue;}
            if(Pixels.isPixel(p)){
                const image=p.asset?'_td_image_'+images.findIndex(a=>Pixels.assetKey(a)===Pixels.assetKey(p.asset)):null;
                if(p.op==='button'){
                    lines.push(indent+'global '+p.name,indent+'if '+p.name+' is None:');
                    call(p.name+' = '+o.name+'.button',Pixels.args(p,image,fontRef(p)),indent+'    ');
                    lines.push(indent+'else:',indent+'    '+p.name+'.draw()');
                }else {const helper=p.op==='gauge'?'_td_gauge':p.op==='picture'&&p.edgeSlices?'_td_panel':null;call(helper||o.name+'.'+p.op,[...(helper?[o.name]:[]),...Pixels.args(p,image,fontRef(p))],indent);}
            }else if(p.op==='big'){
                lines.push(indent+'if hasattr('+o.name+', "big"):');
                call(o.name+'.big',[p.x,p.y,p.text,p.fg,p.bg,p.scale,p.width].map(v=>arg(v)),indent+'    ');
                lines.push(indent+'else:');const big=bigLayout(p.text,p.scale,p.width);
                if(!big.rows.length)lines.push(indent+'    pass');
                big.rows.forEach((row,y)=>call(o.name+'.put',[p.x,p.y+y,row,p.fg,p.bg].map(v=>arg(v)),indent+'    '));
            }else call(o.name+'.'+p.op,(p.op==='put'?[p.x,p.y,p.text,p.fg,p.bg]:[p.x,p.y,p.w,p.h,p.ch,p.fg,p.bg]).map(v=>arg(v)),indent);
        }
    }
    lines.push('',...(d.windows.some(w=>w.widgets.some(o=>o.paint.some(p=>p.name&&p.op!=='button')))?CANVAS_RUNTIME:CANVAS_RUNTIME.slice(CANVAS_RUNTIME.indexOf('class _TDNoBatch'))).trim().split('\n'),'','# --- tdui-editor layout begin ---');
    if(d.windows.some(w=>w.widgets.some(o=>o.paint.some(p=>['gauge','slider'].includes(p.op)))))lines.push(...CONTROL_RUNTIME.trim().split('\n'));
    if(d.windows.some(w=>w.widgets.some(o=>o.paint.some(p=>p.edgeSlices))))lines.push(...PANEL_RUNTIME.trim().split('\n'));
    const hiddenStartup=d.startup?.mode==='custom';
    if(hiddenStartup)lines.push('_td_preparing = True');
    for(const w of d.windows){
        const openingAt=lines.length;
        call(w.name+' = tdui.Window',[arg(w.title),arg(w.w),arg(w.h),arg(w.x,'x'),arg(w.y,'y'),arg(w.resizable,'resizable')]);
        if(w.fullscreen)lines.push(w.name+'.fullscreen()');
        if(hiddenStartup){
            lines.push(w.name+'.minimize()');
            const opening=lines.splice(openingAt);
            lines.push('with tdui.batch() if hasattr(tdui, "batch") else _td_no_batch:',...opening.map(s=>'    '+s));
        }
        for(const o of [...w.widgets,...pageTabs(w,d)]){
            const args=[arg(o.x),arg(o.y)];
            switch(o.type){
                case'label':args.push(arg(o.text),arg(o.w,'width'));break;
                case'button':args.push(arg(o.text));break;
                case'checkbox':args.push(arg(o.text),arg(o.checked,'checked'));break;
                case'textbox':args.push(arg(o.w),arg(o.text,'text'),arg(o.secret,'secret'));break;
                case'progress':args.push(arg(o.w),arg(o.value,'value'));break;
                case'list':args.push(arg(o.w),arg(o.h),arg(o.items,'items'));break;
                case'canvas':args.push(arg(o.w),arg(o.h));break;
            }
            if(o.type==='canvas'){
                const g=canvasGroups(w).find(g=>g.members.some(m=>m.id===o.id)),base=g.members[0];
                if(base===o)call(o.name+' = _td_make_canvas',[w.name,arg(o.x),arg(o.y),arg(o.w),arg(o.h),arg(g.pages)]);
                else call(o.name+' = _td_alias_canvas',[base.name,w.name,arg(o.x),arg(o.y),arg(o.w),arg(o.h)]);
            }else call(o.name+' = '+w.name+'.'+o.type,args);
            if(o.type!=='canvas'&&(o.fg!==-1||o.bg!==-1))call(o.name+'.color',[arg(o.fg),arg(o.bg)]);
            for(const [event,fn] of Object.entries(o.events))if(fn&&o.type!=='canvas'&&!(o.goToPage&&event==='on_click'))deferred.push(o.name+'.'+event+' = '+fn);
            if(o.type==='button'&&o.goToPage){
                pageWiring.push({win:w,obj:o});
                deferred.push(o.name+'.on_click = _td_go_'+o.name);
            }
        }
        for(const [event,fn] of Object.entries(w.events))if(fn&&event!=='on_ready')deferred.push(w.name+'.'+event+' = '+fn);
        lines.push('');
    }
    for(const w of d.windows)for(const o of w.widgets)for(const p of o.paint)if(p.op==='button')lines.push(p.name+' = None');
    lines.push('# --- tdui-editor layout end ---','','# Canvas painters and page visibility.');
    for(const w of d.windows){
        for(const o of w.widgets.filter(o=>o.type==='canvas')){
            lines.push('def _td_paint_'+o.name+'():');paint(o,'    ');lines.push('');
        }
        const valid=valueLines(w.pages.map(p=>p.name),100-('_td_page_names_'+w.name+' = ').length);
        lines.push('_td_page_names_'+w.name+' = '+valid[0],...valid.slice(1),'');
        lines.push('def _td_show_'+w.name+'(name):','    with _td_batch():','        _td_apply_'+w.name+'(name)','','def _td_apply_'+w.name+'(name):');
        lines.push('    if name not in _td_page_names_'+w.name+':','        raise ValueError("unknown page")');
        for(const o of w.widgets.filter(o=>o.type!=='canvas')){
            const p=w.pages.find(p=>p.id===o.page);
            const expression=o.visible?(p?'name == '+py(p.name):'True'):'False';
            if(('    '+o.name+'.visible = '+expression).length<=100)lines.push('    '+o.name+'.visible = '+expression);
            else stringStatement('    '+o.name+'.visible = name == ',p.name);
        }
        call('_td_show_canvases',[w.name,'name'],'    ');
        lines.push('');
    }
    lines.push('def show_page(name, window=None):','    if window is None:','        window = '+d.windows[0].name);
    for(const w of d.windows)lines.push('    if window is '+w.name+':','        return _td_show_'+w.name+'(name)');
    lines.push('    raise ValueError("unknown window")','','# Event handlers: keep these quick and nonblocking.');
    const {used}=handlerUsage(d);
    for(const [n,h] of Object.entries(d.handlers)){
        if(!opts.keepUnusedHandlers&&!used.has(n))continue;
        const signature='def '+n+'('+h.args+'):';
        if(signature.length<=100)lines.push(signature);
        else lines.push('def '+n+'(',...h.args.split(',').map(a=>'    '+a.trim()+','),'):');
        lines.push(...h.body.replace(/\r\n/g,'\n').split('\n').map(s=>'    '+s),'');
    }
    for(const {win,obj:o} of pageWiring){
        lines.push('def _td_go_'+o.name+'(button):');
        if(o.events.on_click)lines.push('    '+o.events.on_click+'(button)');
        call('_td_show_'+win.name,[arg(win.pages.find(p=>p.id===o.goToPage)?.name||'')],'    ');
        lines.push('');
    }
    lines.push('# Wire callbacks after their definitions.');
    for(const binding of deferred){
        if(binding.length<=100)lines.push(binding);
        else{const [left,right]=binding.split(' = ');lines.push(left+' = (','    '+right,')');}
    }
    if(opts.bundle&&(images.length||fonts.length))lines.push('_td_package_dir = __file__.rsplit("/", 1)[0] + "/"');
    fonts.forEach((f,i)=>call('_td_font_'+i+' = tdui.Font.load',[opts.bundle?'_td_package_dir + '+py(f.path.split('/').pop()):arg(f.path)]));
    images.forEach((a,i)=>call('_td_image_'+i+' = tdui.Image.load',[opts.bundle?'_td_package_dir + '+py(a.path.split('/').pop()):arg(a.path),arg(a.w,'w'),arg(a.h,'h'),arg(a.key,'key'),arg(a.dither,'dither')]));
    for(const w of d.windows)for(const group of canvasGroups(w))group.members.forEach((o,page)=>{
        for(const p of o.paint)if(p.name&&p.op!=='button'){
            const spec={...p};delete spec.op;delete spec.name;
            const image=p.asset?'_td_image_'+images.findIndex(a=>Pixels.assetKey(a)===Pixels.assetKey(p.asset)):null;
            delete spec.asset;delete spec.font;delete spec.sourceAsset;delete spec.opaquePicture;delete spec.edgeSlices;delete spec.binding;delete spec.surfaceStyle;if(p.op==='picture')delete spec.bg;
            const callback=spec.on_change;delete spec.on_change;
            call(p.name+' = _TDField',[o.name,arg(page),arg(p.op==='picture'&&p.edgeSlices?'panel':p.op),arg(spec),image||'None',callback||'None',fontRef(p)||'None']);
        }
    });
    let groupId=0;
    for(const w of d.windows)for(const group of canvasGroups(w)){
        group.members.forEach((o,index)=>{
            let mouse=o.events.on_mouse||'None';
            if(o.paint.some(p=>p.op==='slider')){
                mouse='_td_mouse_'+o.name;
                lines.push('def '+mouse+'(cv, x, y, button, action):','    if _td_control_mouse(cv, x, y, button, action):','        return');
                if(o.events.on_mouse)lines.push('    '+o.events.on_mouse+'(cv, x, y, button, action)');
            }
            call('_td_register_canvas',[
            w.name,arg(groupId),group.members[0].name,o.name,
            arg(w.pages.find(p=>p.id===o.page)?.name??null),arg(index),arg(o.x),arg(o.y),
            '_td_paint_'+o.name,arg(o.visible),mouse]);});groupId++;
    }
    const readyCalls=[];
    for(const w of d.windows){
        const startup=w===d.windows[0]&&d.startup?.mode==='custom'?d.startup:null;
        const page=w.pages.find(p=>p.id===(startup?startup.page:w.initialPage))||w.pages[0];
        call('_td_show_'+w.name,[arg(page.name)]);
        const readyAt=lines.length;
        if(w.events.on_ready)call(w.events.on_ready,[w.name]);
        for(const t of w.timers)call(w.name+'.'+t.kind,[arg(t.ms),t.fn]);
        if(startup?.durationMs>0&&startup.page!==w.initialPage)
            call(w.name+'.after',[arg(startup.durationMs),'lambda: _td_show_'+w.name+'('+py(w.pages.find(p=>p.id===w.initialPage).name)+')']);
        readyCalls.push(...lines.splice(readyAt));
    }
    if(hiddenStartup){
        // Prepare retained pages behind the kiosk artwork without a long
        // global frame hold. Reveal only the completed entry view.
        lines.push('_td_preparing = False','with _td_batch():',...d.windows.map(w=>'    '+w.name+'.focus()'));
    }
    const linkSetup=Communications.setup(d,!!opts.simulation);
    if(linkSetup.length)lines.push('',...linkSetup,...readyCalls,'','try:','    tdui.run()','finally:','    _td_link.close()');
    else lines.push(...readyCalls,'','tdui.run()');
    if(opts.embedDesign){
        const chunks=[];let chunk='';
        for(const ch of JSON.stringify(d)){if((chunk+ch).length>64){chunks.push(chunk);chunk='';}chunk+=ch;}
        if(chunk)chunks.push(chunk);
        lines.push('',...chunks.map((s,i)=>'# tdui-editor design '+(i+1)+'/'+chunks.length+': '+s));
    }
    const spaced=[];
    for(const line of lines){if(line.startsWith('def ')){let n=0;for(let i=spaced.length-1;i>=0&&spaced[i]==='';i--)n++;while(n++<2)spaced.push('');}spaced.push(line);}
    return spaced.join('\n')+'\n';
}
// Keep corner/edge pictures independent so an interior label does not replace
// a whole native panel in the firmware's overlapping-picture cache.
const PANEL_RUNTIME=`
def _td_panel(cv, img, x, y, w, h, src=None, border=16, text="", fg=231, scale=0, font=None):
    if w < 5 or h < 3 or border < 1 or (src and (src[2] <= border*2 or src[3] <= border*2)):
        cv.picture(img, x, y, w, h, src=src, border=border, text=text, fg=fg, scale=scale, font=font)
        return
    sx, sy, sw, sh = src or (0, 0, img.width, img.height)
    b = min(border, sw // 2, sh // 2)
    cols, rows = (2, w-4, 2), (1, h-2, 1)
    source_x, source_y = (sx, sx+b, sx+sw-b), (sy, sy+b, sy+sh-b)
    source_w, source_h = (b, sw-2*b, b), (b, sh-2*b, b)
    yy = y
    with _td_batch():
        for row in range(3):
            xx = x
            for col in range(3):
                label = text if row == 1 and col == 1 else ""
                cv.picture(img, xx, yy, cols[col], rows[row], src=(source_x[col], source_y[row], source_w[col], source_h[row]), text=label, fg=fg, scale=scale, font=font)
                xx += cols[col]
            yy += rows[row]
`;
// A single runtime handles cached pictures and the older separate-canvas path.
const CONTROL_RUNTIME=`
_td_controls = []
_td_control_held = None

def _td_gauge(cv, x, y, w, h, value, maximum=100, color=220, track=244, bg=17, gradient=None, radius=0):
    points = ((-9,5),(-10,2),(-10,-2),(-8,-6),(-5,-9),(0,-10),(5,-9),(8,-6),(10,-2),(10,2),(9,5))
    rx = max(1, min(w // 2 - 1, h - 7))
    ry = max(1, rx // 2)  # Terminal pixels are twice as tall as wide.
    cx, cy = x + w // 2, y + ry
    with _td_batch():
        cv.rect(x, y, w, h, bg, radius=radius, gradient=gradient)
        for i in range(10):
            a, b = points[i], points[i+1]
            cv.line(cx+a[0]*rx//10, cy+a[1]*ry//10, cx+b[0]*rx//10, cy+b[1]*ry//10, track)
        position = max(0,min(100,int(value)*100//maximum))
        index = min(9,position//10)
        fraction = position-index*10
        a, b = points[index], points[index+1]
        px, py = a[0]*10+(b[0]-a[0])*fraction, a[1]*10+(b[1]-a[1])*fraction
        cv.line(cx, cy, cx+px*rx//100, cy+py*ry//100, color)
        cv.draw_text(x+1, y+h-5, str(value), color, bg=tdui.CLEAR, small=True)

def _td_slider(cv, x, y, w, h, value, maximum=100, color=220, track=17, knob=231, gradient=None, radius=0):
    with _td_batch():
        cv.rect(x*2, y*2, w*2, h*2, track, radius=radius, gradient=gradient)
        cv.line(x*2, y*2+h, (x+w)*2-1, y*2+h, color)
        at = max(0,min(w-1,int(value)*(w-1)//maximum))
        cv.rect((x+at)*2, y*2, 2, h*2, knob, radius=1)

def _td_control_mouse(cv, x, y, button, action):
    global _td_control_held
    held = _td_control_held
    if action == 0 and button == 0:
        for field in reversed(_td_controls):
            p = field.values
            if field.cv is cv and field.page == cv.showing and field.enabled and p['x']<=x<p['x']+p['w'] and p['y']<=y<p['y']+p['h']:
                held = field
                _td_control_held = held
                break
    if held is None or held.cv is not cv:
        return False
    if held.page != cv.showing or not held.enabled:
        _td_control_held = None
        return True
    p = held.values
    value = max(0,min(p['maximum'],(x-p['x'])*p['maximum']//max(1,p['w']-1)))
    if value != p['value']:
        held.set(value=value)
        if held.on_change:
            held.on_change(held)
    if action == 1:
        _td_control_held = None
    return True
`;
const CANVAS_RUNTIME=`
class _TDField:
    # Geometry and appearance come from the editable drawing operation.
    def __init__(self, cv, page, method, values, image=None, on_change=None, font=None):
        self.cv, self.page, self.method = cv, page, method
        self.values = values
        if image is not None:
            self.values['img'] = image
        if font is not None:
            self.values['font'] = font
        if method == 'slider':
            self.on_change, self.enabled = on_change, True
            _td_controls.append(self)

    def set(self, **changes):
        if any(self.values.get(k) != v for k, v in changes.items()):
            self.values.update(changes)
            self.draw()

    def draw(self):
        previous = self.cv.drawing if _TD_PAGES else 0
        if _TD_PAGES:
            self.cv.draw_to(self.page)
        try:
            if self.method == 'gauge':
                _td_gauge(self.cv, **self.values)
            elif self.method == 'slider':
                _td_slider(self.cv, **self.values)
            elif self.method == 'panel':
                _td_panel(self.cv, **self.values)
            else:
                getattr(self.cv, self.method)(**self.values)
        finally:
            if _TD_PAGES:
                self.cv.draw_to(previous)

class _TDNoBatch:
    def __enter__(self):
        return self

    def __exit__(self, kind, value, traceback):
        return False

_td_no_batch = _TDNoBatch()
_td_preparing = False


def _td_batch():
    return tdui.batch() if not _td_preparing and hasattr(tdui, "batch") else _td_no_batch


_td_canvas_groups = {}
_td_window_groups = {}

def _td_make_canvas(win, x, y, w, h, pages):
    if _TD_PAGES:
        cv = win.canvas(x, y, w, h, pages=pages)
    else:
        cv = win.canvas(x, y, w, h)
    cv._td_parked = False
    return cv

def _td_alias_canvas(base, win, x, y, w, h):
    if _TD_PAGES:
        return base
    return _td_make_canvas(win, x, y, w, h, 1)

def _td_hide_canvas(cv, clear=False):
    if clear:
        cv.fill(0, 0, cv.width, cv.height, " ", -1, -1)
    if not cv._td_parked:
        cv.move(_TD_PARK, _TD_PARK)
        cv._td_parked = True

def _td_place_canvas(cv, x, y):
    if cv._td_parked:
        cv.move(x, y)
        cv._td_parked = False

def _td_select_canvas(cv, page):
    # _PAGE supports draw and show together: one atomic request, not two.
    cv.drawing = page
    cv.showing = page
    cv._req2(19, page, page, 0, 0, 0, 0, None)

def _td_register_canvas(win, group, base, cv, own, page, x, y, paint, visible, mouse):
    record = _td_canvas_groups.get(group)
    if record is None:
        record = [base, x, y, []]
        _td_canvas_groups[group] = record
        _td_window_groups.setdefault(win, []).append(record)
    record[3].append((cv, own, page, paint, visible, mouse))
    if _TD_PAGES:
        cv.draw_to(page)
        paint()

def _td_show_canvases(win, name):
    for base, x, y, entries in _td_window_groups.get(win, ()):
        active = None
        for entry in entries:
            cv, own, page, paint, visible, mouse = entry
            if not _TD_PAGES:
                _td_hide_canvas(cv, True)
            if visible and (own is None or own == name):
                active = entry
        if active is None:
            if _TD_PAGES:
                _td_hide_canvas(base)
            continue
        cv, own, page, paint, visible, mouse = active
        _td_place_canvas(cv, x, y)
        if _TD_PAGES:
            if len(entries) > 1:
                _td_select_canvas(cv, page)
        else:
            paint()
        cv.on_mouse = mouse

def canvas_page(cv, name):
    # Use the returned canvas: aliases share an object only on newer firmware.
    for base, x, y, entries in _td_canvas_groups.values():
        found = False
        for entry in entries:
            if entry[0] is cv:
                found = True
                break
        if found:
            for target, own, page, paint, visible, mouse in entries:
                if own is None or own == name:
                    if _TD_PAGES:
                        target.draw_to(page)
                    return target
    raise ValueError("unknown canvas page")
`;
function parse(source){
    const bad=message=>{throw Error(message);};
    if(typeof source!=='string'||source.length>5000000)bad('Design must be text smaller than 5 MB.');
    let json=source;
    if(!source.trimStart().startsWith('{')){
        const old=source.match(/^# tdui-editor design: (.+)\r?$/m);
        const chunks=[...source.matchAll(/^# tdui-editor design (\d+)\/(\d+): (.*)\r?$/gm)];
        if(chunks.length){
            const count=Number(chunks[0][2]);
            if(count!==chunks.length||chunks.some((m,i)=>Number(m[1])!==i+1||Number(m[2])!==count))bad('Incomplete or unordered embedded design comments. Import the .json instead.');
            json=chunks.map(m=>m[3].replace(/\r$/,'')).join('');
        }else if(old)json=old[1];
        else bad('No embedded design found. Import the saved .json design instead.');
        if(!source.includes('# --- tdui-editor layout begin ---')||!source.includes('# --- tdui-editor layout end ---'))bad('Missing TinyDesk layout markers. Import the .json instead.');
    }
    let d;
    try{d=JSON.parse(json);}catch(e){bad('Invalid JSON design: '+e.message);}
    const record=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
    const int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
    if(!record(d)||d.version!==1||!record(d.screen)||!Array.isArray(d.windows)||!record(d.handlers)||!['dark','classic'].includes(d.theme)||![2000,8000,32000].includes(d.board)||typeof d.name!=='string')bad('Unsupported or incomplete design format.');
    if(d.compilation!==undefined&&(!record(d.compilation)||!['bytecode','native'].includes(d.compilation.mode)||d.compilation.mode==='native'&&!['xtensawin','rv32imc'].includes(d.compilation.arch)))bad('Invalid compilation target.');
    if(d.colorMode!==undefined&&!['palette','rgb565'].includes(d.colorMode))bad('Invalid native picture color mode.');
    if(d.renderCache!==undefined&&!['auto',0,64,128].includes(d.renderCache))bad('Invalid render cache option.');
    if(d.startup!==undefined&&(!record(d.startup)||!['status','custom'].includes(d.startup.mode)||!int(d.startup.durationMs,0,600000)||typeof d.startup.page!=='string'||typeof d.startup.image!=='string'||/[\\/:\0]/.test(d.startup.image)))bad('Invalid startup screen settings.');
    for(const key of ['provenance','application'])if(d[key]!==undefined&&(!record(d[key])||Object.values(d[key]).some(v=>typeof v!=='string'||v.length>128||/[\0\r\n]/.test(v))))bad('Invalid project version metadata.');
    for(const key of ['assets','binaryDependencies'])if(d[key]!==undefined&&(!Array.isArray(d[key])||d[key].length>128||d[key].some(a=>!record(a)||typeof a.name!=='string'||a.name.length>64||!a.name||/[\\/:\0]/.test(a.name)||typeof a.data!=='string'||a.data.length>6000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(a.data))))bad('Invalid embedded project resource.');
    if(!int(d.windows.length,1,4))bad('A design needs one to four windows.');
    if(!int(d.screen.w,20,300)||!int(d.screen.h,5,150))bad('Invalid screen dimensions.');
    if(d.options!==undefined&&(!record(d.options)||Object.values(d.options).some(v=>typeof v!=='boolean')))bad('Invalid export options.');
    if(d.knownNames!==undefined&&(!Array.isArray(d.knownNames)||d.knownNames.some(n=>typeof n!=='string')))bad('Invalid saved name history.');
    if(d.modules!==undefined&&(!Array.isArray(d.modules)||d.modules.some(n=>!identifier(n))))bad('Invalid application modules.');
    const ids=new Set();
    for(const w of d.windows){
        if(!record(w)||typeof w.name!=='string'||typeof w.title!=='string'||!Array.isArray(w.widgets)||!Array.isArray(w.timers)||!record(w.events))bad('Invalid window data.');
        if(!int(w.w,1,300)||!int(w.h,1,150)||!['x','y'].every(k=>w[k]===null||int(w[k],0,32767))||typeof w.fullscreen!=='boolean'||typeof w.resizable!=='boolean')bad('Invalid window dimensions or flags.');
        if(w.pages!==undefined&&(!Array.isArray(w.pages)||!int(w.pages.length,1,16)||w.pages.some(p=>!record(p)||typeof p.id!=='string'||typeof p.name!=='string')))bad('Invalid window pages.');
        if(w.initialPage!==undefined&&typeof w.initialPage!=='string')bad('Invalid initial page.');
        if(w.tabs!==undefined&&(!record(w.tabs)||typeof w.tabs.enabled!=='boolean'||!int(w.tabs.row,-150,150)))bad('Invalid page tab settings.');
        for(const o of [w,...w.widgets]){
            if(!record(o)||typeof o.id!=='string'||ids.has(o.id))bad('Invalid or duplicate object IDs.');ids.add(o.id);
        }
        for(const o of w.widgets){
            if(!TYPES.includes(o.type)||typeof o.name!=='string'||typeof o.text!=='string'||!Array.isArray(o.items)||!o.items.every(s=>typeof s==='string')||!Array.isArray(o.paint)||!record(o.events))bad('Invalid widget data.');
            if(['x','y','w','h'].some(k=>!int(o[k],-32767,32767))||['fg','bg','value'].some(k=>!Number.isInteger(o[k]))||['visible','secret','checked'].some(k=>typeof o[k]!=='boolean'))bad('Invalid widget properties.');
            if(o.page!==undefined&&o.page!==null&&typeof o.page!=='string')bad('Invalid widget page.');
            if(o.goToPage!==undefined&&o.goToPage!==null&&typeof o.goToPage!=='string')bad('Invalid button page target.');
            for(const p of o.paint){
                if(p?.name!==undefined&&typeof p.name!=='string')bad('Invalid drawing name.');
                if(Pixels.isPixel(p)){if(!Pixels.shapeValid(p))bad('Invalid pixel drawing data.');continue;}
                if(!record(p)||!['put','fill','big'].includes(p.op)||typeof(p.op==='fill'?p.ch:p.text)!=='string'||['x','y','fg','bg',...(p.op==='fill'?['w','h']:p.op==='big'?['scale','width']:[])].some(k=>!int(p[k],-32767,32767)))bad('Invalid canvas paint data.');
            }
        }
        for(const o of [w,...w.widgets])for(const [event,fn] of Object.entries(o.events))if(!Object.hasOwn(EVENTS[o===w?'window':o.type],event)||typeof fn!=='string')bad('Invalid event data.');
        for(const t of w.timers)if(!record(t)||!['every','after'].includes(t.kind)||typeof t.fn!=='string'||!Number.isInteger(t.ms))bad('Invalid timer data.');
    }
    for(const h of Object.values(d.handlers))if(!record(h)||typeof h.args!=='string'||typeof h.body!=='string')bad('Invalid handler data.');
    normalize(d);
    // Semantic errors remain editable, while malformed structures never reach UI code.
    validate(d);
    return d;
}
function windowFrame(w,d){
    if(w.fullscreen)return {x:0,y:0,w:d.screen.w,h:d.screen.h,cx:0,cy:0};
    const c=sizeOf(w,d),x=w.x??Math.floor((d.screen.w-c.w-2)/2),y=w.y??Math.floor((d.screen.h-c.h-3)/2);
    return {x,y,w:c.w+2,h:c.h+2,cx:x+1,cy:y+1};
}
function moveWindow(input,id,x,y,center=false){
    const d=clone(input),w=d.windows.find(w=>w.id===id);if(!w)throw Error('Window not found.');
    if(w.fullscreen)return d;
    if(center){w.x=null;w.y=null;return d;}
    const c=sizeOf(w,d);
    w.x=Math.max(0,Math.min(Math.max(0,d.screen.w-c.w-2),Math.round(x)));
    w.y=Math.max(0,Math.min(Math.max(0,d.screen.h-c.h-3),Math.round(y)));
    return d;
}
function resizeWindow(input,id,width,height){
    const d=clone(input),w=d.windows.find(w=>w.id===id);if(!w)throw Error('Window not found.');
    if(w.fullscreen)return d;
    const f=windowFrame(w,d);
    w.w=Math.max(1,Math.min(300,d.screen.w-f.x-2,Math.round(width)));
    w.h=Math.max(1,Math.min(150,d.screen.h-f.y-3,Math.round(height)));
    w.x=f.x;w.y=f.y;
    return d;
}
function beginWindowDrag(d,id,mode,point){
    if(!['move','resize-e','resize-s','resize-se'].includes(mode))throw Error('Invalid window drag mode.');
    const before=clone(d),w=before.windows.find(w=>w.id===id);if(!w)throw Error('Window not found.');
    return {before,id,mode,start:{x:point.x,y:point.y},frame:windowFrame(w,before)};
}
function updateWindowDrag(drag,point,center=false){
    const w=drag.before.windows.find(w=>w.id===drag.id),dx=Math.round(point.x-drag.start.x),dy=Math.round(point.y-drag.start.y);
    if(!center&&dx===0&&dy===0)return clone(drag.before);
    if(drag.mode==='resize-e'&&dx===0||drag.mode==='resize-s'&&dy===0)return clone(drag.before);
    if(drag.mode==='move')return moveWindow(drag.before,drag.id,drag.frame.x+dx,drag.frame.y+dy,center);
    return resizeWindow(drag.before,drag.id,w.w+(drag.mode!=='resize-s'?dx:0),w.h+(drag.mode!=='resize-e'?dy:0));
}
function finishWindowDrag(drag,point,center=false){
    const design=updateWindowDrag(drag,point,center);
    return {design,undo:JSON.stringify(design)===JSON.stringify(drag.before)?[]:[clone(drag.before)]};
}
function parseFTPListLine(line){
    const m=String(line).replace(/\r?\n$/,'').match(/^([d-])[rwxstST-]{9}\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\S{3}\s+\d{1,2}\s+\d{2}:\d{2} (.*)$/);
    if(!m)throw Error('Unrecognized FTP LIST line.');
    return {name:m[3],dir:m[1]==='d',size:Number(m[2])};
}
function normalizeBoardPath(value){
    if(typeof value!=='string'||/[\r\n\0]/.test(value))throw Error('Invalid board path.');
    const parts=[];for(const name of value.split('/')){if(!name||name==='.')continue;if(name==='..')parts.pop();else parts.push(name);}
    return '/'+parts.join('/');
}
function pathParts(value){
    const parts=[{name:'/',path:'/'}];let path='';
    for(const name of normalizeBoardPath(value).slice(1).split('/').filter(Boolean)){path+='/'+name;parts.push({name,path});}
    return parts;
}
const api={TYPES,EVENTS,identifier,bytes,py,clone,widget,windowModel,initial,sizeOf,rect,usage,
    validate,generate,parse,normalize,pagesOf,optionsOf,pageTabs,handlerUsage,missingReferences,renameReferences,
    windowFrame,moveWindow,resizeWindow,beginWindowDrag,updateWindowDrag,finishWindowDrag,
    parseFTPListLine,normalizeBoardPath,pathParts,bigLayout,canvasGroups,BIG_FONT,Pixels};
if(typeof module!=='undefined')module.exports=api;else root.TD=api;
})(typeof window!=='undefined'?window:globalThis);
