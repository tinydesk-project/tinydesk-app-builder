/* Local CLI uses the exact browser generator; no separate export implementation. */
const fs=require('node:fs'),TD=require('../core.js'),V=require('../version.js');
const [input,output,...flags]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node tools/export_project.cjs INPUT.json OUTPUT.py [--bundle]');
const design=V.stamp(TD.parse(fs.readFileSync(input,'utf8'))),result=TD.validate(design);
if(result.errors.length)throw Error(result.errors.join('\n'));
fs.writeFileSync(output,TD.generate(design,{bundle:flags.includes('--bundle')}));
