/**
 * Background Modal Enhancement
 * Starts Modal processing without blocking user experience
 * Updates image quality silently when complete
 */
async function enhanceInBackground(utilizedImage, compressedBase64) {
    console.log('[Background] Starting Modal enhancement (non-blocking)...');
    console.time('[Background] Modal Processing');

    try {
        const enhancedImage = await enhanceHairWithModal(compressedBase64);
        console.timeEnd('[Background] Modal Processing');

        if (enhancedImage) {
            console.log('[Background] ✅ Enhancement successful');

            // Store enhanced image for future use
            if (window.state) {
                window.state.modalEnhancedImage = enhancedImage;
                window.state.hasModalEnhancement = true;
            }

            // Silent update if user is still viewing the result
            if (isCurrentlyViewingResult()) {
                await updateImageSilently(enhancedImage);
            }

            return enhancedImage;
        } else {
            console.log('[Background] ⚠️ Enhancement returned null');
            return null;
        }
    } catch (error) {
        console.error('[Background] ❌ Enhancement failed:', error);
        console.timeEnd('[Background] Modal Processing');
        return null;
    }
}

/**
 * Check if user is still viewing the result page
 */
function isCurrentlyViewingResult() {
    const resultWrapper = document.getElementById('result-wrapper');
    return resultWrapper && resultWrapper.style.display !== 'none';
}

/**
 * Silently update the displayed image with Modal-enhanced version
 */
async function updateImageSilently(enhancedImage) {
    console.log('[Silent Update] 🎨 Modal處理完成，準備更新顯示圖片...');

    try {
        // Find the actual displayed image element
        const img = document.getElementById('main-preview-img');  // Fixed: was 'photo-result-img'

        if (!img) {
            console.warn('[Silent Update] ⚠️ 找不到main-preview-img元素，無法更新');
            console.log('[Silent Update] Current DOM:', document.getElementById('image-wrapper'));
            return;
        }

        console.log('[Silent Update] ✅ 找到圖片元素，準備更新...');
        console.log('[Silent Update] Current src length:', img.src.length);

        // Store Modal enhanced image globally for future recompose
        if (window.state) {
            window.state.modalEnhancedBlob = enhancedImage;
        }

        // Convert Blob to base64 for direct display update
        const reader = new FileReader();
        reader.onload = function (e) {
            const oldSrc = img.src;
            img.src = e.target.result;
            console.log('[Silent Update] ✨ 圖片已更新！');
            console.log('[Silent Update] New src length:', img.src.length);
            console.log('[Silent Update] Changed:', oldSrc !== img.src);

            // Optional: Show notification
            showUpgradeNotification();
        };
        reader.readAsDataURL(enhancedImage);

    } catch (error) {
        console.error('[Silent Update] ❌ 更新失敗:', error);
    }
}

/**
 * Show subtle notification that quality has been upgraded
 */
function showUpgradeNotification() {
    // Optional: Add a subtle toast notification
    // For now, just console log
    console.log('🎨 Image quality has been upgraded with AI enhancement');
}

// Expose functions globally for api.js
window.enhanceInBackground = enhanceInBackground;
