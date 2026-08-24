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
  const pages = Math.min(pdf.numPages, 4);
  for(let i=1;i<=pages;i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(x=>x.str).join(' ') + ' ';
  }
  return text.toLowerCase();
}

async function handle(file){
  if(!file) return;

  // Only PDF
  if(!file.name.toLowerCase().endsWith('.pdf')){
    showErr('❌ Only PDF allowed! Upload your resume as PDF.');
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

    // REAL RESUME VERIFICATION - Neat & Strict
    const hasResumeKeywords = ['skill','education','experience','project','work','university','college'].filter(k=>text.includes(k)).length;
    const isTooShort = text.length < 250;

    if(isTooShort || hasResumeKeywords < 2){
      showErr('❌ "'+file.name+'" is NOT a valid resume! ResuQora detected non-resume content. Please upload only a real resume PDF.');
      return;
    }

    // ATS Scoring - Accurate Calculation
    let score = 0;
    let checks = [];

    const add = (cond, label, points) => {
      if(cond){ score += points; checks.push({ok:1,label}); }
      else checks.push({ok:0,label});
    };

    add(text.includes('@') && text.includes('.'), 'Email Found', 10);
    add(/\d{10}/.test(text) || text.includes('+91'), 'Phone Found', 10);
    add(text.includes('linkedin.com') || text.includes('linkedin'), 'LinkedIn', 8);
    add(text.includes('skill'), 'Skills Section', 12);
    add(text.includes('experience') || text.includes('work history'), 'Experience Section', 12);
    add(text.includes('education') || text.includes('bachelor') || text.includes('master'), 'Education Section', 12);
    add(text.includes('project'), 'Projects Section', 8);
    add(['java','python','react','javascript','sql','node','html','css','aws','git'].some(k=>text.includes(k)), 'Technical Keywords', 10);
    add(text.split(/\s+/).length > 150 && text.split(/\s+/).length < 800, 'Ideal Resume Length', 8);
    add(!text.includes('lorem ipsum') &&!text.includes('dummy'), 'Original Content', 10);

    if(score > 96) score = 96;

    // Show Result
    load.classList.add('hidden');
    res.classList.remove('hidden');

    document.getElementById('score').textContent = score + '%';
    document.getElementById('file-name').textContent = 'Verified by ResuQora: ' + file.name;

    const title = document.getElementById('score-title');
    const sub = document.getElementById('score-sub');

    if(score >= 85){ title.textContent = 'Excellent!'; sub.textContent = 'ResuQora says: Top 10% ATS Ready!'; }
    else if(score >= 65){ title.textContent = 'Good Job!'; sub.textContent = 'ResuQora says: Almost ATS ready, fix few issues'; }
    else { title.textContent = 'Needs Work!'; sub.textContent = 'ResuQora says: Add missing sections to improve'; }

    const bar = document.getElementById('bar');
    const offset = 251 - (251 * score / 100);
    bar.style.strokeDashoffset = offset;
    bar.style.stroke = score >= 80? '#22c55e' : score >= 60? '#f59e0b' : '#ef4444';

    document.getElementById('checks').innerHTML = checks.map(c=>
      `<div class="ck ${c.ok?'ok':'bad'}">${c.ok?'✅':'❌'} ${c.label}</div>`
    ).join('');

  }catch(e){
    console.error(e);
    showErr('❌ Cannot read this PDF. Please upload a text-based resume PDF (not scanned image).');
  }
}
