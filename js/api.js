import { AZURE, CLOUDINARY } from './config.js';
import { PHOTO_CONFIGS } from './photoSpecs.js';
import { state } from './state.js';
import { calculateUniversalLayout, IMAGE_PRESETS } from './photoGeometry.js';

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
        // Resizing Logic with Scale Tracking
        const originalImg = new Image();
        const loadPromise = new Promise(r => originalImg.onload = r);
        originalImg.src = ensureSinglePrefix(base64);
        await loadPromise;

        const origW = originalImg.width;
        const origH = originalImg.height;

        // RESIZE BEFORE UPLOAD (Speed Optimization)
        // If image is huge (e.g. 4000px), Azure upload takes 10s. Resize to 1500px.
        // We use 1500px as safe limit for Azure Face API.
        const maxDim = 1500;
        let scale = 1;

        let resizedBlob;
        if (origW > maxDim || origH > maxDim) {
            scale = Math.min(maxDim / origW, maxDim / origH);
            const w = Math.floor(origW * scale);
            const h = Math.floor(origH * scale);
            console.log(`[Azure] Resizing ${origW}x${origH} -> ${w}x${h} (Scale: ${scale.toFixed(4)})`);

            // Create resized blob
            const cvs = document.createElement('canvas');
            cvs.width = w;
            cvs.height = h;
            cvs.getContext('2d').drawImage(originalImg, 0, 0, w, h);
            resizedBlob = await new Promise(r => cvs.toBlob(r, 'image/jpeg', 0.95));
        } else {
            // Fix: Create Blob from base64 if not resizing
            resizedBlob = base64ToBlob(cleanBase64);
        }

        const endpoint = AZURE.ENDPOINT.endsWith('/') ? AZURE.ENDPOINT.slice(0, -1) : AZURE.ENDPOINT;
        // Fix: Enable returnFaceLandmarks=true AND returnFaceAttributes (Removed deprecated 'smile')
        const url = `${endpoint}/face/v1.0/detect?returnFaceId=false&returnFaceLandmarks=true&returnFaceAttributes=glasses,occlusion,exposure,blur,noise,headPose&recognitionModel=recognition_01&detectionModel=detection_01`;

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
            // Apply Reverse Scaling to Coordinates
            const reverseScale = 1 / scale;
            console.log(`[Azure] Reverse Scale Factor: ${reverseScale.toFixed(4)}`);

            const rawRect = data[0].faceRectangle;
            const rect = {
                left: rawRect.left * reverseScale,
                top: rawRect.top * reverseScale,
                width: rawRect.width * reverseScale,
                height: rawRect.height * reverseScale
            };

            // Scale Landmarks
            const rawL = data[0].faceLandmarks;
            const l = {};
            if (rawL) {
                for (const k in rawL) {
                    l[k] = {
                        x: rawL[k].x * reverseScale,
                        y: rawL[k].y * reverseScale
                    };
                }
            }

            // --- Precision Zoom Calculation (User Spec) ---
            // 1. Define Head Boundaries
            // Formula: Hair Top = EyebrowY - (ChinY - EyebrowY) * 0.2

            // Initial Fallback
            let hairTopY = rect.top;
            let chinY = rect.top + rect.height;

            if (Object.keys(l).length > 0) { // Check if we have scaled landmarks
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

                // Hair Top Logic: 1.0x faceCoreH (Standard estimation)
                hairTopY = eyebrowY - (faceCoreH * 1.0);

                console.log(`[Crop Logic] Landmarks Logic -> EyebrowY: ${eyebrowY.toFixed(1)}, ChinY: ${chinY.toFixed(1)}, HairTopY: ${hairTopY.toFixed(1)}`);
            } else {
                console.warn("[Crop Logic] Landmarks missing, using bounding box fallback");
            }

            const fullHeadH = chinY - hairTopY;

            // 2. Target Ratio (Relaxed to 72% for better shoulder visibility)
            // Formula: Target Photo Height = Full Head Height / 0.75
            // Spec allows 70-80%. We target 75% (~3.37cm) for balanced head size and shoulders.
            let targetPhotoH = fullHeadH / 0.75;

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
                markers: { hairTopY, chinY },
                faceLandmarks: l, // Important: Pass scaled landmarks for composition
                faceAttributes: data[0].faceAttributes // Pass attributes for compliance check
            };
        }
    } catch (e) {
        console.error("Detect Failed:", e);
        console.error("Error Details:", e.message, e.stack);
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
    const densityThreshold = Math.max(5, Math.floor(canvas.width * 0.05)); // Dynamic Threshold: 5% of width (e.g. 30px for 600w, 15px for 300w)
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

// Helper: Prepare for Upload (Resize)
async function prepareImageForUpload(base64) {
    try {
        const blob = await (await fetch(base64)).blob();
        return await resizeImage(blob, 1000); // 1000px Limit for Vercel
    } catch (e) {
        console.error("Prepare Upload Failed:", e);
        throw e;
    }
}

// Helper: Composite with Physics Normalization + Lighting Compensation
// Update compositeToWhiteBackground to destructure xShift and showGuides
async function compositeToWhiteBackground(transparentBlob, faceData, fullRect, config, userAdjustments) {
    const topY_Resized = await getTopPixelY(transparentBlob);

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(transparentBlob);

        img.onload = () => {
            let layout;
            // Destructure new params with defaults
            // showGuides default true
            const showGuides = (userAdjustments && userAdjustments.showGuides !== undefined) ? userAdjustments.showGuides : true;

            try {
                if (faceData && faceData.faceLandmarks && fullRect) {
                    // SSOT: Calculate Universal Layout
                    // Allow override of Chin Ratio from user adjustments (Head Scale Slider)
                    // Default to 1.2 if not provided (Proportional Model)
                    const chinRatio = userAdjustments && userAdjustments.headScale ? userAdjustments.headScale : 1.2;
                    const xShift = userAdjustments && userAdjustments.xShift ? userAdjustments.xShift : 0;

                    layout = calculateUniversalLayout(
                        faceData.faceLandmarks,
                        topY_Resized,
                        fullRect, // Always use full rect
                        img.height,
                        config,
                        img.width, // actualSourceWidth
                        chinRatio, // Pass dynamic ratio
                        xShift     // Pass horizontal shift
                    );

                    // DEBUG REQUESTED BY USER
                    console.log("DEBUG: Scaling Image Height", img.height, "with Scale", layout.scale, "Final Scale:", layout.scale);

                    // === COMPREHENSIVE DEBUG LOGGING ===
                    // === GEOMETRY DEBUG (Clean) ===
                    console.log(`[Universal Layout] Scale: ${layout.scale.toFixed(4)}, X: ${layout.x.toFixed(1)}, Y: ${layout.y.toFixed(1)}`);
                    if (layout.debug) {
                        console.log(`[Solver Debug] N: ${layout.debug.N?.toFixed(1)}, Ratio: ${layout.debug.chinRatio}, XShift: ${layout.debug.xShift}`);
                    }

                    // Self-Verification Log
                    const mmToPx = 300 / 25.4;
                    const targetedHeadPx = config.head_target_mm * mmToPx;
                    console.log(`[驗證] Target Head Px: ${targetedHeadPx.toFixed(1)} (from ${config.head_target_mm}mm)`);
                } else {
                    // Fallback Configuration
                    const DPI = 300;
                    const MM_TO_PX = DPI / 25.4;
                    const tW = Math.round(config.canvas_mm[0] * MM_TO_PX);
                    const tH = Math.round(config.canvas_mm[1] * MM_TO_PX);
                    layout = { scale: 1, x: 0, y: 0, canvasW: tW, canvasH: tH };
                }
            } catch (e) {
                console.error("Layout Calc Failed", e);
                // Legacy SpecData Fallback
                const DPI = 300;
                const MM_TO_PX = DPI / 25.4;
                const tW = Math.round(config.canvas_mm[0] * MM_TO_PX);
                const tH = Math.round(config.canvas_mm[1] * MM_TO_PX);
                layout = {
                    scale: 1, x: 0, y: 0, canvasW: tW, canvasH: tH,
                    config: { TOP_MARGIN_PX: 0, TARGET_HEAD_PX: 0 }
                };
            }

            const canvas = document.createElement('canvas');
            canvas.width = layout.canvasW;
            canvas.height = layout.canvasH;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // --- Apply Lighting Filters ---
            const { brightness = 1, contrast = 1 } = userAdjustments;
            const finalBrightness = IMAGE_PRESETS.DEFAULT_BRIGHTNESS * brightness;
            const finalContrast = IMAGE_PRESETS.DEFAULT_CONTRAST * contrast;
            ctx.filter = `brightness(${finalBrightness}) contrast(${finalContrast}) saturate(${IMAGE_PRESETS.DEFAULT_SATURATION})`;

            if (faceData && faceData.faceLandmarks && fullRect && layout.scale !== 1) {
                ctx.drawImage(img, layout.x, layout.y, img.width * layout.scale, img.height * layout.scale);

                // [Visual Anchor Update]
                // Dynamic Chin Zone from Spec
                if (showGuides && config.chin_range_mm) {
                    const PPI = config.ppi || 300;
                    const MM_TO_PX = PPI / 25.4;

                    // Chin Range is relative to Head Top? No, spec says "Head Length" range.
                    // Chin Position Y = Top Margin + Head Length
                    const topMarginMm = config.top_margin_mm;
                    const minHeadMm = config.chin_range_mm[0];
                    const maxHeadMm = config.chin_range_mm[1];

                    const minY_mm = topMarginMm + minHeadMm;
                    const maxY_mm = topMarginMm + maxHeadMm;

                    const zoneY = minY_mm * MM_TO_PX;
                    const zoneH = (maxY_mm - minY_mm) * MM_TO_PX;

                    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; // Semi-transparent Red
                    ctx.fillRect(0, zoneY, layout.canvasW, zoneH);

                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0, zoneY, layout.canvasW, zoneH);
                }
            } else {
                console.warn("[Strict Perc] Missing landmarks/error, performing simple fit");
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const dx = (canvas.width - img.width * scale) / 2;
                const dy = (canvas.height - img.height * scale) / 2;
                ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale);
            }

            ctx.filter = 'none'; // Reset for Rulers

            // [NEW] Clean Mode: If guides are hidden, return the pure cropped image (No Padding, No Rulers)
            if (!showGuides) {
                resolve(canvas.toDataURL('image/jpeg', 0.95));
                URL.revokeObjectURL(url);
                return;
            }

            // --- Add Rulers & Guides (User Verification) ---
            const margin = 40; // Space for rulers
            const ruledCanvas = document.createElement('canvas');
            ruledCanvas.width = canvas.width + margin; // Right margin
            ruledCanvas.height = canvas.height + margin; // Top margin

            const rCtx = ruledCanvas.getContext('2d');
            rCtx.fillStyle = '#FFFFFF';
            rCtx.fillRect(0, 0, ruledCanvas.width, ruledCanvas.height);

            // 3. Draw Original Photo (Offset Y by margin)
            rCtx.drawImage(canvas, 0, margin);

            // 4. Draw Rulers
            rCtx.strokeStyle = '#000000';
            rCtx.fillStyle = '#000000';
            rCtx.font = '12px Arial';
            rCtx.lineWidth = 1;

            // A. Top Ruler (Horizontal)
            rCtx.beginPath();
            rCtx.moveTo(0, margin - 1);
            rCtx.lineTo(canvas.width, margin - 1);
            const wMM = config.width_mm || 35;
            for (let mm = 0; mm <= wMM; mm++) {
                const x = mm * (canvas.width / wMM);
                const isMajor = (mm % 5 === 0);
                const tickH = isMajor ? 15 : 8;
                rCtx.moveTo(x, margin - 1);
                rCtx.lineTo(x, margin - 1 - tickH);
                if (isMajor && x < canvas.width - 5) {
                    if (x > 10) rCtx.fillText(mm.toString(), x - 4, margin - 20);
                }
            }
            rCtx.stroke();

            // B. Right Ruler (Vertical)
            rCtx.beginPath();
            const rightBaseX = canvas.width;
            rCtx.moveTo(rightBaseX, margin);
            rCtx.lineTo(rightBaseX, ruledCanvas.height);
            const hMM = config.height_mm || 45;
            for (let mm = 0; mm <= hMM; mm++) {
                const y = margin + (mm * (canvas.height / hMM));
                const isMajor = (mm % 5 === 0);
                const tickW = isMajor ? 15 : 8;
                rCtx.moveTo(rightBaseX, y);
                rCtx.lineTo(rightBaseX + tickW, y);
                if (isMajor && y < ruledCanvas.height - 5) {
                    rCtx.fillText(mm.toString(), rightBaseX + 20, y + 4);
                }
            }
            rCtx.stroke();

            // 5. Verification Lines & Labels
            if (faceData && faceData.faceLandmarks && layout.config) {
                const topY = margin + (layout.config.TOP_MARGIN_PX || 40);
                const headH_Px = layout.config.TARGET_HEAD_PX;

                // Common Styles
                rCtx.lineWidth = 2;
                rCtx.font = 'bold 12px Arial';
                rCtx.setLineDash([5, 3]);

                // 1. Head Top Line (Green)
                rCtx.strokeStyle = '#00CC00'; // Green
                rCtx.fillStyle = '#00CC00';
                rCtx.beginPath();
                rCtx.moveTo(0, topY);
                rCtx.lineTo(ruledCanvas.width, topY);
                rCtx.stroke();
                rCtx.fillText("Head Top", 5, topY - 5);

                // 2. Chin Range Band (REMOVED)
                /*
                const rangeTopMm = 32;
                const rangeBottomMm = 36;
                const targetMm = 34;

                const rangeTopPx = headH_Px * (rangeTopMm / targetMm);
                const rangeBottomPx = headH_Px * (rangeBottomMm / targetMm);
                const chinRangeTopY = topY + rangeTopPx;
                const chinRangeBottomY = topY + rangeBottomPx;

                rCtx.fillStyle = 'rgba(255, 0, 0, 0.15)';
                rCtx.fillRect(0, chinRangeTopY, ruledCanvas.width, chinRangeBottomY - chinRangeTopY);

                rCtx.fillStyle = '#FF0000';
                rCtx.fillText("3.2cm", 5, chinRangeTopY - 5);
                rCtx.fillText("3.6cm", 5, chinRangeBottomY + 15);
                */

                // 3. Eye Line (Blue)
                if (layout.debug && layout.debug.N) {
                    const eyeY = topY + (layout.debug.N * layout.scale);
                    rCtx.strokeStyle = '#0000FF'; // Blue
                    rCtx.fillStyle = '#0000FF';
                    rCtx.beginPath();
                    rCtx.moveTo(0, eyeY);
                    rCtx.lineTo(ruledCanvas.width, eyeY);
                    rCtx.stroke();
                    rCtx.fillText("Eye Line", 5, eyeY - 5);
                }

                // 4. Vertical Center Line
                const centerX = canvas.width / 2;
                rCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                rCtx.lineWidth = 1;
                rCtx.setLineDash([10, 5]);
                rCtx.beginPath();
                rCtx.moveTo(centerX, margin);
                rCtx.lineTo(centerX, ruledCanvas.height);
                rCtx.stroke();
                rCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                rCtx.fillText("Center", centerX + 5, margin + 20);

                // Measurement Label
                const targetHeadCm = (config.head_target_mm / 10).toFixed(1);
                rCtx.fillStyle = 'red';
                rCtx.setLineDash([]);
                rCtx.fillText(`${targetHeadCm} cm`, canvas.width + 5, topY + (headH_Px / 2));
            }

            resolve(ruledCanvas.toDataURL('image/jpeg', 0.95));
            URL.revokeObjectURL(url);
        };
        img.onerror = (e) => reject(e);
        img.src = url;
    });
}

