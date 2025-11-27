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
    updateUserUI();

    const verTag = document.createElement('div');
    verTag.style.position = 'fixed';
    verTag.style.bottom = '10px';
    verTag.style.left = '10px';
    verTag.style.backgroundColor = '#0d6efd';
    verTag.style.color = '#fff';
    verTag.style.padding = '5px 10px';
    verTag.style.borderRadius = '5px';
    verTag.style.fontSize = '12px';
    verTag.style.zIndex = '9999';
    verTag.innerHTML = 'System Ver: 14.0 (Dashboard UI)';
    document.body.appendChild(verTag);
};

// --- 全域導航與上傳 ---
window.goHome = function() { location.reload(); }
window.switchFeature = function(featureId) { /* 暫略，維持原樣 */ }
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
            if (data && data.found) state.faceData = data;
            Editor.autoAlignImage();
        } catch (err) { console.log("偵測失敗"); } finally { UI.showLoading(false); }
    };
    reader.readAsDataURL(input.files[0]);
}
window.resetUpload = function() { location.reload(); }
window.selectSpec = function(id) { state.currentSpecId = id; Editor.updateMaskRatio(); }
window.toggleCustom = function() { /* ... */ }
window.updateCustom = function() { /* ... */ }

// --- 核心流程：製作與審查 ---
window.processImage = async function() {
    UI.showLoading(true, "AI 製作中...");
    try {
        const cropParams = Editor.getCropParams();
        const data = await API.processPreview(state.originalBase64, cropParams);
        
        if (data.photos) {
            state.resultPhotos = data.photos;
            
            // 切換介面：隱藏上傳區，顯示 Dashboard
            document.getElementById('dashboard-area').classList.add('d-none');
            document.getElementById('result-dashboard').classList.remove('d-none');
            
            // 顯示預覽圖 (右側)
            const img = document.getElementById('main-preview-img');
            img.src = `data:image/jpeg;base64,${data.photos[0]}`; // 預設白底
            img.classList.remove('d-none');
            
            // 自動開始審查流程 (左側)
            startCheckProcess();
            
        } else { alert("錯誤: " + (data.error || "未知錯誤")); }
    } catch (e) { alert("連線錯誤: " + e.message); } finally { UI.showLoading(false); }
}

async function startCheckProcess() {
    // 1. 顯示進度條
    document.getElementById('report-loading').classList.remove('d-none');
    document.getElementById('report-content').classList.add('d-none');
    
    // 2. 模擬動畫
    const bar = document.querySelector('#report-loading .progress-bar');
    let pct = 0;
    const interval = setInterval(() => {
        pct += 10;
        bar.style.width = `${pct}%`;
        if (pct >= 100) clearInterval(interval);
    }, 150);

    // 3. 呼叫後端檢查
    try {
        const data = await API.runCheckApi(state.resultPhotos[0]); // 檢查第一張
        setTimeout(() => {
            renderReport(data);
            document.getElementById('report-loading').classList.add('d-none');
            document.getElementById('report-content').classList.remove('d-none');
        }, 1500); // 至少跑 1.5秒
    } catch(e) { alert(e.message); }
}

function renderReport(data) {
    const container = document.getElementById('report-content');
    let html = `<h5 class="fw-bold mb-3"><i class="bi bi-clipboard-check"></i> AI 審查報告</h5>`;
    
    // 表格
    html += `<table class="table table-hover small"><tbody>`;
    
    const categories = { 'basic': '🔹 基礎處理', 'compliance': '🔸 合規檢查', 'quality': '✨ 進階畫質' };
    let currentCat = '';
    let hasFatal = false;
    let hasFixable = false;

    if (data.results) {
        // 排序
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
            
            // 如果是瀏海或紅眼警告，也視為 Fixable (雖然瀏海難修，但我們要引導付費嘗試)
            if (res.status !== 'pass') hasFixable = true;

            html += `<tr><td>${res.item}</td><td class="text-muted">${res.standard||''}</td><td class="${color}">${icon} ${res.value}</td></tr>`;
        });
    }
    html += `</tbody></table>`;
    
    // 總結 Alert
    if (hasFatal) {
        html += `<div class="alert alert-danger"><i class="bi bi-x-circle-fill"></i> <strong>未通過：</strong> 建議重新拍攝或嘗試修復。</div>`;
    } else if (hasFixable) {
        html += `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle-fill"></i> <strong>有疑慮：</strong> 建議使用智能修復。</div>`;
    } else {
        html += `<div class="alert alert-success"><i class="bi bi-check-circle-fill"></i> <strong>恭喜通過！</strong> 照片符合規範。</div>`;
    }
    
    container.innerHTML = html;
    
    // 更新右側按鈕
    renderActionButtons(hasFatal, hasFixable);
}

