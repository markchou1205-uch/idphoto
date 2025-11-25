const API_BASE_URL = "https://video.pdfsolution.dpdns.org"; 
let originalBase64 = "";
let faceData = null; 
let specConfig = {}; 
let currentSpecId = "passport"; 
let currentCustomRatio = 0.77;
let resultPhotos = [];
let selectedResultBg = 0;
let currentLayoutBase64 = null;
let currentFeature = 'id-photo';
let isImageLoaded = false;
let currentZoom = 1.0; // 新增：縮放倍率

// 1. 定義完整的預設規格 (解決首頁顯示不專業的問題)
const DEFAULT_SPECS = {
    "passport": { 
        "name": "護照 / 身分證", 
        "desc": "2吋 (35x45mm) - 頭部 3.2~3.6cm", 
        "width_mm": 35, "height_mm": 45, 
        "face_multiplier": 1.85, "top_margin": 0.09 
    },
    "resume": { 
        "name": "健保卡 / 履歷 / 半身照", 
        "desc": "2吋 (42x47mm)", 
        "width_mm": 42, "height_mm": 47,
        "face_multiplier": 2.5, "top_margin": 0.15 
    },
    "inch1": { 
        "name": "駕照 / 執照 / 證書", 
        "desc": "1吋 (28x35mm)", 
        "width_mm": 28, "height_mm": 35,
        "face_multiplier": 2.0, "top_margin": 0.12 
    },
    "visa_us": { 
        "name": "美國簽證", 
        "desc": "5x5cm (51x51mm)", 
        "width_mm": 51, "height_mm": 51,
        "face_multiplier": 2.2, "top_margin": 0.15 
    }
};

window.onload = function() {
    // 初始化使用完整規格
    specConfig = DEFAULT_SPECS;
    renderSpecList();
    setTimeout(() => selectSpec('passport'), 100);
};

// --- Navigation ---
function goHome() {
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    document.getElementById('dashboard-area').classList.remove('d-none');
    document.getElementById('intro-area').classList.add('d-none');
    document.getElementById('workspace-area').classList.add('d-none');
    switchFeature('id-photo', false); 
    document.getElementById('dashboard-area').classList.remove('d-none');
}

