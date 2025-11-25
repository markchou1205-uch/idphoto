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
    // 如果沒有偵測到人臉，使用預設置中 (Cover 模式)
    if (!img || !state.faceData || !state.faceData.found) {
        centerImageDefault();
        return;
    }

    // 雖然我們有臉部數據，但為了讓預覽好看，
    // 我們還是希望圖片能盡量填滿框框，而不是縮很小
    // 所以這裡我們也使用 centerImageDefault 來做初始顯示
    // 因為實際裁切是後端做，前端只是給使用者確認 "圖片有上傳成功"
    centerImageDefault();
}

function centerImageDefault() {
    const img = document.getElementById('previewImg');
    if (!img) return;
    
    const cw = state.editor.containerWidth;
    const ch = state.editor.containerHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    
    // [修正] 使用 Math.max 確保圖片 "Cover" (填滿) 容器
    // 這樣小圖片會被放大，大圖片會被縮小，但都不會留黑邊
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
        // 圖片載入後，強制執行一次對齊
        centerImageDefault();
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
    
    // 清空遮罩內容 (不顯示紅框)
    mask.innerHTML = '';
    
    if(state.isImageLoaded) centerImageDefault();
}

// 取得裁切參數 (其實後端 V6.0 已經不看這個了，但保留格式以防萬一)
export function getCropParams() {
    const scale = state.editor.scale;
    return {
        x: -state.editor.posX / scale,
        y: -state.editor.posY / scale,
        w: state.editor.containerWidth / scale,
        h: state.editor.containerHeight / scale,
        is_manual: true 
    };
}
