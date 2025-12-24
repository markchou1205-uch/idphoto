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
    showAuditReport(imgSrc, validationResults, faceData, onProceed, onRetry) {
        // Validation check for args in case calling from old code
        if (typeof faceData === 'function') {
            onRetry = onProceed;
            onProceed = faceData;
            faceData = null;
        }

        const overlay = document.createElement('div');
        overlay.className = 'id-modal-overlay';

        let hasFail = false;
        let hasWarn = false;

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
            { name: 'AI 智能裁切 (3.2-3.6cm)', status: '待處理', color: '#eee' },
            { name: '背景去除與白底合成', status: '待處理', color: '#eee' },
            { name: '臉部光線智能補光', status: '硬體限制 (略過)', color: '#fff3cd' }, // Updated per user request
            { name: '照片尺寸調整 (35x45mm)', status: '待處理', color: '#eee' },
            { name: '解析度優化', status: '待處理', color: '#eee' }
        ];

        const servicesHtml = services.map(s => `
            <div class="report-item pending">
                <span>⚡ ${s.name}</span>
                <span class="badge" style="background:${s.color}; color:#666; padding:2px 6px; border-radius:4px; font-size:0.8em">${s.status}</span>
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

        // SAFE IMAGE & LINE DRAWING LOGIC
        const container = overlay.querySelector('#report-img-container');
        container.style.position = 'relative'; // For absolute positioning of lines

        const img = document.createElement('img');
        img.src = imgSrc;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '300px';
        img.style.border = '1px solid #ccc';
        img.style.borderRadius = '4px';
        img.style.display = 'block';
        img.style.margin = '0 auto';

        img.onload = () => {
            // Draw Lines if markers exist
            if (faceData && faceData.markers) {
                const { hairTopY, chinY } = faceData.markers;
                if (hairTopY && chinY) {
                    // Calculation scaling
                    // Logic: The image is displayed at some size. We need to map natural coords to display coords.
                    // But img.width/height depends on CSS constraint (maxHeight 300).
                    const scale = img.height / img.naturalHeight;

                    // Since img is centered or block, we need to position the overlay relative to the IMAGE, not the container?
                    // Container is text-align center.
                    // For precise overlay, best to wrap image.
                    const wrapper = document.createElement('div');
                    wrapper.style.position = 'relative';
                    wrapper.style.display = 'inline-block';
                    img.parentNode.insertBefore(wrapper, img);
                    wrapper.appendChild(img);

                    const drawLine = (yNat, color, labelText) => {
                        const yPx = yNat * scale;
                        const line = document.createElement('div');
                        line.style.position = 'absolute';
                        line.style.top = `${yPx}px`;
                        line.style.left = '0';
                        line.style.width = '100%';
                        line.style.borderTop = `2px dashed ${color}`;
                        line.style.zIndex = '10';
                        if (labelText) {
                            const lbl = document.createElement('span');
                            lbl.innerText = labelText;
                            lbl.style.position = 'absolute';
                            lbl.style.right = '-110px'; // Push out to right side info
                            lbl.style.top = '-10px';
                            lbl.style.color = color;
                            lbl.style.fontSize = '12px';
                            lbl.style.backgroundColor = 'rgba(255,255,255,0.8)';
                            lbl.style.padding = '2px 4px';
                            line.appendChild(lbl);
                        }
                        wrapper.appendChild(line);
                    };

                    drawLine(hairTopY, 'red', '頭頂 (預估)');
                    drawLine(chinY, 'red', '下巴');

                    // Add guideline text
                    const guide = document.createElement('div');
                    guide.style.position = 'absolute';
                    // Position roughly between the two lines
                    guide.style.top = `${(hairTopY * scale + chinY * scale) / 2}px`;
                    guide.style.right = '-20px';
                    guide.style.transform = 'translate(100%, -50%)';
                    guide.style.color = 'red';
                    guide.style.fontSize = '12px';
                    guide.style.fontWeight = 'bold';
                    guide.style.width = '100px';
                    guide.style.textAlign = 'left';
                    guide.innerText = '應介於 3.2 - 3.6 cm';
                    wrapper.appendChild(guide);

                    // Also draw bracket? 
                    const bracket = document.createElement('div');
                    bracket.style.position = 'absolute';
                    bracket.style.top = `${hairTopY * scale}px`;
                    bracket.style.right = '-5px';
                    bracket.style.width = '10px';
                    bracket.style.height = `${(chinY - hairTopY) * scale}px`;
                    bracket.style.borderRight = '2px solid red';
                    bracket.style.borderTop = '2px solid red';
                    bracket.style.borderBottom = '2px solid red';
                    wrapper.appendChild(bracket);
                }
            }
        };
        container.appendChild(img);


        document.getElementById('modal-proceed-btn').onclick = () => {
            overlay.remove();
            onProceed(); // Go to Stage 2: Production
        };
        document.getElementById('modal-retry-btn').onclick = () => {
            overlay.remove();
            onRetry();
        };
    },



    showComparison(origImg, resultImg, bgRemoved = true) {
        const container = document.getElementById('preview-container');
        const compareView = document.getElementById('compare-view');

        // Clear previous
        container.innerHTML = '';
        if (compareView) compareView.classList.add('d-none');

        // Main Flex Container
        const mainWrapper = document.createElement('div');
        mainWrapper.className = 'd-flex justify-content-center align-items-center gap-5 animate-fade-in';
        mainWrapper.style.width = '100%';
        // Ensure responsiveness on small screens
        mainWrapper.style.flexWrap = 'wrap';

        // 1. Original (Left)
        const leftCol = document.createElement('div');
        leftCol.className = 'text-center';
        leftCol.innerHTML = '<h5 class="fw-bold mb-3">原始照片</h5>';

        // Clone original image to avoid moving the reference if needed, 
        // or just use valid src. origImg is an Image object.
        // We really want to display it, so append it.
        // BUT origImg might be huge.
        origImg.className = 'shadow-sm rounded';
        origImg.style.maxHeight = '300px';
        origImg.style.maxWidth = '100%';
        origImg.style.objectFit = 'contain';
        leftCol.appendChild(origImg);
        mainWrapper.appendChild(leftCol);

        // 2. Arrow (Center)
        const arrow = document.createElement('div');
        arrow.className = 'd-none d-md-block'; // Hide on mobile if wrapping
        arrow.innerHTML = '<i class="bi bi-arrow-right fs-1 text-secondary"></i>';
        mainWrapper.appendChild(arrow);

        // 3. Result (Right)
        const rightCol = document.createElement('div');
        rightCol.className = 'position-relative text-center';
        rightCol.style.maxWidth = '350px';

        const title = document.createElement('h5');
        title.className = 'fw-bold mb-3';
        title.innerHTML = '製作成品 (35x45mm)';
        rightCol.appendChild(title);

        // BG Removal Warning
        if (!bgRemoved) {
            const warning = document.createElement('div');
            warning.className = 'alert alert-warning py-1 small mb-2';
            warning.style.fontSize = '0.8rem';
            warning.innerHTML = '<i class="bi bi-exclamation-triangle"></i> 無法移除背景 (服務授權限制)';
            rightCol.appendChild(warning);
        }

        // Final Image
        resultImg.className = 'img-fluid shadow-lg rounded';
        resultImg.style.border = '1px solid #ddd';
        resultImg.style.maxHeight = '450px';
        rightCol.appendChild(resultImg);

        // Manual Adjust Button
        const btnContainer = document.createElement('div');
        btnContainer.className = 'mt-3';
        btnContainer.innerHTML = `
            <button id="manual-adjust-btn" class="btn btn-secondary btn-sm shadow-sm">
                <i class="bi bi-tools"></i> 🛠 手動調整 / 重新裁切
            </button>
        `;
        rightCol.appendChild(btnContainer);

        mainWrapper.appendChild(rightCol);
        container.appendChild(mainWrapper);

        return {
            wrapper: rightCol, // Guides attach here
            imgElement: resultImg,
            manualBtn: container.querySelector('#manual-adjust-btn')
        };
    },

    // 5. Apply Red Guide Lines (Ministry of Interior Spec)
    applyResultGuides(wrapperElement) {
        // Standard: Head (HairTop to Chin) = 3.2cm - 3.6cm
        // Photo H = 4.5cm.
        // 3.2/4.5 = 71.1%
        // 3.6/4.5 = 80.0%

        // Fixed position guides based on Ratio (since it's a standard crop)
        // We can just draw lines at calculated % positions.

        const createLine = (topPercent, color, text) => {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.top = `${topPercent}%`;
            line.style.left = '0';
            line.style.width = '100%';
            line.style.borderTop = `1px dashed ${color}`;
            line.style.zIndex = '10';

            if (text) {
                const label = document.createElement('span');
                label.innerText = text;
                label.style.position = 'absolute';
                label.style.right = '5px';
                label.style.top = '-18px';
                label.style.color = color;
                label.style.fontSize = '10px';
                label.style.fontWeight = 'bold';
                label.style.background = 'rgba(255,255,255,0.7)';
                line.appendChild(label);
            }
            wrapperElement.appendChild(line);
            return line;
        };

        // Top Margin ~0.45cm (10%)? Using standard spec logic.
        // If crop was perfect, Head top is at ~10% (0.45cm).
        const topRef = 10; // 0.45cm / 4.5cm
        const headMin = 3.2 / 4.5 * 100; // 71.1%
        const headMax = 3.6 / 4.5 * 100; // 80%

        // Hair Top Line
        createLine(topRef, 'red', '頭髮頂端');

        // Chin Bottom Range (Expected)
        // Chin should be at Top + HeadHeight
        // Min Chin Y = 10 + 71.1 = 81.1%
        // Max Chin Y = 10 + 80 = 90%

        const minChin = topRef + headMin;
        const maxChin = topRef + headMax;

        // Draw Range Box or Lines
        createLine(maxChin, 'red', '下巴 (3.6cm)');
        // createLine(minChin, 'orange', '下巴 (3.2cm)');

        // Bracket on the right
        const bracket = document.createElement('div');
        bracket.style.position = 'absolute';
        bracket.style.top = `${topRef}%`;
        bracket.style.right = '2px';
        bracket.style.height = `${headMax}%`; // down to max chin
        bracket.style.width = '10px';
        bracket.style.borderTop = '2px solid red';
        bracket.style.borderBottom = '2px solid red';
        bracket.style.borderRight = '2px solid red';
        wrapperElement.appendChild(bracket);

        const info = document.createElement('div');
        info.innerText = '應介於 3.2 - 3.6 cm';
        info.style.position = 'absolute';
        info.style.right = '-110px'; // Push out
        info.style.top = '50%';
        info.style.transform = 'translateY(-50%)';
        info.style.color = 'red';
        info.style.fontSize = '12px';
        info.style.fontWeight = 'bold';
        // wrapperElement.appendChild(info); // Might overlay compare arrow, careful
    }
};
