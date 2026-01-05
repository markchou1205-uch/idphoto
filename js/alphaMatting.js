/**
 * Alpha Matting Module - Edge Refinement for Hair Segmentation
 * 
 * Implements alpha matting techniques to smooth harsh edges from cloud-based background removal.
 * Uses dilate, feather (Gaussian blur), and blend composition to create natural hair edges.
 */

/**
 * Load image from various sources (URL, Blob, Base64)
 * @param {string|Blob} source - Image source
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(source) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;

        if (source instanceof Blob) {
            img.src = URL.createObjectURL(source);
        } else {
            img.src = source;
        }
    });
}

/**
 * Scale canvas to new dimensions
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas
 * @param {number} targetW - Target width
 * @param {number} targetH - Target height
 * @returns {HTMLCanvasElement} Scaled canvas
 */
function scaleCanvas(sourceCanvas, targetW, targetH) {
    const scaled = document.createElement('canvas');
    scaled.width = targetW;
    scaled.height = targetH;
    const ctx = scaled.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0, targetW, targetH);
    return scaled;
}

/**
 * Dilate mask (expand edges outward)
 * @param {HTMLCanvasElement} maskCanvas - Input mask canvas
 * @param {number} radius - Dilation radius in pixels (default: 2.5)
 * @returns {HTMLCanvasElement} Dilated mask canvas
 */
function dilateMask(maskCanvas, radius = 2.5) {
    console.time('⏱️ [AlphaMatting] 擴張遮罩');

    const canvas = document.createElement('canvas');
    canvas.width = maskCanvas.width;
    canvas.height = maskCanvas.height;
    const ctx = canvas.getContext('2d');

    // Simple implementation: draw mask multiple times with slight offsets
    // This creates a dilation effect
    const iterations = Math.ceil(radius);
    const step = radius / iterations;

    ctx.globalAlpha = 1.0 / iterations;
    for (let i = 0; i < iterations; i++) {
        const offset = i * step;
        // Draw at 8 surrounding positions to dilate in all directions
        ctx.drawImage(maskCanvas, -offset, 0);
        ctx.drawImage(maskCanvas, offset, 0);
        ctx.drawImage(maskCanvas, 0, -offset);
        ctx.drawImage(maskCanvas, 0, offset);
        ctx.drawImage(maskCanvas, -offset, -offset);
        ctx.drawImage(maskCanvas, offset, -offset);
        ctx.drawImage(maskCanvas, -offset, offset);
        ctx.drawImage(maskCanvas, offset, offset);
    }
    ctx.globalAlpha = 1.0;

    // Draw center one more time to strengthen
    ctx.drawImage(maskCanvas, 0, 0);

    console.timeEnd('⏱️ [AlphaMatting] 擴張遮罩');
    return canvas;
}

/**
 * Apply Gaussian Blur to mask (feathering)
 * @param {HTMLCanvasElement} maskCanvas - Input mask canvas
 * @param {number} radius - Blur radius in pixels (default: 1.0)
 * @returns {HTMLCanvasElement} Blurred mask canvas
 */
function applyGaussianBlur(maskCanvas, radius = 1.0) {
    console.time('⏱️ [AlphaMatting] 羽化處理');

    const canvas = document.createElement('canvas');
    canvas.width = maskCanvas.width;
    canvas.height = maskCanvas.height;
    const ctx = canvas.getContext('2d');

    // Use built-in canvas blur filter
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.filter = 'none';

    console.timeEnd('⏱️ [AlphaMatting] 羽化處理');
    return canvas;
}

/**
 * Apply alpha matting to enhance hair edges
 * @param {Blob|string} vercelBlob - Background-removed image from Vercel API
 * @param {HTMLCanvasElement} hairMask - Hair mask from local segmentation (256x256)
 * @param {string} originalImage - Original image base64
 * @returns {Promise<string>} Enhanced image as base64
 */
export async function applyAlphaMatting(vercelBlob, hairMask, originalImage) {
    console.time('⏱️ [AlphaMatting] 總處理時間');

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Step 1: Load resources
        console.log('[AlphaMatting] Loading images...');
        const [vercelImg, originalImg] = await Promise.all([
            loadImage(vercelBlob),
            loadImage(originalImage)
        ]);

        canvas.width = vercelImg.width;
        canvas.height = vercelImg.height;

        // Step 2: Scale hairMask to match canvas size
        console.log('[AlphaMatting] Scaling hair mask...');
        const scaledMask = scaleCanvas(hairMask, canvas.width, canvas.height);

        // Step 3: Dilate mask edges (expand by 2-3px)
        console.log('[AlphaMatting] Dilating mask...');
        const dilatedMask = dilateMask(scaledMask, 2.5);

        // Step 4: Feather edges (Gaussian blur 0.8-1.2px)
        console.log('[AlphaMatting] Feathering edges...');
        const featheredMask = applyGaussianBlur(dilatedMask, 1.0);

        // Step 5: Composite rendering
        console.time('⏱️ [AlphaMatting] 混合渲染');

        // Base layer: Vercel background removal
        ctx.drawImage(vercelImg, 0, 0);

        // Add original hair details (30% opacity for subtle enhancement)
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.3;
        ctx.drawImage(originalImg, 0, 0);

        // Apply feathered mask to blend smoothly
        ctx.globalCompositeOperation = 'destination-in';
        ctx.globalAlpha = 1.0;
        ctx.drawImage(featheredMask, 0, 0);

        console.timeEnd('⏱️ [AlphaMatting] 混合渲染');
        console.timeEnd('⏱️ [AlphaMatting] 總處理時間');

        // Return as PNG with transparency
        return canvas.toDataURL('image/png');

    } catch (err) {
        console.error('[AlphaMatting] Processing failed:', err);
        console.timeEnd('⏱️ [AlphaMatting] 總處理時間');
        // Return original Vercel result on failure
        if (typeof vercelBlob === 'string') {
            return vercelBlob;
        } else {
            return URL.createObjectURL(vercelBlob);
        }
    }
}

/**
 * Simple version without original image blending (for testing)
 * @param {Blob|string} vercelBlob - Background-removed image
 * @param {HTMLCanvasElement} hairMask - Hair mask
 * @returns {Promise<string>} Enhanced image
 */
export async function applySimpleEdgeRefinement(vercelBlob, hairMask) {
    try {
        const vercelImg = await loadImage(vercelBlob);
        const canvas = document.createElement('canvas');
        canvas.width = vercelImg.width;
        canvas.height = vercelImg.height;
        const ctx = canvas.getContext('2d');

        // Scale and feather mask
        const scaledMask = scaleCanvas(hairMask, canvas.width, canvas.height);
        const dilatedMask = dilateMask(scaledMask, 2.5);
        const featheredMask = applyGaussianBlur(dilatedMask, 1.0);

        // Apply mask
        ctx.drawImage(vercelImg, 0, 0);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(featheredMask, 0, 0);

        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error('[AlphaMatting] Simple refinement failed:', err);
        return typeof vercelBlob === 'string' ? vercelBlob : URL.createObjectURL(vercelBlob);
    }
}
