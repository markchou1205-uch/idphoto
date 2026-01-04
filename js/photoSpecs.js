export const PHOTO_CONFIGS = {
    // 台灣護照/身分證 (35x45mm)
    // Keys must match DEFAULT_SPECS in config.js
    passport: {
        name: "台灣護照/身分證 (35x45mm)",
        width_mm: 35,
        height_mm: 45,
        head_target_mm: 34,      // 32-36mm (平均 34)
        top_margin_mm: 4.5,      // 頭頂留白
        chin_range_mm: [32, 36], // 下巴合格範圍
        ppi: 300
    },
    // 健保卡 / 半身照 (2吋 42x47mm)
    resume: {
        name: "健保卡 / 半身照 (42x47mm)",
        width_mm: 42,
        height_mm: 47,
        head_target_mm: 28,      // 半身照頭較小
        top_margin_mm: 5.0,
        chin_range_mm: [25, 31], // 估計範圍
        ppi: 300
    },
    // 1吋 駕照/執照 (28x35mm)
    inch1: {
        name: "駕照 / 執照 (1吋 28x35mm)",
        width_mm: 28,
        height_mm: 35,
        head_target_mm: 22,      // 頭部較小
        top_margin_mm: 3.5,
        chin_range_mm: [20, 24],
        ppi: 300
    },
    // 美國簽證 (51x51mm / 2x2 inch)
    visa_us: {
        name: "美國簽證 (51x51mm)",
        width_mm: 51,
        height_mm: 51,
        head_target_mm: 30,      // 25-35mm (平均 30)
        top_margin_mm: 10.0,     // 頭頂留白 1cm
        chin_range_mm: [25, 35],
        ppi: 300
    }
};
