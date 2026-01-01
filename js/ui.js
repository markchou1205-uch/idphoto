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
    showUseConfirm(specName, onConfirm) {
        console.log("UI.showUseConfirm called for:", specName);
        const title = document.getElementById('checkSpecLabel');
        const btn = document.getElementById('btn-confirm-use');

        if (title) title.innerText = `製作規格确认: ${specName}`;
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

    // Stage 1: Render Basic Audit (Top Table)
    renderBasicAudit(results, onPass) {
        let index = 0;
        const total = 6; // 6 Basic Items

        function updateRow(idx, status) {
            const spinner = document.getElementById(`audit-spinner-${idx}`);
            const icon = document.getElementById(`audit-icon-${idx}`);
            const badge = document.getElementById(`audit-badge-${idx}`);

            if (spinner) spinner.classList.add('d-none');

            if (icon) {
                icon.classList.remove('d-none');
                const isPass = status === 'pass';
                icon.className = 'check-icon ' + (isPass ? 'check-pass' : (status === 'fail' ? 'check-fail' : 'check-warn'));
                icon.innerText = isPass ? '✓' : (status === 'fail' ? '✕' : '!');
                icon.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            }
            if (badge) {
                const isPass = status === 'pass';
                badge.className = 'status-badge ' + (isPass ? 'status-pass' : (status === 'fail' ? 'status-fail' : 'status-warn'));
                badge.innerText = isPass ? '合格' : (status === 'fail' ? '不符' : '注意');
            }
        }

        const area = document.getElementById('audit-action-area');

        function renderNext() {
            if (index >= total) {
                // Check failures for the first 6 items
                const failures = results.slice(0, 6).filter(r => r.status === 'fail');
                if (failures.length === 0) {
                    onPass();
                } else {
                    if (area) area.innerHTML = `<div class="alert alert-danger shadow-sm">基本審查未通過，請重新上傳照片。</div>`;
                }
                return;
            }
            if (results[index]) updateRow(index, results[index].status);
            index++;
            setTimeout(renderNext, 600);
        }

        if (!document.getElementById('anim-styles')) {
            const style = document.createElement('style');
            style.id = 'anim-styles';
            style.innerHTML = `@keyframes popIn { 0% { transform: scale(0); } 80% { transform: scale(1.2); } 100% { transform: scale(1); } }`;
            document.head.appendChild(style);
        }

        renderNext();
    },

    // Stage 1.5: Show Success Message + Generate Button
    showBasicPassState(onGenerate) {
        const area = document.getElementById('audit-action-area');
        if (area) {
            area.innerHTML = `
                <div class="alert alert-success bg-opacity-10 border-success mb-3 shadow-sm d-flex justify-content-between align-items-center">
                    <div>
                        <i class="bi bi-check-circle-fill text-success me-2"></i> 
                        <span class="fw-bold text-success">基本審查通過</span>
                        <div class="small text-muted ms-4">待進一步處理後即可生成合格證件照片</div>
                    </div>
                    <button class="btn btn-primary shadow ms-3" id="btn-generate-photo" style="min-width: 160px;">
                        立即生成證件照 <i class="bi bi-arrow-right-short"></i>
                    </button>
                </div>
            `;
            document.getElementById('btn-generate-photo').onclick = () => {
                area.innerHTML = '';
                onGenerate();
            };
        }
    },

    // Stage 2: Service Animation (Service Table)
    renderServiceAnimation(onComplete) {
        // Correct Indices for 5 services using 100+ offset
        const serviceIndices = [100, 101, 102, 103, 104];
        let i = 0;

        function animateNext() {
            if (i >= serviceIndices.length) {
                if (onComplete) onComplete();
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

            setTimeout(() => {
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
            }, 800);
        }
        animateNext();
    },

    // Final Stage: Download Options
    showDownloadOptions(singleBlob, specData) {
        // [FIX]: Look for Service Area primarily, fallback to audit
        const area = document.getElementById('service-action-area') || document.getElementById('audit-action-area');
        if (!area) return;

        const make4x2PDF = async () => {
            try {
                const singleUrl = (singleBlob instanceof Blob) ? URL.createObjectURL(singleBlob) : singleBlob;
                await UI.generate4x2PDF(singleUrl, specData); // Use PDF Generator
                if (singleBlob instanceof Blob) URL.revokeObjectURL(singleUrl);
            } catch (e) {
                console.error(e);
                alert('PDF 生成失敗');
            }
        };

        const dlSingle = async () => {
            // Use spec data if available, otherwise default to Passport (35x45mm)
            const widthMm = specData ? specData.width_mm : 35;
            const heightMm = specData ? specData.height_mm : 45;
            const filename = specData ? `idphoto_${specData.width_mm}x${specData.height_mm}mm.jpg` : 'idphoto_single.jpg';

            const url = (singleBlob instanceof Blob) ? URL.createObjectURL(singleBlob) : singleBlob;
            try {
                // Determine pixel size at 300 DPI
                // 1 inch = 25.4 mm, 300 px/inch
                // pixels = mm / 25.4 * 300
                const wPx = Math.round(widthMm / 25.4 * 300);
                const hPx = Math.round(heightMm / 25.4 * 300);

                console.log(`Downloading Single: ${widthMm}x${heightMm}mm => ${wPx}x${hPx}px`);

                const resizedUrl = await UI.resizeToSpec(url, wPx, hPx);
                const a = document.createElement('a');
                a.href = resizedUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                if (singleBlob instanceof Blob) URL.revokeObjectURL(url);
            } catch (e) {
                console.error(e);
                // Fallback
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        };

        // Use d-flex for Side-by-Side buttons
        area.innerHTML = `
            <div class="d-flex gap-2 justify-content-center">
                <button class="btn btn-outline-primary flex-fill" id="btn-dl-single">
                    <i class="bi bi-download"></i> 下載單張 (JPG)
                </button>
                <button class="btn btn-success flex-fill" id="btn-dl-4x2">
                    <i class="bi bi-printer"></i> 下載 4x2 排版 (PDF)
                </button>
            </div>
            <div class="mt-2 text-center text-muted small">
                <i class="bi bi-info-circle"></i> 單張為 JPG 電子檔 / 4x2 為 PDF 列印檔 (固定尺寸)
            </div>
        `;

        document.getElementById('btn-dl-single').onclick = dlSingle;
        document.getElementById('btn-dl-4x2').onclick = make4x2PDF;
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

                console.log(`Layout Config: ${mmW}x${mmH}mm -> ${photoW}x${photoH}px | Fits ${cols}x${rows}`);

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

            console.log(`PDF Layout: ${cols}x${rows}`);

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
        // Ensure relative context
        wrapperElement.style.position = 'relative';

        const createLine = (topPercent, color, text) => {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.top = `${topPercent}%`;
            line.style.left = '0';
            line.style.right = '0';
            line.style.width = '100%';
            line.style.borderTop = `2px dashed ${color}`;
            line.style.zIndex = '10';
            line.style.pointerEvents = 'none';

            if (text) {
                const label = document.createElement('span');
                label.innerText = text;
                label.style.position = 'absolute';
                label.style.right = '5px';
                label.style.top = '-22px'; // Above the line
                label.style.color = color;
                label.style.fontSize = '12px';
                label.style.fontWeight = 'bold';
                label.style.background = 'rgba(255,255,255,0.8)';
                label.style.padding = '1px 4px';
                label.style.borderRadius = '3px';
                line.appendChild(label);
            }
            wrapperElement.appendChild(line);
        };

        // Hair Top Line (10% = 4.5mm)
        createLine(10, 'red', '頭髮頂端');

        // Chin Bottom (90% = 40.5mm, implying 3.6cm head height)
        createLine(90, 'red', '下巴 (3.6cm)');

    }
};
