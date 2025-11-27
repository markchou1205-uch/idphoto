import { state } from './state.js';

// 顯示/隱藏全域 Loading
export function showLoading(show, text = "處理中...") {
    // 嘗試取得 loading 元素，若無則動態建立 (確保 V14.0 之前的 HTML 也能運作)
    let loader = document.getElementById('loading');
    
    if (!loader && show) {
        loader = document.createElement('div');
        loader.id = 'loading';
        loader.className = 'loading-overlay';
        loader.innerHTML = `<div class="spinner-border text-primary" role="status"></div><div class="mt-2 fw-bold text-dark">${text}</div>`;
        document.body.appendChild(loader);
        
        // 補上對應 CSS (若 style.css 沒寫)
        loader.style.position = 'fixed';
        loader.style.top = '0';
        loader.style.left = '0';
        loader.style.width = '100%';
        loader.style.height = '100%';
        loader.style.backgroundColor = 'rgba(255,255,255,0.8)';
        loader.style.zIndex = '9999';
        loader.style.display = 'flex';
        loader.style.flexDirection = 'column';
        loader.style.alignItems = 'center';
        loader.style.justifyContent = 'center';
    }

    if (loader) {
        if (show) {
            loader.classList.remove('d-none');
            // 更新文字
            const textEl = loader.querySelector('.fw-bold') || loader.querySelector('.mt-2');
            if (textEl) textEl.innerText = text;
        } else {
            loader.classList.add('d-none');
        }
    }
}

// 渲染規格列表
export function renderSpecList(onSelectCallback) {
    const container = document.getElementById('specs-container');
    if (!container) return;

    container.innerHTML = '';
    const specs = state.specConfig;

    Object.keys(specs).forEach(key => {
        const spec = specs[key];
        const div = document.createElement('div');
        div.className = 'spec-card p-3 border rounded cursor-pointer position-relative bg-white mb-2';
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

// [新增] 切換工作區顯示 (修復 main.js 報錯)
export function showWorkspace() {
    const dashboard = document.getElementById('dashboard-area');
    const resultDashboard = document.getElementById('result-dashboard');
    
    // V14.0 邏輯：
    // 如果已經有結果圖片，顯示結果區
    // 如果只是剛上傳，暫時維持 Dashboard 或顯示結果區的空狀態
    
    if (state.isImageLoaded) {
        // 圖片已載入，切換到工作區
        if(dashboard) dashboard.classList.add('d-none');
        if(resultDashboard) {
            resultDashboard.classList.remove('d-none');
            // 確保主圖顯示 (剛上傳時顯示原圖)
            const mainImg = document.getElementById('main-preview-img');
            if(mainImg && state.originalBase64) {
                mainImg.src = state.originalBase64;
                mainImg.classList.remove('d-none');
            }
        }
    } else {
        // 回到首頁
        if(dashboard) dashboard.classList.remove('d-none');
        if(resultDashboard) resultDashboard.classList.add('d-none');
    }
}

// [新增] 顯示功能介紹 (相容性保留)
export function showIntro(featureId) {
    // V14.0 沒有 intro 區塊，直接導回 Dashboard
    const dashboard = document.getElementById('dashboard-area');
    const resultDashboard = document.getElementById('result-dashboard');
    
    if(dashboard) dashboard.classList.remove('d-none');
    if(resultDashboard) resultDashboard.classList.add('d-none');
}

// 輔助函式：渲染檢查列表 (給舊版代碼相容用)
export function renderCheckResults(results) {
    // 留空
}
