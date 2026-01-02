// js/photoGeometry.js
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

/**
 * OFFICIAL SSOT GEOMETRY ENGINE
 * Goal: Lock Head Height to exactly 3.4cm (402px @ 300DPI)
 * Implements Resolution-Independent Percentage-Based Normalization
 */
export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config) {
    const DPI = 300;
    const MM_TO_PX = DPI / 25.4;

    const target = {
        canvasW: Math.round(config.canvas_mm[0] * MM_TO_PX),
        canvasH: Math.round(config.canvas_mm[1] * MM_TO_PX),
        headPx: ((config.head_mm[0] + config.head_mm[1]) / 2) * MM_TO_PX,
        topMarginPx: config.top_margin_mm * MM_TO_PX
    };

    // 1. Normalize Pupil Y within the Crop Box (Original Scale)
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_Pct = (eyeMidY_Global - cropRect.y) / cropRect.h;

    // 2. Normalize Hair Top within the Vercel Output (600px Scale)
    const topY_Pct = topY_Resized / currentImgH;

    // 3. Calculate Head Height as a percentage of the Source Image Height
    const headHeight_Pct = (eyeMidY_Pct - topY_Pct) / config.head_ratio;

    // --- THE FIX: Calculate Scale relative to the Image height, NOT Canvas height ---
    // We want: (headHeight_Pct * currentImgH * finalScale) = target.headPx
    const headPx_In_Source = headHeight_Pct * currentImgH;
    const finalScale = target.headPx / headPx_In_Source;

    // 4. Calculate Horizontal Alignment (Centering)
    const eyeMidX_Pct = ((landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2 - cropRect.x) / cropRect.w;
    const drawnImgWidth = (currentImgH * (cropRect.w / cropRect.h)) * finalScale;

    return {
        scale: finalScale,
        // Y position: Move topY to target margin
        y: target.topMarginPx - (topY_Pct * currentImgH * finalScale),
        // X position: Center pupil midpoint at Canvas center
        x: (target.canvasW / 2) - (eyeMidX_Pct * drawnImgWidth),
        canvasW: target.canvasW,
        canvasH: target.canvasH,
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
