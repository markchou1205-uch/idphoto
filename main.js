import { state } from './js/state.js';
import * as UI from './js/ui.js';
import * as API from './js/api.js';
import * as Editor from './js/editor.js';

const DEFAULT_SPECS = {
    "passport": { "name": "護照 / 身分證", "desc": "2吋 (35x45mm) - 頭部 3.2~3.6cm", "width_mm": 35, "height_mm": 45 },
    "resume": { "name": "健保卡 / 履歷 / 半身照", "desc": "2吋 (42x47mm)", "width_mm": 42, "height_mm": 47 },
    "inch1": { "name": "駕照 / 執照 / 證書", "desc": "1吋 (28x35mm)", "width_mm": 28, "height_mm": 35 },
    "visa_us": { "name": "美國簽證", "desc": "5x5cm (51x51mm)", "width_mm": 51, "height_mm": 51 }
};

window.onload = function() {
    state.specConfig = DEFAULT_SPECS;
    Editor.initEditor();
    UI.renderSpecList(selectSpec);
    setTimeout(() => selectSpec('passport'), 100);

    const verTag = document.createElement('div');
    verTag.style.position = 'fixed';
    verTag.style.bottom = '10px';
    verTag.style.left = '10px';
    verTag.style.backgroundColor = '#000000';
    verTag.style.color = '#FFD700'; // 金色代表商業版
    verTag.style.padding = '5px 10px';
    verTag.style.borderRadius = '5px';
    verTag.style.fontSize = '12px';
    verTag.style.zIndex = '9999';
    verTag.innerHTML = 'System Ver: 11.0 (Commercial Flow)';
    document.body.appendChild(verTag);
};

window.goHome = function() {
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    document.getElementById('dashboard-area').classList.remove('d-none');
    document.getElementById('intro-area').classList.add('d-none');
    document.getElementById('workspace-area').classList.add('d-none');
    state.currentFeature = 'id-photo';
    document.getElementById('dashboard-area').classList.remove('d-none');
}

window.switchFeature = function(featureId) {
    state.currentFeature = featureId;
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${featureId}`);
    if(navEl) navEl.classList.add('active');
    document.querySelectorAll('.feature-panel').forEach(el => el.classList.add('d-none'));
    const panel = document.getElementById(`panel-${featureId}`);
    if (panel) panel.classList.remove('d-none');
    if (!panel) document.getElementById('panel-job-photo').classList.remove('d-none');
    if (state.isImageLoaded && featureId === 'id-photo') UI.showWorkspace();
    else UI.showIntro(featureId);
}

window.handleFileUpload = function(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    UI.showLoading(true, "AI 識別中...");
    
    reader.onload = async function() {
        state.originalBase64 = reader.result;
        state.isImageLoaded = true;
        Editor.loadImageToEditor(state.originalBase64);
        
        document.querySelector('.upload-btn-wrapper').classList.add('d-none');
        document.getElementById('uploaded-status').classList.remove('d-none');
        document.getElementById('btn-process').classList.remove('d-none');
        
        UI.showWorkspace();
        document.getElementById('cropMask').classList.add('d-none');
        
        try {
            const data = await API.detectFace(state.originalBase64);
            if (data && data.found) {
                state.faceData = data;
                Editor.autoAlignImage();
            } else {
                Editor.autoAlignImage();
            }
        } catch (err) { console.log("偵測失敗"); } finally { UI.showLoading(false); }
    };
    reader.readAsDataURL(input.files[0]);
}

window.resetUpload = function() { location.reload(); }

window.selectSpec = function(specId) {
    state.currentSpecId = specId;
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
    Editor.updateMaskRatio();
}

window.toggleCustom = function() {
    document.querySelectorAll('.spec-card').forEach(el => el.classList.remove('active'));
    document.getElementById('spec-custom').classList.add('active');
    document.getElementById('custom-inputs').classList.remove('d-none');
    state.currentSpecId = 'custom';
    window.updateCustom();
}

window.updateCustom = function() {
    const w = parseFloat(document.getElementById('custom-w').value) || 35;
    const h = parseFloat(document.getElementById('custom-h').value) || 45;
    state.currentCustomRatio = w / h;
    Editor.updateMaskRatio(w, h);
}

window.processImage = async function() {
    UI.showLoading(true, "AI 製作中...");
    try {
        const cropParams = Editor.getCropParams();
        const data = await API.processPreview(state.originalBase64, cropParams);
        
        if (data.photos) {
            state.resultPhotos = data.photos;
            document.getElementById('specs-section').classList.add('d-none');
            document.getElementById('result-section').classList.remove('d-none');
            document.getElementById('cropMask').classList.add('d-none');
            
            document.getElementById('img-white').src = `data:image/jpeg;base64,${data.photos[0]}`;
            
            if (state.currentSpecId === 'passport') {
                document.getElementById('res-blue').classList.add('d-none');
                document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.photos[0]}`; 
            } else {
                document.getElementById('res-blue').classList.remove('d-none');
                document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.photos[1]}`;
            }
            
            window.selectResult('white');
            
            // 修改按鈕文字
            const btnCheck = document.querySelector('button[onclick="runCheck()"]');
            if(btnCheck) btnCheck.innerHTML = '<i class="bi bi-shield-check"></i> 進階審查與智能修復';
            
        } else { alert("錯誤: " + (data.error || "未知錯誤")); }
    } catch (e) { alert("連線錯誤: " + e.message); } finally { UI.showLoading(false); }
}

window.selectResult = function(color) {
    const idx = color === 'white' ? 0 : 1;
    state.selectedResultBg = idx;
    
    document.getElementById('res-white').classList.remove('active');
    document.getElementById('res-blue').classList.remove('active');
    document.getElementById(`res-${color}`).classList.add('active');
    
    const img = document.getElementById('previewImg');
    img.src = `data:image/jpeg;base64,${state.resultPhotos[idx]}`;
    
    img.style.transform = 'none';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.backgroundColor = '#ffffff'; 
    
    img.classList.remove('d-none');
}

window.downloadImage = function() {
    if(!state.resultPhotos || state.resultPhotos.length === 0) {
        alert("無可下載的圖片"); return;
    }
    // 免責聲明
    if(confirm("【免責聲明】\n\n本免費服務僅提供基礎裁切與去背，不保證符合所有證件照審查標準。\n若需高合規性照片，建議使用「進階審查與修復」功能。\n\n是否確認下載？")) {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${state.resultPhotos[state.selectedResultBg]}`;
        link.download = `id_photo_${Date.now()}.jpg`;
        link.click();
    }
}

