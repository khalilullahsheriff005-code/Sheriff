pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const fileInput=document.getElementById('file-input'),drop=document.getElementById('drop-zone'),err=document.getElementById('error-msg'),load=document.getElementById('loader'),res=document.getElementById('result');

drop.addEventListener('click',()=>fileInput.click());
drop.addEventListener('dragover',e=>{e.preventDefault();drop.style.borderColor='#7c3aed'});
drop.addEventListener('dragleave',()=>drop.style.borderColor='#cbd5e1');
drop.addEventListener('drop',e=>{e.preventDefault();handle(e.dataTransfer.files[0])});
fileInput.addEventListener('change',e=>handle(e.target.files[0]));

function showErr(m){err.innerHTML=m;err.classList.remove('hidden');load.classList.add('hidden');res.classList.add('hidden');fileInput.value='';}

async function getText(file){
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument(buf).promise;
  let t='';for(let i=1;i<=Math.min(pdf.numPages,6);i++){const p=await pdf.getPage(i);const c=await p.getTextContent();t+=c.items.map(x=>x.str).join(' ')+' ';}
  return {text:t,pages:pdf.numPages};
}

async function handle(file){
 if(!file)return;
 if(!file.name.toLowerCase().endsWith('.pdf')){showErr('❌ <b>Only PDF Allowed!</b>');return;}
 if(file.size>5*1024*1024){showErr('❌ Max 5MB!');return;}
 err.classList.add('hidden');load.classList.remove('hidden');res.classList.add('hidden');
 const start=performance.now();
 try{
  const {text:raw,pages}=await getText(file);
  const lower=raw.toLowerCase();
  const words=raw.trim().split(/\s+/).filter(w=>w.length>1);
  const wc=words.length;

  // ===== 100% RESUME ONLY - BLOCK EVERY OTHER FILE =====

  // 1. Block all non-resume documents - direct keywords
  const nonResumeDocs=[
    'marksheet','mark sheet','grade card','statement of marks','semester','subject code',
    'hall ticket','admit card','transcript','bonafide','transfer certificate',
    'income certificate','community certificate','provisional certificate',
    'degree certificate','birth certificate','aadhar','aadhaar','pan card',
    'voter id','driving licence','passport','invoice','receipt','salary slip',
    'question paper','answer sheet','assignment','project report only'
  ];
  const foundNonResume=nonResumeDocs.filter(k=>lower.includes(k));

  // 2. Resume must signals - need at least 3
  const resumeSignals={
    hasSkills: lower.includes('skill'),
    hasExperience: lower.includes('experience') || lower.includes('work experience') || lower.includes('employment'),
    hasEducation: lower.includes('education') || lower.includes('bachelor') || lower.includes('master') || lower.includes('university') || lower.includes('college'),
    hasProjects: lower.includes('project'),
    hasEmail: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(lower),
    hasObjective: lower.includes('objective') || lower.includes('summary') || lower.includes('career objective')
  };
  const signalCount=Object.values(resumeSignals).filter(Boolean).length;

  // RULE 1: If any non-resume keyword found + low resume signals = BLOCK
  if(foundNonResume.length>=1 && signalCount<4){
    showErr('❌ <b>RESUME FILE ONLY ALLOWED!</b><br><br>ResuQora detected this is <b>'+foundNonResume[0].toUpperCase()+'</b> document.<br><br>This is NOT a resume.<br>Please upload only your <b>RESUME PDF</b> with Skills, Experience, Education.');
    return;
  }

  // RULE 2: If resume signals < 3 = BLOCK - not a resume at all
  if(signalCount<3){
    showErr('❌ <b>RESUME FILE ONLY ALLOWED!</b><br><br>This file does NOT look like a resume.<br>Real resume needs at least <b>3 of these</b>:<br>• Skills<br>• Experience<br>• Education<br>• Projects<br>• Email<br>• Objective/Summary<br><br>You have only <b>'+signalCount+'</b>.<br>Upload only <b>RESUME PDF</b>.');
    return;
  }

  // RULE 3: Too short = not a resume
  if(wc<70){
    showErr('❌ <b>RESUME FILE ONLY!</b><br>Only '+wc+' words found.<br>Real resume needs 200+ words.<br>Upload only RESUME PDF.');
    return;
  }

  // ===== PASSED = REAL RESUME = REAL CALCULATION =====
  let score=0,checks=[],tips=[];
  const hasEmail=resumeSignals.hasEmail,hasPhone=/\b\d{10}\b/.test(lower),hasLinkedIn=lower.includes('linkedin');
  let cPts=(hasEmail?7:0)+(hasPhone?4:0)+(hasLinkedIn?4:0);score+=cPts;
  checks.push({s:cPts>=11?'ok':cPts>=7?'warn':'bad',t:'Contact',d:hasEmail&&hasPhone?'Email+Phone found':!hasEmail?'Missing email':'Missing phone/LinkedIn'});
  if(!hasEmail)tips.push('Add email at top');

  let sPts=signalCount*4;if(signalCount>=5)sPts=20;score+=sPts;
  checks.push({s:signalCount>=4?'ok':'warn',t:'Resume Sections',d:signalCount+'/6 core sections found'});
  if(signalCount<4)tips.push('Add Skills, Experience, Education, Projects');

  const tech=['javascript','python','java','react','node','sql','aws','html','css','git','api','mongodb','typescript'];
  const foundTech=[...new Set(tech.filter(k=>lower.includes(k)))];
  let kPts=foundTech.length>=5?15:foundTech.length>=3?8:foundTech.length>=1?4:0;score+=kPts;
  checks.push({s:foundTech.length>=4?'ok':foundTech.length>=2?'warn':'bad',t:'Tech Keywords',d:foundTech.length+' keywords: '+(foundTech.slice(0,3).join(', ')||'none')});
  if(foundTech.length<4)tips.push('Add 5+ job keywords');

  const verbs=['developed','built','created','led','managed','designed','implemented','optimized'];
  const foundVerbs=verbs.filter(v=>lower.includes(v));
  let vPts=foundVerbs.length>=3?10:foundVerbs.length>=1?5:0;score+=vPts;
  checks.push({s:foundVerbs.length>=3?'ok':foundVerbs.length>=1?'warn':'bad',t:'Action Verbs',d:foundVerbs.length+' verbs found'});
  if(foundVerbs.length<2)tips.push('Use: Built, Led, Developed');

  let mPts=/\b\d+%\b/.test(raw)||/\d+\+/.test(raw)?10:0;score+=mPts;
  checks.push({s:mPts?'ok':'bad',t:'Metrics',d:mPts?'Numbers/% found':'Add numbers like 40%'});

  let lPts=wc>=300&&wc<=650?10:wc>=200?7:wc>=120?4:0;score+=lPts;
  checks.push({s:lPts>=7?'ok':lPts>=4?'warn':'bad',t:'Length',d:wc+' words '+(wc>=300&&wc<=650?'Ideal':'Not ideal')});

  let fPts=!lower.includes('lorem ipsum')?5:0;score+=fPts;
  checks.push({s:fPts?'ok':'bad',t:'Quality',d:fPts?'Original content':'Dummy'});

  let uniq=new Set(words.map(w=>w.toLowerCase())).size;let ratio=wc?uniq/wc:0;
  let uPts=ratio>0.5?5:3;score+=uPts;
  score+=pages<=2?3:1;

  if(wc<150&&score>45)score=45;if(wc<250&&score>70)score=70;if(score>93)score=93;

  let title=score>=80?'Excellent! 🔥':score>=65?'Good! 👍':score>=50?'Average':'Weak';
  let sub=score>=80?'Top 15% ATS Ready':score>=65?'Fix 2 issues to 80%+':score>=50?'Needs improvement':'Not ATS ready';

  const time=Math.round(performance.now()-start);
  load.classList.add('hidden');res.classList.remove('hidden');
  document.getElementById('score').textContent=score+'%';
  document.getElementById('file-name').textContent=file.name;
  document.getElementById('score-title').textContent=title;
  document.getElementById('score-sub').textContent=sub;
  document.getElementById('time').textContent=time+'ms';
  document.getElementById('words').textContent=wc;
  const bar=document.getElementById('bar');bar.style.strokeDashoffset=326-(326*score/100);bar.style.stroke=score>=70?'#22c55e':score>=50?'#f59e0b':'#ef4444';
  document.getElementById('checks').innerHTML=checks.map(c=>`<div class="ck ${c.s==='ok'?'ok':c.s==='warn'?'warn':'bad'}"><b>${c.s==='ok'?'✅':c.s==='warn'?'⚠️':'❌'} ${c.t}</b><span>${c.d}</span></div>`).join('');
  document.getElementById('tips').innerHTML=tips.length?'<b>💡 Tips to 85%+</b><ul>'+tips.slice(0,4).map(t=>'<li>'+t+'</li>').join('')+'</ul>':'<b>✅ Perfect ATS Ready!</b>';
 }catch(e){showErr('❌ Cannot read PDF. Upload text-based resume PDF only.');}
}
