/**
 * Beauty Mode UI Controller - WebGL Real-time Version
 * Uses WebGL shaders for instant preview updates
 */

// Beauty Mode State
let beautyModeActive = false;
let beautyCanvas = null;
let originalImage = null;
let originalImageSrc = null;

/**
 * Enter Beauty Mode
 */
function enterBeautyMode() {
    console.log('[Beauty] Entering beauty mode...');

    beautyModeActive = true;

    // (0) Disable the beauty button immediately
    const btnBeautyMode = document.getElementById('btn-beauty-mode');
    if (btnBeautyMode) {
        btnBeautyMode.disabled = true;
        btnBeautyMode.classList.add('disabled');
        btnBeautyMode.classList.remove('btn-warning');
        btnBeautyMode.classList.add('btn-secondary');
        btnBeautyMode.innerHTML = '<i class="bi bi-check-circle"></i> 美顏模式已啟用';
    }

    // (1) FIRST: Hide guide lines and trigger re-render
    // This will re-render the preview image WITHOUT guide lines
    if (window.state && window.state.adjustments) {
        window.state.adjustments.showGuides = false;
    }
    hideGuideElements();

    // (2) Wait for re-render to complete, THEN initialize WebGL with clean image
    setTimeout(() => {
        // Store the CLEAN image (without guide lines)
        const previewImg = document.querySelector('#image-wrapper img');
        if (previewImg) {
            originalImage = previewImg;
            originalImageSrc = previewImg.src;
        }

        // Initialize WebGL renderer with clean image
        initWebGLRenderer();

        // Show beauty tool panel
        showBeautyToolPanel();

        // Show complete button
        showBeautyCompleteButton();

        console.log('[Beauty] Beauty mode activated with clean image');
    }, 500);  // Wait 500ms for handleGuideToggle() to complete re-render
}

/**
 * Initialize WebGL Beauty Renderer
 */
function initWebGLRenderer() {
    const previewImg = document.querySelector('#image-wrapper img');
    if (!previewImg) {
        console.error('[Beauty] Preview image not found');
        return;
    }

    const wrapper = document.getElementById('image-wrapper');
    if (!wrapper) return;

    // Create beauty canvas
    beautyCanvas = document.createElement('canvas');
    beautyCanvas.id = 'beauty-canvas';
    beautyCanvas.style.cssText = `
        position: absolute;
        top: ${previewImg.offsetTop}px;
        left: ${previewImg.offsetLeft}px;
        width: ${previewImg.offsetWidth}px;
        height: ${previewImg.offsetHeight}px;
        pointer-events: none;
        z-index: 50;
    `;

    // Hide original image
    previewImg.style.visibility = 'hidden';

    // Insert canvas
    wrapper.appendChild(beautyCanvas);

    // Initialize WebGL renderer
    if (window.webglBeautyRenderer) {
        window.webglBeautyRenderer.init('beauty-canvas', previewImg, null);
        console.log('[Beauty] WebGL renderer initialized');
    } else {
        console.error('[Beauty] WebGL renderer not available');
    }
}

/**
 * Hide guide elements - must set state AND trigger re-render
 */
function hideGuideElements() {
    console.log('[Beauty] Hiding guide elements...');

    // 1. Set state to hide guides
    if (window.state && window.state.adjustments) {
        window.state.adjustments.showGuides = false;
        console.log('[Beauty] Set showGuides = false');
    }

    // 2. Hide toggle button
    const toggleBtn = document.getElementById('toggle-guides-btn');
    if (toggleBtn) toggleBtn.style.display = 'none';

    // 3. Hide sliders
    const vSlider = document.getElementById('v-slider-container');
    const hSlider = document.getElementById('h-slider-container');
    if (vSlider) vSlider.style.display = 'none';
    if (hSlider) hSlider.style.display = 'none';

    // 4. Hide SVG overlays
    const imageWrapper = document.getElementById('image-wrapper');
    if (imageWrapper) {
        const svgs = imageWrapper.querySelectorAll('svg');
        svgs.forEach(svg => svg.style.display = 'none');
    }

    // 5. Trigger re-render to remove drawn guides from canvas
    if (typeof window.handleGuideToggle === 'function') {
        window.handleGuideToggle();
        console.log('[Beauty] Triggered handleGuideToggle() to re-render');
    }

    console.log('[Beauty] Guide elements hidden');
}

/**
 * Show guide elements
 */
function showGuideElements() {
    const toggleBtn = document.getElementById('toggle-guides-btn');
    if (toggleBtn) toggleBtn.style.display = '';

    const vSlider = document.getElementById('v-slider-container');
    const hSlider = document.getElementById('h-slider-container');
    if (vSlider) vSlider.style.display = '';
    if (hSlider) hSlider.style.display = '';

    const imageWrapper = document.getElementById('image-wrapper');
    if (imageWrapper) {
        const svgs = imageWrapper.querySelectorAll('svg');
        svgs.forEach(svg => svg.style.display = '');
    }
}

