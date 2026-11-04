/* Deterministic native-resolution surfaces: editable colors, not fixed artwork. */
(function(root){
'use strict';
const defaults={fill:'gradient',color:'#287de0',end:'#083b86',direction:'vertical',corners:'round',radius:12,border:1,borderColor:'#398edb'};
const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
function normalize(style={}){const s={...defaults,...style};if(!['solid','gradient'].includes(s.fill)||!['round','straight'].includes(s.corners)||!['vertical','horizontal'].includes(s.direction)||!Number.isInteger(s.radius)||s.radius<0||s.radius>30||!Number.isInteger(s.border)||s.border<0||s.border>4||![s.color,s.end,s.borderColor].every(v=>/^#[0-9a-f]{6}$/i.test(v)))throw Error('Choose valid surface colors, border and radius.');return s;}
function resource(style){
 const s=normalize(style),header='P6\n128 64\n255\n',bytes=new Uint8Array(header.length+128*64*3);bytes.set([...header].map(c=>c.charCodeAt(0)));const a=rgb(s.color),b=rgb(s.fill==='gradient'?s.end:s.color),edge=rgb(s.borderColor),radius=s.corners==='round'?s.radius:0;
 const inside=(x,y,inset)=>{const r=Math.max(0,radius-inset),lo=inset,hi=63-inset;if(x<lo||y<lo||x>hi||y>hi)return false;const cx=Math.max(lo+r,Math.min(hi-r,x)),cy=Math.max(lo+r,Math.min(hi-r,y));return (x-cx)**2+(y-cy)**2<=r*r;};
 const outside=[],used=new Set();
 for(let y=0;y<64;y++)for(let x=0;x<128;x++){const xx=x%64,down=x>=64,t=(s.direction==='horizontal'?xx:y)/63,at=header.length+(y*128+x)*3;if(!inside(xx,y,0)){outside.push(at);continue;}const c=s.border&&!inside(xx,y,s.border)?edge:a.map((v,i)=>Math.round((v+(b[i]-v)*t)*(down?.72:1)));used.add(c[0]*65536+c[1]*256+c[2]);bytes.set(c,at);}
 let blue=255;while(used.has(255*65536+blue))blue--;const key=[255,0,blue];for(const at of outside)bytes.set(key,at);
 let hash=2166136261;for(const v of bytes)hash=Math.imul(hash^v,16777619)>>>0;
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const name='surface_'+hash.toString(16)+'.ppm';return {name,originalName:name,mime:'image/x-portable-pixmap',w:128,h:64,key,data:typeof btoa==='function'?btoa(text):Buffer.from(bytes).toString('base64')};
}
function apply(p,style){
 const s=normalize(style),file=resource(s),cells=['picture','button'].includes(p.op),x=cells?p.x:Math.floor(p.x/2),y=cells?p.y:Math.floor(p.y/2);
 const q=p.op==='button'?{...p}:{op:'picture',name:p.name||'',x,y,w:cells?p.w:Math.ceil((p.x+p.w)/2)-x,h:cells?p.h:Math.ceil((p.y+p.h)/2)-y,text:p.text||'',fg:p.fg??231,scale:p.scale??0,...(p.binding?{binding:p.binding}:{}),...(p.font?{font:p.font}:{})};
 q.surfaceStyle=s;q.asset={path:'/root/'+file.name,w:128,h:64,key:file.key,dither:false};q.src=[0,0,64,64];q.border=16;
 if(p.op==='button'){q.src_down=[64,0,64,64];delete q.gradient;}else if(p.op==='rect'||p.edgeSlices)q.edgeSlices=true;
 return {element:q,file};
}
const api={defaults,normalize,resource,apply};if(typeof module!=='undefined')module.exports=api;else root.TDSurface=api;
})(typeof window!=='undefined'?window:globalThis);
