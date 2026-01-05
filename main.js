import * as API from './js/api.js';
import { UI } from './js/ui.js';
import { DEFAULT_SPECS } from './js/config.js'; // Restore Spec Import

// --- State ---
let state = {
    originalImage: null,
    processedImage: null,
    faceData: null,
    auditResults: null, // Store validation results
    spec: 'passport',
    adjustments: { brightness: 1, contrast: 1 } // User lighting adjustments
};

// Optimization: Pre-load AI Model to save time later
function preloadLocalAI() {
    console.log("Pre-loading Local AI Model...");
    // Silent import to trigger download/cache
    import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm')
        .then(() => console.log("AI Model Pre-loaded"))
        .catch(err => console.warn("AI Pre-load failed:", err));
}

// [Optimization] Helper: Client-Side Compression
async function compressImage(base64, targetBytes = 1024 * 1024, maxWidth = 1500) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            let scale = 1;

            // 1. Resize first if too large
            if (w > maxWidth || h > maxWidth) {
                scale = Math.min(maxWidth / w, maxWidth / h);
                w = Math.floor(w * scale);
                h = Math.floor(h * scale);
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            // 2. Iterative Compression
            let quality = 0.9;
            const tryCompress = () => {
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                // Base64 length ~= size * 1.33
                // dataUrl length > targetBytes * 1.37 (approx safety)
                if (dataUrl.length > targetBytes * 1.37 && quality > 0.5) {
                    quality -= 0.1;
                    tryCompress();
                } else {
                    resolve(dataUrl);
                }
            };
            tryCompress();
        };
        img.onerror = () => resolve(base64); // Fallback
    });
}

// --- DOM Elements ---
const uploadInput = document.getElementById('fileInput');
const specsContainer = document.getElementById('specs-container');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    UI.initStyles();
    initSpecs(); // Restore UI Render

    // Legacy support: HTML calls handleFileUpload(this) via onchange.
    // We do NOT need to addEventListener here, or it will fire twice.
});

// Restore Spec UI Logic
function initSpecs() {
    if (!specsContainer) return;
    specsContainer.innerHTML = '';

    Object.keys(DEFAULT_SPECS).forEach(key => {
        const s = DEFAULT_SPECS[key];
        const div = document.createElement('div');
        div.className = `p-2 border rounded cursor-pointer spec-item ${state.spec === key ? 'bg-primary text-white' : 'bg-light'}`;
        div.style.cursor = 'pointer';
        div.innerHTML = `<div class="fw-bold">${s.name}</div><div class="small opacity-75">${s.desc}</div>`;
        div.onclick = () => {
            if (state.spec === key) return; // No change

            console.log(`Switching Spec: ${state.spec} -> ${key}`);
            state.spec = key;
            updateSpecUI();

            // [NEW FEATURE] Live Switch: If image exists, re-run production
            if (state.originalImage) {
                console.log("Image exists, re-running production with new spec...");

                // Show standard loading if needed or just run
                // Assuming runProductionPhase handles UI reset/loading
                runProductionPhase();
            }
        };
        specsContainer.appendChild(div);
    });
}

function updateSpecUI() {
    Array.from(specsContainer.children).forEach((el, idx) => {
        const key = Object.keys(DEFAULT_SPECS)[idx];
        if (key === state.spec) {
            el.className = 'p-2 border rounded cursor-pointer spec-item bg-primary text-white';
        } else {
            el.className = 'p-2 border rounded cursor-pointer spec-item bg-light text-dark';
        }
    });
}

// Expose for HTML inline calls (Legacy support)
// Export for HTML access
window.handleFileUpload = handleFileUpload;

// Expose AI Loading Updater for api.js
window.updateAILoading = (text) => {
    const reportLoadingText = document.querySelector('#report-loading p');
    if (reportLoadingText) {
        reportLoadingText.innerText = text;
    }
};

