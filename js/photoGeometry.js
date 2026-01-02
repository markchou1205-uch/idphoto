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

    // --- HARD FIX FOR ASPECT RATIO MISMATCH ---
    // If Vercel output is 750x1000, the ratio is 0.75.
    const currentImgW = (750 / 1000) * currentImgH;

    // 1. Calculate Eye-to-Top Ratio
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_Pct = (eyeMidY_Global - cropRect.y) / cropRect.h;
    const topY_Pct = topY_Resized / currentImgH;
    const eyeToTop_Pct = eyeMidY_Pct - topY_Pct; // Relative to current image

    // 2. FORCE SCALE: We want (eyeToTop_Pct * currentImgH * scale) = 201px (half of 3.4cm)
    // This anchors ONLY on the eyes and hair-top, completely ignoring the collar/chin.
    const finalScale = 201 / (eyeToTop_Pct * currentImgH);

    // 3. Centering & Positioning
    // Adjust the Return Values: Use a smaller top margin to "lift" the head up.
    // User requested lifting from 50 to 35.
    const calculatedY = 35 - (topY_Pct * currentImgH * finalScale);
    const calculatedX = (413 - (currentImgW * finalScale)) / 2;

    console.log(`[ANCHOR FIX] finalScale: ${finalScale.toFixed(4)}, X: ${calculatedX.toFixed(1)}, Y: ${calculatedY.toFixed(1)}`);

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
            topY_Pct: topY_Pct
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
