import { state } from './state.js';

let isDragging = false;
let startX, startY;
let initialPosX, initialPosY;

// 初始化編輯器
export function initEditor() {
    // 監聽的是外層的 image-wrapper (即紅框區域)，因為它是事件的捕捉層
    const wrapper = document.querySelector('.image-wrapper'); 
    if (!wrapper) return;

    // 滑鼠事件
    wrapper.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);

    // 觸控事件 (手機)
    wrapper.addEventListener('touchstart', onDragStart, {passive: false});
    window.addEventListener('touchmove', onDragMove, {passive: false});
    window.addEventListener('touchend', onDragEnd);
    
    // 滾輪縮放
    wrapper.addEventListener('wheel', onWheel, {passive: false});
}

// 更新遮罩比例 (修復報錯的關鍵函式)
export function updateMaskRatio(width_mm, height_mm) {
    const wrapper = document.querySelector('.image-wrapper');
    if (!wrapper) return;
    
    // 我們固定高度，根據比例調整寬度，以適應螢幕
    // 假設基礎高度為 450px (可根據 CSS 調整)
    const baseHeight = 450; 
    const ratio = width_mm / height_mm;
    const newWidth = baseHeight * ratio;
    
    wrapper.style.height = `${baseHeight}px`;
    wrapper.style.width = `${newWidth}px`;
    
    // 更新全域狀態中的容器尺寸，供邊界計算使用
    state.editor.containerWidth = newWidth;
    state.editor.containerHeight = baseHeight;
    
    // 如果圖片已載入，重新計算邊界以防圖片露白
    if(state.isImageLoaded) {
        setEditorZoom(state.editor.scale); 
    }
}

// 載入圖片到編輯器
export function loadImageToEditor(base64) {
    const img = document.getElementById('previewImg');
    
    // 重置狀態
    state.editor.scale = 1.0;
    state.editor.posX = 0;
    state.editor.posY = 0;
    
    img.onload = () => {
        // 紀錄原始尺寸
        state.editor.imageWidth = img.naturalWidth;
        state.editor.imageHeight = img.naturalHeight;
        
        // 初始：將圖片縮放到適合容器大小
        fitImageToContainer();
        updateTransform();
        drawGuides(); 
    };
    img.src = base64;
    img.classList.remove('d-none');
}

// 自動縮放圖片以填滿紅框
function fitImageToContainer() {
    const container = document.querySelector('.image-wrapper');
    
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    state.editor.containerWidth = cw;
    state.editor.containerHeight = ch;

    const iw = state.editor.imageWidth;
    const ih = state.editor.imageHeight;

    // 計算最小縮放比例 (Cover 模式：確保填滿)
    const scaleW = cw / iw;
    const scaleH = ch / ih;
    const minScale = Math.max(scaleW, scaleH); 
    
    state.editor.minScale = minScale;
    state.editor.scale = minScale; 
    
    // 居中
    state.editor.posX = (cw - iw * state.editor.scale) / 2;
    state.editor.posY = (ch - ih * state.editor.scale) / 2;
}

// 拖曳邏輯
function onDragStart(e) {
    if(e.target.id !== 'previewImg' && !e.target.classList.contains('image-wrapper')) return;
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
    
    // 邊界限制
    const containerW = state.editor.containerWidth;
    const containerH = state.editor.containerHeight;
    const currentW = state.editor.imageWidth * state.editor.scale;
    const currentH = state.editor.imageHeight * state.editor.scale;
    
    if (newX > 0) newX = 0;
    if (newX + currentW < containerW) newX = containerW - currentW;
    
    if (newY > 0) newY = 0;
    if (newY + currentH < containerH) newY = containerH - currentH;
    
    state.editor.posX = newX;
    state.editor.posY = newY;
    
    updateTransform();
}

function onDragEnd() {
    isDragging = false;
    const wrapper = document.querySelector('.image-wrapper');
    if(wrapper) wrapper.style.cursor = 'default';
}

// 滾輪縮放
function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = state.editor.scale * delta;
    setEditorZoom(newScale);
}

// 公開給 Slider 用的縮放函式
export function setEditorZoom(newScale) {
    if (!state.editor.imageWidth) return;

    // 限制範圍
    if (newScale < state.editor.minScale) newScale = state.editor.minScale;
    if (newScale > state.editor.minScale * 5) newScale = state.editor.minScale * 5;
    
    state.editor.scale = newScale;
    
    // 縮放後重新檢查邊界，如果出界要拉回來
    const containerW = state.editor.containerWidth;
    const containerH = state.editor.containerHeight;
    const currentW = state.editor.imageWidth * state.editor.scale;
    const currentH = state.editor.imageHeight * state.editor.scale;
    
    if (state.editor.posX > 0) state.editor.posX = 0;
    if (state.editor.posX + currentW < containerW) state.editor.posX = containerW - currentW;
    
    if (state.editor.posY > 0) state.editor.posY = 0;
    if (state.editor.posY + currentH < containerH) state.editor.posY = containerH - currentH;
    
    updateTransform();
}

function updateTransform() {
    const img = document.getElementById('previewImg');
    if(img) {
        img.style.transformOrigin = '0 0';
        img.style.transform = `translate3d(${state.editor.posX}px, ${state.editor.posY}px, 0) scale(${state.editor.scale})`;
    }
}

export function drawGuides() {
    const label = document.getElementById('maskLabel');
    const spec = state.specConfig[state.currentSpecId];
    if (spec && label) {
        label.innerText = `${spec.width_mm}x${spec.height_mm}mm`;
    }
    // 這裡未來可以加入畫虛線的邏輯
}

// 產生裁切後的 Base64
export function generateCroppedImage() {
    const img = document.getElementById('previewImg');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 輸出解析度：紅框尺寸 x 2 (提高畫質)
    const outputW = state.editor.containerWidth * 2; 
    const outputH = state.editor.containerHeight * 2;
    
    canvas.width = outputW;
    canvas.height = outputH;
    
    // 計算來源裁切區
    // sourceX = -posX / scale
    // sourceW = containerW / scale
    const sourceX = -state.editor.posX / state.editor.scale;
    const sourceY = -state.editor.posY / state.editor.scale;
    const sourceW = state.editor.containerWidth / state.editor.scale;
    const sourceH = state.editor.containerHeight / state.editor.scale;
    
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, outputW, outputH);
    
    return canvas.toDataURL('image/jpeg', 0.95);
}
