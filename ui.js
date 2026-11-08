const $=id=>document.getElementById(id),key='overlay-ledger-v1';
const demo={W:'1000',H:'600',T:'60',q:'50',
areas:'字幕带,100,500,800,80\n台标,40,40,120,60\n人物框,400,150,240,260',
overlays:'贴片广告,200,470,300,130,10,20\n底部横条,0,580,1000,20,15,25\n角标水印,40,40,120,60,5,12\n中央弹窗,400,150,240,260,30,45'};
let current=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=n=>(Math.round(n*10)/10).toFixed(1).replace(/\.0$/,'');
const num=n=>n.toLocaleString('zh-CN');
const input=()=>({W:$('W').value,H:$('H').value,T:$('T').value,q:$('q').value,areas:$('areas').value,overlays:$('overlays').value});
function set(v){for(const id of ['W','H','T','q','areas','overlays'])$(id).value=v[id]??'';render()}
function svg(r){const w=560,h=Math.round(560*r.H/r.W),sx=w/r.W,sy=h/r.H;
  const colors=['#6d9ac9','#77ab92','#c2936a','#9b83bd','#bd7f8e','#6aa5ad'];
  let out=`<svg id="svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="画面比例示意图：受保护区域与贴片"><rect x="0" y="0" width="${w}" height="${h}" fill="#f8fbff"/>`;
  r.areas.forEach((p,i)=>{out+=`<rect x="${p.x*sx}" y="${p.y*sy}" width="${p.w*sx}" height="${p.h*sy}" fill="${colors[i%colors.length]}" fill-opacity=".22" stroke="${colors[i%colors.length]}" stroke-width="2"/><text x="${p.x*sx+5}" y="${p.y*sy+15}" font-size="11" fill="#2a4668">${esc(p.name)}</text>`});
  r.overlays.forEach((o,i)=>{out+=`<rect x="${o.x*sx}" y="${o.y*sy}" width="${o.w*sx}" height="${o.h*sy}" fill="#d9795c" fill-opacity=".3" stroke="#c25a3d" stroke-width="1.5" stroke-dasharray="5 3"/><text x="${o.x*sx+5}" y="${o.y*sy+o.h*sy-6}" font-size="10" fill="#9c4227">${esc(o.name)}</text>`});
  return out+'</svg>';
}
function render(){current=null;$('error').textContent='';
  try{const r=AppCore.solve(input());current=r;
    const timeline=r.segments.map(s=>{const hit=r.regions.some((g,j)=>g.per[r.segments.indexOf(s)].covered>0);return `<i class="${hit?'hit':'safe'}" style="width:${(s.dur/r.T*100).toFixed(3)}%" title="${s.u}–${s.v}秒 ${hit?'有遮挡':'无遮挡'}"></i>`}).join('');
    $('result').innerHTML=`<div class="eyebrow">当前输入下的对账结论</div>
      <div class="metric ${r.anyFatal?'bad':'good'}">${r.anyFatal?'存在致命遮挡':'未达到致命阈值'}</div>
      <div class="hint">画面 ${r.W}×${r.H} px · 核查 ${r.T} 秒 · 致命阈值 ${r.q}% · 致命贴片 ${r.fatalCount} 个 · 安全时段 ${r.safe} 秒</div>
      <div class="stats"><div><strong>${r.regions.length}</strong><span>受保护区域</span></div><div><strong>${r.overlays.length}</strong><span>贴片</span></div><div><strong>${r.segments.length}</strong><span>时间分段</span></div><div><strong>${r.blockedTime}</strong><span>被挡时段 / 秒</span></div></div>
      <div class="bar" aria-label="时间轴：绿色为无遮挡，橙色为有遮挡">${timeline}</div><div class="legend">左起 0 秒，右至 ${r.T} 秒；绿=无任何受保护区域被挡，橙=至少一处被挡。半开区间，边界相接不计遮挡。</div>
      <div class="notice">${r.anyFatal?'点击各贴片的「采用移位」可改写坐标并立即重算；无可行位置会明确标注。':'没有区域达到致命阈值，仍可查看逐块明细与最小移位。'}这里只回答几何覆盖，不判断广告合规或观感。</div>
      ${svg(r)}
      <h2 style="margin-top:26px">逐区域对账</h2><div class="scroll"><table class="stack"><thead><tr><th>区域</th><th>峰值被挡 / px²</th><th>峰值占比</th><th>被挡时长 / 秒</th><th>区域·秒</th><th>最长连续 / 秒</th><th>判定</th></tr></thead><tbody>${r.regions.map(g=>`<tr><td data-label="区域">${esc(g.name)}</td><td data-label="峰值被挡">${num(g.peak)} / ${num(g.area)}</td><td data-label="峰值占比">${pct(g.peakPct)}%</td><td data-label="被挡时长">${g.blocked} 秒</td><td data-label="区域·秒">${num(g.areaSec)}</td><td data-label="最长连续">${g.longest} 秒</td><td data-label="判定" class="${g.fatal?'bad':'good'}">${g.fatal?'致命':'未达阈值'}</td></tr>`).join('')}</tbody></table></div>
      <h2 style="margin-top:26px">逐贴片冲突与最小移位</h2>
      ${r.conflicts.map((c,i)=>{const s=c.shift;return `<article class="card ${c.fatal?'fatal':''}"><h3>${esc(c.name)} ${c.fatal?'<span class="tag fatal">致命</span>':'<span class="tag">未达阈值</span>'}</h3>
        <p class="num">矩形 (${c.x}, ${c.y}, ${c.w}×${c.h}) · ${c.t0}–${c.t1} 秒 · 持续 ${c.duration} 秒</p>
        <p>${c.regionHits.length?c.regionHits.map(h=>'挡住「'+esc(h.region)+'」'+num(h.area)+' px²（'+pct(h.pct)+'%），独立区域·秒 '+num(h.area*c.duration)).join('；'):'未与任何受保护区域相交（含仅边界相接）'}。</p>
        <p class="num"><strong>最小移位：</strong>${s?`(${s.dx||0}, ${s.dy||0})，代价 |dx|+|dy| = ${s.cost} px${s.cost===0?'（原位即不冲突）':''}`:'<span class="bad">画面内无可行位置（受保护区域已占满可用空间）</span>'}</p>
        ${s&&s.cost>0?`<button data-apply="${i}">采用移位 (${s.dx||0}, ${s.dy||0}) 并重算</button>`:''}</article>`}).join('')}
      <h2 style="margin-top:26px">时间分段明细</h2><div class="scroll"><table class="stack"><thead><tr><th>区间 / 秒</th><th>时长</th><th>活跃贴片</th><th>各区域被挡面积 / px²</th></tr></thead><tbody>${r.segments.map((s,i)=>`<tr><td data-label="区间">${s.u} – ${s.v}</td><td data-label="时长">${s.dur} 秒</td><td data-label="活跃贴片">${s.active.length?esc(s.active.join('、')):'—'}</td><td data-label="各区域被挡面积">${r.regions.map(g=>`<div class="seg">${esc(g.name)}: ${num(g.per[i].covered)}</div>`).join('')}</td></tr>`).join('')}</tbody></table></div>`;
    document.querySelectorAll('[data-apply]').forEach(b=>b.onclick=()=>{const c=r.conflicts[+b.dataset.apply],s=c.shift;if(!s)return;const lines=$('overlays').value.replace(/\r/g,'').trim().split('\n');const p=lines[+b.dataset.apply].split(/[,，\t]/).map(t=>t.trim());p[1]=String(c.x+s.dx);p[2]=String(c.y+s.dy);lines[+b.dataset.apply]=p.join(',');$('overlays').value=lines.join('\n');$('message').textContent='已采用 '+c.name+' 的最小移位 ('+(s.dx||0)+', '+(s.dy||0)+')，结果已重算。';render()});
  }catch(e){$('result').innerHTML='';$('error').textContent=e.message}
  for(const id of ['save','backup','md','png','csv'])$(id).disabled=!current;
}
for(const id of ['W','H','T','q','areas','overlays'])$(id).addEventListener('input',render);
$('demo').onclick=()=>{set(demo);$('message').textContent='已载入虚构示例。'};
$('more').onclick=()=>{$('q').value='38';render();$('message').textContent='致命阈值改为 38%：字幕带峰值 37.5% 由致命变为未达阈值。'};
$('full').onclick=()=>{set({...demo,W:'10',H:'10',T:'5',q:'50',areas:'整屏,0,0,10,10',overlays:'贴片,0,0,2,2,0,5'});$('message').textContent='无解试算：整屏都是受保护区域，画面内没有可放贴片的位置。'};
$('save').onclick=()=>{try{localStorage.setItem(key,JSON.stringify(input()));$('message').textContent='已保存；刷新将恢复此版本。'}catch(e){$('message').textContent='保存失败，请下载备份。'}};
function restore(){try{const s=localStorage.getItem(key);if(!s){$('message').textContent='尚无本机保存';return}const v=JSON.parse(s);AppCore.solve(v);set(v);$('message').textContent='已恢复本机保存'}catch(e){$('message').textContent='保存内容无法读取：'+e.message}}
$('restore').onclick=restore;
function dl(name,data,type){const b=data instanceof Blob?data:new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('message').textContent='已请求下载：'+name}
$('backup').onclick=()=>dl('遮挡对账-备份.json',JSON.stringify({version:1,input:input()},null,2),'application/json');
$('import').onclick=()=>$('imports').click();
$('imports').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('备份超过100KB');const v=JSON.parse(await file.text());if(v.version!==1||!v.input)throw Error('备份格式不正确');AppCore.solve(v.input);set(v.input);$('message').textContent='已导入备份，未覆盖本机保存'}catch(err){$('message').textContent='导入失败：'+err.message}finally{$('imports').value=''}};
const cell=x=>'"'+String(x).replace(/^([=+@-])/,"'$1").replace(/"/g,'""')+'"';
$('csv').onclick=()=>{const r=current,rows=[['类型','名称','x','y','宽','高','起始秒','结束秒','区域面积','峰值被挡面积','峰值占比%','被挡时长秒','区域·秒','最长连续秒','致命'],
 ...r.regions.map(g=>['区域',g.name,g.x,g.y,g.w,g.h,'','',g.area,g.peak,pct(g.peakPct),g.blocked,g.areaSec,g.longest,g.fatal?'是':'否']),
 ...r.conflicts.map(c=>['贴片',c.name,c.x,c.y,c.w,c.h,c.t0,c.t1,'',c.regionHits.reduce((n,h)=>n+h.area,0),pct(c.regionHits.reduce((n,h)=>n+h.pct,0)),c.duration,c.areaSec,'',c.fatal?'是':'否']),
 ...r.segments.map((s,i)=>['时段',s.u+'–'+s.v+'秒','','','','','','','','',r.regions.map(g=>g.per[i].covered).join('/'),s.dur,'','',r.regions.some(g=>g.per[i].covered>0)?'有遮挡':'无遮挡'])];
 dl('遮挡对账-明细.csv','\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8')};
function report(){const r=current;return '# 遮挡对账台\n\n画面 '+r.W+'×'+r.H+' px，核查 '+r.T+' 秒，致命阈值 '+r.q+'%。\n'+
 (r.anyFatal?'结论：存在致命遮挡，致命贴片 '+r.fatalCount+' 个。':'结论：没有区域达到致命阈值。')+' 安全时段 '+r.safe+' 秒，被挡时段 '+r.blockedTime+' 秒。\n\n'+
 '## 逐区域\n'+r.regions.map(g=>'- '+g.name+'：面积 '+g.area+' px²，峰值被挡 '+g.peak+' px²（'+pct(g.peakPct)+'%），被挡 '+g.blocked+' 秒，区域·秒 '+g.areaSec+'，最长连续 '+g.longest+' 秒，'+(g.fatal?'致命':'未达阈值')).join('\n')+'\n\n'+
 '## 逐贴片\n'+r.conflicts.map(c=>'- '+c.name+'：('+c.x+', '+c.y+', '+c.w+'×'+c.h+')，'+c.t0+'–'+c.t1+' 秒；'+(c.regionHits.length?c.regionHits.map(h=>'挡住 '+h.region+' '+h.area+' px²（'+pct(h.pct)+'%）.').join(''):'未与受保护区域相交。')+' 最小移位 '+(c.shift?'('+(c.shift.dx||0)+', '+(c.shift.dy||0)+')，代价 '+c.shift.cost+' px':'画面内无可行位置')).join('\n')+'\n\n'+
 '## 时间分段\n'+r.segments.map((s,i)=>'- '+s.u+'–'+s.v+' 秒（'+s.dur+'秒）：活跃 '+(s.active.join('、')||'无')+'；各区域被挡 '+r.regions.map(g=>g.name+'='+g.per[i].covered).join(' / ')).join('\n')+'\n\n'+
 '几何模型：轴对齐不透明矩形、半开区间、矩形并集面积按坐标压缩求，逐段积分。只回答用户手工指定区域的几何覆盖；不识别画面内容，不处理半透明/旋转/运动，不判断广告合规或观感。数据为虚构示例，计算在本机完成，未上传。';}
$('md').onclick=()=>dl('遮挡对账-说明.md',report(),'text/markdown;charset=utf-8');
$('png').onclick=()=>{const r=current,c=document.createElement('canvas');c.width=1080;c.height=1350;const g=c.getContext('2d');
 g.fillStyle='#f1f5fa';g.fillRect(0,0,1080,1350);g.fillStyle='#22344e';g.font='bold 54px sans-serif';g.fillText('遮挡对账台',60,100);
 g.font='26px sans-serif';g.fillStyle='#5a6d84';g.fillText('画面 '+r.W+'×'+r.H+' px · 核查 '+r.T+' 秒 · 致命阈值 '+r.q+'%',60,155);
 g.font='bold 42px sans-serif';g.fillStyle=r.anyFatal?'#a23b28':'#2b6b4f';g.fillText(r.anyFatal?'存在致命遮挡':'未达到致命阈值',60,235);
 g.font='25px sans-serif';g.fillStyle='#22344e';g.fillText('致命贴片 '+r.fatalCount+' 个 · 安全时段 '+r.safe+' 秒 · 被挡时段 '+r.blockedTime+' 秒',60,290);
 // 画面比例示意图
 const bw=940,bh=Math.min(330,Math.round(bw*r.H/r.W)),bx=60,by=340,sx=bw/r.W,sy=bh/r.H;
 g.fillStyle='#ffffff';g.fillRect(bx,by,bw,bh);g.strokeStyle='#c9d7e6';g.lineWidth=2;g.strokeRect(bx,by,bw,bh);
 const colors=['#6d9ac9','#77ab92','#c2936a','#9b83bd','#bd7f8e','#6aa5ad'];
 r.areas.forEach((p,i)=>{g.fillStyle=colors[i%colors.length]+'44';g.fillRect(bx+p.x*sx,by+p.y*sy,p.w*sx,p.h*sy);g.strokeStyle=colors[i%colors.length];g.lineWidth=2;g.strokeRect(bx+p.x*sx,by+p.y*sy,p.w*sx,p.h*sy);g.fillStyle='#2a4668';g.font='18px sans-serif';g.fillText(p.name,bx+p.x*sx+6,by+p.y*sy+22)});
 r.overlays.forEach(o=>{g.fillStyle='#d9795c44';g.fillRect(bx+o.x*sx,by+o.y*sy,o.w*sx,o.h*sy);g.strokeStyle='#c25a3d';g.lineWidth=2;g.strokeRect(bx+o.x*sx,by+o.y*sy,o.w*sx,o.h*sy)});
 // 时间轴
 let ty=by+bh+40;g.fillStyle='#5a6d84';g.font='22px sans-serif';g.fillText('时间轴（绿=无遮挡，橙=至少一处被挡）',60,ty);
 let tx=60;r.segments.forEach((s,i)=>{const w=bw*s.dur/r.T,hit=r.regions.some(g2=>g2.per[i].covered>0);g.fillStyle=hit?'#d98a70':'#6aa58a';g.fillRect(tx,ty+16,w,26);tx+=w});
 // 区域表
 let ry=ty+110;g.fillStyle='#22344e';g.font='bold 28px sans-serif';g.fillText('逐区域对账',60,ry);g.font='22px sans-serif';
 r.regions.forEach((p,i)=>{const y=ry+45+i*46;g.fillStyle=p.fatal?'#a23b28':'#22344e';g.fillText((p.fatal?'● ':'○ ')+p.name+'：峰值 '+num(p.peak)+' / '+num(p.area)+' px²（'+pct(p.peakPct)+'%）· 被挡 '+p.blocked+' 秒 · 最长 '+p.longest+' 秒',60,y)});
 // 移位
 let sy2=ry+45+r.regions.length*46+50;g.fillStyle='#22344e';g.font='bold 28px sans-serif';g.fillText('逐贴片最小移位',60,sy2);g.font='21px sans-serif';
 r.conflicts.forEach((o,i)=>{const y=sy2+42+i*40;g.fillStyle=o.fatal?'#a23b28':'#22344e';g.fillText('· '+o.name+'：'+o.t0+'–'+o.t1+' 秒，'+(o.shift?'移位 ('+(o.shift.dx||0)+', '+(o.shift.dy||0)+')，代价 '+o.shift.cost+' px':'画面内无可行位置'),60,y)});
 g.fillStyle='#63738a';g.font='19px sans-serif';g.fillText('几何并集面积 × 时间分段积分；只回答手工指定区域的覆盖，不判断合规或观感。',60,1300);g.fillText('默认数据为虚构示例；计算在本机完成，未上传输入。V1.0.0',60,1330);
 c.toBlob(b=>{if(b)dl('遮挡对账-结果卡.png',b,'image/png')})};
set(demo);restore();
