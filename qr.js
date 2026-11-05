/* QR codes as small generated pictures: byte mode, level L, versions 1 to 5
 * (up to 106 bytes, enough for an address or a Wi-Fi link).
 *
 * The code is stored at one pixel per module (with its quiet zone) as a PPM
 * of a few kilobytes; the picture element loads it scaled by a whole number
 * to its cell box, so every module stays sharp and a device decodes almost
 * nothing. apply() makes a picture element from a QR text; matrix() is the
 * encoder (the same algorithm as the original Melter HMI's).
 */
(function(root){
'use strict';
const VERSIONS={1:[26,7,0],2:[44,10,18],3:[70,15,22],4:[100,20,26],5:[134,26,30]};   // total, EC codewords, alignment (level L, one block)
const defaults={text:'http://192.168.4.1',fg:'#101418',bg:'#e6e8eb'};
const CELL_W=10,CELL_H=20;   // the CrowPanel at lcd.font 20 (and 80 x 24 designs)

function gfMul(x,y){let z=0;for(let i=7;i>=0;i--){z=((z<<1)^((z>>7)*0x11d))&255;z^=((y>>i)&1)*x;}return z;}
function rsRemainder(data,degree){
 const div=new Array(degree).fill(0);div[degree-1]=1;let r=1;
 for(let n=0;n<degree;n++){for(let j=0;j<degree;j++){div[j]=gfMul(div[j],r);if(j+1<degree)div[j]^=div[j+1];}r=gfMul(r,2);}
 const rem=new Array(degree).fill(0);
 for(const b of data){const f=b^rem.shift();rem.push(0);for(let i=0;i<degree;i++)rem[i]^=gfMul(div[i],f);}
 return rem;
}
function formatBits(mask){let d=(1<<3)|mask,rem=d;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>9)*0x537);return ((d<<10)|rem)^0x5412;}

/* The modules: rows of booleans (true: dark). */
function matrix(text){
 const data=new TextEncoder().encode(String(text));let ver=1;
 for(;ver<=5;ver++){const [total,ecc]=VERSIONS[ver];if(12+8*data.length<=(total-ecc)*8)break;}
 if(ver>5)throw Error('QR text is too long: up to 106 bytes.');
 const [total,ecc,align]=VERSIONS[ver],cap=total-ecc,bits=[],put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>i)&1);};
 put(4,4);put(data.length,8);for(const b of data)put(b,8);put(0,Math.min(4,cap*8-bits.length));while(bits.length%8)bits.push(0);
 const words=[];for(let i=0;i<bits.length;i+=8)words.push(bits.slice(i,i+8).reduce((a,b)=>a*2+b,0));
 for(let pad=0xec;words.length<cap;pad^=0xec^0x11)words.push(pad);
 words.push(...rsRemainder(words,ecc));
 const size=17+4*ver,mod=[...Array(size)].map(()=>new Array(size).fill(false)),fun=[...Array(size)].map(()=>new Array(size).fill(false));
 const set=(x,y,dark)=>{mod[y][x]=!!dark;fun[y][x]=true;};
 for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]])for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=cx+dx,y=cy+dy;if(x>=0&&y>=0&&x<size&&y<size){const d=Math.max(Math.abs(dx),Math.abs(dy));set(x,y,d!==2&&d!==4);}}
 if(align)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(align+dx,align+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
 const format=m=>{const b=formatBits(m);
  for(let i=0;i<6;i++)set(8,i,(b>>i)&1);set(8,7,(b>>6)&1);set(8,8,(b>>7)&1);set(7,8,(b>>8)&1);
  for(let i=9;i<15;i++)set(14-i,8,(b>>i)&1);for(let i=0;i<8;i++)set(size-1-i,8,(b>>i)&1);
  for(let i=8;i<15;i++)set(8,size-15+i,(b>>i)&1);set(8,size-8,true);};
 format(0);
 let i=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;
  for(let v=0;v<size;v++)for(let j=0;j<2;j++){const x=right-j,y=((right+1)&2)===0?size-1-v:v;
   if(!fun[y][x]&&i<words.length*8){mod[y][x]=!!((words[i>>3]>>(7-(i&7)))&1);i++;}}}
 const masks=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,
  (x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
 const flip=m=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!fun[y][x]&&masks[m](x,y))mod[y][x]=!mod[y][x];};
 const penalty=()=>{let p=0;const cols=mod[0].map((_,x)=>mod.map(r=>r[x]));
  for(const lines of [mod,cols])for(const line of lines){let run=0,last=null;for(const v of line){if(v===last){run++;if(run===5)p+=3;else if(run>5)p++;}else{run=1;last=v;}}}
  for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++)if(mod[y][x]===mod[y][x+1]&&mod[y][x]===mod[y+1][x]&&mod[y][x]===mod[y+1][x+1])p+=3;
  const dark=mod.reduce((n,r)=>n+r.filter(Boolean).length,0);return p+Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;};
 let best=0,bestP=null;for(let m=0;m<8;m++){flip(m);format(m);const p=penalty();if(bestP===null||p<bestP){best=m;bestP=p;}flip(m);}
 flip(best);format(best);
 return mod;
}

