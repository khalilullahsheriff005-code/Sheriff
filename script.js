// Setup PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const errorBox = document.getElementById('error');
const loader = document.getElementById('loader');
const resultBox = document.getElementById('result');

function showError(msg){
  errorBox.style.display = 'block';
  errorBox.innerText = msg;
  loader.classList.add('hidden');
  resultBox.classList.add('hidden');
  fileInput.value = '';
}
function clearError(){
  errorBox.style.display = 'none';
  errorBox.innerText = '';
}

async function readPDF(file){
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(buffer).promise;
  let fullText = '';
  for(let i=1; i<= pdf.numPages; i++){
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + ' ';
  }
  return fullText.toLowerCase();
}

function isResume(text){
  // A real resume MUST have these
  const required = ['experience', 'education', 'skills'];
  let count = 0;
  required.forEach(word => { if(text.includes(word)) count++; });

  // If no resume keywords at all, it's NOT a resume
  if(count === 0) return false;
  if(text.length < 150) return false; // too small
  if(!text.includes('@') &&!text.includes('phone') &&!text.includes('email')) {
    // If no contact info and low keywords, reject
    if(count < 2) return false;
  }
  return true;
}

async function handleFile(file){
  clearError();
  if(!file) return;

  // 1. FILE TYPE CHECK - ONLY PDF
  if(!file.name.toLowerCase().endsWith('.pdf')){
    showError('❌ Only PDF resume allowed! You uploaded: ' + file.name);
    return;
  }
  if(file.type!== 'application/pdf' && file.type!== ''){
    showError('❌ Invalid file type. Please upload PDF resume only.');
    return;
  }
  if(file.size > 5*1024*1024){
    showError('❌ File too large. Max 5MB.');
    return;
  }

  loader.classList.remove('hidden');
  resultBox.classList.add('hidden');

  try{
    const text = await readPDF(file);

    // 2. CONTENT CHECK - IS IT REALLY A RESUME?
    if(!isResume(text)){
      showError('❌ "' + file.name + '" is NOT a resume! We scanned content and found no resume data (No Skills/Education/Experience). Please upload only your resume PDF.');
      return;
    }

    // 3. IF IT IS RESUME, CALCULATE SCORE
    loader.classList.add('hidden');
    resultBox.classList.remove('hidden');

    let score = 50;
    let checks = [];

    if(text.includes('@')){ score+=10; checks.push('✅ Email found'); } else checks.push('❌ Email missing');
    if(text.match(/[6-9][0-9]{9}/)){ score+=10; checks.push('✅ Phone found'); } else checks.push('❌ Phone missing');
    if(text.includes('skills')){ score+=10; checks.push('✅ Skills found'); } else checks.push('⚠️ Add Skills section');
    if(text.includes('experience')){ score+=10; checks.push('✅ Experience found'); } else checks.push('⚠️ Add Experience');
    if(text.includes('education')){ score+=10; checks.push('✅ Education found'); } else checks.push('⚠️ Add Education');

    if(score>95) score=95;

    document.getElementById('score').innerText = score + '%';
    document.getElementById('bar').style.width = score + '%';
    document.getElementById('bar').style.background = score>80? '#22c55e' : score>60? '#eab308' : '#ef4444';
    document.getElementById('list').innerHTML = checks.map(c=>`<li>${c}</li>`).join('');
    document.getElementById('fname').innerText = 'Verified Resume: ' + file.name;

  } catch(err){
    showError('❌ Cannot read PDF. Upload a valid text-based resume PDF (not scanned image).');
  }
}

dropZone.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', (e)=> handleFile(e.target.files[0]));
dropZone.addEventListener('dragover', (e)=>{ e.preventDefault(); dropZone.style.borderColor='#2563eb'; });
dropZone.addEventListener('dragleave', ()=>{ dropZone.style.borderColor='#cbd5e1'; });
dropZone.addEventListener('drop', (e)=>{ e.preventDefault(); dropZone.style.borderColor='#cbd5e1'; handleFile(e.dataTransfer.files[0]); });
