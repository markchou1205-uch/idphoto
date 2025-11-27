export const state = {
    currentFeature: 'id-photo',
    isImageLoaded: false,
    originalBase64: null,
    
    currentSpecId: 'passport',
    currentCustomRatio: 0.77,
    specConfig: {},
    
    faceData: null,
    resultPhotos: [], // [0]=white, [1]=blue
    selectedResultBg: 0,
    
    editor: {
        scale: 1,
        posX: 0,
        posY: 0,
        containerWidth: 0,
        containerHeight: 0,
        imageWidth: 0,
        imageHeight: 0
    }
};
