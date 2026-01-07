/**
 * Edge Smoothing Module - Advanced Alpha Channel Processing
 * 
 * Provides professional-grade edge smoothing for ID photos through:
 * 1. Morphological operations (erosion + dilation)
 * 2. Gradient-based feathering
 * 3. Bilateral filtering (edge-aware smoothing)
 */

/**
 * Apply morphological erosion to alpha channel
 * Removes stray pixels and noise
 * @param {ImageData} imageData 
 * @param {number} radius - Erosion radius (1-2px recommended)
 * @returns {ImageData}
 */
function erodeAlpha(imageData, radius = 1) {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const idx = (y * width + x) * 4;
            const alpha = data[idx + 3];

            if (alpha === 0) continue; // Skip transparent pixels

            // Check neighborhood - if any neighbor is transparent, reduce current alpha
            let minAlpha = alpha;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nIdx = ((y + dy) * width + (x + dx)) * 4;
                    const nAlpha = data[nIdx + 3];
                    minAlpha = Math.min(minAlpha, nAlpha);
                }
            }

            output[idx + 3] = minAlpha;
        }
    }

    const result = new ImageData(width, height);
    result.data.set(output);
    return result;
}

/**
 * Apply morphological dilation to alpha channel
 * Expands edges and smooths boundaries
 * @param {ImageData} imageData 
 * @param {number} radius - Dilation radius (2-3px recommended)
 * @returns {ImageData}
 */
function dilateAlpha(imageData, radius = 2) {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const idx = (y * width + x) * 4;
            const alpha = data[idx + 3];

            if (alpha === 255) continue; // Skip fully opaque pixels

            // Check neighborhood - take maximum alpha
            let maxAlpha = alpha;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nIdx = ((y + dy) * width + (x + dx)) * 4;
                    const nAlpha = data[nIdx + 3];
                    maxAlpha = Math.max(maxAlpha, nAlpha);
                }
            }

            output[idx + 3] = maxAlpha;
        }
    }

    const result = new ImageData(width, height);
    result.data.set(output);
    return result;
}

/**
 * Apply Gaussian blur to alpha channel only
 * Creates smooth transitions at edges
 * @param {ImageData} imageData 
 * @param {number} radius - Blur radius (1-3px recommended)
 * @returns {ImageData}
 */
function gaussianBlurAlpha(imageData, radius = 2) {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    // Generate Gaussian kernel
    const kernelSize = radius * 2 + 1;
    const kernel = [];
    let kernelSum = 0;
    const sigma = radius / 2;

    for (let i = 0; i < kernelSize; i++) {
        const x = i - radius;
        const val = Math.exp(-(x * x) / (2 * sigma * sigma));
        kernel.push(val);
        kernelSum += val;
    }

    // Normalize kernel
    for (let i = 0; i < kernelSize; i++) {
        kernel[i] /= kernelSum;
    }

    // Horizontal pass
    const temp = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let i = 0; i < kernelSize; i++) {
                const sx = x + i - radius;
                if (sx >= 0 && sx < width) {
                    const idx = (y * width + sx) * 4;
                    sum += data[idx + 3] * kernel[i];
                }
            }
            const idx = (y * width + x) * 4;
            temp[idx + 3] = sum;
        }
    }

    // Vertical pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let i = 0; i < kernelSize; i++) {
                const sy = y + i - radius;
                if (sy >= 0 && sy < height) {
                    const idx = (sy * width + x) * 4;
                    sum += temp[idx + 3] * kernel[i];
                }
            }
            const idx = (y * width + x) * 4;
            output[idx + 3] = Math.round(sum);
        }
    }

    const result = new ImageData(width, height);
    result.data.set(output);
    return result;
}

/**
 * Apply feathering to edge pixels
 * Creates natural gradient transition at boundaries
 * @param {ImageData} imageData 
 * @param {number} featherWidth - Width of feather zone in pixels (3-5px recommended)
 * @returns {ImageData}
 */
function featherEdges(imageData, featherWidth = 4) {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    // Detect edges (pixels in alpha transition zone)
    for (let y = featherWidth; y < height - featherWidth; y++) {
        for (let x = featherWidth; x < width - featherWidth; x++) {
            const idx = (y * width + x) * 4;
            const alpha = data[idx + 3];

            // Only process semi-transparent pixels (edge zone)
            if (alpha > 10 && alpha < 240) {
                // Calculate distance to nearest solid pixel
                let minDist = featherWidth;

                for (let dy = -featherWidth; dy <= featherWidth; dy++) {
                    for (let dx = -featherWidth; dx <= featherWidth; dx++) {
                        const nIdx = ((y + dy) * width + (x + dx)) * 4;
                        const nAlpha = data[nIdx + 3];

                        if (nAlpha >= 240) {
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            minDist = Math.min(minDist, dist);
                        }
                    }
                }

                // Apply smoothstep gradient
                const t = Math.min(1, minDist / featherWidth);
                const smoothT = t * t * (3 - 2 * t); // Smoothstep function
                output[idx + 3] = Math.round(alpha * (1 - smoothT * 0.3));
            }
        }
    }

    const result = new ImageData(width, height);
    result.data.set(output);
    return result;
}

