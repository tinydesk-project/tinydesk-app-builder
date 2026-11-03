/* Project-level startup configuration stays in the fixed property pane. */
'use strict';
const startupButton=document.createElement('button');startupButton.id='startupSettings';startupButton.textContent='Startup screen';
document.querySelector('#exportOptions').before(startupButton);
startupButton.onclick=()=>{
 const w=design.windows[0],s={mode:'status',page:w.initialPage,durationMs:2000,image:'',...design.startup};
 document.querySelector('.inspector-tabs').hidden=true;
 document.querySelector('#typeTag').textContent='STARTUP';
 const pane=document.querySelector('#inspector');
 pane.scrollTop=0;pane.parentElement.scrollTop=0;document.querySelector('#rightPanel').scrollTop=0;
 pane.innerHTML='<h2>Startup screen</h2><p class="hint">The standard status screen is the default. A custom page can show your logo before opening the main page.</p><label class="field">Entry screen<select id="startupMode"><option value="status">Standard status screen</option><option value="custom">Custom page</option></select></label><label class="field">Custom entry page<select id="startupPage"></select></label><label class="field">Show for (ms)<input id="startupDuration" type="number" min="0" max="600000"></label><p class="hint">0 keeps the custom page open. A positive delay opens the window’s normal startup page afterward.</p><label class="field">Artwork during kiosk loading<select id="startupImage"><option value="">None</option></select></label><p class="hint">Import an image first. Place it on the custom page too. Export app → Deployment guide gives commands for showing it before Python starts.</p><button id="editEntryPage">Edit entry page</button><button id="startupGuide">Deployment guide</button>';
 const pages=pane.querySelector('#startupPage'),images=pane.querySelector('#startupImage');
 for(const p of w.pages)pages.add(new Option(p.name,p.id));
 for(const a of design.assets||[])if(/\.(ppm|pgm|bmp)$/i.test(a.name))images.add(new Option(a.originalName||a.name,a.name));
 pane.querySelector('#startupMode').value=s.mode;pages.value=s.page;images.value=s.image;pane.querySelector('#startupDuration').value=s.durationMs;
 pane.onchange=e=>{
  if(!e.target.id.startsWith('startup'))return;
  snapshot();design.startup={mode:pane.querySelector('#startupMode').value,page:pages.value,durationMs:Number(pane.querySelector('#startupDuration').value),image:images.value};update();
 };
 pane.querySelector('#editEntryPage').onclick=()=>{pageViews.set(w.id,pages.value);selected=w.id;render();};
 pane.querySelector('#startupGuide').onclick=()=>window.open('guide.html','_blank','noopener');
};
// Help always links to the complete local guide, including recovery steps.
document.querySelector('#help').onclick=()=>window.open('guide.html','_blank','noopener');
