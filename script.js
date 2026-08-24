pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const fileInput=document.getElementById('file-input'),drop=document.getElementById('drop-zone'),err=document.getElementById('error-msg'),load=document.getElementById('loader'),res=document.getElementById('result');
drop.addEventListener('click',()=>fileInput.click());
drop.addEventListener('dragover',e=>{e.preventDefault();drop.style.borderColor='#7c3aed'});
drop.addEventListener('dragleave',()=>drop.style.borderColor='rgba(255,255,255,.12)');
drop.addEventListener('drop',e=>{e.preventDefault();handle(e.dataTransfer.files[0])});
fileInput.addEventListener('change',e=>handle(e.target.files[0]));
function showErr(m){err.textContent=m;err.classList.remove('hidden');load.classList.add('hidden');res.classList.add('hidden');fileInput.value='';}
async function getText(file){
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument(buf).promise;
  let text='';
  for(let i=1;i<=Math.min(pdf.numPages,6);i++){
    const p=await pdf.getPage(i);
    const c=await p.getTextContent();
    text+=c.items.map(x=>x.str).join(' ')+' ';
  }
  return text;
}
async function handle(file){
  if(!file)return;
  if(!file.name.toLowerCase().endsWith('.pdf')){showErr('❌ Only PDF allowed! Real resume PDF only.');return;}
  if(file.size>5*1024*1024){showErr('❌ Max 5MB! File too big.');return;}
  err.classList.add('hidden');load.classList.remove('hidden');res.classList.add('hidden');
  const start=performance.now();
  try{
    const raw=await getText(file);
    const lower=raw.toLowerCase();
    const words=raw.trim().split(/\s+/).filter(w=>w.length>1);
    const wc=words.length;

    // REAL STRICT CHECK - EMPTY = LOW SCORE (FIXES FAKE 95% BUG)
    if(wc < 20){
      return finalShow(file.name,wc,start,4,'Empty Resume Detected','ResuQora: No readable content. This is not a valid resume.',[
        {ok:0,label:'Content Check',desc:wc+' words only - Need 200+'},
        {ok:0,label:'Resume Sections',desc:'No sections found'},
        {ok:0,label:'Contact Info',desc:'Missing'},
        {ok:0,label:'Skills',desc:'Missing'}
      ]);
    }
    if(wc < 50){
      return finalShow(file.name,wc,start,12,'Almost Empty','ResuQora: Too short to be a resume. Add more details.',[
        {ok:0,label:'Content',desc:wc+' words - too short'},
        {ok:0,label:'Experience',desc:'Missing'},
        {ok:0,label:'Education',desc:'Missing'},
        {ok:0,label:'Skills',desc:'Missing'}
      ]);
    }

    // TRUE SCORING FROM 0
    let score=0; let checks=[];

    // Contact 20%
    const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(lower);
    if(hasEmail){score+=10;checks.push({ok:1,label:'Email',desc:'Valid email found'});}else checks.push({ok:0,label:'Email',desc:'No valid email'});
    const hasPhone = /\b\d{10}\b/.test(lower) || /\+\d{1,3}[- ]?\d{10}/.test(lower);
    if(hasPhone){score+=5;checks.push({ok:1,label:'Phone',desc:'Phone found'});}else checks.push({ok:0,label:'Phone',desc:'Add phone number'});
    if(lower.includes('linkedin.com/in')||lower.includes('linkedin')){score+=5;checks.push({ok:1,label:'LinkedIn',desc:'LinkedIn URL present'});}else checks.push({ok:0,label:'LinkedIn',desc:'Add LinkedIn'});

    // Sections 35% - MUST exist in real resume
    if(lower.includes('skill')){score+=12;checks.push({ok:1,label:'Skills Section',desc:'Skills section detected'});}else checks.push({ok:0,label:'Skills Section',desc:'Missing skills section'});
    if(lower.includes('experience')||lower.includes('employment history')||lower.includes('work experience')){score+=13;checks.push({ok:1,label:'Experience',desc:'Experience section found'});}else checks.push({ok:0,label:'Experience',desc:'No experience section'});
    if(lower.includes('education')||lower.includes('bachelor')||lower.includes('master')||lower.includes('university')){score+=10;checks.push({ok:1,label:'Education',desc:'Education found'});}else checks.push({ok:0,label:'Education',desc:'Missing education'});

    // Keywords 30% - Real content depth
    const techList=['javascript','python','java','react','node','typescript','sql','aws','docker','kubernetes','html','css','git','api','mongodb','next.js','angular','vue'];
    const foundTech=techList.filter(k=>lower.includes(k));
    if(foundTech.length>=6){score+=12;checks.push({ok:1,label:'Tech Stack',desc:foundTech.length+' keywords: '+foundTech.slice(0,3).join(', ')});}else if(foundTech.length>=3){score+=7;checks.push({ok:0,label:'Tech Stack',desc:'Only '+foundTech.length+' keywords - add more'});}else checks.push({ok:0,label:'Tech Stack',desc:'0-2 tech keywords - weak'});

    const verbs=['developed','built','created','led','managed','designed','implemented','optimized','deployed','engineered'];
    const foundVerbs=verbs.filter(v=>lower.includes(v));
    if(foundVerbs.length>=4){score+=8;checks.push({ok:1,label:'Action Verbs',desc:foundVerbs.length+' strong verbs used'});}else checks.push({ok:0,label:'Action Verbs',desc:'Add verbs: Built, Led, Developed'});

    if(wc>=250 && wc<=700){score+=10;checks.push({ok:1,label:'Length',desc:wc+' words - perfect for ATS'});}else if(wc>=150 && wc<250){score+=5;checks.push({ok:0,label:'Length',desc:wc+' words - a bit short'});}else if(wc>700){score+=3;checks.push({ok:0,label:'Length',desc:wc+' words - too long for ATS'});}else checks.push({ok:0,label:'Length',desc:wc+' words - too short'});

    // Quality 15%
    const isDummy = lower.includes('lorem ipsum') || lower.includes('dummy text');
    if(!isDummy && wc>150){score+=15;checks.push({ok:1,label:'Content Quality',desc:'Original real content'});}else checks.push({ok:0,label:'Content Quality',desc:isDummy?'Dummy content detected':'Low quality'});

    // REALISTIC CAPS - NEVER FAKE HIGH
    if(wc < 120 && score > 35) score = 35;
    if(wc < 200 && score > 60) score = 60;
    if(score > 94) score = 94; // No one gets 100% in real ATS

    let title='', sub='';
    if(score>=80){title='Excellent Resume! 🔥'; sub='ResuQora: Top 15% - Highly ATS compatible';}
    else if(score>=65){title='Good Resume 👍'; sub='ResuQora: Fix 2-3 issues to reach top';}
    else if(score>=45){title='Average Resume'; sub='ResuQora: Needs more sections & keywords';}
    else if(score>=25){title='Weak Resume'; sub='ResuQora: Major content missing - low ATS chance';}
    else {title='Poor / Empty'; sub='ResuQora: Real score - not ATS ready at all';}

    finalShow(file.name,wc,start,score,title,sub,checks);

  }catch(e){
    console.error(e);
    showErr('❌ Cannot read this PDF. Upload a text-based resume PDF (not scanned image).');
  }
}

function finalShow(name,wc,start,score,title,sub,checks){
  const time=Math.round(performance.now()-start);
  load.classList.add('hidden');res.classList.remove('hidden');
  document.getElementById('score').textContent=score+'%';
  document.getElementById('file-name').textContent=name;
  document.getElementById('score-title').textContent=title;
  document.getElementById('score-sub').textContent=sub;
  document.getElementById('time').textContent=time+'ms';
  document.getElementById('words').textContent=wc;
  const bar=document.getElementById('bar');
  bar.style.strokeDashoffset=326-(326*score/100);
  bar.style.stroke=score>=70?'#22c55e':score>=45?'#f59e0b':'#ef4444';
  document.getElementById('checks').innerHTML=checks.map(c=>`<div class="card ${c.ok?'ok':'bad'}"><b>${c.ok?'✅':'❌'} ${c.label}</b><span>${c.desc}</span></div>`).join('');
}
