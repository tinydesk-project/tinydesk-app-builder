/* Generated fonts are portable assets; element properties stay in Inspector. */
'use strict';
const fontCache=new WeakMap();
window.TDFontCellSize=()=>design.screen.w===80&&design.screen.h===24?[10,20]:[8,16];
window.TDFontPreview=descriptor=>{
 const file=design.assets?.find(f=>f.name===descriptor?.path?.split('/').pop());if(!file?.data)return null;
 if(fontCache.has(file))return fontCache.get(file);
 try{const face=TDFonts.decode(Uint8Array.from(atob(file.data),c=>c.charCodeAt(0)));fontCache.set(file,face);return face;}catch(e){return null;}
};
function fontOptions(path=''){
 return '<option value="">Built-in terminal / pixel font</option>'+(design.assets||[]).filter(a=>/\.tdfont$/i.test(a.name)).map(a=>{const f=TDFontPreview({path:a.name});return '<option value="'+esc(a.name)+'" '+(path.split('/').pop()===a.name?'selected':'')+'>'+esc(a.name)+(f?' · '+f.size+' px / '+f.height+' px line':' · invalid')+'</option>';}).join('');
}
const fontsButton=document.createElement('button');fontsButton.id='fonts';fontsButton.textContent='Fonts';document.querySelector('#resources').after(fontsButton);fontsButton.onclick=()=>openFontEditor();
 let fontGeneration=0;