function switchFeature(featureId, updateRightPanel = true) {
    currentFeature = featureId;
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${featureId}`);
    if(navEl) navEl.classList.add('active');

    document.querySelectorAll('.feature-panel').forEach(el => el.classList.add('d-none'));
    const panel = document.getElementById(`panel-${featureId}`);
    if (panel) panel.classList.remove('d-none');
    if (!panel) document.getElementById('panel-job-photo').classList.remove('d-none');

    if (updateRightPanel) {
        if (isImageLoaded && featureId === 'id-photo') showWorkspace();
        else showIntro(featureId);
    }
}

function showIntro(featureId) {
    document.getElementById('dashboard-area').classList.add('d-none');
    document.getElementById('workspace-area').classList.add('d-none');
    const intro = document.getElementById('intro-area');
    intro.classList.remove('d-none');
    intro.className = "container py-5 h-100 d-flex align-items-center justify-content-center text-center animate-fade";

    const content = {
        'id-photo': { title: '證件照製作', icon: 'bi-person-badge-fill', desc: '上傳生活照，AI 自動去背、裁切、排版。<br>支援護照、簽證、駕照等多國規格。' },
        'job-photo': { title: '職場求職照', icon: 'bi-briefcase-fill', desc: 'AI 智慧換裝，一鍵生成專業形象照。<br>(需 RTX 3090 算力支援)' },
        'grad-photo': { title: '畢業學士照', icon: 'bi-mortarboard-fill', desc: '雲端生成學士服照片，紀念青春時刻。<br>(需 RTX 3090 算力支援)' },
        'beauty': { title: '智能美顏', icon: 'bi-magic', desc: '磨皮、瘦臉、大眼，自然美化不失真。' },
        'restore': { title: '老圖翻新', icon: 'bi-hourglass-split', desc: '修復破損、去除噪點、黑白上色。' }
    };
    const data = content[featureId] || content['id-photo'];
    document.getElementById('intro-title').innerText = data.title;
    document.getElementById('intro-icon').className = `bi ${data.icon} fs-1 text-primary`;
    document.getElementById('intro-desc').innerHTML = data.desc;
}

function showWorkspace() {
    document.getElementById('dashboard-area').classList.add('d-none');
    document.getElementById('intro-area').classList.add('d-none');
    document.getElementById('workspace-area').classList.remove('d-none');
    setTimeout(() => {
        if(currentSpecId === 'custom') updateCustom();
        else if(specConfig[currentSpecId]) drawMask(specConfig[currentSpecId].width_mm, specConfig[currentSpecId].height_mm);
    }, 100);
}

// --- Logic ---
function handleFileUpload(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    showLoading(true, "讀取照片中...");
    reader.onload = async function() {
        originalBase64 = reader.result;
        document.getElementById('previewImg').src = originalBase64;
        document.getElementById('previewImg').classList.remove('d-none');
        isImageLoaded = true;
        
        // 重置縮放
        setZoom(1.0);
        document.getElementById('zoomRange').value = 1.0;

        document.querySelector('.upload-btn-wrapper').classList.add('d-none');
        document.getElementById('uploaded-status').classList.remove('d-none');
        document.getElementById('btn-process').classList.remove('d-none');
        showWorkspace();
        document.getElementById('cropMask').classList.remove('d-none');
        
        try {
            const res = await fetch(`${API_BASE_URL}/generate/detect`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ image_base64: originalBase64 })
            });
            if (res.ok) {
                const data = await res.json();
                faceData = data.found ? data : null;
                // 這裡我們保留原本選擇的規格，不被後端可能回傳的空值覆蓋
                selectSpec(currentSpecId); 
            }
        } catch (err) { console.log("偵測失敗"); } finally { showLoading(false); }
    };
    reader.readAsDataURL(input.files[0]);
}

function resetUpload() { location.reload(); }

// 2. 修正渲染列表：用途(Name) 為主，尺寸(Desc) 為輔
function renderSpecList() {
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    for (const [key, val] of Object.entries(specConfig)) {
        const div = document.createElement('div');
        div.className = 'spec-card';
        div.id = `spec-${key}`;
        div.onclick = () => selectSpec(key);
        
        // 這裡使用了 DEFAULT_SPECS 裡的 name (用途) 和 desc (尺寸)
        // 如果是自訂或後端回傳沒有 desc，就自動組合
        const title = val.name;
        const subtitle = val.desc || `${val.width_mm} x ${val.height_mm} mm`;

        div.innerHTML = `
            <div>
                <div class="fw-bold text-dark" style="font-size: 1rem;">${title}</div>
                <div class="text-muted" style="font-size: 0.8rem;">${subtitle}</div>
            </div>
            <i class="bi bi-check-circle-fill text-primary d-none check-icon fs-5"></i>
        `;
        container.appendChild(div);
    }
}

function selectSpec(specId) {
    currentSpecId = specId;
    document.querySelectorAll('.spec-card').forEach(el => {
        el.classList.remove('active');
        const icon = el.querySelector('.check-icon');
        if (icon) icon.classList.add('d-none');
    });
    document.getElementById('custom-inputs').classList.add('d-none');
    const el = document.getElementById(`spec-${specId}`);
    if(el) {
        el.classList.add('active');
        const icon = el.querySelector('.check-icon');
        if (icon) icon.classList.remove('d-none');
    }
    if(isImageLoaded && specConfig[specId]) drawMask(specConfig[specId].width_mm, specConfig[specId].height_mm);
}

function toggleCustom() {
    document.querySelectorAll('.spec-card').forEach(el => {
        el.classList.remove('active');
        const icon = el.querySelector('.check-icon');
        if (icon) icon.classList.add('d-none');
    });
    document.getElementById('spec-custom').classList.add('active');
    document.getElementById('custom-inputs').classList.remove('d-none');
    currentSpecId = 'custom';
    updateCustom();
}

function updateCustom() {
    const w = parseFloat(document.getElementById('custom-w').value) || 35;
    const h = parseFloat(document.getElementById('custom-h').value) || 45;
    currentCustomRatio = w / h;
    if(isImageLoaded) drawMask(w, h);
}

function drawMask(mmW, mmH) {
    const img = document.getElementById('previewImg');
    const mask = document.getElementById('cropMask');
    const label = document.getElementById('maskLabel');
    if (!img.naturalWidth) return;
    
    label.innerText = `${mmW}x${mmH}mm`;
    const scale = img.width / img.naturalWidth;
    let targetRatio = mmW / mmH;
    
    // 讀取各規格的專屬倍率
    let faceMult = 2.0; 
    let topMargin = 0.12;
    if (currentSpecId !== 'custom' && specConfig[currentSpecId]) {
        if(specConfig[currentSpecId].face_multiplier) faceMult = specConfig[currentSpecId].face_multiplier;
        if(specConfig[currentSpecId].top_margin) topMargin = specConfig[currentSpecId].top_margin;
    }

    let cropW, cropH, cropX, cropY;
    if (faceData && faceData.found) {
        const realCropH = faceData.h * faceMult;
        const realCropW = realCropH * targetRatio;
        const faceCx = faceData.x + faceData.w / 2;
        const realX = faceCx - realCropW / 2;
        const headTop = faceData.head_top_y || faceData.y;
        const realY = headTop - (realCropH * topMargin);
        cropW = realCropW * scale; cropH = realCropH * scale; cropX = realX * scale; cropY = realY * scale;
    } else {
        cropH = img.height; cropW = cropH * targetRatio;
        if (cropW > img.width) { cropW = img.width; cropH = cropW / targetRatio; }
        cropX = (img.width - cropW) / 2; cropY = (img.height - cropH) / 2;
    }
    mask.style.width = `${cropW}px`; mask.style.height = `${cropH}px`; mask.style.left = `${cropX}px`; mask.style.top = `${cropY}px`;
    mask.classList.remove('d-none');
}

// 3. 新增縮放控制
function setZoom(value) {
    currentZoom = parseFloat(value);
    const wrapper = document.querySelector('.image-wrapper');
    if(wrapper) {
        // 同時縮放圖片與遮罩，因為遮罩在 wrapper 內部
        wrapper.style.transform = `scale(${currentZoom})`;
        wrapper.style.transformOrigin = "center top"; // 從上方中間縮放比較自然
    }
    // 更新顯示數值
    document.getElementById('zoomValue').innerText = Math.round(currentZoom * 100) + '%';
}

window.addEventListener('resize', () => {
    if (isImageLoaded) {
        if(currentSpecId === 'custom') updateCustom();
        else if(specConfig[currentSpecId]) drawMask(specConfig[currentSpecId].width_mm, specConfig[currentSpecId].height_mm);
    }
});

// ... (其餘後端串接函式保持不變：processImage, runCheck, applyFix, etc.) ...
async function processImage() {
    showLoading(true, "AI 製作中...");
    try {
        const res = await fetch(`${API_BASE_URL}/generate/preview`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: originalBase64, spec_id: currentSpecId, custom_ratio: currentCustomRatio })
        });
        const data = await res.json();
        if (data.photos) {
            resultPhotos = data.photos;
            document.getElementById('specs-section').classList.add('d-none');
            document.getElementById('result-section').classList.remove('d-none');
            document.getElementById('cropMask').classList.add('d-none');
            // 製作完成後，重置縮放以便查看全圖
            setZoom(1.0); document.getElementById('zoomRange').value = 1.0;
            document.getElementById('zoom-toolbar').classList.add('d-none'); // 隱藏縮放列

            document.getElementById('img-white').src = `data:image/jpeg;base64,${data.photos[0]}`;
            document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.photos[1]}`;
            selectResult('white');
        } else { alert("錯誤: " + data.error); }
    } catch (e) { alert("連線錯誤"); } finally { showLoading(false); }
}

