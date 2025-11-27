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
    verTag.style.backgroundColor = '#dc3545'; // 紅色
    verTag.style.color = '#fff';
    verTag.style.padding = '5px 10px';
    verTag.style.borderRadius = '5px';
    verTag.style.fontSize = '12px';
    verTag.style.zIndex = '9999';
    verTag.innerHTML = 'System Ver: 14.1 (UI Fixes)';
    document.body.appendChild(verTag);
};

// --- Navigation ---
window.goHome = function() { location.reload(); }
window.switchFeature = function(featureId) { /* 暫略 */ }

window.handleFileUpload = function(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    UI.showLoading(true, "AI 識別中...");
    
    reader.onload = async function() {
        state.originalBase64 = reader.result;
        state.isImageLoaded = true;
        Editor.loadImageToEditor(state.originalBase64);
        
        // [修正] 加入安全檢查，防止 null 錯誤
        const uploadWrapper = document.querySelector('.upload-btn-wrapper');
        if (uploadWrapper) uploadWrapper.classList.add('d-none');
        
        const statusEl = document.getElementById('uploaded-status');
        if (statusEl) statusEl.classList.remove('d-none');
        
        const btnProcess = document.getElementById('btn-process');
        if (btnProcess) btnProcess.classList.remove('d-none');
        
        UI.showWorkspace();
        
        const cropMask = document.getElementById('cropMask');
        if (cropMask) cropMask.classList.add('d-none');
        
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

// --- 製作流程 ---
window.processImage = async function() {
    UI.showLoading(true, "AI 製作中...");
    try {
        const cropParams = Editor.getCropParams();
        const data = await API.processPreview(state.originalBase64, cropParams);
        
        // [關鍵修正] 收到資料後，立刻關閉全域 Loading，避免與後面的局部 Loading 重疊
        UI.showLoading(false); 
        
        if (data.photos) {
            state.resultPhotos = data.photos;
            
            // 切換介面
            document.getElementById('dashboard-area').classList.add('d-none');
            document.getElementById('result-dashboard').classList.remove('d-none');
            
            const img = document.getElementById('main-preview-img');
            img.src = `data:image/jpeg;base64,${data.photos[0]}`; 
            
            if (state.currentSpecId === 'passport') {
                document.getElementById('res-blue').classList.add('d-none');
                document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.photos[0]}`; 
            } else {
                document.getElementById('res-blue').classList.remove('d-none');
                document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.photos[1]}`;
            }
            
            window.selectResult('white');
            
            // 修改按鈕
            const btnCheck = document.querySelector('button[onclick="runCheck()"]');
            if(btnCheck) btnCheck.innerHTML = '<i class="bi bi-shield-check"></i> 進階審查與智能修復';
            
            // 開始局部流程
            startCheckProcess();
            
        } else { alert("錯誤: " + (data.error || "未知錯誤")); }
    } catch (e) { 
        UI.showLoading(false); // 確保錯誤時也會關閉
        alert("連線錯誤: " + e.message); 
    }
}

// [修正] 改用進度條顯示
async function startCheckProcess() {
    // 1. 顯示局部 Loading 區塊
    document.getElementById('report-loading').classList.remove('d-none');
    document.getElementById('report-content').classList.add('d-none');
    
    // 2. 設定進度條 HTML
    const loadingDiv = document.getElementById('report-loading');
    loadingDiv.innerHTML = `
        <div class="text-center py-5">
            <h5 class="mb-3 text-primary"><i class="bi bi-cpu-fill"></i> AI 智能審查中...</h5>
            <div class="progress w-75 mx-auto shadow-sm" style="height: 10px;">
                <div id="local-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" style="width: 0%"></div>
            </div>
            <p class="mt-3 small text-muted" id="local-progress-text">正在初始化模型...</p>
        </div>
    `;
    
    // 3. 模擬動畫 (讓使用者感覺 AI 在運作)
    const bar = document.getElementById('local-progress-bar');
    const text = document.getElementById('local-progress-text');
    const steps = [
        { pct: 20, msg: "正在掃描五官定位..." },
        { pct: 50, msg: "正在分析光線與陰影..." },
        { pct: 80, msg: "正在比對外交部 BOCA 規範..." },
        { pct: 100, msg: "生成報告中..." }
    ];
    
    let stepIdx = 0;
    const interval = setInterval(() => {
        if (stepIdx >= steps.length) {
            clearInterval(interval);
            return;
        }
        const s = steps[stepIdx];
        bar.style.width = `${s.pct}%`;
        text.innerText = s.msg;
        stepIdx++;
    }, 400); // 每 0.4 秒跳一次

    // 4. 非同步呼叫後端 (這樣動畫會同時跑)
    try {
        const data = await API.runCheckApi(state.resultPhotos[0]); 
        
        // 確保動畫跑完至少 1.5 秒，體驗較好
        setTimeout(() => {
            renderReport(data);
            document.getElementById('report-loading').classList.add('d-none');
            document.getElementById('report-content').classList.remove('d-none');
        }, 1600); 
    } catch(e) { 
        loadingDiv.innerHTML = `<div class="alert alert-danger">審查失敗: ${e.message}</div>`; 
    }
}

function renderReport(data) {
    const container = document.getElementById('report-content');
    let html = `<h5 class="fw-bold mb-3"><i class="bi bi-clipboard-check"></i> AI 審查報告</h5>`;
    
    html += `<table class="table table-hover small"><tbody>`;
    
    const categories = { 'basic': '🔹 基礎處理', 'compliance': '🔸 合規檢查', 'quality': '✨ 進階畫質' };
    let currentCat = '';
    let hasFatal = false;
    let hasFixable = false;

    if (data.results) {
        const sorted = data.results.sort((a,b) => {
            const order = {'basic':1, 'compliance':2, 'quality':3};
            return order[a.category] - order[b.category];
        });

        sorted.forEach(res => {
            if (res.category !== currentCat) {
                currentCat = res.category;
                html += `<tr class="table-light"><td colspan="3" class="fw-bold">${categories[currentCat]}</td></tr>`;
            }
            
            let icon = res.status === 'pass' ? '✅' : (res.status === 'warn' ? '⚠️' : '❌');
            let color = res.status === 'pass' ? 'text-success' : (res.status === 'warn' ? 'text-warning' : 'text-danger');
            
            if (res.status === 'fail') hasFatal = true;
            if (res.category === 'quality' && res.status !== 'pass') hasFixable = true;
            if (res.status !== 'pass') hasFixable = true;

            html += `<tr><td>${res.item}</td><td class="text-muted">${res.standard||''}</td><td class="${color}">${icon} ${res.value}</td></tr>`;
        });
    }
    html += `</tbody></table>`;
    
    if (hasFatal) {
        html += `<div class="alert alert-danger"><i class="bi bi-x-circle-fill"></i> <strong>未通過：</strong> 建議重新拍攝或嘗試修復。</div>`;
    } else if (hasFixable) {
        html += `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle-fill"></i> <strong>有疑慮：</strong> 建議使用智能修復。</div>`;
    } else {
        html += `<div class="alert alert-success"><i class="bi bi-check-circle-fill"></i> <strong>恭喜通過！</strong> 照片符合規範。</div>`;
    }
    
    container.innerHTML = html;
    renderActionButtons(hasFatal, hasFixable);
}

function renderActionButtons(hasFatal, hasFixable) {
    const bar = document.getElementById('action-bar');
    let btns = '';
    
    btns += `<div class="d-flex gap-2">
                <button class="btn btn-outline-dark" onclick="downloadImage('single')"><i class="bi bi-download"></i> 單張下載 (Free)</button>
                <button class="btn btn-outline-primary" onclick="toggleEmailInput()"><i class="bi bi-envelope"></i> 寄到信箱</button>
             </div>`;
             
    btns += `<div class="d-flex gap-2">`;
    
    // 會員狀態判斷 (需配合 localStorage)
    let userPlan = localStorage.getItem('userPlan') || 'free';
    
    if (userPlan === 'paid') {
        btns += `<button class="btn btn-dark" onclick="downloadImage('layout')"><i class="bi bi-grid-3x3"></i> 下載 4x6 排版</button>`;
    } else {
        btns += `<button class="btn btn-dark" onclick="showPaymentModal()"><i class="bi bi-lock-fill"></i> 下載 4x6 排版</button>`;
    }

    if (hasFixable || hasFatal) {
        btns += `<button class="btn btn-warning fw-bold animate-pulse" onclick="startSmartFix()">
                    <i class="bi bi-magic"></i> ✨ 智能修復加值服務
                 </button>`;
    }
    
    btns += `</div>`;
    bar.innerHTML = btns;
}

window.startSmartFix = async function() {
    const btn = document.querySelector('button[onclick="startSmartFix()"]');
    if(btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 修復中...'; }
    
    try {
        const res = await fetch(`${API.API_BASE_URL}/generate/fix`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: state.resultPhotos[0], action: 'all', watermark: true })
        });
        const fixData = await res.json();
        
        if (fixData.image_base64) {
            document.getElementById('main-preview-img').classList.add('d-none');
            document.getElementById('compare-view').classList.remove('d-none');
            
            document.getElementById('compare-orig').src = state.originalBase64;
            document.getElementById('compare-basic').src = `data:image/jpeg;base64,${state.resultPhotos[0]}`;
            document.getElementById('compare-fix').src = `data:image/jpeg;base64,${fixData.image_base64}`;
            
            const bar = document.getElementById('action-bar');
            bar.innerHTML = `
                <button class="btn btn-outline-secondary" onclick="cancelFix()">取消預覽</button>
                <div class="d-flex gap-2">
                    <span class="text-muted align-self-center small">滿意修復結果嗎？</span>
                    <button class="btn btn-primary btn-lg fw-bold" onclick="showPaymentModal()">
                        <i class="bi bi-unlock-fill"></i> 解鎖並取得圖片
                    </button>
                </div>
            `;
        }
    } catch(e) { alert("修復失敗"); if(btn) btn.disabled=false; }
}

