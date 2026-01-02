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

export function calculatePassportLayout(landmarks, topY_Resized, cropRect, currentImgH, spec = null, scaleFactor = 1) {
    const config = getSpecDims(spec);

    // 1. Coordinate Mapping (Original -> Resized)
    // Landmarks are in Original Coordinates. topY_Resized is in Resized Coordinates.
    // scaleFactor = ResizedWidth / OriginalWidth (approx).

    const eyeMidY_Original = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_Resized = eyeMidY_Original * scaleFactor;

    // 2. Head Geometry (in Resized Pixels)
    // eyeToTop_Resized is the visual distance from Eye center to Hair Top in the resized image
    const eyeToTop_Resized = eyeMidY_Resized - topY_Resized;

    // Total Head Height (in Resized Pixels) estimated from Head Ratio
    // If specific Spec has HEAD_RATIO override, use it (Default 0.48)
    const headHeight_Resized = eyeToTop_Resized / config.HEAD_RATIO;

    // 3. Calculate Layout Scale (to match Target Head Px)
    const finalScale = config.TARGET_HEAD_PX / headHeight_Resized;

    // 4. Calculate Draw Position (Canvas Coordinates)
    // Vertical: Place Hair Top at TOP_MARGIN_PX
    const drawY = config.TOP_MARGIN_PX - (topY_Resized * finalScale);

    // Horizontal: Center Eyes at Canvas Center
    const eyeMidX_Original = (landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2;
    const eyeMidX_Resized = eyeMidX_Original * scaleFactor;
    const drawX = (config.CANVAS_W / 2) - (eyeMidX_Resized * finalScale);

    return {
        scale: finalScale,
        x: drawX,
        y: drawY,
        canvasW: config.CANVAS_W,
        canvasH: config.CANVAS_H,
        config: config
    };
}
