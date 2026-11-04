/* Lazy, offline mpy-cross adapter. Browser runtime has no Node dependency. */
(function(root){
    'use strict';
    let factoryPromise;
    const missing='Offline .mpy compiler is not built. Run tools/build_mpy_cross_wasm.sh to create vendor/mpy-cross.js. Save JSON to keep an editable design.';
    function loadFactory(){
        if(factoryPromise)return factoryPromise;
        factoryPromise=(async()=>{
            if(typeof module==='object'&&module.exports){
                // Tests run the web-only bundle in a small browser-like VM.
                const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
                const file=path.join(__dirname,'vendor','mpy-cross.js');
                if(!fs.existsSync(file))throw Error(missing);
                const scope={WebAssembly,Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array,ArrayBuffer,DataView,TextDecoder,TextEncoder,URL,console,setTimeout,clearTimeout,performance,
                    atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),
                    document:{currentScript:{src:'file://'+file}},location:{href:'file://'+file}};
                scope.window=scope;scope.self=scope;
                vm.runInNewContext(fs.readFileSync(file,'utf8'),scope,{filename:file});
                if(typeof scope.createMpyCross!=='function')throw Error('Invalid offline compiler bundle. Rebuild vendor/mpy-cross.js.');
                return scope.createMpyCross;
            }
            if(typeof root.createMpyCross==='function')return root.createMpyCross;
            await new Promise((resolve,reject)=>{
                const script=document.createElement('script');script.src=new URL('vendor/mpy-cross.js',document.baseURI).href;
                script.onload=resolve;script.onerror=()=>{script.remove();reject(Error(missing));};document.head.append(script);
            });
            if(typeof root.createMpyCross!=='function')throw Error('Invalid offline compiler bundle. Rebuild vendor/mpy-cross.js.');
            return root.createMpyCross;
        })().catch(error=>{factoryPromise=null;throw error;});
        return factoryPromise;
    }
    async function compileMpy(source,filename='app.py',compilation={mode:'bytecode'}){
        if(typeof source!=='string')throw Error('Compiler source must be a string.');
        if(!/^[A-Za-z0-9_.-]+\.py$/.test(filename))throw Error('Use a simple .py source filename.');
        const token=typeof document==='object'?document.querySelector('meta[name="builder-token"]')?.content:null;
        if(token){
            const response=await fetch('/compiler/compile',{method:'POST',headers:{'Content-Type':'application/json','X-Builder-Token':token},body:JSON.stringify({source,filename,compilation})});
            const result=await response.json();if(!response.ok)throw Error(result.error||'Compilation failed.');
            return Uint8Array.from(atob(result.binary),c=>c.charCodeAt(0));
        }
        if(compilation?.mode==='native')throw Error('Native export requires the local helper and its matching mpy-cross compiler.');
        const factory=await loadFactory(),diagnostics=[];
        const compiler=await factory({noInitialRun:true,print:s=>diagnostics.push(String(s)),printErr:s=>diagnostics.push(String(s))});
        const output=filename.slice(0,-3)+'.mpy';
        compiler.FS.writeFile('/'+filename,new TextEncoder().encode(source));
        let code=0;
        try{code=compiler.callMain(['-o',output,filename])||0;}
        catch(error){if(typeof error.status==='number')code=error.status;else{diagnostics.push(error.message||String(error));code=1;}}
        if(code!==0){
            const message=diagnostics.join('\n').trim()||'MicroPython compilation failed.';
            const error=Error(message),line=message.match(/line\s+(\d+)/i);if(line)error.lineNumber=Number(line[1]);throw error;
        }
        let bytes;
        try{bytes=new Uint8Array(compiler.FS.readFile('/'+output,{encoding:'binary'}));}
        catch(error){throw Error(diagnostics.join('\n')||'The compiler produced no .mpy file.');}
        if(bytes.length<4||bytes[0]!==77||bytes[1]!==6||bytes[2]!==0)throw Error('Compiler output is not version-6 bytecode without native emitters.');
        return bytes;
    }
    if(typeof module==='object'&&module.exports)module.exports={compileMpy};else root.compileMpy=compileMpy;
})(typeof window==='undefined'?globalThis:window);
