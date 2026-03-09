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
            alert("? Invalid File: Only PDF Resume is allowed.");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            alert("? File size must be less than 5MB");
            return;
        }

        const fileNameElement = document.getElementById(isMatchPage ? 'fn2' : 'fn1');
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
                    text += content.items.map(s => s.str).join(" ");
                    if(i===1 && !isMatchPage) renderPreview(page);
                }

                const t = text.toLowerCase();
                const invalidKeywords = ["syllabus", "question bank", "marksheet", "exam", "assignment", "timetable"];
                if (invalidKeywords.some(word => t.includes(word))) {
                    alert("?? Access Denied: This looks like a Syllabus or Question Bank. Please upload a Resume.");
                    return;
                }

                const sections = ["education", "experience", "skills", "projects", "summary", "contact"];
                const foundSections = sections.filter(s => t.includes(s));

                if (foundSections.length < 3) {
                    alert("?? Not a Resume: Missing core sections like Education, Skills, or Experience.");
                    return;
                }

                activeResumeText = text;
                activeResumeText.pages = pageCount;
            } catch (err) {
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
        
        const hasEmail = t.includes("@");
        const hasPhone = (t.match(/\d{10}/) || t.includes("+"));
        const hasLinks = (t.includes("linkedin") || t.includes("github") || t.includes("portfolio"));

        const audit = {
            core: { 
                "Contact Info": (hasEmail && hasPhone) ? 100 : 40, 
                "Skills Integrity": t.includes("skills") ? 100 : 0, 
                "Work/Projects": (t.includes("experience") || t.includes("projects")) ? 100 : 0, 
                "Education": t.includes("education") ? 100 : 0 
            },
            format: {
                "Digital Links": hasLinks ? 100 : 30,
                "Length Optimization": activeResumeText.pages === 1 ? 100 : (activeResumeText.pages === 2 ? 80 : 40),
                "ATS Readability": (t.match(/[•?¦*-]/g) || []).length > 5 ? 100 : 50
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
        drawGrid('qualGrid', { "Content Depth": 85, "Formatting": 90 }, 'var(--c3)');

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
        if(!jd || !activeResumeText) return alert("Missing Resume or Job Description!");

        const keywords = jd.split(/\W+/).filter(w => w.length > 4);
        const uniqueJD = [...new Set(keywords)].slice(0, 20);
        const matched = uniqueJD.filter(w => activeResumeText.toLowerCase().includes(w));
        const score = Math.round((matched.length / uniqueJD.length) * 100);

        const out = document.getElementById('matchResult');
        out.classList.remove('hidden');
        out.innerHTML = `<h3>Match Score: ${score}%</h3><p>Found ${matched.length} critical keywords in your resume.</p>`;
    };
});