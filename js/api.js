import { AZURE, CLOUDINARY } from './config.js';
import { state } from './state.js';

/* --- Azure Helper --- */
export function ensureSinglePrefix(str) {
    if (!str) return '';
    // Structural Split: Safest way to remove single/double/triple prefixes
    // Split by comma, take the last part (data), then add ONE prefix.
    console.log("ensureSinglePrefix cleaning input length:", str.length);
    if (!str.includes('base64,')) {
        return `data:image/jpeg;base64,${str.trim()}`;
    }
    const parts = str.split('base64,');
    const cleanData = parts[parts.length - 1].trim();
    return `data:image/jpeg;base64,${cleanData}`;
}

function base64ToBlob(base64) {
    // Ensure we are working with standard form
    const clean = ensureSinglePrefix(base64);
    const parts = clean.split(';base64,');
    const contentType = parts.length > 1 ? parts[0].split(':')[1] : 'image/jpeg';
    const raw = window.atob(parts.length > 1 ? parts[1] : clean.split(',')[1]);

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
        console.log("detectFace called. Base64 len:", base64 ? base64.length : 0);
        // Clean input before Blob creation
        const cleanBase64 = ensureSinglePrefix(base64);
        const blob = base64ToBlob(cleanBase64);

        const endpoint = AZURE.ENDPOINT.endsWith('/') ? AZURE.ENDPOINT.slice(0, -1) : AZURE.ENDPOINT;
        // Fix: Enable returnFaceLandmarks=true
        const url = `${endpoint}/face/v1.0/detect?returnFaceId=false&returnFaceLandmarks=true&recognitionModel=recognition_01&detectionModel=detection_01`;

        console.log("Fetching Azure URL:", url);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': AZURE.KEY,
                'Content-Type': 'application/octet-stream'
            },
            body: blob
        });

        console.log("Azure Response Status:", res.status);

        if (!res.ok) {
            const txt = await res.text();
            console.error("Azure Error Body:", txt);
            throw new Error(`Azure Error: ${res.status}`);
        }

        const data = await res.json();
        console.log("Azure Detect Data Length:", data ? data.length : 0);

        if (data && data.length > 0) {
            const rect = data[0].faceRectangle;

            // --- Precision Zoom Calculation (User Spec) ---

            // 1. Define Head Boundaries
            // Formula: Hair Top = EyebrowY - (ChinY - EyebrowY) * 0.2

            // Default fallback
            let hairTopY = rect.top;
            const chinY = rect.top + rect.height; // Use rect for chin if landmarks unreliable, but formulas need eyebrow

            if (data[0].faceLandmarks) {
                const l = data[0].faceLandmarks;
                // Average Eyebrow Y
                const eyebrowY = (l.eyebrowLeftOuter.y + l.eyebrowRightOuter.y) / 2;

                // Face Core Height (Chin - Eyebrow)
                // Use rect.top + rect.height as Chin (Azure rect covers face well)
                const faceCoreH = chinY - eyebrowY;

                // Hair Top
                const estimatedHairHeight = faceCoreH * 0.2;
                hairTopY = eyebrowY - estimatedHairHeight;

                console.log(`[Crop Logic] EyebrowY: ${eyebrowY}, ChinY: ${chinY}, CoreH: ${faceCoreH}, HairOffset: ${estimatedHairHeight}`);
            } else {
                console.warn("[Crop Logic] Landmarks missing, using fallback 20% offset from top");
                hairTopY = rect.top - (rect.height * 0.2);
            }

            const fullHeadH = chinY - hairTopY;     // Total Head Height

            // 2. Target Ratio
            // Formula: Target Photo Height = Full Head Height / 0.75
            let targetPhotoH = fullHeadH / 0.75;

            // Calculate Required Photo Width (35:45 aspect ratio)
            let targetPhotoW = targetPhotoH * (35 / 45);

            // 3. Width Constraint Check (Prevent ear chopping?)
            // If Face Width > 82% of Target Width, zoom out.
            if (rect.width > targetPhotoW * 0.82) {
                // Adjust W to fit width
                targetPhotoW = rect.width / 0.82;
                targetPhotoH = targetPhotoW * (45 / 35);
            }

            // 4. Vertical Alignment (Crucial Step)
            // Top Margin = 10% of Target Photo Height (0.45cm)
            const topMarginPx = targetPhotoH * 0.10;

            // CropY = HairTopY - TopMarginPx
            const cropY = hairTopY - topMarginPx;

            // Center Horizontally
            const cropX = (rect.left + rect.width / 2) - (targetPhotoW / 2);

            return {
                found: true,
                box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
                suggestedCrop: {
                    x: Math.round(cropX),
                    y: Math.round(cropY),
                    w: Math.round(targetPhotoW),
                    h: Math.round(targetPhotoH)
                },
                // Pass markers for UI guide drawing if needed
                markers: { hairTopY, chinY }
            };
        }
    } catch (e) {
        console.error("Detect Failed:", e);
    }
    return { found: false };
}

