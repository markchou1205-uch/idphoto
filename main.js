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

// 會員狀態模擬
let userPlan = localStorage.getItem('userPlan') || 'free'; 

window.onload = function() {
    state.specConfig = DEFAULT_SPECS;
    Editor.initEditor();
    UI.renderSpecList(selectSpec);
    setTimeout(() => selectSpec('passport'), 100);
    
    // 初始化會員 UI
    // updateUserUI(); // 若無此函式可暫時註解

    const verTag = document.createElement('div');
    verTag.style.position = 'fixed';
    verTag.style.bottom = '10px';
    verTag.style.left = '10px';
    verTag.style.backgroundColor = '#6610f2'; // 深紫色
    verTag.style.color = '#fff';
    verTag.style.padding = '5px 10px';
    verTag.style.borderRadius = '5px';
    verTag.style.fontSize = '12px';
    verTag.style.zIndex = '9999';
    verTag.innerHTML = 'System Ver: 14.2 (Preview Scale Fix)';
    document.body.appendChild(verTag);
};

window.goHome = function() { location.reload(); }
window.switchFeature = function(featureId) { /* 略 */ }

window.handleFileUpload = function(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    UI.showLoading(true, "AI 識別中...");
    
    reader.onload = async function() {
        state.originalBase64 = reader.result;
        state.isImageLoaded = true;
        Editor.loadImageToEditor(state.originalBase64);
        
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

// [修正] 加入 DOM 安全檢查的 selectSpec
window.selectSpec = function(specId) {
    state.currentSpecId = specId;
    
    // 1. 移除舊的 active
    document.querySelectorAll('.spec-card').forEach(el => {
        if(el) {
            el.classList.remove('active');
            const icon = el.querySelector('.check-icon');
            if (icon) icon.classList.add('d-none');
        }
    });

    // 2. 隱藏自訂輸入框 (如果存在)
    const customInputs = document.getElementById('custom-inputs');
    if (customInputs) customInputs.classList.add('d-none');

    // 3. 設定新的 active
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
    const specCustom = document.getElementById('spec-custom');
    if(specCustom) specCustom.classList.add('active');
    
    const customInputs = document.getElementById('custom-inputs');
    if(customInputs) customInputs.classList.remove('d-none');
    
    state.currentSpecId = 'custom';
    window.updateCustom();
}

window.updateCustom = function() {
    const wInput = document.getElementById('custom-w');
    const hInput = document.getElementById('custom-h');
    if(wInput && hInput) {
        const w = parseFloat(wInput.value) || 35;
        const h = parseFloat(hInput.value) || 45;
        state.currentCustomRatio = w / h;
        Editor.updateMaskRatio(w, h);
    }
}

// --- 製作流程 ---
window.processImage = async function() {
    UI.showLoading(true, "AI 製作中...");
    try {
        const cropParams = Editor.getCropParams();
        const data = await API.processPreview(state.originalBase64, cropParams);
        
        UI.showLoading(false);
        
        if (data.photos) {
            state.resultPhotos = data.photos;
            
            const dashboard = document.getElementById('dashboard-area');
            if(dashboard) dashboard.classList.add('d-none');
            
            const resultDash = document.getElementById('result-dashboard');
            if(resultDash) resultDash.classList.remove('d-none');
            
            const img = document.getElementById('main-preview-img');
            if(img) {
                img.src = `data:image/jpeg;base64,${data.photos[0]}`; 
                img.classList.remove('d-none');
            }
            
            if (state.currentSpecId === 'passport') {
                const resBlue = document.getElementById('res-blue');
                if(resBlue) resBlue.classList.add('d-none');
            } else {
                const resBlue = document.getElementById('res-blue');
                if(resBlue) resBlue.classList.remove('d-none');
                
                const imgBlue = document.getElementById('img-blue');
                if(imgBlue) imgBlue.src = `data:image/jpeg;base64,${data.photos[1]}`;
            }
            
            // 更新小圖
            const imgWhite = document.getElementById('img-white');
            if(imgWhite) imgWhite.src = `data:image/jpeg;base64,${data.photos[0]}`;
            
            window.selectResult('white');
            
            const btnCheck = document.querySelector('button[onclick="runCheck()"]');
            if(btnCheck) btnCheck.innerHTML = '<i class="bi bi-shield-check"></i> 進階審查與智能修復';
            
            startCheckProcess();
            
        } else { alert("錯誤: " + (data.error || "未知錯誤")); }
    } catch (e) { 
        UI.showLoading(false);
        alert("連線錯誤: " + e.message); 
    }
}

async function startCheckProcess() {
    const loadingDiv = document.getElementById('report-loading');
    const contentDiv = document.getElementById('report-content');
    if(loadingDiv) loadingDiv.classList.remove('d-none');
    if(contentDiv) contentDiv.classList.add('d-none');
    
    // 重置進度條
    const bar = document.getElementById('local-progress-bar');
    const text = document.getElementById('local-progress-text');
    if(bar) bar.style.width = '0%';
    
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
        if(bar) bar.style.width = `${s.pct}%`;
        if(text) text.innerText = s.msg;
        stepIdx++;
    }, 400);

    try {
        const data = await API.runCheckApi(state.resultPhotos[0]); 
        setTimeout(() => {
            renderReport(data);
            if(loadingDiv) loadingDiv.classList.add('d-none');
            if(contentDiv) contentDiv.classList.remove('d-none');
        }, 1600); 
    } catch(e) { 
        if(loadingDiv) loadingDiv.innerHTML = `<div class="alert alert-danger">審查失敗: ${e.message}</div>`; 
    }
}

