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
    actualSourceWidth
) {
    const TARGET_HEAD_PX = 402;
    const CANVAS_W = 413;
    const CANVAS_H = 531;
    // const TOP_MARGIN = 40; // No longer used as a loose variable, integrated into calculation

    // 1. Stable inputs
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;

    const eyeMidY_In_Source = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);
    const topY_In_Source = topY_Resized;

    // 2. Physical Override Logic (Fixed Segment Scaling)
    // N = Distance from Hair Top to Pupil Midpoint in Source Pixels
    const N = eyeMidY_In_Source - topY_In_Source;

    // We want N (Hair to Eyes) to be EXACTLY 215px on the final canvas.
    // This forces the head to enlarge correctly to meet the 3.4cm requirement.
    const finalScale = 215 / N;

    // Check expectation (User expects 0.86-0.90 for this image)
    const expectedRange = (finalScale >= 0.8 && finalScale <= 1.0);
    if (!expectedRange) {
        console.warn(`[GEOMETRY WARNING] Scale ${finalScale.toFixed(4)} outside expected 0.8-1.0 range.`);
    }

    // 4. Positioning
    // Fixed Top Margin rule: Top of head must be exactly at Y=40
    const drawY = 40 - (topY_In_Source * finalScale);

    // Horizontal Center
    const sourceWidth = actualSourceWidth || (750 * (currentImgH / 1000)); // Fallback if unknown
    const drawnWidth = sourceWidth * finalScale;
    const drawX = (413 - drawnWidth) / 2;

    console.log(`[GEOMETRY OVERRIDE] N=${N.toFixed(1)}px (Src)`);
    console.log(`[GEOMETRY OVERRIDE] Target N=215px, FinalScale=${finalScale.toFixed(4)}`);

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
