const API_BASE_URL = "https://video.pdfsolution.dpdns.org"; 
let originalBase64 = "";
let faceData = null; 
let specConfig = {}; 
let currentSpecId = "";
let currentCustomRatio = 0.77;
let resultPhotos = [];
let selectedResultBg = 0;
let currentLayoutBase64 = null;

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
        
        currentLayoutBase64 = null;
        document.getElementById('cropMask').classList.remove('d-none');
        
        try {
            // 呼叫 3060 上的偵測 API
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
                // Fallback (網路不通時的備用資料)
                specConfig = {
                    "passport": { "name": "2吋大頭照", "width_mm": 35, "height_mm": 45 },
                    "inch1": { "name": "1吋證件照", "width_mm": 28, "height_mm": 35 }
                };
                renderSpecList();
            }
            
            // UI 切換到 Step 2
            document.getElementById('panel-upload').classList.add('d-none');
            document.getElementById('panel-specs').classList.remove('d-none');
            selectSpec('passport'); 
        } catch (err) { alert("連線錯誤，請檢查網路"); } finally { showLoading(false); }
    };
    reader.readAsDataURL(input.files[0]);
}

function renderSpecList() {
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    for (const [key, val] of Object.entries(specConfig)) {
        const pxW = Math.round(val.width_mm * 23.622);
        const pxH = Math.round(val.height_mm * 23.622);
        
        const div = document.createElement('div');
        div.className = 'spec-card d-flex justify-content-between align-items-center';
        div.id = `spec-${key}`;
        div.onclick = () => selectSpec(key);
        
        div.innerHTML = `
            <div>
                <div class="fw-bold">${val.name}</div>
                <div class="text-muted small">${val.width_mm} x ${val.height_mm} mm</div>
            </div>
            <span class="badge bg-light text-dark border">${pxW}x${pxH}px</span>
        `;
        container.appendChild(div);
    }
}

function selectSpec(specId) {
    currentSpecId = specId;
    // UI: 移除所有 active 類別
    document.querySelectorAll('.spec-card').forEach(el => el.classList.remove('active'));
    document.getElementById('spec-custom').classList.remove('active');
    document.getElementById('custom-inputs').classList.add('d-none');

    // UI: 新增 active
    const el = document.getElementById(`spec-${specId}`);
    if(el) el.classList.add('active');
    
    if(specConfig[specId]) {
        const s = specConfig[specId];
        document.getElementById('spec-desc').innerText = `已選擇：${s.name}`;
        drawMask(s.width_mm, s.height_mm);
    }
}

function toggleCustom() {
    document.querySelectorAll('.spec-card').forEach(el => el.classList.remove('active'));
    document.getElementById('spec-custom').classList.add('active');
    document.getElementById('custom-inputs').classList.remove('d-none');
    currentSpecId = 'custom';
    updateCustom();
}

function updateCustom() {
    const w = parseFloat(document.getElementById('custom-w').value) || 35;
    const h = parseFloat(document.getElementById('custom-h').value) || 45;
    currentCustomRatio = w / h;
    const pxW = Math.round(w * 23.622);
    const pxH = Math.round(h * 23.622);
    document.getElementById('spec-desc').innerHTML = `自訂：${w}x${h}mm`;
    drawMask(w, h);
}

