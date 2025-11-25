import { API_BASE_URL } from './config.js';
import { state } from './state.js';
import { showLoading } from './ui.js';

export async function detectFace(base64) {
    try {
        const res = await fetch(`${API_BASE_URL}/generate/detect`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: base64 })
        });
        if (res.ok) return await res.json();
    } catch (e) { console.error(e); }
    return null;
}

export async function processPreview(base64, isManual = false) {
    try {
        const res = await fetch(`${API_BASE_URL}/generate/preview`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                image_base64: base64, 
                spec_id: state.currentSpecId, 
                custom_ratio: state.currentCustomRatio,
                is_manual_crop: isManual // 告訴後端這是手動裁切的
            })
        });
        return await res.json();
    } catch (e) { throw new Error("連線錯誤"); }
}

export async function runCheckApi(imgBase64) {
    try {
        const res = await fetch(`${API_BASE_URL}/generate/check`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: imgBase64, spec_id: state.currentSpecId })
        });
        return await res.json();
    } catch (e) { throw e; }
}

export async function fixImageApi(imgBase64, action) {
    try {
        const res = await fetch(`${API_BASE_URL}/generate/fix`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: imgBase64, action: action })
        });
        return await res.json();
    } catch (e) { throw e; }
}

// Layout & Email 省略，邏輯同上...
