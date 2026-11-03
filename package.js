/* Recover a project without executing its packaged bytecode. */
'use strict';
const packageButton=document.createElement('button');packageButton.textContent='Export app';packageButton.id='exportApp';
document.querySelector('#downloadMpy').after(packageButton);
document.querySelector('#file').accept='.json,.py,.tdapp';
function bytes64(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
async function exportApp(){
  const token=document.querySelector('meta[name="studio-simulation-token"]')?.content;
  if(!token)throw Error('Start tools/studio_simulator.py and open its local URL to export compiled app packages.');
  TDVersion.stamp(design);const check=TD.validate(design);if(check.errors.length)throw Error(check.errors.join('\n'));
  const source=TD.generate(design,{bundle:true}),assets=Object.create(null),binaries=Object.create(null);
  for(const file of design.assets||[])assets[file.name]=file.data;
  for(const file of design.binaryDependencies||[])binaries[file.name]=file.data;
  const paths=[...TDResources.required(design).values()];
  const response=await fetch('/package/build',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':token},body:JSON.stringify({project:design,source,assets,paths,binaries})});
  const value=await response.json();if(!response.ok)throw Error(value.error);
  return {name:design.name.replace(/[^a-zA-Z0-9_-]/g,'_')+'.tdapp',content:Uint8Array.from(atob(value.binary),c=>c.charCodeAt(0)),deployment:value.deployment};
}
window.StudioDesign.exportApp=exportApp;
const installButton=document.createElement('button');installButton.id='deploymentGuide';installButton.textContent='Install / kiosk';packageButton.after(installButton);
installButton.onclick=async()=>{
 try{installButton.disabled=true;const app=await exportApp();openModal('Install '+app.name,'<p>Export and upload this revision first, then follow these steps. These settings apply after reboot.</p><pre id="deploymentCommands"></pre><p><a href="guide.html" target="_blank" rel="noopener">Full deployment and recovery guide</a></p>');document.querySelector('#deploymentCommands').textContent=app.deployment;}
 catch(e){toast(e.message);}finally{installButton.disabled=false;}
};
packageButton.onclick=async()=>{
 try{
  packageButton.disabled=true;const app=await exportApp();
  const blob=new Blob([app.content],{type:'application/octet-stream'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=app.name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  toast('App package exported with project, '+(design.compilation?.mode==='native'?'native code':'bytecode')+' and assets.');
 }catch(e){toast(e.message);}finally{packageButton.disabled=false;}
};
document.querySelector('#file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file||!file.name.toLowerCase().endsWith('.tdapp'))return;
 e.stopImmediatePropagation();
 try{
  if(file.size>16*1024*1024)throw Error('Package exceeds 16 MiB.');
  const data=new Uint8Array(await file.arrayBuffer()),view=new DataView(data.buffer),decode=new TextDecoder();
  if(data.length<16||decode.decode(data.slice(-16,-8))!=='TDAPP001')throw Error('Invalid app package.');
  const start=view.getUint32(data.length-8,true),size=view.getUint32(data.length-4,true);
  if(size>262144||start+size!==data.length-16)throw Error('Invalid package manifest.');
  const manifest=JSON.parse(decode.decode(data.slice(start,start+size)));
  if(manifest.format!==1||!Array.isArray(manifest.files)||manifest.files.length>128)throw Error('Unsupported package version.');
  let project;const names=new Set(),resources=[],dependencies=[];
  for(const item of manifest.files){
   if(typeof item.path!=='string'||/[\\/:\0]/.test(item.path)||['.','..'].includes(item.path)||names.has(item.path)||!Number.isSafeInteger(item.offset)||!Number.isSafeInteger(item.size)||item.offset<0||item.size<0||item.offset+item.size>start)throw Error('Invalid package entry.');names.add(item.path);
   const payload=data.slice(item.offset,item.offset+item.size),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',payload)),b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==item.sha256)throw Error('Package checksum mismatch.');
   if(item.path==='project.json')project=TD.parse(decode.decode(payload));
   else if(/\.(ppm|pgm|bmp|tdfont|txt)$/i.test(item.path))resources.push({name:item.path,data:bytes64(payload)});
   else if(item.path.endsWith('.mpy')&&item.path!=='_tdapp_main.mpy')dependencies.push({name:item.path,data:bytes64(payload)});
  }
  if(!project)throw Error('Package has no editable project.');
  const metadata=new Map((project.assets||[]).map(a=>[a.name,a]));
  project.assets=[...(project.assets||[]).filter(a=>!resources.some(b=>a.name===b.name)),...resources.map(a=>({...metadata.get(a.name),...a}))];
  project.binaryDependencies=dependencies;
  snapshot();design=project;selected=design.windows[0].id;pageViews.clear();render();toast('Recovered editable project from app package.');
 }catch(error){toast(error.message);}finally{e.target.value='';}
},true);