// --- Handlers ---
async function handleFileUpload(e) {
    console.log("Upload Handler Triggered", e);

    let input = null;
    if (e instanceof HTMLInputElement) {
        input = e;
    } else if (e && e.target) {
        input = e.target;
    } else {
        input = document.getElementById('fileInput');
    }

    let file = input && input.files ? input.files[0] : null; // Changed const to let for reassignment
    console.log("File detected:", file);

    if (!file) return;

    // HEIC Conversion Support
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic';
    if (isHeic) {
        console.log("HEIC file detected. Starting conversion...");
        // Show loading state if possible or just log
        if (window.updateAILoading) window.updateAILoading("正在轉換 HEIC 照片...");

        try {
            if (!window.heic2any) {
                throw new Error("heic2any library not loaded");
            }

            const convertedBlob = await heic2any({
                blob: file,
                toType: "image/jpeg",
                quality: 0.9
            });

            console.log("HEIC conversion successful.");
            // heic2any can return a Blob or an array of Blobs. We take the first one if array.
            const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

            // Create a new file object or just use the blob for FileReader
            // We'll treat it as the "file" for the rest of the flow
            file = finalBlob;

        } catch (err) {
            console.error("HEIC Conversion Failed:", err);
            alert("HEIC 照片轉換失敗，請改用 JPG/PNG 或稍後再試。");
            return;
        }
    }

    // Optimization: Trigger AI Pre-load immediately
    if (typeof preloadLocalAI === 'function') {
        preloadLocalAI();
    }

    // Perf: Warmup Backend Immediately (Eliminate Serial Logic)
    // Don't wait for FileReader. Fire and forget.
    API.warmupBackend();

    const reader = new FileReader();
    reader.onload = async (event) => {
        console.log("File Reader Loaded");
        try {
            let rawResult = event.target.result;

            // --- ULTIMATE STRUCTURAL SANITIZER ---
            if (rawResult.includes(',')) {
                const parts = rawResult.split(',');
                const cleanData = parts.pop();
                state.originalImage = `data:image/jpeg;base64,${cleanData}`;
            } else {
                state.originalImage = rawResult;
            }

            console.log("State Updated (Split Sanitization). Length:", state.originalImage.length);

            // 🆕 Check image dimensions
            const img = new Image();
            img.src = state.originalImage;
            await new Promise(r => img.onload = r);

            const minDimension = 600;
            if (img.width < minDimension || img.height < minDimension) {
                console.warn(`⚠️ Image size warning: ${img.width}x${img.height}px`);
                const userConfirm = confirm(
                    `⚠️ 圖片尺寸偏小 (${img.width}×${img.height}px)\n\n` +
                    `建議使用至少 600×800px 的照片以確保品質。\n\n` +
                    `是否繼續使用此照片？`
                );
                if (!userConfirm) {
                    console.log("User cancelled due to small image size");
                    return;
                }
            }

            UI.showUseConfirm(DEFAULT_SPECS[state.spec], async () => {
                console.log("Modal Confirmed, Showing Action Panel");

                // 🆕 [FIX] Immediately run face detection after user confirms
                // This prevents duplicate detection in runProductionPhase
                if (!state.faceData) {
                    console.log("⚡ [預處理] 立即執行人臉偵測...");
                    console.time("⏱️ [預處理人臉偵測]");
                    const detectRes = await API.detectFace(state.originalImage);
                    console.timeEnd("⏱️ [預處理人臉偵測]");

                    if (!detectRes || !detectRes.found) {
                        alert('❌ 未偵測到人臉，請更換照片或調整角度');
                        location.reload();
                        return;
                    }
                    state.faceData = detectRes;
                    console.log("✅ [預處理] 人臉偵測完成，已儲存至 state");
                }

                // [NEW FLOW]: UX Improvements
                UI.toggleSidebar(false);
                UI.renderActionPanel(runProductionPhase, runAuditPhase);

                // [NEW] Advanced Adjustment UI (Overlay on Preview)
                // MOVED: Logic moved to injectAdvancedControls() to show ONLY after production.
                const existingOverlay = document.getElementById('control-overlay');
                if (existingOverlay) existingOverlay.remove();


                // 3. Show Original Image Preview
                const previewImg = document.getElementById('main-preview-img');
                if (previewImg) {
                    previewImg.src = state.originalImage;
                    previewImg.classList.remove('d-none');
                }

                // Hide Compare View if open
                const compareView = document.getElementById('compare-view');
                if (compareView) compareView.classList.add('d-none');

                // Ensure Result Dashboard is visible (swapped by renderActionPanel but double check)
                UI.switchView('result');
            });

        } catch (err) {
            console.error("Error inside reader.onload:", err);
        }
    };
    reader.onerror = (err) => console.error("File Reader Error:", err);
    reader.readAsDataURL(file);
}

