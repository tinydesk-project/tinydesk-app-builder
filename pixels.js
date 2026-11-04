/* Pixel drawing shared by the inspector, resource checks and Python export. */
(function(root){
'use strict';
const Fonts=typeof module!=='undefined'?require('./fonts.js'):root.TDFonts;
const defaults={
    font_text:{x:0,y:0,w:20,h:3,text:'Text',fg:231,bg:25,align:'left',valign:'top',wrap:true,font:{path:'/root/font.tdfont'}},
    rect:{x:0,y:0,w:20,h:8,color:40,radius:0,outline:false},
    line:{x:0,y:0,x2:20,y2:4,color:40},
    circle:{x:4,y:4,r:3,color:40,outline:false},
    gradient:{x:0,y:0,w:20,h:4,rgb1:[0,0,80],rgb2:[0,120,255],across:false},
    draw_text:{x:0,y:0,text:'VALUE',color:231,bg:-2,scale:1,small:true},
    bar:{x:0,y:0,w:20,h:4,value:65,maximum:100,color:40,track:237,edge:120,radius:1},
    gauge:{x:0,y:0,w:40,h:32,value:65,maximum:100,color:220,track:244,bg:17},
    slider:{x:0,y:0,w:20,h:3,name:'value_slider',value:65,maximum:100,color:220,track:17,knob:231,on_change:''},
    image:{x:0,y:0,w:20,h:4,asset:{path:'/root/picture.ppm',w:32,h:32,key:null,dither:true},src:null},
    nine:{x:0,y:0,w:20,h:4,asset:{path:'/root/picture.ppm',w:32,h:32,key:null,dither:true},src:null,border:2},
    picture:{x:0,y:0,w:10,h:3,asset:{path:'/root/picture.ppm',w:32,h:32,key:null,dither:true},src:null,border:2,text:'',fg:231,scale:0},
    button:{x:0,y:0,w:10,h:3,name:'action_button',text:'Apply',color:25,down:18,rim:32,fg:231,radius:3,scale:0,on_click:''}
};
const buttonEvents=['on_press','on_release','on_click','on_cancel'];
const isPixel=p=>Object.hasOwn(defaults,p?.op);
const cellUnits=p=>p.op==='picture'||p.op==='button'||p.op==='slider'||p.op==='font_text';
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const rgb=v=>Array.isArray(v)&&v.length===3&&v.every(n=>integer(n,0,255));
const assetKey=a=>JSON.stringify([a.path,a.w,a.h,a.key,a.dither]);
function assets(d){
    const result=[];
    for(const w of d.windows)for(const o of w.widgets)for(const p of o.paint||[])
        if(p.asset&&!result.some(a=>assetKey(a)===assetKey(p.asset)))result.push(p.asset);
    return result;
}
function textSize(text,scale=1,small=false){
    const lines=String(text).split('\n');
    return {w:Math.max(...lines.map(l=>small?Array.from(l).reduce((n,c)=>n+('.:'.includes(c)?2:4),-1)+(!l?1:0):Array.from(l).length*8))*scale,
        h:(small?6*lines.length-1:16*lines.length)*scale};
}
function shapeValid(p){
    if(!isPixel(p))return false;
    if(p.gradient!=null&&(!rgb(p.gradient.rgb1)||!rgb(p.gradient.rgb2)||typeof p.gradient.across!=='boolean'||!['rect','bar','circle','slider','gauge','button'].includes(p.op)))return false;
    if(p.font!=null&&(!p.font.path||typeof p.font.path!=='string'||/[\0\r\n]/.test(p.font.path)))return false;
    if(p.name!==undefined&&typeof p.name!=='string')return false;
    if(p.op==='button'){
        if(buttonEvents.some(k=>p[k]!==undefined&&typeof p[k]!=='string'))return false;
        if(p.asset!=null&&(!shapeValid({...p,op:'picture',src:p.src??null,border:p.border??4})||
            (p.src_down!=null&&(!Array.isArray(p.src_down)||p.src_down.length!==4||!p.src_down.every(n=>integer(n,0,4096))))))return false;
    }
    return Object.entries(defaults[p.op]).every(([k,v])=>
        k==='font'?!!p.font:
        k==='asset'?p.asset&&typeof p.asset.path==='string'&&integer(p.asset.w,1,4096)&&integer(p.asset.h,1,4096)&&
            (p.asset.key===null||rgb(p.asset.key))&&typeof p.asset.dither==='boolean':
        k==='src'?p.src===null||(Array.isArray(p.src)&&p.src.length===4&&p.src.every(n=>integer(n,0,4096))):
        Array.isArray(v)?rgb(p[k]):typeof v==='number'?integer(p[k],-32767,32767):typeof p[k]===typeof v);
}
function validate(p,o,error){
    if(!shapeValid(p)){error(o.name+': invalid '+p.op+' drawing fields.');return;}
    if(p.op==='font_text'&&(!['left','center','right'].includes(p.align)||!['top','middle','bottom'].includes(p.valign)))error('Invalid text alignment.');
    let x=p.x,y=p.y,w=p.w||1,h=p.h||1;
    if(p.op==='circle'){x-=p.r;y-=p.r;w=h=2*p.r+1;if(p.r<0)error('Circle radius must be nonnegative.');}
    if(p.op==='line'){x=Math.min(p.x,p.x2);y=Math.min(p.y,p.y2);w=Math.abs(p.x2-p.x)+1;h=Math.abs(p.y2-p.y)+1;}
    if(p.op==='draw_text')({w,h}=textSize(p.text,p.scale,p.small));
    const units=cellUnits(p)?1:2;
    if(x<0||y<0||w<1||h<1||x+w>o.w*units||y+h>o.h*units)error(o.name+': '+p.op+' exceeds canvas bounds.');
    for(const k of ['color','track','fg','knob'])if(k in p&&!integer(p[k],0,255))error(o.name+': '+k+' must be 0–255.');
    for(const k of ['down','rim'])if(k in p&&!integer(p[k],0,255))error(o.name+': '+k+' must be 0–255.');
    if('bg' in p&&!integer(p.bg,-2,255))error(o.name+': background must be CLEAR (-2), theme (-1), or 0–255.');
    if('edge' in p&&!integer(p.edge,-1,255))error(o.name+': edge must be -1 or 0–255.');
    if('radius' in p&&!integer(p.radius,0,32767))error(o.name+': radius must be nonnegative.');
    if('scale' in p&&!integer(p.scale,p.op==='draw_text'?1:0,8))error(o.name+': text scale out of range.');
    if('text' in p&&(new TextEncoder().encode(p.text).length>900||p.text.includes('\0')))error(o.name+': drawing text exceeds 900 bytes or contains NUL.');
    if(['bar','gauge','slider'].includes(p.op)&&p.maximum<1)error(o.name+': control maximum must be positive.');
    if(p.op==='gauge'&&(p.w<12||p.h<14))error(o.name+': gauge needs at least 12 × 14 pixels.');
    if(p.asset){
        if(!p.asset.path||/[\0\r\n]/.test(p.asset.path))error(o.name+': image path must be a single line.');
        if(p.src&&(p.src[2]<1||p.src[3]<1||p.src[0]+p.src[2]>p.asset.w||p.src[1]+p.src[3]>p.asset.h))error(o.name+': sprite part exceeds the image.');
        if(p.src_down&&(p.src_down[2]<1||p.src_down[3]<1||p.src_down[0]+p.src_down[2]>p.asset.w||p.src_down[1]+p.src_down[3]>p.asset.h))error(o.name+': pressed sprite part exceeds the image.');
    }
    if('border' in p&&!integer(p.border,0,32767))error(o.name+': border must be nonnegative.');
}
function pixelBytes(d,groups){
    const native=d.colorMode==='rgb565'&&d.board>2000;
    let bytes=Fonts.assets(d).reduce((n,a)=>{const f=d.assets?.find(f=>f.name===a.path.split('/').pop());return n+(f?Math.floor(f.data.length*3/4)+48:0);},0);
    bytes+=assets(d).reduce((n,a)=>n+a.w*a.h*((a.key===null?1:2)+(native?2:0)),0);
    for(const w of d.windows)for(const o of w.widgets)for(const p of o.paint||[])
        if(cellUnits(p)&&(p.asset?.key!=null||p.op==='font_text'&&p.bg===-2))bytes+=4*p.w*p.h*(native?3:1); // transparent picture background
    for(const w of d.windows)for(const o of w.widgets)for(const p of o.paint||[])
        if(p.font&&p.text)bytes+=new TextEncoder().encode(p.text).length+17;
    for(const w of d.windows)for(const g of groups(w))
        if(g.members.some(o=>o.paint.some(isPixel)))bytes+=g.w*g.h*g.pages*4*(native?3:1);
    return bytes;
}
// Arguments stay structured until core.js quotes and wraps each Python call.
function args(p,image,font=null){
    const a=(value,key)=>({value,key}),xy=[a(p.x),a(p.y)],box=[...xy,a(p.w),a(p.h)],g=p.gradient?[a(p.gradient,'gradient')]:[];
    switch(p.op){
    case 'font_text':return [font,...box,a(p.text),...['fg','bg','align','valign','wrap'].map(k=>a(p[k],k))];
    case 'gauge':return [...box,...['value','maximum','color','track','bg'].map(k=>a(p[k],k)),...g,...(p.radius!==undefined?[a(p.radius,'radius')]:[])];
    case 'slider':return [...box,...['value','maximum','color','track','knob'].map(k=>a(p[k],k)),...(p.on_change?['on_change='+p.on_change]:[]),...g,...(p.radius!==undefined?[a(p.radius,'radius')]:[])];
    case 'rect':return [...box,a(p.color),a(p.radius,'radius'),a(p.outline,'outline'),...g];
    case 'line':return [...xy,a(p.x2),a(p.y2),a(p.color)];
    case 'circle':return [...xy,a(p.r),a(p.color),a(p.outline,'outline'),...g];
    case 'gradient':return [...box,a(p.rgb1),a(p.rgb2),a(p.across,'across')];
    case 'draw_text':return [...xy,a(p.text),a(p.color),p.bg===-2?'bg=tdui.CLEAR':a(p.bg,'bg'),a(p.scale,'scale'),a(p.small,'small')];
    case 'bar':return [...box,...['value','maximum','color','track','edge','radius'].map(k=>a(p[k],k)),...g];
    case 'image':case 'nine':case 'picture':return [image,...box,...(p.op==='nine'?[a(p.border)]:[]),a(p.src,'src'),
        ...(p.op==='picture'?['border','text','fg','scale'].map(k=>a(p[k],k)):[]),...(font?['font='+font]:[])];
    case 'button':return [...box,a(p.text),...buttonEvents.filter(k=>p[k]).map(k=>k+'='+p[k]),
        ...['color','down','rim','fg','radius','scale'].map(k=>a(p[k],k)),
        ...(p.asset?['sheet='+image,a(p.src??null,'src'),a(p.src_down??null,'src_down'),a(p.border??4,'border')]:[]),...(font?['font='+font]:[]),...g];
    }
}
function preview(ctx,p,x,y,color,assetImage=null){
    if(!shapeValid(p))return;
    if(p.w>600||p.h>300||p.r>300)return; // invalid imported geometry must not stall the editor
    ctx.save();ctx.translate(x*10,y*20);ctx.scale(5,10);
    const fillColor=(fallback,x,y,w,h)=>{if(!p.gradient)return color(fallback);const g=ctx.createLinearGradient(x,y,x+(p.gradient.across?w:0),y+(p.gradient.across?0:h));g.addColorStop(0,'rgb('+p.gradient.rgb1.join(',')+')');g.addColorStop(1,'rgb('+p.gradient.rgb2.join(',')+')');return g;};
    const nine=(image,src,dx,dy,dw,dh,border)=>{
        const [sx,sy,sw,sh]=src||[0,0,image.width,image.height],b=Math.max(0,Math.min(border||0,sw/2,sh/2));
        if(!b){ctx.drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh);return;}
        const slices=p.edgeSlices&&p.w>=5&&p.h>=3&&sw>2*b&&sh>2*b;
        const bx=slices?4:Math.min(b/5,dw/2),by=slices?2:Math.min(b/10,dh/2),xs=[sx,sx+b,sx+sw-b,sx+sw],ys=[sy,sy+b,sy+sh-b,sy+sh],xx=[dx,dx+bx,dx+dw-bx,dx+dw],yy=[dy,dy+by,dy+dh-by,dy+dh];
        ctx.imageSmoothingEnabled=false;
        for(let r=0;r<3;r++)for(let c=0;c<3;c++)if(xs[c+1]>xs[c]&&ys[r+1]>ys[r]&&xx[c+1]>xx[c]&&yy[r+1]>yy[r])ctx.drawImage(image,xs[c],ys[r],xs[c+1]-xs[c],ys[r+1]-ys[r],xx[c],yy[r],xx[c+1]-xx[c],yy[r+1]-yy[r]);
    };
    const nativeLabel=(text,fg,scale)=>{
        const f=p.font&&root.TDFontPreview?.(p.font);
        if(f){const [cw,ch]=root.TDFontCellSize?.()||[10,20];ctx.save();ctx.scale(2/cw,2/ch);Fonts.paint(ctx,f,text,p.x*cw,p.y*ch,p.w*cw,p.h*ch,color(fg),null,'center','middle');ctx.restore();return;}
        ctx.save();ctx.scale(.2,.1);ctx.fillStyle=color(fg);
        ctx.font=(scale?16*scale:16)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(text,(p.x+p.w/2)*10,(p.y+p.h/2)*20,p.w*10);ctx.restore();
    };
    const round=(px,py,w,h,r,c,outline=false)=>{
        r=Math.min(r,w/2,h/2);ctx.fillStyle=p.gradient&&(p.op==='slider'?c===p.track:p.op==='gauge'?c===p.bg:c===p.color)?fillColor(c,px,py,w,h):color(c);
        const inside=(xx,yy)=>{
            if(xx<0||yy<0||xx>=w||yy>=h)return false;
            const cx=xx<r?r:xx>=w-r?w-r-1:xx,cy=yy<r?r:yy>=h-r?h-r-1:yy;
            return (xx-cx)**2+(yy-cy)**2<=r*r+r;
        };
        for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
            const pair=!(px%2)&&!(w%2),ex=pair?(xx<w/2?xx|1:xx&~1):xx,dx=pair?2:1;
            if(inside(ex,yy)&&!(outline&&inside(ex-dx,yy)&&inside(ex+dx,yy)&&inside(ex,yy-1)&&inside(ex,yy+1)))ctx.fillRect(px+xx,py+yy,1,1);
        }
    };
    if(p.op==='font_text'){
        const [cw,ch]=root.TDFontCellSize?.()||[10,20];ctx.save();ctx.scale(2/cw,2/ch);const f=root.TDFontPreview?.(p.font);
        if(f)Fonts.paint(ctx,f,p.text,p.x*cw,p.y*ch,p.w*cw,p.h*ch,color(p.fg),p.bg===-2?null:color(p.bg<0?236:p.bg),p.align,p.valign,p.wrap);
        else {ctx.fillStyle=color(244);ctx.font='14px monospace';ctx.fillText('Choose / generate font',p.x*10,p.y*20+16);}
        ctx.restore();
    }else if(p.op==='gauge'){
        const rx=Math.max(1,Math.min(p.w/2-1,p.h-7)),ry=Math.max(1,Math.floor(rx/2)),cx=p.x+p.w/2,cy=p.y+ry;
        round(p.x,p.y,p.w,p.h,p.radius||0,p.bg);ctx.strokeStyle=color(p.track);ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,-Math.PI*1.2,Math.PI*.2);ctx.stroke();
        const a=-Math.PI*1.2+Math.PI*1.4*Math.max(0,Math.min(1,p.value/p.maximum));ctx.strokeStyle=color(p.color);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*rx*.85,cy+Math.sin(a)*ry*.85);ctx.stroke();
        ctx.fillStyle=color(p.color);ctx.font='5px monospace';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(String(p.value),p.x+1,p.y+p.h-5,p.w-2);
    }else if(p.op==='slider'){
        const x=p.x*2,y=p.y*2,w=p.w*2,h=p.h*2;round(x,y,w,h,p.radius??0,p.track);round(x,y+Math.floor(h/2),w,1,0,p.color);const at=Math.round((w-2)*Math.max(0,Math.min(1,p.value/p.maximum)));round(x+at,y,2,h,1,p.knob);
    }else if(p.op==='rect'){
        round(p.x,p.y,p.w,p.h,p.radius,p.color,p.outline);
    }else if(p.op==='bar'){
        round(p.x,p.y,p.w,p.h,p.radius,p.track);
        ctx.save();const n=2*Math.round((p.w/2)*Math.min(1,Math.max(0,p.value/p.maximum)));
        ctx.beginPath();ctx.rect(p.x,p.y,n,p.h);ctx.clip();round(p.x,p.y,p.w,p.h,p.radius,p.color);
        if(p.edge>=0){ctx.beginPath();ctx.rect(p.x,p.y,p.w,1);ctx.clip();round(p.x,p.y,p.w,p.h,p.radius,p.edge);}ctx.restore();
    }else if(p.op==='circle'){
        ctx.fillStyle=fillColor(p.color,p.x-p.r,p.y-p.r,p.r*2+1,p.r*2+1);ctx.strokeStyle=ctx.fillStyle;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,2*Math.PI);p.outline?ctx.stroke():ctx.fill();
    }else if(p.op==='line'){
        ctx.strokeStyle=color(p.color);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x+.5,p.y+.5);ctx.lineTo(p.x2+.5,p.y2+.5);ctx.stroke();
    }else if(p.op==='gradient'){
        const g=ctx.createLinearGradient(p.x,p.y,p.x+(p.across?p.w:0),p.y+(p.across?0:p.h));
        g.addColorStop(0,'rgb('+p.rgb1.join(',')+')');g.addColorStop(1,'rgb('+p.rgb2.join(',')+')');ctx.fillStyle=g;ctx.fillRect(p.x,p.y,p.w,p.h);
    }else if(p.op==='draw_text'){
        const s=textSize(p.text,p.scale,p.small);
        if(p.bg!==-2){ctx.fillStyle=color(p.bg<0?236:p.bg);ctx.fillRect(p.x,p.y,s.w,s.h);}
        ctx.fillStyle=color(p.color);ctx.font=(p.small?5:16)*p.scale+'px monospace';ctx.textAlign='left';ctx.textBaseline='top';
        p.text.split('\n').forEach((t,i)=>ctx.fillText(t,p.x,p.y+i*(p.small?6:16)*p.scale,s.w));
    }else if(p.op==='button'){
        if(assetImage)nine(assetImage,p.src,p.x*2,p.y*2,p.w*2,p.h*2,p.border);
        else round(p.x*2,p.y*2,p.w*2,p.h*2,p.radius,p.color);
        nativeLabel(p.text,p.fg,p.scale);
    }else{
        const k=cellUnits(p)?2:1;
        if(!assetImage&&!(p.op==='picture'&&p.bg===-2)){ctx.fillStyle=color(p.asset?.preview??238);ctx.fillRect(p.x*k,p.y*k,p.w*k,p.h*k);}
        if(assetImage&&!(p.op==='picture'&&p.bg===-2)){
            nine(assetImage,p.src,p.x*k,p.y*k,p.w*k,p.h*k,p.border);
        }
        if(!p.text&&!assetImage){ctx.strokeStyle=color(244);ctx.lineWidth=.3;ctx.strokeRect(p.x*k,p.y*k,p.w*k,p.h*k);}
        if(cellUnits(p)){if(!assetImage||p.text)nativeLabel(p.text||'IMAGE',p.fg??252,p.scale);}
        else if(!assetImage){ctx.fillStyle=color(252);ctx.font='2px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('IMAGE',(p.x+p.w/2)*k,(p.y+p.h/2)*k,p.w*k);}
    }
    ctx.restore();
}
const api={defaults,buttonEvents,isPixel,cellUnits,assets,assetKey,textSize,shapeValid,validate,pixelBytes,args,preview};
if(typeof module!=='undefined')module.exports=api;else root.TDPixels=api;
})(typeof window!=='undefined'?window:globalThis);
