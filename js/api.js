import { API_BASE_URL } from './config.js';
import { state } from './state.js';

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

// 修改：接收 cropParams
export async function processPreview(base64, cropParams) {
    try {
        const payload = { 
            image_base64: base64, 
            spec_id: state.currentSpecId,
            // 如果有傳入裁切參數，就打包進去
            manual_crop: cropParams ? cropParams : null
        };

        const res = await fetch(`${API_BASE_URL}/generate/preview`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
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

export async function generateLayoutApi(imgBase64) {
    try {
        const res = await fetch(`${API_BASE_URL}/generate/layout`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: imgBase64 })
        });
        return await res.json();
    } catch (e) { throw e; }
}

export async function sendEmailApi(email, imgBase64) {
    try {
        const res = await fetch(`${API_BASE_URL}/send-email`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email: email, image_base64: imgBase64 })
        });
        return await res.json();
    } catch (e) { throw e; }
}
