// js/photoGeometry.js

// 1. 物理常數鎖定 (300 DPI 標準)
export const SPECS = {
    CANVAS_W: 413,        // 35mm
    CANVAS_H: 531,        // 45mm
    TARGET_HEAD_PX: 402,  // 3.4cm (法規 3.2-3.6cm 中位值)
    TOP_MARGIN_PX: 50,    // 0.42cm 頂部留白
    HEAD_RATIO: 0.48      // 眼睛到頭頂佔總頭高的比例 (核心參數)
};

/**
 * 核心幾何計算函數：將原始座標轉換為 300 DPI 畫布位置
 * @param {Object} landmarks - Azure 提供的臉部特徵點
 * @param {number} topY_Resized - Vercel 回傳圖中偵測到的局部頭頂 (px)
 * @param {Object} cropRect - 瀏覽器裁切時的原始座標區域 (x, y, w, h)
 * @param {number} currentImgH - 目前處理圖片的高度 (例如 Vercel 回傳的 600px)
 */
export function calculatePassportLayout(landmarks, topY_Resized, cropRect, currentImgH) {
    // A. 歸一化眼睛座標 (轉換為裁切區塊中的百分比，避開像素縮放干擾)
    const eyeMidY_Global = (landmarks.pupilLeft.y + landmarks.pupilRight.y) / 2;
    const eyeMidY_In_Crop_Percent = (eyeMidY_Global - cropRect.y) / cropRect.h;

    // B. 歸一化頭頂座標
    const topY_Percent = topY_Resized / currentImgH;

    // C. 計算頭部在畫布中的縮放與位置
    const eyeToTopDist_Percent = eyeMidY_In_Crop_Percent - topY_Percent;
    const headHeight_In_Canvas_Percent = eyeToTopDist_Percent / SPECS.HEAD_RATIO;

    // 計算最終縮放倍率 (Scale)
    const finalScale = SPECS.TARGET_HEAD_PX / (headHeight_In_Canvas_Percent * SPECS.CANVAS_H);

    // 計算垂直繪製座標
    const drawY = SPECS.TOP_MARGIN_PX - (topY_Percent * SPECS.CANVAS_H * finalScale);

    // 計算水平置中座標
    const eyeMidX_Global = (landmarks.pupilLeft.x + landmarks.pupilRight.x) / 2;
    const eyeMidX_In_Crop_Percent = (eyeMidX_Global - cropRect.x) / cropRect.w;
    const drawX = (SPECS.CANVAS_W / 2) - (eyeMidX_In_Crop_Percent * SPECS.CANVAS_W * finalScale);

    return {
        scale: finalScale,
        x: drawX,
        y: drawY,
        canvasW: SPECS.CANVAS_W,
        canvasH: SPECS.CANVAS_H
    };
}