// Phase 1: Compliance Audit (Post-Production Check)
async function runAuditPhase() {
    try {
        console.log("Starting Compliance Audit Phase (Local Check)...");

        // [Refactor] Use persisted state only. No API calls.
        if (!state.faceData || !state.faceData.faceAttributes) {
            console.warn("Missing face attributes, perhaps API v1? Re-running detection not allowed.");
            alert("缺少合規審查數據，請重新製作");
            return;
        }

        // Init UI
        UI.initAuditTable('#audit-report-container');
        UI.toggleAuditView(true);

        const attributes = state.faceData.faceAttributes;
        const landmarks = state.faceData.faceLandmarks;

        // --- 1. Resolution Check (Original Image) ---
        let resolutionPass = false;
        let resolutionVal = "未知";
        if (state.originalImage) {
            const img = new Image();
            img.src = state.originalImage;
            await new Promise(r => img.onload = r);
            const pixels = img.width * img.height;
            resolutionVal = `${(pixels / 1000000).toFixed(1)}MP`;
            // Standard: > 3.0 MP (e.g. 2000x1500)
            resolutionPass = pixels >= 3000000;
            console.log(`Resolution Check: ${img.width}x${img.height} = ${pixels} (${resolutionPass ? 'Pass' : 'Fail'})`);
        }

        // --- 2. Mouth Check (Landmarks) ---
        // Formula: UpperLipBottom vs UnderLipTop
        let mouthPass = true;
        if (landmarks && landmarks.upperLipBottom && landmarks.underLipTop) {
            // Distance between lips should be small.
            // Using logic: if UnderLipTop.y - UpperLipBottom.y > Threshold
            const mouthGap = landmarks.underLipTop.y - landmarks.upperLipBottom.y;
            // Threshold relative to face size? 
            // FaceRect Height ~ 1500px scale. Let's say gap > 5px is open?
            // Dynamic: Gap > (Chin - Eyebrow) * 0.02
            const faceH = state.faceData.markers.chinY - ((landmarks.eyebrowLeftOuter.y + landmarks.eyebrowRightOuter.y) / 2);
            const threshold = faceH * 0.03;
            if (mouthGap > threshold) mouthPass = false;
            console.log(`Mouth Check: Gap=${mouthGap.toFixed(1)}, Thres=${threshold.toFixed(1)} -> ${mouthPass}`);
        }
        // Force check attribute if available (Smile deprecated in Azure v1.0, relying on landmarks)
        // if (attributes.smile > 0.5) mouthPass = false;


        // --- 3. Glasses/Occlusion (Attributes) ---
        const glassesPass = (attributes.glasses === 'NoGlasses' || attributes.glasses === 'ReadingGlasses');
        const occlusionPass = !(attributes.occlusion && (attributes.occlusion.foreheadOccluded || attributes.occlusion.eyeOccluded));

        // --- 4. Prepare Results ---
        // [
        //     { item: '相片尺寸', status: 'pass', val: '3.5x4.5cm' }, // Auto
        //     { item: '頭部比例', status: 'pass', val: '75%' },      // Auto
        //     { item: '眉眼遮擋', status: occlusionPass ? 'pass' : 'fail' },
        //     { item: '解析度',   status: resolutionPass ? 'pass' : 'warn', val: resolutionVal }, // Warn for resolution, fail is harsh
        //     { item: '眼鏡/反光', status: glassesPass ? 'pass' : 'warn' },
        //     { item: '表情/嘴巴', status: mouthPass ? 'pass' : 'warn' },
        //     { item: '雙耳可見', status: 'manual' } // Special Manual Item
        // ]

        const results = [
            { item: '相片尺寸', status: 'pass', text: '3.5x4.5cm' },
            { item: '頭部比例', status: 'pass', text: '符合規範' },
            { item: '背景去背', status: 'pass', text: '純白背景' },
            { item: '影像解析度', status: resolutionPass ? 'pass' : 'warn', text: resolutionVal, desc: '建議 > 300萬畫素' },
            { item: '眉眼遮擋', status: occlusionPass ? 'pass' : 'fail', text: occlusionPass ? '無遮擋' : '偵測到遮擋' },
            { item: '眼鏡檢查', status: glassesPass ? 'pass' : 'warn', text: attributes.glasses },
            { item: '表情自然', status: mouthPass ? 'pass' : 'warn', text: mouthPass ? '合規' : '疑似露齒/張嘴' },
            { item: '雙耳可見', status: 'manual', text: '請人工確認' }
        ];

        state.auditResults = results;

        // Render Report
        console.log("Rendering Compliance Report:", results);

        // Pass a wrapper to UI to render these custom results
        UI.renderComplianceReport(results, () => {
            // On "Back" or "Close"
            UI.toggleAuditView(false);
        });

    } catch (err) {
        console.error("Audit Logic Failed:", err);
        alert("審查功能異常");
    }
}