/**
 * Apply bilateral filter to alpha channel
 * Edge-aware smoothing that preserves sharp boundaries while removing noise
 * @param {ImageData} imageData 
 * @param {Object} options - Filter parameters
 * @returns {ImageData}
 */
function bilateralFilterAlpha(imageData, options = {}) {
    const {
        spatialSigma = 2,    // Spatial influence
        intensitySigma = 30  // Intensity similarity threshold
    } = options;

    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);
    const radius = Math.ceil(spatialSigma * 2);

    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const idx = (y * width + x) * 4;
            const centerAlpha = data[idx + 3];

            if (centerAlpha === 0 || centerAlpha === 255) {
                continue; // Skip fully transparent or opaque pixels
            }

            let totalWeight = 0;
            let totalAlpha = 0;

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nIdx = ((y + dy) * width + (x + dx)) * 4;
                    const nAlpha = data[nIdx + 3];

                    // Spatial distance weight (Gaussian)
                    const spatialDist = dx * dx + dy * dy;
                    const spatialWeight = Math.exp(-spatialDist / (2 * spatialSigma * spatialSigma));

                    // Intensity similarity weight
                    const intensityDiff = centerAlpha - nAlpha;
                    const intensityWeight = Math.exp(-(intensityDiff * intensityDiff) / (2 * intensitySigma * intensitySigma));

                    const weight = spatialWeight * intensityWeight;
                    totalWeight += weight;
                    totalAlpha += nAlpha * weight;
                }
            }

            output[idx + 3] = Math.round(totalAlpha / totalWeight);
        }
    }

    const result = new ImageData(width, height);
    result.data.set(output);
    return result;
}

/**
 * Main edge smoothing pipeline
 * Applies all processing stages in sequence
 * @param {HTMLCanvasElement|HTMLImageElement} source - Source image/canvas
 * @param {Object} options - Processing options
 * @returns {HTMLCanvasElement} Smoothed result
 */
export function smoothEdges(source, options = {}) {
    const {
        erosionRadius = 1,
        dilationRadius = 2,
        featherWidth = 4,
        gaussianRadius = 2,
        bilateralSpatial = 2,
        bilateralIntensity = 30,
        enableMorphology = true,
        enableFeathering = true,
        enableBilateral = true
    } = options;

    console.time('⏱️ [Edge Smoothing Pipeline]');

    // Create working canvas
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0);

    // Extract ImageData
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Stage 1: Morphological Operations (Clean up noise)
    if (enableMorphology) {
        console.time('  ⏱️ [Morphological Ops]');
        imageData = erodeAlpha(imageData, erosionRadius);
        imageData = dilateAlpha(imageData, dilationRadius);
        console.timeEnd('  ⏱️ [Morphological Ops]');
    }

    // Stage 2: Gaussian Blur (Pre-smoothing)
    console.time('  ⏱️ [Gaussian Blur]');
    imageData = gaussianBlurAlpha(imageData, gaussianRadius);
    console.timeEnd('  ⏱️ [Gaussian Blur]');

    // Stage 3: Feathering (Natural transitions)
    if (enableFeathering) {
        console.time('  ⏱️ [Feathering]');
        imageData = featherEdges(imageData, featherWidth);
        console.timeEnd('  ⏱️ [Feathering]');
    }

    // Stage 4: Bilateral Filter (Edge-aware smoothing)
    if (enableBilateral) {
        console.time('  ⏱️ [Bilateral Filter]');
        imageData = bilateralFilterAlpha(imageData, {
            spatialSigma: bilateralSpatial,
            intensitySigma: bilateralIntensity
        });
        console.timeEnd('  ⏱️ [Bilateral Filter]');
    }

    // Put processed data back to canvas
    ctx.putImageData(imageData, 0, 0);

    console.timeEnd('⏱️ [Edge Smoothing Pipeline]');
    console.log('[Edge Smoothing] Processing complete');

    return canvas;
}

/**
 * Quick edge smooth (lighter processing for preview)
 * @param {HTMLCanvasElement|HTMLImageElement} source 
 * @returns {HTMLCanvasElement}
 */
export function quickSmoothEdges(source) {
    return smoothEdges(source, {
        erosionRadius: 0,
        dilationRadius: 1,
        featherWidth: 3,
        gaussianRadius: 1.5,
        enableMorphology: false,
        enableFeathering: false,
        enableBilateral: false
    });
}
