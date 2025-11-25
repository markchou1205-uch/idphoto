// main.js - 核心入口與流程控制器
import { state } from './js/state.js';
import * as UI from './js/ui.js';
import * as API from './js/api.js';
import * as Editor from './js/editor.js';

// --- 初始化與全域綁定 ---
// 因為使用了 type="module"，函式不再是全域的，必須手動掛載到 window
window.onload = function() {
    // 1. 初始化編輯器事件 (拖曳、縮放)
    Editor.initEditor();
    
    // 2. 渲染規格列表
    UI.renderSpecList(selectSpec);
    
    // 3. 預設選中護照
    setTimeout(() => selectSpec('passport'), 100);
    
    console.log("System Initialized");
};

// --- 導航與介面切換 (Navigation) ---

window.goHome = function() {
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    document.getElementById('dashboard-area').classList.remove('d-none');
    document.getElementById('intro-area').classList.add('d-none');
    document.getElementById('workspace-area').classList.add('d-none');
    
    // 重置狀態
    state.currentFeature = 'id-photo';
    // 確保切回儀表板
    document.getElementById('dashboard-area').classList.remove('d-none');
}

window.switchFeature = function(featureId) {
    state.currentFeature = featureId;

    // 左側選單高亮
    document.querySelectorAll('.nav-item-icon').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${featureId}`);
    if(navEl) navEl.classList.add('active');

    // 面板切換
    document.querySelectorAll('.feature-panel').forEach(el => el.classList.add('d-none'));
    const panel = document.getElementById(`panel-${featureId}`);
    if (panel) panel.classList.remove('d-none');
    // 若無面板則顯示通用(求職照)面板
    if (!panel) document.getElementById('panel-job-photo').classList.remove('d-none');

    // 右側視圖切換
    if (state.isImageLoaded && featureId === 'id-photo') {
        UI.showWorkspace();
    } else {
        UI.showIntro(featureId);
    }
}

// --- 檔案上傳與處理邏輯 (Core Logic) ---

window.handleFileUpload = function(input) {
    if (!input.files.length) return;
    const reader = new FileReader();
    
    UI.showLoading(true, "載入照片中...");
    
    reader.onload = async function() {
        state.originalBase64 = reader.result;
        state.isImageLoaded = true;

        // 1. 載入圖片到編輯器 (Editor)
        Editor.loadImageToEditor(state.originalBase64);
        
        // 2. 切換 UI 狀態
        document.querySelector('.upload-btn-wrapper').classList.add('d-none');
        document.getElementById('uploaded-status').classList.remove('d-none');
        document.getElementById('btn-process').classList.remove('d-none');
        
        // 3. 顯示工作區
        UI.showWorkspace();
        document.getElementById('cropMask').classList.remove('d-none');
        
        // 4. 更新當前規格的遮罩與輔助線
        selectSpec(state.currentSpecId);

        // 5. 背景呼叫偵測 (選擇性，用於輔助或未來自動對齊)
        try {
            const data = await API.detectFace(state.originalBase64);
            if (data && data.found) {
                state.faceData = data;
                // 如果未來想做「自動置中」，可以在這裡呼叫 Editor.autoPosition(data)
            }
        } catch (err) {
            console.log("背景偵測失敗，不影響手動操作");
        } finally {
            UI.showLoading(false);
        }
    };
    reader.readAsDataURL(input.files[0]);
}

window.resetUpload = function() {
    // 重置 UI
    document.querySelector('.upload-btn-wrapper').classList.remove('d-none');
    document.getElementById('uploaded-status').classList.add('d-none');
    document.getElementById('btn-process').classList.add('d-none');
    document.getElementById('result-section').classList.add('d-none');
    document.getElementById('specs-section').classList.remove('d-none');
    
    // 重置狀態
    state.isImageLoaded = false;
    state.originalBase64 = "";
    state.resultPhotos = [];
    
    // 隱藏編輯器
    document.getElementById('previewImg').classList.add('d-none');
    document.getElementById('previewImg').src = "";
    document.getElementById('cropMask').classList.add('d-none');
    
    // 回到說明頁
    UI.showIntro(state.currentFeature);
}

// --- 規格選擇與編輯器連動 ---

window.selectSpec = function(specId) {
    state.currentSpecId = specId;
    
    // UI 更新 (卡片高亮)
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
    
    // 更新編輯器遮罩比例 (Editor)
    const spec = state.specConfig[specId];
    if(spec) {
        Editor.updateMaskRatio(spec.width_mm, spec.height_mm);
        // 如果圖片已載入，更新輔助線文字
        if(state.isImageLoaded) Editor.drawGuides();
    }
}

window.toggleCustom = function() {
    document.querySelectorAll('.spec-card').forEach(el => {
        el.classList.remove('active');
        const icon = el.querySelector('.check-icon');
        if (icon) icon.classList.add('d-none');
    });
    document.getElementById('spec-custom').classList.add('active');
    document.getElementById('custom-inputs').classList.remove('d-none');
    
    state.currentSpecId = 'custom';
    window.updateCustom();
}

window.updateCustom = function() {
    const w = parseFloat(document.getElementById('custom-w').value) || 35;
    const h = parseFloat(document.getElementById('custom-h').value) || 45;
    state.currentCustomRatio = w / h;
    
    // 更新編輯器遮罩
    Editor.updateMaskRatio(w, h);
    if(state.isImageLoaded) Editor.drawGuides();
}

// --- 核心製作流程 (所見即所得) ---

window.processImage = async function() {
    UI.showLoading(true, "AI 製作中 (裁切/去背/修圖)...");
    try {
        // 1. 從編輯器取得當前裁切好的圖片 (Base64)
        const croppedBase64 = Editor.generateCroppedImage();
        
        if (!croppedBase64) throw new Error("裁切失敗");

        // 2. 發送給後端 (is_manual_crop = true)
        // 注意：這裡我們傳送的是已經裁好的圖，後端只負責去背和美顏
        const data = await API.processPreview(croppedBase64, true);
        
        if (data.photos) {
            state.resultPhotos = data.photos;
            
            // UI 切換到結果頁
            document.getElementById('specs-section').classList.add('d-none');
            document.getElementById('result-section').classList.remove('d-none');
            document.getElementById('cropMask').classList.add('d-none');
            
            // 隱藏縮放工具列 (結果頁不需要)
            document.getElementById('zoom-toolbar').classList.add('d-none');
            
            // 顯示結果圖
            document.getElementById('img-white').src = `data:image/jpeg;base64,${data.photos[0]}`;
            document.getElementById('img-blue').src = `data:image/jpeg;base64,${data.photos[1]}`;
            window.selectResult('white');
            
        } else { 
            alert("錯誤: " + data.error); 
        }
    } catch (e) { 
        alert("連線錯誤: " + e.message); 
    } finally { 
        UI.showLoading(false); 
    }
}

window.selectResult = function(color) {
    const idx = color === 'white' ? 0 : 1;
    state.selectedResultBg = idx;
    
    document.getElementById('res-white').classList.remove('active');
    document.getElementById('res-blue').classList.remove('active');
    document.getElementById(`res-${color}`).classList.add('active');
    
    // 顯示預覽圖
    const img = document.getElementById('previewImg');
    img.src = `data:image/jpeg;base64,${state.resultPhotos[idx]}`;
    
    // 結果頁時，圖片不應該再被拖曳或縮放，重置 Transform
    img.style.transform = 'none';
    // 確保圖片顯示
    img.classList.remove('d-none');
}

// --- 合規檢查與修復 ---

window.runCheck = async function() {
    if (!state.resultPhotos[state.selectedResultBg]) return;
    UI.showLoading(true, "AI 審查中...");
    
    try {
        // 呼叫 Check API
        const data = await API.runCheckApi(state.resultPhotos[state.selectedResultBg]);
        
        if (data.error) { alert("後端錯誤: " + data.error); return; }

        if (data.results) {
            // 渲染檢查結果列表
            UI.renderCheckResults(data.results);
        }
    } catch(e) { 
        alert("檢查失敗: " + e.message); 
    } finally { 
        UI.showLoading(false); 
    }
}

window.applyFix = async function(actionType) {
    // 關閉 Modal
    const modalEl = document.getElementById('checkModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();

    UI.showLoading(true, "AI 修復中...");
    try {
        // 呼叫 Fix API
        const data = await API.fixImageApi(state.resultPhotos[state.selectedResultBg], actionType);
        
        if(data.image_base64) {
            // 更新結果
            state.resultPhotos[state.selectedResultBg] = data.image_base64;
            
            const color = state.selectedResultBg === 0 ? 'white' : 'blue';
            document.getElementById(`img-${color}`).src = `data:image/jpeg;base64,${data.image_base64}`;
            
            window.selectResult(color);
            alert("✅ 修復完成！請重新執行合規檢查確認結果。");
        } else {
            alert("修復失敗: " + (data.error || "未知錯誤"));
        }
    } catch(e) { 
        alert("連線錯誤"); 
    } finally { 
        UI.showLoading(false); 
    }
}

// --- 下載與輸出 ---

window.downloadImage = function() {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${state.resultPhotos[state.selectedResultBg]}`;
    link.download = `id_photo_high_res_${Date.now()}.jpg`;
    link.click();
}