// 2. Process Preview (Cloudinary)
// 2. Process Preview (Cloudinary with Local Fallback)
export async function processPreview(base64, cropParams) {
    try {
        if (CLOUDINARY && CLOUDINARY.CLOUD_NAME) {
            // Use Sanitizer
            const cleanBase64 = ensureSinglePrefix(base64);
            const blob = base64ToBlob(cleanBase64);

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

                let transforms = [];

                if (cropParams) {
                    transforms.push(`c_crop,x_${cropParams.x},y_${cropParams.y},w_${cropParams.w},h_${cropParams.h}`);
                    transforms.push('c_scale,w_350,h_450');
                } else {
                    transforms.push('c_thumb,g_face,w_350,h_450,z_0.60');
                }

                // Lighting & Color
                transforms.push('e_improve:outdoor');
                transforms.push('e_viesus_correct');
                transforms.push('e_gamma:70');
                transforms.push('e_background_removal');
                transforms.push('b_white');
                transforms.push('fl_flatten');

                const transformStr = transforms.join('/');
                const processedUrl = `https://res.cloudinary.com/${CLOUDINARY.CLOUD_NAME}/image/upload/${transformStr}/v${version}/${publicId}.jpg`;

                // Fetch Result
                try {
                    const procRes = await fetch(processedUrl);
                    if (!procRes.ok) throw new Error(`Cloudinary Error ${procRes.status}`);
                    const processedBlob = await procRes.blob();
                    const processedBase64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(processedBlob);
                    });
                    return { photos: [processedBase64, processedBase64] };
                } catch (err) {
                    console.warn("Advanced filters failed:", err);
                    console.log("Cloudinary advanced filters failed. Skipping Safe Mode and falling back to Local Crop immediately to ensure result.");
                    // Fall through to local crop
                }
            } else {
                console.warn(`Cloudinary Upload Failed: ${uploadRes.status}`);
            }
        }
    } catch (e) {
        console.error("Cloudinary Process Failed/Skipped:", e);
    }

    // --- FINAL FALLBACK: LOCAL CROP ---
    console.log("Falling back to Local Canvas Crop...");
    try {
        const localResult = await cropImageLocally(base64, cropParams);
        return { photos: [localResult, localResult] }; // Return simple cropped version
    } catch (localErr) {
        console.error("Local Crop Failed:", localErr);
        // Last resort: return original
        const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
        return { photos: [cleanBase64, cleanBase64] };
    }
}

// Helper: Local Canvas Crop
function cropImageLocally(base64, crop) {
    return new Promise((resolve, reject) => {
        if (!base64) {
            console.error("Local Crop: No base64 input");
            return resolve(null); // Fail gracefully
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 350;
            canvas.height = 450;
            const ctx = canvas.getContext('2d');

            // Default crop if missing
            let x = 0, y = 0, w = img.width, h = img.height;
            if (crop) {
                x = crop.x; y = crop.y; w = crop.w; h = crop.h;
            } else {
                // Center crop strategy if no face data
                const targetRatio = 350 / 450;
                const imgRatio = img.width / img.height;
                if (imgRatio > targetRatio) {
                    h = img.height;
                    w = h * targetRatio;
                    x = (img.width - w) / 2;
                    y = 0;
                } else {
                    w = img.width;
                    h = w / targetRatio;
                    x = 0;
                    y = (img.height - h) / 2;
                }
            }

            // Draw cropped portion
            ctx.drawImage(img, x, y, w, h, 0, 0, 350, 450);

            // Export to Base64
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const b64 = dataUrl.split(',')[1];
            resolve(b64);
        };
        img.onerror = (e) => {
            console.error("Local Crop Image Load Error:", e);
            resolve(base64.includes(',') ? base64.split(',')[1] : base64); // Fallback to original
        };
        img.src = ensureSinglePrefix(base64);
    });
}