import { ManualEditor } from './js/editor.js';

// ... (existing helper)
function triggerManualEdit() {
    new ManualEditor(
        state.originalImage,
        (newBase64) => {
            state.processedImage = 'data:image/jpeg;base64,' + newBase64;
            // Re-render result
            renderResult(state.processedImage);
        },
        () => { console.log("Manual Edit Cancelled"); },
        state.faceData ? state.faceData.suggestedCrop : null
    );
}

function renderResult(imgSrc, bgRemoved = false) {
    // Ensure View Switch
    const dashboard = document.getElementById('dashboard-area');
    const resultDash = document.getElementById('result-dashboard');
    if (dashboard) dashboard.classList.add('d-none');
    if (resultDash) resultDash.classList.remove('d-none');

    const finalImg = new Image();
    finalImg.onload = () => {
        // Use updated UI.showComparison which returns handles
        const uiRefs = UI.showComparison(state.originalImage, finalImg, bgRemoved);

        // Apply Guides
        UI.applyResultGuides(uiRefs.wrapper);

        // Bind Manual Button
        if (uiRefs.manualBtn) {
            uiRefs.manualBtn.onclick = triggerManualEdit;
        }
    };
    finalImg.src = imgSrc;
}


// Phase 2: Production (Processing)
// Phase 2: Production (Processing)
// Phase 2: Production (Service + Final)
async function runProductionPhase() {
    // ⏱️ START: Total Production Time
    console.time("⏱️ [總製作時間]");
    console.log("\n========== 開始製作證件照 ==========");

    // UX: Disable Button
    const btn = document.getElementById('btn-start-production');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '製作中... (Processing)';
    }

    // [New] Ensure Audit View is Hidden (Show Service Table)
    UI.toggleAuditView(false);

    try {
        // ✅ [FIX] Face detection now happens in handleFileUpload
        // No need to check or re-run detection here
        if (!state.faceData) {
            console.error("❌ Face data missing! This should not happen.");
            alert('系統錯誤：缺少人臉資料，請重新上傳');
            location.reload();
            return;
        }

        console.log("✅ 使用已快取的人臉資料，跳過重複偵測");

        // 2. Start Animation FIRST (Immediate Feedback)
        // This shows the overlay and progress indicators immediately
        console.time("⏱️ [UI動畫初始化]");
        UI.renderServiceAnimation(async () => {
            try {
                // [Optimization] 1. Client-Side Downsampling (<1.0MB)
                console.time("⏱️ [前端壓縮]");
                const compressedB64 = await compressImage(state.originalImage, 1024 * 1024, 1500); // 1MB limit, 1500px max
                console.timeEnd("⏱️ [前端壓縮]");
                console.log(`   ↳ 壓縮結果: ${state.originalImage.length} -> ${compressedB64.length}`);

                // 3. Start API Task (Parallel Execution)
                console.time("⏱️ [並行API處理 (Azure + Vercel)]");
                const processRes = await API.executeParallelProduction(
                    compressedB64,       // Send compressed image
                    state.originalImage, // Keep original for high-res crop if needed (though API uses input for both now)
                    state.spec,
                    state.adjustments
                );
                console.timeEnd("⏱️ [並行API處理 (Azure + Vercel)]");

                console.log("   ↳ API 處理完成，開始更新 UI");

                if (processRes && processRes.photos && processRes.photos.length > 0) {
                    // Cache Assets for Client-Side Re-composition
                    if (processRes.assets) {
                        state.assets = processRes.assets;
                    }

                    // [Fix 1] Sync Face Data (Critical for Recompose)
                    syncProductionState(processRes);

                    // [Fix 2] Reset View Mode
                    state.viewMode = 'fit';

                    // Ensure proper Base64 prefix
                    let b64 = processRes.photos[0];
                    if (!b64.startsWith('data:image/')) {
                        b64 = `data:image/jpeg;base64,${b64}`;
                    }
                    state.processedImage = b64;

                    // Update UI
                    console.time("⏱️ [UI更新與控制項注入]");
                    await updateResultUI(b64);
                    console.timeEnd("⏱️ [UI更新與控制項注入]");

                    // ⏱️ END: Total Production Time
                    console.timeEnd("⏱️ [總製作時間]");
                    console.log("========== 製作完成 ==========\n");
                } else {
                    console.error("No photos returned from API");
                    alert("生成失敗：無回傳影像");
                }
            } catch (e) {
                console.error("Async Production Error:", e);
                alert("製作失敗，請稍後再試");
            }
        });

    } catch (err) {
        console.error("Production Failed:", err);
        alert("製作失敗，請重試");
    }
}

