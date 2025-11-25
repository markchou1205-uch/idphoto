import { state } from './state.js';
import * as Editor from './editor.js';

export function showLoading(show, text="處理中...") {
    const el = document.getElementById('loading');
    if(show) {
        el.querySelector('div.text-dark').innerText = text;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}

// 切換到工作區 (編輯器)
export function showWorkspace() {
    document.getElementById('dashboard-area').classList.add('d-none');
    document.getElementById('intro-area').classList.add('d-none');
    document.getElementById('workspace-area').classList.remove('d-none');
    
    // 顯示縮放工具列
    const zoomTool = document.getElementById('zoom-toolbar');
    if(zoomTool) zoomTool.classList.remove('d-none');

    // 延遲重繪遮罩 (因為 display:none 切換會導致尺寸計算為 0)
    setTimeout(() => {
        if(state.currentSpecId === 'custom') {
            // 處理自訂邏輯 (略)
        } else if(state.specConfig[state.currentSpecId]) {
            const s = state.specConfig[state.currentSpecId];
            Editor.updateMaskRatio(s.width_mm, s.height_mm);
        }
    }, 100);
}

// 切換到功能介紹頁
export function showIntro(featureId) {
    document.getElementById('dashboard-area').classList.add('d-none');
    document.getElementById('workspace-area').classList.add('d-none');
    const intro = document.getElementById('intro-area');
    intro.classList.remove('d-none');
    intro.className = "container py-5 h-100 d-flex align-items-center justify-content-center text-center animate-fade";

    const content = {
        'id-photo': { title: '證件照製作', icon: 'bi-person-badge-fill', desc: '上傳生活照，拖曳調整位置，AI 自動去背、修圖。<br>支援護照、簽證等多國規格。' },
        'job-photo': { title: '職場求職照', icon: 'bi-briefcase-fill', desc: 'AI 智慧換裝，一鍵生成專業形象照。<br>(需 RTX 3090 算力支援)' },
        'grad-photo': { title: '畢業學士照', icon: 'bi-mortarboard-fill', desc: '雲端生成學士服照片，紀念青春時刻。<br>(需 RTX 3090 算力支援)' },
        'beauty': { title: '智能美顏', icon: 'bi-magic', desc: '磨皮、瘦臉、大眼，自然美化不失真。' },
        'restore': { title: '老圖翻新', icon: 'bi-hourglass-split', desc: '修復破損、去除噪點、黑白上色。' }
    };

    const data = content[featureId] || content['id-photo'];
    document.getElementById('intro-title').innerText = data.title;
    document.getElementById('intro-icon').className = `bi ${data.icon} fs-1 text-primary`;
    document.getElementById('intro-desc').innerHTML = data.desc;
}

// 渲染規格列表
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

// 渲染合規檢查結果
export function renderCheckResults(results) {
    const list = document.getElementById('check-results-list');
    list.innerHTML = '';

    let failCount = 0, warningCount = 0, fixableCount = 0, unfixableCount = 0;
    results.forEach(item => {
        if(item.status === 'fail') failCount++;
        if(item.status === 'warning') warningCount++;
        if ((item.status === 'fail' || item.status === 'warning') && !item.fix_action) unfixableCount++;
        if(item.fix_action) fixableCount++;
    });

    let summaryHtml = '';
    let totalIssues = failCount + warningCount;

    if (totalIssues === 0) {
        summaryHtml = `<div class="alert alert-success border-0 shadow-sm mb-3 text-center"><i class="bi bi-check-circle-fill fs-3 d-block mb-2"></i><h5 class="fw-bold">照片符合標準</h5><p class="mb-0 small">太棒了！這張照片符合 AI 初步審查標準。</p></div>`;
    } else if (unfixableCount > 0) {
        summaryHtml = `<div class="alert alert-danger border-0 shadow-sm mb-3"><h5 class="fw-bold text-danger"><i class="bi bi-exclamation-triangle-fill me-2"></i>建議重新拍攝</h5><p class="mb-1 small">經審查發現 <strong>${totalIssues}</strong> 個缺失，其中包含無法修復的項目。</p><div class="mt-2"><button class="btn btn-sm btn-outline-danger w-100" onclick="document.getElementById('fileInput').click()">重新上傳</button></div></div>`;
    } else {
        summaryHtml = `<div class="alert alert-primary border-0 shadow-sm mb-3"><h5 class="fw-bold text-primary"><i class="bi bi-magic me-2"></i>發現可修復的問題</h5><p class="mb-1 small">發現 <strong>${totalIssues}</strong> 個可修復缺失，建議使用「AI 修復」。</p></div>`;
    }
    list.innerHTML = summaryHtml;

    results.forEach(item => {
        let icon = 'bi-check-circle-fill text-success'; let bg = 'bg-light'; let actionBtn = '';
        if (item.status === 'warning') { icon = 'bi-exclamation-triangle-fill text-warning'; bg = 'bg-warning-subtle'; }
        if (item.status === 'fail') { icon = 'bi-x-circle-fill text-danger'; bg = 'bg-danger-subtle'; }
        
        // 注意：這裡調用 window.applyFix (因為 main.js 會將其掛載到 window)
        if (item.fix_action) actionBtn = `<button class="btn btn-sm btn-primary ms-2 shadow-sm" onclick="window.applyFix('${item.fix_action}')"><i class="bi bi-magic"></i> 修復</button>`;
        
        const div = document.createElement('div');
        div.className = `list-group-item d-flex justify-content-between align-items-center ${bg} mb-1 border-0 rounded`;
        div.innerHTML = `<span><i class="bi ${icon} me-2"></i> ${item.item}</span><div class="d-flex align-items-center"><span class="badge bg-white text-dark border me-1">${item.msg}</span>${actionBtn}</div>`;
        list.appendChild(div);
    });

    const modal = new bootstrap.Modal(document.getElementById('checkModal'));
    modal.show();
}
