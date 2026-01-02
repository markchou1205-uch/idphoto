// js/photoGeometry.js - COORDINATE SYSTEM FIX
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

/**
 * OFFICIAL SSOT GEOMETRY ENGINE - COORDINATE SYSTEM SYNCHRONIZED
 * Critical Fix: Both topY and eyeMid must be in the SAME coordinate system
 */
export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config) {
    const target = { canvasW: 413, canvasH: 531, headPx: 402, topMarginPx: 50 };

    // --- PHYSICAL PIXEL LOCKING ---
    // Goal: Force "Pupil to Hair Top" to be exactly 212px.
    // This results in a visual head size of ~34.5mm, ignoring chin/collar issues.

    // 1. Calculate positions in Source (Vercel) coordinates
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    // Map eye to the Vercel 1000px coordinate system
    // cropRect.h is the height of the crop box in the original image
    const eyeMidY_In_Source = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);
    const topY_In_Source = topY_Resized;

    // 2. Measure Source Segment
    const eyeToTop_Px_In_Source = eyeMidY_In_Source - topY_In_Source;

    // 3. FORCE SCALE: This segment MUST be 212px on the final canvas.
    const finalScale = 212 / eyeToTop_Px_In_Source;

    // 4. Absolute Canvas Centering
    // Hard assumed aspect ratio 0.75 (750x1000) for width calculation
    const drawnWidth = (750 * (currentImgH / 1000)) * finalScale;
    const drawnHeight = currentImgH * finalScale;

    // 5. Positioning
    // Fix hair top at 45px (approx 3.8mm)
    const calculatedY = 45 - (topY_In_Source * finalScale);
    const calculatedX = (413 - drawnWidth) / 2; // Absolute center

    console.log(`[PIXEL LOCK] Scale: ${finalScale.toFixed(4)}, EyeToTop(212px), X: ${calculatedX.toFixed(1)}, Y: ${calculatedY.toFixed(1)}`);

    return {
        scale: finalScale,
        y: calculatedY,
        x: calculatedX,
        canvasW: target.canvasW,
        canvasH: target.canvasH,
        config: {
            TOP_MARGIN_PX: target.topMarginPx,
            TARGET_HEAD_PX: target.headPx,
            CANVAS_W: target.canvasW,
            CANVAS_H: target.canvasH
        },
        debug: {
            topY_Pct: topY_In_Source / currentImgH
        }
    };
}

// 2. 影像濾鏡預設值 (標準化輸出)
export const IMAGE_PRESETS = {
    DEFAULT_BRIGHTNESS: 1.05, // 預設提亮 5%
    DEFAULT_CONTRAST: 0.92,   // 預設調降對比 8% 以淡化陰影
    DEFAULT_SATURATION: 1.05  // 微增飽和度讓氣色較好
};

// Legacy shim if requested, though api.js should be updated.
export function getSpecDims(spec) { return {}; }
