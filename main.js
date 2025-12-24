import * as API from './js/api.js';
import { UI } from './js/ui.js';
import { DEFAULT_SPECS } from './js/config.js'; // Restore Spec Import

// --- State ---
let state = {
    originalImage: null,
    processedImage: null,
    faceData: null,
    spec: 'passport'
};

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
window.handleFileUpload = handleFileUpload;

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

    const file = input && input.files ? input.files[0] : null;
    console.log("File detected:", file);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        console.log("File Reader Loaded");
        try {
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

            UI.showUseConfirm(DEFAULT_SPECS[state.spec].name, async () => {
                console.log("Modal Confirmed, Starting Audit");
                await runAuditPhase();
            });

        } catch (err) {
            console.error("Error inside reader.onload:", err);
        }
    };
    reader.onerror = (err) => console.error("File Reader Error:", err);
    reader.readAsDataURL(file);
}

// Phase 1: Audit (Check Only)
async function runAuditPhase() {
    try {
        console.log("Calling API.detectFace...");
        const detectRes = await API.detectFace(state.originalImage);

        if (!detectRes || !detectRes.found) {
            alert('未偵測到人臉，請更換照片');
            return;
        }
        state.faceData = detectRes;

        console.log("Calling runCheckApi...");
        const checkRes = await API.runCheckApi(state.originalImage, state.spec);
        console.log("runCheckApi Result:", checkRes);

        if (!checkRes || !checkRes.results) {
            throw new Error("Invalid check result from API");
        }

        console.log("Showing Audit Report Modal...");
        UI.showAuditReport(
            state.originalImage,
            checkRes.results,
            state.faceData, // Pass Face Data for UI lines
            () => runProductionPhase(),
            () => { uploadInput.value = ''; }
        );

    } catch (err) {
        console.error("Audit Failed:", err);
        alert("審查過程發生錯誤，請稍後再試。");
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
async function runProductionPhase() {
    try {
        const processRes = await API.processPreview(state.originalImage, state.faceData.suggestedCrop);

        if (processRes && processRes.photos && processRes.photos.length > 0) {
            state.processedImage = 'data:image/jpeg;base64,' + processRes.photos[0];
            // Pass bgRemoved flag (default true if undefined, but API now returns simple boolean)
            // If fallback occurred, bgRemoved is false.
            renderResult(state.processedImage, processRes.bgRemoved);
        }

    } catch (err) {
        console.error("Production Failed:", err);
        alert("製作過程發生錯誤，請稍後再試。");
    }
}
// Removed legacy applyGuideOverlay (logic moved to UI)
