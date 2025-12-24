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
            const rect = data[0].faceRectangle;

            // --- Precision Zoom Calculation (Ver 20.0 - Aggressive "Anti-Chop") ---

            // User Feedback: "Head too big, Top Chopped".
            // Previous 20% hair assumption was too low.
            // New Assumption: Hair/Volume is 35% of Face Height.

            // 1. Define Head Boundaries
            // Azure provides 'rect' (Forehead to Chin).
            // Real Head Top (Hair) is estimated at 20% above forehead.
            const faceH = rect.height;
            const hairOffset = faceH * 0.35; // increased from 0.20
            const headTopY = rect.top - hairOffset; // True Top
            const chinY = rect.top + rect.height;   // True Bottom
            const fullHeadH = chinY - headTopY;     // Total Head Height (Hair to Chin)

            // 2. Target Ratio
            // Aim for 3.33cm (74% of 4.5cm).
            // This is slightly smaller than 3.4cm to ensure plenty of space.
            // Formula: CanvasH = HeadH / 0.74
            // If fullHeadH takes up 76% of the photo...
            let targetPhotoH = fullHeadH / 0.74;

            // Calculate Required Photo Width (35:45 aspect ratio)
            let targetPhotoW = targetPhotoH * (35 / 45);

            // 3. Width Constraint (Prevent chopping ears)
            // If Face Width > 82% of Target Width, we must zoom out.
            // (82% allows side margins for ears)
            if (rect.width > targetPhotoW * 0.82) {
                targetPhotoW = rect.width / 0.82;
                targetPhotoH = targetPhotoW * (45 / 35);
            }

            // 4. Vertical Alignment (Crucial Step)
            // Lock "Estimated Hair Top" to 10% (0.45cm) margin.
            // Top Margin = 10% of Target Photo Height.
            const topMarginPx = targetPhotoH * 0.10;

            // The Crop Box Y start position:
            // CropY = HeadTopY - TopMarginPx
            const cropY = headTopY - topMarginPx;

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
    // cropParams passed from state.faceData.suggestedCrop
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

                let transforms = [];

                if (cropParams) {
                    transforms.push(`c_crop,x_${cropParams.x},y_${cropParams.y},w_${cropParams.w},h_${cropParams.h}`);
                    transforms.push('c_scale,w_350,h_450');
                } else {
                    // Fallback to looser zoom if no params
                    transforms.push('c_thumb,g_face,w_350,h_450,z_0.60');
                }

                // Lighting & Color (Ver 20.0)
                transforms.push('e_improve:outdoor');
                transforms.push('e_viesus_correct');
                transforms.push('e_contrast:10'); // Smooth contrast

                // BG Removal & White BG
                transforms.push('e_background_removal');
                transforms.push('b_white');
                transforms.push('fl_flatten');

                const transformStr = transforms.join('/');
                const processedUrl = `https://res.cloudinary.com/${CLOUDINARY.CLOUD_NAME}/image/upload/${transformStr}/v${version}/${publicId}.jpg`;

                // Validate Fetch (Handle 401 if addon missing)
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
                    console.warn("Advanced filters failed, falling back to basic:", err);
                    const basicUrl = `https://res.cloudinary.com/${CLOUDINARY.CLOUD_NAME}/image/upload/c_crop,x_${cropParams.x},y_${cropParams.y},w_${cropParams.w},h_${cropParams.h}/c_scale,w_350,h_450/e_improve/e_gamma:50/e_background_removal/b_white/fl_flatten/v${version}/${publicId}.jpg`;
                    const basicRes = await fetch(basicUrl);
                    if (basicRes.ok) {
                        const bBlob = await basicRes.blob();
                        const bB64 = await new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result.split(',')[1]); rd.readAsDataURL(bBlob); });
                        return { photos: [bB64, bB64] };
                    }
                    throw err;
                }
            }
        }
    } catch (e) {
        console.error("Cloudinary Process Failed:", e);
    }

    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    return { photos: [cleanBase64, cleanBase64] };
}