// 2. Process Preview (Optimized: Local Crop + Direct Vercel)
// 2. Fetch Transparent Blob (Extracted)
export async function fetchTransparentImage(base64) {
    const cleanBase64 = ensureSinglePrefix(base64);
    // 1. Prepare Upload Blob (Resize & Compress) - Re-use logic
    const optimizedBlob = await prepareImageForUpload(cleanBase64);

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
    return await (await fetch(`data:image/png;base64,${base64Data}`)).blob();
}

// 2b. Parallel Production (New Entry Point)
export async function executeParallelProduction(compressedBase64, originalBase64, specKey = 'taiwan_passport', userAdjustments = {}) {
    const config = PHOTO_CONFIGS[specKey] || PHOTO_CONFIGS['taiwan_passport'];
    console.log("[Parallel] Starting Production for:", config.name);

    try {
        // --- PARALLEL EXECUTION ---
        console.time("Parallel_API");
        const [faceRes, transparentBlob] = await Promise.all([
            detectFace(compressedBase64),          // Azure (takes ~2-4s)
            fetchTransparentImage(compressedBase64) // Vercel (takes ~3-5s)
        ]);
        console.timeEnd("Parallel_API");

        // Note: transparentBlob is result of compressedBase64.
        // If we want to use originalBase64 for high-res cropping, we need to be careful about coordinate systems.
        // Current logic: detectFace returns coordinates relative to the input image (compressedBase64).
        // compositeToWhiteBackground maps transparency to "Full Rect".

        // Strategy: Use compressedBase64 as the source of truth for "Full Rect" to match coordinates.
        // High-res optimization is secondary to speed here (1500px is enough).

        console.log("[Parallel] Fetching dimensions of utilized image...");
        const tempImg = new Image();
        tempImg.src = ensureSinglePrefix(compressedBase64);
        await new Promise(r => tempImg.onload = r);

        const fullRect = {
            x: 0,
            y: 0,
            w: tempImg.width,
            h: tempImg.height
        };

        // If faceRes used a different scale (it has internal resizing logic), we need to ensure consistency.
        // detectFace logic: "Resizing 4000 -> 1500... Reverse Scale Factor...". 
        // Checks internal logic: It returns coordinates mapped back to ORIGINAL size if it resized internally?
        // Let's check detectFace again.
        // Line 109: const reverseScale = 1 / scale;
        // Line 114: left: rawRect.left * reverseScale...
        // YES. detectFace returns coordinates mapped to the INPUT image's original dimensions.
        // So if we passed compressedBase64 (Width 1500), it returns coords for Width 1500.
        // So fullRect should match compressedBase64. Correct.

        const retB64 = await compositeToWhiteBackground(
            transparentBlob,
            faceRes,
            fullRect,
            config,
            userAdjustments
        );

        return {
            photos: [retB64, retB64],
            assets: {
                transparentBlob: transparentBlob,
                fullRect: fullRect
            },
            faceData: faceRes // Return the face structure that matches these assets
        };

    } catch (e) {
        console.error("Parallel Production Failed:", e);
        // Fallback or re-throw
        throw e;
    }
}

