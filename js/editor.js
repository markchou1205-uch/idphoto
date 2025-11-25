import { state } from './state.js';

let isDragging = false;
let startX, startY;
let initialPosX, initialPosY;

export function initEditor() {
    const wrapper = document.querySelector('.image-wrapper'); 
    if (!wrapper) return;

    wrapper.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);

    wrapper.addEventListener('touchstart', onDragStart, {passive: false});
    window.addEventListener('touchmove', onDragMove, {passive: false});
    window.addEventListener('touchend', onDragEnd);
    
    wrapper.addEventListener('wheel', onWheel, {passive: false});
}

export function updateMaskRatio(width_mm, height_mm) {
    const wrapper = document.querySelector('.image-wrapper');
    const mask = document.querySelector('.crop-mask');
    if (!wrapper || !mask) return;
    
    const baseHeight = 450; 
    const ratio = width_mm / height_mm;
    const newWidth = baseHeight * ratio;
    
    wrapper.style.height = `${baseHeight}px`;
    wrapper.style.width = `${newWidth}px`;
    
    state.editor.containerWidth = newWidth;
    state.editor.containerHeight = baseHeight;
    
    mask.innerHTML = `
        <div class="mask-label" id="maskLabel"></div>
        <div class="guide-line" id="guide-top"><span>頭頂上限</span></div>
        <div class="guide-line" id="guide-chin"><span>下巴下限</span></div>
    `;
    
    if(state.isImageLoaded) {
        // 規格改變時，重新計算填滿與居中
        const img = document.getElementById('previewImg');
        if(img.naturalWidth) {
            fitImageToContainer();
            updateTransform();
            drawGuides();
        }
    }
}

export function loadImageToEditor(base64) {
    const img = document.getElementById('previewImg');
    state.editor.scale = 1.0;
    state.editor.posX = 0;
    state.editor.posY = 0;
    
    img.onload = () => {
        state.editor.imageWidth = img.naturalWidth;
        state.editor.imageHeight = img.naturalHeight;
        fitImageToContainer();
        updateTransform();
        drawGuides(); 
    };
    img.src = base64;
    img.classList.remove('d-none');
}

// 核心修正：座標系歸零計算
function fitImageToContainer() {
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const iw = state.editor.imageWidth;
    const ih = state.editor.imageHeight;

    // 計算剛好填滿的 Scale
    const scaleW = cw / iw;
    const scaleH = ch / ih;
    const minScale = Math.max(scaleW, scaleH); 
    
    state.editor.minScale = minScale;
    
    // 預設放大 1.1 倍，讓用戶一進來就能感覺可以移動
    state.editor.scale = minScale * 1.1; 
    
    // 居中公式 (左上角座標系)
    // X = (容器寬 - 圖片實際寬) / 2
    state.editor.posX = (cw - iw * state.editor.scale) / 2;
    state.editor.posY = (ch - ih * state.editor.scale) / 2;
    
    updateZoomSlider();
}

function onDragStart(e) {
    if(!e.target.closest('.image-wrapper')) return;
    e.preventDefault();
    isDragging = true;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    startX = clientX;
    startY = clientY;
    initialPosX = state.editor.posX;
    initialPosY = state.editor.posY;
    
    document.querySelector('.image-wrapper').style.cursor = 'grabbing';
}

function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - startX;
    const dy = clientY - startY;
    
    let newX = initialPosX + dx;
    let newY = initialPosY + dy;
    
    // 邊界限制 (Boundary Check)
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const imgW = state.editor.imageWidth * state.editor.scale;
    const imgH = state.editor.imageHeight * state.editor.scale;
    
    // 邏輯：
    // 1. 圖片左邊緣 (newX) 不能大於 0 (否則左邊露白)
    // 2. 圖片右邊緣 (newX + imgW) 不能小於 cw (否則右邊露白)
    
    if (newX > 0) newX = 0;
    if (newX + imgW < cw) newX = cw - imgW;
    
    if (newY > 0) newY = 0;
    if (newY + imgH < ch) newY = ch - imgH;
    
    state.editor.posX = newX;
    state.editor.posY = newY;
    
    updateTransform();
}

function onDragEnd() {
    isDragging = false;
    const wrapper = document.querySelector('.image-wrapper');
    if(wrapper) wrapper.style.cursor = 'default';
}

