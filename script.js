document.addEventListener("DOMContentLoaded", function() {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    let activeResumeText = "";
    let activePages = 1;
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    const navItems = document.querySelectorAll('.n-item');
    const pages = document.querySelectorAll('.page');
    navItems.forEach(i => {
        i.onclick = () => {
            navItems.forEach(x => x.classList.remove('active'));
            pages.forEach(x => x.classList.remove('active'));
            i.classList.add('active');
            const target = document.getElementById(i.dataset.tab);
            if(target) target.classList.add('active');
        };
    });

    async function handleFileUpload(file, isMatchPage = false) {
        if(!file) return;
        if (file.type !== "application/pdf") return alert("Only PDF allowed");
        if (file.size > MAX_FILE_SIZE) return alert("File < 5MB only");
        
        const fnEl = document.getElementById(isMatchPage ? 'fn2' : 'fn1');
        if(fnEl) fnEl.innerText = file.name;

        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const pdf = await pdfjsLib.getDocument({data: new Uint8Array(this.result)}).promise;
                let text = "";
                for(let i=1; i<=pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(s => s.str).join(" ") + " ";
                    if(i===1 && !isMatchPage) {
                        const canvas = document.getElementById('pdfPreview');
                        if(canvas){
                            const vp = page.getViewport({scale: 0.8});
                            canvas.height = vp.height; canvas.width = vp.width;
                            page.render({canvasContext: canvas.getContext('2d'), viewport: vp});
                            canvas.style.display = 'block';
                        }
                    }
                }
                const t = text.toLowerCase();
                if(t.length < 100) return alert("PDF text read panna mudiyala");
                
                activeResumeText = text;
                activePages = pdf.numPages;
                alert(`✅ Loaded! Pages: ${activePages}`);
            } catch(e){ alert("Error reading PDF"); }
        };
        reader.readAsArrayBuffer(file);
    }

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const jdResume = document.getElementById('jdResume');
    if(dropZone) dropZone.onclick = () => fileInput.click();
    if(fileInput) fileInput.onchange = (e) => handleFileUpload(e.target.files[0]);
    if(jdResume) jdResume.onchange = (e) => handleFileUpload(e.target.files[0], true);

    // ===== REAL ATS SCORING v2 =====
    document.getElementById('analyzeBtn').onclick = () => {
        if(!activeResumeText) return alert("Resume upload pannu da!");
        const t = activeResumeText.toLowerCase();
        const text = activeResumeText;

        // 1. Contact Check (10%)
        const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t);
        const hasPhone = /(\+91)?[6-9]\d{9}/.test(t.replace(/\s/g,''));
        const contactScore = hasEmail && hasPhone ? 10 : hasEmail || hasPhone ? 5 : 0;

        // 2. Essential Sections (20%)
        let sectionScore = 0;
        if(t.includes("education")) sectionScore += 5;
        if(t.includes("experience") || t.includes("work history")) sectionScore += 5;
        if(t.includes("skills")) sectionScore += 5;
        if(t.includes("project")) sectionScore += 5;

        // 3. Keywords & Skills (25%) - real skill list
        const skillList = ["python","java","javascript","react","sql","excel","communication","leadership","problem solving","teamwork","html","css","node","aws","git"];
        const foundSkills = skillList.filter(s => t.includes(s)).length;
        const keywordScore = Math.min((foundSkills / 6) * 25, 25); // max 6 skills needed for full

        // 4. Formatting (25%)
        let formatScore = 0;
        if(activePages === 1) formatScore += 10; else if(activePages === 2) formatScore += 6; else formatScore += 2;
        const bulletCount = (text.match(/•|●|-|•|\*/g) || []).length;
        if(bulletCount >= 5) formatScore += 8; else if(bulletCount >= 2) formatScore += 4;
        if(text.split(/\s+/).length >= 300 && text.split(/\s+/).length <= 800) formatScore += 7; else formatScore += 2;

        // 5. Impact / Action verbs (20%)
        const actionVerbs = ["developed","managed","led","created","built","designed","implemented","achieved","increased","decreased","improved","launched"];
        const verbFound = actionVerbs.filter(v => t.includes(v)).length;
        const hasNumbers = /\d+%|\$\d+|\d+\+/.test(text); // % or $ or numbers
        let impactScore = Math.min(verbFound * 2.5, 12);
        if(hasNumbers) impactScore += 8;

        const finalScore = Math.round(contactScore + sectionScore + keywordScore + formatScore + impactScore);

        // For UI bars - break down
        const audit = {
            core: {
                "Contact (10%)": contactScore * 10,
                "Sections (20%)": sectionScore * 5,
                "Keywords (25%)": Math.round(keywordScore * 4),
                "Formatting (25%)": Math.round(formatScore * 4)
            },
            format: {
                "Impact Verbs (20%)": Math.round(impactScore * 5),
                "Length": activePages === 1 ? 95 : 60,
                "Bullet Usage": bulletCount >=5 ? 90 : 50
            }
        };

        const drawGrid = (id, obj, clr) => {
            const target = document.getElementById(id);
            let h = "";
            for(let k in obj) {
                h += `<div style="margin-bottom:12px"><div style="display:flex; justify-content:space-between; font-size:0.8rem"><span>${k}</span><span>${obj[k]}%</span></div><div class="m-bar"><div class="m-fill" style="width:${obj[k]}%; background:${clr}"></div></div></div>`;
            }
            target.innerHTML = h;
        };

        drawGrid('coreGrid', audit.core, 'var(--c1)');
        drawGrid('structGrid', audit.format, 'var(--c2)');
        drawGrid('qualGrid', { 
            "Overall Content": finalScore > 75 ? 85 : finalScore > 50 ? 70 : 45,
            "ATS Ready": finalScore > 70 ? 90 : 60
        }, 'var(--c3)');

        document.getElementById('finalScore').innerText = finalScore;
        document.getElementById('nav-report').click();
    };

    document.getElementById('matchBtn').onclick = () => {
        const jd = document.getElementById('jdArea').value.toLowerCase();
        if(!jd || !activeResumeText) return alert("Resume + JD venum");
        const keywords = [...new Set(jd.split(/\W+/).filter(w => w.length > 4))].slice(0, 25);
        const matched = keywords.filter(w => activeResumeText.toLowerCase().includes(w));
        const score = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;
        const out = document.getElementById('matchResult');
        out.classList.remove('hidden');
        out.innerHTML = `<h3>Match: ${score}%</h3><p>${matched.length}/${keywords.length} matched: ${matched.join(', ')}</p>`;
    };
});
