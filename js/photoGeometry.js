// js/photoGeometry.js
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

/**
 * OFFICIAL SSOT GEOMETRY ENGINE
 * Goal: Lock Head Height to exactly 3.4cm (402px @ 300DPI)
 * Implements Resolution-Independent Percentage-Based Normalization
 */
export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config) {
    const DPI = 300;
    const MM_TO_PX = DPI / 25.4;

    const target = {
        canvasW: Math.round(config.canvas_mm[0] * MM_TO_PX), // e.g., 413px
        canvasH: Math.round(config.canvas_mm[1] * MM_TO_PX), // e.g., 531px
        headPx: ((config.head_mm[0] + config.head_mm[1]) / 2) * MM_TO_PX, // Target 402px
        topMarginPx: config.top_margin_mm * MM_TO_PX // Target 50px
    };

    // --- STEP 1: PERCENTAGE NORMALIZATION (Crucial for Resizing) ---
    // Map Global Pupil Y to Percentage of the Original Crop Box
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_Pct = (eyeMidY_Global - cropRect.y) / cropRect.h;

    // Map Detected Hair Top to Percentage of the current Vercel output
    const topY_Pct = topY_Resized / currentImgH;

    // --- STEP 2: ANATOMICAL SCALE DERIVATION ---
    // (EyePct - TopPct) represents the top 48% of the head in the frame
    const headHeight_In_Canvas_Pct = (eyeMidY_Pct - topY_Pct) / config.head_ratio;

    // --- STEP 3: FINAL SCALE & TRANSLATION ---
    // Invariant Formula: TargetPx / (PhysicalPct * TotalCanvasH)
    const finalScale = target.headPx / (headHeight_In_Canvas_Pct * target.canvasH);

    // Calculate pupil center X percentage
    const eyeMidX_Pct = ((landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2 - cropRect.x) / cropRect.w;

    return {
        scale: finalScale,
        // Align detected hair top (topY_Pct) exactly to target margin
        y: target.topMarginPx - (topY_Pct * target.canvasH * finalScale),
        // Horizontal Centering based on Pupil Midpoint
        x: (target.canvasW / 2) - (eyeMidX_Pct * target.canvasW * finalScale),
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
