document.addEventListener("DOMContentLoaded", function() {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    let activeResumeText = "";
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
        const allowedTypes = ["application/pdf"];
        if (!allowedTypes.includes(file.type)) {
            alert(" Invalid File - Only PDF allowed");
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            alert(" File size must be less than 5MB");
            return;
        }

        const fileNameElement = document.getElementById(isMatchPage? 'fn2' : 'fn1');
        if(fileNameElement) fileNameElement.innerText = file.name;

        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const pdf = await pdfjsLib.getDocument({data: new Uint8Array(this.result)}).promise;
                const pageCount = pdf.numPages;
                let text = "";
                for(let i=1; i<=pageCount; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(s => s.str).join(" ") + " ";
                    if(i===1 &&!isMatchPage) renderPreview(page);
                }
                const t = text.toLowerCase();
                const invalidKeywords = ["syllabus", "question bank", "marksheet", "exam timetable"];
                if (invalidKeywords.some(word => t.includes(word)) &&!t.includes("resume") &&!t.includes("curriculum")) {
                    alert("Access Denied: Please upload a Resume, not a question paper.");
                    return;
                }
                const sections = ["education", "experience", "skills", "projects", "summary", "contact"];
                const foundSections = sections.filter(s => t.includes(s));
                if (foundSections.length < 2) {
                    alert("⚠️ Not a proper Resume: Add Education, Skills, Experience sections.");
                    return;
                }
                activeResumeText = text;
                activeResumeText.pages = pageCount;
                alert("✅ Resume loaded! Click Analyze");
            } catch (err) {
                console.error(err);
                alert("Error reading PDF.");
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function renderPreview(page) {
        const canvas = document.getElementById('pdfPreview');
        if(!canvas) return;
        const vp = page.getViewport({scale: 0.8});
        canvas.height = vp.height; canvas.width = vp.width;
        page.render({canvasContext: canvas.getContext('2d'), viewport: vp});
        canvas.style.display = 'block';
    }

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const jdResume = document.getElementById('jdResume');

    if(dropZone) dropZone.onclick = () => fileInput.click();
    if(fileInput) fileInput.onchange = (e) => handleFileUpload(e.target.files[0]);
    if(jdResume) jdResume.onchange = (e) => handleFileUpload(e.target.files[0], true);

    document.getElementById('analyzeBtn').onclick = () => {
        if(!activeResumeText) return alert("Please upload a valid resume PDF first!");
        const t = activeResumeText.toLowerCase();

        // FIXED DETECTION
        const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(t);
        const hasPhone = /(\+91[\s-]?)?[6-9]\d{9}|\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(t);
        const hasLinks = (t.includes("linkedin") || t.includes("github") || t.includes("portfolio"));

        const audit = {
            core: {
                "Contact Info": (hasEmail && hasPhone)? 100 : (hasEmail || hasPhone? 60 : 20),
                "Skills Integrity": t.includes("skills")? 90 : 30,
                "Work/Projects": (t.includes("experience") || t.includes("projects"))? 90 : 25,
                "Education": t.includes("education")? 90 : 30
            },
            format: {
                "Digital Links": hasLinks? 95 : 45,
                "Length Optimization": activeResumeText.pages === 1? 95 : (activeResumeText.pages === 2? 75 : 35),
                "ATS Readability": (t.match(/[•●\-\*]/g) || []).length > 3? 90 : 55
            }
        };

        const drawGrid = (id, obj, clr) => {
            const target = document.getElementById(id);
            if(!target) return;
            let h = "";
            for(let k in obj) {
                h += `<div style="margin-bottom:12px"><div style="display:flex; justify-content:space-between; font-size:0.8rem"><span>${k}</span><span>${obj[k]}%</span></div><div class="m-bar"><div class="m-fill" style="width:${obj[k]}%; background:${clr}"></div></div></div>`;
            }
            target.innerHTML = h;
        };

        drawGrid('coreGrid', audit.core, 'var(--c1)');
        drawGrid('structGrid', audit.format, 'var(--c2)');

        // More realistic content depth based on word count
        const wordCount = activeResumeText.split(/\s+/).length;
        const contentScore = wordCount > 400? 85 : wordCount > 250? 70 : 45;
        drawGrid('qualGrid', { "Content Depth": contentScore, "Formatting": audit.format["ATS Readability"] }, 'var(--c3)');

        let total = 0, count = 0;
        [audit.core, audit.format].forEach(group => {
            Object.values(group).forEach(val => { total += val; count++; });
        });

        const score = Math.round(total / count);
        document.getElementById('finalScore').innerText = score;
        document.getElementById('nav-report').click();
    };

    document.getElementById('matchBtn').onclick = () => {
        const jd = document.getElementById('jdArea').value.toLowerCase();
        if(!jd ||!activeResumeText) return alert("Missing Resume or Job Description!");
        const keywords = jd.split(/\W+/).filter(w => w.length > 4);
        const uniqueJD = [...new Set(keywords)].slice(0, 20);
        const matched = uniqueJD.filter(w => activeResumeText.toLowerCase().includes(w));
        const score = uniqueJD.length? Math.round((matched.length / uniqueJD.length) * 100) : 0;
        const out = document.getElementById('matchResult');
        out.classList.remove('hidden');
        out.innerHTML = `<h3>Match Score: ${score}%</h3><p>Found ${matched.length}/${uniqueJD.length} keywords: ${matched.join(', ')}</p>`;
    };
});
