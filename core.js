(function(root){'use strict';
// 遮挡对账台：二维矩形并集面积 × 时间分段积分 + 精确最小平移
function int(v,label,min,max){const s=String(v).trim();if(!/^-?\d+$/.test(s))throw Error(label+'须为整数');const n=Number(s);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+'须为 '+min+'–'+max+' 的整数');return n;}
function label(s,kind,i){const v=String(s).trim();if(!v||[...v].length>24||/[,，\t\n]/.test(v))throw Error('第'+(i+1)+'个'+kind+'名称须为1–24字且不含逗号或制表符');return v;}
function parseRows(text,fields,kind,limit){const lines=String(text).replace(/\r/g,'').trim().split('\n');if(!lines[0]||lines.length>limit)throw Error(kind+'须为1–'+limit+'行');const seen=new Set();return lines.map((line,i)=>{const p=line.split(/[,，\t]/).map(x=>x.trim());if(p.length!==fields||p.some(x=>!x))throw Error('第'+(i+1)+'行须有'+fields+'项且不能留空');const n=label(p[0],kind,i);if(seen.has(n))throw Error(kind+'名称重复：'+n);seen.add(n);return {name:n,raw:p};});}
function rect(p,W,H,i,kind){const x=int(p[1],'第'+(i+1)+'行 x',0,4096),y=int(p[2],'第'+(i+1)+'行 y',0,4096),w=int(p[3],'第'+(i+1)+'行 w',1,4096),h=int(p[4],'第'+(i+1)+'行 h',1,4096);if(x+w>W||y+h>H)throw Error('第'+(i+1)+'行'+kind+'超出画面 '+W+'×'+H);return {name:p[0],x,y,w,h,x1:x+w,y1:y+h,area:w*h};}
// 坐标压缩求矩形并面积；边界半开，只有正宽正高的格子计入
function unionArea(rects){if(!rects.length)return 0;const gx=[...new Set(rects.flatMap(r=>[r.x,r.x1]))].sort((a,b)=>a-b),gy=[...new Set(rects.flatMap(r=>[r.y,r.y1]))].sort((a,b)=>a-b);const nx=gx.length-1,ny=gy.length-1,grid=new Uint8Array(nx*ny);for(const r of rects){const a=gx.indexOf(r.x),b=gx.indexOf(r.x1),c=gy.indexOf(r.y),d=gy.indexOf(r.y1);for(let j=c;j<d;j++)for(let i=a;i<b;i++)grid[j*nx+i]=1;}let s=0;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(grid[j*nx+i])s+=(gx[i+1]-gx[i])*(gy[j+1]-gy[j]);return s;}
function overlap(a,b){const x0=Math.max(a.x,b.x),x1=Math.min(a.x1,b.x1),y0=Math.max(a.y,b.y),y1=Math.min(a.y1,b.y1);return x1>x0&&y1>y0?{x:x0,y:y0,w:x1-x0,h:y1-y0,x1,y1,area:(x1-x0)*(y1-y0)}:null;}
// 精确最小平移。对每个 dy，x 禁区间补集上离 0 最近的允许点，必是 0 / 箱边界 / 禁区间端点邻点。
// 冲突集合只在 y 禁区间端点处变化，故 dy 候选取所有端点及其邻点、0、箱边界即可覆盖最优解。
function minShift(o,areas,W,H){const dxMin=-o.x,dxMax=W-o.x-o.w,dyMin=-o.y,dyMax=H-o.y-o.h;
  const xBands=[],yBands=[];
  for(const p of areas){xBands.push([p.x-o.w-o.x+1,p.x1-o.x-1]);yBands.push([p.y-o.h-o.y+1,p.y1-o.y-1]);}
  const dys=new Set([0,dyMin,dyMax]);
  for(const [lo,hi] of yBands)for(const v of [lo-1,lo,hi,hi+1])if(v>=dyMin&&v<=dyMax)dys.add(v);
  let best=null;
  for(const dy of dys){
    const bands=xBands.filter((_,j)=>dy>=yBands[j][0]&&dy<=yBands[j][1]).map(([lo,hi])=>[Math.max(lo,dxMin),Math.min(hi,dxMax)]).filter(([lo,hi])=>hi>=lo);
    const cand=new Set([0,dxMin,dxMax]);
    for(const [lo,hi] of bands)for(const v of [lo-1,lo,hi,hi+1])if(v>=dxMin&&v<=dxMax)cand.add(v);
    for(const dx of cand){let ok=true;for(const [lo,hi] of bands)if(dx>=lo&&dx<=hi){ok=false;break}if(!ok)continue;
      const c={dx,dy,cost:Math.abs(dx)+Math.abs(dy),max:Math.max(Math.abs(dx),Math.abs(dy))};
      if(!best||c.cost<best.cost||(c.cost===best.cost&&(c.max<best.max||(c.max===best.max&&(dx<best.dx||(dx===best.dx&&dy<best.dy))))))best=c;
    }
  }
  return best; // null = 画面内无可行位置
}
function solve(x){
  const W=int(x.W,'画面宽',1,4096),H=int(x.H,'画面高',1,4096),T=int(x.T,'核查时长',1,3600),q=int(x.q,'致命占比阈值',0,100);
  const areas=parseRows(x.areas,5,'受保护区域',12).map((r,i)=>rect(r.raw,W,H,i,'区域'));
  const overlays=parseRows(x.overlays,7,'贴片',12).map((r,i)=>{const p=r.raw,b=rect(p,W,H,i,'贴片');const t0=int(p[5],'第'+(i+1)+'行起始秒',0,3600),t1=int(p[6],'第'+(i+1)+'行结束秒',1,3600);if(t0>=t1||t1>T)throw Error('第'+(i+1)+'行须满足 0 ≤ 起始秒 < 结束秒 ≤ '+T);return {...b,t0,t1};});
  const cuts=[...new Set([0,T,...overlays.flatMap(o=>[o.t0,o.t1])])].sort((a,b)=>a-b);
  const segments=[];for(let i=0;i<cuts.length-1;i++){const u=cuts[i],v=cuts[i+1];if(v<=u)continue;segments.push({u,v,dur:v-u,active:overlays.filter(o=>o.t0<=u&&o.t1>=v)});}
  const regions=areas.map(p=>{
    const per=segments.map(s=>{const clipped=[];for(const o of s.active){const c=overlap(p,o);if(c)clipped.push(c);}return {u:s.u,v:s.v,dur:s.dur,covered:unionArea(clipped),hits:clipped.length};});
    let peak=0,blocked=0,areaSec=0,longest=0,run=0;
    for(const s of per){peak=Math.max(peak,s.covered);blocked+=s.dur*Number(s.covered>0);areaSec+=s.covered*s.dur;if(s.covered>0){run+=s.dur;longest=Math.max(longest,run)}else run=0;}
    return {name:p.name,x:p.x,y:p.y,w:p.w,h:p.h,area:p.area,peak,peakPct:peak/p.area*100,blocked,areaSec,longest,
      fatal:peak>0&&peak*100>=q*p.area,per};
  });
  let safe=0;segments.forEach((s,i)=>{if(regions.every(r=>r.per[i].covered===0))safe+=s.dur;});
  const conflicts=overlays.map(o=>{
    const row=areas.map(p=>{const c=overlap(p,o);return c?{area:c.area,pct:c.area/p.area*100,region:p.name}:null;}).filter(Boolean);
    return {...o,regionHits:row,duration:o.t1-o.t0,areaSec:row.reduce((n,r)=>n+r.area,0)*(o.t1-o.t0),
      shift:minShift(o,areas,W,H),fatal:row.some(r=>r.area>0&&r.area*100>=q*areas.find(a=>a.name===r.region).area)};
  });
  const fatalCount=conflicts.filter(c=>c.fatal).length;
  return {W,H,T,q,areas,overlays,segments:segments.map(s=>({u:s.u,v:s.v,dur:s.dur,active:s.active.map(o=>o.name)})),regions,conflicts,safe,
    fatalCount,anyFatal:regions.some(r=>r.fatal),blockedTime:T-safe};
}
const api={solve,unionArea,overlap,minShift};if(typeof module!=='undefined')module.exports=api;else root.AppCore=api;
})(typeof window!=='undefined'?window:this);