window.generateLayout = async function() {
    alert("此為付費功能 (模擬)");
}

// --- 商業流程：進階審查 ---
window.runCheck = async function() {
    if (!state.resultPhotos[state.selectedResultBg]) return;
    
    // 1. 顯示 Modal 與進度條
    const modalEl = document.getElementById('checkModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    const modalBody = document.querySelector('#checkModal .modal-body');
    modalBody.innerHTML = `
        <div class="text-center py-5">
            <h5 class="mb-3">AI 智能審查中...</h5>
            <div class="progress mb-2" style="height: 20px;">
                <div id="check-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: 0%"></div>
            </div>
            <small class="text-muted" id="check-status-text">正在掃描五官定位...</small>
        </div>
    `;
    
    // 2. 模擬進度條動畫 (2秒)
    const steps = [
        { pct: 30, text: "正在掃描五官定位..." },
        { pct: 60, text: "正在分析光線與陰影..." },
        { pct: 90, text: "正在比對 BOCA 規範..." },
        { pct: 100, text: "生成報告中..." }
    ];
    
    let stepIdx = 0;
    const interval = setInterval(async () => {
        if (stepIdx >= steps.length) {
            clearInterval(interval);
            // 3. 真正呼叫後端
            try {
                const data = await API.runCheckApi(state.resultPhotos[state.selectedResultBg]);
                renderCheckResult(data);
            } catch(e) { modalBody.innerHTML = `<div class="alert alert-danger">${e.message}</div>`; }
            return;
        }
        const s = steps[stepIdx];
        document.getElementById('check-progress').style.width = `${s.pct}%`;
        document.getElementById('check-status-text').innerText = s.text;
        stepIdx++;
    }, 500);
}

function renderCheckResult(data) {
    const modalBody = document.querySelector('#checkModal .modal-body');
    modalBody.innerHTML = ''; 

    // 圖片
    const imgContainer = document.createElement('div');
    imgContainer.className = 'text-center mb-3 position-relative d-inline-block';
    const img = document.createElement('img');
    img.src = `data:image/jpeg;base64,${state.resultPhotos[state.selectedResultBg]}`;
    img.className = 'img-fluid rounded'; 
    img.style.backgroundColor = '#ffffff';
    img.style.maxHeight = '250px';
    imgContainer.appendChild(img);
    modalBody.appendChild(imgContainer);

    // 表格 (分區)
    const table = document.createElement('table');
    table.className = 'table table-bordered table-sm small';
    table.innerHTML = `
        <thead class="table-light"><tr><th>項目</th><th>結果</th></tr></thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    
    // 分類標題
    const categories = {
        'basic': '🔹 基礎處理 (免費)',
        'compliance': '🔸 合規檢查 (BOCA)',
        'quality': '✨ 進階畫質分析 (加值)'
    };
    
    let currentCat = '';
    let hasIssue = false;

    if (data.results) {
        // 排序：basic -> compliance -> quality
        const sorted = data.results.sort((a,b) => {
            const order = {'basic':1, 'compliance':2, 'quality':3};
            return order[a.category] - order[b.category];
        });

        sorted.forEach(res => {
            if (res.category !== currentCat) {
                currentCat = res.category;
                const tr = document.createElement('tr');
                tr.className = 'table-secondary';
                tr.innerHTML = `<td colspan="2" class="fw-bold">${categories[currentCat]}</td>`;
                tbody.appendChild(tr);
            }
            
            const tr = document.createElement('tr');
            let icon = res.status === 'pass' ? '✅' : (res.status === 'warn' ? '⚠️' : '❌');
            let color = res.status === 'pass' ? 'text-success' : (res.status === 'warn' ? 'text-warning' : 'text-danger');
            
            if (res.status !== 'pass') hasIssue = true;

            tr.innerHTML = `
                <td>${res.item}</td>
                <td class="${color}">${icon} ${res.value}</td>
            `;
            tbody.appendChild(tr);
        });
    }
    modalBody.appendChild(table);
    
    // 按鈕區
    const btnArea = document.createElement('div');
    btnArea.className = 'd-grid gap-2 mt-3';
    
    if (hasIssue) {
        btnArea.innerHTML = `<button class="btn btn-warning fw-bold" onclick="applyFix()"><i class="bi bi-magic"></i> ✨ 一鍵智能修復 (預覽)</button>`;
    } else {
        btnArea.innerHTML = `<button class="btn btn-success fw-bold" onclick="alert('進入付費流程')"><i class="bi bi-download"></i> 下載無浮水印高畫質圖</button>`;
    }
    btnArea.innerHTML += `<button class="btn btn-outline-secondary" data-bs-dismiss="modal">取消</button>`;
    modalBody.appendChild(btnArea);
}

// --- 商業流程：修復與預覽 ---
window.applyFix = async function() {
    const modalBody = document.querySelector('#checkModal .modal-body');
    modalBody.innerHTML = `
        <div class="text-center py-5">
            <h5 class="mb-3">AI 正在修復中...</h5>
            <div class="spinner-border text-warning" role="status"></div>
            <p class="text-muted mt-2">消除紅眼、補光、畫質增強...</p>
        </div>
    `;
    
    try {
        // 呼叫修復 API (帶浮水印參數)
        const data = await API.fixImageApi(state.resultPhotos[state.selectedResultBg], 'all', true); // 需要修改 API.js 支援第三參數? 不，我們直接改 API.js
        // 為了方便，這裡直接 fetch
        const res = await fetch(`${API.API_BASE_URL}/generate/fix`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: state.resultPhotos[state.selectedResultBg], action: 'all', watermark: true })
        });
        const fixData = await res.json();
        
        if (fixData.image_base64) {
            modalBody.innerHTML = `
                <div class="text-center">
                    <h5 class="text-success">✨ 修復完成！</h5>
                    <p class="small text-muted">請預覽修復效果 (已加浮水印)</p>
                    <img src="data:image/jpeg;base64,${fixData.image_base64}" class="img-fluid rounded mb-3 border">
                    <div class="d-grid gap-2">
                        <button class="btn btn-primary btn-lg" onclick="alert('付款成功！下載無浮水印圖...')">🔓 解鎖並下載 ($NT 99)</button>
                        <button class="btn btn-outline-secondary" data-bs-dismiss="modal">再考慮一下</button>
                    </div>
                </div>
            `;
        }
    } catch(e) {
        alert("修復失敗");
    }
}

window.toggleEmailInput = function() { document.getElementById('email-group').classList.toggle('d-none'); };
window.sendEmail = async function() { /* ... */ };