// [NEW] Helper: Inject Advanced Controls into Preview Overlay
function injectAdvancedControls() {
    console.log("[Debug] injectAdvancedControls: Starting...");
    const imageWrapper = document.getElementById('image-wrapper');
    // Remove existing if any to avoid duplicates
    const existingOverlay = document.getElementById('control-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    if (!imageWrapper) {
        console.error("[Debug] injectAdvancedControls: image-wrapper NOT FOUND!");
        return;
    }

    // Default to 'fit' if undefined
    if (!state.viewMode) state.viewMode = 'fit';
    const isFitMode = state.viewMode === 'fit';
    const isGuidesOn = state.adjustments.showGuides === undefined ? true : state.adjustments.showGuides;

    const overlay = document.createElement('div');
    overlay.id = 'control-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '100';

    // Logic: 
    // If Print Mode -> Hide Guides Button, Hide Sliders. Show "Switch to Preview"
    // If Fit Mode -> Show Guides Button. Sliders depend on Guides. Show "Switch to Print"

    // Visibility Classes
    const controlsVisible = isFitMode && isGuidesOn;
    const guidesBtnVisible = isFitMode;

    const sliderClass = controlsVisible ? "" : "d-none";
    const guidesBtnClass = guidesBtnVisible ? "" : "d-none";

    // 1. Vertical Slider
    const vSliderHtml = `
        <div id="v-slider-container" class="position-absolute d-flex flex-column align-items-center bg-white rounded shadow p-2 ${sliderClass}" 
                style="right: -80px; top: 50%; transform: translateY(-50%); height: 85%; width: 50px; pointer-events: auto; z-index: 101;">
            <span class="small fw-bold text-muted mb-2" style="writing-mode: vertical-lr; text-orientation: upright; letter-spacing: 2px;">縮放調整</span>
            <button class="btn btn-sm btn-light border shadow-sm mb-2 p-0" id="btn-zoom-in" title="放大" style="width:24px;height:24px;">+</button>
            <input type="range" class="form-range" id="head-scale-input" min="1.0" max="1.4" step="0.01" value="${state.adjustments.headScale || 1.2}" 
                    style="writing-mode: vertical-lr; direction: rtl; flex-grow: 1; margin: 0;">
            <button class="btn btn-sm btn-light border shadow-sm mt-2 p-0" id="btn-zoom-out" title="縮小" style="width:24px;height:24px;">-</button>
            <div class="mt-2 badge bg-dark opacity-75" id="head-scale-val">${(state.adjustments.headScale || 1.2).toFixed(2)}x</div>
        </div>
    `;

    // 2. Horizontal Slider
    const hSliderHtml = `
        <div id="h-slider-container" class="position-absolute d-flex align-items-center justify-content-center w-100 bg-white rounded shadow p-2 ${sliderClass}" 
                style="bottom: -70px; left: 0; pointer-events: auto; z-index: 101;">
            <span class="small fw-bold text-muted me-3">水平調整</span>
            <span class="badge bg-light text-dark border me-2">L</span>
            <input type="range" class="form-range flex-grow-1 shadow-sm" id="x-shift-input" min="-50" max="50" step="1" value="${state.adjustments.xShift || 0}" style="max-width: 60%;">
            <span class="badge bg-light text-dark border ms-2">R</span>
            <div class="ms-2 badge bg-dark opacity-75" id="x-shift-val">${(state.adjustments.xShift > 0 ? '+' : '') + (state.adjustments.xShift || 0)}px</div>
        </div>
    `;
    // 3. Button Group (Centered Top)
    const sizeBtnText = isFitMode ? "顯示輸出尺寸" : "顯示預覽尺寸";
    const sizeBtnIcon = isFitMode ? "bi-aspect-ratio" : "bi-arrows-angle-contract";
    const sizeBtnClass = isFitMode ? "text-dark" : "text-primary";

    const toggleText = isGuidesOn ? "隱藏規格標線" : "顯示規格標線";
    const toggleIcon = isGuidesOn ? "bi-eye-slash" : "bi-eye";
    const toggleClass = isGuidesOn ? 'btn-white border shadow-sm text-primary' : 'btn-white border shadow-sm text-muted';
    const guideBtnDisplay = guidesBtnVisible ? "" : "d-none";

    // Container
    const btnContainerHtml = `
            <div id="top-btn-container" class="position-absolute d-flex gap-2 justify-content-center" 
                 style="top: -60px; left: 50%; transform: translateX(-50%); pointer-events: auto; z-index: 101; width: 100%;">
                
                <button class="btn btn-light border shadow-sm ${sizeBtnClass} fw-bold px-3 py-2" 
                        id="toggle-size-btn" style="font-size: 1rem;">
                    <i class="bi ${sizeBtnIcon} me-1"></i> <span id="toggle-size-text">${sizeBtnText}</span>
                </button>

                <button class="btn ${toggleClass} fw-bold px-3 py-2 ${guideBtnDisplay}" 
                        id="toggle-guides-btn" style="font-size: 1rem;">
                    <i class="bi ${toggleIcon} me-1"></i> <span id="toggle-btn-text">${toggleText}</span>
                </button>
            </div>
        `;

    // Append HTML to Overlay
    overlay.innerHTML = vSliderHtml + hSliderHtml + btnContainerHtml;
    imageWrapper.appendChild(overlay);

    // --- Enforce Image Styles based on Mode ---
    const img = document.getElementById('main-preview-img');
    if (img) {
        if (state.viewMode === 'print') {
            img.style.maxHeight = '45mm';
            img.style.maxWidth = '35mm';
            img.style.height = '45mm';
            img.style.width = '35mm';
        } else {
            img.style.maxHeight = '100%';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.width = 'auto';
        }
    }

    // --- Bind Events ---

    // Toggle Guides
    const toggleBtn = document.getElementById('toggle-guides-btn');
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            state.adjustments.showGuides = !state.adjustments.showGuides;
            // Re-render UI
            handleClientSideUpdate();
        };
    }

    // Toggle Size
    const sizeBtn = document.getElementById('toggle-size-btn');
    if (sizeBtn) {
        sizeBtn.onclick = () => {
            if (state.viewMode === 'fit') {
                // Switch to Print
                state.viewMode = 'print';
                // Force Clean (No Guides)
                state.adjustments.showGuides = false;
            } else {
                // Switch to Fit
                state.viewMode = 'fit';
                // Restore Guides (Default to ON for editing)
                state.adjustments.showGuides = true;
            }
            handleClientSideUpdate();
        };
    }

    // Sliders
    const scaleInput = document.getElementById('head-scale-input');
    const scaleVal = document.getElementById('head-scale-val');
    if (scaleInput) {
        scaleInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            if (scaleVal) scaleVal.innerText = val.toFixed(2) + 'x';
            state.adjustments.headScale = val;
        };
        scaleInput.onchange = handleClientSideUpdate;

        // Zoom Buttons
        const zIn = document.getElementById('btn-zoom-in');
        const zOut = document.getElementById('btn-zoom-out');
        if (zIn) zIn.onclick = () => {
            let v = parseFloat(scaleInput.value) + 0.01;
            if (v > 1.4) v = 1.4;
            scaleInput.value = v;
            scaleInput.dispatchEvent(new Event('input'));
            scaleInput.dispatchEvent(new Event('change'));
        };
        if (zOut) zOut.onclick = () => {
            let v = parseFloat(scaleInput.value) - 0.01;
            if (v < 1.0) v = 1.0;
            scaleInput.value = v;
            scaleInput.dispatchEvent(new Event('input'));
            scaleInput.dispatchEvent(new Event('change'));
        };
    }

    const xShiftInput = document.getElementById('x-shift-input');
    const xShiftVal = document.getElementById('x-shift-val');
    if (xShiftInput) {
        xShiftInput.oninput = (e) => {
            const val = parseInt(e.target.value);
            if (xShiftVal) xShiftVal.innerText = (val > 0 ? '+' : '') + val + 'px';
            state.adjustments.xShift = val;
        };
        xShiftInput.onchange = handleClientSideUpdate;
    }
}

