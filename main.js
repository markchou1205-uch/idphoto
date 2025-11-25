import { state } from './js/state.js';
import * as UI from './js/ui.js';
import * as API from './js/api.js';
import * as Editor from './js/editor.js';

// 1. 定義規格
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

// --- Navigation ---
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
        document.getElementById('cropMask').classList.remove('d-none');
        
        try {
            const data = await API.detectFace(state.originalBase64);
            if (data && data.found) {
                state.faceData = data;
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
        // 1. 取得當前裁切參數 (關鍵)
        const cropParams = Editor.getCropParams();
        
        // 2. 傳送給後端 (附帶裁切參數)
        const data = await API.processPreview(state.originalBase64, cropParams);
        
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

// 【關鍵修正】結果顯示邏輯
window.selectResult = function(color) {
    const idx = color === 'white' ? 0 : 1;
    state.selectedResultBg = idx;
    
    document.getElementById('res-white').classList.remove('active');
    document.getElementById('res-blue').classList.remove('active');
    document.getElementById(`res-${color}`).classList.add('active');
    
    const img = document.getElementById('previewImg');
    img.src = `data:image/jpeg;base64,${state.resultPhotos[idx]}`;
    
    // 修正：結果圖已經是裁切好的成品，所以必須重置 transform
    // 讓它填滿容器顯示
    img.style.transform = 'none';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    
    img.classList.remove('d-none');
}

// --- 下載功能修正 ---
window.downloadImage = function() {
    if(!state.resultPhotos || state.resultPhotos.length === 0) {
        alert("無可下載的圖片"); return;
    }
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${state.resultPhotos[state.selectedResultBg]}`;
    link.download = `id_photo_${Date.now()}.jpg`;
    link.click();
}

window.generateLayout = async function() {
    if(!state.resultPhotos[state.selectedResultBg]) return;
    UI.showLoading(true, "排版生成中...");
    try {
        const data = await API.generateLayoutApi(state.resultPhotos[state.selectedResultBg]);
        if (data.layout_image) {
            state.currentLayoutBase64 = data.layout_image;
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${data.layout_image}`;
            link.download = `layout_4x6_${Date.now()}.jpg`;
            link.click();
        } else { alert(data.error || "排版失敗"); }
    } catch(e) { alert("排版錯誤"); } finally { UI.showLoading(false); }
}

// --- 其他 ---
window.runCheck = async function() {
    if (!state.resultPhotos[state.selectedResultBg]) return;
    UI.showLoading(true, "AI 審查中...");
    
    try {
        const data = await API.runCheckApi(state.resultPhotos[state.selectedResultBg]);
        
        // --- 新增：在 Modal 中顯示帶有輔助線的圖片 ---
        const modalBody = document.querySelector('#checkModal .modal-body');
        
        // 1. 清空舊內容
        modalBody.innerHTML = '';
        
        // 2. 建立圖片容器與輔助線
        const imgContainer = document.createElement('div');
        imgContainer.style.position = 'relative';
        imgContainer.style.display = 'inline-block';
        imgContainer.style.textAlign = 'center';
        imgContainer.style.marginBottom = '15px';

        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${state.resultPhotos[state.selectedResultBg]}`;
        img.className = 'img-fluid rounded border';
        img.style.maxHeight = '300px';
        
        // 3. 繪製輔助線 (頭頂線、下巴線、中線)
        // 證件照標準：頭頂約在 10%~15%，下巴約在 80%~85%
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.innerHTML = `
            <div style="position:absolute; top:12%; left:0; width:100%; border-top: 1px dashed cyan; text-align:right;"><span style="background:cyan; font-size:10px; padding:2px;">頭頂限制</span></div>
            <div style="position:absolute; top:45%; left:0; width:100%; border-top: 1px solid rgba(255,0,0,0.5); text-align:right;"><span style="background:rgba(255,0,0,0.5); color:#fff; font-size:10px; padding:2px;">眼睛基準</span></div>
            <div style="position:absolute; top:82%; left:0; width:100%; border-top: 1px dashed cyan; text-align:right;"><span style="background:cyan; font-size:10px; padding:2px;">下巴限制</span></div>
        `;

        imgContainer.appendChild(img);
        imgContainer.appendChild(overlay);
        modalBody.appendChild(imgContainer);

        // 4. 顯示檢查結果列表
        const listGroup = document.createElement('div');
        listGroup.className = 'list-group';
        if (data.results) {
            UI.renderCheckResultsToElement(data.results, listGroup); // 需確認 ui.js 有支援傳入 element，若無可手動渲染
            // 若 UI.renderCheckResults 是寫死的，這裡改用簡單迴圈渲染：
            data.results.forEach(res => {
                const item = document.createElement('div');
                item.className = `list-group-item list-group-item-${res.status === 'pass' ? 'success' : res.status === 'warn' ? 'warning' : 'danger'} d-flex justify-content-between align-items-center`;
                item.innerHTML = `<span><i class="bi ${res.status==='pass'?'bi-check-circle-fill':'bi-exclamation-circle-fill'}"></i> ${res.item}</span> <small>${res.msg}</small>`;
                listGroup.appendChild(item);
            });
        }
        modalBody.appendChild(listGroup);

        // 顯示 Modal
        const modalEl = document.getElementById('checkModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

    } catch(e) { alert(e.message); } finally { UI.showLoading(false); }
}

window.applyFix = async function(action) {
    // 關閉 Modal
    const modalEl = document.getElementById('checkModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();

    UI.showLoading(true, "AI 修復中...");
    try {
        const data = await API.fixImageApi(state.resultPhotos[state.selectedResultBg], action);
        if(data.image_base64) {
            state.resultPhotos[state.selectedResultBg] = data.image_base64;
            const color = state.selectedResultBg === 0 ? 'white' : 'blue';
            document.getElementById(`img-${color}`).src = `data:image/jpeg;base64,${data.image_base64}`;
            window.selectResult(color);
            alert("✅ 修復完成！");
        } else { alert("修復失敗"); }
    } catch(e) { alert("連線錯誤"); } finally { UI.showLoading(false); }
};

window.toggleEmailInput = function() { document.getElementById('email-group').classList.toggle('d-none'); };
window.sendEmail = async function() { /* 省略，保持原樣 */ };
