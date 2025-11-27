import { state } from './state.js';

export function showLoading(show, text = "處理中...") {
    const loader = document.getElementById('loading');
    if (!loader) return; // 安全檢查

    if (show) {
        loader.classList.remove('d-none');
        const textEl = loader.querySelector('.mt-2');
        if (textEl) textEl.innerText = text;
    } else {
        loader.classList.add('d-none');
    }
}

export function renderSpecList(onSelectCallback) {
    const container = document.getElementById('specs-container');
    if (!container) return;

    container.innerHTML = '';
    const specs = state.specConfig;

    Object.keys(specs).forEach(key => {
        const spec = specs[key];
        const div = document.createElement('div');
        div.className = 'spec-card p-3 border rounded cursor-pointer position-relative bg-white';
        div.id = `spec-${key}`;
        div.onclick = () => onSelectCallback(key);
        
        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold">${spec.name}</div>
                    <small class="text-muted">${spec.desc}</small>
                </div>
                <i class="bi bi-check-circle-fill text-primary check-icon d-none"></i>
            </div>
        `;
        container.appendChild(div);
    });
}

// 輔助函式：渲染檢查列表 (給舊版代碼相容用，新版 main.js 已自行實作)
export function renderCheckResults(results) {
    // 留空，避免舊邏輯呼叫報錯
}