function renderReport(data) {
    const container = document.getElementById('report-content');
    if(!container) return;

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
    if(!bar) return;

    let btns = '';
    btns += `<div class="d-flex gap-2">
                <button class="btn btn-outline-dark" onclick="downloadImage('single')"><i class="bi bi-download"></i> 單張下載 (Free)</button>
                <button class="btn btn-outline-primary" onclick="toggleEmailInput()"><i class="bi bi-envelope"></i> 寄到信箱</button>
             </div>`;
             
    btns += `<div class="d-flex gap-2">`;
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
            const mainImg = document.getElementById('main-preview-img');
            const compareView = document.getElementById('compare-view');
            if(mainImg) mainImg.classList.add('d-none');
            if(compareView) compareView.classList.remove('d-none');
            
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

// 付費與其他 UI 函式...
window.selectResult = function(color) {
    const idx = color === 'white' ? 0 : 1;
    state.selectedResultBg = idx;
    
    const resWhite = document.getElementById('res-white');
    const resBlue = document.getElementById('res-blue');
    if(resWhite) resWhite.classList.remove('active');
    if(resBlue) resBlue.classList.remove('active');
    
    const targetBtn = document.getElementById(`res-${color}`);
    if(targetBtn) targetBtn.classList.add('active');
    
    const img = document.getElementById('previewImg');
    if(img) {
        img.src = `data:image/jpeg;base64,${state.resultPhotos[idx]}`;
        img.classList.remove('d-none');
    }
    
    // Update main dashboard image too if active
    const mainImg = document.getElementById('main-preview-img');
    if(mainImg) mainImg.src = `data:image/jpeg;base64,${state.resultPhotos[idx]}`;
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
        userPlan = 'paid';
        const modalEl = document.getElementById('paymentModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        
        alert("付款成功！");
        
        const compareView = document.getElementById('compare-view');
        if (compareView && !compareView.classList.contains('d-none')) {
             cancelFix(); // Reset to main view, user can now download unlocked layout
        } else {
             renderActionButtons(false, false); // Refresh buttons
        }
    }
}

window.downloadImage = function(type) {
    if(!state.resultPhotos || state.resultPhotos.length === 0) {
        alert("無可下載的圖片"); return;
    }
    if (type === 'single') {
        if(confirm("【免責聲明】本免費圖片僅供參考。\n下載？")) {
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${state.resultPhotos[state.selectedResultBg]}`;
            link.download = `id_photo_single.jpg`;
            link.click();
        }
    } else if (type === 'layout') {
        API.generateLayoutApi(state.resultPhotos[state.selectedResultBg]).then(data => {
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${data.layout_image}`;
            link.download = `id_photo_layout.jpg`;
            link.click();
        });
    }
}

window.toggleUserProfile = function() {
    const panel = document.getElementById('user-profile-panel');
    if(panel) panel.classList.toggle('d-none');
}

window.toggleEmailInput = function() { 
    const email = prompt("請輸入您的 Email：");
    if(email) window.sendEmail(email);
};

window.sendEmail = async function(email) {
    try {
        const res = await API.sendEmailApi(email, state.resultPhotos[state.selectedResultBg]);
        alert("已發送！");
    } catch(e) { alert("發送失敗"); }
}
