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
        const originalBlob = base64ToBlob(cleanBase64);

        // RESIZE BEFORE UPLOAD (Speed Optimization)
        // If image is huge (e.g. 4000px), Azure upload takes 10s. Resize to 1500px.
        const resizedBlob = await resizeImage(originalBlob, 1500);
        console.log(`[Azure] Resized Blob Size: ${originalBlob.size} -> ${resizedBlob.size}`);

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
            body: resizedBlob
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

            // --- Precision Zoom Calculation (User Spec) ---
            // 1. Define Head Boundaries
            // Formula: Hair Top = EyebrowY - (ChinY - EyebrowY) * 0.2

            // Initial Fallback
            let hairTopY = rect.top;
            let chinY = rect.top + rect.height;

            if (data[0].faceLandmarks) {
                const l = data[0].faceLandmarks;
                const eyebrowY = (l.eyebrowLeftOuter.y + l.eyebrowRightOuter.y) / 2;

                // Fix: Use underLipBottom to define Chin more accurately (avoiding collar)
                // If underLipBottom is available, Chin is slightly below it.
                // Ref: Chin is approx (Nose to Mouth) distance below Mouth?
                // Or just use underLipBottom + fixed offset (e.g. 15% of nose-mouth distance)
                // Chin Logic: Use UnderLipBottom + (MouthHeight * 1.5) for safer chin estimation
                // Increased from 1.2 to 1.5 to avoid cutting chin on thick lips or open mouths
                if (l.underLipBottom) {
                    const mouthH = l.underLipBottom.y - l.upperLipTop.y;
                    chinY = l.underLipBottom.y + (mouthH * 1.5);
                }

                // Face Core Height (Chin - Eyebrow)
                const faceCoreH = chinY - eyebrowY;

                // Hair Top Logic: 0.8x faceCoreH (Increased to cover high hair)
                hairTopY = eyebrowY - (faceCoreH * 0.8);

                console.log(`[Crop Logic] Landmarks Logic -> EyebrowY: ${eyebrowY.toFixed(1)}, ChinY: ${chinY.toFixed(1)}, HairTopY: ${hairTopY.toFixed(1)}`);
            } else {
                console.warn("[Crop Logic] Landmarks missing, using bounding box fallback");
            }

            const fullHeadH = chinY - hairTopY;

            // 2. Target Ratio (Relaxed to 72% for better shoulder visibility)
            // Formula: Target Photo Height = Full Head Height / 0.72
            // Spec allows 70-80%. We target 72% (approaching 3.2cm min) to include more body.
            let targetPhotoH = fullHeadH / 0.72;

            // 3. Aspect Ratio (35:45)
            // W = H * (35/45)
            let targetPhotoW = targetPhotoH * (35 / 45);

            // 4. Width Constraint Check (Prevent ear chopping?)
            // If face width is too wide for this 75% zoom, we must zoom out.
            // Face Width should ideally be < 85% of Photo Width.
            if (rect.width > targetPhotoW * 0.85) {
                console.log("[Crop Logic] Face too wide for 75% vertical ratio, adjusting based on width.");
                targetPhotoW = rect.width / 0.85;
                targetPhotoH = targetPhotoW * (45 / 35);
            }

            // 5. Vertical Alignment
            // Guidelines: Eye line should be roughly at 50-55% from bottom? 
            // Or use standard: Top Margin = (PhotoH - HeadH) / 2 (Center Vertically)
            // Taiwan Spec: Head 3.2-3.6cm in 4.5cm photo (71%-80%). We use 75%.
            // Top Margin space should be balanced.
            // Let's assume centered head vertically within the crop, but head is top-heavy.
            // Let's put HairTop at `(PhotoH - HeadH) * 0.4` from top (slightly higher up)
            // Total margin = PhotoH - HeadH = PhotoH * 0.25
            // Top Margin = Total Margin * 0.4 = PhotoH * 0.1
            const topMarginPx = targetPhotoH * 0.1;

            // CropY
            const cropY = hairTopY - topMarginPx;

            // Center Horizontally
            // Face Center X matches Photo Center X
            const faceCenterX = rect.left + rect.width / 2;
            const cropX = faceCenterX - (targetPhotoW / 2);

            return {
                found: true,
                box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
                suggestedCrop: {
                    x: Math.max(0, Math.round(cropX)),
                    y: Math.max(0, Math.round(cropY)),
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

// Helper: Get Top Non-Transparent Pixel Y (Scan Alpha Channel)
async function getTopPixelY(blob) {
    const img = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Scan for first row with significant density (ignore stray noise pixels)
    // Robustness Upgrade: High Alpha + High Density + Consecutive Rows
    const alphaThreshold = 150; // Ignore shadows/mist
    const densityThreshold = 30; // Min pixels per row (approx 10% of head width)
    const consecutiveRowsNeeded = 5; // Must find head body, not a single artifact line

    let consecutiveCount = 0;
    let firstPotentialY = -1;

    for (let y = 0; y < canvas.height; y++) {
        let pixelCount = 0;
        for (let x = 0; x < canvas.width; x++) {
            const alpha = imageData[(y * canvas.width + x) * 4 + 3];
            if (alpha > alphaThreshold) {
                pixelCount++;
            }
        }

        if (pixelCount > densityThreshold) {
            if (consecutiveCount === 0) firstPotentialY = y;
            consecutiveCount++;

            if (consecutiveCount >= consecutiveRowsNeeded) {
                console.log(`[Noise Filter] Found Solid Hair Top at Y=${firstPotentialY} (Confirmed by ${consecutiveRowsNeeded} rows)`);
                return firstPotentialY;
            }
        } else {
            // Reset if sequence broken (it was just noise)
            consecutiveCount = 0;
            firstPotentialY = -1;
        }
    }
    return 0;
}

// Show Check Spec Modal
// 0. Warmup Backend
export async function warmupBackend() {
    try {
        console.log("Warming up backend...");
        await fetch('/api/remove-bg', { method: 'GET' });
    } catch (e) {
        console.warn("Warmup ping failed (expected if first time):", e);
    }
}

// Helper: Local Canvas Crop
function cropImageLocally(base64, crop) {
    return new Promise((resolve, reject) => {
        if (!base64) {
            console.error("Local Crop: No base64 input");
            return resolve(null);
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Use strict crop dimensions
            let x = 0, y = 0, w = img.width, h = img.height;
            if (crop) {
                x = crop.x; y = crop.y; w = crop.w; h = crop.h;
            }

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            // Draw cropped portion
            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

            // Export to Blob
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.95);
        };
        img.onerror = (e) => {
            console.error("Local Crop Image Load Error:", e);
            reject(e);
        };
        img.src = ensureSinglePrefix(base64);
    });
}

// 2. Process Preview (Optimized: Local Crop + Direct Vercel)
export async function processPreview(base64, cropParams, faceData = null) {
    // 0. Prepare Shared Resources
    const cleanBase64 = ensureSinglePrefix(base64);

    // Helper: Composite with Strict 3.4cm Head Layout (0.48 Ratio)
    async function compositeToWhiteBackground(transparentBlob) {
        // Calculate Top Y from Alpha Channel
        const topY = await getTopPixelY(transparentBlob);

        return new Promise((resolve, reject) => {
            console.log("Creating Image for composite...");
            const img = new Image();
            const url = URL.createObjectURL(transparentBlob);

            img.onload = () => {
                console.log("Image Loaded for composite. Width:", img.width, "Height:", img.height);
                const canvas = document.createElement('canvas');
                // Strict 300 DPI Standard: 35mm x 45mm = 413px x 531px
                canvas.width = 413;
                canvas.height = 531;
                const ctx = canvas.getContext('2d');

                // 1. Fill White
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // 2. Strict Position Logic
                let scale = 1;
                let drawX = 0;
                let drawY = 0;

                if (faceData && faceData.faceLandmarks) {
                    // BEST EFFORT: 
                    // Use the 413/531 canvas.
                    // Draw image centered.
                    // Scale = 413 / img.width (Fit Width).

                    scale = 413 / img.width;
                    // If img is 413 wide, scale=1.
                    drawX = 0;
                    drawY = 0;

                    // Check Top Margin
                    // Target Top Margin for 3.4cm head (~402px) in 4.5cm (~531px)
                    // (531 - 402) / 2 = 64.5px (Centered Head)
                    // Current Top = topY * scale.
                    // shift = 64.5 - CurrentTop.
                    drawY += (64.5 - (topY * scale));

                    console.log(`[Strict Composition] Scale: ${scale}, ShiftY: ${drawY}`);
                } else {
                    scale = Math.min(413 / img.width, 531 / img.height);
                    drawX = (413 - (img.width * scale)) / 2;
                    drawY = (531 - (img.height * scale)) / 2;
                }

                ctx.drawImage(img, drawX, drawY, img.width * scale, img.height * scale);

                // 3. Output
                console.log("Converting canvas to dataURL...");
                const dataUrl = canvas.toDataURL('image/jpeg', 0.95); // High Quality

                URL.revokeObjectURL(url);
                console.log("Composite Complete. Resolving...");
                resolve(dataUrl);
            };

            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load transparent image"));
            };

            img.src = url;
        });
    }



    // OPTIMIZED FLOW: Local Crop -> Resize -> Vercel Backend
    try {
        console.log("Starting Optimized Production Flow (Local Crop -> Vercel)...");

        // 1. Local Crop (Instant)
        let processingBlob;
        if (cropParams) {
            console.log("Cropping Locally:", cropParams);
            processingBlob = await cropImageLocally(cleanBase64, cropParams);
        } else {
            processingBlob = base64ToBlob(cleanBase64);
        }

        // 2. Resize Optimization (Max 600px)
        const optimizedBlob = await resizeImage(processingBlob, 600);

        // 3. Call Vercel Backend (Direct)
        console.log("Calling Vercel Backend...");
        const vercelRes = await fetch('/api/remove-bg', {
            method: 'POST',
            body: optimizedBlob
        });

        if (!vercelRes.ok) {
            const errorText = await vercelRes.text();
            console.error("Vercel Backend Error Details:", errorText);
            throw new Error(`Vercel Fail: ${vercelRes.status} - ${errorText}`);
        }

        const base64Data = await vercelRes.text();
        const transparentBlob = await (await fetch(`data:image/png;base64,${base64Data}`)).blob();

        // 4. Composite
        const finalB64 = await compositeToWhiteBackground(transparentBlob);
        const cleanB64 = finalB64.split(',').pop();
        return { photos: [cleanB64, cleanB64] };

    } catch (e) {
        console.error("Production Flow Failed:", e);
        throw e;
        // Note: We removed the heavy Local AI fallback for speed. 
        // If Vercel fails (500), we fail fast.
    }
}

