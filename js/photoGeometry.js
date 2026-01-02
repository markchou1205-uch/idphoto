// js/photoGeometry.js
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config) {
    const DPI = 300;
    const MM_TO_PX = DPI / 25.4; // 1mm = 11.81px

    const target = {
        canvasW: Math.round(config.canvas_mm[0] * MM_TO_PX),
        canvasH: Math.round(config.canvas_mm[1] * MM_TO_PX),
        // Target Head Px: Average of min and max allowed head size * MM_TO_PX
        headPx: ((config.head_mm[0] + config.head_mm[1]) / 2) * MM_TO_PX,
        topMarginPx: config.top_margin_mm * MM_TO_PX
    };

    // 1. 計算百分比座標 (不受像素解析度影響)
    // 這裡我們將座標正規化為相對於「剪裁區域」或「原始圖像」的百分比

    // 瞳孔中心 Y (相對於 CropRect)
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_Pct = (eyeMidY_Global - cropRect.y) / cropRect.h;

    // 頭頂 Y (已由外部提供 Resized Image 中的 Y) -> 轉為百分比
    const topY_Pct = topY_Resized / currentImgH;

    // 2. 物理比例推算
    // 眼睛到頭頂的距離 (佔畫面高度百分比)
    const eyeToTop_Pct = eyeMidY_Pct - topY_Pct;

    // 根據人臉比例 (head_ratio) 推算「整顆頭」在畫面中的高度百分比
    const headHeight_In_Canvas_Pct = eyeToTop_Pct / config.head_ratio;

    // 3. 計算最終縮放倍率 (Scale)
    // Scale = 目標頭高像素 / (頭高百分比 * 目標畫布高度) ? <= 這是 Step 715 的邏輯
    // Wait. My manual says: const finalScale = target.headPx / (headHeight_In_Canvas_Pct * target.canvasH);
    // Is this correct?
    // HeadHeight_Pixels_On_Canvas_If_Scale_1 = (headHeight_In_Canvas_Pct * ImageH)?
    // No. `headHeight_In_Canvas_Pct` is % of `cropRect.h` (or `currentImgH` assuming crop covers img).
    // If we draw Image onto Canvas with Scale S.
    // DrawnHeadHeight = HeadHeight_Pct * ImgH * S.
    // We want DrawnHeadHeight = target.headPx.
    // So S = target.headPx / (HeadHeight_Pct * ImgH).
    // BUT the manual formula uses `target.canvasH`.
    // Why? `headHeight_In_Canvas_Pct` suggests it's % of Canvas?
    // No, `eyeToTop_Pct` is % of Input Image.
    // So `headHeight_In_Canvas_Pct` is % of Input Image.
    // So formula should use `currentImgH`?
    // Or maybe the Manual assumes normalization to Canvas H?
    // Let's look at Manual carefully: 
    // "const finalScale = target.headPx / (headHeight_In_Canvas_Pct * target.canvasH);"
    // This implies `headHeight_In_Canvas_Pct` means "If image fit specific way..."?
    // OR it assumes `currentImgH` is irrelevant because we map % direct to output?
    // If we use `target.canvasH`, we are saying "The Head Height % of the Input Image" is mapped to "% of Canvas Height".
    // This scales the Input Image such that the Head % becomes (TargetHead / CanvasH) %.
    // Scale = (TargetHead/CanvasH) / HeadPct.
    // Scale = target.headPx / (headHeight_In_Canvas_Pct * target.canvasH).
    // YES. This makes sense regardless of input resolution.
    // It says: "InputHead% * Scale = TargetHead% (of Canvas)".
    // So Scale * (HeadPct) = (TargetHeadPx / CanvasH).
    // So Scale = (TargetHeadPx / CanvasH) / HeadPct.
    // Scale = target.headPx / (target.canvasH * HeadPct).
    // Correct.

    const finalScale = target.headPx / (headHeight_In_Canvas_Pct * target.canvasH);

    // 4. 計算繪製座標 (Draw X/Y)
    // Y: 頂部留白
    // DrawY = TargetTopMargin - (TopY_Pct * CanvasH * Scale)?
    // No. TopY_Pct is % of Input.
    // DrawY = TargetTopMargin - (TopY_Pct * ?? * Scale)? 
    // We need TopY in drawn pixels.
    // DrawnTopY = TopY_Pct * (Scale * CanvasH)? NO.
    // DrawnTopY = TopY_Pct * (Scale * InputH)? NO.
    // DrawnTopY = TopY_Pct * (Scaled Image H).
    // Scaled Image H = CanvasH * Scale? NO.
    // Scale is a multiplier on dimensions.
    // What is the Base Dimension?
    // If Scale is derived relative to CanvasH (as per formula above).
    // Then effective Height = CanvasH * Scale? No.
    // S = (TargetHead / CanvasH) / HeadPct.
    // HeadPct * S * CanvasH = TargetHead.
    // So (HeadPct * CanvasH) is the "Base Size"?
    // This implies we treat the Input Image as having Height = CanvasH initially?
    // Yes, essentially normalizing Input H to Canvas H.
    // So: DrawnY = TargetTopMargin - (TopY_Pct * target.canvasH * finalScale).

    // X: 水平居中
    // DrawX = Center - (EyeX_Pct * ScaledWidth).
    // ScaledWidth = ScaledHeight * Aspect?
    // ScaledHeight = target.canvasH * finalScale.
    // Aspect = cropRect.w / cropRect.h.
    // So ScaledWidth = (target.canvasH * finalScale) * Aspect.
    // DrawX = (CanvasW/2) - (EyeX_Pct * ScaledWidth).

    const aspect = cropRect.w / cropRect.h;

    // Note: User manual implementation for X:
    // x: (target.canvasW / 2) - (((landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2 - cropRect.x) / cropRect.w * target.canvasW * finalScale)
    // Wait. It uses `target.canvasW` as base for Width?
    // Only if Input Aspect == Output Aspect?
    // Or if `finalScale` normalizes W to CanvasW?
    // Scale formula normalized H to CanvasH.
    // If standard passport aspect (35:45) matches crop aspect?
    // Input crop might be square. Output is 35:45.
    // If I use `target.canvasW` in X calc, I assume `finalScale` applies to Width RELATIVE TO CANVAS WIDTH.
    // But Scale was derived from Height.
    // Unless scaling is Anisotropic (stretch)? No.
    // Is Scale X same as Scale Y? Yes.
    // So `finalScale` derived from H applies to W.
    // W_drawn = H_drawn * Aspect.
    // H_drawn = CanvasH * finalScale (as derived).
    // So W_drawn = (CanvasH * finalScale) * Aspect.
    // The manual code uses `target.canvasW`.
    // If `canvasW/canvasH` != `cropW/cropH`, this is wrong?
    // Let's check: 35/45 = 0.77. Crop often is 0.77?
    // If not, using `target.canvasW` implies something else.
    // Let's stick to logic: W_drawn = H_drawn * Aspect_Input.
    // = (target.canvasH * finalScale) * (cropRect.w / cropRect.h).

    // Logic from Manual Code:
    // x: (target.canvasW / 2) - (...Pct * target.canvasW * finalScale)
    // This implies `Scale` acts on CanvasW.
    // But `Scale` acts on CanvasH in Y formula.
    // If CanvasW/CanvasH != CropW/CropH, then `Scale * CanvasH` != `Scale * CanvasW * (CropH/CropW)`.
    // I should use `target.canvasH * finalScale * aspect` for Width dimension to be safe?
    // OR simply `target.canvasH * aspect * finalScale`.
    // Yes.

    // I will use my robust logic:
    const scaledImgH = target.canvasH * finalScale;
    const scaledImgW = scaledImgH * aspect;

    const eyeMidX_Pct = ((landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2 - cropRect.x) / cropRect.w;

    return {
        scale: finalScale,
        y: target.topMarginPx - (topY_Pct * scaledImgH),
        x: (target.canvasW / 2) - (eyeMidX_Pct * scaledImgW),
        canvasW: target.canvasW,
        canvasH: target.canvasH,
        // Helper specifically for debug/validation
        debug: { targetHeadPx: target.headPx, headHeightPct: headHeight_In_Canvas_Pct }
    };
}

// Legacy Wrapper for older generic calls (optional, but requested by system to keep file simple)
export function getSpecDims(spec) {
    // Basic shim if needed, or consumers should update.
    return {};
}
// Note: api.js will need to be updated to NOT use getSpecDims or use this new function directly.
