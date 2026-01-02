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

    // 2. Convert landmarks from original coords to Vercel output coords
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_InVercelCoords = (eyeMidY_Global - cropRect.y) * scaleToVercel;

    // --- NEW SCALING LOGIC (Landmark Based) ---
    // Previous logic relied on (Eye - HairTop), which fails if hair is voluminous (topY_Resized is too high).
    // Fix: Use (Chin - Eye) to determine Head Height. This is physically robust.

    // A. Estimate Chin Position (Original Coords)
    let chinY_Global = 0;
    if (landmarks.underLipBottom && landmarks.upperLipTop) {
        const mouthH = landmarks.underLipBottom.y - landmarks.upperLipTop.y;
        // Chin is approx constant relative to mouth height or nose-mouth distance.
        // Using 1.6x mouth height below underLipBottom as safe chin estimate
        chinY_Global = landmarks.underLipBottom.y + (mouthH * 1.6);
    } else {
        // Fallback if detailed landmarks missing (shouldnt happen with correct Azure call)
        chinY_Global = eyeMidY_Global * 1.4; // Rough guess
    }

    const chinY_InVercelCoords = (chinY_Global - cropRect.y) * scaleToVercel;

    // B. Calculate Eye-to-Chin Distance
    const eyeToChin_Px = chinY_InVercelCoords - eyeMidY_InVercelCoords;

    // C. Derive Full Head Height
    // If config.head_ratio = Eye-to-Top Ratio (e.g., 0.48)
    // Then Eye-to-Chin Ratio = 1 - 0.48 = 0.52
    // HeadHeight = EyeToChin / 0.52
    const ratioEyeToChin = 1 - (config.head_ratio || 0.48);
    const headHeight_Px = eyeToChin_Px / ratioEyeToChin;

    // 5. Calculate scale to achieve target head size
    const finalScale = target.headPx / headHeight_Px;

    console.log(`[Geometry] Eye-to-Chin: ${eyeToChin_Px.toFixed(1)}px, Ratio: ${ratioEyeToChin.toFixed(2)}, Est HeadH: ${headHeight_Px.toFixed(1)}px`);

    // 6. Calculate positions
    const eyeMidX_Global = (landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2;
    const eyeMidX_InVercelCoords = (eyeMidX_Global - cropRect.x) * scaleToVercel;

    return {
        scale: finalScale,
        // Position topY (Hair Top) at target margin? 
        // OR Position Crown at target margin?
        // Spec usually says "Top of Head (including hair)". 
        // So keeping HairTop at TopMargin is safer for passing "Too close to border" checks.
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