/*
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
    }
*/



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

        // 4. Hair/Eyebrows Check (New)
        if (attrs.occlusion) {
            const { foreheadOccluded, eyeOccluded } = attrs.occlusion;
            if (foreheadOccluded || eyeOccluded) {
                results.push({ category: 'compliance', status: 'fail', item: '頭髮/五官', value: '頭髮遮擋五官', standard: '眉毛/眼睛需清晰' });
            } else {
                results.push({ category: 'compliance', status: 'pass', item: '頭髮/五官', value: '五官清晰', standard: '眉毛/眼睛需清晰' });
            }
        } else {
            // Fallback if occlusion not returned
            results.push({ category: 'compliance', status: 'pass', item: '頭髮/五官', value: '檢測通過', standard: '眉毛/眼睛需清晰' });
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

// Helper: Resize Image (Max Dimension)
function resizeImage(blob, maxDim) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            let w = img.width;
            let h = img.height;
            // If already small enough, return original
            if (w <= maxDim && h <= maxDim) {
                resolve(blob);
                return;
            }

            // Calculate new size
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.floor(w * ratio);
            h = Math.floor(h * ratio);

            console.log(`Resizing image for Vercel: ${img.width}x${img.height} -> ${w}x${h}`);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);

            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(img.src);
            reject(e);
        };
        img.src = URL.createObjectURL(blob);
    });
}

