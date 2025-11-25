import { state } from './state.js';

export function initEditor() {
    // 移除 resize 監聽，改用 CSS 自動適應
}

// 自動對齊 (現在僅負責顯示)
export function autoAlignImage() {
    const img = document.getElementById('previewImg');
    if (img) {
        img.classList.remove('d-none');
        // 清除所有手動位移，交給 CSS Flexbox 居中
        img.style.transform = 'none';
    }
}

export function loadImageToEditor(base64) {
    const img = document.getElementById('previewImg');
    const wrapper = document.querySelector('.image-wrapper');
    
    // 確保容器也是白底
    if(wrapper) wrapper.style.backgroundColor = '#ffffff';

    img.onload = () => {
        state.editor.imageWidth = img.naturalWidth;
        state.editor.imageHeight = img.naturalHeight;
        
        // 移除舊的遮罩/框線
        const mask = document.querySelector('.crop-mask');
        if(mask) mask.innerHTML = '';
        
        autoAlignImage();
    };
    img.src = base64;
    img.classList.remove('d-none');
}

export function updateMaskRatio(width_mm, height_mm) {
    // 僅更新容器比例，不畫線
    if (!width_mm && state.specConfig[state.currentSpecId]) {
        width_mm = state.specConfig[state.currentSpecId].width_mm;
        height_mm = state.specConfig[state.currentSpecId].height_mm;
    }
    if (!width_mm) return;

    const wrapper = document.querySelector('.image-wrapper');
    const baseHeight = 450; 
    const ratio = width_mm / height_mm;
    const newWidth = baseHeight * ratio;
    
    wrapper.style.height = `${baseHeight}px`;
    wrapper.style.width = `${newWidth}px`;
    wrapper.style.backgroundColor = '#ffffff'; // 強制白底
}

export function getCropParams() {
    // 由於後端已經全自動化 (V6.0)，前端參數不再重要，回傳預設值即可
    return null; 
}
