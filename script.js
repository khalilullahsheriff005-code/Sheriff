pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const errorMsg = document.getElementById('error-msg');
const statusBox = document.getElementById('status');
const resultDiv = document.getElementById('result');

const ALLOWED_EXT = ['pdf','doc','docx'];
const RESUME_KEYWORDS = ['resume','cv','experience','education','skills','projects','email','phone','linkedin','github','objective','summary','work','university','college'];

function showError(msg){
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  statusBox.classList.add('hidden');
  resultDiv.classList.add('hidden');
  fileInput.value = '';
}
function showStatus(msg){
  statusBox.textContent = msg;
  statusBox.className = 'mt-4 text-center text-sm font-bold p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-200';
  statusBox.classList.remove('hidden');
  errorMsg.classList.add('hidden');
}
function hideAll(){
  errorMsg.classList.add('hidden');
  statusBox.classList.add('hidden');
}

async function getTextFromFile(file){
  const ext = file.name.split('.').pop().toLowerCase();
  if(ext === 'pdf'){
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(buffer).promise;
    let text = '';
    for(let i=1; i<=Math.min(pdf.numPages, 3); i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it=>it.str).join(' ') + ' ';
    }
    return text.toLowerCase();
  } else {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({arrayBuffer: buffer});
    return result.value.toLowerCase();
  }
}

function isRealResume(text, fileName){
  if(text.length < 100){
    return {valid:false, reason:'File is empty or not readable. Please upload a proper resume PDF.'};
  }
  let found = 0;
  RESUME_KEYWORDS.forEach(k => { if(text.includes(k)) found++; });
  if(found < 3){
    return {valid:false, reason: '❌ "'+fileName+'" is NOT a resume! No resume content found (Skills, Education, Experience missing). Upload only resume.'};
  }
  return {valid:true};
}

function calculateATSScore(text){
  let score = 40;
  const checks = [];
  if(text.includes('email') || text.includes('@')){ score+=10; checks.push('✅ Email found'); } else checks.push('❌ Email missing');
  if(/[0-9]{10}/.test(text)){ score+=10; checks.push('✅ Phone found'); } else checks.push('❌ Phone missing');
  if(text.includes('skills')){ score+=10; checks.push('✅ Skills section'); } else checks.push('⚠️ Skills missing');
  if(text.includes('experience') || text.includes('work')){ score+=10; checks.push('✅ Experience found'); } else checks.push('⚠️ Experience missing');
  if(text.includes('education')){ score+=10; checks.push('✅ Education found'); } else checks.push('⚠️ Education missing');
  if(text.includes('linkedin') || text.includes('github')){ score+=10; checks.push('✅ Links found'); }
  if(score>100) score=95;
  return {score, checks};
}

async function handleFile(file){
  if(!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if(!ALLOWED_EXT.includes(ext)){
    showError('❌ Only PDF/DOCX allowed! You uploaded: ' + file.name);
    return;
  }
  if(file.size > 5*1024*1024){ showError('❌ File too large! Max 5MB.'); return; }

  hideAll();
  showStatus('⏳ Reading resume... Checking if it is a real resume...');
  resultDiv.classList.add('hidden');

  try{
    const text = await getTextFromFile(file);
    const check = isRealResume(text, file.name);
    if(!check.valid){ showError(check.reason); return; }

    hideAll();
    const result = calculateATSScore(text);
    resultDiv.classList.remove('hidden');
    document.getElementById('file-name').textContent = 'Checked: ' + file.name;
    document.getElementById('score').textContent = result.score + '%';
    const bar = document.getElementById('score-bar');
    bar.style.width = result.score + '%';
    bar.className = 'h-3 rounded-full transition-all duration-700 ' + (result.score>80?'bg-green-500':result.score>60?'bg-yellow-500':'bg-red-500');
    document.getElementById('checks').innerHTML = result.checks.map(c=>'<div>'+c+'</div>').join('');
  } catch(e){
    showError('❌ Could not read file. Upload proper PDF/DOCX resume.');
  }
}

dropZone.addEventListener('click', ()=>fileInput.click());
fileInput.addEventListener('change', e=>handleFile(e.target.files[0]));
dropZone.addEventListener('dragover', e=>{e.preventDefault(); dropZone.classList.add('border-blue-500','bg-blue-50');});
dropZone.addEventListener('dragleave', ()=>dropZone.classList.remove('border-blue-500','bg-blue-50'));
dropZone.addEventListener('drop', e=>{e.preventDefault(); dropZone.classList.remove('border-blue-500','bg-blue-50'); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);});