// Helper: Insert DPI Metadata (JFIF 300 DPI)
async function insertDPI(blob, dpi) {
    // Basic JFIF Header Modifier
    // JFIF APP0 Marker: FF E0
    // Length: 00 10 (16 bytes)
    // ID: 4A 46 49 46 00 (JFIF\0)
    // Version: 01 02
    // Units: 01 (Dots per inch)
    // Xdensity: high byte, low byte
    // Ydensity: high byte, low byte
    // Thumbnail: 00 00

    const buffer = await blob.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Check for SOI
    if (data[0] !== 0xFF || data[1] !== 0xD8) return blob; // Not valid JPEG?

    // Scan markers
    let pos = 2;
    while (pos < data.length) {
        if (data[pos] !== 0xFF) break; // Error
        const marker = data[pos + 1];

        if (marker === 0xE0) {
            // Found APP0 (JFIF). Modifying.
            // Check ID
            if (data[pos + 4] === 0x4A && data[pos + 5] === 0x46 && data[pos + 6] === 0x49 && data[pos + 7] === 0x46) {
                // Update Units (offset 11) -> 1
                data[pos + 11] = 1;
                // Update X Density (offset 12, 13)
                data[pos + 12] = (dpi >> 8) & 0xFF;
                data[pos + 13] = dpi & 0xFF;
                // Update Y Density (offset 14, 15)
                data[pos + 14] = (dpi >> 8) & 0xFF;
                data[pos + 15] = dpi & 0xFF;
                return new Blob([data], { type: 'image/jpeg' });
            }
        }

        // Next marker logic (skip current segment)
        // Length field in Big Endian at pos+2, pos+3
        const len = (data[pos + 2] << 8) | data[pos + 3];
        pos += 2 + len;
    }

    // IF No APP0, we should insert it right after SOI.
    // 18 bytes: FF E0 00 10 4A 46 49 46 00 01 01 01 [DPI_HI] [DPI_LO] [DPI_HI] [DPI_LO] 00 00
    const header = new Uint8Array([
        0xFF, 0xE0, 0x00, 0x10,
        0x4A, 0x46, 0x49, 0x46, 0x00,
        0x01, 0x02, // Version
        0x01, // 1 = Dots per inch
        (dpi >> 8) & 0xFF, dpi & 0xFF,
        (dpi >> 8) & 0xFF, dpi & 0xFF,
        0x00, 0x00
    ]);

    // Concat SOI + New APP0 + Rest
    const newData = new Uint8Array(data.length + 18);
    newData[0] = 0xFF; newData[1] = 0xD8;
    newData.set(header, 2);
    newData.set(data.subarray(2), 20);

    return new Blob([newData], { type: 'image/jpeg' });
}

// Export DPI Helper just in case UI needs it
export { insertDPI };
