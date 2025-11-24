const API_BASE_URL = "https://video.pdfsolution.dpdns.org"; 
let originalBase64 = "";
let faceData = null; 
let specConfig = {}; 
let currentSpecId = "";
let currentCustomRatio = 0.77;
let resultPhotos = [];
let selectedResultBg = 0; // 0=white, 1=blue
let currentLayoutBase64 = null; // 存儲排版圖

// 1. 上傳與初始化
function handleFileUpload(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    showLoading(true);
    reader.onload = async function() {
        originalBase64 = reader.result;
        const img = document.getElementById('previewImg');
        img.src = originalBase64;
        img.classList.remove('d-none');
        document.getElementById('empty-msg').classList.add('d-none');
        
        // 重置狀態
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
                // Fallback 預設規格
                specConfig = {
                    "passport": { "name": "2吋大頭照", "width_mm": 35, "height_mm": 45 },
                    "inch1": { "name": "1吋證件照", "width_mm": 28, "height_mm": 35 }
                };
                renderSpecList();
            }
            
            document.getElementById('panel-upload').classList.add('d-none');
            document.getElementById('panel-specs').classList.remove('d-none');
            selectSpec('passport'); 
        } catch (err) { 
            console.error(err);
            alert("連線錯誤，請檢查網路"); 
        } finally { showLoading(false); }
    };
    reader.readAsDataURL(input.files[0]);
}

// 2. 渲染規格選單 (含解析度計算)
function renderSpecList() {
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    
    for (const [key, val] of Object.entries(specConfig)) {
        // 計算高清解析度 (600 DPI)
        // 1mm = 23.622 px
        const pxW = Math.round(val.width_mm * 23.622);
        const pxH = Math.round(val.height_mm * 23.622);
        
        const div = document.createElement('div');
        div.className = 'spec-card';
        div.id = `spec-${key}`;
        div.onclick = () => selectSpec(key);
        
        div.innerHTML = `
            <div class="fw-bold">${val.name}</div>
            <div class="d-flex justify-content-between mt-1 text-muted small">
                <span>${val.width_mm/10} x ${val.height_mm/10} cm</span>
                <span class="badge bg-light text-dark border">${pxW} x ${pxH} px</span>
            </div>
        `;
        container.appendChild(div);
    }
}

function selectSpec(specId) {
    currentSpecId = specId;
    document.querySelectorAll('.spec-card').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`spec-${specId}`);
    if(el) el.classList.add('active');
    document.getElementById('custom-inputs').classList.add('d-none');
    
    if(specConfig[specId]) {
        const s = specConfig[specId];
        document.getElementById('spec-desc').innerText = `已選擇：${s.name}`;
        drawMask(s.width_mm, s.height_mm);
    }
}

// 自訂尺寸邏輯
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
    
    document.getElementById('spec-desc').innerHTML = `自訂：${w}x${h}mm <span class="badge bg-secondary">${pxW}x${pxH} px</span>`;
    drawMask(w, h);
}

// 3. 繪製遮罩
function drawMask(mmW, mmH) {
    const img = document.getElementById('previewImg');
    const mask = document.getElementById('cropMask');
    const label = document.getElementById('maskLabel');
    
    if (!img.naturalWidth) return;
    
    // 更新單張解析度資訊
    const pxW = Math.round(mmW * 23.622);
    const pxH = Math.round(mmH * 23.622);
    label.innerText = `${mmW/10} x ${mmH/10} cm (${pxW}x${pxH}px)`;

    // ... (保留原本的遮罩計算邏輯) ...
    const scale = img.width / img.naturalWidth;
    let cropW, cropH, cropX, cropY;
    let targetRatio = mmW / mmH;
    let faceMult = 2.5;
    let topMargin = 0.12;
    
    if (currentSpecId !== 'custom' && specConfig[currentSpecId]) {
        faceMult = specConfig[currentSpecId].face_multiplier;
        topMargin = specConfig[currentSpecId].top_margin;
    }

    if (faceData && faceData.found) {
        const realCropH = faceData.h * faceMult;
        const realCropW = realCropH * targetRatio;
        const faceCx = faceData.x + faceData.w / 2;
        const realX = faceCx - realCropW / 2;
        const realY = faceData.head_top_y - (realCropH * topMargin);
        cropW = realCropW * scale; cropH = realCropH * scale; cropX = realX * scale; cropY = realY * scale;
    } else {
        cropH = img.height; cropW = cropH * targetRatio;
        if (cropW > img.width) { cropW = img.width; cropH = cropW / targetRatio; }
        cropX = (img.width - cropW) / 2; cropY = (img.height - cropH) / 2;
    }

    mask.style.width = `${cropW}px`; mask.style.height = `${cropH}px`; mask.style.left = `${cropX}px`; mask.style.top = `${cropY}px`;
    mask.classList.remove('d-none');
}
window.addEventListener('resize', () => {
    if (currentSpecId === 'custom') updateCustom();
    else if (currentSpecId) selectSpec(currentSpecId);
});

// 4. 製作流程
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
            // 重置 UI
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
    document.getElementById('res-white').classList.remove('selected');
    document.getElementById('res-blue').classList.remove('selected');
    document.getElementById(`res-${color}`).classList.add('selected');
    
    // 顯示當前選擇的單張圖
    const imgData = `data:image/jpeg;base64,${resultPhotos[idx]}`;
    document.getElementById('previewImg').src = imgData;
    
    // 更新解析度提示
    const imgObj = new Image();
    imgObj.onload = function() {
        document.getElementById('res-info-single').innerText = `${this.width} x ${this.height} px (600 DPI)`;
    }
    imgObj.src = imgData;
}

// 5. 下載與排版
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
            
            // 關鍵 UX 改進：直接在右側顯示排版結果
            document.getElementById('previewImg').src = imgUrl;
            
            // 自動下載
            const link = document.createElement('a');
            link.href = imgUrl;
            link.download = `layout_4x6_${Date.now()}.jpg`;
            link.click();
            
            // 提示
            // alert("排版完成！已顯示於右側並開始下載。");
        }
    } catch(e) { alert("排版錯誤"); } finally { showLoading(false); }
}

// 6. Email 功能
function toggleEmailInput() {
    const el = document.getElementById('email-group');
    el.classList.toggle('d-none');
}

async function sendEmail() {
    const email = document.getElementById('user-email').value;
    if (!email || !email.includes("@")) { alert("請輸入有效的 Email"); return; }

    showLoading(true, "正在寄送...");
    
    try {
        // 如果還沒生成排版，先生成
        let imgToSend = currentLayoutBase64;
        if (!imgToSend) {
            const resLayout = await fetch(`${API_BASE_URL}/generate/layout`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ image_base64: resultPhotos[selectedResultBg] })
            });
            const dataLayout = await resLayout.json();
            imgToSend = dataLayout.layout_image;
        }

        if (!imgToSend) throw new Error("排版生成失敗");

        const resEmail = await fetch(`${API_BASE_URL}/send-email`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: email, image_base64: imgToSend })
        });
        
        const dataEmail = await resEmail.json();
        if (dataEmail.status === "SUCCESS") {
            alert("✅ 郵件已發送！");
            document.getElementById('email-group').classList.add('d-none'); // 寄完隱藏
        } else {
            alert("❌ 發送失敗: " + (dataEmail.error || "未知錯誤"));
        }

    } catch (e) {
        alert("錯誤: " + e.message);
    } finally {
        showLoading(false);
    }
}

function showLoading(show, text="處理中...") {
    const el = document.getElementById('loading');
    el.style.display = show ? 'flex' : 'none';
    el.querySelector('h5').innerText = text;
}