function selectResult(color) {
    const idx = color === 'white' ? 0 : 1;
    selectedResultBg = idx;
    document.getElementById('res-white').classList.remove('active');
    document.getElementById('res-blue').classList.remove('active');
    document.getElementById(`res-${color}`).classList.add('active');
    document.getElementById('previewImg').src = `data:image/jpeg;base64,${resultPhotos[idx]}`;
}

async function runCheck() {
    if (!resultPhotos[selectedResultBg]) return;
    showLoading(true, "AI 審查中...");
    try {
        const res = await fetch(`${API_BASE_URL}/generate/check`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: resultPhotos[selectedResultBg], spec_id: currentSpecId })
        });
        const data = await res.json();
        if (data.error) { alert("後端錯誤: " + data.error); return; }
        if (data.results) {
            const list = document.getElementById('check-results-list');
            list.innerHTML = '';
            let failCount = 0, warningCount = 0, fixableCount = 0, unfixableCount = 0;
            data.results.forEach(item => {
                if(item.status === 'fail') failCount++;
                if(item.status === 'warning') warningCount++;
                if ((item.status === 'fail' || item.status === 'warning') && !item.fix_action) unfixableCount++;
                if(item.fix_action) fixableCount++;
            });
            let summaryHtml = '';
            let totalIssues = failCount + warningCount;
            if (totalIssues === 0) {
                summaryHtml = `<div class="alert alert-success border-0 shadow-sm mb-3 text-center"><i class="bi bi-check-circle-fill fs-3 d-block mb-2"></i><h5 class="fw-bold">照片符合標準</h5><p class="mb-0 small">太棒了！這張照片符合 AI 初步審查標準。</p></div>`;
            } else if (unfixableCount > 0) {
                summaryHtml = `<div class="alert alert-danger border-0 shadow-sm mb-3"><h5 class="fw-bold text-danger"><i class="bi bi-exclamation-triangle-fill me-2"></i>建議重新拍攝</h5><p class="mb-1 small">經審查發現 <strong>${totalIssues}</strong> 個缺失，其中包含無法修復的項目。</p><div class="mt-2"><button class="btn btn-sm btn-outline-danger w-100" onclick="document.getElementById('fileInput').click()">重新上傳</button></div></div>`;
            } else {
                summaryHtml = `<div class="alert alert-primary border-0 shadow-sm mb-3"><h5 class="fw-bold text-primary"><i class="bi bi-magic me-2"></i>發現可修復的問題</h5><p class="mb-1 small">發現 <strong>${totalIssues}</strong> 個可修復缺失，建議使用「AI 修復」。</p></div>`;
            }
            list.innerHTML = summaryHtml;
            data.results.forEach(item => {
                let icon = 'bi-check-circle-fill text-success'; let bg = 'bg-light'; let actionBtn = '';
                if (item.status === 'warning') { icon = 'bi-exclamation-triangle-fill text-warning'; bg = 'bg-warning-subtle'; }
                if (item.status === 'fail') { icon = 'bi-x-circle-fill text-danger'; bg = 'bg-danger-subtle'; }
                if (item.fix_action) actionBtn = `<button class="btn btn-sm btn-primary ms-2 shadow-sm" onclick="applyFix('${item.fix_action}')"><i class="bi bi-magic"></i> 修復</button>`;
                const div = document.createElement('div');
                div.className = `list-group-item d-flex justify-content-between align-items-center ${bg} mb-1 border-0 rounded`;
                div.innerHTML = `<span><i class="bi ${icon} me-2"></i> ${item.item}</span><div class="d-flex align-items-center"><span class="badge bg-white text-dark border me-1">${item.msg}</span>${actionBtn}</div>`;
                list.appendChild(div);
            });
            new bootstrap.Modal(document.getElementById('checkModal')).show();
        }
    } catch(e) { alert("檢查失敗: " + e.message); } finally { showLoading(false); }
}

