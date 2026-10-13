const $ = id => document.getElementById(id);
const defaults = {age:36,retireAge:65,initial:10000,monthly:500,cash:200000,monthlyCash:4100,returnRate:4,inflation:2.5,fx:7.8,reviewEvery:1,increase:100,cap:2000,withdrawal:4,goal:2500};
const ids = Object.keys(defaults);
const fmtUSD = n => 'US$' + Math.round(n).toLocaleString('en-US');
const fmtHKD = n => 'HK$' + Math.round(n).toLocaleString('en-US');
const num = id => Number($(id).value) || 0;
let lastProjection = [];

function getSettings(){const s={};ids.forEach(id=>s[id]=num(id));return s}
function calculate(s){
  const years = Math.max(1, Math.min(90, Math.round(s.retireAge-s.age)));
  const monthlyRate = Math.pow(1+s.returnRate/100,1/12)-1;
  let balance=Math.max(0,s.initial), contributions=Math.max(0,s.initial), monthly=Math.max(0,s.monthly);
  const rows=[{age:s.age,year:0,monthly,annual:0,contributions, balance, real:balance}];
  let yearlyContribution=0;
  for(let m=1;m<=years*12;m++){
    balance *= (1+monthlyRate);
    balance += monthly;
    contributions += monthly;
    yearlyContribution += monthly;
    if(m%12===0){
      const y=m/12;
      rows.push({age:s.age+y,year:y,monthly,annual:yearlyContribution,contributions,balance,real:balance/Math.pow(1+s.inflation/100,y)});
      yearlyContribution=0;
      if(y%Math.max(1,s.reviewEvery)===0) monthly=Math.min(s.cap,monthly+Math.max(0,s.increase));
    }
  }
  const final=rows[rows.length-1];
  const growth=final.balance-final.contributions;
  const draw=final.balance*(s.withdrawal/100)/12;
  const goalFuture=s.goal*Math.pow(1+s.inflation/100,years);
  const needed=goalFuture*12/(s.withdrawal/100||0.000001);
  const projectedCash=Math.max(0,s.cash+s.monthlyCash*12*years);
  return {years,rows,final,contributions:final.contributions,growth,draw,goalFuture,needed,projectedCash};
}
function render(s,r){
  $('finalBalance').textContent=fmtUSD(r.final.balance);
  $('finalReal').textContent=`按今日購買力：約 ${fmtUSD(r.final.real)}（扣除通脹估算）`;
  $('contributed').textContent=fmtUSD(r.contributions);
  $('contribHKD').textContent=`約 ${fmtHKD(r.contributions*s.fx)}（包括初始本金）`;
  $('growth').textContent=fmtUSD(r.growth);
  $('monthlyDraw').textContent=fmtUSD(r.draw);
  $('monthlyDrawHKD').textContent=`約 ${fmtHKD(r.draw*s.fx)}／月`;
  $('goalFuture').textContent=fmtUSD(r.goalFuture)+'/月';
  $('neededBalance').textContent=fmtUSD(r.needed);
  const ratio=r.needed>0?r.final.balance/r.needed:1;
  $('goalStatus').textContent=ratio>=1?'接近／達到目標':`約 ${(ratio*100).toFixed(0)}%`;
  $('goalText').textContent=ratio>=1?'按目前假設，預計資產達到生活費目標所需金額。請記住回報及通脹都會變動。':'按目前假設，資產可能未達生活費目標。可考慮提高月供、延長工作年期或調整目標。';
  $('goalProgress').style.width=Math.min(100,ratio*100)+'%';
  $('cashNow').textContent=fmtHKD(s.cash);
  $('cashLater').textContent=fmtHKD(r.projectedCash);
  $('projectionRows').innerHTML=r.rows.filter((row,i)=>i===0||i===r.rows.length-1||row.age%5===0||row.year%s.reviewEvery===0).map(row=>`<tr><td>${row.age}</td><td>${fmtUSD(row.monthly)}</td><td>${fmtUSD(row.annual)}</td><td>${fmtUSD(row.contributions)}</td><td>${fmtUSD(row.balance)}</td><td>${fmtUSD(row.real)}</td></tr>`).join('');
  $('withdrawalRows').innerHTML=[3,4,5,6].map(rate=>{const value=r.final.balance*rate/100/12;return `<div class="withdrawal-row ${rate===s.withdrawal?'active':''}"><span class="rate">${rate}%</span><span>每月估算提取</span><strong>${fmtUSD(value)}<br><small>${fmtHKD(value*s.fx)}</small></strong></div>`}).join('');
  lastProjection=r.rows;
  drawChart(r.rows);
}
function drawChart(rows){
 const canvas=$('growthChart'); const rect=canvas.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
 canvas.width=Math.max(300,rect.width)*dpr;canvas.height=300*dpr;
 const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
 const w=canvas.width/dpr,h=canvas.height/dpr;
 const pad={l:66,r:14,t:20,b:32}; const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
 ctx.clearRect(0,0,w,h);
 const maxVal=Math.max(1,...rows.map(r=>r.balance))*1.08;
 ctx.font='10px DM Sans, sans-serif';ctx.textBaseline='middle';
 for(let i=0;i<=4;i++){const y=pad.t+ch*i/4;ctx.strokeStyle='#1b3046';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();const v=maxVal*(1-i/4);ctx.fillStyle='#8ea5bd';ctx.textAlign='right';ctx.fillText(v>=1000000?'$'+(v/1000000).toFixed(1)+'M':'$'+Math.round(v/1000)+'k',pad.l-8,y)}
 for(let i=0;i<=4;i++){const idx=Math.round((rows.length-1)*i/4);const x=pad.l+cw*i/4;ctx.fillStyle='#8ea5bd';ctx.textAlign='center';ctx.fillText(rows[idx].age,x,h-13)}
 const xAt=i=>pad.l+cw*i/(rows.length-1||1), yAt=v=>pad.t+ch*(1-v/maxVal);
 function line(key,color,width,dash=[]){ctx.beginPath();ctx.setLineDash(dash);ctx.strokeStyle=color;ctx.lineWidth=width;rows.forEach((r,i)=>i?ctx.lineTo(xAt(i),yAt(key(r))):ctx.moveTo(xAt(i),yAt(key(r))));ctx.stroke();ctx.setLineDash([])}
 ctx.beginPath();rows.forEach((r,i)=>i?ctx.lineTo(xAt(i),yAt(r.balance)):ctx.moveTo(xAt(i),yAt(r.balance)));ctx.lineTo(xAt(rows.length-1),pad.t+ch);ctx.lineTo(xAt(0),pad.t+ch);ctx.closePath();const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);grad.addColorStop(0,'#318fff44');grad.addColorStop(1,'#318fff00');ctx.fillStyle=grad;ctx.fill();
 line(r=>r.balance,'#59a9ff',2.5);line(r=>r.contributions,'#8ea5bd',1.5,[5,5]);
 rows.forEach((r,i)=>{if(i===rows.length-1){ctx.beginPath();ctx.arc(xAt(i),yAt(r.balance),3.5,0,Math.PI*2);ctx.fillStyle='#59a9ff';ctx.fill()}});
}
function update(){const s=getSettings();if(s.retireAge<=s.age){$('retireAge').value=s.age+1; s.retireAge=s.age+1}const r=calculate(s);render(s,r)}
$('settingsForm').addEventListener('submit',e=>{e.preventDefault();update()});
$('resetBtn').addEventListener('click',()=>{ids.forEach(id=>$(id).value=defaults[id]);update()});
$('downloadCsv').addEventListener('click',()=>{
 const header=['age','year','monthly_contribution_usd','annual_contribution_usd','cumulative_contributions_usd','projected_balance_usd','balance_in_today_usd'];
 const lines=[header.join(','),...lastProjection.map(r=>[r.age,r.year,r.monthly.toFixed(2),r.annual.toFixed(2),r.contributions.toFixed(2),r.balance.toFixed(2),r.real.toFixed(2)].join(','))];
 const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='retirement-projection.csv';a.click();URL.revokeObjectURL(url);
});
window.addEventListener('resize',()=>drawChart(lastProjection));
update();