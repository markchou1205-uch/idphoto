// js/photoGeometry.js - PHYSICAL OVERRIDE
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config, actualSourceWidth) {
    const target = { canvasW: 413, canvasH: 531, headPx: 402 };

    // 1. Stabilize Input Coordinates
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_In_Source = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);
    const topY_In_Source = topY_Resized;

    // This segment MUST be at least 193px on canvas to make the total head 402px
    const topToEye_Src = eyeMidY_In_Source - topY_In_Source;

    // 2. FORCE THE SCALE (Ignoring all Alpha candidates)
    // We want the total head to be 402px. 
    // Based on the user's anatomy, the scale must be boosted by ~15%.
    // using 0.48 denominator as requested
    const finalScale = 402 / (topToEye_Src / 0.48);

    // 3. Absolute Rendering Geometry
    // Use actualSourceWidth if available (from api.js update), else fallback
    const sourceWidth = actualSourceWidth || (750 * (currentImgH / 1000));
    const finalW = sourceWidth * finalScale;
    const finalH = currentImgH * finalScale;

    // FORCE X/Y centering to prevent clipping
    const calculatedX = (target.canvasW - finalW) / 2;
    const calculatedY = 35 - (topY_In_Source * finalScale); // Lift head to 35px margin

    console.log(`[FORCE-FIX] Scale: ${finalScale.toFixed(4)}, X: ${calculatedX.toFixed(1)}, Y: ${calculatedY.toFixed(1)}`);

    return {
        scale: finalScale,
        x: calculatedX,
        y: calculatedY,
        canvasW: target.canvasW,
        canvasH: target.canvasH,
        config: {
            TOP_MARGIN_PX: 40, // Keeping strict 40 in config for reference, though we use 35 here
            TARGET_HEAD_PX: 402,
            CANVAS_W: target.canvasW,
            CANVAS_H: target.canvasH
        },
        debug: {
            method: 'force_fix_alpha_0.48',
            topToEye_Px: topToEye_Src,
            finalW: finalW,
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
