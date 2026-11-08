const {test}=require('node:test'),assert=require('node:assert/strict'),{solve,unionArea,overlap,minShift}=require('../core.js');
const demo={W:1000,H:600,T:60,q:50,
areas:'字幕带,100,500,800,80\n台标,40,40,120,60\n人物框,400,150,240,260',
overlays:'贴片广告,200,470,300,130,10,20\n底部横条,0,580,1000,20,15,25\n角标水印,40,40,120,60,5,12\n中央弹窗,400,150,240,260,30,45'};
const A=(r,i)=>r.regions[i];
test('default scenario: exact anchors, timeline cuts, boundary-touch zero overlap',()=>{let r=solve(demo);
  assert.equal(r.W,1000);assert.equal(r.H,600);assert.equal(r.T,60);assert.equal(r.q,50);
  assert.deepEqual(r.segments.map(s=>[s.u,s.v,s.active]),[[0,5,[]],[5,10,['角标水印']],[10,12,['贴片广告','角标水印']],[12,15,['贴片广告']],[15,20,['贴片广告','底部横条']],[20,25,['底部横条']],[25,30,[]],[30,45,['中央弹窗']],[45,60,[]]]);
  assert.deepEqual(A(r,0).per.map(s=>s.covered),[0,0,24000,24000,24000,0,0,0,0]);
  assert.equal(A(r,0).area,64000);assert.equal(A(r,0).peak,24000);assert.equal(A(r,0).peakPct,37.5);assert.equal(A(r,0).blocked,10);assert.equal(A(r,0).areaSec,240000);assert.equal(A(r,0).longest,10);assert.equal(A(r,0).fatal,false);
  assert.equal(A(r,1).peak,7200);assert.equal(A(r,1).blocked,7);assert.equal(A(r,1).areaSec,50400);assert.equal(A(r,1).fatal,true);
  assert.equal(A(r,2).peak,62400);assert.equal(A(r,2).blocked,15);assert.equal(A(r,2).areaSec,936000);assert.equal(A(r,2).fatal,true);
  assert.equal(r.safe,30);assert.equal(r.blockedTime,30);assert.equal(r.fatalCount,2);assert.equal(r.anyFatal,true);
  assert.deepEqual(r.conflicts[1].regionHits,[]); // 底部横条 y1=600，字幕带 y1=580，仅边界相接
  assert.deepEqual(r.conflicts.map(c=>c.shift&&[c.shift.dx,c.shift.dy,c.shift.cost]),[[-100,-100,200],[0,0,0],[0,60,60],[-240,0,240]]);
});
test('threshold sides, q=0/100, and no false fatal on empty coverage',()=>{
  assert.equal(solve({...demo,q:37}).regions[0].fatal,true);   // 24000/64000=37.5%
  assert.equal(solve({...demo,q:38}).regions[0].fatal,false);
  let z=solve({...demo,q:0});assert.equal(z.regions.every(g=>g.fatal),true);assert.equal(z.fatalCount,3); // 底部横条无交面积，不计致命
  let o=solve({...demo,q:100});assert.equal(o.regions[1].fatal,true);assert.equal(o.regions[2].fatal,true);assert.equal(o.regions[0].fatal,false);
  let clean=solve({...demo,overlays:'空贴片,0,0,10,10,0,5'});assert.equal(clean.anyFatal,false);assert.equal(clean.safe,60);assert.equal(clean.blockedTime,0); // 无受保护区域被挡 → 安全时段为全时段
  assert.equal(clean.regions.every(g=>g.peak===0&&g.blocked===0&&g.areaSec===0),true);
});
test('union area by independent pixel enumeration, overlapping overlays not double counted',()=>{
  let seed=7;const rand=n=>(seed=(seed*1664525+1013904223)>>>0)%n;
  for(let c=0;c<300;c++){
    const W=12,H=10,rects=[];
    for(let k=0;k<1+rand(4);k++){const x=rand(W),y=rand(H),w=1+rand(W-x),h=1+rand(H-y);rects.push({x,y,x1:x+w,y1:y+h,w,h,area:w*h});}
    let px=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(rects.some(r=>x>=r.x&&x<r.x1&&y>=r.y&&y<r.y1))px++;
    assert.equal(unionArea(rects),px,'pixel union mismatch case '+c);
  }
  // 两个贴片在同一区域完全重叠：区域峰值应是并集而非求和
  const p={x:0,y:0,w:10,h:10,x1:10,y1:10,area:100};
  const a={x:0,y:0,w:6,h:10,x1:6,y1:10,area:60},b={x:2,y:0,w:6,h:10,x1:8,y1:10,area:60};
  assert.equal(unionArea([overlap(p,a),overlap(p,b)]),80);
  let dup=solve({W:100,H:100,T:10,q:50,areas:'保护框,0,0,10,10',overlays:'甲,0,0,6,10,0,5\n乙,2,0,6,10,0,5'});
  assert.equal(dup.regions[0].peak,80); // 并集 [0,8)×[0,10)=80，而非 60+60=120
  assert.equal(dup.regions[0].areaSec,80*5);
});
test('union area on integer geometry and empty set',()=>{
  assert.equal(unionArea([]),0);
  assert.equal(unionArea([{x:0,y:0,x1:100,y1:100}]),10000);
  assert.equal(unionArea([{x:0,y:0,x1:100,y1:100},{x:20,y:20,x1:80,y1:80}]),10000);
  assert.equal(overlap({x:0,y:0,x1:10,y1:10},{x:10,y:0,x1:20,y1:10}),null);
});
test('minShift exactness vs 300 independent full-canvas brute-force scenes',()=>{
  let seed=99;const rand=n=>(seed=(seed*1664525+1013904223)>>>0)%n;
  for(let c=0;c<300;c++){
    const W=6+rand(6),H=6+rand(6);
    const ow=1+rand(3),oh=1+rand(3),ox=rand(W-ow+1),oy=rand(H-oh+1);
    const o={name:'o',x:ox,y:oy,w:ow,h:oh,x1:ox+ow,y1:oy+oh,area:ow*oh};
    const areas=[];const n=1+rand(3);
    for(let i=0;i<n;i++){const w=1+rand(3),h=1+rand(3),x=rand(W-w+1),y=rand(H-h+1);areas.push({name:'p'+i,x,y,w,h,x1:x+w,y1:y+h,area:w*h});}
    let best=null;
    for(let dy=-oy;dy<=H-oy-oh;dy++)for(let dx=-ox;dx<=W-ox-ow;dx++){
      const moved={x:ox+dx,y:oy+dy,x1:ox+dx+ow,y1:oy+dy+oh,w:ow,h:oh};
      if(areas.some(p=>overlap(p,moved)))continue;
      const cand={dx,dy,cost:Math.abs(dx)+Math.abs(dy),max:Math.max(Math.abs(dx),Math.abs(dy))};
      if(!best||cand.cost<best.cost||(cand.cost===best.cost&&(cand.max<best.max||(cand.max===best.max&&(dx<best.dx||(dx===best.dx&&dy<best.dy))))))best=cand;
    }
    const got=minShift(o,areas,W,H);
    if(!best){assert.equal(got,null,'expected infeasible case '+c)}
    else{assert.ok(got,'expected feasible case '+c);assert.deepEqual([got.dx||0,got.dy||0,got.cost,got.max],[best.dx||0,best.dy||0,best.cost,best.max],'case '+c+' W='+W+' H='+H+' o='+JSON.stringify([ox,oy,ow,oh]));}
  }
});
test('minShift infeasible when protected areas fill the canvas, and tie-break is deterministic',()=>{
  let full=solve({W:10,H:10,T:5,q:50,areas:'整屏,0,0,10,10',overlays:'贴片,0,0,2,2,0,5'});
  assert.equal(full.conflicts[0].shift,null);
  assert.equal(full.regions[0].peak,4);assert.equal(full.regions[0].fatal,false);
  const o={x:5,y:5,w:2,h:2,x1:7,y1:7,area:4};
  const s=minShift(o,[{x:5,y:0,w:2,h:10,x1:7,y1:10,area:20}],10,10);
  assert.deepEqual([s.dx||0,s.dy||0,s.cost,s.max],[-2,0,2,2]); // 左移2或右移2，先比 max 再比 dx，取较小 dx
});
test('input validation: ranges, units, duplicates, boundaries, 12-row limits',()=>{
  const bad=[
    {W:0},{W:4097},{H:0},{T:0},{T:3601},{q:-1},{q:101},{W:1.5},{q:'abc'},{W:' 100 '},
    {areas:''},{areas:'A,0,0,1001,10'},{areas:'A,0,0,10,601'},{areas:'A,10,10,0,10'},{areas:'A,10,10,10,0'},
    {areas:'A,0,0,10,10\nA,0,0,10,10'},{areas:'A,B,10,10'},{areas:'A,0,0,10,10,99'},
    {areas:'A,0,0,10,10\nB,0,0,10,10\nC,0,0,10,10\nD,0,0,10,10\nE,0,0,10,10\nF,0,0,10,10\nG,0,0,10,10\nH,0,0,10,10\nI,0,0,10,10\nJ,0,0,10,10\nK,0,0,10,10\nL,0,0,10,10\nM,0,0,10,10'},
    {overlays:''},{overlays:'X,0,0,10,10,5,5'},{overlays:'X,0,0,10,10,10,5'},{overlays:'X,0,0,10,10,0,61'},{overlays:'X,0,0,1001,10,0,5'},
    {overlays:'X,0,0,10,10,0,5\nX,1,1,10,10,0,5'},{overlays:'X,0,0,10,10,0'},
    {areas:'名称超过二十四个字abcdefghijklmnopqrstuvwx,0,0,10,10'},
    {areas:'含,逗号,0,0,10,10'},
  ];
  for(const patch of bad)assert.throws(()=>solve({...demo,...patch}),undefined,JSON.stringify(patch));
  assert.equal(solve({...demo,W:' 1000 ',q:' 50 '}).W,1000);
  // 12 行合法上限
  const rows=n=>Array.from({length:n},(_,i)=>'N'+i+',0,'+(i*10)+',10,10').join('\n');
  assert.equal(solve({W:1000,H:600,T:60,q:50,areas:rows(12),overlays:'X,0,0,10,10,0,5'}).areas.length,12);
  assert.equal(solve({W:1000,H:600,T:60,q:50,areas:'A,0,0,10,10',overlays:Array.from({length:12},(_,i)=>'X'+i+',0,0,10,10,0,'+(i+1)).join('\n')}).overlays.length,12);
});
test('adopt-shift recomputes to a clean frame and timeline integral is conserved',()=>{
  let r=solve(demo);
  const applied=r.conflicts.map(c=>{const s=c.shift||{dx:0,dy:0};return [c.name,c.x+s.dx,c.y+s.dy,c.w,c.h,c.t0,c.t1].join(',')}).join('\n');
  let r2=solve({...demo,overlays:applied});
  assert.equal(r2.anyFatal,false);assert.equal(r2.fatalCount,0);assert.equal(r2.regions.every(g=>g.peak===0),true);
  assert.equal(r2.safe,60);assert.equal(r2.blockedTime,0);
  // 每段时长之和 = T；逐段区域·秒之和 = 汇总 areaSec
  for(const x of [r,r2]){assert.equal(x.segments.reduce((n,s)=>n+s.dur,0),x.T);for(const g of x.regions)assert.equal(g.per.reduce((n,s)=>n+s.covered*s.dur,0),g.areaSec);assert.equal(x.safe+x.blockedTime,x.T);}
});
