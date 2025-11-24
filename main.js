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

// 初始化
window.onload = function() {
    // 預載規格列表
    specConfig = {
        "passport": { "name": "2吋大頭照", "width_mm": 35, "height_mm": 45 },
        "inch1": { "name": "1吋證件照", "width_mm": 28, "height_mm": 35 },
        "resume": { "name": "2吋半身照", "width_mm": 42, "height_mm": 47 },
        "visa_us": { "name": "美國簽證", "width_mm": 51, "height_mm": 51 }
    };
    renderSpecList();
    // 預設選中
    setTimeout(() => selectSpec('passport'), 100);
};

// --- Navigation & Layout Logic ---

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
        if (isImageLoaded && featureId === 'id-photo') {
            showWorkspace();
        } else {
            showIntro(featureId);
        }
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

// --- File Upload & Logic ---

function handleFileUpload(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    showLoading(true, "讀取照片中...");
    reader.onload = async function() {
        originalBase64 = reader.result;
        const img = document.getElementById('previewImg');
        img.src = originalBase64;
        img.classList.remove('d-none');
        
        isImageLoaded = true;

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
                if(data.specs) {
                    specConfig = data.specs;
                    renderSpecList();
                    // 重新選擇當前規格以更新遮罩
                    selectSpec(currentSpecId); 
                }
            }
        } catch (err) { console.log("偵測失敗"); } finally { showLoading(false); }
    };
    reader.readAsDataURL(input.files[0]);
}

function resetUpload() {
    document.querySelector('.upload-btn-wrapper').classList.remove('d-none');
    document.getElementById('uploaded-status').classList.add('d-none');
    document.getElementById('btn-process').classList.add('d-none');
    document.getElementById('result-section').classList.add('d-none');
    document.getElementById('specs-section').classList.remove('d-none');
    
    document.getElementById('previewImg').classList.add('d-none');
    document.getElementById('cropMask').classList.add('d-none');
    isImageLoaded = false;
    
    showIntro(currentFeature);
}

function renderSpecList() {
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    for (const [key, val] of Object.entries(specConfig)) {
        const div = document.createElement('div');
        div.className = 'spec-card';
        div.id = `spec-${key}`;
        div.onclick = () => selectSpec(key);
        
        div.innerHTML = `
            <div>
                <div class="fw-bold" style="font-size: 0.95rem;">${val.name}</div>
                <div class="text-muted" style="font-size: 0.75rem;">${val.width_mm} x ${val.height_mm} mm</div>
            </div>
            <i class="bi bi-check-circle-fill text-primary d-none check-icon"></i>
        `;
        container.appendChild(div);
    }
}

// 修正後的 selectSpec：增加防呆判斷
function selectSpec(specId) {
    currentSpecId = specId;
    
    // 清除其他卡片的 active 狀態
    document.querySelectorAll('.spec-card').forEach(el => {
        el.classList.remove('active');
        // 關鍵修正：先確認有沒有 check-icon 才去操作 classList
        const icon = el.querySelector('.check-icon');
        if (icon) icon.classList.add('d-none');
    });
    
    // 隱藏自訂輸入框
    document.getElementById('custom-inputs').classList.add('d-none');

    // 啟用當前卡片
    const el = document.getElementById(`spec-${specId}`);
    if(el) {
        el.classList.add('active');
        const icon = el.querySelector('.check-icon');
        if (icon) icon.classList.remove('d-none');
    }
    
    // 更新遮罩
    if(isImageLoaded && specConfig[specId]) {
        drawMask(specConfig[specId].width_mm, specConfig[specId].height_mm);
    }
}

function toggleCustom() {
    document.querySelectorAll('.spec-card').forEach(el => {
        el.classList.remove('active');
        const icon = el.querySelector('.check-icon');
        if (icon) icon.classList.add('d-none');
    });
    
    const customBtn = document.getElementById('spec-custom');
    if(customBtn) customBtn.classList.add('active');

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
    let faceMult = 2.0; 
    let topMargin = 0.12;

    if (currentSpecId !== 'custom' && specConfig[currentSpecId]) {
        if(specConfig[currentSpecId].face_multiplier) faceMult = specConfig[currentSpecId].face_multiplier;
        topMargin = specConfig[currentSpecId].top_margin;
    }

    let cropW, cropH, cropX, cropY;

    if (faceData && faceData.found) {
        const realCropH = faceData.h * faceMult;
        const realCropW = realCropH * targetRatio;
        const faceCx = faceData.x + faceData.w / 2;
        const realX = faceCx - realCropW / 2;
        const headTop = faceData.head_top_y || faceData.y;
        const realY = headTop - (realCropH * topMargin);
        
        cropW = realCropW * scale; 
        cropH = realCropH * scale; 
        cropX = realX * scale; 
        cropY = realY * scale;
    } else {
        cropH = img.height; cropW = cropH * targetRatio;
        if (cropW > img.width) { cropW = img.width; cropH = cropW / targetRatio; }
        cropX = (img.width - cropW) / 2; cropY = (img.height - cropH) / 2;
    }

    mask.style.width = `${cropW}px`; 
    mask.style.height = `${cropH}px`; 
    mask.style.left = `${cropX}px`; 
    mask.style.top = `${cropY}px`;
    mask.classList.remove('d-none');
}

window.addEventListener('resize', () => {
    if (isImageLoaded) {
        if(currentSpecId === 'custom') updateCustom();
        else if(specConfig[currentSpecId]) drawMask(specConfig[currentSpecId].width_mm, specConfig[currentSpecId].height_mm);
    }
});

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

function downloadImage() {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${resultPhotos[selectedResultBg]}`;
    link.download = `id_photo_high_res_${Date.now()}.jpg`;
    link.click();
}

// 補回完整功能
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
        }
    } catch(e) { alert("排版錯誤"); } finally { showLoading(false); }
}

function toggleEmailInput() {
    document.getElementById('email-group').classList.toggle('d-none');
}

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
    if(show) {
        el.querySelector('div.text-dark').innerText = text;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}
