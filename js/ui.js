import { state } from './state.js';
import { setEditorZoom } from './editor.js';

export function showLoading(show, text="處理中...") {
    const el = document.getElementById('loading');
    if(show) {
        el.querySelector('div.text-dark').innerText = text;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}

export function renderSpecList(onSelect) {
    const container = document.getElementById('specs-container');
    container.innerHTML = '';
    for (const [key, val] of Object.entries(state.specConfig)) {
        const div = document.createElement('div');
        div.className = 'spec-card';
        div.id = `spec-${key}`;
        div.onclick = () => onSelect(key);
        
        const title = val.name;
        const subtitle = val.desc || `${val.width_mm} x ${val.height_mm} mm`;

        div.innerHTML = `
            <div>
                <div class="fw-bold text-dark" style="font-size: 1rem;">${title}</div>
                <div class="text-muted" style="font-size: 0.8rem;">${subtitle}</div>
            </div>
            <i class="bi bi-check-circle-fill text-primary d-none check-icon fs-5"></i>
        `;
        container.appendChild(div);
    }
}

export function updateMaskSize(width_mm, height_mm) {
    // 根據規格動態調整紅框 (wrapper) 的長寬比
    // 這裡我們假設編輯器高度固定 (例如 400px)，寬度依比例縮放
    const wrapper = document.querySelector('.image-wrapper');
    if (!wrapper) return;
    
    const ratio = width_mm / height_mm;
    const baseHeight = 450; // 基準高度 px
    const newWidth = baseHeight * ratio;
    
    wrapper.style.height = `${baseHeight}px`;
    wrapper.style.width = `${newWidth}px`;
}