const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
function normalize(q={}){const s={...defaults,...q};if(typeof s.text!=='string'||!s.text||![s.fg,s.bg].every(v=>/^#[0-9a-f]{6}$/i.test(v)))throw Error('Give the QR code a text and two colors.');return s;}

/* The PPM (one pixel per module, total x total with the quiet zone). */
function resource(q,total){
 const s=normalize(q),m=matrix(s.text),size=m.length,quiet=Math.floor((total-size)/2);
 if(total<size+4)throw Error('The QR code needs a larger box.');
 const header='P6\n'+total+' '+total+'\n255\n',bytes=new Uint8Array(header.length+total*total*3);bytes.set([...header].map(c=>c.charCodeAt(0)));
 const fg=hex(s.fg),bg=hex(s.bg);
 for(let y=0;y<total;y++)for(let x=0;x<total;x++){const mx=x-quiet,my=y-quiet,dark=mx>=0&&my>=0&&mx<size&&my<size&&m[my][mx];bytes.set(dark?fg:bg,header.length+(y*total+x)*3);}
 let hash=2166136261;for(const v of bytes)hash=Math.imul(hash^v,16777619)>>>0;
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const name='qr_'+hash.toString(16)+'.ppm';
 return {name,originalName:name,mime:'image/x-portable-pixmap',w:total,h:total,data:typeof btoa==='function'?btoa(text):Buffer.from(bytes).toString('base64')};
}

/* A picture element showing the QR code over its cells (x, y, w x h). The
 * box must be square in pixels (w * 10 = h * 20 on an 80 x 24 design); the
 * code is scaled by the largest whole number that keeps a quiet zone of at
 * least 2 modules on each side. */
function apply(p,q,cell=[CELL_W,CELL_H]){
 const s=normalize(q),side=p.w*cell[0];
 if(side!==p.h*cell[1])throw Error('Make the QR box square: its width in cells is twice its height.');
 const size=matrix(s.text).length;let scale=Math.floor(side/(size+4));
 while(scale>1&&side%scale)scale--;   // whole pixels per module, filling the box exactly
 if(scale<1)throw Error('The QR box is too small for this text.');
 const total=side/scale,file=resource(s,total);
 const element={op:'picture',name:p.name||'',x:p.x,y:p.y,w:p.w,h:p.h,text:'',fg:231,scale:0,src:null,border:0,
  asset:{path:'/root/'+file.name,w:total*scale,h:total*scale,key:null,dither:false},qr:s};
 return {element,file,modules:size,scale};
}
const api={defaults,matrix,formatBits,resource,apply};if(typeof module!=='undefined')module.exports=api;else root.TDQr=api;
})(typeof window!=='undefined'?window:globalThis);