window.cancelFix = function() {
    document.getElementById('compare-view').classList.add('d-none');
    document.getElementById('main-preview-img').classList.remove('d-none');
    startCheckProcess();
}

window.showPaymentModal = function() {
    const modalEl = document.getElementById('paymentModal');
    const modal = new bootstrap.Modal(modalEl);
    const cards = document.getElementById('pricing-cards');
    cards.innerHTML = `
        ${renderPricingCard('單次通行', '39', '本次修復下載', false)}
        ${renderPricingCard('7日衝刺', '139', '一週無限次數', true)}
        ${renderPricingCard('月費訂閱', '339', '30天無限暢用', false)}
        ${renderPricingCard('年費專家', '899', '平均 $75/月', false)}
    `;
    modal.show();
}

function renderPricingCard(title, price, desc, isBest) {
    return `
        <div class="col-md-3">
            <div class="card h-100 text-center p-3 pricing-card ${isBest?'best-value':''}" onclick="processPayment('${title}')">
                <div class="card-body">
                    <h5 class="card-title">${title}</h5>
                    <h2 class="display-5 fw-bold my-3">$${price}</h2>
                    <p class="text-muted">${desc}</p>
                    <button class="btn ${isBest?'btn-warning':'btn-outline-primary'} w-100">選擇方案</button>
                </div>
            </div>
        </div>
    `;
}

