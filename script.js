pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const fileInput = document.getElementById('file');
const drop = document.getElementById('drop');
const err = document.getElementById('err');
const load = document.getElementById('load');
const out = document.getElementById('out');

function showErr(msg){
  err.style.display='block';
  err.innerText = msg;
  load.style.display='none';
  out.style.display='none';
  fileInput.value='';
}
function hideErr(){ err.style.display='none'; }

drop.addEventListener('click', ()=> fileInput.click());

fileInput.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;

  hideErr();

  // STEP 1: CHECK EXTENSION
  if(!file.name.toLowerCase().endsWith('.pdf')){
    showErr('ERROR: Only PDF resume allowed. You uploaded: ' + file.name);
    return;
  }

  load.style.display='block';
  out.style.display='none';

  try{
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(data).promise;
    let text = '';
    for(let i=1; i<=pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(s=>s.str).join(' ') + ' ';
    }
    text = text.toLowerCase();

    // STEP 2: CHECK IF IT IS REALLY A RESUME
    const hasResumeWord = text.includes('resume') || text.includes('curriculum') || text.includes('cv') || text.includes('experience') || text.includes('education') || text.includes('skills');

    if(text.length < 100 ||!hasResumeWord){
      showErr('ERROR: "' + file.name + '" is NOT a resume. This PDF has no resume content. Please upload only your resume PDF.');
      return;
    }

    // STEP 3: IT IS A REAL RESUME - CALCULATE
    load.style.display='none';
    out.style.display='block';

    let score = 40;
    let list = [];
    if(text.includes('@')){ score+=15; list.push('✓ Email found'); } else list.push('✗ Email missing');
    if(text.match(/[0-9]{10}/)){ score+=15; list.push('✓ Phone found'); } else list.push('✗ Phone missing');
    if(text.includes('skill')){ score+=10; list.push('✓ Skills found'); } else list.push('✗ Skills missing');
    if(text.includes('experience') || text.includes('project')){ score+=10; list.push('✓ Experience/Projects found'); }
    if(text.includes('education')){ score+=10; list.push('✓ Education found'); }

    if(score>95) score=95;

    document.getElementById('sc').innerText = score + '%';
    document.getElementById('bar').style.width = score + '%';
    document.getElementById('checks').innerHTML = list.join('<br>');
    document.getElementById('fname').innerText = 'Verified: ' + file.name;

  }catch(e){
    showErr('ERROR: Cannot read this PDF. Please upload a normal text PDF resume, not a scanned image.');
  }
});