window.generateLayout = async function() {
    UI.showLoading(true, "排版生成中...");
    try {
        const data = await API.generateLayoutApi(state.resultPhotos[state.selectedResultBg]);
        if (data.layout_image) {
            state.currentLayoutBase64 = data.layout_image;
            
            // 直接下載
            const link = document.createElement('a');
            link.href = `data:image/jpeg;base64,${data.layout_image}`;
            link.download = `layout_4x6_${Date.now()}.jpg`;
            link.click();
            
            // 也可以選擇顯示在畫面上(看需求)，目前邏輯是直接下載
        } else { 
            alert(data.error || "排版失敗"); 
        }
    } catch(e) { 
        alert("排版錯誤"); 
    } finally { 
        UI.showLoading(false); 
    }
}

window.toggleEmailInput = function() {
    document.getElementById('email-group').classList.toggle('d-none');
}

window.sendEmail = async function() {
    const email = document.getElementById('user-email').value;
    if (!email || !email.includes("@")) { alert("請輸入有效的 Email"); return; }
    
    UI.showLoading(true, "正在寄送...");
    try {
        // 如果還沒生成排版，先生成
        let imgToSend = state.currentLayoutBase64;
        if (!imgToSend) {
            const layoutData = await API.generateLayoutApi(state.resultPhotos[state.selectedResultBg]);
            if(layoutData.layout_image) imgToSend = layoutData.layout_image;
            else throw new Error("無法生成排版圖");
        }
        
        const data = await API.sendEmailApi(email, imgToSend);
        
        if (data.status === "SUCCESS") {
            alert("✅ 郵件已發送！");
            document.getElementById('email-group').classList.add('d-none');
        } else { 
            alert("❌ 發送失敗: " + (data.error || "未知錯誤")); 
        }
    } catch (e) { 
        alert("錯誤: " + e.message); 
    } finally { 
        UI.showLoading(false); 
    }
}

// --- Zoom Control 橋接 ---
window.setZoom = function(value) {
    Editor.setEditorZoom(value);
    document.getElementById('zoomValue').innerText = Math.round(parseFloat(value) * 100) + '%';
}
