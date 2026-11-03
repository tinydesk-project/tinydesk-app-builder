/* Element resize math shared by the editor and regression checks. */
(function(root){
 'use strict';
 const cells=p=>['picture','button','slider','font_text','big','put','fill'].includes(p.op);
 function handles(p,b){
  if(p.op==='line')return[{kind:'start',x:p.x/2,y:p.y/2},{kind:'end',x:p.x2/2,y:p.y2/2}];
  if(p.op==='circle')return['nw','ne','se','sw'].map(kind=>({kind,x:kind.includes('w')?b.x:b.x+b.w,y:kind.includes('n')?b.y:b.y+b.h}));
  if(!('w' in p&&'h' in p))return[];
  return ['nw','n','ne','e','se','s','sw','w'].map(kind=>({kind,x:kind.includes('w')?b.x:kind.includes('e')?b.x+b.w:b.x+b.w/2,y:kind.includes('n')?b.y:kind.includes('s')?b.y+b.h:b.y+b.h/2}));
 }
 function resize(p,b,kind,dx,dy,width,height){
  const out=JSON.parse(JSON.stringify(p)),u=cells(p)?1:2,clamp=(n,a,z)=>Math.max(a,Math.min(z,n)),snap=n=>Math.round(n*u)/u;
  if(p.op==='line'){
   const x=kind==='start'?'x':'x2',y=kind==='start'?'y':'y2';out[x]=clamp(Math.round(p[x]+dx*2),0,width*2-1);out[y]=clamp(Math.round(p[y]+dy*2),0,height*2-1);return out;
  }
  let l=b.x,t=b.y,r=b.x+b.w,d=b.y+b.h;
  const minw=(p.op==='gauge'?12:p.op==='slider'?2:1)/u,minh=(p.op==='gauge'?14:1)/u;
  if(kind.includes('w'))l=clamp(snap(l+dx),0,r-minw);
  if(kind.includes('e'))r=clamp(snap(r+dx),l+minw,width);
  if(kind.includes('n'))t=clamp(snap(t+dy),0,d-minh);
  if(kind.includes('s'))d=clamp(snap(d+dy),t+minh,height);
  if(p.op==='circle'){
   const diameter=Math.max(1,Math.floor(Math.min(r-l,d-t)*2));out.r=Math.floor((diameter-1)/2);out.x=Math.round(l*2)+out.r;out.y=Math.round(t*2)+out.r;
  }else{out.x=Math.round(l*u);out.y=Math.round(t*u);out.w=Math.round((r-l)*u);out.h=Math.round((d-t)*u);}
  return out;
 }
 const api={handles,resize};if(typeof module!=='undefined')module.exports=api;else root.TDGeometry=api;
})(typeof window!=='undefined'?window:globalThis);