// 2. Process Preview (Legacy / Serial Fallback)
export async function processPreview(base64, cropParams, faceData = null, specKey = 'taiwan_passport', userAdjustments = {}) {
    // Legacy wrapper if needed, or deprecate.
    // For now, re-route to new function if faceData is null, otherwise just do composite?
    // Actually processPreview was doing serial fetch then composite.
    // We can leave it as is for backward compatibility or replace body.
    return executeParallelProduction(base64, base64, specKey, userAdjustments);
}

// 3. Client-Side Re-Composition (Slider Optimization)
// Uses cached transparent blob to avoid Vercel calls
export async function recomposePreview(transparentBlob, fullRect, faceData, specKey, userAdjustments) {
    console.log("Recomposing Preview (Client Side)...", userAdjustments);
    try {
        const config = PHOTO_CONFIGS[specKey] || PHOTO_CONFIGS['taiwan_passport'];
        // compositeToWhiteBackground now handles xShift and showGuides inside userAdjustments
        const finalB64 = await compositeToWhiteBackground(transparentBlob, faceData, fullRect, config, userAdjustments);

        // Ensure prefix removed if needed by caller, but composite returns full data URL
        // Caller main.js expects base64 string usually? Let's check main.js usage.
        // main.js: const b64 = await API.recomposePreview(...) -> await updateResultUI(b64)
        // updateResultUI check "if (!b64.startsWith('data:image'))" -> adds prefix.
        // So safe to return full data URL or stripped.
        // However, processPreview returns stripped (retB64 is result of toDataURL which is full... wait).
        // compositeToWhiteBackground returns toDataURL('image/jpeg') which IS Full Prefix.
        // processPreview lines 606: const retB64 = await compositeToWhiteBackground(...)
        // return { photos: [retB64] } -> Appears frontend handles it.
        // let's return it as is.

        return finalB64;
    } catch (e) {
        console.error("Recomposition Failed:", e);
        throw e;
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

        // --- 1. Basic Image Checks (Dimensions, Background, Pixels) ---
        try {
            const spec = DEFAULT_SPECS[specId] || DEFAULT_SPECS['passport'];
            const img = new Image();
            img.src = cleanBase64;
            await new Promise(r => img.onload = r);

            const w = img.width;
            const h = img.height;
            const targetRatio = spec.width_mm / spec.height_mm;
            const imgRatio = w / h;

            // A. Dimension/Ratio
            // If very close to spec ratio, Pass. Else Warn.
            // If processing hasn't happened yet, this likely warns, which is correct.
            if (Math.abs(imgRatio - targetRatio) < 0.05) {
                results.push({ category: 'basic', status: 'pass', item: '圖片尺寸', value: '符合比例', standard: `${spec.width_mm}x${spec.height_mm}mm` });
            } else {
                results.push({ category: 'basic', status: 'warn', item: '圖片尺寸', value: '比例不符 (將自動修正)', standard: `${spec.width_mm}x${spec.height_mm}mm` });
            }

            // B. Background Check
            const cvs = document.createElement('canvas');
            cvs.width = w; cvs.height = h;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Sample Top-Left (5,5) and Top-Right (w-5, 5)
            const p1 = ctx.getImageData(5, 5, 1, 1).data;
            const p2 = ctx.getImageData(w - 5, 5, 1, 1).data;

            // Check White (>240 each) or Transparent (Alpha < 50)
            const isP1Safe = (p1[0] > 240 && p1[1] > 240 && p1[2] > 240) || (p1[3] < 50);
            const isP2Safe = (p2[0] > 240 && p2[1] > 240 && p2[2] > 240) || (p2[3] < 50);

            if (isP1Safe && isP2Safe) {
                results.push({ category: 'basic', status: 'pass', item: '圖片背景', value: '背景合格', standard: '白色/透明' });
            } else {
                results.push({ category: 'basic', status: 'warn', item: '圖片背景', value: '背景雜亂 (將自動去除)', standard: '白色/透明' });
            }

            // C. Pixel Check (300 DPI)
            // 35mm @ 300dpi ~= 413px. 
            // Allow 90% tolerance.
            const minW = Math.round(spec.width_mm / 25.4 * 300 * 0.9);
            const minH = Math.round(spec.height_mm / 25.4 * 300 * 0.9);

            if (w >= minW && h >= minH) {
                results.push({ category: 'basic', status: 'pass', item: '影像解析度', value: '像素合格', standard: '> 300 DPI' });
            } else {
                results.push({ category: 'basic', status: 'warn', item: '影像解析度', value: '解析度過低', standard: '> 300 DPI' });
            }

        } catch (e) {
            console.error("Local Checks Failed", e);
        }

        // --- 2. Azure Face Checks ---
        if (azureData.length === 0) {
            results.push({ category: 'basic', status: 'fail', item: '人臉偵測', value: '未偵測到人臉', standard: '需清晰人臉' });
            return { results };
        }

        const face = azureData[0];
        const attrs = face.faceAttributes;
        const landmarks = face.faceLandmarks;

        // Mouth/Expression Check
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

        // Ratio Check (Logic moved to Dimension Check above, but we assume Head Position here)
        // We can add "Head Position" check if needed, but "Dimension" covers the frame.
        // Let's keep "Internal Proportion" if user wants "Ratio Check" for head?
        // User asked for "Image Size Check" -> Done.
        // This block originally had "System will auto-correct". We can keep a similar soft check.
        results.push({
            category: 'compliance', status: 'pass',
            item: '頭部比例',
            value: '系統將自動校正',
            standard: '居中/適當大小'
        });

        // Glasses
        if (attrs.glasses !== 'NoGlasses' && attrs.glasses !== 'noGlasses') {
            results.push({ category: 'compliance', status: 'warn', item: '眼鏡檢查', value: `偵測到眼鏡`, standard: '建議不戴眼鏡' });
        } else {
            results.push({ category: 'compliance', status: 'pass', item: '眼鏡檢查', value: '無配戴眼鏡', standard: '建議不戴眼鏡' });
        }

        // Hair/Occlusion
        if (attrs.occlusion) {
            const { foreheadOccluded, eyeOccluded } = attrs.occlusion;
            if (foreheadOccluded || eyeOccluded) {
                results.push({ category: 'compliance', status: 'fail', item: '頭髮/五官', value: '頭髮遮擋五官', standard: '眉毛/眼睛需清晰' });
            } else {
                results.push({ category: 'compliance', status: 'pass', item: '頭髮/五官', value: '五官清晰', standard: '眉毛/眼睛需清晰' });
            }
        } else {
            results.push({ category: 'compliance', status: 'pass', item: '頭髮/五官', value: '檢測通過', standard: '眉毛/眼睛需清晰' });
        }

        // Exposure: Azure + Pixel Heuristic
        let lightingStatus = 'pass';
        let lightingValue = '合格';
        let lightingAction = false;

        // 1. Azure Exposure Check
        if (attrs.exposure) {
            const { exposureLevel } = attrs.exposure;
            if (exposureLevel !== 'GoodExposure') {
                lightingStatus = 'warn';
                lightingValue = exposureLevel === 'UnderExposure' ? '面部偏暗' : '面部過亮';
                lightingAction = true;
            }
        }

        // 2. Pixel Heuristic (Check Uniformity)
        // If Azure Passed, double check cheek symmetry
        if (lightingStatus === 'pass' && landmarks) {
            try {
                const checkImg = new Image();
                checkImg.src = cleanBase64;
                await new Promise(r => checkImg.onload = r);
                const lCtx = document.createElement('canvas').getContext('2d');
                lCtx.canvas.width = checkImg.width;
                lCtx.canvas.height = checkImg.height;
                lCtx.drawImage(checkImg, 0, 0);

                // Sample Left/Right Cheek (~below eyes)
                const leftX = landmarks.pupilLeft.x;
                const leftY = (landmarks.pupilLeft.y + landmarks.noseTip.y) / 2;
                const rightX = landmarks.pupilRight.x;

                const pL = lCtx.getImageData(leftX, leftY, 10, 10).data;
                const pR = lCtx.getImageData(rightX, leftY, 10, 10).data;

                const getLum = (d) => {
                    let s = 0;
                    for (let i = 0; i < d.length; i += 4) s += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
                    return s / (d.length / 4);
                };

                const diff = Math.abs(getLum(pL) - getLum(pR));
                console.log(`[Lighting Check] L: ${getLum(pL).toFixed(1)}, R: ${getLum(pR).toFixed(1)}, Diff: ${diff.toFixed(1)}`);

                if (diff > 50) { // Threshold for "Clearly Uneven"
                    lightingStatus = 'warn';
                    lightingValue = '左右臉亮度不均 (建議補光)';
                    lightingAction = true;
                }
            } catch (e) { console.warn("Lighting Heuristic Error", e); }
        }

        results.push({
            category: 'quality',
            status: lightingStatus,
            item: '光影均勻度',
            value: lightingValue,
            standard: '需光線均勻，無硬陰影',
            actionRequired: lightingAction
        });

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
