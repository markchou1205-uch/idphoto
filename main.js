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
            state.spec = key;
            updateSpecUI();
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

    const reader = new FileReader();
    reader.onload = async (event) => {
        console.log("File Reader Loaded");
        try {
            // Perf: Warmup Backend Immediately
            API.warmupBackend();

            let rawResult = event.target.result;

            // --- ULTIMATE STRUCTURAL SANITIZER ---
            // Structural split is safer: get the last part (data) and strictly add one header.

            if (rawResult.includes(',')) {
                // Split by comma to separate any headers from data
                // The last element is always the raw base64 data
                const parts = rawResult.split(',');
                const cleanData = parts.pop();
                state.originalImage = `data:image/jpeg;base64,${cleanData}`;
            } else {
                state.originalImage = rawResult;
            }

            console.log("State Updated (Split Sanitization). Length:", state.originalImage.length);

            UI.showUseConfirm(DEFAULT_SPECS[state.spec], async () => {
                console.log("Modal Confirmed, Showing Action Panel");

                // [NEW FLOW]: UX Improvements
                // 1. Hide Spec Selector Sidebar (if separate) or just replace content
                UI.toggleSidebar(false); // Action Panel is inside sidebar now, verify this logic.

                // 2. Render Action Panel (Production vs Audit)
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

// Phase 1: Audit (Check Only) - Triggered by Button
async function runAuditPhase() {
    try {
        console.log("Starting Audit Phase...");

        // Determine Source Image (Original or Processed)
        const targetImage = state.processedImage || state.originalImage;
        const isProcessed = !!state.processedImage;

        // Init UI for Audit (Report Only)
        UI.initAuditTable('#audit-report-container');
        UI.toggleAuditView(true); // Switch view to Audit Report

        console.log("Calling API.detectFace on target...");
        const detectRes = await API.detectFace(targetImage);

        if (!detectRes || !detectRes.found) {
            alert('未偵測到人臉，請更換照片');
            return;
        }

        // Only update global state if this is the original image
        // (Production always relies on Original + Original-Face-Data)
        if (!isProcessed) {
            state.faceData = detectRes;
        }

        console.log("Calling runCheckApi...");
        const checkRes = await API.runCheckApi(targetImage, state.spec);
        console.log("runCheckApi Result:", checkRes);

        if (!checkRes || !checkRes.results) {
            throw new Error("Invalid check result from API");
        }
        state.auditResults = checkRes.results;

        // [NEW FLOW]: Animate Basic Results
        console.log("Animating Basic Audit Results...");

        UI.renderBasicAudit(state.auditResults, () => {
            console.log("Basic Audit Complete.");

            const isProcessed = !!state.processedImage;

            // On Complete: Show "Generate" or "Print" Button
            UI.showBasicPassState(() => {
                console.log("User clicked Action. Processed:", isProcessed);
                if (isProcessed) {
                    // Already processed? Show Result View
                    UI.toggleAuditView(false);
                    UI.showDownloadOptions(state.processedImage, DEFAULT_SPECS[state.spec]);
                } else {
                    // Start Production
                    runProductionPhase();
                }
            }, isProcessed);

            // Show Visuals (Red Lines etc.)
            UI.showAuditSuccess(targetImage, detectRes, null);
        });

    } catch (err) {
        console.error("Audit Failed:", err);
        alert("審查過程發生錯誤，請稍後再試。");
        location.reload();
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
    // UX: Disable Button
    const btn = document.getElementById('btn-start-production');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '製作中... (Processing)';
    }

    // [New] Ensure Audit View is Hidden (Show Service Table)
    UI.toggleAuditView(false);

    try {

        // [Safety Check]: Ensure Face Data exists (Critical for Direct Production Flow)
        if (!state.faceData) {
            console.log("No existing face data. Running detection...");
            // Optional: Show spinner
            const detectRes = await API.detectFace(state.originalImage);
            if (!detectRes || !detectRes.found) {
                alert('未偵測到人臉，請更換照片');
                // Reload or Reset
                location.reload();
                return;
            }
            state.faceData = detectRes;
        }

        // 2. Start Animation FIRST (Immediate Feedback)
        // This shows the overlay and progress indicators immediately
        UI.renderServiceAnimation(async () => {
            try {
                // 3. Start API Task (Inside Animation Callback)
                const processRes = await API.processPreview(
                    state.originalImage,
                    state.faceData.suggestedCrop,
                    state.faceData,
                    state.spec,
                    state.adjustments
                );

                console.log("API.processPreview Result Retrieved");

                if (processRes && processRes.photos && processRes.photos.length > 0) {
                    // Cache Assets for Client-Side Re-composition
                    if (processRes.assets) {
                        state.assets = processRes.assets;
                    }

                    // Ensure proper Base64 prefix
                    let b64 = processRes.photos[0];
                    if (!b64.startsWith('data:image/')) {
                        b64 = `data:image/jpeg;base64,${b64}`;
                    }
                    state.processedImage = b64;
                    // ... (rest of update UI logic)
                    await updateResultUI(b64); // Extract UI update logic
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
        console.log("[Debug] injectAdvancedControls: Removing existing overlay.");
        existingOverlay.remove();
    }

    if (imageWrapper) {
        console.log("[Debug] injectAdvancedControls: Wrapper found. Injecting controls.");
        const overlay = document.createElement('div');
        overlay.id = 'control-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '100'; // Ensure above image

        // Check Guides State
        const isGuidesOn = state.adjustments.showGuides === undefined ? true : state.adjustments.showGuides;
        const sliderVisibilityClass = isGuidesOn ? "" : "d-none";

        // 1. Vertical Slider (Right)
        const vSliderHtml = `
            <div id="v-slider-container" class="position-absolute d-flex flex-column align-items-center bg-white rounded shadow p-2 ${sliderVisibilityClass}" 
                    style="right: -80px; top: 50%; transform: translateY(-50%); height: 85%; width: 50px; pointer-events: auto; z-index: 101;">
                <span class="small fw-bold text-muted mb-2" style="writing-mode: vertical-lr; text-orientation: upright; letter-spacing: 2px;">縮放調整</span>
                <button class="btn btn-sm btn-light border shadow-sm mb-2 p-0" id="btn-zoom-in" title="放大" style="width:24px;height:24px;">+</button>
                <input type="range" class="form-range" id="head-scale-input" min="1.0" max="1.4" step="0.01" value="${state.adjustments.headScale || 1.2}" 
                        style="writing-mode: vertical-lr; direction: rtl; flex-grow: 1; margin: 0;">
                <button class="btn btn-sm btn-light border shadow-sm mt-2 p-0" id="btn-zoom-out" title="縮小" style="width:24px;height:24px;">-</button>
                <div class="mt-2 badge bg-dark opacity-75" id="head-scale-val">${(state.adjustments.headScale || 1.2).toFixed(2)}x</div>
            </div>
        `;

        // 2. Horizontal Slider (Bottom)
        const hSliderHtml = `
            <div id="h-slider-container" class="position-absolute d-flex align-items-center justify-content-center w-100 bg-white rounded shadow p-2 ${sliderVisibilityClass}" 
                    style="bottom: -70px; left: 0; pointer-events: auto; z-index: 101;">
                <span class="small fw-bold text-muted me-3">水平調整</span>
                <span class="badge bg-light text-dark border me-2">L</span>
                <input type="range" class="form-range flex-grow-1 shadow-sm" id="x-shift-input" min="-50" max="50" step="1" value="${state.adjustments.xShift || 0}" style="max-width: 60%;">
                <span class="badge bg-light text-dark border ms-2">R</span>
                <div class="ms-2 badge bg-dark opacity-75" id="x-shift-val">${(state.adjustments.xShift > 0 ? '+' : '') + (state.adjustments.xShift || 0)}px</div>
            </div>
        `;

        // 3. Toggle Guide (Top Right)
        const toggleText = isGuidesOn ? "隱藏規格標線" : "顯示規格標線";
        const toggleIcon = isGuidesOn ? "bi-eye-slash" : "bi-eye";
        const toggleClass = isGuidesOn ? 'btn-white border shadow-sm text-primary' : 'btn-white border shadow-sm text-muted';

        // 4. Size Toggle (Next to Guide Toggle) - New
        const sizeHtml = `
            <button class="btn btn-sm btn-white border shadow-sm text-dark position-absolute fw-bold" 
                    id="toggle-size-btn" 
                    style="top: -50px; right: 140px; pointer-events: auto; z-index: 101; white-space: nowrap;">
                <i class="bi bi-aspect-ratio"></i> <span id="toggle-size-text">顯示輸出尺寸</span>
            </button>
        `;

        const toggleHtml = `
            <button class="btn btn-sm ${toggleClass} position-absolute fw-bold" 
                    id="toggle-guides-btn" 
                    style="top: -50px; right: 0; pointer-events: auto; z-index: 101; white-space: nowrap;">
                <i class="bi ${toggleIcon}"></i> <span id="toggle-btn-text">${toggleText}</span>
            </button>
        `;

        // Append HTML to Overlay
        overlay.innerHTML = vSliderHtml + hSliderHtml + sizeHtml + toggleHtml;

        // Append Overlay to Wrapper
        imageWrapper.appendChild(overlay);

        console.log("[Debug] injectAdvancedControls: Controls appended to overlay, and overlay to wrapper.");

        // --- Bind Events ---

        // 1. Guide Toggle
        const toggleBtn = document.getElementById('toggle-guides-btn');
        const toggleBtnText = document.getElementById('toggle-btn-text');
        const toggleBtnIcon = toggleBtn ? toggleBtn.querySelector('i') : null;
        const vContainer = document.getElementById('v-slider-container');
        const hContainer = document.getElementById('h-slider-container');

        if (toggleBtn) {
            toggleBtn.onclick = () => {
                console.log("[Debug] Toggle clicked");
                state.adjustments.showGuides = !state.adjustments.showGuides;
                const isOn = state.adjustments.showGuides;

                // Update UI Text & Icon
                if (toggleBtnText) toggleBtnText.innerText = isOn ? "隱藏規格標線" : "顯示規格標線";
                if (toggleBtnIcon) {
                    toggleBtnIcon.className = isOn ? "bi bi-eye-slash" : "bi bi-eye";
                }
                toggleBtn.className = isOn ? 'btn btn-sm btn-white border shadow-sm text-primary position-absolute fw-bold' : 'btn btn-sm btn-white border shadow-sm text-muted position-absolute fw-bold';

                // Toggle Sliders Visibility
                if (vContainer) vContainer.classList.toggle('d-none', !isOn);
                if (hContainer) hContainer.classList.toggle('d-none', !isOn);

                handleClientSideUpdate();
            };
        }

        // 4. Size Toggle
        const sizeBtn = document.getElementById('toggle-size-btn');
        const sizeText = document.getElementById('toggle-size-text');
        const mainImg = document.getElementById('main-preview-img');

        if (sizeBtn && mainImg) {
            sizeBtn.onclick = () => {
                const isRealSize = mainImg.style.maxHeight === '45mm'; // Check current state
                if (isRealSize) {
                    // Switch to Preview (Fit)
                    mainImg.style.maxHeight = '100%';
                    mainImg.style.maxWidth = '100%';
                    mainImg.style.height = 'auto';
                    mainImg.style.width = 'auto';
                    sizeText.innerText = "顯示輸出尺寸";
                    sizeBtn.classList.remove('text-primary');
                    sizeBtn.classList.add('text-dark');
                } else {
                    // Switch to Real Size (35mm x 45mm)
                    mainImg.style.maxHeight = '45mm'; // CSS mm units
                    mainImg.style.maxWidth = '35mm';
                    // We also need to unset percentage limits or force them
                    mainImg.style.height = '45mm';
                    mainImg.style.width = '35mm';
                    sizeText.innerText = "顯示預覽尺寸";
                    sizeBtn.classList.remove('text-dark');
                    sizeBtn.classList.add('text-primary');
                }
            };
        }

        // 2. Vertical Scale Slider
        const scaleInput = document.getElementById('head-scale-input');
        const scaleVal = document.getElementById('head-scale-val');
        if (scaleInput) {
            scaleInput.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (scaleVal) scaleVal.innerText = val.toFixed(2) + 'x';
                state.adjustments.headScale = val;
            };
            scaleInput.onchange = handleClientSideUpdate;
        }

        // 3. Horizontal Shift Slider
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

        // Zoom Buttons
        const zIn = document.getElementById('btn-zoom-in');
        const zOut = document.getElementById('btn-zoom-out');
        if (zIn && scaleInput) {
            zIn.onclick = () => {
                let v = parseFloat(scaleInput.value) + 0.01;
                if (v > 1.4) v = 1.4;
                scaleInput.value = v;
                scaleInput.dispatchEvent(new Event('input'));
                scaleInput.dispatchEvent(new Event('change'));
            };
        }
        if (zOut && scaleInput) {
            zOut.onclick = () => {
                let v = parseFloat(scaleInput.value) - 0.01;
                if (v < 1.0) v = 1.0;
                scaleInput.value = v;
                scaleInput.dispatchEvent(new Event('input'));
                scaleInput.dispatchEvent(new Event('change'));
            };
        }
    } else {
        console.error("[Debug] injectAdvancedControls: image-wrapper NOT FOUND!");
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
        img.className = 'img-fluid shadow-sm rounded border';
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
window.handleFileUpload = handleFileUpload;
window.runProductionPhase = runProductionPhase;
window.runAuditPhase = runAuditPhase;
