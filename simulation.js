/* Real runtime output: no Python event logic is reimplemented in JavaScript. */
(function(){
 'use strict';
 const button=document.createElement('button');button.textContent='▶ Run simulation';button.id='runSimulation';
 document.querySelector('#download').before(button);
 const dialog=document.createElement('dialog');dialog.id='simulationDialog';
 dialog.innerHTML='<div class="modal-heading"><h2>Running app · TinyDesk / MicroPython</h2><button id="stopSimulation">Stop and edit</button></div><p id="simulationStatus" role="status"></p><div id="simulationTerminal"></div>';
 document.body.append(dialog);
 let terminal,cellCanvas,active=false,busy=false,timer,pending='',session=null,generation=0;
 const token=document.querySelector('meta[name="studio-simulation-token"]')?.content;
 const protocol=document.querySelector('meta[name="studio-simulation-protocol"]')?.content;
 const status=text=>dialog.querySelector('#simulationStatus').textContent=text;
 async function alignCellPixels(host,cols,rows,target,run){
  // Native image sizes and mouse coordinates use these exact cell pixels.
  // A platform's default monospace font can otherwise make Sixel images
  // occupy extra cells, erasing neighboring ordinary canvas content.
  const cw=cols===80&&rows===24?10:8,ch=cw*2;
  await document.fonts.ready;
  for(let pass=0;pass<2;pass++){
   await new Promise(resolve=>requestAnimationFrame(resolve));
   if(run!==generation||terminal!==target)return;
   const rect=host.querySelector('.xterm-screen').getBoundingClientRect();
   if(rect.width&&Math.abs(rect.width/cols-cw)>.005)target.options.fontSize*=cw/(rect.width/cols);
   if(rect.height&&Math.abs(rect.height/rows-ch)>.005)target.options.lineHeight*=(ch+.01)/(rect.height/rows);
  }
 }
 async function request(route,body={},id=session){
  const run=generation,target=terminal;
  const r=await fetch('/simulation/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':token},body:JSON.stringify({...body,session:id}),signal:AbortSignal.timeout(20000)});
  const value=await r.json();if(!r.ok)throw Error(value.error||'Simulation helper failed.');
  if(run===generation&&value.session)session=value.session;
  if(run===generation&&value.output&&terminal===target&&target){const raw=atob(value.output);await new Promise(resolve=>target.write(Uint8Array.from(raw,c=>c.charCodeAt(0)),resolve));}
  if(run===generation&&value.frame&&terminal===target&&target){
   // The image addon renders on xterm's next animation frame. Compose its
   // pixels and native cells into one surface, outside xterm's DOM stacking.
   await new Promise(resolve=>requestAnimationFrame(resolve));
   if(run!==generation||terminal!==target)return value;
   const frame=TDSimulationFrame.decode(Uint8Array.from(atob(value.frame),c=>c.charCodeAt(0))),host=dialog.querySelector('#simulationTerminal');
   if(!cellCanvas){cellCanvas=document.createElement('canvas');cellCanvas.className='simulation-cell-layer';cellCanvas.setAttribute('aria-hidden','true');host.append(cellCanvas);}
   const cw=frame.cols===80&&frame.rows===24?10:8,ch=cw===10?20:16;
   if(cellCanvas.width!==frame.cols*cw||cellCanvas.height!==frame.rows*ch){cellCanvas.width=frame.cols*cw;cellCanvas.height=frame.rows*ch;}
   const context=cellCanvas.getContext('2d'),rect=host.querySelector('.xterm-screen').getBoundingClientRect(),images=host.querySelector('.xterm-image-layer');
   TDSimulationFrame.paint(context,frame,cw,ch,color);
   if(images)context.drawImage(images,0,0,cellCanvas.width,cellCanvas.height);
   cellCanvas.style.width=rect.width+'px';cellCanvas.style.height=rect.height+'px';host.classList.add('native-frame');
  }
  return value;
 }
 async function stop(){const id=session;generation++;active=false;session=null;clearTimeout(timer);terminal?.dispose();terminal=null;cellCanvas=null;dialog.close();if(token&&id)await request('stop',{},id).catch(()=>{});}
 async function poll(){
  if(!active)return;
  const run=generation;
  if(!busy){busy=true;try{const data=pending;pending='';await request(data?'input':'poll',data?{data}:{});}catch(e){if(run===generation){status(e.message);active=false;}}finally{if(run===generation)busy=false;}}
  if(active&&run===generation)timer=setTimeout(poll,150);
 }
 button.onclick=async()=>{
  const run=++generation;
  dialog.showModal();
  if(!token){status('Start python tools/studio_simulator.py and open http://127.0.0.1:8773/ to run the real app. Save JSON here first, then import it there.');return;}
  if(protocol!=='3'){status('Reload App Builder and restart python tools/studio_simulator.py to use native simulation frames. Your saved design is kept.');return;}
  const validation=TD.validate(design);if(validation.errors.length){status(validation.errors.join(' '));return;}
  status('Starting the generated Python. Mouse, keyboard, pages and timers run in TinyDesk. Hardware UART and machine timing need board testing.');
  const host=dialog.querySelector('#simulationTerminal');host.replaceChildren();host.classList.remove('native-frame');cellCanvas=null;
  terminal=new Terminal({cols:design.screen.w,rows:design.screen.h,fontFamily:'"Courier New",monospace',fontSize:(design.screen.w===80&&design.screen.h===24?10:8)/.6,lineHeight:1,scrollback:0,allowProposedApi:true,theme:{background:'#000000'}});
  terminal.loadAddon(new ImageAddon.ImageAddon({sixelSupport:true}));terminal.open(host);
  pending='';terminal.onData(data=>{if(active)pending+=data;});
  busy=true;
  try{
   await alignCellPixels(host,design.screen.w,design.screen.h,terminal,run);if(run!==generation)return;
   const paths=[...TDResources.required(design).values()];
   const result=await request('start',{protocol:3,source:TD.generate(design,{bundle:true,embedDesign:false}),cols:design.screen.w,rows:design.screen.h,paths,modules:design.modules||[],assets:design.assets||[],binaries:design.binaryDependencies||[]});if(run!==generation){if(result.session)request('stop',{},result.session).catch(()=>{});return;}active=true;status('Running exported app. Use the mouse and keyboard; Stop and edit returns to your design.');terminal.focus();poll();}
  catch(e){if(run===generation){status(e.message);active=false;}}finally{if(run===generation)busy=false;}
 };
 dialog.querySelector('#stopSimulation').onclick=stop;
 dialog.oncancel=e=>{e.preventDefault();stop();};
 window.addEventListener('pagehide',()=>{if(active)fetch('/simulation/stop',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':token},body:JSON.stringify({session}),keepalive:true});});
})();
