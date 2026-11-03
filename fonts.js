/* TDFONT01: portable generated glyphs, shared by preview/export validation. */
(function(root){
 'use strict';
 const MAX_BYTES=256*1024;
 function decode(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length<32||bytes.length>MAX_BYTES)throw Error('Invalid font size.');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=o=>v.getUint16(o,true),u32=o=>v.getUint32(o,true);
  const bpp=bytes[10],height=u16(12),ascent=u16(14),count=u16(16),size=u16(18),glyphs=new Map();
  if(String.fromCharCode(...bytes.slice(0,8))!=='TDFONT01'||u16(8)!==32||![1,4].includes(bpp)||bytes[11]||height<1||height>128||ascent>height||count<1||count>512||size<1||size>128||u32(20)!==32||u32(24)!==32+count*16||u32(28)!==bytes.length||u32(24)>bytes.length)throw Error('Invalid TDFONT01 header.');
  let end=u32(24),previous=0;
  for(let i=0;i<count;i++){
   const at=32+i*16,cp=u32(at),offset=u32(at+4),w=u16(at+8),left=v.getInt16(at+10,true),advance=u16(at+12),stride=Math.ceil(w*bpp/8),length=stride*height;
   if(cp<32||cp>0x10ffff||(cp>=0xd800&&cp<=0xdfff)||(i&&cp<=previous)||w>256||left< -128||left>128||advance<1||advance>256||u16(at+14)||offset!==end||offset+length>bytes.length)throw Error('Invalid font glyph table.');
   glyphs.set(cp,{cp,w,left,advance,stride,bits:bytes.subarray(offset,offset+length)});previous=cp;end=offset+length;
  }
  if(end!==bytes.length||!glyphs.has(63))throw Error('Font must contain a ? fallback glyph and exact bitmap data.');
  return {bytes,bpp,height,ascent,size,glyphs};
 }
 function encode({height,ascent,size,bpp,glyphs}){
  glyphs=[...glyphs].sort((a,b)=>a.cp-b.cp);
  const dataOffset=32+glyphs.length*16,total=dataOffset+glyphs.reduce((n,g)=>n+g.bits.length,0);
  if(total>MAX_BYTES)throw Error('Font exceeds 256 KiB. Use fewer characters, a smaller size, or 1-bit glyphs.');
  const bytes=new Uint8Array(total),v=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('TDFONT01'));
  v.setUint16(8,32,true);bytes[10]=bpp;v.setUint16(12,height,true);v.setUint16(14,ascent,true);v.setUint16(16,glyphs.length,true);v.setUint16(18,size,true);v.setUint32(20,32,true);v.setUint32(24,dataOffset,true);v.setUint32(28,total,true);
  let offset=dataOffset;glyphs.forEach((g,i)=>{const at=32+i*16;v.setUint32(at,g.cp,true);v.setUint32(at+4,offset,true);v.setUint16(at+8,g.w,true);v.setInt16(at+10,g.left,true);v.setUint16(at+12,g.advance,true);bytes.set(g.bits,offset);offset+=g.bits.length;});
  decode(bytes);return bytes;
 }
 function glyph(font,cp){return font.glyphs.get(cp)||font.glyphs.get(63);}
 function lines(font,text,width,wrap){
  const result=[];let start=0;const chars=Array.from(String(text));
  for(;;){let at=start,w=0,space=-1,beforeSpace=0;
   while(at<chars.length&&chars[at]!=='\n'){
    const advance=glyph(font,chars[at].codePointAt(0)).advance;
    if(wrap&&width>0&&w+advance>width&&at!==start){if(space>=0){at=space;w=beforeSpace;}break;}
    if(chars[at]===' '){space=at;beforeSpace=w;}w+=advance;at++;
   }
   const skip=chars[at]==='\n'||(at===space&&wrap&&at<chars.length),next=at+(skip?1:0);
   result.push({chars:chars.slice(start,at),width:w});start=next;
   if(start>=chars.length&&!skip)break;
  }
  return result;
 }
 function measure(font,text,width=0,wrap=false){const rows=lines(font,text,width,wrap);return {w:Math.max(0,...rows.map(r=>r.width)),h:rows.length*font.height};}
 function alpha(font,g,x,y){const b=g.bits[y*g.stride+Math.floor(x*font.bpp/8)];return font.bpp===1?((b>>(7-x%8))&1)*15:(b>>(x%2?0:4))&15;}
 function paint(ctx,font,text,x,y,w,h,fg,bg,align='left',valign='top',wrap=false){
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();if(bg!==null){ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);}
  const rows=lines(font,text,w,wrap),th=rows.length*font.height;let yy=y+(valign==='middle'?(h-th)/2:valign==='bottom'?h-th:0);
  ctx.fillStyle=fg;
  for(const row of rows){let xx=x+(align==='center'?(w-row.width)/2:align==='right'?w-row.width:0);
   for(const char of row.chars){const g=glyph(font,char.codePointAt(0));for(let gy=0;gy<font.height;gy++)for(let gx=0;gx<g.w;gx++){const a=alpha(font,g,gx,gy);if(a){ctx.globalAlpha=a/15;ctx.fillRect(Math.floor(xx)+g.left+gx,Math.floor(yy)+gy,1,1);}}xx+=g.advance;}yy+=font.height;
  }ctx.restore();
 }
 async function generate({family,size=24,bpp=4,characters}){
  if(!Number.isInteger(size)||size<8||size>96||![1,4].includes(bpp))throw Error('Choose a size from 8 to 96 pixels and 1- or 4-bit glyphs.');
  const chars=[...new Set(Array.from((characters||'')+' ?'))].filter(c=>c.codePointAt(0)>=32&&c.codePointAt(0)!==127).sort((a,b)=>a.codePointAt(0)-b.codePointAt(0));
  if(!chars.length||chars.length>512)throw Error('Choose up to 512 unique characters.');
  await document.fonts.load(size+'px '+family,chars.join(''));
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.font=size+'px '+family;
  const metrics=chars.map(c=>ctx.measureText(c)),ascent=Math.ceil(Math.max(...metrics.map(m=>m.actualBoundingBoxAscent)))+1,descent=Math.ceil(Math.max(...metrics.map(m=>m.actualBoundingBoxDescent)))+1,height=ascent+descent;
  if(height>128)throw Error('This font needs more than 128 pixels of line height. Reduce the size.');
  const glyphs=chars.map((c,i)=>{
   const m=metrics[i],left=Math.floor(-m.actualBoundingBoxLeft)-1,w=Math.max(0,Math.ceil(m.actualBoundingBoxRight)-left+1),advance=Math.max(1,Math.round(m.width)),stride=Math.ceil(w*bpp/8);
   canvas.width=Math.max(1,w);canvas.height=height;ctx.font=size+'px '+family;ctx.textBaseline='alphabetic';ctx.fillStyle='#fff';ctx.fillText(c,-left,ascent);
   const rgba=ctx.getImageData(0,0,Math.max(1,w),height).data,bits=new Uint8Array(stride*height);
   for(let y=0;y<height;y++)for(let x=0;x<w;x++){const a=rgba[(y*Math.max(1,w)+x)*4+3],at=y*stride+Math.floor(x*bpp/8);if(bpp===1){if(a>=128)bits[at]|=128>>(x%8);}else bits[at]|=Math.round(a*15/255)<<(x%2?0:4);}
   return {cp:c.codePointAt(0),w,left,advance,bits};
  });
  return encode({height,ascent,size,bpp,glyphs});
 }
 function assets(d){const result=[];for(const w of d.windows)for(const o of w.widgets)for(const p of o.paint||[])if(p.font&&!result.some(f=>f.path===p.font.path))result.push(p.font);return result;}
 const api={MAX_BYTES,decode,encode,measure,paint,generate,assets};if(typeof module!=='undefined')module.exports=api;else root.TDFonts=api;
})(typeof window!=='undefined'?window:globalThis);
