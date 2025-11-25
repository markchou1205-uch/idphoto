import { state } from './state.js';

// 初始化編輯器
export function initEditor() {
    window.addEventListener('resize', () => {
        if(state.isImageLoaded) {
            updateMaskRatio();
        }
    });
}

// 自動對齊
export function autoAlignImage() {
    const img = document.getElementById('previewImg');
    if (!img || !state.faceData || !state.faceData.found) {
        centerImageDefault();
        return;
    }

    const spec = state.specConfig[state.currentSpecId];
    if (!spec) return;

    // 規格參數
    let targetHeadRatio = 0.76; 
    let targetTopMargin = 0.09;
    let targetRatio = spec.width_mm / spec.height_mm;

    if (state.currentSpecId === 'inch1') { targetHeadRatio = 0.70; targetTopMargin = 0.12; }
    else if (state.currentSpecId === 'resume') { targetHeadRatio = 0.60; targetTopMargin = 0.15; }
    else if (state.currentSpecId === 'visa_us') { targetHeadRatio = 0.65; targetTopMargin = 0.15; }

    const face = state.faceData;
    const chinY = face.y + face.h + (face.h * 0.05);
    const headTopY = face.head_top_y;
    let headH = chinY - headTopY;
    if (headH <= 0) headH = face.h * 1.5;

    const cropH = headH / targetHeadRatio;
    const cropW = cropH * targetRatio;
    const cropY = headTopY - (cropH * targetTopMargin);
    const faceCenterX = face.x + face.w / 2;
    const cropX = faceCenterX - (cropW / 2);

    const containerW = state.editor.containerWidth;
    const scale = containerW / cropW;
    const translateX = -cropX * scale;
    const translateY = -cropY * scale;

    // 儲存狀態供匯出使用
    state.editor.scale = scale;
    state.editor.posX = translateX;
    state.editor.posY = translateY;

    img.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
}

function centerImageDefault() {
    const img = document.getElementById('previewImg');
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih);
    const x = (cw - iw * scale) / 2;
    const y = (ch - ih * scale) / 2;
    
    state.editor.scale = scale;
    state.editor.posX = x;
    state.editor.posY = y;

    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

export function loadImageToEditor(base64) {
    const img = document.getElementById('previewImg');
    img.onload = () => {
        state.editor.imageWidth = img.naturalWidth;
        state.editor.imageHeight = img.naturalHeight;
        updateMaskRatio(); 
        autoAlignImage();
    };
    img.src = base64;
    img.classList.remove('d-none');
}

export function updateMaskRatio(width_mm, height_mm) {
    if (!width_mm && state.specConfig[state.currentSpecId]) {
        width_mm = state.specConfig[state.currentSpecId].width_mm;
        height_mm = state.specConfig[state.currentSpecId].height_mm;
    }
    if (!width_mm) return;

    const wrapper = document.querySelector('.image-wrapper');
    const mask = document.querySelector('.crop-mask');
    const baseHeight = 450; 
    const ratio = width_mm / height_mm;
    const newWidth = baseHeight * ratio;
    
    wrapper.style.height = `${baseHeight}px`;
    wrapper.style.width = `${newWidth}px`;
    
    state.editor.containerWidth = newWidth;
    state.editor.containerHeight = baseHeight;
    
    mask.innerHTML = ``;
    if(state.isImageLoaded) autoAlignImage();
}

export function drawGuides() {
    const label = document.getElementById('maskLabel');
    const topGuide = document.getElementById('guide-top');
    const chinGuide = document.getElementById('guide-chin');
    const spec = state.specConfig[state.currentSpecId];
    if (spec) {
        if(label) label.innerText = `${spec.width_mm}x${spec.height_mm}mm`;
        let topPercent = 9; let headPercent = 76; 
        if (state.currentSpecId === 'inch1') { topPercent = 12; headPercent = 70; }
        else if (state.currentSpecId === 'resume') { topPercent = 15; headPercent = 60; }
        else if (state.currentSpecId === 'visa_us') { topPercent = 15; headPercent = 65; }
        const bottomPercent = topPercent + headPercent;
        if(topGuide) topGuide.style.top = `${topPercent}%`;
        if(chinGuide) chinGuide.style.top = `${bottomPercent}%`;
    }
}

// 【核心新增】匯出裁切參數給後端
export function getCropParams() {
    // 計算相對裁切參數
    // 1. 實際顯示的 Scale = state.editor.scale
    // 2. 實際位移 = state.editor.posX, posY
    // 3. 容器大小 = state.editor.containerWidth, Height
    
    // 我們需要告訴後端：請從原圖 (0,0) 開始，以 (scale) 縮放後，擷取 (x, y, w, h) 區域
    // 轉換公式：
    // CropX = -posX / scale
    // CropY = -posY / scale
    // CropW = containerW / scale
    
    const scale = state.editor.scale;
    return {
        x: -state.editor.posX / scale,
        y: -state.editor.posY / scale,
        w: state.editor.containerWidth / scale,
        h: state.editor.containerHeight / scale,
        is_manual: true // 標記這是已經算好的參數
    };
}