async function applyFix(actionType) {
    const modalEl = document.getElementById('checkModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();
    showLoading(true, "AI 修復中...");
    try {
        const res = await fetch(`${API_BASE_URL}/generate/fix`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: resultPhotos[selectedResultBg], action: actionType })
        });
        const data = await res.json();
        if(data.image_base64) {
            resultPhotos[selectedResultBg] = data.image_base64;
            if(selectedResultBg === 0) document.getElementById('img-white').src = `data:image/jpeg;base64,${data.image_base64}`;
            else document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.image_base64}`;
            selectResult(selectedResultBg === 0 ? 'white' : 'blue');
            alert("✅ 修復完成！");
        } else { alert("修復失敗: " + (data.error || "未知錯誤")); }
    } catch(e) { alert("連線錯誤"); } finally { showLoading(false); }
}

function downloadImage() {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${resultPhotos[selectedResultBg]}`;
    link.download = `id_photo_high_res_${Date.now()}.jpg`;
    link.click();
}

async function generateLayout() {
    showLoading(true, "排版生成中...");
    try {
        const res = await fetch(`${API_BASE_URL}/generate/layout`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: resultPhotos[selectedResultBg] })
        });
        const data = await res.json();
        if (data.layout_image) {
            currentLayoutBase64 = data.layout_image;
            const imgUrl = `data:image/jpeg;base64,${data.layout_image}`;
            document.getElementById('previewImg').src = imgUrl;
            const link = document.createElement('a');
            link.href = imgUrl;
            link.download = `layout_4x6_${Date.now()}.jpg`;
            link.click();
        } else { alert(data.error || "排版失敗"); }
    } catch(e) { alert("排版錯誤"); } finally { showLoading(false); }
}

function toggleEmailInput() { document.getElementById('email-group').classList.toggle('d-none'); }
async function sendEmail() {
    const email = document.getElementById('user-email').value;
    if (!email || !email.includes("@")) { alert("請輸入有效的 Email"); return; }
    showLoading(true, "正在寄送...");
    try {
        let imgToSend = currentLayoutBase64;
        if (!imgToSend) {
            const resLayout = await fetch(`${API_BASE_URL}/generate/layout`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ image_base64: resultPhotos[selectedResultBg] })
            });
            const dataLayout = await resLayout.json();
            imgToSend = dataLayout.layout_image;
        }
        const resEmail = await fetch(`${API_BASE_URL}/send-email`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: email, image_base64: imgToSend })
        });
        const dataEmail = await resEmail.json();
        if (dataEmail.status === "SUCCESS") {
            alert("✅ 郵件已發送！");
            document.getElementById('email-group').classList.add('d-none');
        } else { alert("❌ 發送失敗: " + (dataEmail.error || "未知錯誤")); }
    } catch (e) { alert("錯誤: " + e.message); } finally { showLoading(false); }
}

function showLoading(show, text="處理中...") {
    const el = document.getElementById('loading');
    if(show) { el.querySelector('div.text-dark').innerText = text; el.style.display = 'flex'; }
    else { el.style.display = 'none'; }
}