function renderActionButtons(hasFatal, hasFixable) {
    const bar = document.getElementById('action-bar');
    let btns = '';
    
    // 左側：常用按鈕
    btns += `<div class="d-flex gap-2">
                <button class="btn btn-outline-dark" onclick="downloadImage('single')"><i class="bi bi-download"></i> 單張下載 (Free)</button>
                <button class="btn btn-outline-primary" onclick="toggleEmailInput()"><i class="bi bi-envelope"></i> 寄到信箱</button>
             </div>`;
             
    // 右側：行動呼籲 (CTA)
    btns += `<div class="d-flex gap-2">`;
    
    // 只有付費會員可以直接下載 4x6
    if (userPlan === 'paid') {
        btns += `<button class="btn btn-dark" onclick="downloadImage('layout')"><i class="bi bi-grid-3x3"></i> 下載 4x6 排版</button>`;
    } else {
        btns += `<button class="btn btn-dark" onclick="showPaymentModal()"><i class="bi bi-lock-fill"></i> 下載 4x6 排版</button>`;
    }

    // 修復按鈕
    if (hasFixable || hasFatal) {
        btns += `<button class="btn btn-warning fw-bold animate-pulse" onclick="startSmartFix()">
                    <i class="bi bi-magic"></i> ✨ 智能修復加值服務
                 </button>`;
    }
    
    btns += `</div>`;
    bar.innerHTML = btns;
}

// --- 進階修復流程 ---
window.startSmartFix = async function() {
    // 1. 顯示修復中
    const btn = document.querySelector('button[onclick="startSmartFix()"]');
    if(btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 修復中...'; }
    
    try {
        // 2. 呼叫 API (帶浮水印)
        const res = await fetch(`${API.API_BASE_URL}/generate/fix`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: state.resultPhotos[0], action: 'all', watermark: true })
        });
        const fixData = await res.json();
        
        if (fixData.image_base64) {
            // 3. 切換到三圖對比視圖
            document.getElementById('main-preview-img').classList.add('d-none');
            document.getElementById('compare-view').classList.remove('d-none');
            
            // 設定圖片
            document.getElementById('compare-orig').src = state.originalBase64;
            document.getElementById('compare-basic').src = `data:image/jpeg;base64,${state.resultPhotos[0]}`;
            document.getElementById('compare-fix').src = `data:image/jpeg;base64,${fixData.image_base64}`;
            
            // 4. 更新按鈕：只留 解鎖 & 取消
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
    // 重新渲染一般按鈕 (這裡簡單重整即可，或重呼叫 renderActionButtons)
    // 為了簡單，重新執行一次 check 流程刷新 UI
    startCheckProcess();
}

// --- 付費相關 ---
window.showPaymentModal = function() {
    const modalEl = document.getElementById('paymentModal');
    const modal = new bootstrap.Modal(modalEl);
    
    // 渲染價格卡
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
        // 模擬付款成功
        userPlan = 'paid';
        localStorage.setItem('userPlan', 'paid');
        updateUserUI();
        
        // 關閉 Modal
        const modalEl = document.getElementById('paymentModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        
        alert("付款成功！感謝您的訂閱。");
        
        // 如果在修復預覽中，自動解鎖 (移除浮水印)
        // 這裡我們需要重新呼叫 fix API 但 watermark=false
        // 簡單起見，我們重整頁面或提示用戶重新下載
        if (!document.getElementById('compare-view').classList.contains('d-none')) {
             // 重新呼叫無浮水印版
             // 實際專案應實作此邏輯，這裡先切回主圖並開放下載
             cancelFix();
        }
    }
}

// --- 會員中心 ---
window.toggleUserProfile = function() {
    const panel = document.getElementById('user-profile-panel');
    panel.classList.toggle('d-none');
}

function updateUserUI() {
    const badge = document.getElementById('user-plan');
    if(badge) {
        badge.innerText = userPlan === 'paid' ? 'PRO 會員' : '免費版';
        badge.className = userPlan === 'paid' ? 'badge bg-warning text-dark' : 'badge bg-secondary';
    }
}

// 下載邏輯 (單張)
window.downloadImage = function(type) {
    if (type === 'single') {
        if(confirm("【免責聲明】本免費圖片僅供參考，若需正式證件照請確認合規性。\n下載？")) {
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${state.resultPhotos[0]}`;
            link.download = `id_photo_single.jpg`;
            link.click();
        }
    } else if (type === 'layout') {
        // 4x6 
        API.generateLayoutApi(state.resultPhotos[0]).then(data => {
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${data.layout_image}`;
            link.download = `id_photo_layout.jpg`;
            link.click();
        });
    }
}

window.toggleEmailInput = function() { 
    // 這裡可以使用 SweetAlert 或 Prompt 簡化，或是保留原 Modal
    const email = prompt("請輸入您的 Email：");
    if(email) window.sendEmail(email);
};

window.sendEmail = async function(email) {
    try {
        const res = await API.sendEmailApi(email, state.resultPhotos[0]);
        alert("已發送！");
    } catch(e) { alert("發送失敗"); }
}
