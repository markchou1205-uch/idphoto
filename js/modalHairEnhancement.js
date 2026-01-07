/**
 * Modal Auto Hair Enhancement Integration
 * 
 * This module provides hair segmentation enhancement using Modal's GPU service
 */

// Modal API configuration
const MODAL_WEBHOOK_URL = 'https://markchou1205-uch--hair-api.modal.run';

/**
 * Enhance hair segmentation using Modal Auto Hair
 * @param {string|Blob} transparentImage - Transparent image (base64 or Blob)
 * @returns {Promise<Blob>} - Enhanced image as Blob
 */
async function enhanceHairWithModal(transparentImage) {
    console.log("[Modal] 🚀 Starting Auto Hair enhancement...");
    console.time("[Modal] Total Processing Time");

    try {
        // Convert to base64 if Blob
        let imageB64;
        if (transparentImage instanceof Blob) {
            imageB64 = await blobToBase64(transparentImage);
        } else {
            imageB64 = transparentImage;
        }

        // Remove data URL prefix for cleaner transmission
        let cleanB64 = imageB64;
        if (imageB64.includes('base64,')) {
            cleanB64 = imageB64.split('base64,')[1];
        }

        // Call Modal API with timeout
        console.log('[Modal] Calling Modal webhook...');

        // 60s timeout for cold start (first call may take 40-50s)
        // Subsequent calls will be much faster (15-20s) with warm container
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        console.time("⏱️ [Modal] Network Request");
        const response = await fetch(MODAL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: cleanB64 }),
            signal: controller.signal  // 添加這行
        });
        clearTimeout(timeoutId);  // 添加這行
        console.timeEnd("⏱️ [Modal] Network Request");

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Modal] HTTP Error:', response.status);
            throw new Error(`Modal API error (${response.status}): ${errorText}`);
        }

        console.time("      ⏱️ [Modal] JSON Parsing");
        const result = await response.json();
        console.timeEnd("      ⏱️ [Modal] JSON Parsing");
        console.timeEnd("[Modal] Total Processing Time");

        // Check success
        if (!result.success) {
            throw new Error(result.error || 'Unknown error from Modal');
        }

        // Log performance metrics
        console.log("[Modal] ✅ Enhancement successful!");
        console.log("[Modal] Processing breakdown:", result.timings);
        console.log("[Modal] Image size:", result.size);

        // Convert enhanced image back to Blob for compatibility
        console.time("      ⏱️ [Modal] Base64→Blob Conversion");
        // Backend now returns pure Base64, add data URL prefix
        const enhancedB64 = `data:image/png;base64,${result.refined_image}`;
        const enhancedBlob = safeBase64ToBlob(enhancedB64);
        console.timeEnd("      ⏱️ [Modal] Base64→Blob Conversion");

        // Track usage for monitoring
        const timeSec = parseFloat(result.timings.total.replace('s', ''));
        // Assuming 'timestamp' is defined elsewhere or intended to be added.
        // For now, adding a placeholder for timestamp if it's not provided by the user's context.
        // If 'timestamp' is meant to be a new Date().getTime(), it should be added before this line.
        const timestamp = new Date().getTime(); // Added for completeness based on the requested change
        trackModalUsage(timestamp, timeSec);

        return enhancedBlob;

    } catch (error) {
        console.error("[Modal] ❌ Auto Hair enhancement failed:", error);
        console.timeEnd("[Modal] Total Processing Time");

        // Graceful degradation - return original image
        console.warn("[Modal] Falling back to original image");
        return transparentImage;
    }
}

/**
 * Convert Blob to base64 string
 */
async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Robust Base64 to Blob conversion with error handling
 * Handles various Base64 formats and encoding issues
 */
function safeBase64ToBlob(base64, mimeType = 'image/png') {
    try {
        // 1. Force remove possible Data URL prefix
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");

        // 2. Handle newlines and whitespace in encoding
        const normalizedBase64 = cleanBase64.replace(/\s/g, "");

        // 3. Add Base64 padding characters (=) if missing
        const paddedBase64 = normalizedBase64.padEnd(
            normalizedBase64.length + (4 - normalizedBase64.length % 4) % 4, '='
        );

        const byteCharacters = atob(paddedBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    } catch (e) {
        console.error("[Modal Fix] Base64 Decoding failed:", e);
        throw e;
    }
}

/**
 * Check if Modal service is available
 * @returns {Promise<boolean>}
 */
async function checkModalHealth() {
    try {
        const healthUrl = MODAL_WEBHOOK_URL.replace('hair-api', 'health');
        const response = await fetch(healthUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)  // 5s timeout
        });

        if (response.ok) {
            const data = await response.json();
            console.log("[Modal] Health check:", data);
            return true;
        }
        return false;
    } catch (error) {
        console.warn("[Modal] Health check failed:", error.message);
        return false;
    }
}


/**
 * Track Modal usage for cost monitoring
 */
let modalStats = {
    callCount: 0,
    totalTime: 0,
    totalCost: 0
};

function trackModalUsage(processingTime) {
    // T4 GPU pricing: $0.000164/second
    const COST_PER_SECOND = 0.000164;

    modalStats.callCount++;
    modalStats.totalTime += processingTime;
    modalStats.totalCost = modalStats.totalTime * COST_PER_SECOND;

    console.log(`[Modal Stats] Calls: ${modalStats.callCount}, Total Time: ${modalStats.totalTime.toFixed(2)}s, Est. Cost: $${modalStats.totalCost.toFixed(4)}`);
}

/**
 * Get Modal usage statistics
 * @returns {Object} Usage stats
 */
function getModalStats() {
    return {
        ...modalStats,
        avgTimePerCall: modalStats.callCount > 0 ? (modalStats.totalTime / modalStats.callCount).toFixed(2) : 0,
        costPerCall: modalStats.callCount > 0 ? (modalStats.totalCost / modalStats.callCount).toFixed(6) : 0
    };
}

/**
 * Reset Modal statistics
 */
function resetModalStats() {
    modalStats = {
        callCount: 0,
        totalTime: 0,
        totalCost: 0
    };
}

// Expose functions globally
window.enhanceHairWithModal = enhanceHairWithModal;
window.checkModalHealth = checkModalHealth;
window.getModalStats = getModalStats;
window.resetModalStats = resetModalStats;