function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = state.editor.scale * delta;
    setEditorZoom(newScale);
}

export function setEditorZoom(newScale) {
    if (!state.editor.imageWidth) return;

    // 限制範圍
    if (newScale < state.editor.minScale) newScale = state.editor.minScale;
    if (newScale > state.editor.minScale * 5) newScale = state.editor.minScale * 5;
    
    // 縮放時嘗試保持中心點 (可選優化，這裡先做邊界檢查)
    const oldScale = state.editor.scale;
    state.editor.scale = newScale;
    
    // 縮放後如果出界，拉回來
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const imgW = state.editor.imageWidth * state.editor.scale;
    const imgH = state.editor.imageHeight * state.editor.scale;
    
    // 如果縮放導致圖片中心偏移，這裡簡單處理：重新進行邊界校正
    // 讓圖片相對於容器比例縮放 (保持相對位置)
    const ratioX = state.editor.posX / (state.editor.imageWidth * oldScale - cw);
    // 這部分數學較複雜，為求穩定，我們使用最簡單的邊界拉回策略
    
    if (state.editor.posX > 0) state.editor.posX = 0;
    if (state.editor.posX + imgW < cw) state.editor.posX = cw - imgW;
    
    if (state.editor.posY > 0) state.editor.posY = 0;
    if (state.editor.posY + imgH < ch) state.editor.posY = ch - imgH;
    
    updateTransform();
    updateZoomSlider();
}

function updateTransform() {
    const img = document.getElementById('previewImg');
    if(img) {
        // 關鍵：因為 CSS 設定了 transform-origin: 0 0，所以這裡直接用 posX, posY 就是左上角座標
        img.style.transform = `translate3d(${state.editor.posX}px, ${state.editor.posY}px, 0) scale(${state.editor.scale})`;
        // 強制 JS 也設定一次，確保覆蓋
        img.style.transformOrigin = "0 0";
    }
}

function updateZoomSlider() {
    const zoomRange = document.getElementById('zoomRange');
    if(zoomRange) {
        // 將 scale 轉換為滑桿的相對數值 (例如 1.0 ~ 2.0)
        // 這裡直接用 scale 數值可能太大，我們顯示百分比
        zoomRange.value = state.editor.scale;
        // 更新 min/max 讓滑桿好拉
        zoomRange.min = state.editor.minScale;
        zoomRange.max = state.editor.minScale * 3;
    }
    const zoomVal = document.getElementById('zoomValue');
    if(zoomVal) zoomVal.innerText = Math.round(state.editor.scale * 100) + '%';
}

export function drawGuides() {
    const label = document.getElementById('maskLabel');
    const topGuide = document.getElementById('guide-top');
    const chinGuide = document.getElementById('guide-chin');
    
    const spec = state.specConfig[state.currentSpecId];
    if (spec) {
        if(label) label.innerText = `${spec.width_mm}x${spec.height_mm}mm`;
        
        let topPercent = 10; 
        let headPercent = 76; 
        
        if (state.currentSpecId === 'passport') {
            topPercent = 10; 
            headPercent = 76; 
        } else if (state.currentSpecId === 'inch1') {
            topPercent = 12;
            headPercent = 70;
        }
        
        const bottomPercent = topPercent + headPercent;
        
        if(topGuide) topGuide.style.top = `${topPercent}%`;
        if(chinGuide) chinGuide.style.top = `${bottomPercent}%`;
    }
}

export function generateCroppedImage() {
    const img = document.getElementById('previewImg');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const outputW = state.editor.containerWidth * 2; 
    const outputH = state.editor.containerHeight * 2;
    
    canvas.width = outputW;
    canvas.height = outputH;
    
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, outputW, outputH);
    
    const scale = state.editor.scale;
    const posX = state.editor.posX;
    const posY = state.editor.posY;
    
    const ratio = outputW / state.editor.containerWidth;
    
    const drawW = state.editor.imageWidth * scale * ratio;
    const drawH = state.editor.imageHeight * scale * ratio;
    const drawX = posX * ratio;
    const drawY = posY * ratio;
    
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    
    return canvas.toDataURL('image/jpeg', 0.95);
}
