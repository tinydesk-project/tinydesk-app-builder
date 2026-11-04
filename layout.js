/* Resizable editor chrome. It never becomes part of the board's design. */
(function(){
    'use strict';
    const root=document.documentElement,main=document.querySelector('main'),workspace=document.querySelector('.workspace');
    const defaults={left:208,right:274,code:242,components:270,leftCollapsed:false,rightCollapsed:false,codeCollapsed:false,codeFloating:false};
    const state={...defaults},key='tdab.layout';
    try{const saved=JSON.parse(localStorage.getItem(key)??localStorage.getItem('tinydesk-studio-layout'));if(saved&&typeof saved==='object')for(const k of Object.keys(defaults)){
        if(typeof defaults[k]==='boolean'&&typeof saved[k]==='boolean')state[k]=saved[k];
        else if(typeof defaults[k]==='number'&&Number.isFinite(saved[k]))state[k]=Math.max(k==='code'||k==='components'?120:180,Math.min(1200,saved[k]));
    }}catch(e){/* Defaults work with missing, corrupt or disabled storage. */}
    if(window.innerWidth<900)state.leftCollapsed=state.rightCollapsed=true;
    const $=s=>document.querySelector(s),clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v));
    function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(e){}}
    function aria(id,value,max){const el=$('#'+id),min=Number(el.getAttribute('aria-valuemin'));max=Math.max(min,max);value=clamp(value,min,max);el.setAttribute('aria-valuenow',Math.round(value));el.setAttribute('aria-valuemax',Math.round(max));el.setAttribute('aria-valuetext',el.getAttribute('aria-disabled')==='true'?'Collapsed':Math.round(value)+' pixels');}
    function apply(){
        const small=window.innerWidth<900,width=main.clientWidth;
        let left=state.leftCollapsed?28:state.left,right=state.rightCollapsed?28:state.right;
        if(small)left=right=28;
        else{
            const budget=Math.max(360,width-332);
            if(!state.leftCollapsed&&!state.rightCollapsed&&left+right>budget){left=clamp(budget*left/(left+right),180,budget-180);right=budget-left;}
            else if(!state.leftCollapsed)left=clamp(left,180,width-320-right-12);
            else if(!state.rightCollapsed)right=clamp(right,180,width-320-left-12);
        }
        root.style.setProperty('--left-size',left+'px');root.style.setProperty('--right-size',right+'px');
        for(const side of ['left','right']){
            const el=$('#'+side+'Panel');el.classList.toggle('collapsed',state[side+'Collapsed']);
            el.classList.toggle('panel-overlay',small&&!state[side+'Collapsed']);
            el.style.setProperty('--overlay-size',Math.min(state[side],width-28)+'px');
            root.style.setProperty('--'+side+'-overlay-size',Math.min(state[side],width-28)+'px');
            $('#'+side+'Resize').setAttribute('aria-disabled',String(state[side+'Collapsed']));
        }
        const chrome=$('.canvas-toolbar').offsetHeight+$('#pageTabs').offsetHeight;
        const codeMax=Math.max(120,workspace.clientHeight-chrome-206);
        const short=workspace.clientHeight-chrome<326;workspace.classList.toggle('short-space',short);
        const codeCollapsed=state.codeCollapsed||(short&&!state.codeFloating);
        const code=codeCollapsed?30:clamp(state.code,120,codeMax);
        $('#codePanel').classList.toggle('collapsed',codeCollapsed);
        $('#codePanel').classList.toggle('code-overlay',short&&!codeCollapsed);
        $('#codeResize').setAttribute('aria-disabled',String(codeCollapsed));
        root.style.setProperty('--code-size',code+'px');
        const componentsMax=Math.max(120,$('.left-content').clientHeight-146);
        const components=clamp(state.components,120,componentsMax);
        root.style.setProperty('--components-size',components+'px');
        aria('leftResize',small?Math.min(state.left,width-28):left,Math.max(180,small?width-28:width-right-332));
        aria('rightResize',small?Math.min(state.right,width-28):right,Math.max(180,small?width-28:width-left-332));
        aria('codeResize',codeCollapsed?state.code:code,codeMax);aria('componentsResize',components,componentsMax);
    }
    function toggle(panel){
        const collapsed=$('#'+(panel==='code'?'code':panel)+'Panel').classList.contains('collapsed');
        state[panel+'Collapsed']=!collapsed;if(panel==='code')state.codeFloating=collapsed;
        apply();save();
    }
    document.querySelectorAll('[data-collapse]').forEach(b=>b.addEventListener('click',()=>toggle(b.dataset.collapse)));
    const handles={leftResize:{key:'left',axis:'x',sign:1},rightResize:{key:'right',axis:'x',sign:-1},codeResize:{key:'code',axis:'y',sign:-1},componentsResize:{key:'components',axis:'y',sign:1}};
    for(const [id,cfg] of Object.entries(handles)){
        const el=$('#'+id);let drag=null;
        el.addEventListener('pointerdown',e=>{
            if(e.button!==0||el.getAttribute('aria-disabled')==='true')return;
            e.preventDefault();el.focus({preventScroll:true});drag={start:cfg.axis==='x'?e.clientX:e.clientY,value:Number(el.getAttribute('aria-valuenow'))};
            el.setPointerCapture(e.pointerId);document.body.classList.add('layout-dragging');document.body.style.cursor=cfg.axis==='x'?'col-resize':'row-resize';
        });
        el.addEventListener('pointermove',e=>{if(!drag)return;state[cfg.key]=clamp(drag.value+((cfg.axis==='x'?e.clientX:e.clientY)-drag.start)*cfg.sign,Number(el.getAttribute('aria-valuemin')),Number(el.getAttribute('aria-valuemax')));apply();});
        const end=()=>{if(drag){drag=null;document.body.classList.remove('layout-dragging');document.body.style.cursor='';save();}};
        el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
        el.addEventListener('dblclick',()=>{state[cfg.key]=defaults[cfg.key];apply();save();});
        el.addEventListener('keydown',e=>{
            if(el.getAttribute('aria-disabled')==='true')return;
            const back=cfg.axis==='x'?'ArrowLeft':'ArrowUp',forward=cfg.axis==='x'?'ArrowRight':'ArrowDown';
            if(e.key!==back&&e.key!==forward)return;e.preventDefault();
            state[cfg.key]=clamp(Number(el.getAttribute('aria-valuenow'))+(e.key===forward?1:-1)*cfg.sign*(e.shiftKey?64:16),Number(el.getAttribute('aria-valuemin')),Number(el.getAttribute('aria-valuemax')));apply();save();
        });
    }
    document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.altKey&&['1','2','3'].includes(e.key)&&!document.querySelector('dialog[open]')){e.preventDefault();toggle({'1':'left','2':'right','3':'code'}[e.key]);}});
    let wasSmall=window.innerWidth<900;
    window.addEventListener('resize',()=>{const small=window.innerWidth<900;if(small&&!wasSmall)state.leftCollapsed=state.rightCollapsed=true;wasSmall=small;apply();});
    new ResizeObserver(apply).observe(main);new ResizeObserver(apply).observe(workspace);
    window.BuilderLayout={toggle,expandCode(){state.codeCollapsed=false;state.codeFloating=true;state.code=state.code>defaults.code?defaults.code:workspace.clientHeight*.55;apply();save();}};
    apply();
})();
