export const PHOTO_CONFIGS = {
    // 台灣護照/身分證 (35x45mm)
    passport: {
        name: "台灣護照/身分證",
        canvas_mm: [35, 45],
        head_mm: [32, 36],     // 修正: 系統標準 32-36mm
        top_margin_mm: 4.2,    // 4.2mm (約 4-6mm)
        head_ratio: 0.50,      // 34/70? Approx.
        // User manual Taiwan example: 35x45.
    },
    // 美國簽證/護照 (51x51mm)
    visa_us: {
        name: "美國簽證/護照 (2x2 inch)",
        canvas_mm: [50.8, 50.8],
        head_mm: [25.4, 35.1],   // 1 inch to 1 3/8 inch
        top_margin_mm: 5.0,
        head_ratio: 0.52
    },
    // 健保卡/履歷 (42x47mm or similar? Config said 42x47)
    // Note: Config.js previously said 42x47mm for 'resume'.
    resume: {
        name: "健保卡 / 半身照 (2吋)",
        canvas_mm: [42, 47],
        head_mm: [25, 30],     // Estimated for resume (usually smaller head ratio)
        top_margin_mm: 5.0,
        head_ratio: 0.60       // Less head coverage (more body)
    },
    // 1吋 (28x35mm)
    inch1: {
        name: "駕照 / 執照 (1吋)",
        canvas_mm: [28, 35],
        head_mm: [20, 24],     // Estimated
        top_margin_mm: 3.5,
        head_ratio: 0.50
    }
};