// [Optimization] Fix: Sync FaceData
function syncProductionState(processRes) {
    if (processRes.faceData) {
        console.log("[State] Syncing FaceData to match Compressed Assets");
        state.faceData = processRes.faceData;
    }
}

// Extracted UI Update Logic
async function updateResultUI(b64) {
    console.log("[Debug] updateResultUI: Called.");
    if (!b64.startsWith('data:image/')) {
        b64 = `data:image/jpeg;base64,${b64}`;
    }
    state.processedImage = b64;

    // 1. Ensure Container
    const container = document.getElementById('preview-container');
    if (!container) {
        console.error("[Debug] updateResultUI: preview-container NOT FOUND.");
        return;
    }

    // 2. Check/Recreate Wrapper & Image (Robustness against UI wipes)
    let wrapper = document.getElementById('image-wrapper');
    let img = document.getElementById('main-preview-img');

    if (!wrapper) {
        console.warn("[Debug] updateResultUI: Image Wrapper missing, recreating...");
        // Rebuild structure that supports overlay
        container.innerHTML = ''; // Start fresh

        wrapper = document.createElement('div');
        wrapper.id = 'image-wrapper';
        wrapper.className = 'position-relative d-inline-flex justify-content-center align-items-center';
        wrapper.style.maxHeight = '80%';
        wrapper.style.maxWidth = '100%';

        img = document.createElement('img');
        img.id = 'main-preview-img';
        img.className = 'img-fluid shadow-sm border'; // Removed 'rounded'
        img.style.maxHeight = '100%';
        img.style.maxWidth = '100%';
        img.style.objectFit = 'contain';
        img.style.background = 'white';

        wrapper.appendChild(img);
        container.appendChild(wrapper);
    } else {
        console.log("[Debug] updateResultUI: Wrapper found.");
        // Ensure img reference is valid
        if (!img) img = document.getElementById('main-preview-img');
    }

    // 3. Update Image
    if (img) {
        console.log("[Debug] updateResultUI: Updating Image Src.");
        img.src = b64;
        img.classList.remove('d-none');
    } else {
        console.error("[Debug] updateResultUI: Image element missing!");
    }

    // 4. Inject Controls (Now guaranteed to have wrapper)
    injectAdvancedControls();

    // 5. Show Download Options
    const specData = DEFAULT_SPECS[state.spec];
    // UI.showAuditSuccess(state.processedImage, state.faceData, null); // REMOVED: This wipes the DOM and destroys controls!

    // Custom Callback for 4x2: Ensure Clean Image (No Guides)
    const handle4x2Click = async () => {
        console.log("[Debug] 4x2 Clicked. Preparing Clean Image...");
        let cleanB64 = state.processedImage;

        // If guides are ON, we need to regenerate a clean version for printing
        if (state.adjustments.showGuides) {
            console.log("[Debug] Guides are ON. Regenerating without guides for print...");
            // Create a temp adjustments object
            const cleanAdjustments = { ...state.adjustments, showGuides: false };
            try {
                if (state.assets && state.assets.transparentBlob) {
                    cleanB64 = await API.recomposePreview(
                        state.assets.transparentBlob,
                        state.assets.fullRect,
                        state.faceData,
                        state.spec,
                        cleanAdjustments
                    );
                }
            } catch (e) {
                console.warn("Failed to generate clean image for 4x2, using current:", e);
            }
        }

        await UI.show4x2Preview(cleanB64, specData);
    };

    UI.showDownloadOptions(b64, specData, handle4x2Click);
    UI.updateToReuploadMode();
    UI.setAuditButtonRed();
}

// Client-Side Re-composition Handler
async function handleClientSideUpdate() {
    if (state.assets && state.assets.transparentBlob) {
        try {
            const b64 = await API.recomposePreview(
                state.assets.transparentBlob,
                state.assets.fullRect,
                state.faceData,
                state.spec,
                state.adjustments
            );
            await updateResultUI(b64);
        } catch (e) {
            console.error("Client Recompose Failed:", e);
        }
    } else {
        runProductionPhase(); // Fallback if no assets
    }
}
// Removed legacy applyGuideOverlay (logic moved to UI)
// Expose functions to Global Scope for HTML Buttons / UI
// [NEW] Quick Restore Helper (No Spinner)
window.restorePreview = function () {
    if (state.processedImage) {
        updateResultUI(state.processedImage);
    } else {
        console.error("No processed image to restore");
        runProductionPhase(); // Fallback
    }
};

window.handleFileUpload = handleFileUpload;
window.runProductionPhase = runProductionPhase;
window.runAuditPhase = runAuditPhase;