/**
 * Exit Beauty Mode
 */
function exitBeautyMode() {
    console.log('[Beauty] Exiting beauty mode...');

    beautyModeActive = false;

    // Show original image
    if (originalImage) {
        originalImage.style.visibility = 'visible';
    }

    // Remove beauty canvas
    if (beautyCanvas) {
        beautyCanvas.remove();
        beautyCanvas = null;
    }

    showGuideElements();

    const toolPanel = document.getElementById('beauty-tool-panel');
    if (toolPanel) toolPanel.remove();

    const completeBtn = document.getElementById('beauty-complete-btn-wrapper');
    if (completeBtn) completeBtn.remove();

    console.log('[Beauty] Beauty mode deactivated');
}

/**
 * Show Beauty Tool Panel - WebGL Real-time Version
 */
function showBeautyToolPanel() {
    const existing = document.getElementById('beauty-tool-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'beauty-tool-panel';
    panel.className = 'beauty-tool-panel';
    panel.innerHTML = `
        <div class="card shadow-sm">
            <div class="card-header bg-warning">
                <h6 class="mb-0 fw-bold">
                    <i class="bi bi-magic"></i> 美顏工具 <small class="text-success">(即時預覽)</small>
                </h6>
            </div>
            <div class="card-body p-3">
                <!-- Skin Smoothing -->
                <div class="beauty-control mb-3">
                    <label class="form-label small fw-bold">
                        <i class="bi bi-droplet"></i> 磨皮美膚
                        <span id="skin-smooth-value" class="badge bg-secondary">0</span>
                    </label>
                    <input type="range" class="form-range" id="skin-smooth-slider"
                           min="0" max="100" value="0" step="5">
                </div>

                <!-- Brightness -->
                <div class="beauty-control mb-3">
                    <label class="form-label small fw-bold">
                        <i class="bi bi-brightness-high"></i> 亮度
                        <span id="brightness-value" class="badge bg-secondary">0</span>
                    </label>
                    <input type="range" class="form-range" id="brightness-slider"
                           min="-50" max="50" value="0" step="5">
                </div>

                <!-- Contrast -->
                <div class="beauty-control mb-3">
                    <label class="form-label small fw-bold">
                        <i class="bi bi-circle-half"></i> 對比
                        <span id="contrast-value" class="badge bg-secondary">0</span>
                    </label>
                    <input type="range" class="form-range" id="contrast-slider"
                           min="-50" max="50" value="0" step="5">
                </div>

                <hr class="my-2">

                <!-- Lip Color -->
                <div class="beauty-control mb-3">
                    <label class="form-label small fw-bold">
                        <i class="bi bi-palette"></i> 美唇
                        <span id="lip-intensity-value" class="badge bg-secondary">0%</span>
                    </label>
                    <input type="range" class="form-range" id="lip-intensity-slider"
                           min="0" max="100" value="0" step="5">
                    <input type="color" id="lip-color-picker" value="#dc5050" 
                           class="form-control form-control-sm mt-1">
                </div>

                <!-- Blush -->
                <div class="beauty-control mb-3">
                    <label class="form-label small fw-bold">
                        <i class="bi bi-heart"></i> 腮紅
                        <span id="blush-intensity-value" class="badge bg-secondary">0%</span>
                    </label>
                    <input type="range" class="form-range" id="blush-intensity-slider"
                           min="0" max="100" value="0" step="5">
                    <input type="color" id="blush-color-picker" value="#ff9696"
                           class="form-control form-control-sm mt-1">
                </div>

                <!-- Eye Enlarge -->
                <div class="beauty-control mb-3">
                    <label class="form-label small fw-bold">
                        <i class="bi bi-eye"></i> 大眼
                        <span id="eye-enlarge-value" class="badge bg-secondary">+0%</span>
                    </label>
                    <input type="range" class="form-range" id="eye-enlarge-slider"
                           min="100" max="130" value="100" step="5">
                    <small class="text-muted d-block">建議低於 +15%</small>
                </div>

                <!-- Reset Button -->
                <div class="d-grid mt-3">
                    <button class="btn btn-outline-secondary btn-sm" id="reset-beauty-btn">
                        <i class="bi bi-arrow-counterclockwise"></i> 重置所有效果
                    </button>
                </div>
                
                <!-- Render Time -->
                <div id="render-time" class="text-muted small mt-2 text-center"></div>
            </div>
        </div>
    `;

    const previewContainer = document.getElementById('preview-container');
    if (previewContainer && previewContainer.parentElement) {
        previewContainer.parentElement.insertBefore(panel, previewContainer);
    }

    bindBeautyControlEvents();
}

/**
 * Show Beauty Complete Button
 */
function showBeautyCompleteButton() {
    const existing = document.getElementById('beauty-complete-btn-wrapper');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'beauty-complete-btn-wrapper';
    wrapper.className = 'text-center mt-3';
    wrapper.innerHTML = `
        <button class="btn btn-success btn-lg" id="beauty-complete-btn">
            <i class="bi bi-check-circle"></i> 美顏完成
        </button>
    `;

    const previewContainer = document.getElementById('preview-container');
    if (previewContainer && previewContainer.parentElement) {
        previewContainer.parentElement.insertBefore(wrapper, previewContainer.nextSibling);
    }

    document.getElementById('beauty-complete-btn').onclick = () => {
        // Save enhanced image
        if (window.webglBeautyRenderer && originalImage) {
            const enhancedImage = window.webglBeautyRenderer.getImageDataURL();
            originalImage.src = enhancedImage;

            if (window.state) {
                window.state.beautyEnhancedImage = enhancedImage;
            }
            console.log('[Beauty] Saved enhanced image');
        }
        exitBeautyMode();
    };
}

/**
 * Bind Beauty Control Events - Real-time WebGL Updates
 */
function bindBeautyControlEvents() {
    const renderer = window.webglBeautyRenderer;

    // Skin Smoothing - REAL-TIME
    const skinSlider = document.getElementById('skin-smooth-slider');
    if (skinSlider) {
        skinSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('skin-smooth-value').textContent = value;
            if (renderer) renderer.setParam('smoothIntensity', value);
        });
    }

    // Brightness - REAL-TIME
    const brightnessSlider = document.getElementById('brightness-slider');
    if (brightnessSlider) {
        brightnessSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('brightness-value').textContent = value;
            if (renderer) renderer.setParam('brightness', value);
        });
    }

    // Contrast - REAL-TIME
    const contrastSlider = document.getElementById('contrast-slider');
    if (contrastSlider) {
        contrastSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('contrast-value').textContent = value;
            if (renderer) renderer.setParam('contrast', value);
        });
    }

    // Lip Color - REAL-TIME
    const lipSlider = document.getElementById('lip-intensity-slider');
    const lipColor = document.getElementById('lip-color-picker');
    if (lipSlider) {
        lipSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('lip-intensity-value').textContent = value + '%';
            if (renderer) renderer.setParam('lipIntensity', value);
        });
    }
    if (lipColor) {
        lipColor.addEventListener('input', (e) => {
            if (renderer) {
                const rgb = WebGLBeautyRenderer.hexToRGB(e.target.value);
                renderer.setParam('lipColor', rgb);
            }
        });
    }

    // Blush - REAL-TIME
    const blushSlider = document.getElementById('blush-intensity-slider');
    const blushColor = document.getElementById('blush-color-picker');
    if (blushSlider) {
        blushSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('blush-intensity-value').textContent = value + '%';
            if (renderer) renderer.setParam('blushIntensity', value);
        });
    }
    if (blushColor) {
        blushColor.addEventListener('input', (e) => {
            if (renderer) {
                const rgb = WebGLBeautyRenderer.hexToRGB(e.target.value);
                renderer.setParam('blushColor', rgb);
            }
        });
    }

    // Eye Enlarge - REAL-TIME
    const eyeSlider = document.getElementById('eye-enlarge-slider');
    if (eyeSlider) {
        eyeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('eye-enlarge-value').textContent = '+' + (value - 100) + '%';
            if (renderer) {
                renderer.setParam('eyeEnlarge', value);
                renderer.applyEyeEnlarge();
            }
        });
    }

    // Reset
    const resetBtn = document.getElementById('reset-beauty-btn');
    if (resetBtn) {
        resetBtn.onclick = resetBeautyEffects;
    }
}

/**
 * Reset Beauty Effects
 */
function resetBeautyEffects() {
    // Reset sliders
    document.getElementById('skin-smooth-slider').value = 0;
    document.getElementById('skin-smooth-value').textContent = '0';
    document.getElementById('brightness-slider').value = 0;
    document.getElementById('brightness-value').textContent = '0';
    document.getElementById('contrast-slider').value = 0;
    document.getElementById('contrast-value').textContent = '0';
    document.getElementById('lip-intensity-slider').value = 0;
    document.getElementById('lip-intensity-value').textContent = '0%';
    document.getElementById('blush-intensity-slider').value = 0;
    document.getElementById('blush-intensity-value').textContent = '0%';
    document.getElementById('eye-enlarge-slider').value = 100;
    document.getElementById('eye-enlarge-value').textContent = '+0%';

    // Reset renderer
    if (window.webglBeautyRenderer) {
        window.webglBeautyRenderer.reset();
    }

    console.log('[Beauty] Effects reset');
}

// Expose functions globally
window.enterBeautyMode = enterBeautyMode;
window.exitBeautyMode = exitBeautyMode;
