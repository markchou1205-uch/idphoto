// js/photoGeometry.js - COORDINATE SYSTEM FIX
// 核心幾何計算引擎 (SSOT)
// 負責將物理規格 (mm) 轉換為 Canvas 座標
// 禁止在此檔案中引入任何 Canvas 上下文或濾鏡運算

/**
 * 證件照幾何計算 - 終極定錨版 (解決領口干擾)
 * 核心策略：完全放棄 AI 下巴偵測，改用「瞳孔→頭頂」距離作為唯一縮放基準。
 */
export function calculateUniversalLayout(landmarks, topY_Resized, cropRect, currentImgH, config, actualSourceWidth) {
    // 規格鎖定：畫布 413x531，頭高目標 402px (3.4cm)，頂部留白 30px (Force Large)
    const target = { canvasW: 413, canvasH: 531, headPx: 402, topMarginPx: 30 };

    // 1. 計算瞳孔中線位置 (映射至 Vercel 1000px 座標系)
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_In_Source = (eyeMidY_Global - cropRect.y) * (currentImgH / cropRect.h);
    const topY_In_Source = topY_Resized;

    // 2. 測量「頭頂到瞳孔」的實體像素距離
    const topToEye_Px = eyeMidY_In_Source - topY_In_Source;

    // 3. 執行生理比例補償
    // 修正比例：從 0.50 降到 0.42 (這會讓人頭顯著放大)
    const EYE_TO_HEAD_RATIO = 0.42;
    const estimatedHeadHeight_Px = topToEye_Px / EYE_TO_HEAD_RATIO;

    // 4. 計算縮放比例 (以 402px 為目標)
    const finalScale = target.headPx / estimatedHeadHeight_Px;

    // 5. 計算繪製尺寸 (解決寬度計算錯誤導致的 X 軸偏移)
    const sourceWidth = actualSourceWidth || (750 * (currentImgH / 1000));
    const drawnWidth = sourceWidth * finalScale;
    const drawnHeight = currentImgH * finalScale;

    // 6. 定位計算 (絕對置中與頂部對齊)
    const calculatedY = target.topMarginPx - (topY_In_Source * finalScale);
    const calculatedX = (target.canvasW - drawnWidth) / 2;

    // 7. Debug 輸出 (讓工程師確認 finalScale 是否有提升)
    console.log(`[生理定錨法-ForceLarge] finalScale: ${finalScale.toFixed(4)}, X: ${calculatedX.toFixed(1)}, Y: ${calculatedY.toFixed(1)}`);
    console.log(`  - 瞳孔至頭頂距離: ${topToEye_Px.toFixed(1)}px`);
    console.log(`  - 預期總頭高: ${(estimatedHeadHeight_Px * finalScale).toFixed(1)}px (應接近 402)`);

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
            method: 'force_large_0.42',
            finalW: drawnWidth,
            topToEye_Px
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
