import { state } from './js/state.js';
import * as UI from './js/ui.js';
import * as API from './js/api.js';
import * as Editor from './js/editor.js';

// 1. 定義規格 (保持不變)
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
};

// ... (Navigation 部分保持不變，省略以節省篇幅) ...
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

        // 1. 載入圖片 (Editor 會自動執行 autoAlignImage)
        Editor.loadImageToEditor(state.originalBase64);
        
        document.querySelector('.upload-btn-wrapper').classList.add('d-none');
        document.getElementById('uploaded-status').classList.remove('d-none');
        document.getElementById('btn-process').classList.remove('d-none');
        
        UI.showWorkspace();
        document.getElementById('cropMask').classList.remove('d-none');
        
        // 2. 呼叫後端偵測人臉 (獲取 FaceData 供前端對齊使用)
        try {
            const data = await API.detectFace(state.originalBase64);
            if (data && data.found) {
                state.faceData = data;
                // 取得臉部數據後，再次觸發對齊，確保位置精準
                Editor.autoAlignImage();
            } else {
                alert("未能偵測到人臉，將使用預設置中。");
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
    
    // 更新遮罩比例 -> 這會觸發 Editor.autoAlignImage
    Editor.updateMaskRatio();
}

window.toggleCustom = function() {
    // 自訂尺寸暫時僅支援基本置中，不支援 AI 對齊
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

// --- 核心：回歸全自動製作 ---
window.processImage = async function() {
    UI.showLoading(true, "AI 製作中 (裁切/去背/修圖)...");
    try {
        // 直接傳送原始圖片，讓後端 smart_crop 處理
        // is_manual_crop 預設為 false
        const data = await API.processPreview(state.originalBase64, false);
        
        if (data.photos) {
            state.resultPhotos = data.photos;
            document.getElementById('specs-section').classList.add('d-none');
            document.getElementById('result-section').classList.remove('d-none');
            document.getElementById('cropMask').classList.add('d-none');
            document.getElementById('img-white').src = `data:image/jpeg;base64,${data.photos[0]}`;
            document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.photos[1]}`;
            window.selectResult('white');
        } else { alert("錯誤: " + data.error); }
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
    
    // 顯示結果時，重置 transform 讓它完整顯示
    img.style.transform = 'none';
    // 這裡可以加上 width: 100% 確保結果圖填滿容器
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    
    img.classList.remove('d-none');
}

// ... (合規檢查、下載、Email 功能保持不變，省略) ...
// (請保留原有的 runCheck, applyFix, downloadImage, generateLayout, sendEmail 等函式)
// 為了確保完整性，這裡補上 runCheck 的連結
window.runCheck = async function() {
    if (!state.resultPhotos[state.selectedResultBg]) return;
    UI.showLoading(true, "AI 審查中...");
    try {
        const data = await API.runCheckApi(state.resultPhotos[state.selectedResultBg]);
        if (data.results) UI.renderCheckResults(data.results);
    } catch(e) { alert(e.message); } finally { UI.showLoading(false); }
}
// ... (其他函式請確保存在)
window.applyFix = async function(action) { /* ... */ };
window.downloadImage = function() { /* ... */ };
window.generateLayout = async function() { /* ... */ };
window.toggleEmailInput = function() { /* ... */ };
window.sendEmail = async function() { /* ... */ };
