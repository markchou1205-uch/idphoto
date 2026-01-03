// js/photoGeometry.js - GEOMETRY SOLVER (CORRECTED)
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

export function calculateUniversalLayout(
    landmarks,
    topY_Resized,
    cropRect,
    currentImgH,
    config,
    actualSourceWidth,
    chinRatio = 1.2 // Default to Proportional Model ratio 1.2
) {
    const TARGET_HEAD_PX = 402;
    const CANVAS_W = 413;
    const CANVAS_H = 531;

    // 1. Stable inputs
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;

    const eyeMidY_In_Source = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);
    const topY_In_Source = topY_Resized;

    // 2. Proportional Model Logic
    // N = Distance from Hair Top to Pupil Midpoint in Source Pixels
    const N = eyeMidY_In_Source - topY_In_Source;

    // Head Height Formulation: HeadH = TopToEye + EyeToChin
    // User Thesis: EyeToChin = TopToEye * Ratio (Default 1.2)
    const estimatedHeadH_Src = N * (1 + chinRatio);

    // 3. Scaling
    // We want Estimated Head Height to be EXACTLY the Target Head Height (3.4cm / 402px)
    const finalScale = TARGET_HEAD_PX / estimatedHeadH_Src;

    // Check expectation (scale should be reasonable)
    const expectedRange = (finalScale >= 0.5 && finalScale <= 1.5);
    if (!expectedRange) {
        console.warn(`[GEOMETRY WARNING] Scale ${finalScale.toFixed(4)} outside usual range.`);
    }

    // 4. Positioning
    // Fixed Top Margin rule: Top of head must be exactly at Y=40
    const drawY = 40 - (topY_In_Source * finalScale);

    // Horizontal Center
    const sourceWidth = actualSourceWidth || (750 * (currentImgH / 1000)); // Fallback if unknown
    const drawnWidth = sourceWidth * finalScale;
    const drawX = (413 - drawnWidth) / 2;

    console.log(`[GEOMETRY PROPORTIONAL] N=${N.toFixed(1)}px, Ratio=${chinRatio}, HeadH_Src=${estimatedHeadH_Src.toFixed(1)}`);
    console.log(`[GEOMETRY PROPORTIONAL] TargetHead=${TARGET_HEAD_PX}, FinalScale=${finalScale.toFixed(4)}`);

    return {
        scale: finalScale,
        x: drawX,
        y: drawY,
        canvasW: CANVAS_W,
        canvasH: CANVAS_H,
        config: {
            TOP_MARGIN_PX: 40,
            TARGET_HEAD_PX: TARGET_HEAD_PX,
            CANVAS_W: CANVAS_W,
            CANVAS_H: CANVAS_H
        },
        debug: {
            N: N,
            chinRatio: chinRatio,
            finalScale: finalScale
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
