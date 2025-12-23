// export const API_BASE_URL = "https://video.pdfsolution.dpdns.org"; 
// Serverless Transition
export const API_BASE_URL = "";

export const CLOUDINARY = {
    CLOUD_NAME: 'dcirx3cku',
    UPLOAD_PRESET: 'ml_default' // 假設為 unsigned，若無預設可能會失敗
};

export const AZURE = {
    ENDPOINT: "https://my-face-check-01.cognitiveservices.azure.com/",
    KEY: "9R4yKV3pVJAMIwE040Pwp4pyH5Mslu3vJp7gz82iQZClGdSQuH7xJQQJ99BLACqBBLyXJ3w3AAAKACOGKXtB"
};

export const DEFAULT_SPECS = {
    "passport": {
        "name": "護照 / 身分證",
        "desc": "2吋 (35x45mm) - 頭部 3.2~3.6cm",
        "width_mm": 35, "height_mm": 45,
        "ratio": 35 / 45,
        "face_multiplier": 1.85, "top_margin": 0.09
    },
    "resume": {
        "name": "健保卡 / 履歷 / 半身照",
        "desc": "2吋 (42x47mm)",
        "width_mm": 42, "height_mm": 47,
        "ratio": 42 / 47,
        "face_multiplier": 2.5, "top_margin": 0.15
    },
    "inch1": {
        "name": "駕照 / 執照 / 證書",
        "desc": "1吋 (28x35mm)",
        "width_mm": 28, "height_mm": 35,
        "ratio": 28 / 35,
        "face_multiplier": 2.0, "top_margin": 0.12
    },
    "visa_us": {
        "name": "美國簽證",
        "desc": "5x5cm (51x51mm)",
        "width_mm": 51, "height_mm": 51,
        "ratio": 1.0,
        "face_multiplier": 2.2, "top_margin": 0.15
    }
};
