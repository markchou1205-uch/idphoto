// js/photoGeometry.js - GEOMETRY SOLVER (CORRECTED)
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

export function calculateUniversalLayout(
    landmarks,
    topY_Resized,
    cropRect,
    currentImgH,
    config,
    actualSourceWidth
) {
    const TARGET_HEAD_PX = 402;
    const CANVAS_W = 413;
    const CANVAS_H = 531;
    const TOP_MARGIN = 40; // 規格給定，不是 solver 變數

    // 1. Stable inputs
    const eyeMidY_Global =
        (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;

    const eyeMidY_In_Source =
        (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);

    const topY_In_Source = topY_Resized;
    const topToEye_Px = eyeMidY_In_Source - topY_In_Source;

    // 2. Multi-alpha solve (NO margin check here)
    const candidates = [];

    for (let alpha = 0.42; alpha <= 0.48; alpha += 0.01) {
        const headPx_Src = topToEye_Px / alpha;
        if (headPx_Src < 450 || headPx_Src > 750) continue;

        const scale = TARGET_HEAD_PX / headPx_Src;

        // Margin NOT used for elimination, only scale/head size matters for the solver
        candidates.push({ alpha, scale, headPx_Src });
    }

    if (candidates.length === 0) {
        // Failsafe for very weird extreme cases, though unlikely with [450, 750] range
        console.warn("[GEOMETRY SOLVER] No candidates in strict range. Using fallback.");
        const fallbackAlpha = 0.46;
        const fallbackHeadPx = topToEye_Px / fallbackAlpha;
        const fallbackScale = TARGET_HEAD_PX / fallbackHeadPx;
        candidates.push({ alpha: fallbackAlpha, scale: fallbackScale, headPx_Src: fallbackHeadPx });
    }

    candidates.sort(
        (a, b) =>
            Math.abs(a.headPx_Src - TARGET_HEAD_PX) -
            Math.abs(b.headPx_Src - TARGET_HEAD_PX)
    );

    const best = candidates[0];

    // 3. Rendering geometry (margin applied HERE)
    const sourceWidth =
        actualSourceWidth || (750 * (currentImgH / 1000));

    const finalW = sourceWidth * best.scale;
    const finalH = currentImgH * best.scale;

    const drawX = (CANVAS_W - finalW) / 2;
    const drawY = TOP_MARGIN - topY_In_Source * best.scale;

    console.log(
        `[GEOMETRY SOLVER] α=${best.alpha.toFixed(2)} ` +
        `scale=${best.scale.toFixed(4)}`
    );

    return {
        scale: best.scale,
        x: drawX,
        y: drawY,
        canvasW: CANVAS_W,
        canvasH: CANVAS_H,
        config: {
            TOP_MARGIN_PX: TOP_MARGIN,
            TARGET_HEAD_PX: TARGET_HEAD_PX,
            CANVAS_W: CANVAS_W,
            CANVAS_H: CANVAS_H
        },
        debug: {
            alpha: best.alpha,
            headPx_Src: best.headPx_Src,
            topMargin: TOP_MARGIN
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