window.processPayment = function(plan) {
    if(confirm(`確認購買 [${plan}] 方案？\n(此為模擬付款)`)) {
        localStorage.setItem('userPlan', 'paid');
        // updateUserUI(); // 需要在 onload 定義或全域定義
        
        const modalEl = document.getElementById('paymentModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        
        alert("付款成功！感謝您的訂閱。");
        
        if (!document.getElementById('compare-view').classList.contains('d-none')) {
             cancelFix();
        } else {
             renderActionButtons(false, false); // Refresh buttons
        }
    }
}

window.toggleUserProfile = function() {
    const panel = document.getElementById('user-profile-panel');
    panel.classList.toggle('d-none');
}

window.selectResult = function(color) {
    const idx = color === 'white' ? 0 : 1;
    state.selectedResultBg = idx;
    
    document.getElementById('res-white').classList.remove('active');
    document.getElementById('res-blue').classList.remove('active');
    document.getElementById(`res-${color}`).classList.add('active');
    
    const img = document.getElementById('previewImg');
    if(img) { // Safety check
        img.src = `data:image/jpeg;base64,${state.resultPhotos[idx]}`;
        img.style.transform = 'none';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.backgroundColor = '#ffffff'; 
        img.classList.remove('d-none');
    }
    
    const mainImg = document.getElementById('main-preview-img');
    if(mainImg) {
        mainImg.src = `data:image/jpeg;base64,${state.resultPhotos[idx]}`;
    }
}

window.downloadImage = function(type) {
    if (type === 'single') {
        if(confirm("【免責聲明】本免費圖片僅供參考，若需正式證件照請確認合規性。\n下載？")) {
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${state.resultPhotos[0]}`;
            link.download = `id_photo_single.jpg`;
            link.click();
        }
    } else if (type === 'layout') {
        API.generateLayoutApi(state.resultPhotos[0]).then(data => {
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${data.layout_image}`;
            link.download = `id_photo_layout.jpg`;
            link.click();
        });
    }
}

window.toggleEmailInput = function() { 
    const email = prompt("請輸入您的 Email：");
    if(email) window.sendEmail(email);
};

window.sendEmail = async function(email) {
    try {
        const res = await API.sendEmailApi(email, state.resultPhotos[0]);
        alert("已發送！");
    } catch(e) { alert("發送失敗"); }
}
