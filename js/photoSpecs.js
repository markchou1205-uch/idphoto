export const PHOTO_CONFIGS = {
    // 台灣護照/身分證 (35x45mm)
    // 規範: 頭頂至下巴 32-36mm (平均 34mm)
    // 頭頂留白: 約 4.5mm (為了讓頭部位於正中偏上)
    taiwan_passport: {
        name: "台灣護照/身分證 (35x45mm)",
        width_mm: 35,
        height_mm: 45,
        head_target_mm: 34,      // 目標頭高
        top_margin_mm: 4.5,      // 頭頂留白
        chin_range_mm: [32, 36], // 下巴合格範圍 (相對頭頂) => 實際下巴Y = TopMargin + Head
        // Chin Zone in Canvas Y: TopMargin + [32, 36]
        ppi: 300
    },
    // 美國簽證 (51x51mm / 2x2 inch)
    // 規範: 頭頂至下巴 25-35mm (平均 30mm)
    // 頭頂留白: 用戶指定 1cm (10mm)
    visa_us: {
        name: "美國簽證 (51x51mm)",
        width_mm: 51,
        height_mm: 51,
        head_target_mm: 30,      // 目標頭高 (平均值)
        top_margin_mm: 10.0,     // 頭頂留白 10mm
        chin_range_mm: [25, 35], // 下巴合格範圍 (相對頭頂) => Canvas Y: 10 + [25, 35] = 35~45mm
        ppi: 300
    }
};

// Legacy shim for older code referencing 'passport'
PHOTO_CONFIGS.passport = PHOTO_CONFIGS.taiwan_passport;
