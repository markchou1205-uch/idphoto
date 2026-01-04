export function calculateUniversalLayout(
    landmarks,
    topY_Resized,
    cropRect,
    currentImgH,
    config,
    actualSourceWidth,
    chinRatio = 1.2, // Default to Proportional Model ratio 1.2
    xShift = 0       // Horizontal Shift (pixels)
) {
    const TARGET_HEAD_PX = 402;
    const CANVAS_W = 413;
    const CANVAS_H = 531;
    const TARGET_TOP_MARGIN = 40;

    // 1. Stable inputs
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_In_Source = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);
    const topY_In_Source = topY_Resized;

    // 2. Proportional Model Logic
    // N = Distance from Hair Top to Pupil Midpoint in Source Pixels
    const N = eyeMidY_In_Source - topY_In_Source;

    // Head Height Formulation: HeadH = TopToEye + EyeToChin
    // User Thesis: EyeToChin = TopToEye * Ratio (Default 1.2)
    const estimatedHeadH_Src = N * (1 + chinRatio);

    // 3. Scaling
    // We want Estimated Head Height to be EXACTLY the Target Head Height (3.4cm / 402px)
    const finalScale = TARGET_HEAD_PX / estimatedHeadH_Src;

    // Check expectation
    const expectedRange = (finalScale >= 0.5 && finalScale <= 1.5);
    if (!expectedRange) {
        console.warn(`[GEOMETRY WARNING] Scale ${finalScale.toFixed(4)} outside usual range.`);
    }

    // 4. Positioning (Pivot Logic)
    // Old Pivot: Eye Center (TARGET_EYE_Y)
    // New Pivot: Head Top (Target Top Margin)
    // Logic: calculated DrawY so that topY_In_Source maps exactly to TARGET_TOP_MARGIN

    // DrawY = TargetY - (SourceY * Scale)
    const drawY = TARGET_TOP_MARGIN - (topY_In_Source * finalScale);

    // Old Eye Logic (Commented out for reference)
    /*
    const N_std = TARGET_HEAD_PX / 2.2;
    const TARGET_EYE_Y = TARGET_TOP_MARGIN + N_std;
    const drawY = TARGET_EYE_Y - (eyeMidY_In_Source * finalScale);
    */

    // Horizontal Center + Shift
    const sourceWidth = actualSourceWidth || (750 * (currentImgH / 1000));
    const drawnWidth = sourceWidth * finalScale;
    let drawX = (CANVAS_W - drawnWidth) / 2;

    // Apply User Horizontal Shift
    drawX += xShift;

    console.log(`[GEOMETRY] N=${N.toFixed(1)}, Ratio=${chinRatio}, Scale=${finalScale.toFixed(4)}`);
    console.log(`[GEOMETRY] Pivot EyeY=${TARGET_EYE_Y.toFixed(1)}, DrawY=${drawY.toFixed(1)}, XShift=${xShift}`);

    return {
        scale: finalScale,
        x: drawX,
        y: drawY,
        canvasW: CANVAS_W,
        canvasH: CANVAS_H,
        config: {
            TOP_MARGIN_PX: TARGET_TOP_MARGIN,
            TARGET_HEAD_PX: TARGET_HEAD_PX,
            CANVAS_W: CANVAS_W,
            CANVAS_H: CANVAS_H
        },
        debug: {
            N: N,
            chinRatio: chinRatio,
            finalScale: finalScale,
            xShift: xShift
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
