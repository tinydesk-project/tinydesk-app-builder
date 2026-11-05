/* Fixed inspector for canvas elements. Values are never evaluated. */
'use strict';
function editPixel(index=-1){
    const {obj:o}=current();if(o.type!=='canvas')return;
    const root=document.querySelector('#inspector'),$=selector=>root.querySelector(selector);
    if(index>=0)drawingSelection={id:o.id,index};
    document.querySelector('#typeTag').textContent='ELEMENT';
    document.querySelector('.inspector-tabs').hidden=true;
    let op=index>=0?TD.clone(o.paint[index]):{op:'bar',...TD.clone(TDPixels.defaults.bar)};
    if(['slider','gauge'].includes(op.op)&&op.radius===undefined)op.radius=0;
    if(op.op!=='button'&&!op.name)op.name='';
    const drafts={};
    function show(keepAppearance=false){
        const options=[...Object.keys(TDPixels.defaults),'big','put','fill'].map(k=>'<option '+(op.op===k?'selected':'')+'>'+k+'</option>').join('');
        let html='<h2 class="object-name">'+esc(op.name||op.op)+'</h2><div class="object-desc">'+esc(op.op)+' · '+esc(o.name)+'</div><p class="hint">Drag to move. Drag selection handles to resize. Alt-click selects the canvas.</p><label class="field"><span>Drawing</span><select id="pixelKind">'+options+'</select></label>'+
            '<p class="hint">'+(['big','put','fill'].includes(op.op)||TDPixels.cellUnits(op)?'Position and size in cells.':'Position and size in pixels (2 × 2 per cell).')+' Changes apply in this pane; no attribute window is opened.</p>';
        let basic='',appearance='';
        for(const [k,v] of Object.entries(op)){
            if(k==='op'||k==='font'||k==='gradient'||k==='sourceAsset'||k==='opaquePicture'||k==='edgeSlices'||k==='binding'||k==='surfaceStyle'||k==='qr'||k==='bg'&&op.op==='picture'||TDPixels.buttonEvents.includes(k))continue;
            let part='';
            if(k==='asset'&&v){
                part+='<fieldset><legend>Image on the board (loaded once)</legend>';
                for(const [ak,av] of Object.entries(v))part+=input('asset.'+ak,ak,av);
                part+='</fieldset><p class="hint">Set the decoded image size. Key is an RGB triple or null; dither is true/false. Copy the image to this board path. Preview shows its bounds.</p>';
            }else if(op.op==='font_text'&&['align','valign'].includes(k))part+='<label class="field"><span>'+ (k==='align'?'Horizontal alignment':'Vertical alignment')+'</span><select data-pixel-key="'+k+'">'+(k==='align'?['left','center','right']:['top','middle','bottom']).map(value=>'<option '+(value===v?'selected':'')+'>'+value+'</option>').join('')+'</select></label>';
            else if(k==='text'&&op.op==='font_text')part+='<label class="field"><span>Text</span><textarea data-pixel-key="text">'+esc(v)+'</textarea></label>';
            else if(k!=='asset')part+=input(k,k==='bg'?'Background (−2 = CLEAR)':k==='src'?'Sprite [x,y,w,h] or null':({x:'X',y:'Y',w:'Width',h:'Height',r:'Radius',name:'Element name',text:'Text',scale:'Text scale',value:'Value',maximum:'Maximum'}[k]||k),v);
            if(op.op!=='button'||['x','y','w','h','name','text'].includes(k))basic+=part;else appearance+=part;
        }
        const fontChoice=typeof fontOptions==='function'&&['put','big','draw_text','font_text','button','picture'].includes(op.op);
        if(fontChoice)basic='<label class="field"><span>Font / pixel size</span><select id="elementFont">'+fontOptions(op.font?.path||'')+'</select></label><p class="hint">A generated font has a fixed pixel size. Use Fonts for another size; the font is loaded once by the app.</p><button id="generateElementFont">Generate another font…</button>'+basic;
        if(TDAppearance.supportsTransparent(op))html+='<label class="field"><span>Text background</span><select id="textBackground"><option value="transparent" '+(op.bg===-2?'selected':'')+'>Transparent</option><option value="solid" '+(op.bg!==-2?'selected':'')+'>'+(op.op==='picture'?'Original image background':'Solid color')+'</option></select></label><p class="hint">Transparent text shows the artwork beneath the glyphs. Image-backed labels keep their geometry and font.</p>';
        if(op.op==='rect')html+='<button id="smoothPanel">Use smooth rounded panel skin</button><p class="hint">Creates an editable image-backed blue panel with corners at the LCD’s native resolution, like skinned buttons. Bounds snap outward to whole cells. Undo returns to this rectangle.</p>';
        if(op.op==='button')html+='<button id="smoothButton">Use smooth rounded button skin</button><p class="hint">Native-resolution normal/pressed artwork. The optional sprite-sheet settings below control its image.</p>';
        html+='<div class="pixel-fields">'+basic+'</div>';
        if('radius' in op&&!op.surfaceStyle)html+='<label class="field"><span>Corner style</span><select id="cornerStyle">'+(op.asset?'<option value="skin" selected>Image skin corners</option>':'')+'<option value="square" '+(!op.asset&&op.radius===0?'selected':'')+'>Straight corners</option><option value="round" '+(!op.asset&&op.radius>0?'selected':'')+'>Rounded corners</option></select></label><p class="hint">'+(op.asset?'The skin supplies its own shape. Choose Straight or Rounded to replace the image skin with the button’s colors.':'Changes redraw immediately. Rounding needs at least 6 pixels of height (3 cells for buttons). Later opaque elements can cover the corners.')+'</p>';
        if(op.op==='slider'){
            const handler=design.handlers[op.on_change];
            const targets=design.windows.flatMap(w=>w.widgets.flatMap(o=>o.paint)).filter(p=>p.name&&['gauge','bar','put','picture','big','draw_text'].includes(p.op));
            html+='<p class="hint">Bind the slider to a named field, or edit its Python callback for advanced behavior.</p><label class="field"><span>Update another field</span><select id="controlBinding"><option value="">Choose a field…</option>'+targets.map(p=>'<option value="'+esc(p.name)+'" data-text="'+!['gauge','bar'].includes(p.op)+'">'+esc(p.name)+'</option>').join('')+'</select></label><label class="field"><span>on_change Python body</span><textarea id="controlBody" spellcheck="false">'+esc(handler?.body||'pass')+'</textarea></label>';
        }
        if(op.op==='button'){
            html+='<details class="pixel-section" '+(keepAppearance?'open':'')+'><summary>Appearance and optional sprite sheet</summary><div class="pixel-fields">'+appearance+'</div><label class="field"><span>Use sprite sheet (optional)</span><input id="buttonSkin" type="checkbox" '+(op.asset?'checked':'')+'></label></details>';
            html+='<p class="hint">Press fires on pointer down. Release fires wherever you let go; click follows inside, cancel follows outside. Use window timers for ongoing work.</p>';
            for(const event of TDPixels.buttonEvents){
                const name=op[event]||'',handler=design.handlers[name];
                html+='<details class="pixel-section" '+(event==='on_click'?'open':'')+'><summary>'+event+'(button)'+(name?' → '+esc(name):'')+'</summary>'+input(event,'Function name · blank disconnects',name)+
                    '<label class="field"><span>Starter action</span><select data-event-recipe="'+event+'"><option value="">Choose a starter…</option><option value="custom">Custom Python</option><option value="text">Set button text</option><option value="page">Switch page</option><option value="close">Close window</option><option value="log">Log event</option></select></label>'+
                    '<textarea data-event-body="'+event+'" spellcheck="false" aria-label="'+event+' Python body">'+esc(drafts[event]??(handler?handler.body:'pass'))+'</textarea></details>';
            }
        }
        html+='<p id="pixelError" role="alert"></p><div class="pixel-save"><button id="pixelSave" class="primary">Apply changes</button></div>';
        if(index>=0)html+='<div class="modal-actions"><button id="elementDuplicate">Duplicate</button><button id="elementBack" '+(index===0?'disabled':'')+'>Send backward</button><button id="elementForward" '+(index===o.paint.length-1?'disabled':'')+'>Bring forward</button><button id="elementDelete">Delete element</button></div>';
        root.innerHTML=html;
        if(fontChoice){
            if(op.op==='font_text')$('#elementFont').querySelector('option[value=""]').disabled=true;
            $('#generateElementFont').onclick=()=>openFontEditor();
            $('#elementFont').onchange=e=>{
                try{
                    readFields(op);const name=e.target.value;
                    if(name){
                        if(!['font_text','button','picture'].includes(op.op)){
                            const old=op,b=drawingBounds(old),x=Math.floor(b.x),y=Math.floor(b.y),w=Math.max(1,Math.min(o.w-x,Math.ceil(b.w)));
                            const face=TDFontPreview({path:name}),[cw,ch]=TDFontCellSize(),height=face?Math.ceil(TDFonts.measure(face,old.text,w*cw,true).h/ch):Math.ceil(b.h);
                            op={...TD.clone(TDPixels.defaults.font_text),op:'font_text',name:old.name||unique('text'),text:old.text,x,y,w,h:Math.max(1,Math.min(o.h-y,Math.max(Math.ceil(b.h),height))),fg:old.fg??old.color??231,bg:old.bg??25,...(old.sourceAsset?{sourceAsset:old.sourceAsset}:{})};
                        }
                        op.font={path:'/root/'+name};
                    }else delete op.font;
                    show(keepAppearance);$('#pixelSave').click();
                }catch(error){$('#pixelError').textContent=error.message;}
            };
        }
        if($('#textBackground'))$('#textBackground').onchange=e=>{
            try{readFields(op);snapshot('element:'+o.id+':'+index);const resource=TDAppearance.resourceFor(design.assets,TDAppearance.clearResource);op=TDAppearance.textBackground(op,e.target.value==='transparent',resource.name);if(op.op==='picture'&&op.bg===-2&&!design.assets?.some(a=>a.name===resource.name))TDResources.storeImage(design,resource);show(keepAppearance);$('#pixelSave').click();}catch(error){$('#pixelError').textContent=error.message;}
        };
        if($('#smoothPanel'))$('#smoothPanel').onclick=()=>{try{readFields(op);snapshot('element:'+o.id+':'+index);const resource=TDAppearance.resourceFor(design.assets,TDBuiltinAssets['ui_skin.ppm'],'td_smooth_panel.ppm');if(!design.assets?.some(a=>a.name===resource.name))TDResources.storeImage(design,resource);op=TDAppearance.smoothPanel(op,resource.name);show();$('#pixelSave').click();}catch(error){$('#pixelError').textContent=error.message;}};
        if($('#cornerStyle'))$('#cornerStyle').onchange=e=>{
            if(e.target.value==='skin')return;
            const radius=root.querySelector('[data-pixel-key="radius"]');radius.value=e.target.value==='square'?0:Math.max(3,Number(radius.value)||6);
            if(op.asset){
                try{readFields(op);}catch(error){$('#pixelError').textContent=error.message;return;}
                rememberDrafts();removeSkin();show(true);
            }
            $('#pixelSave').click();
        };
        if(index>=0){
            $('#elementDuplicate').onclick=()=>{snapshot();const copy=TD.clone(o.paint[index]);if(copy.name)copy.name=unique(copy.op);o.paint.splice(index+1,0,copy);render();editPixel(index+1);};
            $('#elementDelete').onclick=()=>{snapshot();o.paint.splice(index,1);render();};
            const move=delta=>{snapshot();[o.paint[index],o.paint[index+delta]]=[o.paint[index+delta],o.paint[index]];render();editPixel(index+delta);};
            $('#elementBack').onclick=()=>move(-1);$('#elementForward').onclick=()=>move(1);
        }
        if(op.op==='slider')$('#controlBinding').onchange=e=>{
            const field=e.target.value;if(!field)return;
            const name=root.querySelector('[data-pixel-key="on_change"]');if(!name.value)name.value=unique('slider_changed');
            const isText=e.target.selectedOptions[0].dataset.text==='true';
            $('#controlBody').value=field+'.set('+(isText?'text=str(slider.values["value"])':'value=slider.values["value"]')+')';
            $('#pixelSave').click();
        };
        $('#pixelKind').onchange=e=>{const kind=e.target.value;op=kind==='big'?{op:'big',x:0,y:0,text:'123',scale:2,width:4,fg:231,bg:25}:kind==='put'?{op:'put',x:0,y:0,text:'Label',fg:231,bg:25}:kind==='fill'?{op:'fill',x:0,y:0,w:10,h:2,ch:' ',fg:231,bg:25}:{op:kind,...TD.clone(TDPixels.defaults[kind])};if(['slider','gauge'].includes(kind))op.radius=0;op.name=op.op==='button'?unique('pixel_button'):'';if(kind==='font_text'){const file=design.assets?.find(f=>/\.tdfont$/i.test(f.name));if(file)op.font={path:'/root/'+file.name};}show();};
        if(op.op==='button'){
            $('#smoothButton').onclick=()=>{try{readFields(op);rememberDrafts();snapshot('element:'+o.id+':'+index);const resource=TDAppearance.resourceFor(design.assets,TDBuiltinAssets['ui_skin.ppm'],'td_smooth_panel.ppm');if(!design.assets?.some(a=>a.name===resource.name))TDResources.storeImage(design,resource);op.asset={path:'/root/'+resource.name,w:256,h:128,key:[255,0,255],dither:false};op.src=[0,0,64,64];op.src_down=[64,0,64,64];op.border=16;show(true);$('#pixelSave').click();}catch(error){$('#pixelError').textContent=error.message;}};
            $('#buttonSkin').onchange=()=>{
                try{readFields(op);}catch(e){$('#pixelError').textContent=e.message;return;}
                rememberDrafts();
                if($('#buttonSkin').checked){
                    if(!(design.assets||[]).some(f=>f.name==='ui_skin.ppm'&&f.data)){
                        snapshot('element:'+o.id+':'+index);
                        TDResources.storeImage(design,TDBuiltinAssets['ui_skin.ppm']);
                    }
                    op.asset={path:'/root/ui_skin.ppm',w:256,h:128,key:[255,0,255],dither:false};op.src=[0,0,64,64];op.src_down=[64,0,64,64];op.border=16;
                }
                else removeSkin();
                show(true);
                $('#pixelSave').click();
            };
            for(const select of root.querySelectorAll('[data-event-recipe]'))select.onchange=()=>{
                const event=select.dataset.eventRecipe,kind=select.value,{win}=current();
                const name=root.querySelector('[data-pixel-key="'+event+'"]');
                if(!name.value)name.value=unique((root.querySelector('[data-pixel-key="name"]').value||'button').slice(0,18)+'_'+event.slice(3));
                const page=win.pages.find(p=>p.id!==o.page)||win.pages[0];
                const body={custom:'pass',text:'button.text = '+JSON.stringify(event==='on_press'?'Pressed':'Ready'),
                    page:'show_page('+JSON.stringify(page.name)+', '+win.name+')',close:win.name+'.close()',
                    log:'print('+JSON.stringify(event)+')'}[kind];
                if(body!==undefined)root.querySelector('[data-event-body="'+event+'"]').value=body;
                $('#pixelSave').click();
            };
            for(const event of TDPixels.buttonEvents)root.querySelector('[data-pixel-key="'+event+'"]').onchange=e=>{
                const handler=design.handlers[e.target.value];
                if(handler)root.querySelector('[data-event-body="'+event+'"]').value=handler.body;
            };
        }
        for(const textarea of root.querySelectorAll('[data-event-body]'))textarea.onkeydown=e=>{
            if(e.key==='Tab'){e.preventDefault();const start=textarea.selectionStart;textarea.setRangeText('    ',start,textarea.selectionEnd,'end');}
        };
        $('#pixelSave').onclick=()=>{
            try{
                const next=TD.clone(op);
                readFields(next);
                const replacedSkin=!!op.asset&&next.radius!==op.radius;
                if(replacedSkin){delete next.asset;delete next.src;delete next.src_down;delete next.border;}
                const errors=[];
                if(next.op==='big'){
                    const size=TD.bigLayout(next.text,next.scale,next.width);
                    if(!Number.isInteger(next.scale)||next.scale<1||next.scale>4||!Number.isInteger(next.width)||next.width<0||next.width>64||next.x<0||next.y<0||next.x+size.w>o.w||next.y+size.h>o.h)errors.push('Big text must fit inside the canvas.');
                }else if(['put','fill'].includes(next.op)){
                    const w=next.op==='put'?Array.from(next.text).length:next.w,h=next.op==='put'?1:next.h;
                    if(next.x<0||next.y<0||w<1||h<1||next.x+w>o.w||next.y+h>o.h)errors.push('The element must fit inside its canvas.');
                }else TDPixels.validate(next,o,s=>errors.push(s));
                if(next.name&&!TD.identifier(next.name))errors.push('Use a Python identifier for the drawing name.');
                if(next.op==='button'&&!TD.identifier(next.name))errors.push('Use a Python identifier for the button name.');
                if(errors.length)throw Error(errors.join(' '));
                const handlers=Object.create(null);
                if(next.op==='slider'&&next.on_change){
                    if(!TD.identifier(next.on_change))throw Error('Use a Python handler name.');
                    handlers[next.on_change]={args:'slider',body:$('#controlBody').value||'pass'};
                }
                if(next.op==='button')for(const event of TDPixels.buttonEvents){
                    const name=next[event];if(!name)continue;
                    if(!TD.identifier(name))throw Error(event+': use a Python function name.');
                    const body=root.querySelector('[data-event-body="'+event+'"]').value;
                    if(!body.trim())throw Error(event+': enter a body or pass.');
                    if(handlers[name]&&handlers[name].body!==body)throw Error('Use different names for different handler bodies.');
                    handlers[name]={args:'button',body};
                }
                snapshot('element:'+o.id+':'+index);for(const [name,handler] of Object.entries(handlers))Object.defineProperty(design.handlers,name,{value:handler,enumerable:true,writable:true,configurable:true});
                if(index<0){index=o.paint.length;o.paint.push(next);drawingSelection={id:o.id,index};}else o.paint[index]=next;
                op=next;$('.object-name').textContent=next.name||next.op;$('#pixelError').textContent='';if($('#cornerStyle'))$('#cornerStyle').value=next.asset?'skin':next.radius>0?'round':'square';renderLayers();update();if(replacedSkin)show(true);
            }catch(e){$('#pixelError').textContent=e.message;}
        };
        for(const input of root.querySelectorAll('[data-pixel-key]'))input.addEventListener(input.dataset.pixelKey.startsWith('on_')||input.dataset.pixelKey==='name'?'change':'input',()=>$('#pixelSave').click());
        for(const textarea of root.querySelectorAll('[data-event-body],#controlBody'))textarea.addEventListener('change',()=>$('#pixelSave').click());
        root.onfocusout=()=>{historyGroup=null;};
        window.TDGradientInspector?.(root,op,gradient=>{try{readFields(op);if(gradient){if(op.op==='button'&&op.asset)removeSkin();op.gradient=gradient;}else delete op.gradient;show(keepAppearance);$('#pixelSave').click();}catch(e){$('#pixelError').textContent=e.message;}});
        window.TDRegisterInspector?.(root,op,(binding,refresh)=>{try{readFields(op);if(binding){op.binding=binding;if(!op.name)op.name=unique('field');}else delete op.binding;if(refresh)show(keepAppearance);$('#pixelSave').click();}catch(e){$('#pixelError').textContent=e.message;}});
        window.TDQrInspector?.(root,op,qr=>{try{readFields(op);snapshot();const made=TDQr.apply(op,qr);if(!design.assets?.some(a=>a.name===made.file.name))TDResources.storeImage(design,made.file);op=made.element;show(keepAppearance);$('#pixelSave').click();}catch(e){$('#pixelError').textContent=e.message;}});
        window.TDSurfaceInspector?.(root,op,style=>{try{readFields(op);snapshot();const surface=TDSurface.apply(op,style);if(!design.assets?.some(a=>a.name===surface.file.name))TDResources.storeImage(design,surface.file);op=surface.element;show(keepAppearance);$('#pixelSave').click();}catch(e){$('#pixelError').textContent=e.message;}});
    }
    function rememberDrafts(){for(const el of root.querySelectorAll('[data-event-body]'))drafts[el.dataset.eventBody]=el.value;}
    function removeSkin(){delete op.asset;delete op.src;delete op.src_down;delete op.border;delete op.surfaceStyle;}
    function readFields(target){
        for(const el of root.querySelectorAll('[data-pixel-key]')){
            const parts=el.dataset.pixelKey.split('.'),key=parts.pop(),obj=parts.length?target[parts[0]]:target,old=obj[key];
            obj[key]=typeof old==='boolean'?el.checked:typeof old==='number'?Number(el.value):Array.isArray(old)||old===null?JSON.parse(el.value):el.value;
        }
    }
    function input(key,label,v){
        const boolean=typeof v==='boolean',type=boolean?'checkbox':typeof v==='number'?'number':'text';
        const picker=['fg','bg','color','down','rim','track','edge','knob','rgb1','rgb2'].includes(key)?'<button type="button" data-element-color="'+key+'" aria-label="Choose '+esc(label)+' color" style="background:'+(Array.isArray(v)?'rgb('+v.join(',')+')':color(v>=0?v:0))+'">Palette</button>':'';
        return '<label class="field"><span>'+esc(label)+'</span><input data-pixel-key="'+esc(key)+'" type="'+type+'" '+
            (boolean?(v?'checked':''):'value="'+esc(typeof v==='object'?JSON.stringify(v):v)+'"')+'></label>'+picker;
    }
    show();
}
document.addEventListener('click',e=>{
    if(e.target.closest('#addPixel'))editPixel();
    const edit=e.target.closest('[data-edit-pixel]');if(edit)editPixel(Number(edit.dataset.editPixel));
    const remove=e.target.closest('[data-remove-pixel]');if(remove){snapshot();current().obj.paint.splice(Number(remove.dataset.removePixel),1);render();}
});
