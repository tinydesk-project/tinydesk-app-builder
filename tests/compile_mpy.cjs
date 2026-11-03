'use strict';
// CPython test driver invokes the same wrapper as the browser export button.
const fs=require('node:fs'),path=require('node:path'),{compileMpy}=require('../mpy.js');
(async()=>{
 const [input,output]=process.argv.slice(2);
 try{fs.writeFileSync(output,await compileMpy(fs.readFileSync(input,'utf8'),path.basename(input)));}
 catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
})();
