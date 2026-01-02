// js/photoGeometry.js - COORDINATE SYSTEM FIX
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

/**
 * OFFICIAL SSOT GEOMETRY ENGINE - COORDINATE SYSTEM SYNCHRONIZED
 * Critical Fix: Both topY and eyeMid must be in the SAME coordinate system
 */
export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config) {
    const target = { canvasW: 413, canvasH: 531, headPx: 402, topMarginPx: 50 };

    // --- ABSOLUTE DISTANCE ANCHORING ---
    // Goal: Force the "Pupil to Hair Top" distance to be exactly 215px on the canvas.
    // This forces the head to be approx 3.5cm, ignoring chin detection failure.

    // 1. Calculate positions in the "Source" (Vercel Processed Image) coordinate system
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    // Map from Crop relative to Source relative
    // Note: currentImgH is the height of the image returned by Vercel (e.g. 1000px)
    // cropRect.h is the height of the crop box in the original image
    const eyeMidY_In_Source = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);

    // topY_Resized is already in Source (Vercel) coordinates
    const topY_In_Source = topY_Resized;

    // 2. Calculate the Source Distance (Pixels in the Vercel image)
    const eyeToTop_Px_In_Source = eyeMidY_In_Source - topY_In_Source;

    // 3. TARGET SCALE: We want this segment (Eye to Top) to be 215px on the canvas.
    const finalScale = 215 / eyeToTop_Px_In_Source;

    // 4. Calculate Dimensions for Centering
    // Hard assumed aspect ratio 0.75 (750x1000) for width calculation to avoid cropRect noise
    // If currentImgH is 1000, currentImgW is 750.
    const constrainedImgW = 750 * (currentImgH / 1000);

    // 5. Positioning
    // Fix top margin at 40px as requested (Lift Head)
    const calculatedY = 40 - (topY_In_Source * finalScale);
    const calculatedX = (413 - (constrainedImgW * finalScale)) / 2;

    console.log(`[ABS ANCHOR] Scale: ${finalScale.toFixed(4)}, EyeToTop(Src): ${eyeToTop_Px_In_Source.toFixed(1)}px, X: ${calculatedX.toFixed(1)}, Y: ${calculatedY.toFixed(1)}`);

    return {
        scale: finalScale,
        y: calculatedY,
        x: calculatedX,
        canvasW: target.canvasW,
        canvasH: target.canvasH,
        config: {
            TOP_MARGIN_PX: target.topMarginPx,
            TARGET_HEAD_PX: target.headPx,
            CANVAS_W: target.canvasW,
            CANVAS_H: target.canvasH
        },
        debug: {
            topY_Pct: topY_In_Source / currentImgH // Backwards compatible for api.js debug drawing
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
