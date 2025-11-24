const API_BASE_URL = "https://video.pdfsolution.dpdns.org"; 
let originalBase64 = "";
let faceData = null; 
let specConfig = {}; 
let currentSpecId = "";
let currentCustomRatio = 0.77;
let resultPhotos = [];
let selectedResultBg = 0;

function handleFileUpload(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    showLoading(true);
    reader.onload = async function() {
        originalBase64 = reader.result;
        document.getElementById('previewImg').src = originalBase64;
        document.getElementById('previewImg').classList.remove('d-none');
        document.getElementById('empty-msg').classList.add('d-none');
        
        try {
            const res = await fetch(`${API_BASE_URL}/generate/detect`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ image_base64: originalBase64 })
            });
            
            if (res.ok) {
                const data = await res.json();
                faceData = data.found ? data : null;
                if(data.specs) specConfig = data.specs;
                renderSpecList(); // 渲染選單
            } else {
                console.error("Detect failed but continuing...");
                // 即使失敗，也嘗試顯示預設選單 (如果之前有載入過)
                if (Object.keys(specConfig).length === 0) {
                    // 手動填入預設值，確保選單不空白
                    specConfig = {
                        "passport": { "name": "2吋大頭照", "width_mm": 35, "height_mm": 45 },
                        "inch1": { "name": "1吋證件照", "width_mm": 28, "height_mm": 35 }
                    };
                    renderSpecList();
                }
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

function renderSpecList() {
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    for (const [key, val] of Object.entries(specConfig)) {
        const div = document.createElement('div');
        div.className = 'spec-card';
        div.id = `spec-${key}`;
        div.onclick = () => selectSpec(key);
        div.innerHTML = `
            <div class="fw-bold">${val.name}</div>
            <div class="small text-muted mt-1">${val.width_mm/10} x ${val.height_mm/10} cm</div>
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
        document.getElementById('spec-desc').innerText = `規格：${s.name} (${s.width_mm}x${s.height_mm}mm)`;
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
    document.getElementById('spec-desc').innerText = `自訂：${w}x${h}mm`;
    drawMask(w, h);
}

function drawMask(mmW, mmH) {
    const img = document.getElementById('previewImg');
    const mask = document.getElementById('cropMask');
    const label = document.getElementById('maskLabel');
    if (!img.naturalWidth) return;
    
    label.innerText = `${mmW/10} x ${mmH/10} cm`;

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
    if (currentSpecId === 'custom') updateCustom();
    else if (currentSpecId) selectSpec(currentSpecId);
});

async function processImage() {
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/generate/preview`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: originalBase64, spec_id: currentSpecId, custom_ratio: currentCustomRatio })
        });
        const data = await res.json();
        if (data.photos) {
            resultPhotos = data.photos;
            document.getElementById('panel-specs').classList.add('d-none');
            document.getElementById('panel-result').classList.remove('d-none');
            document.getElementById('previewImg').src = `data:image/jpeg;base64,${data.photos[0]}`;
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
    document.getElementById('res-white').classList.remove('selected');
    document.getElementById('res-blue').classList.remove('selected');
    document.getElementById(`res-${color}`).classList.add('selected');
    document.getElementById('previewImg').src = `data:image/jpeg;base64,${resultPhotos[idx]}`;
}

async function generateLayout() {
    showLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/generate/layout`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: resultPhotos[selectedResultBg] })
        });
        const data = await res.json();
        if (data.layout_image) {
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${data.layout_image}`;
            link.download = `layout_4x6_${Date.now()}.jpg`;
            link.click();
        }
    } catch(e) { alert("排版錯誤"); } finally { showLoading(false); }
}

async function promptEmail() {
    const email = prompt("請輸入您的 Email：");
    if (!email) return;
    if (!email.includes("@")) { alert("Email 格式錯誤"); return; }

    showLoading(true, "正在生成排版並寄送...");
    
    try {
        const resLayout = await fetch(`${API_BASE_URL}/generate/layout`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: resultPhotos[selectedResultBg] })
        });
        const dataLayout = await resLayout.json();
        
        if (!dataLayout.layout_image) throw new Error("排版生成失敗");

        const resEmail = await fetch(`${API_BASE_URL}/send-email`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                email: email,
                image_base64: dataLayout.layout_image 
            })
        });
        
        const dataEmail = await resEmail.json();
        if (dataEmail.status === "SUCCESS") {
            alert("✅ 郵件已發送！請檢查您的信箱。");
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

function downloadImage() {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${resultPhotos[selectedResultBg]}`;
    link.download = `id_photo_${Date.now()}.jpg`;
    link.click();
}
