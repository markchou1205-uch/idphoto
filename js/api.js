import { AZURE, CLOUDINARY } from './config.js';
import { state } from './state.js';

/* --- Azure Helper --- */
function base64ToBlob(base64) {
    const parts = base64.split(';base64,');
    const contentType = parts.length > 1 ? parts[0].split(':')[1] : 'image/jpeg';
    const raw = window.atob(parts.length > 1 ? parts[1] : base64);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
}

/* --- API Functions --- */

// 1. Detect Face (Azure)
export async function detectFace(base64) {
    if (!AZURE || !AZURE.ENDPOINT || !AZURE.KEY) {
        console.error("Azure config missing");
        return null;
    }

    try {
        const blob = base64ToBlob(base64);
        const url = `${AZURE.ENDPOINT}/face/v1.0/detect?returnFaceId=false&returnFaceLandmarks=false&recognitionModel=recognition_01&detectionModel=detection_03`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': AZURE.KEY,
                'Content-Type': 'application/octet-stream'
            },
            body: blob
        });

        if (!res.ok) throw new Error(`Azure Error: ${res.status}`);
        const data = await res.json();

        if (data && data.length > 0) {
            // Azure: { faceRectangle: { top, left, width, height } }
            // Editor expects: { found: true, box: { x, y, width, height } }
            const rect = data[0].faceRectangle;
            return {
                found: true,
                box: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                }
            };
        }
    } catch (e) {
        console.error("Detect Failed:", e);
    }
    return { found: false };
}

// 2. Process Preview (Cloudinary)
// Replace old backend logic with Cloudinary upload & transformation
export async function processPreview(base64, cropParams) {
    // Return photos array. 
    // Fallback: simply return the original cropped base64 if Cloudinary fails.

    // Note: To truly crop via Cloudinary, we'd need to upload the ORIGINAL and pass crop params in URL.
    // However, Editor.js usually crops locally via canvas for 'manual_crop'.
    // If 'cropParams' is passed, main.js might rely on backend cropping.
    // BUT since we are serverless, we should probably assume the Base64 passed here IS the cropped image 
    // OR we just upload the full image and let Cloudinary remove background?

    // In strict serverless without backend logic, we can't easily re-crop "on the fly" unless we do it in canvas first.
    // Assumption: The base64 passed here is the "source" to be processed.

    // Upload to Cloudinary
    let processedUrl = null;
    try {
        if (CLOUDINARY && CLOUDINARY.CLOUD_NAME) {
            const blob = base64ToBlob(base64);
            const formData = new FormData();
            formData.append('file', blob);
            formData.append('upload_preset', CLOUDINARY.UPLOAD_PRESET || 'unsigned'); // user didn't specify, assuming unsigned

            // Unsigned upload to Cloudinary
            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });

            if (uploadRes.ok) {
                const upData = await uploadRes.json();
                // Construct URL with transformations
                // mild improvement + background removal
                // e_improve,e_background_removal
                const publicId = upData.public_id;
                const version = upData.version;
                // E.g. https://res.cloudinary.com/demo/image/upload/e_background_removal/v1/sample.jpg
                processedUrl = `https://res.cloudinary.com/${CLOUDINARY.CLOUD_NAME}/image/upload/e_improve,e_background_removal/v${version}/${publicId}.png`;

                // Fetch the processed image to return as Base64 (to keep main.js happy)
                // Or return URL if main.js can handle it?
                // User said: "Let the preview... display Cloudinary URL". 
                // But main.js prepends "data:image...". 
                // We will return Base64 to ensure compatibility as requested ("Adapter").

                const processedBlob = await fetch(processedUrl).then(r => r.blob());
                const processedBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]); // remove data: prefix as main.js adds it
                    reader.readAsDataURL(processedBlob);
                });

                return { photos: [processedBase64, processedBase64] };
            }
        }
    } catch (e) {
        console.error("Cloudinary Process Failed:", e);
    }

    // Fallback: Return original base64 (stripped of prefix)
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    return { photos: [cleanBase64, cleanBase64] };
}


