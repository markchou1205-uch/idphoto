import * as API from './js/api.js';
import { UI } from './js/ui.js';
// import { CONFIG } from './js/config.js'; // REMOVED: No such export

// --- State ---
let state = {
    originalImage: null,  // Base64
    processedImage: null, // Base64
    faceData: null,       // Azure Face Data
    spec: 'passport'
};

// --- DOM Elements ---
const uploadInput = document.getElementById('uploadInput');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    UI.initStyles();

    if (uploadInput) {
        // Remove existing listener if any to avoid duplicates (though reload clears it)
        // Add listener
        uploadInput.addEventListener('change', handleFileUpload);
    }
});

// Expose for HTML inline calls (Legacy support)
window.handleFileUpload = handleFileUpload;

// --- Handlers ---
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed (verification)
    // uploadInput.value = ''; // Wait, if we clear it here, might break change event? Better clear after process.

    const reader = new FileReader();
    reader.onload = async (event) => {
        state.originalImage = event.target.result;

        // Step 1: Confirm Usage (Modal 1)
        UI.showUseConfirm(state.spec === 'passport' ? '護照/身分證 (35x45mm)' : '其他證件', async () => {
            await runAuditPhase();
        });
    };
    reader.readAsDataURL(file);
}

// Phase 1: Audit (Check Only)
async function runAuditPhase() {
    try {
        // 1. Detect Face (Get Rect for future crop)
        const detectRes = await API.detectFace(state.originalImage);
        if (!detectRes.found) {
            alert('未偵測到人臉，請更換照片');
            return;
        }
        state.faceData = detectRes; // Store for phase 2

        // 2. Run Validation (Azure Analysis) - No Cloudinary cost yet
        const checkRes = await API.runCheckApi(state.originalImage, state.spec);

        // Step 2: Show Audit Report (Modal 2)
        UI.showAuditReport(
            state.originalImage,
            checkRes.results,
            () => runProductionPhase(), // On Proceed
            () => { uploadInput.value = ''; } // On Retry
        );

    } catch (err) {
        console.error("Audit Failed:", err);
        alert("審查過程發生錯誤，請稍後再試。");
    }
}

// Phase 2: Production (Processing)
async function runProductionPhase() {
    try {
        // 1. Process Image (Crop -> Lighting -> BG)
        // detailed cropParams come from detectFace in Phase 1
        const processRes = await API.processPreview(state.originalImage, state.faceData.suggestedCrop);

        if (processRes && processRes.photos && processRes.photos.length > 0) {
            state.processedImage = 'data:image/jpeg;base64,' + processRes.photos[0];

            // 2. Create Final Canvas Element from Result
            const finalImg = new Image();
            finalImg.onload = () => {
                // Prepare Side-by-Side View
                const finalBox = UI.showComparison(state.originalImage, finalImg); // finalImg unused logic in UI helper

                // Clear Box content to customized it
                finalBox.innerHTML = '';
                finalBox.style.position = 'relative';
                finalBox.style.display = 'inline-block';

                // Append Image
                finalBox.appendChild(finalImg);

                // Apply Guides (Ministry Standard)
                applyGuideOverlay(finalImg);
            };
            finalImg.src = state.processedImage;
        }

    } catch (err) {
        console.error("Production Failed:", err);
        alert("製作過程發生錯誤，請稍後再試。");
    }
}

// Helper: Apply Guides (Ministry of Interior Standard)
function applyGuideOverlay(targetImgElement) {
    // Create Overlay for Ministry Standard Template
    const overlay = document.createElement('div');
    overlay.className = 'guide-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';

    // Helper for Lines
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
            label.style.fontFamily = 'Arial, sans-serif'; // Clean font

            switch (textPos) {
                case 'left':
                    label.style.right = '8px';
                    label.style.top = '50%';
                    label.style.transform = 'translateY(-50%)';
                    break;
                case 'bottom':
                    label.style.top = '6px';
                    label.style.left = '50%';
                    label.style.transform = 'translateX(-50%)';
                    break;
                case 'right-center':
                    label.style.left = '10px';
                    label.style.top = '50%';
                    label.style.transform = 'translateY(-50%)';
                    break;
            }
            el.appendChild(label);
        }
        return el;
    }

    // 1. Rulers (Gray)
    const leftRuler = createStyleLine('0%', '-15px', '10px', '100%', '', '4.5公分', 'left', '#333');
    leftRuler.style.borderLeft = '1px solid #999'; leftRuler.style.borderTop = '1px solid #999'; leftRuler.style.borderBottom = '1px solid #999';
    overlay.appendChild(leftRuler);

    const bottomRuler = createStyleLine('100%', '0%', '100%', '10px', '', '3.5公分', 'bottom', '#333');
    bottomRuler.style.top = 'calc(100% + 5px)';
    bottomRuler.style.borderLeft = '1px solid #999'; bottomRuler.style.borderRight = '1px solid #999'; bottomRuler.style.borderBottom = '1px solid #999';
    overlay.appendChild(bottomRuler);

    // 2. Compliance Bracket (Red)
    // Head (Hair Top to Chin) = 3.2-3.6cm.
    // In 4.5cm photo: Start at 10% (0.45cm).
    // Height of bracket: ~3.4cm = 75.5%.

    const bracketTop = 10.0;
    const bracketHeight = 75.5;

    // Top Line (Hair Limit)
    overlay.appendChild(createStyleLine(bracketTop + '%', '0', '100%', '1px', '1px dashed red', ''));

    // The Bracket
    const rightBracket = createStyleLine(bracketTop + '%', '100%', '10px', bracketHeight + '%', '', '應介於 3.2 - 3.6 cm', 'right-center');
    rightBracket.style.borderTop = '2px solid red';
    rightBracket.style.borderBottom = '2px solid red';
    rightBracket.style.borderRight = '2px solid red';
    overlay.appendChild(rightBracket);

    // Bottom Line (Chin Limit)
    overlay.appendChild(createStyleLine((bracketTop + bracketHeight) + '%', '0', '100%', '1px', '1px dashed red', ''));

    // 3. Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.marginTop = '20px'; // Space for rulers
    wrapper.style.marginLeft = '20px';
    wrapper.style.marginBottom = '20px';

    targetImgElement.parentNode.insertBefore(wrapper, targetImgElement);
    wrapper.appendChild(targetImgElement);
    wrapper.appendChild(overlay);
}
