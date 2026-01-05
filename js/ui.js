export const UI = {
    // 1. Sidebar Control
    toggleSidebar(show) {
        const sidebar = document.getElementById('sidebar-panels');
        const icons = document.getElementById('sidebar-icons');
        const main = document.getElementById('main-content'); // Optional if you have main content area to adjust

        if (show) {
            if (sidebar) sidebar.classList.remove('d-none');
            if (icons) icons.classList.remove('d-none');
        } else {
            if (sidebar) sidebar.classList.add('d-none');
        }
    },

    // Switch View
    switchView(viewName) {
        const dash = document.getElementById('dashboard-area');
        const res = document.getElementById('result-dashboard');

        if (viewName === 'result') {
            if (dash) dash.classList.add('d-none');
            if (res) res.classList.remove('d-none');
        } else {
            if (dash) dash.classList.remove('d-none');
            if (res) res.classList.add('d-none');
        }
    },

    // NEW: Render Action Panel
    renderActionPanel(onProduction, onAudit) {
        // 1. Show Result Dashboard
        this.switchView('result');

        // 2. Hide specific parts if needed (e.g. loading states)
        const actionPanel = document.getElementById('action-panel');
        const auditPanel = document.getElementById('audit-panel');
        const specsSection = document.getElementById('specs-section');
        const uploadSection = document.getElementById('upload-section'); // Also hide upload button if visible?

        if (actionPanel) actionPanel.classList.remove('d-none');
        if (auditPanel) auditPanel.classList.add('d-none'); // Ensure hidden initially
        if (specsSection) specsSection.classList.add('d-none'); // Force Hide Spec Selector
        if (uploadSection) uploadSection.classList.add('d-none'); // Hide Upload Area logic if distinct

        // 4. Initialize Service Table immediately (Pending State)
        this.initServiceTable('#service-table-container');

        // 5. Bind Buttons
        const btnProd = document.getElementById('btn-start-production');
        const btnAudit = document.getElementById('btn-start-audit');

        if (btnProd) {
            // Remove old listeners by cloning
            const newBtn = btnProd.cloneNode(true);
            btnProd.parentNode.replaceChild(newBtn, btnProd);
            newBtn.addEventListener('click', () => {
                const check = document.getElementById('disclaimer-check');
                if (check && !check.checked) {
                    alert('請勾選"我已瞭解注意事項"');
                    return;
                }
                if (onProduction) onProduction();
            });
        }

        if (btnAudit) {
            const newBtn = btnAudit.cloneNode(true);
            btnAudit.parentNode.replaceChild(newBtn, btnAudit);
            newBtn.addEventListener('click', () => {
                if (onAudit) onAudit();
            });
        }
    },

    // NEW: Toggle between Service Table and Audit Report
    toggleAuditView(showAudit) {
        const serviceTable = document.getElementById('service-table-container');
        const auditReport = document.getElementById('audit-report-container');

        if (showAudit) {
            if (serviceTable) serviceTable.classList.add('d-none');
            if (auditReport) auditReport.classList.remove('d-none');
        } else {
            if (serviceTable) serviceTable.classList.remove('d-none');
            if (auditReport) auditReport.classList.add('d-none');
        }
    },

    // NEW: Set Audit Button to Urgent (Red)
    setAuditButtonRed() {
        const btn = document.getElementById('btn-start-audit');
        if (btn) {
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-danger', 'text-white', 'shadow-sm'); // Red style
        }
    },

    // Switch to Re-upload Mode
    updateToReuploadMode() {
        const btn = document.getElementById('btn-start-production');
        // Find disclaimer check container (it's the .form-check inside action-panel)
        const check = document.getElementById('disclaimer-check');
        const checkDiv = check ? check.closest('.form-check') : null;

        if (btn) {
            btn.innerHTML = '<i class="bi bi-cloud-upload"></i> 重新上傳照片';
            btn.classList.remove('btn-primary', 'shadow-sm');
            btn.classList.add('btn-outline-primary', 'shadow-none');

            // Rebind
            const newBtn = btn.cloneNode(true);
            newBtn.disabled = false; // Fix: Re-enable button
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                location.reload();
            });
        }
        if (checkDiv) checkDiv.classList.add('d-none');
    },

    // Show Disclaimer Modal
    showDisclaimerModal() {
        const modalEl = document.getElementById('disclaimerModal');
        if (modalEl) {
            // Use bootstrap global if available or try catch
            try {
                let modal = bootstrap.Modal.getInstance(modalEl);
                if (!modal) modal = new bootstrap.Modal(modalEl);
                modal.show();
            } catch (e) {
                console.error("Modal Error", e);
                // Fallback
                modalEl.style.display = 'block';
                modalEl.classList.add('show');
            }
        }
    },


    // Show Check Spec Modal
    showUseConfirm(specData, onConfirm) {
        // specData should be the full object from config
        const specName = specData ? specData.name : "未知規格";
        console.log("UI.showUseConfirm called for:", specName);

        const title = document.getElementById('checkSpecLabel');
        const btn = document.getElementById('btn-confirm-use');
        const dimText = document.getElementById('confirm-spec-dims');

        if (title) title.innerText = `製作規格確認: ${specName}`;

        // Dynamic Dimension Text
        if (dimText && specData) {
            const wCm = specData.width_mm / 10;
            const hCm = specData.height_mm / 10;
            dimText.innerText = `3. 尺寸調整為 ${wCm}cm x ${hCm}cm (300DPI)`;
            // Provide visual cue
            dimText.classList.add('text-primary');
        }

        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                console.log("Confirm button clicked");
                const modalEl = document.getElementById('checkSpecModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                onConfirm();
            });
        }

        const modalEl = document.getElementById('checkSpecModal');
        if (modalEl) {
            console.log("Found modal logic, attempting to show.");
            try {
                // Try to get existing instance or create new
                let modal = bootstrap.Modal.getInstance(modalEl);
                if (!modal) {
                    modal = new bootstrap.Modal(modalEl);
                }
                modal.show();
            } catch (e) {
                console.error("Bootstrap Modal Error:", e);
                // Fallback
                if (confirm(`確認製作 ${specName} 證件照?`)) onConfirm();
            }
        } else {
            console.warn("Modal element not found, falling back to native confirm.");
            if (confirm(`確認製作 ${specName} 證件照?`)) onConfirm();
        }
    },

    // Initialize Styles
    initStyles() {
        if (!document.getElementById('ui-custom-styles')) {
            const style = document.createElement('style');
            style.id = 'ui-custom-styles';
            style.innerHTML = `
                .audit-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
                .audit-row { background: #fff; transition: all 0.3s ease; opacity: 1; transform: translateY(0); box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .audit-row td { padding: 12px; vertical-align: middle; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
                .audit-row td:first-child { border-left: 1px solid #eee; border-radius: 8px 0 0 8px; font-weight: 500; }
                .audit-row td:last-child { border-right: 1px solid #eee; border-radius: 0 8px 8px 0; }
                
                .check-icon { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; font-size: 14px; }
                .check-pass { background: #d1e7dd; color: #0f5132; }
                .check-warn { background: #fff3cd; color: #664d03; }
                .check-fail { background: #f8d7da; color: #842029; }
                
                .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-block; min-width: 60px; text-align: center; }
                .status-pass { background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; }
                .status-warn { background: #fff3e0; color: #ef6c00; border: 1px solid #ffe0b2; }
                .status-fail { background: #ffebee; color: #c62828; border: 1px solid #ffcdd2; }
                
                .preview-overlay { 
                    position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
                    background: rgba(255,255,255,0.7); 
                    backdrop-filter: blur(2px);
                    display: flex; flex-direction: column; align-items: center; justify-content: center; 
                    z-index: 50; 
                    border-radius: 8px;
                }
                .p-bar-track { width: 70%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-top: 10px; }
                .p-bar-fill { height: 100%; background: #0d6efd; width: 0%; transition: width 0.5s ease; }
            `;
            document.head.appendChild(style);
        }
    },

    // Show Loading Spinner
    showLoadingPreview() {
        const container = document.getElementById('preview-container');
        if (container) {
            container.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <div class="spinner-border mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                    <div>正在進行 AI 智能審查...</div>
                </div>
            `;
        }
    },

    // Initialize Service Table (Visible by Default)
    initServiceTable(selector) {
        const container = document.querySelector(selector);
        if (container) {
            container.innerHTML = '';
            container.classList.remove('d-none');

            // Service Items - Start Index 6 (to match legacy IDs or reset to 0?)
            // Let's use specific IDs for services to avoid collision
            const serviceItems = [
                { item: '臉部識別推算' },
                { item: 'AI 智能裁切' },
                { item: '背景去除' },
                { item: '臉部補光' },
                { item: '尺寸格式化' },
                { item: '解析度優化' }
            ];

            const createServiceRows = (items) => {
                return items.map((res, i) => {
                    const idx = i + 100; // Offset to avoid checks
                    return `
                        <tr class="audit-row show" id="audit-row-${idx}">
                            <td class="small fw-bold">${res.item}</td>
                            <td class="text-center">
                                <span class="text-muted small" id="audit-text-${idx}">待處理</span>
                                <div class="spinner-border spinner-border-sm text-primary d-none" id="audit-spinner-${idx}" role="status"></div>
                                <span class="check-icon d-none" id="audit-icon-${idx}"></span>
                            </td>
                            <td class="text-end">
                                <span class="badge bg-light text-secondary border" id="audit-badge-${idx}">待處理</span>
                            </td>
                        </tr>
                    `;
                }).join('');
            };

            container.innerHTML = `
                <div class="mb-2">
                    <h6 class="fw-bold text-success small"><i class="bi bi-stars"></i> 加值服務項目</h6>
                    <table class="audit-table table-sm" style="font-size:0.9rem;">
                        <tbody id="audit-service-body">${createServiceRows(serviceItems)}</tbody>
                    </table>
                </div>
                <div id="service-action-area" class="mt-2 text-center"></div>
            `;
        }
    },

    // Initialize Audit Table (Hidden until clicked)
    initAuditTable(selector) {
        const container = document.querySelector(selector);
        if (container) {
            container.innerHTML = '';
            container.classList.remove('d-none');

            const basicItems = [
                { item: '表情/嘴巴' },
                { item: '比例檢查' },
                { item: '眼鏡檢查' },
                { item: '頭髮/五官' },
                { item: '光線檢查' },
                { item: '影像解析度' }
            ];

            const getStandardText = (item) => {
                if (item.includes('表情')) return '表情自然/不露齒';
                if (item.includes('比例')) return '頭部居中';
                if (item.includes('眼鏡')) return '無反光/不遮擋';
                if (item.includes('頭髮')) return '五官清晰';
                if (item.includes('光線')) return '光線均勻';
                if (item.includes('影像')) return '清晰度標準';
                return '符合規範';
            };

            const createRows = (items) => {
                return items.map((res, i) => {
                    const idx = i; // 0-5
                    return `
                        <tr class="audit-row show" id="audit-row-${idx}">
                            <td>${res.item}</td>
                            <td class="small text-muted">${getStandardText(res.item)}</td>
                            <td class="text-center">
                                <div class="spinner-border spinner-border-sm text-secondary" id="audit-spinner-${idx}" role="status"></div>
                                <span class="check-icon d-none" id="audit-icon-${idx}"></span>
                            </td>
                            <td><span class="badge bg-light text-secondary border" id="audit-badge-${idx}">待檢測</span></td>
                        </tr>
                    `;
                }).join('');
            };

            container.innerHTML = `
                <div class="mb-3">
                    <h6 class="fw-bold text-primary"><i class="bi bi-shield-check"></i> 檢測報告</h6>
                    <table class="audit-table w-100">
                        <thead><tr><th>項目</th><th>標準</th><th>狀態</th><th>結果</th></tr></thead>
                        <tbody id="audit-basic-body">${createRows(basicItems)}</tbody>
                    </table>
                </div>
                <div id="audit-action-area" class="mt-4 text-center"></div>
            `;
        }
    },

    // [NEW] Render Full Compliance Report with Sequential Animation
    renderComplianceReport(results, onClose) {
        const area = document.getElementById('audit-report-container');
        if (!area) return;

        area.innerHTML = '';
        area.classList.remove('d-none');

        // 1. Initial Render: All "Pending" (Spinner or Gray)
        const createPendingRow = (item, idx) => {
            return `
                <div class="d-flex align-items-center p-3 border rounded mb-2 bg-white shadow-sm audit-item" id="audit-row-item-${idx}">
                    <div class="me-3 fs-4" id="audit-icon-wrapper-${idx}">
                         <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-bold text-dark">${item.item}</div>
                        <div class="small text-secondary" id="audit-text-${idx}">檢測中...</div>
                    </div>
                    <div>
                        <span class="badge bg-light text-secondary p-2 px-3 rounded-pill border" id="audit-badge-${idx}">待檢測</span>
                    </div>
                </div>
            `;
        };

        const rows = results.map((r, i) => createPendingRow(r, i)).join('');

        area.innerHTML = `
            <div class="p-2">
                <h5 class="fw-bold mb-3 text-center text-dark"><i class="bi bi-shield-check text-primary"></i> 合規檢測報告</h5>
                <div class="vstack gap-1">
                    ${rows}
                </div>
                
                <div class="mt-4 pt-3 border-top text-center opacity-50" id="audit-footer-area">
                    <p class="small text-muted text-start mb-3 bg-light p-2 rounded">
                        <i class="bi bi-exclamation-circle-fill"></i> <strong>免責聲明：</strong><br>
                        本檢測結果僅供參考，系統依據國際通用證件照規範進行 AI 分析，最終審核結果仍以相關收件單位認定為準。
                    </p>
                    <button id="btn-close-audit" class="btn btn-outline-secondary w-100 py-2" disabled>
                        檢測中...
                    </button>
                </div>
            </div>
        `;

        // 2. Sequential Update
        let i = 0;
        function updateNext() {
            if (i >= results.length) {
                // Done
                const footer = document.getElementById('audit-footer-area');
                if (footer) footer.classList.remove('opacity-50');

                const btn = document.getElementById('btn-close-audit');
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = '關閉報告';
                    btn.onclick = () => { if (onClose) onClose(); };
                }
                return;
            }

            const item = results[i];
            const idx = i;

            // DOM Elements
            const iconWrapper = document.getElementById(`audit-icon-wrapper-${idx}`);
            const textBox = document.getElementById(`audit-text-${idx}`);
            const badge = document.getElementById(`audit-badge-${idx}`);

            // Wait a bit then flip state
            setTimeout(() => {
                let statusIcon = '';
                let statusClass = '';
                let statusText = '';
                let iconClass = '';

                if (item.status === 'pass') {
                    statusIcon = '<i class="bi bi-check-circle-fill"></i>';
                    iconClass = 'text-success';
                    statusClass = 'bg-success bg-opacity-10 text-success border-success';
                    statusText = '合格';
                } else if (item.status === 'warn') {
                    statusIcon = '<i class="bi bi-exclamation-triangle-fill"></i>';
                    iconClass = 'text-warning';
                    statusClass = 'bg-warning bg-opacity-10 text-dark border-warning';
                    statusText = '注意';
                } else if (item.status === 'fail') {
                    statusIcon = '<i class="bi bi-x-circle-fill"></i>';
                    iconClass = 'text-danger';
                    statusClass = 'bg-danger bg-opacity-10 text-danger border-danger';
                    statusText = '不符';
                } else if (item.status === 'manual') {
                    statusIcon = '<i class="bi bi-hand-index-thumb-fill"></i>';
                    iconClass = 'text-primary';
                    statusClass = 'bg-info bg-opacity-10 text-primary border-info';
                    statusText = '人工確認';
                }

                // Update UI
                if (iconWrapper) {
                    iconWrapper.innerHTML = statusIcon;
                    iconWrapper.className = `me-3 fs-4 ${iconClass}`;
                    // Add pop animation
                    iconWrapper.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                }
                if (textBox) {
                    textBox.innerText = item.text || '';
                    if (item.desc) {
                        textBox.insertAdjacentHTML('beforeend', `<div class="small text-muted mt-1"><i class="bi bi-info-circle"></i> ${item.desc}</div>`);
                    }
                }
                if (badge) {
                    badge.className = `badge p-2 px-3 rounded-pill ${statusClass}`;
                    badge.innerText = statusText;
                }

                // Next
                i++;
                updateNext();

            }, 400); // 400ms delay per item
        }

        // Start animation loop
        updateNext();
    },

    // Stage 2: Service Animation (Service Table)
    // Stage 2: Service Animation (Service Table)
    renderServiceAnimation(onComplete, taskPromise) {
        // Correct Indices for 6 services (100 to 105)
        const serviceIndices = [100, 101, 102, 103, 104, 105];
        let i = 0;

        // 1. Setup Preview Overlay
        const previewContainer = document.getElementById('preview-container');
        if (previewContainer) {
            previewContainer.style.position = 'relative';
            const old = document.getElementById('ui-prog-overlay');
            if (old) old.remove();

            const overlay = document.createElement('div');
            overlay.id = 'ui-prog-overlay';
            overlay.className = 'preview-overlay';
            overlay.innerHTML = `
                <div class="spinner-border text-primary" role="status"></div>
                <div class="mt-2 fw-bold text-muted">AI 製作中... <span id="ui-prog-text">0%</span></div>
                <div class="p-bar-track"><div id="ui-prog-fill" class="p-bar-fill"></div></div>
            `;
            previewContainer.appendChild(overlay);
        }

        function updateProgress(pct) {
            const fill = document.getElementById('ui-prog-fill');
            const txt = document.getElementById('ui-prog-text');
            if (fill) fill.style.width = `${pct}%`;
            if (txt) txt.innerText = `${Math.round(pct)}%`;
        }

        function animateNext() {
            // Update Progress
            const pct = (i / serviceIndices.length) * 100;
            updateProgress(pct);

            if (i >= serviceIndices.length) {
                updateProgress(100);
                // Completion Handling
                setTimeout(() => {
                    const old = document.getElementById('ui-prog-overlay');
                    if (old) old.remove();

                    // 直接完成，無需等待用戶確認
                    console.log("✅ 服務動畫完成，直接呼叫 onComplete");
                    if (onComplete) onComplete();
                }, 100);
                return;
            }
            const idx = serviceIndices[i];

            const text = document.getElementById(`audit-text-${idx}`);
            const spinner = document.getElementById(`audit-spinner-${idx}`);
            const badge = document.getElementById(`audit-badge-${idx}`);

            if (text) text.classList.add('d-none');
            if (spinner) spinner.classList.remove('d-none');
            if (badge) {
                badge.innerText = '處理中...';
                badge.className = 'status-badge status-warn';
            }

            // Timing: 1st item (Face Detect) 5s, others 3s
            const baseDelay = (i === 0) ? 5000 : 3000;

            setTimeout(async () => {
                // [SYNC POINT] If Last Step (Resolution Logic 105), Wait for Promise
                if (idx === 105 && taskPromise) {
                    try {
                        console.log("Waiting for API Task to complete...");
                        await taskPromise;
                        console.log("API Task Completed. Finishing Animation.");
                    } catch (e) {
                        console.error("API Task Failed during animation wait", e);
                    }
                }

                if (spinner) spinner.classList.add('d-none');
                const icon = document.getElementById(`audit-icon-${idx}`);
                if (icon) {
                    icon.classList.remove('d-none');
                    icon.className = 'check-icon check-pass';
                    icon.innerText = '✓';
                    icon.style.animation = 'popIn 0.3s';
                }
                if (badge) {
                    badge.innerText = '已完成';
                    badge.className = 'status-badge status-pass';
                }

                i++;
                animateNext();
            }, baseDelay);
        }
        requestAnimationFrame(() => animateNext());
    },

    // Final Stage: Download Options
    showDownloadOptions(singleBlob, specData, custom4x2Handler = null) {
        // [FIX]: Look for Service Area primarily, fallback to audit
        const area = document.getElementById('service-action-area') || document.getElementById('audit-action-area');
        if (!area) return;

        // Clean previous listeners
        const cleanArea = area.cloneNode(false);
        area.parentNode.replaceChild(cleanArea, area);
        const newArea = document.getElementById(cleanArea.id);

        // Define Actions
        const dlSingleAction = async () => {
            const url = (singleBlob instanceof Blob) ? URL.createObjectURL(singleBlob) : singleBlob;
            await UI.handleSingleDownload(url, specData);
        };

        const preview4x2Action = async () => {
            if (custom4x2Handler) {
                await custom4x2Handler();
            } else {
                // Default Fallback
                const url = (singleBlob instanceof Blob) ? URL.createObjectURL(singleBlob) : singleBlob;
                await UI.show4x2Preview(url, specData);
            }
        };

        newArea.innerHTML = `
            <div class="d-flex gap-2 justify-content-center">
                <button class="btn btn-outline-primary flex-fill" id="btn-dl-single">
                    <i class="bi bi-download"></i> 下載單張 (JPG)
                </button>
                <button class="btn btn-success flex-fill" id="btn-dl-4x2">
                    <i class="bi bi-grid-3x3"></i> 下載 4x2 排版
                </button>
            </div>
            <div class="mt-2 text-center text-muted small">
                <i class="bi bi-info-circle"></i> 單張為 JPG 電子檔 / 4x2 為列印排版預覽
            </div>
            <hr class="my-2 opacity-25">
            <button id="btn-start-audit-post" class="btn btn-outline-dark w-100 shadow-sm">
                <i class="bi bi-shield-check"></i> 執行合規審查 (檢測報告)
            </button>
        `;

        const btnSingle = document.getElementById('btn-dl-single');
        const btn4x2 = document.getElementById('btn-dl-4x2');
        const btnAudit = document.getElementById('btn-start-audit-post');

        if (btnSingle) btnSingle.onclick = dlSingleAction;
        if (btn4x2) btn4x2.onclick = preview4x2Action;
        if (btnAudit) btnAudit.onclick = () => {
            // Call Global Audit Function
            if (window.runAuditPhase) window.runAuditPhase();
        };
    },

    // NEW: Handle Single Download Cleanly
    async handleSingleDownload(url, specData) {
        const widthMm = specData ? specData.width_mm : 35;
        const heightMm = specData ? specData.height_mm : 45;
        const filename = specData ? `idphoto_${specData.width_mm}x${specData.height_mm}mm.jpg` : 'idphoto_single.jpg';

        try {
            // Spec Check Logic
            const specWPx = Math.round(widthMm / 25.4 * 300);
            const specHPx = Math.round(heightMm / 25.4 * 300);

            const img = new Image();
            img.src = url;
            await new Promise(r => img.onload = r);

            const imgRatio = img.width / img.height;
            const specRatio = specWPx / specHPx;

            let finalW, finalH;
            if (Math.abs(imgRatio - specRatio) > 0.05) {
                console.log("Ruled/Custom Proof detected. Using Original.");
                finalW = img.width; finalH = img.height;
            } else {
                console.log("Standard Spec Detected. Resizing.");
                finalW = specWPx; finalH = specHPx;
            }

            const resizedUrl = await UI.resizeToSpec(url, finalW, finalH);
            const a = document.createElement('a');
            a.href = resizedUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) { console.error(e); }
    },

    // NEW: Show 4x2 Preview & Actions
    async show4x2Preview(imgUrl, specData) {
        const container = document.getElementById('preview-container');
        if (!container) return;

        // 1. Generate 4x2 Canvas
        try {
            // Show Loading
            container.innerHTML = `<div class="d-flex justify-content-center align-items-center h-100"><div class="spinner-border"></div></div>`;

            const dataUrl = await UI.create4x2Canvas(imgUrl, specData);
            // const dataUrl = canvas.toDataURL('image/jpeg', 0.95); // Fixed: create4x2Canvas returns string

            // 2. Render Preview
            container.innerHTML = '';
            const previewImg = new Image();
            previewImg.src = dataUrl;
            previewImg.className = 'img-fluid shadow-sm border';
            container.appendChild(previewImg);

            // 3. Update Action Area
            const area = document.getElementById('service-action-area') || document.getElementById('audit-action-area');
            if (area) {
                area.innerHTML = `
                    <div class="row g-2">
                         <div class="col-4">
                            <button class="btn btn-secondary w-100 disabled" title="功能保留">
                                <i class="bi bi-envelope"></i> 寄到信箱
                            </button>
                         </div>
                         <div class="col-4">
                            <button class="btn btn-primary w-100" id="btn-dl-4x2-direct">
                                <i class="bi bi-download"></i> 直接下載
                            </button>
                         </div>
                         <div class="col-4">
                             <button class="btn btn-info text-white w-100 disabled" title="功能保留">
                                <i class="bi bi-cloud-upload"></i> 存至雲端
                            </button>
                         </div>
                    </div>
                     <div class="mt-2 text-center text-muted small">
                        <button class="btn btn-link btn-sm" id="btn-back-single">
                            <i class="bi bi-arrow-left"></i> 返回單張預覽
                        </button>
                    </div>
                `;

                // Bind Direct Download
                document.getElementById('btn-dl-4x2-direct').onclick = async () => {
                    // PDF Logic
                    try {
                        await UI.generate4x2PDF(imgUrl, specData);
                    } catch (e) { alert("下載失敗"); }
                };

                // Bind Back
                document.getElementById('btn-back-single').onclick = () => {
                    // Restore Single View via Quick Restore (No Spinner)
                    if (window.restorePreview) {
                        console.log("[Debug] Back to Single: Using restorePreview.");
                        window.restorePreview();
                    } else if (window.runProductionPhase) {
                        console.log("[Debug] Back to Single: Triggering runProductionPhase to restore controls.");
                        window.runProductionPhase();
                    } else {
                        // Fallback (Controls might be missing, but image shows)
                        container.innerHTML = '';
                        const orig = new Image();
                        orig.src = imgUrl;
                        orig.className = 'img-fluid shadow-sm border';
                        orig.style.maxHeight = '100%';
                        orig.style.maxWidth = '100%';
                        const wrapper = document.createElement('div');
                        wrapper.id = 'image-wrapper';
                        wrapper.className = 'position-relative d-inline-flex justify-content-center align-items-center';
                        wrapper.style.maxHeight = '80%';
                        wrapper.style.maxWidth = '100%';
                        wrapper.appendChild(orig);
                        container.appendChild(wrapper);
                        UI.showDownloadOptions(imgUrl, specData);
                    }
                };
            }

        } catch (e) {
            console.error("4x2 Gen Failed", e);
            alert("預覽生成失敗");
        }
    },

    // Helper: Resize for Single Download (Generic 300 DPI)
    resizeToSpec(imgSrc, widthPx, heightPx) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = widthPx;
                canvas.height = heightPx;
                const ctx = canvas.getContext('2d');
                // Draw scaled
                ctx.drawImage(img, 0, 0, widthPx, heightPx);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.onerror = reject;
            img.src = imgSrc;
        });
    },

    // Helper: Create 4x2 Layout (4x6 inch @ 300dpi) - STRICT DIMENSIONS
    create4x2Canvas(imgSrc, specData) {
        return new Promise((resolve, reject) => {
            if (!imgSrc) return reject("No Image Source");
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // 4x6 inch @ 300 DPI = 1200x1800 px (Portrait) or 1800x1200 (Landscape)
                // Standard 4R is usually 4x6 inches.
                // Let's assume Landscape 1800x1200 for fitting rows.
                canvas.width = 1800;
                canvas.height = 1200;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 1800, 1200);

                // STRICT Dimensions in pixels
                // Default to Passport (35x45mm) if missing
                const mmW = specData ? specData.width_mm : 35;
                const mmH = specData ? specData.height_mm : 45;

                const photoW = Math.round(mmW / 25.4 * 300);
                const photoH = Math.round(mmH / 25.4 * 300);

                // Calculate Layout
                const gapX = 30; // ~2.5mm
                const gapY = 30; // ~2.5mm

                // How many cols fit in 1800?
                const cols = Math.floor((1800 - gapX) / (photoW + gapX));
                // How many rows fit in 1200?
                const rows = Math.floor((1200 - gapY) / (photoH + gapY));

                console.log(`Layout Config: ${mmW}x${mmH} mm -> ${photoW}x${photoH} px | Fits ${cols}x${rows} `);

                // Center Grid
                const totalGridW = cols * photoW + (cols - 1) * gapX;
                const totalGridH = rows * photoH + (rows - 1) * gapY;
                const startX = (1800 - totalGridW) / 2;
                const startY = (1200 - totalGridH) / 2;

                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const x = startX + c * (photoW + gapX);
                        const y = startY + r * (photoH + gapY);
                        ctx.drawImage(img, x, y, photoW, photoH);
                        ctx.strokeStyle = '#dddddd'; // Faint line for cutting
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x, y, photoW, photoH);
                    }
                }
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.onerror = reject;
            img.src = imgSrc;
        });
    },

    // Helper: Generate PDF for 4x2 (Strict Physical Size)
    // Uses jsPDF to enforce mm dimensions
    generate4x2PDF(imgSrc, specData) {
        return new Promise((resolve, reject) => {
            if (!window.jspdf) {
                alert("PDF Library not loaded");
                return reject("jsPDF not found");
            }
            const { jsPDF } = window.jspdf;

            // Default to 4x6 inch paper (101.6 x 152.4 mm)
            // Note: Valid 4R is exactly 4x6 inches.
            // Orientation: Landscape (152.4 mm wide, 101.6 mm high)
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [101.6, 152.4] // h, w
            });

            // Spec Sizes
            const mmW = specData ? specData.width_mm : 35;
            const mmH = specData ? specData.height_mm : 45;

            // Calculate Fit
            // Paper: 152.4 x 101.6
            // Margin/Gap
            const gap = 2.5; // 2.5mm gap

            // Cols
            const cols = Math.floor((152.4 - gap) / (mmW + gap));
            const rows = Math.floor((101.6 - gap) / (mmH + gap));

            console.log(`PDF Layout: ${cols}x${rows} `);

            // Center
            const totalW = cols * mmW + (cols - 1) * gap;
            const totalH = rows * mmH + (rows - 1) * gap;
            const startX = (152.4 - totalW) / 2;
            const startY = (101.6 - totalH) / 2;

            const img = new Image();
            img.src = imgSrc;
            img.onload = () => {
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const x = startX + c * (mmW + gap);
                        const y = startY + r * (mmH + gap);

                        // Add Image (x, y, w, h) in MM
                        doc.addImage(img, 'JPEG', x, y, mmW, mmH);

                        // Optional: Draw cutting lines (light gray)
                        doc.setDrawColor(220, 220, 220);
                        doc.rect(x, y, mmW, mmH);
                    }
                }
                doc.save('idphoto_print_4x6_inch.pdf');
                resolve();
            };
            img.onerror = reject;
        });
    },

    // Show Final Result (Updates)
    showAuditSuccess(imgSrc, faceData, onContinue) {
        const container = document.getElementById('preview-container');
        if (!container) return;

        container.innerHTML = '';

        // Container Style for centering
        container.classList.add('d-flex', 'align-items-center', 'justify-content-center', 'bg-light');
        container.style.height = '100%';

        // Clean Image (No Overlay)
        const img = document.createElement('img');
        img.src = imgSrc;
        img.className = 'shadow-sm rounded border';

        // Proportional Scaling (Fit in container)
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';

        container.appendChild(img);

        // Action Bar Cleanup
        const actionBar = document.getElementById('action-bar');
        if (actionBar) actionBar.innerHTML = '';
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

        let imgEl;
        if (typeof origImg === 'string') {
            imgEl = new Image();
            imgEl.src = origImg;
        } else {
            imgEl = origImg; // Assume it's an element
        }

        imgEl.className = 'shadow-sm rounded';
        imgEl.style.maxHeight = '300px';
        imgEl.style.maxWidth = '100%';
        imgEl.style.objectFit = 'contain';
        leftCol.appendChild(imgEl);
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
                            < button id = "manual-adjust-btn" class="btn btn-secondary btn-sm shadow-sm" >
                                <i class="bi bi-tools"></i> 🛠 手動調整 / 重新裁切
            </button >
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
        // GUIDES REMOVED BY USER REQUEST
        // Ensuring no residual elements interfere
        wrapperElement.style.position = 'relative';
    }
};
