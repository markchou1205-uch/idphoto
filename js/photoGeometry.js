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

    // 1. Normalize based on strict Original Crop Resolution
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_Pct = (eyeMidY_Global - cropRect.y) / cropRect.h;

    // 2. Normalize topY based on the ACTUAL height of the blob processed by Vercel
    const topY_Pct = topY_Resized / currentImgH;

    // 3. Head height percentage relative to the vertical frame
    const headHeight_Pct = (eyeMidY_Pct - topY_Pct) / 0.48;

    // 4. CRITICAL SCALE CALCULATION
    // We must scale the image so that the head (headHeight_Pct * currentImgH) equals 402px
    const finalScale = target.headPx / (headHeight_Pct * currentImgH);

    // 5. Centering Logic
    const eyeMidX_Global = (landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2;
    const eyeMidX_Pct = (eyeMidX_Global - cropRect.x) / cropRect.w;
    // Calculate the drawn width of the image at finalScale
    const drawnWidth = (currentImgH * (cropRect.w / cropRect.h)) * finalScale;

    // DEBUG: exposing internal calculation for logging if needed
    const resultingHeadPx = headHeight_Pct * currentImgH * finalScale;
    console.log(`[Geometry] finalScale: ${finalScale}, ResultHeadPx: ${resultingHeadPx} (Target: ${target.headPx})`);

    return {
        scale: finalScale,
        y: target.topMarginPx - (topY_Pct * currentImgH * finalScale),
        x: (target.canvasW / 2) - (eyeMidX_Pct * drawnWidth),
        canvasW: target.canvasW,
        canvasH: target.canvasH,
        debug: {
            headPx: resultingHeadPx,
            eyeToTop_Pct: (eyeMidY_Pct - topY_Pct)
        },
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
