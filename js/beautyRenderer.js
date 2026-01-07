/**
 * Beauty Renderer - Canvas-based Beauty Enhancement Engine
 * Provides real-time beauty effects for ID photo application
 * Works with or without face landmarks by using position estimation
 */

class BeautyRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.sourceImage = null;
        this.faceLandmarks = null;
        this.originalImageData = null;
        this.estimatedFace = null;

        // Effect parameters
        this.params = {
            brightness: 0,      // -50 to +50
            lipTint: 0,         // 0 to 100
            lipColor: '#dc5050',
            blush: 0,           // 0 to 100
            blushColor: '#ff9696',
            eyeEnlarge: 100,    // 100 to 130 (percentage)
            blemishPoints: []   // Array of {x, y} points to remove
        };
    }

    /**
     * Initialize renderer with canvas and image
     */
    init(canvasId, imageElement, landmarks) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
        }
        this.ctx = this.canvas.getContext('2d');
        this.sourceImage = imageElement;
        this.faceLandmarks = landmarks;

        // Set canvas size to match image
        this.canvas.width = imageElement.naturalWidth || imageElement.width;
        this.canvas.height = imageElement.naturalHeight || imageElement.height;

        // Store original image data
        this.ctx.drawImage(imageElement, 0, 0);
        this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Estimate face positions for ID photos (face is centered)
        this.estimatedFace = this.estimateFacePositions();

        console.log('[BeautyRenderer] Initialized:', this.canvas.width, 'x', this.canvas.height);
        console.log('[BeautyRenderer] Estimated face:', this.estimatedFace);
        return this;
    }

    /**
     * Estimate face feature positions for ID photos
     * ID photos have centered, front-facing portraits
     */
    estimateFacePositions() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // ID photo standard: face is centered, top 1/3 for head
        const faceWidth = w * 0.6;
        const faceCenterX = w / 2;
        const faceCenterY = h * 0.38;  // Face center is about 38% from top

        // Eye positions (eyes at about 35% from top)
        const eyeY = h * 0.35;
        const eyeSpacing = faceWidth * 0.35;

        // Nose position
        const noseY = h * 0.48;

        // Mouth position
        const mouthY = h * 0.58;
        const mouthWidth = faceWidth * 0.4;

        return {
            pupilLeft: { x: faceCenterX - eyeSpacing / 2, y: eyeY },
            pupilRight: { x: faceCenterX + eyeSpacing / 2, y: eyeY },
            noseTip: { x: faceCenterX, y: noseY },
            mouthLeft: { x: faceCenterX - mouthWidth / 2, y: mouthY },
            mouthRight: { x: faceCenterX + mouthWidth / 2, y: mouthY },
            upperLipTop: { x: faceCenterX, y: mouthY - h * 0.02 },
            underLipBottom: { x: faceCenterX, y: mouthY + h * 0.03 },
            faceWidth: faceWidth,
            faceCenterX: faceCenterX,
            faceCenterY: faceCenterY
        };
    }

    /**
     * Get face data (use provided landmarks or estimated)
     */
    getFaceData() {
        if (this.faceLandmarks && this.faceLandmarks.pupilLeft) {
            return this.faceLandmarks;
        }
        return this.estimatedFace;
    }

    /**
     * Update effect parameters
     */
    setParam(key, value) {
        this.params[key] = value;
        this.render();
    }

    /**
     * Main render function - applies all effects
     */
    render() {
        if (!this.ctx || !this.sourceImage) {
            console.error('[BeautyRenderer] Not initialized');
            return;
        }

        // Start with clean canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply brightness filter
        const brightnessValue = 1 + (this.params.brightness / 100);
        this.ctx.filter = `brightness(${brightnessValue})`;

        // Draw base image
        this.ctx.drawImage(this.sourceImage, 0, 0);

        // Reset filter for overlays
        this.ctx.filter = 'none';

        const face = this.getFaceData();

        // Apply lip tint if enabled
        if (this.params.lipTint > 0 && face) {
            this.applyLipTint(face);
        }

        // Apply blush if enabled
        if (this.params.blush > 0 && face) {
            this.applyBlush(face);
        }

        // Apply eye enlargement if needed
        if (this.params.eyeEnlarge > 100 && face) {
            this.applyEyeEnlarge(face);
        }

        // Apply blemish removal
        if (this.params.blemishPoints.length > 0) {
            this.applyBlemishRemoval();
        }

        console.log('[BeautyRenderer] Rendered');
    }

    /**
     * Apply lip tint effect
     */
    applyLipTint(face) {
        const opacity = this.params.lipTint / 100 * 0.6;
        const color = this.hexToRgba(this.params.lipColor, opacity);

        const mouthCenterX = (face.mouthLeft.x + face.mouthRight.x) / 2;
        const mouthCenterY = (face.upperLipTop.y + face.underLipBottom.y) / 2;
        const mouthWidth = Math.abs(face.mouthRight.x - face.mouthLeft.x);
        const mouthHeight = Math.abs(face.underLipBottom.y - face.upperLipTop.y);

        // Draw elliptical lip overlay
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'multiply';
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.ellipse(
            mouthCenterX, mouthCenterY,
            mouthWidth * 0.55, mouthHeight * 0.8,
            0, 0, Math.PI * 2
        );
        this.ctx.fill();
        this.ctx.restore();

        console.log('[BeautyRenderer] Applied lip tint at:', mouthCenterX, mouthCenterY);
    }

    /**
     * Apply blush effect
     */
    applyBlush(face) {
        const opacity = this.params.blush / 100 * 0.4;
        const color = this.params.blushColor;

        const faceWidth = Math.abs(face.pupilRight.x - face.pupilLeft.x);
        const cheekY = face.noseTip.y + this.canvas.height * 0.03;
        const cheekRadius = faceWidth * 0.4;

        // Left cheek
        const leftCheekX = face.pupilLeft.x - faceWidth * 0.25;
        this.drawBlushSpot(leftCheekX, cheekY, cheekRadius, color, opacity);

        // Right cheek
        const rightCheekX = face.pupilRight.x + faceWidth * 0.25;
        this.drawBlushSpot(rightCheekX, cheekY, cheekRadius, color, opacity);

        console.log('[BeautyRenderer] Applied blush');
    }

    /**
     * Draw a soft blush spot
     */
    drawBlushSpot(x, y, radius, color, opacity) {
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
        const rgba = this.hexToRgba(color, opacity);
        const rgbaTransparent = this.hexToRgba(color, 0);

        gradient.addColorStop(0, rgba);
        gradient.addColorStop(0.5, this.hexToRgba(color, opacity * 0.5));
        gradient.addColorStop(1, rgbaTransparent);

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'overlay';
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    /**
     * Apply eye enlargement effect
     */
    applyEyeEnlarge(face) {
        const scale = this.params.eyeEnlarge / 100;
        if (scale <= 1) return;

        const eyeRadius = Math.abs(face.pupilRight.x - face.pupilLeft.x) * 0.18;

        // Left eye magnification
        this.magnifyRegion(face.pupilLeft.x, face.pupilLeft.y, eyeRadius, scale);

        // Right eye magnification
        this.magnifyRegion(face.pupilRight.x, face.pupilRight.y, eyeRadius, scale);

        console.log('[BeautyRenderer] Applied eye enlargement');
    }

    /**
     * Magnify a circular region
     */
    magnifyRegion(cx, cy, radius, scale) {
        const r = Math.ceil(radius * 1.5);
        const x = Math.max(0, Math.floor(cx - r));
        const y = Math.max(0, Math.floor(cy - r));
        const size = r * 2;

        if (x + size > this.canvas.width || y + size > this.canvas.height) return;

        const eyeData = this.ctx.getImageData(x, y, size, size);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size;
        tempCanvas.height = size;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(eyeData, 0, 0);

        const offset = (size * (scale - 1)) / 2;
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.drawImage(
            tempCanvas,
            x - offset, y - offset,
            size * scale, size * scale
        );
        this.ctx.restore();
    }

    /**
     * Apply blemish removal
     */
    applyBlemishRemoval() {
        for (const point of this.params.blemishPoints) {
            this.blurRegion(point.x, point.y, 12);
        }
        console.log('[BeautyRenderer] Applied blemish removal:', this.params.blemishPoints.length, 'points');
    }

    /**
     * Blur a small circular region for blemish removal
     */
    blurRegion(cx, cy, radius) {
        const x = Math.max(0, Math.floor(cx - radius));
        const y = Math.max(0, Math.floor(cy - radius));
        const size = radius * 2;

        if (x + size > this.canvas.width || y + size > this.canvas.height) return;

        const imageData = this.ctx.getImageData(x, y, size, size);
        const data = imageData.data;

        const blurred = this.boxBlur(data, size, size, 4);

        for (let py = 0; py < size; py++) {
            for (let px = 0; px < size; px++) {
                const dx = px - radius;
                const dy = py - radius;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < radius) {
                    const i = (py * size + px) * 4;
                    const blend = Math.pow(1 - (dist / radius), 2);
                    data[i] = data[i] * (1 - blend) + blurred[i] * blend;
                    data[i + 1] = data[i + 1] * (1 - blend) + blurred[i + 1] * blend;
                    data[i + 2] = data[i + 2] * (1 - blend) + blurred[i + 2] * blend;
                }
            }
        }

        this.ctx.putImageData(imageData, x, y);
    }

    /**
     * Simple box blur implementation
     */
    boxBlur(data, width, height, radius) {
        const result = new Uint8ClampedArray(data);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, count = 0;

                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const i = (ny * width + nx) * 4;
                            r += data[i];
                            g += data[i + 1];
                            b += data[i + 2];
                            count++;
                        }
                    }
                }

                const i = (y * width + x) * 4;
                result[i] = r / count;
                result[i + 1] = g / count;
                result[i + 2] = b / count;
            }
        }

        return result;
    }

    /**
     * Add blemish point for removal
     */
    addBlemishPoint(x, y) {
        this.params.blemishPoints.push({ x, y });
        this.render();
    }

    /**
     * Clear all blemish points
     */
    clearBlemishPoints() {
        this.params.blemishPoints = [];
        this.render();
    }

    /**
     * Reset all effects
     */
    reset() {
        this.params = {
            brightness: 0,
            lipTint: 0,
            lipColor: '#dc5050',
            blush: 0,
            blushColor: '#ff9696',
            eyeEnlarge: 100,
            blemishPoints: []
        };
        this.render();
    }

    /**
     * Get final image as data URL
     */
    getImageDataURL(format = 'image/jpeg', quality = 0.92) {
        return this.canvas.toDataURL(format, quality);
    }

    /**
     * Get final image as Blob
     */
    async getImageBlob(format = 'image/jpeg', quality = 0.92) {
        return new Promise((resolve) => {
            this.canvas.toBlob(resolve, format, quality);
        });
    }

    /**
     * Utility: Convert hex color to rgba string
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

// Create global instance
window.beautyRenderer = new BeautyRenderer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeautyRenderer;
}