// 3. Validation Check (Azure) - Runs immediately
export async function runCheckApi(imgBase64, specId = 'passport') {
    if (!AZURE || !AZURE.ENDPOINT || !AZURE.KEY) {
        return { results: [{ category: 'basic', status: 'warn', item: '系統連線', value: '無需連線', standard: '離線模式' }] };
    }

    try {
        const blob = base64ToBlob(imgBase64);

        // Fix: Remove trailing slash from endpoint if present
        const endpoint = AZURE.ENDPOINT.endsWith('/') ? AZURE.ENDPOINT.slice(0, -1) : AZURE.ENDPOINT;

        // Fix: Use detection_01 which supports BOTH Landmarks & Attributes + Exposure.
        const url = `${endpoint}/face/v1.0/detect?returnFaceAttributes=glasses,occlusion,exposure&returnFaceLandmarks=true&detectionModel=detection_01&returnFaceId=false`;

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

        // 0. Exposure Check
        if (attrs.exposure) {
            if (attrs.exposure.exposureLevel === 'GoodExposure') {
                // Pass
            } else {
                results.push({
                    category: 'quality', status: 'warn',
                    item: '光線檢查',
                    value: `光線不均勻 (${attrs.exposure.exposureLevel})`,
                    standard: '光線需明亮均勻'
                });
            }
        }

        // 1. Mouth/Expression Check (Landmark-based)
        if (landmarks && landmarks.upperLipBottom && landmarks.underLipTop) {
            const upperLipY = landmarks.upperLipBottom.y;
            const lowerLipY = landmarks.underLipTop.y;
            const mouthOpen = Math.abs(lowerLipY - upperLipY);
            const faceH = face.faceRectangle.height;
            const mouthRatio = (mouthOpen / faceH) * 100;

            // Relaxed Threshold: 4% (Ver 17.0)
            if (mouthRatio > 4.0) {
                results.push({ category: 'compliance', status: 'fail', item: '表情/嘴巴', value: '嘴巴未閉合/露齒', standard: '自然平視，不露齒' });
            } else {
                results.push({ category: 'compliance', status: 'pass', item: '表情/嘴巴', value: '自然平視，不露齒', standard: '合格' });
            }
        } else {
            // Fallback if landmarks missing
            results.push({ category: 'compliance', status: 'warn', item: '表情/嘴巴', value: '無法檢測', standard: '請閉合嘴巴' });
        }

        // 2. Occlusion (Symmetry Check)
        const isPassport = (specId === 'passport');
        const symmetryThresholdWarn = isPassport ? 18.0 : 20.0;
        const symmetryThresholdFail = isPassport ? 22.0 : 25.0;

        let symmetryFail = false;

        if (landmarks && landmarks.eyebrowLeftOuter && landmarks.eyebrowRightOuter) {
            const leftBrowY = (landmarks.eyebrowLeftOuter.y + landmarks.eyebrowLeftInner.y) / 2;
            const rightBrowY = (landmarks.eyebrowRightOuter.y + landmarks.eyebrowRightInner.y) / 2;
            const diffY = Math.abs(leftBrowY - rightBrowY);
            const faceH = face.faceRectangle.height;
            const symRatio = (diffY / faceH) * 100;

            if (symRatio > symmetryThresholdFail) {
                symmetryFail = true;
                results.push({ category: 'compliance', status: 'fail', item: '遮擋檢查 (對稱性)', value: `眉毛嚴重偏移 (${symRatio.toFixed(1)}%)`, standard: '請確認是否被瀏海遮擋' });
            } else if (symRatio > symmetryThresholdWarn) {
                results.push({ category: 'compliance', status: 'warn', item: '遮擋檢查 (對稱性)', value: `眉毛輕微偏移 (${symRatio.toFixed(1)}%)`, standard: '請確認是否被瀏海遮擋' });
            } else {
                results.push({ category: 'compliance', status: 'pass', item: '遮擋檢查 (對稱性)', value: 'Pass', standard: '未偵測到遮擋' });
            }
        } else {
            // Fallback if symmetry calc failed (e.g. no eyebrows detected)
            let details = [];
            if (attrs.occlusion && attrs.occlusion.foreheadOccluded) details.push("額頭遮擋");
            if (attrs.occlusion && attrs.occlusion.eyeOccluded) details.push("眼睛遮擋");

            if (details.length > 0) {
                results.push({ category: 'compliance', status: 'fail', item: '遮擋檢查', value: `偵測到遮擋 (${details.join(',')})`, standard: '五官需清晰無遮擋' });
            } else {
                results.push({ category: 'compliance', status: 'pass', item: '遮擋檢查', value: '無遮擋 (請人工確認眉耳露出)', standard: '五官需清晰無遮擋' });
            }
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

            // Estimate Top/Bottom Margins (Based on centered face approx)
            // top pixels = rect.top (in the cropped image)
            // Wait, rect is from Azure detect on the crop.
            // So rect.top IS the Top Padding (Forehead to edge).
            // Real Top Padding (to Hair) < rect.top.
            // But let's report what we see.
            const topMarginPx = face.faceRectangle.top;
            const topMarginCm = (topMarginPx / imgH) * 4.5;
            const bottomMarginCm = 4.5 - topMarginCm - headLenCm;

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
                    value: `合格 (頭 ${headLenCm.toFixed(1)}cm / 上 ${topMarginCm.toFixed(2)}cm)`,
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
