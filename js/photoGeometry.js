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
    const finalScale = target.headPx / (headHeight_In_Canvas_Pct * target.canvasH);

    // 4. 計算繪製座標 (Draw X/Y)
    const scaledImgH = target.canvasH * finalScale;
    const scaledImgW = scaledImgH * (cropRect.w / cropRect.h);

    const eyeMidX_Pct = ((landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2 - cropRect.x) / cropRect.w;

    const drawY = target.topMarginPx - (topY_Pct * scaledImgH);
    const drawX = (target.canvasW / 2) - (eyeMidX_Pct * scaledImgW);

    return {
        scale: finalScale,
        y: drawY,
        x: drawX,
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