async function openFontEditor(file=null){
 const serial=++fontGeneration;let customFamily=null,generated=null,revision=0;
 openModal('Generate bitmap font','<p>Generate a reusable device font from a system family or your .ttf / .otf file. Only selected glyphs are stored in your project; the original desktop font is not needed at runtime.</p><label class="field"><span>System family</span><select id="fontFamily"><option>Arial</option><option>Verdana</option><option>Tahoma</option><option>Georgia</option><option>Courier New</option></select></label><label class="field"><span>Import font file</span><input id="fontSource" type="file" accept=".ttf,.otf"></label><p id="fontSourceName" class="hint"></p><label class="field"><span>Size in LCD pixels (8–96)</span><input id="fontSize" type="number" min="8" max="96" value="28"></label><label class="field"><span>Rendering</span><select id="fontDepth"><option value="4">Smooth · 4 bit coverage</option><option value="1">Crisp · 1 bit / lower memory</option></select></label><label class="field"><span>Characters to include (up to 512)</span><textarea id="fontCharacters"></textarea></label><p class="hint">Use the full alphabet and symbols your app will display, including dynamic values. Space and ? fallback are always included. These are character-based fonts; complex-script shaping is not supported.</p><label class="field"><span>Asset filename</span><input id="fontFilename" value="font_28.tdfont"></label><button id="fontGenerate">Generate preview</button><p id="fontInfo" role="status"></p><canvas id="fontPreview" width="640" height="110" style="max-width:100%;background:#111"></canvas><p id="fontError" role="alert"></p><div class="modal-actions"><button id="fontStore" class="primary" disabled>Add font to project</button></div>');
 const $=s=>document.querySelector(s);$('#fontCharacters').value=Array.from({length:95},(_,i)=>String.fromCharCode(32+i)).join('')+'°µ±';
 const invalidate=()=>{revision++;generated=null;$('#fontStore').disabled=true;$('#fontInfo').textContent='Settings changed. Generate preview to update the font.';};
 for(const id of ['fontFamily','fontSize','fontDepth','fontCharacters'])$('#'+id).oninput=invalidate;
 $('#fontSize').addEventListener('input',()=>{if(/^font_\d+\.tdfont$/.test($('#fontFilename').value))$('#fontFilename').value='font_'+$('#fontSize').value+'.tdfont';});
 $('#fontFamily').onchange=()=>{customFamily=null;$('#fontSourceName').textContent='Using system family.';invalidate();};
 const source=async f=>{try{if(f.size>10*1024*1024)throw Error('Choose a font file up to 10 MiB.');const name='TDImported'+serial;const face=await new FontFace(name,await f.arrayBuffer()).load();if(serial!==fontGeneration)return;document.fonts.add(face);customFamily=name;$('#fontSourceName').textContent='Imported: '+f.name;invalidate();}catch(e){$('#fontError').textContent=e.message;}};
 $('#fontSource').onchange=e=>{if(e.target.files[0])source(e.target.files[0]);};
 $('#fontGenerate').onclick=async()=>{try{
  $('#fontError').textContent='';const family=customFamily||JSON.stringify($('#fontFamily').value),size=Number($('#fontSize').value),bpp=Number($('#fontDepth').value),characters=$('#fontCharacters').value;
  const expected=revision,bytes=await TDFonts.generate({family,size,bpp,characters});if(serial!==fontGeneration||expected!==revision)return;generated=bytes;const f=TDFonts.decode(generated),ctx=$('#fontPreview').getContext('2d');ctx.clearRect(0,0,640,110);
  TDFonts.paint(ctx,f,'TinyDesk 123.4 °C\n'+characters.slice(0,36),8,8,624,94,'#fff','#111','left','top',true);
  $('#fontInfo').textContent=f.glyphs.size+' glyphs · '+f.size+' px size · '+f.height+' px line · '+generated.length+' bytes';$('#fontStore').disabled=false;
 }catch(e){generated=null;$('#fontStore').disabled=true;$('#fontError').textContent=e.message;}};
 $('#fontStore').onclick=()=>{try{if(!generated)throw Error('Generate the font first.');const name=$('#fontFilename').value.trim();if(!/^[A-Za-z0-9_.-]+\.tdfont$/i.test(name)||name.length>64)throw Error('Use a simple .tdfont filename up to 64 characters.');if(design.assets?.some(a=>a.name===name))throw Error('This filename exists. Choose another name to preserve elements using that font.');snapshot();TDResources.storeImage(design,{name,originalName:name,mime:'application/x-tinydesk-font',data:bytes64(generated),recipe:{family:customFamily?'Imported font':$('#fontFamily').value,size:Number($('#fontSize').value),bpp:Number($('#fontDepth').value),characters:$('#fontCharacters').value}});$('#modal').close();render();toast('Font added. Select a text element or button and choose its font in Inspector.');}catch(e){$('#fontError').textContent=e.message;}};
 if(file)await source(file);
}
function openTextImport(text='',sourceAsset=null){
 openModal('Import text','<p>Create editable text. Choose a generated font for a pixel size independent of the terminal font. Generate additional sizes with Fonts.</p><label class="field"><span>Font</span><select id="textFont">'+fontOptions()+'</select></label><label class="field"><span>Text</span><textarea id="textContent" rows="8"></textarea></label><label class="field"><span>Alignment</span><select id="textAlign"><option>left</option><option>center</option><option>right</option></select></label><label class="field"><span>Wrap in text box</span><input id="textWrap" type="checkbox" checked></label><p id="textError" role="alert"></p><div class="modal-actions"><button id="textCreate" class="primary">Add editable text</button></div>');
 document.querySelector('#textContent').value=text;
 document.querySelector('#textCreate').onclick=()=>{try{
  const text=document.querySelector('#textContent').value,font=document.querySelector('#textFont').value;
  if(new TextEncoder().encode(text).length>900||text.includes('\0'))throw Error('Use up to 900 UTF-8 bytes per text element; split longer documents into text boxes.');
  snapshot();const cv=assetCanvas();
  if(font){const [cw,ch]=TDFontCellSize(),wrap=document.querySelector('#textWrap').checked;cv.paint.push({...TD.clone(TDPixels.defaults.font_text),op:'font_text',name:unique('text'),w:cv.w,h:Math.min(cv.h,Math.max(3,Math.ceil(TDFonts.measure(TDFontPreview({path:font}),text,cv.w*cw,wrap).h/ch))),text,font:{path:'/root/'+font},align:document.querySelector('#textAlign').value,wrap,...(sourceAsset?{sourceAsset}: {})});}
  else text.split('\n').slice(0,cv.h).forEach((line,y)=>cv.paint.push({op:'put',x:0,y,text:Array.from(line).slice(0,cv.w).join(''),fg:231,bg:25,...(sourceAsset?{sourceAsset}: {})}));
  document.querySelector('#modal').close();drawingSelection={id:cv.id,index:cv.paint.length-1};render();
 }catch(e){document.querySelector('#textError').textContent=e.message;}};
}
const textButton=document.createElement('button');textButton.id='addText';textButton.textContent='Add text';fontsButton.after(textButton);textButton.onclick=()=>openTextImport('Your text');
draw();
