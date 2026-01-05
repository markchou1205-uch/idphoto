/**
 * Hair Mask Module - Local Hair Segmentation using MediaPipe
 * 
 * Provides local hair segmentation to enhance edge quality from cloud-based removal.
 * Uses MediaPipe Selfie Segmentation for fast, accurate hair detection.
 */

// Lazy-loaded segmenter instance
let segmenter = null;
let isInitializing = false;

/**
 * Initialize MediaPipe Selfie Segmentation
 * @returns {Promise<SelfieSegmentation>} Initialized segmenter
 */
export async function initHairSegmentation() {
    if (segmenter) {
        console.log('[HairMask] Segmenter already initialized');
        return segmenter;
    }

    if (isInitializing) {
        console.log('[HairMask] Initialization in progress, waiting...');
        // Wait for initialization to complete
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (segmenter) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
        return segmenter;
    }

    isInitializing = true;
    console.time('⏱️ [HairMask] MediaPipe 初始化');

    try {
        // Dynamically import MediaPipe Selfie Segmentation
        // Robust Import Strategy: Handle various CDN export formats (ESM vs UMD vs Global)
        let SelfieSegmentationClass;

        try {
            const module = await import('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/selfie_segmentation.js');
            SelfieSegmentationClass = module.SelfieSegmentation || module.default;
        } catch (importErr) {
            console.warn('[HairMask] Dynamic import failed, trying global fallback...', importErr);
        }

        // Fallback: Check global scope (in case it loaded as a script elsewhere or import behavior attached to window)
        if (!SelfieSegmentationClass && (window.SelfieSegmentation || self.SelfieSegmentation)) {
            SelfieSegmentationClass = window.SelfieSegmentation || self.SelfieSegmentation;
        }

        if (!SelfieSegmentationClass) {
            throw new Error("Could not load SelfieSegmentation class from CDN");
        }

        segmenter = new SelfieSegmentationClass({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/${file}`;
            }
        });

        // Model selection:
        // 0 = General (256x256 input, faster, less accurate)
        // 1 = Landscape (256x144 input, better for portraits with hair)
        segmenter.setOptions({
            modelSelection: 1,
            selfieMode: false // Not a mirrored selfie
        });

        await segmenter.initialize();
        console.timeEnd('⏱️ [HairMask] MediaPipe 初始化');
        console.log('[HairMask] Segmenter initialized successfully');

        return segmenter;
    } catch (err) {
        console.error('[HairMask] Failed to initialize:', err);
        isInitializing = false;
        throw err;
    } finally {
        isInitializing = false;
    }
}

/**
 * Load image from Base64
 * @param {string} base64Image
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(base64Image) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = base64Image;
    });
}

/**
 * Downsample image to target dimensions (returns canvas)
 * @param {HTMLImageElement} img
 * @param {number} maxW
 * @param {number} maxH
 * @returns {HTMLCanvasElement}
 */
function downsampleImage(img, maxW, maxH) {
    const canvas = document.createElement('canvas');
    canvas.width = maxW;
    canvas.height = maxH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, maxW, maxH);
    return canvas;
}

/**
 * Extract hair mask from segmentation results and create a colored cutout
 * @param {ImageBitmap|ImageData} segmentationMask - Raw segmentation mask from MediaPipe (256x256)
 * @param {number} targetW - Target width (Full Res)
 * @param {number} targetH - Target height (Full Res)
 * @param {HTMLImageElement} sourceImage - Source image to colorize the mask (Full Res)
 * @returns {HTMLCanvasElement} Colored hair cutout (straight alpha, Full Res)
 */
function extractHairMask(segmentationMask, targetW, targetH, sourceImage) {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    // Enforce high-quality smoothing for upscaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Draw the Low-Res Mask to the High-Res Canvas
    // Canvas drawImage uses bilinear interpolation by default when upscaling.
    // This creates soft edges, which is DESIRABLE for hair blending.

    // Create a temp canvas for the mask to extract Alpha channel properly first
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = segmentationMask.width; // 256
    maskCanvas.height = segmentationMask.height; // 256
    const mCtx = maskCanvas.getContext('2d');
    mCtx.drawImage(segmentationMask, 0, 0);

    // Get alpha from the mask (SelfieSegmentation often puts mask in R/G/B of ImageBitmap)
    // We need to convert it to a true Alpha Mask before upscaling.

    const maskData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = maskData.data;
    for (let i = 0; i < data.length; i += 4) {
        // Assume mask value is in Red channel (SelfieSegmentation)
        const val = data[i];
        data[i + 3] = val; // Set as Alpha
        // Set RGB to Black so it doesn't bleed color, though source-in ignores dest color
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
    }
    mCtx.putImageData(maskData, 0, 0);

    // 2. Draw Upscaled Alpha Mask to Target Canvas (Scaling happens here)
    // [Optimized] Use Bilinear Interpolation + Micro Blur for anti-aliased base.
    ctx.filter = 'blur(0.5px)'; // [User Request] 0.5px Pre-multiplied Blur for natural edge fusion
    ctx.drawImage(maskCanvas, 0, 0, targetW, targetH);
    ctx.filter = 'none';

    // [User Request] 3-Stage Alpha Ramp (Anti-aliased Sharpness)
    // Replace Binary Threshold with a smooth gradient slope.
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const pixels = imageData.data;

    // Threshold set to 180 (approx ~70% opacity)
    // This effectively ERODES the mask because only the core opaque centers survive.
    // Anything semi-transparent (edges/fog) is cut to 0.
    // Formula:
    // Alpha < 100 -> 0 (Erosion/Clean)
    // Alpha > 200 -> 255 (Solid Core)
    // Alpha 100-200 -> Linear interpolation (Scale 2.55x)
    for (let i = 3; i < pixels.length; i += 4) {
        let alpha = pixels[i];

        if (alpha < 100) {
            alpha = 0;
        } else if (alpha > 200) {
            alpha = 255;
        } else {
            alpha = (alpha - 100) * 2.55;
        }
        pixels[i] = alpha;
    }
    ctx.putImageData(imageData, 0, 0);

    // 3. Composite High-Res Source Image 'source-in'
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(sourceImage, 0, 0, targetW, targetH);
    ctx.globalCompositeOperation = 'source-over';

    return canvas;
}

/**
 * Detect hair mask from image (local processing)
 * @param {string} base64Image - Base64 image data
 * @returns {Promise<HTMLCanvasElement|null>} Hair mask canvas or null on failure
 */
export async function detectHairMaskLocal(base64Image) {
    console.time('⏱️ [HairMask] 本地頭髮分割');

    try {
        // Step 1: Load Full Image
        const fullImg = await loadImage(base64Image);

        // Step 2: Downsample for Logic
        const smallCanvas = downsampleImage(fullImg, 256, 256);
        console.log('[HairMask] Image downsampled to 256x256');

        // Step 3: Initialize segmenter
        const seg = await initHairSegmentation();

        // Step 4: Run segmentation
        console.time('⏱️ [HairMask] MediaPipe 分割運算');

        let maskCanvas = null;

        await new Promise((resolve, reject) => {
            seg.reset();
            seg.onResults((results) => {
                try {
                    // Extract using Full Resolution Source
                    maskCanvas = extractHairMask(
                        results.segmentationMask,
                        fullImg.width,
                        fullImg.height,
                        fullImg
                    );
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
            seg.send({ image: smallCanvas }).catch(reject);
        });

        console.timeEnd('⏱️ [HairMask] MediaPipe 分割運算');

        // Step 5: Validate extraction
        if (!maskCanvas) {
            console.warn('[HairMask] No mask returned from extraction');
            return null;
        }

        console.log(`[HairMask] Hair mask extracted (High Res: ${maskCanvas.width}x${maskCanvas.height})`);
        console.timeEnd('⏱️ [HairMask] 本地頭髮分割');
        return maskCanvas;

    } catch (err) {
        console.error('[HairMask] Detection failed:', err);
        console.timeEnd('⏱️ [HairMask] 本地頭髮分割');
        return null; // Graceful degradation
    }
}

/**
 * Preload MediaPipe model (call during page load)
 * @returns {Promise<void>}
 */
export async function preloadHairSegmentation() {
    try {
        await initHairSegmentation();
        console.log('[HairMask] Model preloaded successfully');
    } catch (err) {
        console.warn('[HairMask] Preload failed (will retry on first use):', err);
    }
}
