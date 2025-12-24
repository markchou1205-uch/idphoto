export const UI = {
    // 1. Inject Styles
    initStyles() {
        if (document.getElementById('ui-styles')) return;
        const style = document.createElement('style');
        style.id = 'ui-styles';
        style.textContent = `
            .id-modal-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(5px);
            }
            .id-modal-content {
                background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;
                font-family: 'Segoe UI', system-ui, sans-serif;
            }
            .id-modal-header { font-size: 1.5rem; font-weight: bold; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .id-btn {
                padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 1rem; margin: 5px;
                transition: transform 0.1s;
            }
            .id-btn:active { transform: scale(0.98); }
            .id-btn-primary { background: #007bff; color: white; }
            .id-btn-danger { background: #dc3545; color: white; }
            .id-btn-secondary { background: #6c757d; color: white; }
            
            /* Report Grid */
            .report-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            @media(max-width: 600px) { .report-grid { grid-template-columns: 1fr; } }
            
            .report-section-title { font-weight: bold; margin-top: 15px; margin-bottom: 8px; color: #333; border-left: 4px solid #007bff; padding-left: 8px; }
            .report-item { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #f0f0f0; align-items: center; }
            .report-item.pass { color: green; }
            .report-item.fail { color: #dc3545; background: #fff5f5; }
            .report-item.warn { color: #856404; background: #fff3cd; }
            .report-item.pending { color: #555; font-style: italic; }
            
            .warning-box { background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #ffeeba; }
            .warning-text { color: #dc3545; font-weight: bold; margin-bottom: 10px; display: block; }
            
            /* Comparison View */
            .compare-container { display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap; margin-top: 30px; }
            .compare-box { text-align: center; }
            .compare-arrow { font-size: 2rem; color: #666; }
            .compare-img { max-width: 100%; border: 1px solid #ddd; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        `;
        document.head.appendChild(style);
    },

    // 2. Modal 1: Usage Confirmation
    showUseConfirm(usage, onConfirm) {
        this.initStyles();
        const overlay = document.createElement('div');
        overlay.className = 'id-modal-overlay';
        overlay.innerHTML = `
            <div class="id-modal-content">
                <div class="id-modal-header">確認製作規格</div>
                <p>您選擇的相片用途為：<strong style="font-size:1.2rem; color:#007bff">${usage}</strong></p>
                <p>系統將立即為您進行各種合規性審查。</p>
                <div style="text-align: right; margin-top: 25px;">
                    <button class="id-btn id-btn-primary" id="modal-confirm-btn">開始審查</button>
                    <button class="id-btn id-btn-secondary" onclick="this.closest('.id-modal-overlay').remove()">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('modal-confirm-btn').onclick = () => {
            overlay.remove();
            onConfirm();
        };
    },

    // 3. Modal 2: Audit Report
    showAuditReport(imgSrc, validationResults, onProceed, onRetry) {
        const overlay = document.createElement('div');
        overlay.className = 'id-modal-overlay';

        let hasFail = false;
        let hasWarn = false;

        // Filter: Separate User Errors from System Services
        // "Head Ratio" / "Crop" issues are SERVICES, not Errors effectively in this new flow.
        // We will hardcode the Service List for now.

        const userItemsHtml = validationResults.map(res => {
            if (res.status === 'fail') hasFail = true;
            if (res.status === 'warn') hasWarn = true;
            const icon = res.status === 'pass' ? '✔' : (res.status === 'fail' ? '❌' : '⚠️');
            return `<div class="report-item ${res.status}">
                <span>${icon} ${res.item}</span>
                <span style="font-size:0.9em">${res.value}</span>
            </div>`;
        }).join('');

        const services = [
            'AI 智能裁切 (3.2-3.6cm)',
            '背景去除與白底合成',
            '臉部光線智能補光',
            '照片尺寸調整 (35x45mm)',
            '解析度優化'
        ];

        const servicesHtml = services.map(s => `
            <div class="report-item pending">
                <span>⚡ ${s}</span>
                <span class="badge" style="background:#eee; color:#666; padding:2px 6px; border-radius:4px; font-size:0.8em">待處理</span>
            </div>
        `).join('');

        const warningBlock = (hasFail || hasWarn) ? `
            <div class="warning-box">
                <span class="warning-text">經初步審查，您的相片可能不符審查標準！</span>
                請參考上方審查結果（紅/黃色項目）與內政部規定。<br>
                若您確認原圖無誤，可選擇繼續製作，但可能被退件。
            </div>
        ` : '';

        const proceedBtnText = (hasFail || hasWarn) ? '已確認，繼續製作' : '製作標準證件照';
        const proceedBtnClass = (hasFail || hasWarn) ? 'id-btn-danger' : 'id-btn-primary';

        overlay.innerHTML = `
            <div class="id-modal-content" style="max-width:800px">
                <div class="id-modal-header">AI 智能審查報告</div>
                <div class="report-grid">
                    <!-- Left: Report -->
                    <div>
                        <div class="report-section-title">用戶原圖檢查</div>
                        ${userItemsHtml}
                        
                        <div class="report-section-title">系統加值服務 (即將進行)</div>
                        ${servicesHtml}
                    </div>
                    
                    <!-- Right: Original Preview -->
                    <div style="text-align:center" id="report-img-container">
                        <div class="report-section-title">原始照片預覽</div>
                         <!-- Img will be appended safely -->
                    </div>
                </div>

                ${warningBlock}


                <div style="text-align: right; margin-top: 25px;">
                     <button class="id-btn id-btn-secondary" id="modal-retry-btn">重傳照片</button>
                     <button class="id-btn ${proceedBtnClass}" id="modal-proceed-btn">${proceedBtnText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Safely append Image
        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '300px';
        img.style.border = '1px solid #ccc';
        img.style.borderRadius = '4px';

        const imgContainer = overlay.querySelector('#report-img-container');
        if (imgContainer) imgContainer.appendChild(img);

        document.getElementById('modal-proceed-btn').onclick = () => {
            overlay.remove();
            onProceed(); // Go to Stage 2: Production
        };
        document.getElementById('modal-retry-btn').onclick = () => {
            overlay.remove();
            onRetry();
        };
    },

    // 4. Final Comparison View
    showComparison(originalSrc, finalCanvas) {
        // Find existing container or create new
        let container = document.getElementById('comparison-view');
        if (!container) {
            container = document.createElement('div');
            container.id = 'comparison-view';
            container.className = 'compare-container';
            // Insert after main preview area? Or replace it?
            // The user says "Show Side-by-Side Comparison". 
            // Ideally we clear the "Main Preview" area and inject this.
            const mainArea = document.querySelector('.preview-area') || document.getElementById('preview-container');
            if (mainArea) {
                mainArea.innerHTML = '';
                mainArea.appendChild(container);
            }
        }

        // Convert canvas to img for simple display if needed, or just append canvas.
        // We need to label them.

        container.innerHTML = `
            <div class="compare-box">
                <h4>原始照片</h4>
                <img src="${originalSrc}" class="compare-img" style="height:300px;">
            </div>
            <div class="compare-arrow">➔</div>
            <div class="compare-box" id="final-result-box">
                <h4>製作成品 (35x45mm)</h4>
                <!-- Final Canvas or Img goes here -->
            </div>
        `;

        const finalBox = container.querySelector('#final-result-box');
        finalCanvas.style.height = '300px';
        finalCanvas.style.width = 'auto'; // Keep ratio
        finalCanvas.className = 'compare-img';

        // We need to wrap the final canvas in the "Guide Overlay" wrapper we built in main.js
        // Ideally we reuse that logic.
        // But main.js logic appends to 'mainPreview'.
        // Let's allow main.js to handle the specific "Guide Overlay" logic on the element we created.

        // For now, return the container element so main.js can append the canvas.
        return finalBox;
    }
};
