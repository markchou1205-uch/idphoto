// js/photoGeometry.js - COORDINATE SYSTEM FIX
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

/**
 * OFFICIAL SSOT GEOMETRY ENGINE - COORDINATE SYSTEM SYNCHRONIZED
 * Critical Fix: Both topY and eyeMid must be in the SAME coordinate system
 */
export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config) {
    const DPI = 300;
    const MM_TO_PX = DPI / 25.4;

    const target = {
        canvasW: 413,
        canvasH: 531,
        headPx: 402, // 3.4cm
        topMarginPx: 50 // 0.42cm
    };

    // 1. Normalize based on strict Original Crop Resolution
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_Pct = (eyeMidY_Global - cropRect.y) / cropRect.h;

    // 2. Normalize topY based on the ACTUAL height of the blob processed by Vercel
    const topY_Pct = topY_Resized / currentImgH;

    // 3. NEW ANCHOR: Eye-to-Top (Robust Scaling)
    // Goal: Ensure 3.4cm (402px) head size by ignoring the collar/chin line.
    // We define that (Eye to Top) is exactly 50% (0.50) of the target 3.4cm.
    // This forces the head to be large enough regardless of what the collar looks like.
    const eyeToTop_Pct = eyeMidY_Pct - topY_Pct;

    // We want 1.7cm (50% of 3.4cm) from eyes to top
    // Target Head Px = 402. Target Eye-to-Top = 201.
    const targetEyeToTopPx = target.headPx * 0.50;

    // 4. CRITICAL SCALE CALCULATION
    const finalScale = targetEyeToTopPx / (eyeToTop_Pct * currentImgH);

    // 5. Centering Logic (ABSOLUTE ALIGNMENT FIX)
    const drawnWidth = (currentImgH * (cropRect.w / cropRect.h)) * finalScale;
    const drawnHeight = currentImgH * finalScale;

    // DO NOT USE PERCENTAGE-BASED OFFSETS FOR X/Y. USE ABSOLUTE CENTERING.
    const calculatedY = target.topMarginPx - (topY_Pct * drawnHeight);
    const calculatedX = (target.canvasW - drawnWidth) / 2;

    console.log(`[Final Output Check] Drawing at X: ${calculatedX.toFixed(1)}, Y: ${calculatedY.toFixed(1)}`);

    return {
        scale: finalScale,
        x: calculatedX,
        y: calculatedY,
        canvasW: target.canvasW,
        canvasH: target.canvasH,
        debug: {
            eyeToTopPx: resultingEyeToTopPx,
            eyeToTop_Pct: eyeToTop_Pct
        },
        config: {
            TOP_MARGIN_PX: target.topMarginPx,
            TARGET_HEAD_PX: target.headPx,
            CANVAS_W: target.canvasW,
            CANVAS_H: target.canvasH
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