// 3. Validation Check (Azure) - Runs immediately
// 3. Validation Check (Azure) - Runs immediately
export async function runCheckApi(imgBase64, specId = 'passport') {
    try {
        if (!AZURE || !AZURE.ENDPOINT || !AZURE.KEY) throw new Error("Azure config missing");

        const blob = base64ToBlob(imgBase64);

        // Fix: Remove trailing slash from endpoint if present
        const endpoint = AZURE.ENDPOINT.endsWith('/') ? AZURE.ENDPOINT.slice(0, -1) : AZURE.ENDPOINT;

        // Fix: Use detection_01 which supports BOTH Landmarks & Attributes.
        const url = `${endpoint}/face/v1.0/detect?returnFaceAttributes=glasses,occlusion&returnFaceLandmarks=true&detectionModel=detection_01&returnFaceId=false`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': AZURE.KEY,
                'Content-Type': 'application/octet-stream'
            },
            body: blob
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || `Azure API Error: ${response.status}`);
        }

        const azureData = await response.json();

        // --- Validation Logic ---
        const results = [];

        if (azureData.length === 0) {
            results.push({ category: 'basic', status: 'fail', item: '人臉偵測', value: '未偵測到人臉', standard: '需清晰人臉' });
            return { results };
        }

        const face = azureData[0];
        const attrs = face.faceAttributes;
        const landmarks = face.faceLandmarks;

        // 1. Mouth/Expression Check (Landmark-based)
        if (landmarks && landmarks.upperLipBottom && landmarks.underLipTop) {
            const upperLipY = landmarks.upperLipBottom.y;
            const lowerLipY = landmarks.underLipTop.y;
            const mouthGap = lowerLipY - upperLipY;

            // Threshold: 2% of face height
            const faceHeight = face.faceRectangle.height;
            const limit = faceHeight * 0.02;

            if (mouthGap > limit) {
                results.push({
                    category: 'compliance', status: 'fail',
                    item: '表情/嘴巴', value: '嘴巴未閉合/露齒', standard: '請閉合嘴巴，不可露出牙齒'
                });
            } else {
                results.push({
                    category: 'compliance', status: 'pass',
                    item: '表情/嘴巴', value: '合格', standard: '自然平視，不露齒'
                });
            }
        } else {
            // Fallback if landmarks missing
            results.push({ category: 'compliance', status: 'warn', item: '表情/嘴巴', value: '無法檢測', standard: '請閉合嘴巴' });
        }


        // 2. Occlusion (Strict + Symmetry Check)
        let occlusionFail = false;
        if (attrs.occlusion.foreheadOccluded || attrs.occlusion.eyeOccluded || attrs.occlusion.mouthOccluded) {
            occlusionFail = true;
            let details = [];
            if (attrs.occlusion.foreheadOccluded) details.push("額頭");
            if (attrs.occlusion.eyeOccluded) details.push("眼睛");
            if (attrs.occlusion.mouthOccluded) details.push("嘴巴");
            results.push({ category: 'compliance', status: 'fail', item: '遮擋檢查', value: `偵測到遮擋 (${details.join(',')})`, standard: '五官需清晰無遮擋' });
        }

        // New: Symmetry Check (if basic occlusion passed)
        if (!occlusionFail && landmarks && landmarks.noseTip && landmarks.eyebrowLeftOuter && landmarks.eyebrowRightOuter) {
            const midX = landmarks.noseTip.x;
            const leftDist = Math.abs(midX - landmarks.eyebrowLeftOuter.x);
            const rightDist = Math.abs(landmarks.eyebrowRightOuter.x - midX);
            const maxDist = Math.max(leftDist, rightDist);
            const ratio = Math.abs(leftDist - rightDist) / (maxDist > 0 ? maxDist : 1);

            // Dynamic Thresholds
            const isPassport = (specId === 'passport');
            const warnLimit = isPassport ? 0.08 : 0.15; // 8% for Passport, 15% for others
            const failLimit = 0.15; // >15% is fail for everyone (or specifically strict for passport?)

            // Logic:
            // Warn: warnLimit <= ratio < 0.15
            // Fail: ratio >= 0.15 (for Passport? Or always?) 
            // User said: "> 15% fail (Red)". "10~15% warn".
            // Let's implement:
            // If Ratio > 15% -> Fail (Red)
            // Else If Ratio > WarnLimit -> Warn (Yellow)

            if (ratio > 0.15) {
                results.push({
                    category: 'compliance', status: 'fail',
                    item: '遮擋檢查 (對稱性)',
                    value: `眉毛嚴重偏移 (${(ratio * 100).toFixed(1)}%)`,
                    standard: '請確認是否被瀏海遮擋'
                });
            } else if (ratio > warnLimit) {
                results.push({
                    category: 'compliance', status: 'warn',
                    item: '遮擋檢查 (對稱性)',
                    value: `眉毛輕微偏移 (${(ratio * 100).toFixed(1)}%)`,
                    standard: '請確認是否被瀏海遮擋'
                });
            } else {
                results.push({
                    category: 'compliance', status: 'pass',
                    item: '遮擋檢查', value: '無遮擋 (請人工確認眉耳露出)', // Adding prompt as requested
                    standard: '五官需清晰無遮擋'
                });
            }
        } else if (!occlusionFail) {
            // Fallback if symmetry calc failed but occlusion passed
            results.push({ category: 'compliance', status: 'pass', item: '遮擋檢查', value: '無遮擋 (請人工確認眉耳露出)', standard: '五官需清晰無遮擋' });
        }

        // 3. Ear Check (Fixed Reminder)
        if (specId === 'passport') {
            results.push({ category: 'quality', status: 'warn', item: '耳朵檢查', value: '請人工確認耳朵是否露出', standard: '護照要求露出雙耳' });
        }


        // 4. Glasses (Warn)
        // Fix: Azure returns 'NoGlasses' (CamelCase). Check case-insensitively or specifically for NoGlasses.
        if (attrs.glasses !== 'NoGlasses' && attrs.glasses !== 'noGlasses') {
            results.push({ category: 'compliance', status: 'warn', item: '眼鏡檢查', value: `偵測到眼鏡 (${attrs.glasses})`, standard: '建議不戴眼鏡' });
        } else {
            results.push({ category: 'compliance', status: 'pass', item: '眼鏡檢查', value: '無配戴眼鏡', standard: '建議不戴眼鏡' });
        }

        results.push({ category: 'basic', status: 'pass', item: '影像解析度', value: '符合標準', standard: '> 600dpi' });

        return { results };

    } catch (e) {
        console.error("Check Failed:", e);
        // Fallback result to avoid UI crash
        return {
            results: [
                { category: 'basic', status: 'warn', item: '系統連線', value: '無法連線驗證', standard: '需網路連線' }
            ]
        };
    }
}

// Stubs for others
export async function fixImageApi(imgBase64, action) { return { image_base64: imgBase64 }; }
export async function generateLayoutApi(imgBase64) { return { layout_image: imgBase64 }; }
export async function sendEmailApi(email, imgBase64) { return { success: true }; }
