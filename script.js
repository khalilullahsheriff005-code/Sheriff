pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const fileInput=document.getElementById('file-input'),drop=document.getElementById('drop-zone'),err=document.getElementById('error-msg'),load=document.getElementById('loader'),res=document.getElementById('result');
let lastData=null;
function toggleTheme(){document.body.classList.toggle('dark');document.getElementById('theme-btn').textContent=document.body.classList.contains('dark')?'☀️':'🌙';}
drop.addEventListener('click',()=>fileInput.click());
drop.addEventListener('dragover',e=>{e.preventDefault();drop.style.borderColor='#7c3aed'});
drop.addEventListener('dragleave',()=>drop.style.borderColor='#cbd5e1');
drop.addEventListener('drop',e=>{e.preventDefault();handle(e.dataTransfer.files[0])});
fileInput.addEventListener('change',e=>handle(e.target.files[0]));
function showErr(m){err.innerHTML=m;err.classList.remove('hidden');load.classList.add('hidden');res.classList.add('hidden');fileInput.value='';}
async function getText(file){const buf=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument(buf).promise;let t='';for(let i=1;i<=Math.min(pdf.numPages,6);i++){const p=await pdf.getPage(i);const c=await p.getTextContent();t+=c.items.map(x=>x.str).join(' ')+' ';}return {text:t,pages:pdf.numPages};}
async function handle(file){
 if(!file)return;if(!file.name.toLowerCase().endsWith('.pdf')){showErr('❌ Only PDF!');return;}if(file.size>5*1024*1024){showErr('❌ Max 5MB!');return;}
 err.classList.add('hidden');load.classList.remove('hidden');res.classList.add('hidden');
 const start=performance.now();
 try{
  const {text:raw,pages}=await getText(file);const lower=raw.toLowerCase();const words=raw.trim().split(/\s+/).filter(w=>w.length>1);const wc=words.length;
  const nonResume=['marksheet','mark sheet','grade card','statement of marks','semester','hall ticket','transcript','bonafide','transfer certificate','aadhar','pan card','invoice','receipt'];
  const foundNon=nonResume.filter(k=>lower.includes(k));
  const signals={skills:lower.includes('skill'),exp:lower.includes('experience'),edu:lower.includes('education')||lower.includes('bachelor')||lower.includes('university'),proj:lower.includes('project'),email:/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(lower),obj:lower.includes('objective')||lower.includes('summary')};
  const sCount=Object.values(signals).filter(Boolean).length;
  if(foundNon.length>=1&&sCount<4){showErr('❌ <b>RESUME ONLY ALLOWED!</b><br>Detected: '+foundNon[0].toUpperCase()+'<br>Upload RESUME only');return;}
  if(sCount<3){showErr('❌ <b>RESUME ONLY!</b><br>Need 3 of: Skills, Experience, Education, Projects, Email<br>You have '+sCount);return;}
  if(wc<60){showErr('❌ Too short! '+wc+' words');return;}

  let score=0,checks=[],tips=[];
  const hasEmail=signals.email,hasPhone=/\b\d{10}\b/.test(lower),hasLinkedIn=lower.includes('linkedin');
  let cPts=(hasEmail?7:0)+(hasPhone?4:0)+(hasLinkedIn?4:0);score+=cPts;checks.push({s:cPts>=11?'ok':cPts>=7?'warn':'bad',t:'Contact',d:hasEmail&&hasPhone?'Email+Phone':'Missing contact'});
  let sPts=sCount*4;if(sCount>=5)sPts=20;score+=sPts;checks.push({s:sCount>=4?'ok':'warn',t:'Sections',d:sCount+'/6 sections'});
  const tech=['javascript','python','java','react','node','sql','aws','html','css','git','api','mongodb','typescript','docker','kubernetes','angular','vue','next.js'];
  const foundTech=[...new Set(tech.filter(k=>lower.includes(k)))];let kPts=foundTech.length>=5?15:foundTech.length>=3?8:foundTech.length>=1?4:0;score+=kPts;checks.push({s:foundTech.length>=4?'ok':foundTech.length>=2?'warn':'bad',t:'Keywords',d:foundTech.length+' keywords'});
  const verbs=['developed','built','created','led','managed','designed','implemented','optimized'];const foundVerbs=verbs.filter(v=>lower.includes(v));let vPts=foundVerbs.length>=3?10:foundVerbs.length>=1?5:0;score+=vPts;checks.push({s:foundVerbs.length>=3?'ok':'warn',t:'Action Verbs',d:foundVerbs.length+' verbs'});
  let mPts=/\b\d+%\b/.test(raw)||/\d+\+/.test(raw)?10:0;score+=mPts;checks.push({s:mPts?'ok':'bad',t:'Metrics',d:mPts?'Numbers found':'Add metrics'});
  let lPts=wc>=300&&wc<=650?10:wc>=200?7:wc>=120?4:0;score+=lPts;checks.push({s:lPts>=7?'ok':'warn',t:'Length',d:wc+' words'});
  let fPts=!lower.includes('lorem ipsum')?5:0;score+=fPts;checks.push({s:fPts?'ok':'bad',t:'Quality',d:fPts?'Original':'Dummy'});
  let uniq=new Set(words.map(w=>w.toLowerCase())).size;let ratio=wc?uniq/wc:0;score+=ratio>0.5?5:3;score+=pages<=2?3:1;
  if(wc<150&&score>45)score=45;if(wc<250&&score>70)score=70;if(score>93)score=93;

  // JD MATCHING
  const jdText=document.getElementById('jd-input').value.toLowerCase();
  let jdMatch=null;
  if(jdText.length>20){
    const jdWords=jdText.split(/\W+/).filter(w=>w.length>3);
    const jdKeywords=[...new Set(jdWords)].slice(0,30);
    const matched=jdKeywords.filter(k=>lower.includes(k));
    const missing=jdKeywords.filter(k=>!lower.includes(k)).slice(0,8);
    const matchPct=Math.round((matched.length/jdKeywords.length)*100);
    jdMatch={pct:matchPct,matched,missing};
    if(matchPct>=70)score=Math.min(93,score+5);
    else if(matchPct<30)score=Math.max(10,score-5);
  }

  lastData={file:file.name,wc,pages,score,checks,jdMatch,raw:raw.slice(0,500),time:Math.round(performance.now()-start)};

  // Save history
  const hist=JSON.parse(localStorage.getItem('resuqora_hist')||'[]');hist.unshift({name:file.name,score,date:new Date().toLocaleDateString()});localStorage.setItem('resuqora_hist',JSON.stringify(hist.slice(0,3)));

  finalShow(lastData,start,jdMatch);
 }catch(e){console.error(e);showErr('❌ Cannot read PDF. Text-based resume only.');}
}
function finalShow(data,start,jdMatch){
 load.classList.add('hidden');res.classList.remove('hidden');
 document.getElementById('score').textContent=data.score+'%';
 document.getElementById('file-name').textContent=data.file;
 document.getElementById('score-title').textContent=data.score>=80?'Excellent! 🔥':data.score>=65?'Good! 👍':data.score>=50?'Average':'Weak';
 document.getElementById('score-sub').textContent=data.score>=80?'Top 15% ATS Ready':data.score>=65?'Fix 2 issues':'Needs improvement';
 document.getElementById('time').textContent=data.time+'ms';
 document.getElementById('words').textContent=data.wc;
 document.getElementById('jd-match-stat').innerHTML=jdMatch?` • 🎯 <b>${jdMatch.pct}% JD Match</b>`:'';
 const bar=document.getElementById('bar');bar.style.strokeDashoffset=326-(326*data.score/100);bar.style.stroke=data.score>=70?'#22c55e':data.score>=50?'#f59e0b':'#ef4444';
 document.getElementById('checks').innerHTML=data.checks.map(c=>`<div class="ck ${c.s==='ok'?'ok':c.s==='warn'?'warn':'bad'}"><b>${c.s==='ok'?'✅':c.s==='warn'?'⚠️':'❌'} ${c.t}</b><span>${c.d}</span></div>`).join('');

 // JD RESULT
 const jdDiv=document.getElementById('jd-result');
 if(jdMatch){
   jdDiv.classList.remove('hidden');
   jdDiv.className='jd-result '+(jdMatch.pct>=60?'':'bad');
   jdDiv.innerHTML=`<b>🎯 JD Match: ${jdMatch.pct}%</b><p>Matched: ${jdMatch.matched.slice(0,5).join(', ')||'none'}</p>${jdMatch.missing.length?`<p>Missing keywords add pannu: <br>${jdMatch.missing.map(m=>`<code>${m}</code>`).join(' ')}</p>`:''}`;
 }else{jdDiv.classList.add('hidden');}

 document.getElementById('tips').innerHTML='<b>💡 Tips to 85%+</b><ul><li>Add 5+ tech keywords from JD</li><li>Add metrics like Improved 40%</li><li>Use action verbs</li><li>Keep 1 page, 300-650 words</li></ul>';

 // History
 const hist=JSON.parse(localStorage.getItem('resuqora_hist')||'[]');
 if(hist.length>1){
   document.getElementById('history').innerHTML=`<b>📊 History (Last 3)</b><p>${hist.map(h=>`${h.name} - ${h.score}% (${h.date})`).join('<br>')}</p>`;
 }
}
function downloadReport(){
 if(!lastData)return;const {jsPDF}=window.jspdf;const doc=new jsPDF();doc.setFontSize(20);doc.text('ResuQora v6 - ATS Report',10,20);doc.setFontSize(12);doc.text(`File: ${lastData.file}`,10,30);doc.text(`ATS Score: ${lastData.score}%`,10,38);doc.text(`Words: ${lastData.wc} | Pages: ${lastData.pages}`,10,46);if(lastData.jdMatch)doc.text(`JD Match: ${lastData.jdMatch.pct}%`,10,54);doc.text('Checks:',10,64);let y=72;lastData.checks.forEach(c=>{doc.text(`- ${c.t}: ${c.d}`,10,y);y+=8;});doc.text('Generated by ResuQora - 2026@khalilullahsheriff',10,y+10);doc.save(`ResuQora_Report_${lastData.file}.pdf`);
}
