const API_BASE_URL = "https://video.pdfsolution.dpdns.org"; 
let originalBase64 = "";
let faceData = null; 
let specConfig = {}; 
let currentSpecId = "";
let currentCustomRatio = 0.77;
let resultPhotos = [];
let selectedResultBg = 0;
let currentLayoutBase64 = null;

// --- Sidebar Logic ---

function switchFeature(featureId, btn) {
    // 1. Level 1 Active State
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');

    // 2. Level 2 Panel Switch
    document.querySelectorAll('.feature-panel').forEach(el => el.classList.add('d-none'));
    const panel = document.getElementById(`panel-${featureId}`);
    if (panel) panel.classList.remove('d-none');

    // 3. 如果側邊欄是隱藏的，點擊 Level 1 時自動展開
    const isHidden = document.body.classList.contains('sidebar-collapsed');
    if (isHidden) toggleSidebar(true);
}

function toggleSidebar(show) {
    const icons = document.getElementById('sidebar-icons');
    const panels = document.getElementById('sidebar-panels');
    const body = document.body;

    if (show) {
        icons.classList.remove('hidden');
        panels.classList.remove('hidden');
        body.classList.remove('sidebar-collapsed');
    } else {
        icons.classList.add('hidden');
        panels.classList.add('hidden');
        body.classList.add('sidebar-collapsed');
    }
    
    // 等動畫結束後重畫遮罩，以免位置跑掉
    setTimeout(() => {
        if (currentSpecId) {
             const s = specConfig[currentSpecId] || {};
             // 如果是自訂，傳入現在的寬高
             if(currentSpecId === 'custom') updateCustom();
             else drawMask(s.width_mm, s.height_mm);
        }
    }, 350);
}

// --- ID Photo Logic ---

function handleFileUpload(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    showLoading(true, "讀取中...");
    reader.onload = async function() {
        originalBase64 = reader.result;
        const img = document.getElementById('previewImg');
        img.src = originalBase64;
        img.classList.remove('d-none');
        document.getElementById('empty-msg').classList.add('d-none');
        
        // **自動隱藏側邊欄** (符合您的需求)
        toggleSidebar(false); 

        currentLayoutBase64 = null;
        document.getElementById('cropMask').classList.remove('d-none');
        
        try {
            const res = await fetch(`${API_BASE_URL}/generate/detect`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ image_base64: originalBase64 })
            });
            
            if (res.ok) {
                const data = await res.json();
                faceData = data.found ? data : null;
                if(data.specs) specConfig = data.specs;
                renderSpecList(); 
            } else {
                specConfig = {
                    "passport": { "name": "2吋大頭照", "width_mm": 35, "height_mm": 45 },
                    "inch1": { "name": "1吋證件照", "width_mm": 28, "height_mm": 35 }
                };
                renderSpecList();
            }
            
            // 切換步驟
            document.getElementById('step-upload').classList.add('d-none');
            document.getElementById('step-specs').classList.remove('d-none');
            
            // 預設選第一個
            selectSpec('passport'); 
            
        } catch (err) { alert("連線錯誤"); } finally { showLoading(false); }
    };
    reader.readAsDataURL(input.files[0]);
}

function resetUpload() {
    document.getElementById('step-specs').classList.add('d-none');
    document.getElementById('step-result').classList.add('d-none');
    document.getElementById('step-upload').classList.remove('d-none');
    document.getElementById('cropMask').classList.add('d-none');
    document.getElementById('previewImg').classList.add('d-none');
    document.getElementById('empty-msg').classList.remove('d-none');
    toggleSidebar(true); // 重選時打開側邊欄
}

function renderSpecList() {
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    for (const [key, val] of Object.entries(specConfig)) {
        const pxW = Math.round(val.width_mm * 11.811 * 2); // 估算 pixel 顯示用
        const pxH = Math.round(val.height_mm * 11.811 * 2);
        
        const div = document.createElement('div');
        div.className = 'spec-card d-flex justify-content-between align-items-center';
        div.id = `spec-${key}`;
        div.onclick = () => selectSpec(key);
        
        div.innerHTML = `
            <div>
                <div class="fw-bold">${val.name}</div>
                <div class="text-muted small">${val.width_mm} x ${val.height_mm} mm</div>
            </div>
        `;
        container.appendChild(div);
    }
}

function selectSpec(specId) {
    currentSpecId = specId;
    document.querySelectorAll('.spec-card').forEach(el => el.classList.remove('active'));
    document.getElementById('custom-inputs').classList.add('d-none');

    const el = document.getElementById(`spec-${specId}`);
    if(el) el.classList.add('active');
    
    if(specConfig[specId]) {
        drawMask(specConfig[specId].width_mm, specConfig[specId].height_mm);
    }
}

function toggleCustom() {
    document.querySelectorAll('.spec-card').forEach(el => el.classList.remove('active'));
    document.getElementById('custom-inputs').classList.remove('d-none');
    currentSpecId = 'custom';
    updateCustom();
}

function updateCustom() {
    const w = parseFloat(document.getElementById('custom-w').value) || 35;
    const h = parseFloat(document.getElementById('custom-h').value) || 45;
    currentCustomRatio = w / h;
    drawMask(w, h);
}

function drawMask(mmW, mmH) {
    const img = document.getElementById('previewImg');
    const mask = document.getElementById('cropMask');
    const label = document.getElementById('maskLabel');
    if (!img.naturalWidth) return;
    
    // UI Label
    label.innerText = `${mmW}x${mmH}mm`;

    // 計算
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

    // 因為 mask 是 absolute 且 parent 是 relative 的 image-wrapper
    // 所以這裡的 left/top 就是相對於圖片左上角的距離，這樣就不會跑掉了
    mask.style.width = `${cropW}px`; 
    mask.style.height = `${cropH}px`; 
    mask.style.left = `${cropX}px`; 
    mask.style.top = `${cropY}px`;
    mask.classList.remove('d-none');
}

window.addEventListener('resize', () => {
    if (currentSpecId === 'custom') updateCustom();
    else if (currentSpecId && specConfig[currentSpecId]) {
        drawMask(specConfig[currentSpecId].width_mm, specConfig[currentSpecId].height_mm);
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
            
            // UI Switch
            document.getElementById('step-specs').classList.add('d-none');
            document.getElementById('step-result').classList.remove('d-none');
            document.getElementById('cropMask').classList.add('d-none');
            
            // Auto open sidebar if user wants to see download buttons clearly? 
            // Optional: toggleSidebar(true); 
            
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

async function generateLayout() { /* ... 同前 ... */ }
function toggleEmailInput() { document.getElementById('email-group').classList.toggle('d-none'); }
async function sendEmail() { /* ... 同前 ... */ }

function showLoading(show, text="處理中...") {
    const el = document.getElementById('loading');
    if(show) {
        el.querySelector('div.text-dark').innerText = text;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}
