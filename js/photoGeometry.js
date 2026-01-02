// js/photoGeometry.js

// 1. 物理常數鎖定 (300 DPI 標準)
// Helper to generate pixel specs from physical mm
export function getSpecDims(spec) {
    if (!spec) spec = { width_mm: 35, height_mm: 45, target_head_mm: 34 };

    // Default fallback if target_head_mm missing
    const headMm = spec.target_head_mm || (spec.height_mm * 0.75);

    return {
        CANVAS_W: Math.round(spec.width_mm / 25.4 * 300),
        CANVAS_H: Math.round(spec.height_mm / 25.4 * 300),
        TARGET_HEAD_PX: Math.round(headMm / 25.4 * 300),
        TOP_MARGIN_PX: 50, // Approx 4.2mm, generally safe for overhead spacing
        HEAD_RATIO: 0.48
    };
}

// 2. 影像濾鏡預設值 (標準化輸出)
export const IMAGE_PRESETS = {
    DEFAULT_BRIGHTNESS: 1.05, // 預設提亮 5%
    DEFAULT_CONTRAST: 0.92,   // 預設調降對比 8% 以淡化陰影
    DEFAULT_SATURATION: 1.05  // 微增飽和度讓氣色較好
};

// Deprecated: Legacy default (Passport)
export const SPECS = getSpecDims(null);

export function calculatePassportLayout(landmarks, topY_Resized, cropRect, currentImgH, spec = null) {
    const config = getSpecDims(spec);

    // A. Maximize Head Logic vs Fixed Head Logic
    // If we have strict head requirement (Passport/Visa), use TARGET_HEAD_PX.
    // If it's flexible (Resume), we might want to respect face_multiplier or just use Head Px.
    // Our config has target_head_mm, so we trust it.

    // B. Calculate
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_In_Crop_Percent = (eyeMidY_Global - cropRect.y) / cropRect.h;
    const topY_Percent = topY_Resized / currentImgH;

    const eyeToTopDist_Percent = eyeMidY_In_Crop_Percent - topY_Percent;
    const headHeight_In_Canvas_Percent = eyeToTopDist_Percent / config.HEAD_RATIO;

    const finalScale = config.TARGET_HEAD_PX / (headHeight_In_Canvas_Percent * config.CANVAS_H);

    const drawY = config.TOP_MARGIN_PX - (topY_Percent * config.CANVAS_H * finalScale);

    const eyeMidX_Global = (landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2;
    const eyeMidX_In_Crop_Percent = (eyeMidX_Global - cropRect.x) / cropRect.w;
    const drawX = (config.CANVAS_W / 2) - (eyeMidX_In_Crop_Percent * config.CANVAS_W * finalScale);

    return {
        scale: finalScale,
        x: drawX,
        y: drawY,
        canvasW: config.CANVAS_W,
        canvasH: config.CANVAS_H,
        config: config // Return config for use in Rulers
    };
}
