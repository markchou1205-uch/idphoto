import { state } from './state.js';

// 初始化
export function initEditor() {
    // 新版 CSS 自動適應，不需 JS 監聽 Resize
}

// 自動對齊顯示
export function autoAlignImage() {
    const img = document.getElementById('previewImg'); // 左側上傳區的預覽
    const mainImg = document.getElementById('main-preview-img'); // 右側儀表板的主圖

    // 如果主要預覽圖存在 (儀表板模式)，就不需要處理左側小圖的對齊
    if (mainImg && !mainImg.classList.contains('d-none')) {
        return;
    }

    if (img) {
        img.classList.remove('d-none');
        img.style.transform = 'none'; // 重置所有位移，交給 CSS
    }
}

export function loadImageToEditor(base64) {
    const img = document.getElementById('previewImg');
    // 同時更新右側儀表板的圖 (如果有的話)
    const mainImg = document.getElementById('main-preview-img');
    
    if (img) {
        img.onload = () => {
            state.editor.imageWidth = img.naturalWidth;
            state.editor.imageHeight = img.naturalHeight;
            updateMaskRatio(); 
            autoAlignImage();
        };
        img.src = base64;
        img.classList.remove('d-none');
    }
    
    if (mainImg) {
        mainImg.src = base64;
    }
}

export function updateMaskRatio(width_mm, height_mm) {
    // 1. 取得容器
    const wrapper = document.querySelector('.image-wrapper');
    
    // [關鍵修正] 如果找不到容器 (例如在某些頁面狀態下)，直接離開，不要報錯
    if (!wrapper) return; 

    // 2. 取得規格
    if (!width_mm && state.specConfig[state.currentSpecId]) {
        width_mm = state.specConfig[state.currentSpecId].width_mm;
        height_mm = state.specConfig[state.currentSpecId].height_mm;
    }
    if (!width_mm) return;

    // 3. 設定比例 (僅調整容器大小，不畫線)
    const baseHeight = 300; // 左側預覽區高度較小
    const ratio = width_mm / height_mm;
    const newWidth = baseHeight * ratio;
    
    wrapper.style.height = `${baseHeight}px`;
    wrapper.style.width = `${newWidth}px`;
    wrapper.style.backgroundColor = '#ffffff';
    
    // 清空舊遮罩
    const mask = document.querySelector('.crop-mask');
    if(mask) mask.innerHTML = '';
}

export function getCropParams() {
    return null; // V6.0+ 全自動，不需前端參數
}
