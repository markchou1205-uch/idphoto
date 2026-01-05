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
        const { SelfieSegmentation } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/selfie_segmentation.js');

        segmenter = new SelfieSegmentation({
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
 * Downsample image to target dimensions
 * @param {string} base64Image - Base64 image data
 * @param {number} maxW - Maximum width
 * @param {number} maxH - Maximum height
 * @returns {Promise<HTMLCanvasElement>} Downsampled canvas
 */
function downsampleImage(base64Image, maxW, maxH) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = maxW;
            canvas.height = maxH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, maxW, maxH);
            resolve(canvas);
        };
        img.onerror = reject;
        img.src = base64Image;
    });
}

/**
 * Extract hair mask from segmentation results
 * @param {ImageData} segmentationMask - Raw segmentation mask from MediaPipe
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {HTMLCanvasElement} Hair mask canvas (grayscale alpha)
 */
function extractHairMask(segmentationMask, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // MediaPipe returns a mask where:
    // - High values (255) = person/hair
    // - Low values (0) = background

    // Create RGBA image data
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < segmentationMask.data.length; i++) {
        const maskValue = segmentationMask.data[i];
        const idx = i * 4;

        // Set RGB to white, alpha to mask value
        data[idx] = 255;     // R
        data[idx + 1] = 255; // G
        data[idx + 2] = 255; // B
        data[idx + 3] = maskValue; // A (0-255)
    }

    ctx.putImageData(imageData, 0, 0);
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
        // Step 1: Downsample to 256x256 for fast processing
        const smallCanvas = await downsampleImage(base64Image, 256, 256);
        console.log('[HairMask] Image downsampled to 256x256');

        // Step 2: Initialize segmenter (or reuse existing)
        const seg = await initHairSegmentation();

        // Step 3: Run segmentation
        console.time('⏱️ [HairMask] MediaPipe 分割運算');
        const results = await new Promise((resolve, reject) => {
            seg.onResults(resolve);
            seg.send({ image: smallCanvas }).catch(reject);
        });
        console.timeEnd('⏱️ [HairMask] MediaPipe 分割運算');

        // Step 4: Extract hair mask
        const maskCanvas = extractHairMask(results.segmentationMask, 256, 256);
        console.log('[HairMask] Hair mask extracted');

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
