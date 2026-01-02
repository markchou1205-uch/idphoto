// js/photoGeometry.js - PHYSICAL OVERRIDE
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config) {
    const target = { canvasW: 413, canvasH: 531 };

    // 1. Map Eye Position
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_In_Source = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);
    const topY_In_Source = topY_Resized;
    const eyeToTop_Px_In_Source = eyeMidY_In_Source - topY_In_Source;

    // 2. BRUTE FORCE SCALE
    // Current scale is failing. We force this segment (Eye-to-Top) to be 315px.
    const finalScale = 315 / eyeToTop_Px_In_Source;

    // 3. Dimensions
    // Hard assumed aspect ratio 0.75 (750x1000)
    const finalW = (750 * (currentImgH / 1000)) * finalScale;
    const finalH = currentImgH * finalScale;

    const calculatedY = 30 - (topY_In_Source * finalScale); // Top margin at 30px
    const calculatedX = (target.canvasW - finalW) / 2;

    console.log(`[BRUTE FORCE] Scale: ${finalScale.toFixed(4)}, EyeToTop(Src): ${eyeToTop_Px_In_Source.toFixed(1)}px, X: ${calculatedX.toFixed(1)}, Y: ${calculatedY.toFixed(1)}`);

    return {
        scale: finalScale,
        y: calculatedY,
        x: calculatedX,
        canvasW: target.canvasW,
        canvasH: target.canvasH,
        config: {
            TOP_MARGIN_PX: 30,
            TARGET_HEAD_PX: 402, // Reference only
            CANVAS_W: target.canvasW,
            CANVAS_H: target.canvasH
        },
        debug: {
            method: 'brute_force_315px',
            topToEye_Px: eyeToTop_Px_In_Source,
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
