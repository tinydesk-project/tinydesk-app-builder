/* Render the native VT cell snapshot without depending on browser text CSS. */
(function(root){
 'use strict';
 const blocks=[0,0x2597,0x2596,0x2584,0x259d,0x2590,0x259e,0x259f,0x2598,0x259a,0x258c,0x2599,0x2580,0x259c,0x259b,0x2588];
 function decode(bytes){
  if(bytes.length<16||String.fromCharCode(...bytes.slice(0,4))!=='TDCF'||bytes[4]!==1)throw Error('Invalid native simulator frame. Update the helper and tdsim.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),cols=view.getUint16(6,true),rows=view.getUint16(8,true);
  if(cols<1||cols>300||rows<1||rows>150||bytes.length!==16+cols*rows*4)throw Error('Invalid native simulator frame size.');
  return {cols,rows,cx:view.getUint16(10,true),cy:view.getUint16(12,true),cursor:!!bytes[14],view};
 }
 function paint(ctx,frame,cw,ch,palette){
  ctx.save();ctx.font=(ch===20?17:14)+'px "Courier New",monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  for(let y=0;y<frame.rows;y++)for(let x=0;x<frame.cols;x++){
   const at=16+(y*frame.cols+x)*4,code=frame.view.getUint16(at,true),fg=frame.view.getUint8(at+2),bg=frame.view.getUint8(at+3),px=x*cw,py=y*ch;
   ctx.fillStyle=palette(bg);ctx.fillRect(px,py,cw,ch);
   if(code&&code!==32){
    ctx.fillStyle=palette(fg);const mask=blocks.indexOf(code);
    if(mask>0){for(let q=0;q<4;q++)if(mask&(8>>q))ctx.fillRect(px+(q%2)*cw/2,py+Math.floor(q/2)*ch/2,cw/2,ch/2);}
    else if(code>=0x2591&&code<=0x2593){ctx.globalAlpha=(code-0x2590)/4;ctx.fillRect(px,py,cw,ch);ctx.globalAlpha=1;}
    else{ctx.save();ctx.beginPath();ctx.rect(px,py,cw,ch);ctx.clip();ctx.fillText(String.fromCharCode(code),px+cw/2,py+ch/2,cw);ctx.restore();}
   }
   if(frame.cursor&&x===frame.cx&&y===frame.cy){ctx.fillStyle=palette(fg);ctx.fillRect(px,py+ch-2,cw,2);}
  }
  ctx.restore();
 }
 const api={decode,paint};if(typeof module!=='undefined')module.exports=api;else root.TDSimulationFrame=api;
})(typeof window!=='undefined'?window:globalThis);
