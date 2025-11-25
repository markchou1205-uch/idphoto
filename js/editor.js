import { state } from './state.js';

let isDragging = false;
let startX, startY;
let initialPosX, initialPosY;

// 初始化編輯器 (綁定事件)
export function initEditor() {
    const overlay = document.getElementById('crop-overlay'); // 這是我們要在 html 新增的觸控層
    if (!overlay) return;

    // 滑鼠事件
    overlay.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);

    // 觸控事件 (手機)
    overlay.addEventListener('touchstart', onDragStart, {passive: false});
    window.addEventListener('touchmove', onDragMove, {passive: false});
    window.addEventListener('touchend', onDragEnd);
    
    // 滾輪縮放
    overlay.addEventListener('wheel', onWheel, {passive: false});
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
        
        // 初始：將圖片縮放到適合容器大小 (Cover 模式)
        fitImageToContainer();
        updateTransform();
        drawGuides(); // 畫輔助線
    };
    img.src = base64;
    img.classList.remove('d-none');
}

// 自動縮放圖片以填滿紅框 (Contain/Cover logic)
function fitImageToContainer() {
    const container = document.querySelector('.image-wrapper');
    const img = document.getElementById('previewImg');
    
    // 容器尺寸 (即紅框尺寸)
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    state.editor.containerWidth = cw;
    state.editor.containerHeight = ch;

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // 計算最小縮放比例 (確保圖片永遠大於紅框)
    const scaleW = cw / iw;
    const scaleH = ch / ih;
    const minScale = Math.max(scaleW, scaleH); // 取較大者，確保填滿
    
    state.editor.minScale = minScale;
    state.editor.scale = minScale; // 預設為填滿
    
    // 居中
    state.editor.posX = (cw - iw * state.editor.scale) / 2;
    state.editor.posY = (ch - ih * state.editor.scale) / 2;
}

// 拖曳邏輯
function onDragStart(e) {
    e.preventDefault();
    isDragging = true;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    startX = clientX;
    startY = clientY;
    initialPosX = state.editor.posX;
    initialPosY = state.editor.posY;
    
    document.getElementById('crop-overlay').style.cursor = 'grabbing';
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
    // 圖片左邊緣不能超過容器左邊緣 (newX <= 0)
    // 圖片右邊緣不能離開容器右邊緣 (newX + imgW*scale >= containerW)
    const containerW = state.editor.containerWidth;
    const containerH = state.editor.containerHeight;
    const currentW = state.editor.imageWidth * state.editor.scale;
    const currentH = state.editor.imageHeight * state.editor.scale;
    
    // 限制 X
    if (newX > 0) newX = 0;
    if (newX + currentW < containerW) newX = containerW - currentW;
    
    // 限制 Y
    if (newY > 0) newY = 0;
    if (newY + currentH < containerH) newY = containerH - currentH;
    
    state.editor.posX = newX;
    state.editor.posY = newY;
    
    updateTransform();
}

function onDragEnd() {
    isDragging = false;
    document.getElementById('crop-overlay').style.cursor = 'grab';
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
    // 限制縮放範圍
    if (newScale < state.editor.minScale) newScale = state.editor.minScale;
    if (newScale > state.editor.minScale * 5) newScale = state.editor.minScale * 5; // 最大放大 5 倍
    
    // 縮放時要保持中心點，或者簡單點，重新計算邊界
    // 這裡簡化：縮放後執行邊界檢查，如果出界就拉回來
    state.editor.scale = newScale;
    
    // 重新觸發一次邊界檢查邏輯 (借用 onDragMove 的邏輯概念)
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
    // 使用 translate3d 啟用硬體加速
    img.style.transformOrigin = '0 0';
    img.style.transform = `translate3d(${state.editor.posX}px, ${state.editor.posY}px, 0) scale(${state.editor.scale})`;
}

// 更新輔助線與遮罩文字
export function drawGuides() {
    // 根據目前的 specId 更新文字
    const label = document.getElementById('maskLabel');
    const spec = state.specConfig[state.currentSpecId];
    if (spec && label) {
        label.innerText = `${spec.width_mm}x${spec.height_mm}mm`;
    }
    
    // 更新輔助線位置 (CSS 控制)
    const guideBox = document.getElementById('guide-box');
    if (!guideBox) return;
    
    // 顯示輔助線說明
    guideBox.classList.remove('d-none');
}

// 【核心功能】產生裁切後的圖片 (Base64)
export function generateCroppedImage() {
    const img = document.getElementById('previewImg');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 目標輸出尺寸 (與紅框比例一致，解析度設高一點以保證品質)
    // 這裡我們輸出 2倍 紅框像素大小，確保夠清晰
    const outputW = state.editor.containerWidth * 2; 
    const outputH = state.editor.containerHeight * 2;
    
    canvas.width = outputW;
    canvas.height = outputH;
    
    // 計算來源圖片的裁切區域
    // 概念：紅框在螢幕上是固定的，圖片在移動。
    // sourceX = -posX / scale
    const sourceX = -state.editor.posX / state.editor.scale;
    const sourceY = -state.editor.posY / state.editor.scale;
    const sourceW = state.editor.containerWidth / state.editor.scale;
    const sourceH = state.editor.containerHeight / state.editor.scale;
    
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, outputW, outputH);
    
    return canvas.toDataURL('image/jpeg', 0.95);
}
