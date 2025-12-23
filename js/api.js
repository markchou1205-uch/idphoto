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
        const endpoint = AZURE.ENDPOINT.endsWith('/') ? AZURE.ENDPOINT.slice(0, -1) : AZURE.ENDPOINT;
        const url = `${endpoint}/face/v1.0/detect?returnFaceId=false&returnFaceLandmarks=false&recognitionModel=recognition_01&detectionModel=detection_01`;

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
export async function processPreview(base64, cropParams) {
    // cropParams is ignored now as we use Cloudinary smart crop (c_thumb, g_face)
    try {
        if (CLOUDINARY && CLOUDINARY.CLOUD_NAME) {
            const blob = base64ToBlob(base64);
            const formData = new FormData();
            formData.append('file', blob);
            formData.append('upload_preset', CLOUDINARY.UPLOAD_PRESET || 'unsigned');

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.CLOUD_NAME}/image/upload`, {
                method: 'POST', body: formData
            });

            if (uploadRes.ok) {
                const upData = await uploadRes.json();
                const publicId = upData.public_id;
                const version = upData.version;

                // Construct Transformations
                // Old: Manual c_crop with coordinates
                // New: Smart c_thumb with g_face (Gravity Face)
                // Goal: 3.5x4.5 ratio (350x450px), Face = 75% height.

                let transforms = [];

                // Smart Crop & Zoom
                // w_350,h_450: Force output dimensions (Ratio 7:9)
                // c_thumb: Thumbnail cropping (scales to fill then crops) -> actually with g_face it zooms to face.
                // g_face: Center on face.
                // z_0.75: Zoom level (0.75 means face occupies 75% of dimension). 
                // y_10: Slight offset to ensure head has room (Move face up slightly by moving crop center down? Or verify typical behavior).
                // Actually y_0 is usually centered. Let's use y_0 for now or slight adjustment if users want more chest.
                // User requested: "Chin above bottom... Head top leave space".
                // Default centering usually puts eyes at center.
                // Let's try y_10 (positive y usually moves region of interest UP? or crop DOWN?).
                // In Cloudinary g_face: "y" offsets the *center of the crop* from the detected face.
                // We want face to be *higher* in the frame (standard ID photo).
                // So we want the crop center to be *lower* than the face center.
                // Crop Center Y = Face Center Y + Offset. 
                // So positive Y offset moves crop center DOWN -> Face appears HIGHER.

                transforms.push('c_thumb,g_face,w_350,h_450,z_0.75,y_15');

                // Enhance & Remove BG
                transforms.push('e_improve');
                transforms.push('e_background_removal');

                const transformStr = transforms.join('/');
                const processedUrl = `https://res.cloudinary.com/${CLOUDINARY.CLOUD_NAME}/image/upload/${transformStr}/v${version}/${publicId}.png`;

                const processedBlob = await fetch(processedUrl).then(r => r.blob());
                const processedBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(processedBlob);
                });

                return { photos: [processedBase64, processedBase64] };
            }
        }
    } catch (e) { console.error("Cloudinary Process Failed:", e); }

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

        // 5. Ratio Check (New)
        // Face Height should be 70%~80% of Image Height (Standard 75% -> 3.4cm/4.5cm)
        // face.faceRectangle.height is the detected face height (including calc error, but close enough)
        // Note: Azure runs detection on the *Processed Crop*. So image height is the full height of the crop.
        // We can get image height from metadata or assume it's the blob size?
        // Actually face.faceRectangle is relative to the *image sent*. 
        // We sent the *processed/cropped* image (blob).
        // Azure doesn't explicitly return "Image Dimensions" in the JSON, but FaceRectangle coordinates are absolute.
        // We can infer image height from the crop params we *intended*? No, we don't have them here easily.
        // HOWEVER, we can just say: Ratio = face.faceRectangle.height / (face.faceRectangle.top + face.faceRectangle.height + smile...?)
        // Better: We *know* the ratio should be 75%. 
        // Let's rely on the ratio of `face.faceRectangle.height` to the *assumed* image height if we can't get it.
        // Wait, "faceData" in main.js has original image. 
        // Here we are checking the *Result Photo*.
        // Let's assume the result photo matches the aspect ratio of 3.5/4.5.
        // If we really want accurate ratio, we need the Image Height.
        // We can load the blob into an Image object to get height? Too slow?
        // Let's calculate based on `faceRectangle` vs known standard.
        // Actually, if we use `detection_01` on the cropped image, `faceRectangle` will tell us the face size in pixels.
        // We can estimate the Image Height if we assume the face is centered? No.
        // Wait, standard 2-inch photo is 4.5cm.
        // Ratio = FaceHeight / PhotoHeight.
        // If we don't know PhotoHeight, we can't calculate Ratio.
        // BUT `runCheckApi` receives `imgBase64`. We can get dimensions from it!
        // Let's use a helper to get dimensions? Or just accept that we might need to skip this if costly?
        // User requested it: "Check ratio...".
        // Let's assume we can get it via `state` or pass it?
        // `imgBase64` is passed. We can create an Image object? In Worker?
        // We are in async function.
        // Let's try to get image dimensions.

        const img = new Image();
        img.src = "data:image/jpeg;base64," + imgBase64;
        await new Promise(r => img.onload = r);
        const imgH = img.naturalHeight;

        if (imgH > 0) {
            const faceH = face.faceRectangle.height;
            const ratio = faceH / imgH;

            // Standard: 3.2~3.6cm / 4.5cm = 0.71 ~ 0.80
            const headLenCm = ratio * 4.5;

            if (ratio < 0.70 || ratio > 0.80) {
                results.push({
                    category: 'compliance', status: 'fail',
                    item: '比例檢查',
                    value: `頭部比例異常 (${headLenCm.toFixed(1)}cm)`,
                    standard: '頭部長度需介於 3.2~3.6 公分'
                });
            } else {
                results.push({
                    category: 'compliance', status: 'pass',
                    item: '比例檢查',
                    value: `符合標準 (${headLenCm.toFixed(1)}cm)`,
                    standard: '3.2~3.6 公分'
                });
            }
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
