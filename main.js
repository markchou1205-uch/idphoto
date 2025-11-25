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
};

window.goHome = function() {
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    document.getElementById('dashboard-area').classList.remove('d-none');
    document.getElementById('intro-area').classList.add('d-none');
    document.getElementById('workspace-area').classList.add('d-none');
    state.currentFeature = 'id-photo';
}

window.switchFeature = function(featureId) {
    state.currentFeature = featureId;
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${featureId}`);
    if(navEl) navEl.classList.add('active');
    document.querySelectorAll('.feature-panel').forEach(el => el.classList.add('d-none'));
    const panel = document.getElementById(`panel-${featureId}`);
    if (panel) panel.classList.remove('d-none');
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
    
    img.style.transform = 'none';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    // [修正] 強制白底，消除透明層造成的黑框錯覺
    img.style.backgroundColor = '#ffffff'; 
    
    img.classList.remove('d-none');
}

window.downloadImage = function() {
    if(!state.resultPhotos || state.resultPhotos.length === 0) { alert("無可下載的圖片"); return; }
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

// 修正後的檢查視窗
window.runCheck = async function() {
    if (!state.resultPhotos[state.selectedResultBg]) return;
    UI.showLoading(true, "AI 審查中...");
    try {
        const data = await API.runCheckApi(state.resultPhotos[state.selectedResultBg]);
        
        const modalBody = document.querySelector('#checkModal .modal-body');
        modalBody.innerHTML = ''; 

        // 1. 圖片容器
        const imgContainer = document.createElement('div');
        imgContainer.className = 'text-center mb-3 position-relative d-inline-block';
        
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${state.resultPhotos[state.selectedResultBg]}`;
        // [修正] 移除 border，增加白底
        img.className = 'img-fluid rounded'; 
        img.style.backgroundColor = '#ffffff';
        img.style.maxHeight = '300px';
        
        // 輔助線 (頭頂 10%, 下巴 86%)
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.innerHTML = `
            <div style="position:absolute; top:10%; left:0; width:100%; border-top: 1px dashed cyan; text-align:right;"><span style="background:cyan; font-size:10px;">頭頂限制</span></div>
            <div style="position:absolute; top:86%; left:0; width:100%; border-top: 1px dashed cyan; text-align:right;"><span style="background:cyan; font-size:10px;">下巴限制</span></div>
        `;
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(overlay);
        modalBody.appendChild(imgContainer);

        // 2. 列表
        const listGroup = document.createElement('div');
        listGroup.className = 'list-group text-start';
        
        if (data.results) {
            data.results.forEach(res => {
                const item = document.createElement('div');
                const colorClass = res.status === 'pass' ? 'list-group-item-success' : (res.status === 'warn' ? 'list-group-item-warning' : 'list-group-item-danger');
                const icon = res.status === 'pass' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
                
                item.className = `list-group-item ${colorClass} d-flex justify-content-between align-items-center`;
                item.innerHTML = `<span><i class="bi ${icon}"></i> ${res.item}</span> <small>${res.msg}</small>`;
                listGroup.appendChild(item);
            });
        }
        modalBody.appendChild(listGroup);

        const modalEl = document.getElementById('checkModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

    } catch(e) { alert(e.message); } finally { UI.showLoading(false); }
}

window.applyFix = async function(action) { /* ... */ };
window.toggleEmailInput = function() { document.getElementById('email-group').classList.toggle('d-none'); };
window.sendEmail = async function() { /* ... */ };
