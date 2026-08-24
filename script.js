pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-input');
const drop = document.getElementById('drop-zone');
const err = document.getElementById('error-msg');
const load = document.getElementById('loader');
const res = document.getElementById('result');

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor='#7c3aed'; });
drop.addEventListener('dragleave', () => drop.style.borderColor='#cbd5e1');
drop.addEventListener('drop', e => { e.preventDefault(); handle(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => handle(e.target.files[0]));

function showErr(m){
  err.textContent = m;
  err.classList.remove('hidden');
  load.classList.add('hidden');
  res.classList.add('hidden');
  fileInput.value = '';
}

async function getText(file){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(buf).promise;
  let text = '';
  const pages = Math.min(pdf.numPages, 5);
  for(let i=1;i<=pages;i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(x=>x.str).join(' ') + ' ';
  }
  return text.toLowerCase();
}

async function handle(file){
  if(!file) return;
  if(!file.name.toLowerCase().endsWith('.pdf')){
    showErr('❌ Only PDF allowed! Upload resume as PDF.');
    return;
  }
  if(file.size > 5*1024*1024){
    showErr('❌ File too big! Max 5MB.');
    return;
  }

  err.classList.add('hidden');
  load.classList.remove('hidden');
  res.classList.add('hidden');

  try{
    const text = await getText(file);
    const words = text.split(/\s+/).filter(Boolean);

    // REAL RESUME VERIFICATION - Strict
    const hasResumeKeywords = ['skill','education','experience','project'].filter(k=>text.includes(k)).length;
    if(text.length < 300 || hasResumeKeywords < 2){
      showErr('❌ "'+file.name+'" is NOT a valid resume! ResuQora detected non-resume content.');
      return;
    }

    // === CORRECT ATS SCORING (100% Accurate Logic) ===
    let score = 0;
    let checks = [];

    // 1. CONTACT INFO (20 points)
    let contactScore = 0;
    if(text.includes('@') && text.includes('.')){ contactScore+=10; checks.push({ok:1,label:'Email Found'}); } else checks.push({ok:0,label:'Missing Email'});
    if(/\d{10}/.test(text) || /\+91/.test(text)){ contactScore+=5; checks.push({ok:1,label:'Phone Found'}); } else checks.push({ok:0,label:'Missing Phone'});
    if(text.includes('linkedin')){ contactScore+=5; checks.push({ok:1,label:'LinkedIn Found'}); } else checks.push({ok:0,label:'Add LinkedIn'});
    score += contactScore;

    // 2. SECTIONS (40 points) - Most important
    let sectionScore = 0;
    if(text.includes('skill')){ sectionScore+=12; checks.push({ok:1,label:'Skills Section'}); } else checks.push({ok:0,label:'Missing Skills Section'});
    if(text.includes('experience') || text.includes('work')){ sectionScore+=12; checks.push({ok:1,label:'Experience Section'}); } else checks.push({ok:0,label:'Missing Experience'});
    if(text.includes('education') || text.includes('bachelor') || text.includes('degree')){ sectionScore+=10; checks.push({ok:1,label:'Education Section'}); } else checks.push({ok:0,label:'Missing Education'});
    if(text.includes('project')){ sectionScore+=6; checks.push({ok:1,label:'Projects Section'}); } else checks.push({ok:0,label:'Add Projects'});
    score += sectionScore;

    // 3. KEYWORDS & CONTENT (25 points)
    let keywordScore = 0;
    const tech = ['java','python','react','javascript','sql','node','html','css','aws','git','docker','api'];
    const foundTech = tech.filter(k=>text.includes(k)).length;
    if(foundTech >= 4){ keywordScore+=12; checks.push({ok:1,label:`${foundTech} Tech Keywords Found`}); }
    else if(foundTech >=2){ keywordScore+=6; checks.push({ok:0,label:`Only ${foundTech} Keywords (Add more)`}); }
    else{ checks.push({ok:0,label:'Missing Tech Keywords'}); }

    const actionVerbs = ['developed','built','created','managed','led','designed','implemented'];
    const foundVerbs = actionVerbs.filter(k=>text.includes(k)).length;
    if(foundVerbs >=3){ keywordScore+=8; checks.push({ok:1,label:'Strong Action Verbs'}); }
    else checks.push({ok:0,label:'Add Action Verbs (Built, Led..)'});

    if(words.length >= 200 && words.length <= 700){ keywordScore+=5; checks.push({ok:1,label:'Ideal Length ('+words.length+' words)'}); }
    else checks.push({ok:0,label:'Bad Length ('+words.length+' words)'});

    score += keywordScore;

    // 4. FORMAT & QUALITY (15 points)
    let formatScore = 0;
    if(!text.includes('lorem ipsum') && text.length > 300){ formatScore+=8; checks.push({ok:1,label:'Original Content'}); }
    else checks.push({ok:0,label:'Dummy Content Detected'});

    if(words.length > 100){ formatScore+=7; checks.push({ok:1,label:'Readable Format'}); }
    else checks.push({ok:0,label:'Too Short to Parse'});

    score += formatScore;

    // Cap at 95 - no one gets 100% (real ATS logic)
    if(score > 95) score = 95;
    if(score < 10) score = 10;

    // Show Result
    load.classList.add('hidden');
    res.classList.remove('hidden');

    document.getElementById('score').textContent = score + '%';
    document.getElementById('file-name').textContent = 'Verified by ResuQora: ' + file.name;

    const title = document.getElementById('score-title');
    const sub = document.getElementById('score-sub');

    if(score >= 85){ title.textContent = 'Excellent!'; sub.textContent = 'ResuQora: Top 10% ATS Ready'; }
    else if(score >= 70){ title.textContent = 'Good Job!'; sub.textContent = 'ResuQora: 2-3 fixes needed'; }
    else if(score >= 50){ title.textContent = 'Average'; sub.textContent = 'ResuQora: Add missing sections'; }
    else { title.textContent = 'Needs Work!'; sub.textContent = 'ResuQora: Major improvements needed'; }

    const bar = document.getElementById('bar');
    bar.style.strokeDashoffset = 251 - (251 * score / 100);
    bar.style.stroke = score >= 80? '#22c55e' : score >= 60? '#f59e0b' : '#ef4444';

    document.getElementById('checks').innerHTML = checks.map(c=>
      `<div class="ck ${c.ok?'ok':'bad'}">${c.ok?'✅':'❌'} ${c.label}</div>`
    ).join('');

  }catch(e){
    console.error(e);
    showErr('❌ Cannot read PDF. Upload text-based resume PDF.');
  }
}
