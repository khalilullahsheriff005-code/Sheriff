pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const fileInput=document.getElementById('file-input'),drop=document.getElementById('drop-zone'),err=document.getElementById('error-msg'),load=document.getElementById('loader'),res=document.getElementById('result');

drop.addEventListener('click',()=>fileInput.click());
drop.addEventListener('dragover',e=>{e.preventDefault();drop.style.borderColor='#7c3aed'});
drop.addEventListener('dragleave',()=>drop.style.borderColor='rgba(255,255,255,.12)');
drop.addEventListener('drop',e=>{e.preventDefault();handle(e.dataTransfer.files[0])});
fileInput.addEventListener('change',e=>handle(e.target.files[0]));

function showErr(m){err.innerHTML=m;err.classList.remove('hidden');load.classList.add('hidden');res.classList.add('hidden');fileInput.value='';}

async function getText(file){
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument(buf).promise;
  let text=''; let pages=pdf.numPages;
  for(let i=1;i<=Math.min(pages,6);i++){
    const p=await pdf.getPage(i);
    const c=await p.getTextContent();
    text+=c.items.map(x=>x.str).join(' ')+' ';
  }
  return {text, pages};
}

async function handle(file){
  if(!file)return;
  if(!file.name.toLowerCase().endsWith('.pdf')){showErr('❌ Only PDF allowed!');return;}
  if(file.size>5*1024*1024){showErr('❌ Max 5MB only!');return;}

  err.classList.add('hidden');load.classList.remove('hidden');res.classList.add('hidden');
  const start=performance.now();

  try{
    const {text:raw, pages} = await getText(file);
    const lower=raw.toLowerCase();
    const words=raw.trim().split(/\s+/).filter(w=>w.length>1);
    const wc=words.length;

    // ===== STRICT RESUME-ONLY VERIFICATION =====
    const blockList=['marksheet','mark sheet','statement of marks','grade card','semester','subject code','hall ticket','transcript','bonafide','income certificate','community certificate','transfer certificate'];
    const foundBlock=blockList.filter(k=>lower.includes(k));
    const resumeCore=['skills','experience','projects','objective','summary','education','work experience','career objective'];
    const foundCore=resumeCore.filter(k=>lower.includes(k)).length;

    if(foundBlock.length>=2 && foundCore<2){
      showErr('❌ <b>Not a Resume!</b><br>ResuQora detected <b>'+foundBlock[0].toUpperCase()+'</b> document.<br>Please upload only <b>RESUME PDF</b> (with Skills, Experience, Education).');
      return;
    }
    if(foundCore<2){showErr('❌ <b>Not a Valid Resume!</b><br>Need at least 2 sections like <b>Skills, Experience, Education</b>.<br>Upload only RESUME PDF.');return;}
    if(wc<60){showErr('❌ Too short! Only '+wc+' words. Real resume needs 200+ words.');return;}

    // ===== 11 ATS PERFORMANCE CHECKS =====
    let score=0; let checks=[]; let tips=[];

    // 1. Contact Info (15 pts)
    const hasEmail=/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(lower);
    const hasPhone=/\b\d{10}\b/.test(lower) || /\+\d{1,3}[- ]?\d{10}/.test(lower);
    const hasLinkedIn=lower.includes('linkedin');
    let contactPts=0;
    if(hasEmail)contactPts+=7; if(hasPhone)contactPts+=4; if(hasLinkedIn)contactPts+=4;
    score+=contactPts;
    if(hasEmail&&hasPhone)checks.push({s:'ok',t:'Contact Info',d:'Email + Phone found'});
    else {checks.push({s:contactPts>5?'warn':'bad',t:'Contact Info',d:!hasEmail?'Missing email':'Missing phone/LinkedIn'}); if(!hasEmail)tips.push('Add professional email at top');}

    // 2. Sections (20 pts)
    const sections={skills:lower.includes('skill'), exp:lower.includes('experience')||lower.includes('employment'), edu:lower.includes('education')||lower.includes('bachelor')||lower.includes('university'), proj:lower.includes('project'), obj:lower.includes('objective')||lower.includes('summary')};
    let secCount=Object.values(sections).filter(Boolean).length;
    let secPts=secCount*4; if(secCount>=5)secPts=20;
    score+=secPts;
    checks.push({s:secCount>=4?'ok':secCount>=2?'warn':'bad',t:'Resume Sections',d:secCount+'/5 sections ('+Object.keys(sections).filter(k=>sections[k]).join(', ')+')'});
    if(secCount<4)tips.push('Add missing sections: Skills, Experience, Education, Projects');

    // 3. Keywords (15 pts)
    const tech=['javascript','python','java','react','node','typescript','sql','aws','docker','html','css','git','api','mongodb','next.js','angular','vue','kubernetes','java','c++'];
    const foundTech=[...new Set(tech.filter(k=>lower.includes(k)))];
    let kwPts=foundTech.length>=6?15:foundTech.length>=3?8:foundTech.length>=1?4:0;
    score+=kwPts;
    checks.push({s:foundTech.length>=5?'ok':foundTech.length>=3?'warn':'bad',t:'Tech Keywords',d:foundTech.length+' keywords: '+(foundTech.slice(0,4).join(', ')||'none')});
    if(foundTech.length<5)tips.push('Add 6+ relevant tech keywords from job description');

    // 4. Action Verbs (10 pts)
    const verbs=['developed','built','created','led','managed','designed','implemented','optimized','deployed','engineered','achieved','improved','launched'];
    const foundVerbs=verbs.filter(v=>lower.includes(v));
    let verbPts=foundVerbs.length>=4?10:foundVerbs.length>=2?5:0;
    score+=verbPts;
    checks.push({s:foundVerbs.length>=4?'ok':foundVerbs.length>=2?'warn':'bad',t:'Action Verbs',d:foundVerbs.length+' strong verbs ('+(foundVerbs.slice(0,3).join(', ')||'none')+')'});
    if(foundVerbs.length<3)tips.push('Start bullet points with action verbs: Built, Led, Developed');

    // 5. Quantifiable Results (10 pts)
    const hasNumbers=/\b\d+%\b/.test(raw) || /\b\d+\+\b/.test(raw) || /\$\d+/.test(raw) || /increased|reduced|improved.*\d+/.test(lower);
    let quantPts=hasNumbers?10:0;
    score+=quantPts;
    checks.push({s:hasNumbers?'ok':'bad',t:'Quantifiable Results',d:hasNumbers?'Numbers/% found (e.g., Improved 30%)':'No metrics - add numbers like Increased 40%'});
    if(!hasNumbers)tips.push('Add metrics: e.g., "Improved performance by 40%" or "Built 5+ projects"');

    // 6. Length (10 pts)
    let lenPts=0;
    if(wc>=300&&wc<=650)lenPts=10; else if(wc>=200&&wc<300)lenPts=7; else if(wc>=150&&wc<200)lenPts=4; else if(wc>650&&wc<900)lenPts=5;
    score+=lenPts;
    checks.push({s:lenPts>=7?'ok':lenPts>=4?'warn':'bad',t:'Length',d:wc+' words, '+pages+' pages '+(wc>=300&&wc<=650?'- Ideal for ATS':'- Not ideal')});
    if(wc<250)tips.push('Ideal resume: 300-650 words, 1 page');

    // 7. Formatting (5 pts)
    const isDummy=lower.includes('lorem ipsum');
    let fmtPts=!isDummy&&wc>150?5:0;
    score+=fmtPts;
    checks.push({s:fmtPts?'ok':'bad',t:'Formatting',d:!isDummy?'Clean readable format':'Dummy content detected'});

    // 8. Repetition (5 pts)
    const uniqueWords=new Set(words.map(w=>w.toLowerCase())).size;
    const repetition=wc>0?uniqueWords/wc:0;
    let repPts=repetition>0.5?5:repetition>0.35?3:0;
    score+=repPts;
    checks.push({s:repPts>=5?'ok':repPts>=3?'warn':'bad',t:'No Repetition',d:Math.round(repetition*100)+'% unique words '+(repetition>0.5?'- Good':'- Too repetitive')});

    // 9. Spelling (5 pts) - basic
    const badWords=['recieve','acheive','teh','adn','experiance','skils'];
    const foundBad=badWords.filter(w=>lower.includes(w));
    let spellPts=foundBad.length===0?5:0;
    score+=spellPts;
    checks.push({s:spellPts?'ok':'bad',t:'Spelling',d:foundBad.length===0?'No obvious spelling errors':'Possible typo: '+foundBad.join(', ')});
    if(foundBad.length)tips.push('Fix spelling errors - ATS rejects misspelled resumes');

    // 10. File Compatibility (3 pts)
    let filePts=3; // PDF already
    if(pages<=2)filePts=3; else if(pages===3)filePts=2; else filePts=1;
    score+=filePts;
    checks.push({s:pages<=2?'ok':pages===3?'warn':'bad',t:'File Type',d:'PDF, '+pages+' page(s) '+(pages<=1?' - Perfect ATS':' - Try 1 page')});

    // 11. Education (2 pts)
    let eduPts=sections.edu?2:0;
    score+=eduPts;

    // CAPS - Realistic
    if(wc<150&&score>45)score=45;
    if(wc<250&&score>70)score=70;
    if(score>93)score=93;

    let title='', sub='';
    if(score>=80){title='Excellent - Top ATS! 🔥'; sub='ResuQora: Ready for FAANG & top companies';}
    else if(score>=65){title='Good - Almost Ready 👍'; sub='ResuQora: Fix 2-3 issues for 80%+';}
    else if(score>=50){title='Average - Needs Work'; sub='ResuQora: Add keywords & metrics';}
    else if(score>=30){title='Weak - Low ATS Chance'; sub='ResuQora: Major improvements needed';}
    else {title='Poor - Not ATS Ready'; sub='ResuQora: Real low score';}

    finalShow(file.name,wc,pages,start,score,title,sub,checks,tips);

  }catch(e){
    console.error(e);
    showErr('❌ Cannot read PDF. Upload text-based resume PDF (not scanned image).');
  }
}