function drawMask(mmW, mmH) {
    const img = document.getElementById('previewImg');
    const mask = document.getElementById('cropMask');
    const label = document.getElementById('maskLabel');
    if (!img.naturalWidth) return;
    
    const pxW = Math.round(mmW * 23.622);
    const pxH = Math.round(mmH * 23.622);
    label.innerText = `${mmW}x${mmH}mm`;

    const scale = img.width / img.naturalWidth;
    let cropW, cropH, cropX, cropY;
    let targetRatio = mmW / mmH;
    
    // 這裡我們只負責前端紅框的「大概位置」，實際裁切由後端 smart_crop 負責
    // 使用 config 傳回來的 face_multiplier (預設 1.8~2.0)
    let faceMult = 2.0; 
    let topMargin = 0.12;
    
    if (currentSpecId !== 'custom' && specConfig[currentSpecId]) {
        if(specConfig[currentSpecId].face_multiplier) faceMult = specConfig[currentSpecId].face_multiplier;
        topMargin = specConfig[currentSpecId].top_margin;
    }

    if (faceData && faceData.found) {
        // 前端預覽公式：依據臉高 x 倍率 來畫框
        const realCropH = faceData.h * faceMult;
        const realCropW = realCropH * targetRatio;
        const faceCx = faceData.x + faceData.w / 2;
        const realX = faceCx - realCropW / 2;
        
        // 使用後端偵測到的頭頂位置
        const headTop = faceData.head_top_y || faceData.y;
        const realY = headTop - (realCropH * topMargin);
        
        cropW = realCropW * scale; 
        cropH = realCropH * scale; 
        cropX = realX * scale; 
        cropY = realY * scale;
    } else {
        // 沒臉時，置中畫一個框
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
    // 視窗變動時重畫遮罩
    if (currentSpecId === 'custom') updateCustom();
    else if (currentSpecId) drawMask(specConfig[currentSpecId].width_mm, specConfig[currentSpecId].height_mm);
});

async function processImage() {
    showLoading(true, "AI 製作中 (去背/修圖)...");
    try {
        const res = await fetch(`${API_BASE_URL}/generate/preview`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: originalBase64, spec_id: currentSpecId, custom_ratio: currentCustomRatio })
        });
        const data = await res.json();
        if (data.photos) {
            resultPhotos = data.photos;
            currentLayoutBase64 = null;
            document.getElementById('cropMask').classList.add('d-none');
            document.getElementById('panel-specs').classList.add('d-none');
            document.getElementById('panel-result').classList.remove('d-none');
            
            document.getElementById('img-white').src = `data:image/jpeg;base64,${data.photos[0]}`;
            document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.photos[1]}`;
            selectResult('white');
        } else { alert("錯誤: " + data.error); }
    } catch (e) { alert("連線錯誤"); } finally { showLoading(false); }
}

function selectResult(color) {
    const idx = color === 'white' ? 0 : 1;
    selectedResultBg = idx;
    
    // UI Update
    document.getElementById('res-white').classList.remove('active');
    document.getElementById('res-blue').classList.remove('active');
    document.getElementById(`res-${color}`).classList.add('active');
    
    const imgData = `data:image/jpeg;base64,${resultPhotos[idx]}`;
    document.getElementById('previewImg').src = imgData;
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
        }
    } catch(e) { alert("排版錯誤"); } finally { showLoading(false); }
}

async function runCheck() {
    if (!resultPhotos[selectedResultBg]) return;
    showLoading(true, "AI 審查中...");
    
    try {
        const res = await fetch(`${API_BASE_URL}/generate/check`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                image_base64: resultPhotos[selectedResultBg],
                spec_id: currentSpecId
            })
        });
        
        const data = await res.json();
        if (data.results) {
            const list = document.getElementById('check-results-list');
            list.innerHTML = '';
            
            data.results.forEach(item => {
                let icon = 'bi-check-circle-fill text-success';
                let bg = 'bg-light';
                if (item.status === 'warning') { icon = 'bi-exclamation-triangle-fill text-warning'; bg = 'bg-warning-subtle'; }
                if (item.status === 'fail') { icon = 'bi-x-circle-fill text-danger'; bg = 'bg-danger-subtle'; }
                
                const div = document.createElement('div');
                div.className = `list-group-item d-flex justify-content-between align-items-center ${bg}`;
                div.innerHTML = `
                    <span><i class="bi ${icon} me-2"></i> ${item.item}</span>
                    <span class="badge bg-white text-dark border">${item.msg}</span>
                `;
                list.appendChild(div);
            });
            
            const modal = new bootstrap.Modal(document.getElementById('checkModal'));
            modal.show();
        }
    } catch(e) { alert("檢查失敗"); } finally { showLoading(false); }
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
            // 如果還沒生成過排版，先生成
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