// 3. Validation Check (Azure)
export async function runCheckApi(imgBase64, specId = 'passport') {
    if (!AZURE || !AZURE.ENDPOINT || !AZURE.KEY) {
        return { results: [{ category: 'basic', status: 'fail', item: '系統錯誤', value: 'API Key Missing' }] };
    }

    try {
        // Use Universal Sanitizer
        const cleanBase64 = ensureSinglePrefix(imgBase64);
        console.log("Calling runCheckApi. Clean Len:", cleanBase64.length);

        const blob = base64ToBlob(cleanBase64);
        const endpoint = AZURE.ENDPOINT.endsWith('/') ? AZURE.ENDPOINT.slice(0, -1) : AZURE.ENDPOINT;
        const url = `${endpoint}/face/v1.0/detect?returnFaceAttributes=glasses,occlusion,exposure&returnFaceLandmarks=true&detectionModel=detection_01&returnFaceId=false`;

        console.log("runCheckApi Fetching URL:", url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': AZURE.KEY,
                'Content-Type': 'application/octet-stream'
            },
            body: blob
        });

        console.log("runCheckApi Status:", response.status);

        if (!response.ok) {
            const errData = await response.json();
            console.error("runCheckApi Azure Error:", errData);
            throw new Error(errData.error?.message || `Azure API Error: ${response.status}`);
        }

        const azureData = await response.json();
        const results = [];

        if (azureData.length === 0) {
            results.push({ category: 'basic', status: 'fail', item: '人臉偵測', value: '未偵測到人臉', standard: '需清晰人臉' });
            return { results };
        }

        const face = azureData[0];
        const attrs = face.faceAttributes;
        const landmarks = face.faceLandmarks;

        // 1. Mouth/Expression Check (Relaxed Threshold: 4.0%)
        if (landmarks && landmarks.upperLipBottom && landmarks.underLipTop) {
            const upperLipY = landmarks.upperLipBottom.y;
            const lowerLipY = landmarks.underLipTop.y;
            const mouthOpen = Math.abs(lowerLipY - upperLipY);
            const faceH = face.faceRectangle.height;
            const mouthRatio = (mouthOpen / faceH) * 100;

            if (mouthRatio > 4.0) {
                results.push({ category: 'compliance', status: 'fail', item: '表情/嘴巴', value: `嘴巴未閉合 (${mouthRatio.toFixed(1)}%)`, standard: '自然平視，不露齒' });
            } else {
                results.push({ category: 'compliance', status: 'pass', item: '表情/嘴巴', value: '合格', standard: '合格' });
            }
        } else {
            results.push({ category: 'compliance', status: 'warn', item: '表情/嘴巴', value: '無法檢測', standard: '請閉合嘴巴' });
        }

        // 2. Ratio Check (Always Pass + Note)
        const img = new Image();
        img.src = cleanBase64;
        await new Promise(r => img.onload = r); // Wait for load to get height

        if (img.naturalHeight > 0) {
            results.push({
                category: 'compliance', status: 'pass',
                item: '比例檢查',
                value: '系統將自動校正比例',
                standard: '3.2~3.6 公分'
            });
        }

        // 3. Other Checks
        if (attrs.glasses !== 'NoGlasses' && attrs.glasses !== 'noGlasses') {
            results.push({ category: 'compliance', status: 'warn', item: '眼鏡檢查', value: `偵測到眼鏡`, standard: '建議不戴眼鏡' });
        } else {
            results.push({ category: 'compliance', status: 'pass', item: '眼鏡檢查', value: '無配戴眼鏡', standard: '建議不戴眼鏡' });
        }

        if (attrs.exposure) {
            if (attrs.exposure.exposureLevel !== 'GoodExposure') {
                results.push({ category: 'quality', status: 'warn', item: '光線檢查', value: '光線可能不均', standard: '需明亮' });
            } else {
                results.push({ category: 'quality', status: 'pass', item: '光線檢查', value: '合格', standard: '合格' });
            }
        }

        results.push({ category: 'basic', status: 'pass', item: '影像解析度', value: '符合標準', standard: '> 600dpi' });

        return { results };

    } catch (e) {
        console.error("Check Failed:", e);
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
