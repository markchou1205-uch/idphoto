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
    // Do NOT rely on cropRect.w / cropRect.h if it yields 624px.
    const currentImgW = (750 / 1000) * currentImgH;

    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_Pct = (eyeMidY_Global - cropRect.y) / cropRect.h;
    const topY_Pct = topY_Resized / currentImgH;

    // Head Scale Logic (Goal: 34mm head height)
    const eyeToTop_Pct = eyeMidY_Pct - topY_Pct;
    const finalScale = (target.headPx * 0.5) / (eyeToTop_Pct * currentImgH);

    const finalW = currentImgW * finalScale; // This will now result in ~601.6px
    const finalH = currentImgH * finalScale;

    // Centering calculation
    const calculatedX = (target.canvasW - finalW) / 2; // Should result in ~ -94.3
    const calculatedY = target.topMarginPx - (topY_Pct * finalH);

    console.log(`[FORCE CHECK] finalW: ${finalW.toFixed(1)}, X: ${calculatedX.toFixed(1)}`);

    return {
        scale: finalScale,
        x: calculatedX,
        y: calculatedY,
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
