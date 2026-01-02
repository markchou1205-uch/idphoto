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

    // === CRITICAL FIX: Synchronize Coordinate Systems ===
    // Problem: eyeMidY_Global is in ORIGINAL coords (3024x4032 scale)
    //          topY_Resized is in VERCEL OUTPUT coords (750x1000 scale)
    // Solution: Convert eyeMidY to the SAME scale as the Vercel output

    // 1. Calculate the scale factor between original crop and Vercel output
    // Vercel output height = currentImgH (1000px typically)
    // Original crop height = cropRect.h (e.g., 3024px)
    const scaleToVercel = currentImgH / cropRect.h;

    // 2. Convert eyeMidY from original coords to Vercel output coords
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_InVercelCoords = (eyeMidY_Global - cropRect.y) * scaleToVercel;

    // 3. Now BOTH are in Vercel output coordinate system
    const eyeToTop_Px = eyeMidY_InVercelCoords - topY_Resized;

    // 4. Calculate head height in pixels (in Vercel output coords)
    const headHeight_Px = eyeToTop_Px / 0.48;

    // 5. Calculate scale to achieve target head size
    const finalScale = target.headPx / headHeight_Px;

    // 6. Calculate positions
    const eyeMidX_Global = (landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2;
    const eyeMidX_InVercelCoords = (eyeMidX_Global - cropRect.x) * scaleToVercel;

    // Drawn dimensions
    const drawnWidth = currentImgH * (cropRect.w / cropRect.h) * finalScale;
    const drawnHeight = currentImgH * finalScale;

    return {
        scale: finalScale,
        // Position topY at target margin
        y: target.topMarginPx - (topY_Resized * finalScale),
        // Center pupil at canvas center
        x: (target.canvasW / 2) - (eyeMidX_InVercelCoords * finalScale),
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
