// js/photoGeometry.js - PHYSICAL OVERRIDE
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

/**
 * 證件照幾何計算 - 三層架構重構版
 * Layer 1: 特徵提取 (Feature Extraction)
 * Layer 2: 幾何求解器 (Geometric Solver) - 像素約束最佳化
 * Layer 3: 渲染器輸出 (Renderer)
 */
export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config, actualSourceWidth) {
    // 規格鎖定：畫布 413x531，頭高目標 402px (3.4cm)，頂部留白 40px (容許 30-50)
    const target = { canvasW: 413, canvasH: 531, headPx: 402, topMarginPx: 40 };

    // === Layer 1: 特徵提取 (Feature Extraction) ===
    // 只保留最穩定的點，將所有座標映射至 Vercel 1000px 基準座標系
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    // Map to Source (Vercel Processed Image)
    const eyeY_Src = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);
    const topY_Src = topY_Resized;

    // === Layer 2: 幾何求解器 (Geometric Solver) ===
    // 核心邏輯放棄 mm 與 DPI 換算，改用「像素約束最佳化」

    // 1. 計算來源圖中「頭頂到瞳孔」的原始像素
    const topToEye_Src = eyeY_Src - topY_Src;

    // 2. 使用生理外推區間 (Alpha Model)
    // α 代表「頭頂到瞳孔」佔「總頭高」的比例。
    // 針對亞洲臉型與目前誤差，測試 α = [0.44, 0.46, 0.48]
    const alphaCandidates = [0.44, 0.46, 0.48];

    // 3. 遍歷候選比例，尋找最優 Scale (主要鎖定 0.46)
    let bestResult = null;
    alphaCandidates.forEach(alpha => {
        const estimatedHeadH_Src = topToEye_Src / alpha;
        const scale = target.headPx / estimatedHeadH_Src; // 強制縮放使推算頭高 = 402px

        // 儲存結果 (優先選擇接近 0.46 的 Alpha)
        if (!bestResult || Math.abs(alpha - 0.46) < 0.01) {
            bestResult = { scale, alpha, estimatedHeadH_Src };
        }
    });

    const finalScale = bestResult.scale;

    // === Layer 3: 渲染器輸出 (Renderer & Sanity Check) ===
    // 強制執行絕對置中，並移除任何隱藏的 Offset 補償。

    // 計算繪製寬度 (使用 actualSourceWidth 或回退推算)
    // 假設 currentImgH 為 1000，若沒有 actualSourceWidth 則假設 0.75 比例
    const sourceWidth = actualSourceWidth || (750 * (currentImgH / 1000));
    const drawnWidth = sourceWidth * finalScale;

    const calculatedY = target.topMarginPx - (topY_Src * finalScale); // 強制頭頂定錨在 40px
    const calculatedX = (target.canvasW - drawnWidth) / 2; // 絕對水平置中

    console.log(`[GeometricSolver] Alpha: ${bestResult.alpha}, Scale: ${finalScale.toFixed(4)}, X: ${calculatedX.toFixed(1)}, Y: ${calculatedY.toFixed(1)}`);
    console.log(`  - TopToEye(Src): ${topToEye_Src.toFixed(1)}px`);
    console.log(`  - Est.HeadH(Px): ${(bestResult.estimatedHeadH_Src * finalScale).toFixed(1)} (Target: 402)`);

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
            method: `solver_alpha_${bestResult.alpha}`,
            topToEye_Px: topToEye_Src,
            finalW: drawnWidth,
            alpha: bestResult.alpha
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
