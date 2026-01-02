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

    // 1. Percent-based Vertical Calculation (Resolution Normalized)
    // Landmarks are usually in Original High-Res coordinates (via Azure)
    // topY_Resized is pixel Y in the Resized Image (Vercel Output)
    // We normalize both to % of their respective frames.

    // A. Visual Top Y % (Hair)
    const topY_Percent = topY_Resized / currentImgH;

    // B. Eye Center Y % (Landmarks relative to Crop)
    // Note: cropRect usually covers the Full Image if no manual crop
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_In_Crop_Percent = (eyeMidY_Global - cropRect.y) / cropRect.h;

    // C. Distance Eye-to-Top in %
    const eyeToTopDist_Percent = eyeMidY_In_Crop_Percent - topY_Percent;

    // D. Required Head Height (Pixels) in the Resized Image
    // HeadHeight = EyeToTop / HeadRatio
    const headHeight_Percent_Of_Image = eyeToTopDist_Percent / config.HEAD_RATIO;
    const actualHeadPx_In_Resized_Img = headHeight_Percent_Of_Image * currentImgH;

    // E. Layout Scale (How much to zoom/shrink the Resized Img to fit Target)
    const finalScale = config.TARGET_HEAD_PX / actualHeadPx_In_Resized_Img;

    // 2. Draw Position
    // We want DrawnTopY = TOP_MARGIN_PX
    // DrawnTopY = DrawY + (TopY_Resized * Scale)
    // DrawY = TOP_MARGIN_PX - (TopY_Resized * Scale)
    const drawY = config.TOP_MARGIN_PX - (topY_Resized * finalScale);

    // 3. Horizontal Position
    // Center Eyes at Canvas Center (CANVAS_W / 2)
    // EyeCenter_X_Px = Percent * Width. 
    // Proxy Width = Height * (CropW/CropH)
    const imgAspect = cropRect.w / cropRect.h;
    const currentImgW = currentImgH * imgAspect;

    const eyeMidX_Global = (landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2;
    const eyeMidX_In_Crop_Percent = (eyeMidX_Global - cropRect.x) / cropRect.w;

    // CanvasW/2 = DrawX + (EyePercent * ImgW * Scale)
    // DrawX = CanvasW/2 - (EyePercent * ImgW * Scale)
    const drawX = (config.CANVAS_W / 2) - (eyeMidX_In_Crop_Percent * currentImgW * finalScale);

    return {
        scale: finalScale,
        x: drawX,
        y: drawY,
        canvasW: config.CANVAS_W,
        canvasH: config.CANVAS_H,
        config: config
    };
}