function finalShow(name,wc,pages,start,score,title,sub,checks,tips){
  const time=Math.round(performance.now()-start);
  load.classList.add('hidden');res.classList.remove('hidden');
  document.getElementById('score').textContent=score+'%';
  document.getElementById('file-name').textContent=name;
  document.getElementById('score-title').textContent=title;
  document.getElementById('score-sub').textContent=sub;
  document.getElementById('time').textContent=time+'ms';
  document.getElementById('words').textContent=wc;
  document.getElementById('pages').textContent=pages;
  const bar=document.getElementById('bar');
  bar.style.strokeDashoffset=326-(326*score/100);
  bar.style.stroke=score>=75?'#22c55e':score>=50?'#f59e0b':'#ef4444';
  document.getElementById('checks').innerHTML=checks.map(c=>{
    let cls=c.s==='ok'?'ok':c.s==='warn'?'warn':'bad';
    let icon=c.s==='ok'?'✅':c.s==='warn'?'⚠️':'❌';
    return `<div class="card ${cls}"><b>${icon} ${c.t}</b><span>${c.d}</span></div>`;
  }).join('');
  const tipsDiv=document.getElementById('tips');
  if(tips.length){
    tipsDiv.innerHTML='<b>💡 How to reach 85%+ (ATS Tips)</b><ul>'+tips.slice(0,5).map(t=>'<li>'+t+'</li>').join('')+'</ul>';
    tipsDiv.classList.remove('hidden');
  }else{
    tipsDiv.innerHTML='<b>✅ Perfect!</b><ul><li>Your resume is already top ATS ready. Keep it 1 page, 400-600 words.</li></ul>';
  }
}
