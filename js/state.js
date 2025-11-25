import { DEFAULT_SPECS } from './config.js';

export const state = {
    originalBase64: "",
    faceData: null,
    specConfig: DEFAULT_SPECS,
    currentSpecId: "passport",
    currentCustomRatio: 0.77,
    resultPhotos: [],
    selectedResultBg: 0,
    currentLayoutBase64: null,
    currentFeature: 'id-photo',
    isImageLoaded: false,
    
    // 編輯器相關
    editor: {
        scale: 1.0,
        posX: 0,
        posY: 0,
        minScale: 0.1,
        imageWidth: 0,
        imageHeight: 0,
        containerWidth: 0,
        containerHeight: 0
    }
};
