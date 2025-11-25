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

// 更新遮罩比例與輔助線
export function updateMaskRatio(width_mm, height_mm) {
    const wrapper = document.querySelector('.image-wrapper');
    const mask = document.querySelector('.crop-mask');
    if (!wrapper || !mask) return;
    
    // 設定容器尺寸 (固定高度，寬度自適應)
    const baseHeight = 450; 
    const ratio = width_mm / height_mm;
    const newWidth = baseHeight * ratio;
    
    wrapper.style.height = `${baseHeight}px`;
    wrapper.style.width = `${newWidth}px`;
    
    state.editor.containerWidth = newWidth;
    state.editor.containerHeight = baseHeight;
    
    // 插入輔助線元素 (如果還沒有)
    if (!mask.querySelector('.guide-line')) {
        mask.innerHTML = `
            <div class="mask-label" id="maskLabel"></div>
            <div class="guide-line" id="guide-top"><span>頭頂</span></div>
            <div class="guide-line" id="guide-chin"><span>下巴</span></div>
        `;
    }
    
    // 如果圖片已載入，更新位置與輔助線
    if(state.isImageLoaded) {
        // 重新適應邊界 (因為框大小變了)
        const img = document.getElementById('previewImg');
        if (img.naturalWidth) {
             // 保持圖片中心點不變的邏輯比較複雜，這裡簡單做：重新檢查邊界即可
             setEditorZoom(state.editor.scale);
        }
        drawGuides();
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

function fitImageToContainer() {
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const iw = state.editor.imageWidth;
    const ih = state.editor.imageHeight;

    // Cover 模式 (圖片要大於框)
    const scaleW = cw / iw;
    const scaleH = ch / ih;
    const minScale = Math.max(scaleW, scaleH); 
    
    state.editor.minScale = minScale;
    state.editor.scale = minScale; 
    
    // 居中
    state.editor.posX = (cw - iw * state.editor.scale) / 2;
    state.editor.posY = (ch - ih * state.editor.scale) / 2;
}

function onDragStart(e) {
    // 允許點擊 wrapper 或 img
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
    
    // 邊界限制：圖片不能脫離紅框 (不能露白)
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const imgW = state.editor.imageWidth * state.editor.scale;
    const imgH = state.editor.imageHeight * state.editor.scale;
    
    // X軸：newX 必須 <= 0 (左邊界), 且 newX + imgW >= cw (右邊界)
    if (newX > 0) newX = 0;
    if (newX + imgW < cw) newX = cw - imgW;
    
    // Y軸同理
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

    // 限制
    if (newScale < state.editor.minScale) newScale = state.editor.minScale;
    if (newScale > state.editor.minScale * 5) newScale = state.editor.minScale * 5;
    
    state.editor.scale = newScale;
    
    // 縮放後檢查邊界
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const imgW = state.editor.imageWidth * state.editor.scale;
    const imgH = state.editor.imageHeight * state.editor.scale;
    
    if (state.editor.posX > 0) state.editor.posX = 0;
    if (state.editor.posX + imgW < cw) state.editor.posX = cw - imgW;
    
    if (state.editor.posY > 0) state.editor.posY = 0;
    if (state.editor.posY + imgH < ch) state.editor.posY = ch - imgH;
    
    updateTransform();
}

function updateTransform() {
    const img = document.getElementById('previewImg');
    if(img) {
        img.style.transform = `translate3d(${state.editor.posX}px, ${state.editor.posY}px, 0) scale(${state.editor.scale})`;
    }
}

// 繪製輔助線 (根據內政部規定)
export function drawGuides() {
    const label = document.getElementById('maskLabel');
    const topGuide = document.getElementById('guide-top');
    const chinGuide = document.getElementById('guide-chin');
    
    const spec = state.specConfig[state.currentSpecId];
    if (spec) {
        if(label) label.innerText = `${spec.width_mm}x${spec.height_mm}mm`;
        
        // 計算輔助線位置 (%)
        // 護照/身分證：頭頂留白約 3mm ~ 5mm -> 10% ~ 12%
        // 頭長 3.2~3.6cm -> 71% ~ 80%
        // 下巴位置 = 頭頂位置 + 頭長
        
        let topPercent = 10; // 預設
        let headPercent = 75; // 預設頭高佔比
        
        if (state.currentSpecId === 'passport') {
            topPercent = 10; // 4.5mm
            headPercent = 76; // 3.4cm (34/45)
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
    
    // 輸出高解析度 (3倍紅框大小)
    const outputW = state.editor.containerWidth * 3; 
    const outputH = state.editor.containerHeight * 3;
    
    canvas.width = outputW;
    canvas.height = outputH;
    
    // 繪製背景 (白)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, outputW, outputH);
    
    const scale = state.editor.scale;
    const posX = state.editor.posX;
    const posY = state.editor.posY;
    
    // 算法：
    // Canvas 上的繪製目標是 (0, 0, outputW, outputH)
    // 圖片在 Canvas 上的大小 = natural * scale * (output / container)
    // 圖片在 Canvas 上的位置 = pos * (output / container)
    
    const ratio = outputW / state.editor.containerWidth;
    
    const drawW = state.editor.imageWidth * scale * ratio;
    const drawH = state.editor.imageHeight * scale * ratio;
    const drawX = posX * ratio;
    const drawY = posY * ratio;
    
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    
    return canvas.toDataURL('image/jpeg', 0.95);
}
