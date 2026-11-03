/* Optional board integration; no network request is made until Connect. */
(function(){
    'use strict';
    const $=s=>document.querySelector(s),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const dialog=document.createElement('dialog');dialog.id='boardDialog';
    dialog.innerHTML='<div class="modal-heading"><h2>Board files</h2><button id="closeBoard" aria-label="Close Board files">×</button></div>'+ 
        '<p class="board-help">Start <code>python tools/studio_bridge.py</code>, paste its token below, and run <code>ftp start</code> as root on the board. The helper listens on 127.0.0.1 only; idle FTP sessions close after 30 seconds. Use <code>--port 9000</code> for another helper port.</p>'+
        '<div class="bridge-form"><label class="field">Helper port<input id="bridgePort" type="number" value="8765" min="1" max="65535"></label><label class="field">Builder token<input id="bridgeToken" type="password" autocomplete="off" spellcheck="false"></label></div>'+
        '<div class="board-form"><label class="field">Board host<input id="ftpHost" placeholder="192.168.1.50" autocomplete="off"></label><label class="field">FTP port<input id="ftpPort" type="number" value="21" min="1" max="65535"></label><label class="field">User<input id="ftpUser" value="root" autocomplete="off"></label><label class="field">Password<input id="ftpPassword" type="password" autocomplete="off"></label></div>'+
        '<p class="board-warning">FTP sends the password unencrypted. Use it only on a network you trust.</p>'+
        '<div class="board-toolbar"><button id="ftpConnect" class="primary">Connect</button><button id="ftpDisconnect" disabled>Disconnect</button><span id="boardStatus" class="board-status" role="status">The helper is optional. The rest of App Builder works without it.</span></div>'+
        '<div id="boardBrowser" hidden><div id="boardPath" class="board-path" aria-label="Board folder path"></div><div class="board-toolbar"><button id="boardUp">↑ Up</button><button id="boardRefresh">Refresh</button><button id="boardMkdir">New folder</button><button id="boardUpload">Upload files</button><label>Design format <select id="boardDesignFormat" aria-label="Design upload format"><option value="py">.py</option><option value="mpy">.mpy</option><option value="tdapp">.tdapp (all resources)</option></select></label><button id="boardUploadDesign" class="primary">Upload the current design</button></div><div id="boardList" class="board-list" aria-label="Board files; drop files here to upload"></div><div id="boardRun" class="board-run" hidden></div></div>'+
        '<input id="boardFileInput" type="file" multiple hidden><div id="boardTransfers" class="board-transfers" aria-label="Transfer queue" aria-live="polite"></div>';
    document.body.append(dialog);
    const askDialog=document.createElement('dialog');askDialog.id='boardAsk';document.body.append(askDialog);
    let connected=false,cwd='/',entries=[],transport=null,tail=Promise.resolve(),busy=0;
    function status(message,error=false){$('#boardStatus').textContent=message;$('#boardStatus').classList.toggle('error',error);}
    function controls(){
        $('#boardBrowser').hidden=!connected;dialog.classList.toggle('board-connected',connected);
        $('#ftpConnect').disabled=connected||busy>0;$('#ftpDisconnect').disabled=!connected||busy>0;
        for(const id of ['bridgePort','bridgeToken','ftpHost','ftpPort','ftpUser','ftpPassword'])$('#'+id).disabled=connected||busy>0;
        for(const id of ['boardUp','boardRefresh','boardMkdir','boardUpload','boardUploadDesign','boardDesignFormat'])$('#'+id).disabled=!connected||busy>0;
        document.querySelectorAll('#boardList button,#boardPath button').forEach(b=>b.disabled=busy>0);
    }
    function ask(title,message,value){return new Promise(resolve=>{
        askDialog.innerHTML='<div class="modal-heading"><h2>'+escape(title)+'</h2></div><p class="board-status">'+escape(message)+'</p>'+(value===undefined?'':'<label class="field">Name<input id="boardAskValue" value="'+escape(value)+'"></label>')+'<div class="modal-actions"><button id="boardAskCancel">Cancel</button><button id="boardAskOK" class="primary">Continue</button></div>';
        let settled=false;const finish=v=>{if(settled)return;settled=true;askDialog.close();resolve(v);};
        $('#boardAskCancel').onclick=()=>finish(null);$('#boardAskOK').onclick=()=>finish(value===undefined?true:$('#boardAskValue').value);
        askDialog.oncancel=e=>{e.preventDefault();finish(null);};askDialog.showModal();
    });}
    function basename(value){if(!value||value==='.'||value==='..'||/[\/\r\n\0]/.test(value))throw Error('Use one file or folder name without slashes or control characters.');return value;}
    function fullPath(name,path=cwd){return TD.normalizeBoardPath(path+'/'+basename(name));}
    async function request(route,method='GET',data){
        if(!transport)throw Error('Enter the helper token and connect first.');
        let response;
        try{response=await fetch(transport.base+route,{method,headers:{'X-Studio-Token':transport.token,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',credentials:'omit'});}
        catch(e){throw Error('Cannot reach the helper. Run python tools/studio_bridge.py, check the helper port and token, then connect again.');}
        if(!response.ok){let text;try{text=(await response.json()).error;}catch(e){text='Helper returned HTTP '+response.status;}if(response.status===502||/Not connected|connection closed/i.test(text)){connected=false;controls();}throw Error(text);}
        return response;
    }
    async function list(path){const value=await(await request('/list?path='+encodeURIComponent(path))).json();if(!Array.isArray(value)||value.some(e=>typeof e.name!=='string'||typeof e.dir!=='boolean'||!Number.isFinite(e.size)))throw Error('Invalid folder listing from helper.');return value.filter(e=>!['.','..'].includes(e.name));}
    function renderList(){
        $('#boardPath').innerHTML=TD.pathParts(cwd).map(p=>'<button data-folder="'+escape(p.path)+'" '+(p.path==='/'?'aria-label="Filesystem root"':'')+'>'+escape(p.path==='/'?'⌂':p.name)+'</button>').join('<span>/</span>');
        $('#boardList').innerHTML=entries.length?entries.map((entry,i)=>'<div class="board-row"><button class="file-name" data-open="'+i+'" title="'+escape(entry.name)+'">'+(entry.dir?'📁 ':'▧ ')+escape(entry.name)+'</button><span class="file-size">'+(entry.dir?'Folder':entry.size.toLocaleString()+' B')+'</span><div class="file-actions">'+(entry.dir?'':'<button data-download="'+i+'" aria-label="Download '+escape(entry.name)+'">Download</button>')+'<button data-rename="'+i+'" aria-label="Rename '+escape(entry.name)+'">Rename</button><button data-delete="'+i+'" class="danger" aria-label="Delete '+escape(entry.name)+'">Delete</button></div></div>').join(''):'<div class="board-empty">This folder is empty. Drop files here to upload.</div>';
    }
    async function openFolder(path){const next=TD.normalizeBoardPath(path),result=await list(next);cwd=next;entries=result.sort((a,b)=>Number(b.dir)-Number(a.dir)||a.name.localeCompare(b.name));$('#boardRun').hidden=true;renderList();status('Connected · '+cwd+' · idle disconnect after 30 seconds.');}
    async function action(fn){busy++;controls();try{await fn();}catch(e){status(e.message,true);}finally{busy--;controls();}}
    $('#boardFiles').onclick=()=>dialog.showModal();$('#closeBoard').onclick=()=>dialog.close();
    $('#ftpConnect').onclick=()=>action(async()=>{
        const port=Number($('#bridgePort').value),ftpPort=Number($('#ftpPort').value),token=$('#bridgeToken').value.trim();
        if(!Number.isInteger(port)||port<1||port>65535||!Number.isInteger(ftpPort)||ftpPort<1||ftpPort>65535||!token)throw Error('Enter valid ports and the token printed by the helper.');
        transport={base:'http://127.0.0.1:'+port,token};
        const password=$('#ftpPassword').value;$('#ftpPassword').value='';status('Connecting…');
        const result=await(await request('/connect','POST',{host:$('#ftpHost').value,port:ftpPort,user:$('#ftpUser').value,password})).json();
        connected=true;await openFolder(result.cwd);
    });
    $('#ftpDisconnect').onclick=()=>action(async()=>{try{await request('/disconnect','POST',{});}finally{connected=false;transport=null;status('Disconnected.');}});
    $('#boardRefresh').onclick=()=>action(()=>openFolder(cwd));$('#boardUp').onclick=()=>action(()=>openFolder(TD.pathParts(cwd).at(-2)?.path||'/'));
    $('#boardPath').onclick=e=>{const b=e.target.closest('[data-folder]');if(b&&!busy)action(()=>openFolder(b.dataset.folder));};
    $('#boardMkdir').onclick=()=>action(async()=>{const name=await ask('New folder','Create a folder in '+cwd,'');if(name===null)return;await request('/mkdir','POST',{from:fullPath(name)});await openFolder(cwd);});
    $('#boardList').onclick=e=>{
        if(busy)return;const b=e.target.closest('button');if(!b)return;
        const attribute=['open','download','rename','delete'].find(k=>b.dataset[k]!==undefined);if(!attribute)return;
        const entry=entries[Number(b.dataset[attribute])],path=fullPath(entry.name);
        action(async()=>{
            if(attribute==='open'&&entry.dir)return openFolder(path);
            if(attribute==='download'||attribute==='open'){
                const blob=await(await request('/download?path='+encodeURIComponent(path))).blob();
                const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=entry.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Downloaded '+entry.name);return;
            }
            if(attribute==='rename'){
                const name=await ask('Rename '+entry.name,'Choose a new name in '+cwd,entry.name);if(name===null||name===entry.name)return;
                basename(name);if(entries.some(e=>e.name===name))throw Error('That name already exists. Choose a different name.');
                await request('/rename','POST',{from:path,to:fullPath(name)});
            }else{
                if(!await ask('Delete '+(entry.dir?'folder':'file'),'Delete "'+entry.name+'" from '+cwd+'?'+(entry.dir?' Only empty folders can be removed.':'')))return;
                await request(entry.dir?'/rmdir':'/delete','POST',{from:path});
            }
            await openFolder(cwd);
        });
    };
    function upload(path,blob,onProgress){return new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest();xhr.open('PUT',transport.base+'/upload?path='+encodeURIComponent(path));xhr.setRequestHeader('X-Studio-Token',transport.token);xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.timeout=120000;
        xhr.upload.onprogress=e=>onProgress(e.lengthComputable?e.loaded/e.total*100:0,'Sending to helper…');
        xhr.upload.onload=()=>onProgress(100,'Transferring to board and verifying SIZE…');
        xhr.onerror=()=>{connected=false;controls();reject(Error('The helper could not be reached. Start it and check the token.'));};
        xhr.ontimeout=()=>{connected=false;controls();reject(Error('Upload timed out. Reconnect before retrying.'));};
        xhr.onload=()=>{let value;try{value=JSON.parse(xhr.responseText);}catch(e){return reject(Error('Invalid upload response.'));}if(xhr.status<200||xhr.status>=300){if(xhr.status===502){connected=false;controls();}return reject(Error(value.error||'Upload failed.'));}if(value.size!==blob.size)return reject(Error('The verified size does not match the file.'));resolve(value);};
        xhr.send(blob);
    });}
    function enqueue(files,designUpload=false){
        const folder=cwd;
        for(const file of files){
            const row=document.createElement('div');row.className='transfer-entry';
            row.innerHTML='<span>'+escape(file.name)+'</span><span class="transfer-state">Queued</span><progress max="100" value="0"></progress><small></small>';$('#boardTransfers').append(row);
            tail=tail.then(()=>action(async()=>{
                if(!connected)throw Error('Connect to the board before uploading.');
                const name=basename(file.name),path=fullPath(name,folder),existing=(await list(folder)).find(e=>e.name===name);
                if(existing?.dir)throw Error('A folder named '+name+' already exists.');
                if(existing&&!await ask('Replace '+name,'Replace the existing file "'+name+'" in '+folder+'?')){row.querySelector('.transfer-state').textContent='Skipped';return;}
                await upload(path,file,(value,message)=>{row.querySelector('progress').value=value;row.querySelector('.transfer-state').textContent=Math.round(value)+'%';row.querySelector('small').textContent=message;});
                row.querySelector('.transfer-state').textContent='OK';row.querySelector('small').textContent='Verified '+file.size+' bytes on the board.';
                await openFolder(folder);
                if(designUpload){$('#boardRun').textContent='Run in TinyDesk: py '+(/\s/.test(path)?JSON.stringify(path):path);$('#boardRun').hidden=false;}
            }).then(()=>{if(row.querySelector('.transfer-state').textContent!=='OK'&&row.querySelector('.transfer-state').textContent!=='Skipped'){row.querySelector('.transfer-state').textContent='Error';row.querySelector('small').textContent=$('#boardStatus').textContent;row.classList.add('error');}}));
        }
    }
    $('#boardUpload').onclick=()=>$('#boardFileInput').click();$('#boardFileInput').onchange=e=>{enqueue([...e.target.files]);e.target.value='';};
    $('#boardUploadDesign').onclick=()=>action(async()=>{const format=$('#boardDesignFormat').value,mpy=format!=='py';status(mpy?'Building app…':'Preparing Python…');const exported=format==='tdapp'?await window.StudioDesign.exportApp():mpy?await window.StudioDesign.exportMpy():window.StudioDesign.exportCurrent();const file=new File([exported.content],exported.name,{type:mpy?'application/octet-stream':'text/x-python'});enqueue([file],true);});
    $('#boardList').ondragover=e=>{e.preventDefault();if(connected&&!busy)$('#boardList').classList.add('drag-over');};$('#boardList').ondragleave=()=>$('#boardList').classList.remove('drag-over');
    $('#boardList').ondrop=e=>{e.preventDefault();$('#boardList').classList.remove('drag-over');if(connected)enqueue([...e.dataTransfer.files]);};
})();
