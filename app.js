/* TinyDesk App Builder: buildless, offline, file:// compatible. */
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glyphs={label:'T',button:'[ ]',checkbox:'☑',textbox:'▭',progress:'▰',list:'☷',canvas:'▦'};
let design=TD.initial(),selected='window_1',tab='properties',showGrid=true,paintMode=false,drag=null,history=[],future=[],historyGroup=null,lastResult,toastTimer,compilingMpy=false;
try{const saved=localStorage.getItem('tinydesk-studio');if(saved)design=TD.parse(saved);}catch(e){/* Storage may be unavailable on file://. */}
selected=design.windows[0].id;
const pageViews=new Map();
let pendingRename=null,renameStart=null;
function activePage(w){const id=pageViews.get(w.id)||w.initialPage;return w.pages.some(p=>p.id===id)?id:w.initialPage;}
function onPage(o,w){return o.page===null||o.page===activePage(w);}
function rememberRemoved(objects){design.knownNames=[...new Set([...design.knownNames,...objects.map(o=>o.name)])];}
function selectField(key,label,value,items){return '<label class="field"><span>'+label+'</span><select data-key="'+key+'">'+items.map(([v,label])=>'<option value="'+esc(v)+'" '+(v===(value??'')?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>';}
function renderPages(){const {win:w}=current();$('#pageTabs').innerHTML='<span>PAGES</span>'+w.pages.map(p=>'<button data-view-page="'+esc(p.id)+'" class="'+(p.id===activePage(w)?'active':'')+'" aria-pressed="'+(p.id===activePage(w))+'">'+esc(p.name)+'</button>').join('')+'<button data-add-page="true" title="Add page">＋</button>';}
function current(){for(const w of design.windows){if(w.id===selected)return {win:w,obj:w};const o=w.widgets.find(o=>o.id===selected);if(o)return {win:w,obj:o};}return {win:design.windows[0],obj:design.windows[0]};}
function snapshot(group=null){
    if(group!==null&&historyGroup===group)return;
    historyGroup=group;
    const json=JSON.stringify(design);
    if(history.at(-1)?.json!==json)history.push({json,selected});
    if(history.length>80)history.shift();
    future=[];
}
function undo(redo=false){
    const src=redo?future:history,dst=redo?history:future,json=JSON.stringify(design);
    let state;
    while(src.length){const candidate=src.pop();if(candidate.json!==json){state=candidate;break;}}
    if(!state)return;
    const focused=document.activeElement;
    const focusKey=focused?.closest('#inspector')?focused.dataset.key:null;
    const projectFocused=focused?.id==='projectName';
    const caret=focused?.selectionStart;
    dst.push({json,selected});
    // History can contain an unfinished, invalid edit. Import validation must
    // not prevent the user from undoing or redoing it.
    design=JSON.parse(state.json);
    selected=state.selected;
    historyGroup=null;
    drag=null;
    render();
    const target=projectFocused?$('#projectName'):focusKey?$('#inspector [data-key="'+focusKey+'"]'):null;
    if(target){target.focus({preventScroll:true});if(caret!==null&&caret!==undefined&&['text','textarea'].includes(target.type))target.setSelectionRange(Math.min(caret,target.value.length),Math.min(caret,target.value.length));}
    toast(redo?'Change restored':'Change undone');
}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2800);}
function unique(prefix){prefix=prefix.slice(0,28);const used=new Set(design.windows.flatMap(w=>[w.name,w.id,...w.widgets.flatMap(o=>[o.name,o.id,...o.paint.filter(p=>p.name).map(p=>p.name)])]).concat(Object.keys(design.handlers),(design.assets||[]).map(a=>a.name.replace(/\.[^.]+$/,''))));let n=1;while(used.has(prefix+'_'+n))n++;return prefix+'_'+n;}
function update(){$('#compiledSize').textContent='';renderPages();lastResult=TD.validate(design);$('#projectLabel').textContent=design.name;$('#projectName').value=design.name;$('#board').value=design.board;$('#theme').value=design.theme;const preset=design.screen.w+','+design.screen.h;$('#screenPreset').value=['80,25','80,24','100,30'].includes(preset)?preset:'custom';$('#screenInfo').textContent=design.screen.w+' COLS × '+design.screen.h+' ROWS';const code=TD.generate(design),visible=code.split('\n').filter(l=>!/^# tdui-editor design(?::| \d+\/)/.test(l));$('#code').innerHTML=visible.map(l=>'<span class="code-line '+(l.startsWith('#')?'comment':'')+'">'+(esc(l)||' ')+'</span>').join('');$('#lineCount').textContent=visible.length+' lines';const {errors,warnings,usage:u}=lastResult;$('#health').textContent=errors.length?errors.length+' error'+(errors.length===1?'':'s')+' · export blocked':warnings.length?warnings.length+' layout warning'+(warnings.length===1?'':'s'):'Design checks passed';$('#healthDot').style.background=errors.length?'#c56551':warnings.length?'#c5a25b':'#36a67a';$('#download').disabled=errors.length>0;$('#downloadMpy').disabled=errors.length>0||compilingMpy;$('#windowUsage').textContent=u.windows+' / 4 windows';$('#widgetUsage').textContent=u.widgets+' / 48 widgets';$('#cellUsage').textContent=u.cells.toLocaleString()+' / '+design.board.toLocaleString()+' canvas cells · '+u.pixels.toLocaleString()+' / '+(design.board===2000?16384:2097152).toLocaleString()+' pixel bytes';$('#issues').innerHTML='<strong>Design checks</strong>'+(errors.length||warnings.length?[...errors.map(s=>'<p class="error">● '+esc(s)+'</p>'),...warnings.map(s=>'<p class="warning">△ '+esc(s)+'</p>')].join(''):'<p>No layout or resource issues found.</p>')+'<p class="empty">Handler bodies are user code. Test hardware access, runtime allocations, and dynamic dialog data on your target board.</p>';try{localStorage.setItem('tinydesk-studio',JSON.stringify(design));$('#saveState').textContent='Saved on this device';}catch(e){$('#saveState').textContent='Use Save JSON to keep your work';}draw();}
function render(){const {win,obj}=current();if(obj!==win&&obj.page!==null)pageViews.set(win.id,obj.page);renderLayers();renderInspector();update();}
function renderLayers(){
    function layer(o){return '<div role="button" tabindex="0" class="layer widget '+(selected===o.id?'selected':'')+'" data-id="'+esc(o.id)+'"><span class="layer-icon">'+glyphs[o.type]+'</span>'+esc(o.name)+(o.visible?'':'<span class="small">hidden</span>')+'</div>';}
    $('#layers').innerHTML=design.windows.map(w=>'<div role="button" tabindex="0" class="layer '+(selected===w.id?'selected':'')+'" data-id="'+esc(w.id)+'"><span class="layer-icon">▣</span>'+esc(w.name)+'<span class="small">'+w.widgets.length+'</span></div>'+(w.widgets.some(o=>o.page===null)?'<div class="outline-page">All pages</div>'+w.widgets.filter(o=>o.page===null).map(layer).join(''):'')+w.pages.map(p=>'<button class="outline-page '+(activePage(w)===p.id?'current-page':'')+'" data-page-win="'+esc(w.id)+'" data-outline-page="'+esc(p.id)+'">▱ '+esc(p.name)+'</button>'+w.widgets.filter(o=>o.page===p.id).map(layer).join('')).join('')).join('');
    $('#addWindow').disabled=design.windows.length>=4;
}
function field(key,label,value,type='text',hint=''){return '<label class="field '+(type==='checkbox'?'check':'')+'">'+(type==='checkbox'?'':'<span>'+label+'</span>')+(type==='textarea'?'<textarea data-key="'+key+'">'+esc(value)+'</textarea>':'<input data-key="'+key+'" type="'+type+'" '+(type==='checkbox'?(value?'checked':''):'value="'+esc(value??'')+'"')+'>')+(type==='checkbox'?label:'')+(hint?'<span class="field-hint">'+hint+'</span>':'')+'</label>';}
function group(s){return '<div class="group-title">'+s+'</div>';}
function renderInspector(){const {win,obj:o}=current();if(!o)return;const isWin=o===win;$('#typeTag').textContent=isWin?'WINDOW':o.type.toUpperCase();let html='<h2 class="object-name">'+esc(o.name)+'</h2><div class="object-desc">'+(isWin?'Window · '+o.w+' × '+o.h+' client cells':o.type+' · child of '+esc(win.name))+'</div>';
if(tab==='events'){html+=group('EVENT HANDLERS');const events=TD.EVENTS[isWin?'window':o.type];if(!Object.keys(events).length)html+='<p class="empty">This widget has no events.</p>';for(const [event,args] of Object.entries(events)){html+='<div class="event-card"><button data-event="'+event+'">'+event+' → '+esc(o.events[event]||'Add handler')+'</button><small>('+esc(args)+')</small>'+(o.events[event]?'<button data-clear-event="'+event+'" style="margin-top:7px">Disconnect</button>':'')+'</div>';}
if(o.type==='canvas'){html+=group('CANVAS BUTTON EVENTS')+o.paint.map((p,i)=>p.op==='button'?'<div class="event-card"><button data-edit-pixel="'+i+'">'+esc(p.name)+' · press / release / click / cancel</button></div>':'').join('');}
if(isWin){html+=group('TIMERS');html+='<p class="hint" style="padding:0">Callbacks take no arguments. Keep handlers quick.</p>';html+=win.timers.map((t,i)=>'<div class="event-card"><button data-timer-edit="'+i+'">'+t.kind+' '+t.ms+' ms → '+esc(t.fn)+'</button><button data-timer-remove="'+i+'" style="margin-top:5px">Remove timer</button></div>').join('')+'<button id="addTimer">＋ Add timer</button>';}
const unused=new Set(TD.handlerUsage(design).unused);html+=group('HANDLER LIBRARY')+Object.entries(design.handlers).map(([name,h])=>'<div class="event-card"><button data-handler="'+esc(name)+'">'+esc(name)+'('+esc(h.args)+')</button>'+(unused.has(name)?'<small>Unused · '+(design.options.keepUnusedHandlers?'kept in export':'omitted from export')+'</small><button data-delete-handler="'+esc(name)+'" class="danger">Delete unused handler</button>':'')+'</div>').join('');
}else{html+=field('name','Variable name',o.name)+renameOffer();if(isWin){html+=field('title','Window title',o.title,'text','31 UTF-8 bytes maximum')+group('LAYOUT')+'<div class="field-row">'+field('w','Client width',o.w,'number')+field('h','Client height',o.h,'number')+'</div><div class="field-row">'+field('x','X position',o.x,'number')+field('y','Y position',o.y,'number')+'</div><p class="hint" style="padding:0">Blank position = centered on screen</p><button id="centerWindow" '+(o.fullscreen?'disabled':'')+'>Center window</button>'+group('BEHAVIOR')+field('resizable','Resizable',o.resizable,'checkbox')+field('fullscreen','Fullscreen / kiosk',o.fullscreen,'checkbox')+pageSettings(win);}
else{html+=selectField('page','Page',o.page,[['','All pages'],...win.pages.map(p=>[p.id,p.name])]);if(o.type==='button')html+=selectField('goToPage','Switch to page on click',o.goToPage,[['','No page action'],...win.pages.map(p=>[p.id,p.name])]);html+=group('LAYOUT')+'<div class="field-row">'+field('x','X / column',o.x,'number')+field('y','Y / row',o.y,'number')+'</div>';if(!['button','checkbox'].includes(o.type))html+='<div class="field-row">'+field('w','Width',o.w,'number')+(['list','canvas'].includes(o.type)?field('h','Height',o.h,'number'):'')+'</div>';if(['label','list','textbox','progress'].includes(o.type))html+='<p class="hint" style="padding:0">Negative positions anchor to the right / bottom. Width ≤ 0 follows the right edge.</p>';html+=group('CONTENT');if(['label','button','checkbox','textbox'].includes(o.type))html+=field('text','Text',o.text,'text','63 UTF-8 bytes maximum');if(o.type==='checkbox')html+=field('checked','Checked',o.checked,'checkbox');if(o.type==='textbox')html+=field('secret','Password field',o.secret,'checkbox');if(o.type==='progress')html+=field('value','Progress · 0–100',o.value,'number');if(o.type==='list')html+=field('items','Items · one per line',o.items.join('\n'),'textarea','Up to 1,000 items');if(o.type==='canvas'){html+='<div class="paint-toolbar"><button id="paintToggle" class="'+(paintMode?'active':'')+'">'+(paintMode?'✓ Painting':'✎ Paint cells')+'</button><button id="clearPaint">Clear</button></div><div class="paint-notice">'+(paintMode?'Click or drag on the canvas to stamp your brush. Turn painting off to move it.':'Paint text or fill areas with xterm colors. Coordinates below are local to this canvas.')+'</div>';html+=selectField('brushOp','Paint tool',brush.op,[['put','Cell text'],['big','Big text']])+field('brushText','Brush text',brush.text)+(brush.op==='big'?selectField('brushScale','Scale',brush.scale,[1,2,3,4].map(n=>[n,String(n)]))+field('brushWidth','Width · characters (0 = natural)',brush.width,'number')+'<p id="brushSize" class="paint-notice"></p>':'')+ '<div class="field-row">'+field('brushFg','Brush foreground',brush.fg,'number')+field('brushBg','Brush background',brush.bg,'number')+'</div><button id="fillCanvas">Fill canvas with brush character</button><p class="hint" style="padding:0">'+o.paint.length+' drawing operations</p>';}
if(o.type==='canvas')html+='<button id="addPixel">＋ Pixel drawing / button / picture</button>'+o.paint.map((p,i)=>(TD.Pixels.isPixel(p)||p.op==='big')?'<div class="event-card"><button data-edit-pixel="'+i+'">'+esc(p.name||p.op)+' at '+p.x+', '+p.y+'</button><button data-remove-pixel="'+i+'">Remove</button></div>':'').join('');
if(o.type==='canvas')html+='<p class="paint-notice">Colors and visibility are design-time settings. Use fill()/clear() in handlers to change canvas appearance on the device. Shared page canvases are cached by newer firmware. Older firmware clears and repaints on a page switch.</p>';html+=group('APPEARANCE')+'<div class="field-row">'+['fg','bg'].map(k=>'<label class="field"><span>'+(k==='fg'?'Foreground':'Background')+(o.type==='canvas'?' · design time':'')+'</span><span class="color-input"><button data-color="'+k+'" title="Choose xterm color" style="background:'+color(o[k]===-1?(k==='fg'?252:236):o[k])+'"></button><input data-key="'+k+'" type="number" min="-1" max="255" value="'+o[k]+'"></span></label>').join('')+'</div><p class="hint" style="padding:0">Xterm 0–255 · −1 uses the desktop theme</p>'+field('visible',o.type==='canvas'?'Visible · design time only':'Visible',o.visible,'checkbox');}
html+='<div class="inspector-actions">'+(!isWin?'<button id="duplicate">Duplicate</button>':'')+'<button id="deleteObject" class="danger" '+(isWin&&design.windows.length===1?'disabled':'')+'>Delete '+(isWin?'window':'widget')+'</button></div>';}
$('#inspector').innerHTML=html;brushSize();}
const brush={op:'put',text:'Hello',fg:115,bg:234,scale:1,width:0};
function brushSize(){const hint=$('#brushSize');if(hint){const size=TD.bigLayout(brush.text,brush.scale,brush.width);hint.textContent=size.w+' columns × '+size.h+' rows · click canvas to place';}}
const ansi=['#000000','#cd0000','#00cd00','#cdcd00','#0000ee','#cd00cd','#00cdcd','#e5e5e5','#7f7f7f','#ff0000','#00ff00','#ffff00','#5c5cff','#ff00ff','#00ffff','#ffffff'];
function color(n){if(n<16)return ansi[Math.max(0,n)];if(n<232){let v=n-16,a=[0,95,135,175,215,255];return 'rgb('+a[Math.floor(v/36)]+','+a[Math.floor(v/6)%6]+','+a[v%6]+')';}return 'rgb('+Array(3).fill(8+(n-232)*10).join(',')+')';}
const themes={dark:{deskfg:24,deskbg:234,fg:252,bg:236,frame:75,title:25,titlefg:231,inactive:238,button:239,input:233,inputfg:252,focus:31,select:24,accent:75,dim:244},classic:{deskfg:3,deskbg:4,fg:0,bg:7,frame:15,title:6,titlefg:15,inactive:8,button:2,input:1,inputfg:15,focus:10,select:6,accent:1,dim:8}};
const canvas=$('#screen'),ctx=canvas.getContext('2d');let layout=[];
function frame(w){return TD.windowFrame(w,design);}
function draw(){const W=design.screen.w,H=design.screen.h;if(!Number.isInteger(W)||!Number.isInteger(H)||W<1||H<1||W>300||H>150)return;canvas.width=W*10;canvas.height=H*20;const t=themes[design.theme];ctx.font='15px Consolas, "Courier New", monospace';ctx.textBaseline='middle';ctx.textAlign='center';function cell(x,y,ch,fg,bg){
    const px=x*10,py=y*20;
    if(bg!==-2){ctx.fillStyle=color(bg);ctx.fillRect(px,py,10,20);}
    if(ch===' ')return;
    ctx.save();ctx.beginPath();ctx.rect(px,py,10,20);ctx.clip();
    ctx.fillStyle=color(fg);
    // Block characters must fill exactly one cell, regardless of which
    // system font provides these glyphs. Light shade uses a 25% pattern.
    if(ch==='█')ctx.fillRect(px,py,10,20);
    else if(ch==='▀')ctx.fillRect(px,py,10,10);
    else if(ch==='▄')ctx.fillRect(px,py+10,10,10);
    else if(ch==='░'){
        for(let row=0;row<20;row+=4)
            for(let col=(row/4)%2*2;col<10;col+=4)
                ctx.fillRect(px+col,py+row,2,2);
    }else ctx.fillText(ch,px+5,py+10);
    ctx.restore();
}function fill(x,y,w,h,ch,fg,bg){for(let j=0;j<h;j++)for(let i=0;i<w;i++)cell(x+i,y+j,ch,fg,bg);}function text(x,y,s,max,fg,bg){Array.from(s).slice(0,Math.max(0,max)).forEach((c,i)=>cell(x+i,y,c,fg,bg));}
fill(0,0,W,H,'░',t.deskfg,t.deskbg);layout=[];const active=current().win;for(const w of [...design.windows.filter(w=>w!==active),active]){const f=frame(w),focused=w===active;f.cx=f.x+(w.fullscreen?0:1);f.cy=f.y+(w.fullscreen?0:1);const c=TD.sizeOf(w,design);fill(f.x,f.y,f.w,f.h,' ',t.fg,t.bg);if(!w.fullscreen){const box=focused?'╔═╗║╚╝':'┌─┐│└┘';text(f.x,f.y,box[0]+box[1].repeat(Math.max(0,f.w-2))+box[2],f.w,t.frame,t.bg);text(f.x,f.y+f.h-1,box[4]+box[1].repeat(Math.max(0,f.w-2))+box[5],f.w,t.frame,t.bg);for(let y=1;y<f.h-1;y++){cell(f.x,f.y+y,box[3],t.frame,t.bg);cell(f.x+f.w-1,f.y+y,box[3],t.frame,t.bg);}const tb=focused?t.title:t.inactive;fill(f.x+1,f.y,f.w-2,1,' ',t.titlefg,tb);text(f.x+2,f.y,w.title,f.w-11,t.titlefg,tb);text(f.x+f.w-9,f.y,'[-] [x]',7,t.titlefg,tb);}
layout.push({win:w,obj:w,r:{x:f.x,y:f.y,w:f.w,h:f.h},f});ctx.save();ctx.beginPath();ctx.rect(f.cx*10,f.cy*20,c.w*10,c.h*20);ctx.clip();const widgets=[...w.widgets.filter(o=>o.type==='canvas'&&onPage(o,w)),...w.widgets.filter(o=>o.type!=='canvas'&&onPage(o,w)),...TD.pageTabs(w,design)];const focus=w.widgets.find(o=>o.visible&&onPage(o,w)&&['button','checkbox','textbox','list'].includes(o.type));for(const o of widgets){const r=TD.rect(o,w,design),x=f.cx+r.x,y=f.cy+r.y,fg=o.fg===-1?t.fg:o.fg,bg=o.bg===-1?t.bg:o.bg;layout.push({win:w,obj:o,r:{x,y,w:r.w,h:r.h},f});if(r.w>300||r.h>150)continue;if(!o.visible)continue;switch(o.type){case'label':fill(x,y,r.w,1,' ',fg,bg);text(x,y,o.text,r.w,fg,bg);break;case'button':{const fgc=o===focus?t.titlefg:(o.fg===-1?t.fg:o.fg),bgc=o===focus?t.focus:(o.bg===-1?t.button:o.bg);text(x,y,'[ '+o.text+' ]',r.w,fgc,bgc);break;}case'checkbox':text(x,y,(o.checked?'[x] ':'[ ] ')+o.text,r.w,fg,bg);break;case'textbox':fill(x,y,r.w,1,' ',o.fg===-1?t.inputfg:fg,o.bg===-1?t.input:bg);text(x,y,o.secret?'*'.repeat(TD.bytes(o.text)):o.text,r.w,o.fg===-1?t.inputfg:fg,o.bg===-1?t.input:bg);break;case'progress':for(let i=0;i<r.w;i++)cell(x+i,y,i<Math.floor(r.w*o.value/100)?'█':'░',o.fg===-1?t.accent:fg,bg);break;case'list':for(let j=0;j<r.h;j++){const b=j===0?(o===focus?t.select:t.dim):(o.bg===-1?t.input:bg);fill(x,y+j,Math.max(0,r.w-1),1,' ',o.fg===-1?t.inputfg:fg,b);if(o.items[j])text(x+1,y+j,o.items[j],r.w-2,o.fg===-1?t.inputfg:fg,b);cell(x+r.w-1,y+j,j===0?'▲':j===r.h-1?'▼':j===1?'█':'░',t.fg,t.bg);}break;case'canvas':fill(x,y,r.w,r.h,' ',fg,bg);for(const p of o.paint){if(TD.Pixels.isPixel(p)){TD.Pixels.preview(ctx,p,x,y,color,window.TDAssetPreview?.(p.asset));continue;}if(p.op==='put')text(x+p.x,y+p.y,p.text,r.w-p.x,p.fg===-1?t.fg:p.fg,p.bg===-1?t.bg:p.bg);else if(p.op==='big')TD.bigLayout(p.text,p.scale,p.width).rows.forEach((row,j)=>text(x+p.x,y+p.y+j,row,r.w-p.x,p.fg===-1?t.fg:p.fg,p.bg===-1?t.bg:p.bg));else fill(x+p.x,y+p.y,Math.max(0,Math.min(p.w,r.w-p.x)),Math.max(0,Math.min(p.h,r.h-p.y)),p.ch,p.fg===-1?t.fg:p.fg,p.bg===-1?t.bg:p.bg);}break;}}
ctx.restore();}
if(!design.windows.some(w=>w.fullscreen)){fill(0,H-1,W,1,' ',t.fg,t.input);text(0,H-1,' ▦ Start │ '+active.title, W-8,t.fg,t.input);text(W-7,H-1,'12:00',5,t.fg,t.input);}
if(showGrid){ctx.strokeStyle='#c4ffe308';ctx.lineWidth=.5;ctx.beginPath();for(let x=0;x<=W;x++){ctx.moveTo(x*10,0);ctx.lineTo(x*10,H*20);}for(let y=0;y<=H;y++){ctx.moveTo(0,y*20);ctx.lineTo(W*10,y*20);}ctx.stroke();}
const sel=layout.find(l=>l.obj.id===selected);if(sel&&sel.obj!==sel.win){const r=sel.r;ctx.strokeStyle='#79d8a9';ctx.lineWidth=1.5;ctx.setLineDash(sel.obj.visible?[]:[4,3]);ctx.strokeRect(r.x*10+.75,r.y*20+.75,r.w*10-1.5,r.h*20-1.5);ctx.setLineDash([]);ctx.fillStyle='#b4edce';for(const [x,y] of [[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]])ctx.fillRect(x*10-2,y*20-2,4,4);$('#selectionInfo').textContent=sel.obj.name+' · '+r.w+' × '+r.h+' · ('+sel.obj.x+', '+sel.obj.y+')';}else $('#selectionInfo').textContent=active.name+' · '+active.w+' × '+active.h+' client';if(drag?.window&&drag.window.mode!=='move'){const f=frame(active),x=Math.max(0,Math.min(canvas.width-110,(f.x+f.w)*10+5)),y=Math.max(0,Math.min(canvas.height-22,(f.y+f.h)*20+3));ctx.fillStyle='#173e2b';ctx.fillRect(x,y,110,22);ctx.font='12px Consolas,monospace';ctx.fillStyle='#d8ffe6';ctx.textAlign='left';ctx.fillText(active.w+' x '+active.h,x+7,y+11);}fit();}
function fit(){let scale=Number($('#zoom').value);if(!scale){const stage=$('#stage');scale=Math.min((stage.clientWidth-50)/canvas.width,(stage.clientHeight-90)/canvas.height,1.5);scale=Math.max(.2,scale);}canvas.style.width=canvas.width*scale+'px';canvas.style.height=canvas.height*scale+'px';}
function point(e,precise=false){const b=canvas.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*design.screen.w,y=(e.clientY-b.top)/b.height*design.screen.h;return {x:precise?x:Math.floor(x),y:precise?y:Math.floor(y)};}
function windowEdge(p){
 const l=[...layout].reverse().find(l=>l.obj===l.win&&p.x>=l.r.x&&p.y>=l.r.y&&p.x<l.r.x+l.r.w&&p.y<l.r.y+l.r.h);
 if(!l||l.win.fullscreen)return null;
 const east=p.x===l.f.x+l.f.w-1,south=p.y===l.f.y+l.f.h-1;
 const mode=east&&south?'resize-se':east?'resize-e':south?'resize-s':p.y===l.f.y?'move':null;
 return mode?{...l,mode}:null;
}
function liveWindowFields(){const {obj}=current();for(const key of ['w','h','x','y']){const input=$('#inspector [data-key="'+key+'"]');if(input)input.value=obj[key]??'';}}
function hit(p){return [...layout].reverse().find(l=>p.x>=l.r.x&&p.y>=l.r.y&&p.x<l.r.x+l.r.w&&p.y<l.r.y+l.r.h&&(l.obj===l.win||l.obj.visible||l.obj.id===selected));}
function addWidget(type,p,win){win=win||current().win;const name=unique(type);const o=TD.widget(type,name);o.page=activePage(win);const c=TD.sizeOf(win,design);o.w=Math.min(o.w,c.w-4);if(p){o.x=p.x;o.y=p.y;}else{let y=1;while(win.widgets.some(o=>o.y===y)&&y<c.h-1)y++;o.x=2;o.y=y;}snapshot();win.widgets.push(o);selected=o.id;paintMode=false;tab='properties';render();}
function paint(p){
 const {obj:o}=current(),l=layout.find(l=>l.obj===o);if(!l||o.type!=='canvas')return;
 const x=p.x-l.r.x,y=p.y-l.r.y;if(x<0||y<0||x>=o.w||y>=o.h)return;
 let op={op:brush.op,x,y,text:brush.text,fg:brush.fg,bg:brush.bg};
 if(brush.op==='big'){
  if(!Number.isInteger(brush.scale)||brush.scale<1||brush.scale>4||!Number.isInteger(brush.width)||brush.width<0||brush.width>64||Array.from(brush.text).length>64)return toast('Big text: up to 64 characters, scale 1–4, width 0–64.');
  const size=TD.bigLayout(brush.text,brush.scale,brush.width);
  if(!size.w||x+size.w>o.w||y+size.h>o.h)return toast('Big text needs '+size.w+' × '+size.h+' cells at this position.');
  op.scale=brush.scale;op.width=brush.width;
 }else{op.text=Array.from(brush.text).slice(0,o.w-x).join('');if(!op.text)return;}
 if(JSON.stringify(o.paint.at(-1))===JSON.stringify(op))return;
 if(drag&&!drag.recorded){snapshot();drag.recorded=true;}o.paint.push(op);update();
}
function openModal(title,html){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modal').showModal();}
function editHandler(name,args,done){const existing=Object.hasOwn(design.handlers,name)?design.handlers[name]:null;openModal('Event handler',field('handlerName','Function name',name)+field('handlerArgs','Parameters',existing?existing.args:args)+'<label class="field"><span>Python body · indentation inside the function</span></label><textarea id="handlerBody" spellcheck="false">'+esc(existing?existing.body:'pass')+'</textarea><p>Handlers run in the script task. Avoid blocking loops and long sleeps.</p><div class="modal-actions"><button id="handlerSave" class="primary">Save handler</button></div>');$('#handlerBody').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const t=e.target,start=t.selectionStart;t.setRangeText('    ',start,t.selectionEnd,'end');}});$('#handlerSave').onclick=()=>{const n=$('[data-key="handlerName"]').value,a=$('[data-key="handlerArgs"]').value;if(!TD.identifier(n))return toast('Use an ASCII Python function name.');const body=$('#handlerBody').value;if(!body.trim())return toast('Enter a handler body, or pass.');snapshot();Object.defineProperty(design.handlers,n,{value:{args:a,body},enumerable:true,writable:true,configurable:true});done(n);$('#modal').close();render();};}
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportCurrent(){const result=TD.validate(design);if(result.errors.length)throw Error(result.errors.join('\n'));return {name:safeName()+'.py',content:TD.generate(design)};}
function compileError(error){
 $('#issues').insertAdjacentHTML('beforeend','<p class="error">.mpy: '+esc(error.message)+'</p>');$('#issues').hidden=false;
 $('#health').textContent='.mpy compilation failed';$('#healthDot').style.background='#c56551';
}
async function exportMpy(){
 const exported=exportCurrent();compilingMpy=true;$('#downloadMpy').disabled=true;
 try{
  const content=await window.compileMpy(exported.content,exported.name);
  $('#compiledSize').textContent='.py '+TD.bytes(exported.content).toLocaleString()+' B / .mpy '+content.length.toLocaleString()+' B';
  return {name:exported.name.replace(/\.py$/,'.mpy'),content};
 }catch(error){compileError(error);throw error;}
 finally{compilingMpy=false;$('#downloadMpy').disabled=TD.validate(design).errors.length>0;}
}
window.StudioDesign={exportCurrent,exportMpy};
function safeName(){return design.name.replace(/[^a-zA-Z0-9_-]/g,'_')||'app';}
function renameOffer(){
    if(!pendingRename||pendingRename.id!==current().obj.id)return '<div id="renameOffer"></div>';
    return '<div id="renameOffer" class="paint-notice">Rename '+esc(pendingRename.from)+' → '+esc(pendingRename.to)+' in handler bodies too?<div class="inspector-actions"><button id="applyRename">Update references</button><button id="dismissRename">Dismiss</button></div></div>';
}
function pageSettings(w){
    return group('PAGES')+w.pages.map(p=>'<div class="page-setting"><span>'+esc(p.name)+'</span><button data-rename-page="'+esc(p.id)+'" title="Rename page">✎</button><button data-delete-page="'+esc(p.id)+'" title="Remove page" '+(w.pages.length===1?'disabled':'')+'>×</button></div>').join('')+'<button id="addPage" '+(w.pages.length>=16?'disabled':'')+'>＋ Add page</button>'+selectField('initialPage','Startup page',w.initialPage,w.pages.map(p=>[p.id,p.name]))+field('tabsEnabled','Generate tab buttons',w.tabs.enabled,'checkbox')+field('tabRow','Tab button row',w.tabs.row,'number','Negative rows count from the bottom. Tabs count toward the widget limit.');
}
function addPage(w){
    if(w.pages.length>=16)return toast('A window supports up to 16 pages.');
    let n=2;while(w.pages.some(p=>p.id==='page_'+n||p.name==='Page '+n))n++;
    snapshot();const p={id:'page_'+n,name:'Page '+n};w.pages.push(p);pageViews.set(w.id,p.id);selected=w.id;paintMode=false;render();
}
function renamePage(w,id){
    const p=w.pages.find(p=>p.id===id);
    openModal('Rename page',field('pageTitle','Page name',p.name)+'<div class="modal-actions"><button id="savePageName" class="primary">Save name</button></div>');
    $('#savePageName').onclick=()=>{
        const name=$('[data-key="pageTitle"]').value;
        if(!name.trim()||TD.bytes(name)>63||/[\0\r\n]/.test(name)||w.pages.some(p=>p.id!==id&&p.name===name))return toast('Use a unique, single-line name of at most 63 UTF-8 bytes.');
        snapshot();p.name=name;$('#modal').close();render();
    };
}
function deletePage(w,id){
    if(w.pages.length===1)return;
    snapshot();w.pages=w.pages.filter(p=>p.id!==id);const next=w.pages[0].id;
    for(const o of w.widgets){if(o.page===id)o.page=next;if(o.goToPage===id)o.goToPage=next;}
    if(w.initialPage===id)w.initialPage=next;
    pageViews.set(w.id,next);selected=w.id;render();toast('Page removed; its widgets moved to '+w.pages[0].name);
}
$('#pageTabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;const {win}=current();if(b.dataset.addPage)addPage(win);else if(b.dataset.viewPage){pageViews.set(win.id,b.dataset.viewPage);selected=win.id;paintMode=false;render();}};
$('#exportOptions').onclick=()=>{
    openModal('Python export options','<p>.mpy bytecode does not retain design comments. Save JSON to reopen a compiled design.</p>'+field('embedDesign','Embed design for re-import',design.options.embedDesign,'checkbox')+'<p>The design is stored after tdui.run(), in comment lines of at most 100 characters. Without it, use JSON to reopen the design.</p>'+field('keepUnusedHandlers','Keep unused handlers in the file',design.options.keepUnusedHandlers,'checkbox')+field('appVersion','Application version',design.application?.version||'0.1.0')+field('modules','Application modules · comma separated',(design.modules||[]).join(', '))+'<p>Unused handlers stay in the JSON design. By default, only handlers used by events, timers, or other used handlers are exported.</p><div class="modal-actions"><button id="saveExportOptions" class="primary">Apply options</button></div>');
    $('#saveExportOptions').onclick=()=>{const modules=$('[data-key="modules"]').value.split(',').map(s=>s.trim()).filter(Boolean);if(modules.some(n=>!TD.identifier(n)))return toast('Use Python module names separated by commas.');snapshot();TDVersion.stamp(design);design.application.version=$('[data-key="appVersion"]').value;design.modules=modules;design.options={embedDesign:$('[data-key="embedDesign"]').checked,keepUnusedHandlers:$('[data-key="keepUnusedHandlers"]').checked};$('#modal').close();render();};
};
$('#palette').innerHTML=TD.TYPES.map(t=>'<button class="component" draggable="true" data-type="'+t+'"><span class="glyph">'+glyphs[t]+'</span>'+t[0].toUpperCase()+t.slice(1)+'</button>').join('');
$('#palette').onclick=e=>{const el=e.target.closest('[data-type]');if(el)addWidget(el.dataset.type);};$('#palette').ondragstart=e=>{const el=e.target.closest('[data-type]');if(el){e.dataTransfer.setData('text/plain',el.dataset.type);e.dataTransfer.effectAllowed='copy';}};
canvas.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';};canvas.ondrop=e=>{e.preventDefault();const type=e.dataTransfer.getData('text/plain');if(!TD.TYPES.includes(type))return;const p=point(e),l=hit(p);if(!l)return toast('Drop inside a window.');if(p.x<l.f.cx||p.y<l.f.cy)return toast('Drop inside the window client area.');addWidget(type,{x:p.x-l.f.cx,y:p.y-l.f.cy},l.win);};
canvas.onpointerdown=e=>{
 if(e.button!==0)return;const p=point(e),edge=windowEdge(p);
 if(edge){selected=edge.win.id;paintMode=false;render();canvas.focus();drag={recorded:false,window:TD.beginWindowDrag(design,edge.win.id,edge.mode,point(e,true))};canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
 if(paintMode&&current().obj.type==='canvas'){drag={paint:true,recorded:false};paint(p);canvas.setPointerCapture(e.pointerId);return;}
 const l=hit(p);if(!l)return;if(l.obj.generated){pageViews.set(l.win.id,l.obj.goToPage);selected=l.win.id;paintMode=false;render();return;}
 selected=l.obj.id;render();canvas.focus();if(l.obj===l.win)return;
 drag={recorded:false,id:l.obj.id,start:p,x:l.obj.x,y:l.obj.y,isWin:false,f:l.f};canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove=e=>{
 if(!drag){const edge=windowEdge(point(e));canvas.style.cursor=edge?({'move':'move','resize-e':'ew-resize','resize-s':'ns-resize','resize-se':'nwse-resize'}[edge.mode]):paintMode?'crosshair':'default';return;}
 if(drag.window){const next=TD.updateWindowDrag(drag.window,point(e,true));if(!drag.recorded&&JSON.stringify(next)!==JSON.stringify(design)){snapshot();drag.recorded=true;}design=next;update();liveWindowFields();return;}
 const p=point(e);if(drag.paint){paint(p);return;}
 const {obj:o,win}=current(),c=TD.sizeOf(win,design),dx=p.x-drag.start.x,dy=p.y-drag.start.y;
 if(dx===0&&dy===0&&!drag.recorded)return;if(!drag.recorded){snapshot();drag.recorded=true;}
 const r=TD.rect(o,win,design),startX=drag.x<0?c.w+drag.x:drag.x,startY=drag.y<0?c.h+drag.y:drag.y;
 const x=Math.max(0,Math.min(c.w-r.w,startX+dx)),y=Math.max(0,Math.min(c.h-r.h,startY+dy));
 o.x=drag.x<0?x-c.w:x;o.y=drag.y<0?y-c.h:y;update();
};
canvas.onpointerup=e=>{
 if(!drag)return;
 if(drag.window){const result=TD.finishWindowDrag(drag.window,point(e,true),e.altKey);if(!drag.recorded&&JSON.stringify(result.design)!==JSON.stringify(design))snapshot();design=result.design;}
 drag=null;render();
};
canvas.onpointercancel=()=>{drag=null;render();};
$('#layers').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.click();}};
$('#layers').onclick=e=>{const page=e.target.closest('[data-outline-page]');if(page){pageViews.set(page.dataset.pageWin,page.dataset.outlinePage);selected=page.dataset.pageWin;paintMode=false;render();return;}const l=e.target.closest('[data-id]');if(l){selected=l.dataset.id;paintMode=false;render();}};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));renderInspector();});
$('#inspector').oninput=e=>{const key=e.target.dataset.key;if(!key)return;const {obj:o,win}=current();if(key.startsWith('brush')){const property={brushOp:'op',brushText:'text',brushFg:'fg',brushBg:'bg',brushScale:'scale',brushWidth:'width'}[key];brush[property]=['op','text'].includes(property)?e.target.value:Number(e.target.value);if(key==='brushOp')renderInspector();else brushSize();return;}let value=e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?(e.target.value===''&&o===win&&['x','y'].includes(key)?null:Number(e.target.value)):e.target.value;if(['page','goToPage'].includes(key)&&value==='')value=null;if(key==='items')value=value===''?[]:value.split('\n');if(JSON.stringify(o[key])===JSON.stringify(value))return;snapshot(o.id+':'+key);if(key==='tabsEnabled')o.tabs.enabled=value;else if(key==='tabRow')o.tabs.row=value;else o[key]=value;if(key==='page'){if(value!==null)pageViews.set(win.id,value);paintMode=false;}renderLayers();$('.object-name').textContent=o.name;if(['fg','bg'].includes(key)){const swatch=$('[data-color="'+key+'"]');if(swatch)swatch.style.background=color(value===-1?(key==='fg'?252:236):value);}update();};
$('#inspector').onclick=e=>{const b=e.target.closest('button');if(!b)return;const {obj:o,win}=current();if(b.dataset.deleteHandler){if(TD.handlerUsage(design).unused.includes(b.dataset.deleteHandler)){snapshot();delete design.handlers[b.dataset.deleteHandler];render();}return;}if(b.id==='applyRename'){snapshot();TD.renameReferences(design,pendingRename.from,pendingRename.to);pendingRename=null;render();return;}if(b.id==='dismissRename'){pendingRename=null;renderInspector();return;}if(b.id==='centerWindow'){snapshot();design=TD.moveWindow(design,win.id,0,0,true);render();return;}if(b.id==='addPage'){addPage(win);return;}if(b.dataset.renamePage){renamePage(win,b.dataset.renamePage);return;}if(b.dataset.deletePage){deletePage(win,b.dataset.deletePage);return;}if(b.dataset.event){const ev=b.dataset.event;editHandler(o.events[ev]||unique(o.name+'_'+ev),TD.EVENTS[o===win?'window':o.type][ev],n=>o.events[ev]=n);}else if(b.dataset.handler)editHandler(b.dataset.handler,'',()=>{});else if(b.dataset.clearEvent){snapshot();delete o.events[b.dataset.clearEvent];render();}else if(b.dataset.color){const k=b.dataset.color;openModal('Xterm 256 · '+k,'<p>−1 inherits the desktop theme.</p><button id="defaultColor">Theme default (−1)</button><div class="swatches" style="margin-top:14px">'+Array.from({length:256},(_,i)=>'<button data-swatch="'+i+'" style="background:'+color(i)+'" title="'+i+'" aria-label="Color '+i+'"></button>').join('')+'</div>');$('#modalBody').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.swatch!==undefined||b.id==='defaultColor'){snapshot();o[k]=b.id==='defaultColor'?-1:Number(b.dataset.swatch);$('#modal').close();render();}};}else if(b.id==='paintToggle'){paintMode=!paintMode;renderInspector();}else if(b.id==='clearPaint'){snapshot();o.paint=[];render();}else if(b.id==='fillCanvas'){if(Array.from(brush.text).length!==1)return toast('Use one brush character for a fill.');snapshot();o.paint.push({op:'fill',x:0,y:0,w:o.w,h:o.h,ch:brush.text,fg:brush.fg,bg:brush.bg});render();}else if(b.id==='duplicate'){snapshot();const copy=TD.clone(o);copy.name=unique(o.type);copy.id=copy.name;copy.y++;win.widgets.push(copy);selected=copy.id;render();}else if(b.id==='deleteObject'){snapshot();if(o===win){rememberRemoved([win,...win.widgets]);design.windows=design.windows.filter(w=>w!==win);selected=design.windows[0].id;}else{rememberRemoved([o]);win.widgets=win.widgets.filter(w=>w!==o);selected=win.id;}paintMode=false;render();}else if(b.id==='addTimer'||b.dataset.timerEdit!==undefined){const index=b.dataset.timerEdit,old=index===undefined?null:win.timers[Number(index)];openModal('Window timer','<label class="field">Timer kind<select id="timerKind"><option value="every">every · repeating</option><option value="after">after · once</option></select></label>'+field('timerMs','Interval / delay (ms)',old?old.ms:1000,'number')+'<p>The callback receives no arguments.</p><div class="modal-actions"><button id="timerNext" class="primary">Edit callback →</button></div>');$('#timerKind').value=old?old.kind:'every';$('#timerNext').onclick=()=>{const kind=$('#timerKind').value,ms=Number($('[data-key="timerMs"]').value);if(!Number.isInteger(ms)||ms<1)return toast('Use a positive interval in milliseconds.');$('#modal').close();editHandler(old?old.fn:unique('timer_tick'),'',n=>{const t={kind,ms,fn:n};if(old)win.timers[Number(index)]=t;else win.timers.push(t);});};}else if(b.dataset.timerRemove!==undefined){snapshot();win.timers.splice(Number(b.dataset.timerRemove),1);render();}};
$('#addWindow').onclick=()=>{if(design.windows.length>=4)return;const w=TD.windowModel(1);w.name=unique('win');w.id=w.name;w.title='New window';w.w=40;w.h=12;snapshot();design.windows.push(w);selected=w.id;render();};
$('#projectName').oninput=e=>{if(design.name===e.target.value)return;snapshot('projectName');design.name=e.target.value;update();};$('#board').onchange=e=>{snapshot();design.board=Number(e.target.value);update();};$('#theme').onchange=e=>{snapshot();design.theme=e.target.value;update();};$('#grid').onclick=()=>{showGrid=!showGrid;$('#grid').classList.toggle('active',showGrid);draw();};$('#zoom').onchange=fit;
function customScreen(){openModal('Custom screen size','<div class="field-row">'+field('screenW','Columns · 20–300',design.screen.w,'number')+field('screenH','Rows · 5–150',design.screen.h,'number')+'</div><div class="modal-actions"><button id="applyScreen" class="primary">Apply dimensions</button></div>');$('#applyScreen').onclick=()=>{const w=Number($('[data-key="screenW"]').value),h=Number($('[data-key="screenH"]').value);if(!Number.isInteger(w)||!Number.isInteger(h)||w<20||w>300||h<5||h>150)return toast('Use 20–300 columns and 5–150 rows.');snapshot();design.screen={w,h};$('#modal').close();render();};}
$('#screenPreset').onchange=e=>{if(e.target.value==='custom')return customScreen();snapshot();const [w,h]=e.target.value.split(',').map(Number);design.screen={w,h};render();};$('#screenCustom').onclick=customScreen;
$('#downloadMpy').onclick=async()=>{try{const exported=await exportMpy();download(exported.name,exported.content,'application/octet-stream');toast('Bytecode exported · save JSON to reopen this design');}catch(error){/* Already shown beside validation errors. */}};
$('#save').onclick=()=>download(safeName()+'.json',JSON.stringify(design,null,2)+'\n','application/json');$('#download').onclick=()=>{try{const exported=exportCurrent();download(exported.name,exported.content,'text/x-python');toast('Python exported · run with py '+exported.name);}catch(e){$('#issues').hidden=false;}};$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(TD.generate(design));toast('Python copied to clipboard');}catch(e){openModal('Copy Python','<p>Select the generated Python below and copy it.</p><textarea id="copyFallback" style="width:100%;height:300px"></textarea>');$('#copyFallback').value=TD.generate(design);$('#copyFallback').select();}};
$('#import').onclick=()=>$('#file').click();$('#file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5000000)throw Error('Design files must be smaller than 5 MB.');const next=TD.parse(await f.text());snapshot();design=next;selected=design.windows[0].id;paintMode=false;render();toast('Imported '+f.name);}catch(err){toast('Import failed: '+err.message);}e.target.value='';};
$('#newProject').onclick=()=>{
    openModal('Start a new project','<p>Save JSON to keep a separate copy of your current design. Private apps are opened with Import and remain in your own project files.</p><div class="modal-actions"><button id="loadExample">Load example</button><button id="blankProject" class="primary">New blank project</button></div>');
    const replace=next=>{snapshot();design=TD.normalize(TD.clone(next));selected=design.windows[0].id;paintMode=false;pageViews.clear();$('#modal').close();render();};
    $('#loadExample').onclick=()=>replace(TD.initial());
    $('#blankProject').onclick=()=>replace({...TD.initial(),name:'untitled',windows:[TD.windowModel()],handlers:{}});
};
$('#closeModal').onclick=()=>{$('#modal').close();$('#modalBody').onclick=null;};
$('#modal').addEventListener('close',()=>{$('#modalBody').onclick=null;});
$('#issuesButton').onclick=()=>$('#issues').hidden=!$('#issues').hidden;
$('#expandCode').onclick=()=>window.StudioLayout?.expandCode();
$('#help').onclick=()=>openModal('A small studio for small computers','<p>Design TinyDesk MicroPython apps in character cells. Add a window, drag in components, and use the inspector to edit cell coordinates, colors, and events.</p><p><b>Canvas painting:</b> select a canvas, enable Paint cells, set brush text and colors, then click or drag. Use a single character to fill the whole canvas.</p><p><b>Keyboard:</b> select a component, then use arrow keys to move it. Shift moves five cells. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z redoes. Delete removes a selected widget.</p><p><b>Panels:</b> drag the inner-edge separators to resize; double-click to reset. Focus a separator and use arrows (16 px), or Shift+arrows (64 px). Ctrl+Alt+1, 2, and 3 collapse or reopen Components/Outline, Inspector, and Generated Python. The split between Components and Outline also resizes.</p><p><b>Window:</b> drag the title bar to move it, or the right/bottom frame to resize in whole cells. Hold Alt when releasing a title-bar drag to center it; the Inspector also has a Center button.</p><p><b>Big text:</b> choose Big text in a canvas inspector, enter text, scale and width, and place it in the preview. The size is shown in cells.</p><p><b>Files:</b> Save JSON keeps the full design. Export Python includes a JSON design comment for re-import. Edits made to Python outside that comment are not recovered on import.</p><p>Run the export on TinyDesk with <span class="keyboard">py /root/Desktop/app.py</span>. Export is blocked by layout and resource errors. Overlaps are warnings. The preview models the supplied Dark and Classic themes; select the same theme on your device.</p><p>This app works offline from index.html. Browser storage is best effort; keep JSON copies. Handler logic and hardware interactions need testing on the board.</p>');
document.addEventListener('focusin',e=>{if(e.target.closest('#inspector')&&e.target.dataset.key==='name'){const {obj}=current();renameStart={id:obj.id,from:obj.name};}});
document.addEventListener('focusout',e=>{if(e.target.closest('#inspector')&&e.target.dataset.key==='name'&&renameStart){const {obj}=current();if(renameStart.id===obj.id&&renameStart.from!==obj.name&&TD.identifier(renameStart.from)&&TD.identifier(obj.name)){design.knownNames=[...new Set([...design.knownNames,renameStart.from])];if(Object.values(design.handlers).some(h=>new RegExp('\\b'+renameStart.from+'\\b').test(h.body))){pendingRename={from:renameStart.from,to:obj.name,id:obj.id};const offer=$('#renameOffer');if(offer)offer.outerHTML=renameOffer();}update();}renameStart=null;}if(e.target.closest('#inspector')||e.target.id==='projectName')historyGroup=null;});
document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return; // Keep native text undo in dialogs.
    const editable=e.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
    const designField=e.target.id==='projectName'||(e.target.closest('#inspector')&&e.target.dataset.key&&!e.target.dataset.key.startsWith('brush'));
    const key=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&(key==='z'||key==='y')&&(!editable||designField)){
        e.preventDefault();undo(key==='y'||e.shiftKey);return;
    }
    if(editable)return;if(e.target!==canvas)return;const {obj:o,win}=current();if(o===win)return;if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();snapshot();rememberRemoved([o]);win.widgets=win.widgets.filter(w=>w!==o);selected=win.id;render();return;}const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(deltas[e.key]){e.preventDefault();snapshot();o.x+=deltas[e.key][0]*(e.shiftKey?5:1);o.y+=deltas[e.key][1]*(e.shiftKey?5:1);render();}});
new ResizeObserver(fit).observe($('#stage'));render();
