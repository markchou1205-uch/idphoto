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

            // --- ULTIMATE SANITIZER ---
            // Issue: Double headers like "data:image/jpeg;base64,data:image/jpeg;base64,..."
            // Fix: Split by 'base64,' and take the LAST part (the actual data), then re-add prefix.

            if (rawResult.indexOf('base64,') !== -1) {
                const parts = rawResult.split('base64,');
                if (parts.length > 2) {
                    console.warn("Multiple base64 headers detected! Cleaning...");
                    // parts[parts.length-1] is the data.
                    const cleanData = parts[parts.length - 1];
                    rawResult = `data:image/jpeg;base64,${cleanData}`;
                }
            }

            state.originalImage = rawResult;
            console.log("State Updated (Cleaned), Calling UI.showUseConfirm");

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
            () => runProductionPhase(),
            () => { uploadInput.value = ''; }
        );

    } catch (err) {
        console.error("Audit Failed:", err);
        alert("審查過程發生錯誤，請稍後再試。");
    }
}

// Phase 2: Production (Processing)
async function runProductionPhase() {
    try {
        const processRes = await API.processPreview(state.originalImage, state.faceData.suggestedCrop);

        if (processRes && processRes.photos && processRes.photos.length > 0) {
            state.processedImage = 'data:image/jpeg;base64,' + processRes.photos[0];

            const finalImg = new Image();
            finalImg.onload = () => {
                const finalBox = UI.showComparison(state.originalImage, finalImg);
                finalBox.innerHTML = '';
                finalBox.style.position = 'relative';
                finalBox.style.display = 'inline-block';
                finalBox.appendChild(finalImg);
                applyGuideOverlay(finalImg);
            };
            finalImg.src = state.processedImage;
        }

    } catch (err) {
        console.error("Production Failed:", err);
        alert("製作過程發生錯誤，請稍後再試。");
    }
}

function applyGuideOverlay(targetImgElement) {
    // ... Copying guide overlay code from previous step or keeping it if I read it context ...
    // To save tokens I will re-implement it briefly as it is critical.
    const overlay = document.createElement('div');
    overlay.className = 'guide-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';

    function createStyleLine(top, left, width, height, border, text, textPos, color = '#d00') {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.top = top;
        el.style.left = left;
        el.style.width = width;
        el.style.height = height;
        if (border) el.style.border = border;
        el.style.boxSizing = 'border-box';
        el.style.zIndex = '10';
        if (text) {
            const label = document.createElement('span');
            label.innerText = text;
            label.style.position = 'absolute';
            label.style.color = color;
            label.style.fontSize = '12px';
            label.style.fontWeight = 'bold';
            label.style.whiteSpace = 'nowrap';
            label.style.fontFamily = 'Arial, sans-serif';
            switch (textPos) {
                case 'left': label.style.right = '8px'; label.style.top = '50%'; label.style.transform = 'translateY(-50%)'; break;
                case 'bottom': label.style.top = '6px'; label.style.left = '50%'; label.style.transform = 'translateX(-50%)'; break;
                case 'right-center': label.style.left = '10px'; label.style.top = '50%'; label.style.transform = 'translateY(-50%)'; break;
            }
            el.appendChild(label);
        }
        return el;
    }

    const leftRuler = createStyleLine('0%', '-15px', '10px', '100%', '', '4.5公分', 'left', '#333');
    leftRuler.style.borderLeft = '1px solid #999'; leftRuler.style.borderTop = '1px solid #999'; leftRuler.style.borderBottom = '1px solid #999';
    overlay.appendChild(leftRuler);

    const bottomRuler = createStyleLine('100%', '0%', '100%', '10px', '', '3.5公分', 'bottom', '#333');
    bottomRuler.style.top = 'calc(100% + 5px)';
    bottomRuler.style.borderLeft = '1px solid #999'; bottomRuler.style.borderRight = '1px solid #999'; bottomRuler.style.borderBottom = '1px solid #999';
    overlay.appendChild(bottomRuler);

    const bracketTop = 10.0;
    const bracketHeight = 75.5;
    overlay.appendChild(createStyleLine(bracketTop + '%', '0', '100%', '1px', '1px dashed red', ''));
    const rightBracket = createStyleLine(bracketTop + '%', '100%', '10px', bracketHeight + '%', '', '應介於 3.2 - 3.6 cm', 'right-center');
    rightBracket.style.borderTop = '2px solid red';
    rightBracket.style.borderBottom = '2px solid red';
    rightBracket.style.borderRight = '2px solid red';
    overlay.appendChild(rightBracket);
    overlay.appendChild(createStyleLine((bracketTop + bracketHeight) + '%', '0', '100%', '1px', '1px dashed red', ''));

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.marginTop = '20px';
    wrapper.style.marginLeft = '20px';
    wrapper.style.marginBottom = '20px';
    targetImgElement.parentNode.insertBefore(wrapper, targetImgElement);
    wrapper.appendChild(targetImgElement);
    wrapper.appendChild(overlay);
}
