import { state } from './state.js';

// 初始化編輯器 (現在僅負責監聽視窗大小改變)
export function initEditor() {
    window.addEventListener('resize', () => {
        if(state.isImageLoaded) {
            updateMaskRatio();
        }
    });
}

// 核心功能：根據規格與人臉數據，自動對齊圖片
export function autoAlignImage() {
    const img = document.getElementById('previewImg');
    const wrapper = document.querySelector('.image-wrapper');
    
    if (!img || !wrapper || !state.faceData || !state.faceData.found) {
        // 沒臉時：預設置中填滿 (Cover)
        centerImageDefault();
        return;
    }

    const spec = state.specConfig[state.currentSpecId];
    if (!spec) return;

    // --- 1. 讀取規格參數 (需與後端 config.py 一致) ---
    // 預設值
    let targetHeadRatio = 0.76; // 2吋照標準
    let targetTopMargin = 0.09;
    let targetRatio = spec.width_mm / spec.height_mm;

    if (state.currentSpecId === 'inch1') {
        targetHeadRatio = 0.70;
        targetTopMargin = 0.12;
    } else if (state.currentSpecId === 'resume') {
        targetHeadRatio = 0.60;
        targetTopMargin = 0.15;
    } else if (state.currentSpecId === 'visa_us') {
        targetHeadRatio = 0.65;
        targetTopMargin = 0.15;
    }

    // --- 2. 計算裁切框 (模擬後端 Smart Crop 邏輯) ---
    const face = state.faceData; // {x, y, w, h, head_top_y}
    const imgW = img.naturalWidth;
    
    // 計算頭高 (下巴 - 頭頂)
    // OpenCV 的 y+h 約為下巴，我們加 5% 餘裕
    const chinY = face.y + face.h + (face.h * 0.05);
    const headTopY = face.head_top_y;
    
    let headH = chinY - headTopY;
    if (headH <= 0) headH = face.h * 1.5; // 防呆

    // 逆推裁切框高度： 框高 = 頭高 / 頭佔比
    const cropH = headH / targetHeadRatio;
    const cropW = cropH * targetRatio;

    // 計算裁切框左上角 (x1, y1)
    // Y軸：頭頂位置 - (框高 * 頂部留空比)
    const cropY = headTopY - (cropH * targetTopMargin);
    
    // X軸：臉部中心 - (框寬 / 2)
    const faceCenterX = face.x + face.w / 2;
    const cropX = faceCenterX - (cropW / 2);

    // --- 3. 將圖片對應到螢幕容器 (Mapping) ---
    const containerW = state.editor.containerWidth;
    const containerH = state.editor.containerHeight;

    // 計算縮放率：容器寬度 / 裁切框寬度
    // 也就是把「裁切框」放大到「螢幕容器」的大小
    const scale = containerW / cropW;

    // 計算位移：
    // 我們要讓 (cropX, cropY) 這個點，移動到容器的 (0, 0)
    const translateX = -cropX * scale;
    const translateY = -cropY * scale;

    // 應用變換
    img.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
}

// 沒抓到臉時的備用方案 (置中填滿)
function centerImageDefault() {
    const img = document.getElementById('previewImg');
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.max(cw / iw, ch / ih);
    const x = (cw - iw * scale) / 2;
    const y = (ch - ih * scale) / 2;

    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

// 載入圖片
export function loadImageToEditor(base64) {
    const img = document.getElementById('previewImg');
    img.onload = () => {
        updateMaskRatio(); // 先設定框大小
        // 圖片載入後，自動執行對齊
        autoAlignImage();
    };
    img.src = base64;
    img.classList.remove('d-none');
}

// 更新容器比例與輔助線
export function updateMaskRatio(width_mm, height_mm) {
    // 如果沒有傳入參數，嘗試從當前規格獲取
    if (!width_mm && state.specConfig[state.currentSpecId]) {
        width_mm = state.specConfig[state.currentSpecId].width_mm;
        height_mm = state.specConfig[state.currentSpecId].height_mm;
    }
    if (!width_mm) return;

    const wrapper = document.querySelector('.image-wrapper');
    const mask = document.querySelector('.crop-mask');
    
    // 固定高度 450px，寬度自適應
    const baseHeight = 450; 
    const ratio = width_mm / height_mm;
    const newWidth = baseHeight * ratio;
    
    wrapper.style.height = `${baseHeight}px`;
    wrapper.style.width = `${newWidth}px`;
    
    state.editor.containerWidth = newWidth;
    state.editor.containerHeight = baseHeight;
    
    // 繪製輔助線
    mask.innerHTML = `
        <div class="mask-label" id="maskLabel"></div>
        <div class="guide-line" id="guide-top"><span>頭頂</span></div>
        <div class="guide-line" id="guide-chin"><span>下巴</span></div>
    `;
    
    drawGuides();
    
    // 當規格改變導致容器變形時，重新對齊圖片
    if(state.isImageLoaded) autoAlignImage();
}

export function drawGuides() {
    const label = document.getElementById('maskLabel');
    const topGuide = document.getElementById('guide-top');
    const chinGuide = document.getElementById('guide-chin');
    
    const spec = state.specConfig[state.currentSpecId];
    if (spec) {
        if(label) label.innerText = `${spec.width_mm}x${spec.height_mm}mm`;
        
        // 這裡的百分比需與後端 config.py 的 top_margin 和 head_ratio 對應
        let topPercent = 9; // 預設 9%
        let headPercent = 76; 
        
        if (state.currentSpecId === 'inch1') {
            topPercent = 12; headPercent = 70;
        } else if (state.currentSpecId === 'resume') {
            topPercent = 15; headPercent = 60;
        } else if (state.currentSpecId === 'visa_us') {
            topPercent = 15; headPercent = 65;
        }
        
        const bottomPercent = topPercent + headPercent;
        
        if(topGuide) topGuide.style.top = `${topPercent}%`;
        if(chinGuide) chinGuide.style.top = `${bottomPercent}%`;
    }
}

// 移除 generateCroppedImage，因為我們現在回歸依賴後端裁切
export function generateCroppedImage() {
    return null; // 不再使用前端裁切
}
