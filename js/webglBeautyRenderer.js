/**
 * WebGL Beauty Renderer - Real-time Beauty Enhancement
 * Uses WebGL shaders for instant preview updates
 */

class WebGLBeautyRenderer {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.programs = {};
        this.textures = {};
        this.sourceImage = null;
        this.isInitialized = false;

        // Beauty parameters
        this.params = {
            brightness: 0,          // -50 to +50
            contrast: 0,            // -50 to +50
            smoothIntensity: 0,     // 0 to 100 (skin smoothing)
            lipColor: [0.86, 0.31, 0.31], // RGB normalized
            lipIntensity: 0,        // 0 to 100
            blushColor: [1.0, 0.59, 0.59], // RGB normalized
            blushIntensity: 0,      // 0 to 100
            eyeEnlarge: 100,        // 100 to 130
        };

        // Face landmarks for makeup
        this.landmarks = null;
    }

    /**
     * Initialize WebGL context and shaders
     */
    init(canvasId, sourceImage, landmarks = null) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
        }

        // Get WebGL context
        this.gl = this.canvas.getContext('webgl', {
            preserveDrawingBuffer: true,
            premultipliedAlpha: false
        });

        if (!this.gl) {
            console.error('[WebGL Beauty] WebGL not supported, falling back to Canvas 2D');
            return this.initFallback(sourceImage, landmarks);
        }

        this.sourceImage = sourceImage;
        this.landmarks = landmarks;

        // Set canvas size
        this.canvas.width = sourceImage.naturalWidth || sourceImage.width;
        this.canvas.height = sourceImage.naturalHeight || sourceImage.height;

        // Initialize shaders
        this.initShaders();

        // Create source texture
        this.textures.source = this.createTexture(sourceImage);

        // Setup framebuffers for multi-pass rendering
        this.setupFramebuffers();

        this.isInitialized = true;
        console.log('[WebGL Beauty] Initialized:', this.canvas.width, 'x', this.canvas.height);

        // Initial render
        this.render();

        return this;
    }

    /**
     * Initialize shader programs
     */
    initShaders() {
        const gl = this.gl;

        // Vertex shader (shared)
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

        // Fragment shader: Edge-Preserving Bilateral Filter with Skin Detection
        // Stronger smoothing effect while preserving edges
        const bilateralShaderSource = `
            precision highp float;
            uniform sampler2D u_image;
            uniform float u_intensity;
            uniform vec2 u_resolution;
            varying vec2 v_texCoord;
            
            // Relaxed skin color detection - more permissive
            bool isSkinColor(vec3 color) {
                float r = color.r;
                float g = color.g;
                float b = color.b;
                
                // Very relaxed rules for broader skin tone coverage
                // Basic luminance check - not too dark, not too bright
                float lum = r * 0.299 + g * 0.587 + b * 0.114;
                if (lum < 0.1 || lum > 0.95) return false;
                
                // R channel should be relatively strong (most skin tones)
                if (r < 0.15) return false;
                
                // Avoid pure blue/green (background, clothing)
                if (b > r * 1.2 || g > r * 1.3) return false;
                
                // Avoid highly saturated colors (lips, clothing)
                float maxC = max(max(r, g), b);
                float minC = min(min(r, g), b);
                float saturation = (maxC - minC) / (maxC + 0.001);
                if (saturation > 0.7) return false;
                
                return true;
            }
            
            // Simplified edge detection
            float getEdgeStrength(vec2 coord) {
                vec2 texelSize = 1.0 / u_resolution;
                
                vec3 c = texture2D(u_image, coord).rgb;
                vec3 l = texture2D(u_image, coord - vec2(texelSize.x, 0.0)).rgb;
                vec3 r = texture2D(u_image, coord + vec2(texelSize.x, 0.0)).rgb;
                vec3 t = texture2D(u_image, coord - vec2(0.0, texelSize.y)).rgb;
                vec3 b = texture2D(u_image, coord + vec2(0.0, texelSize.y)).rgb;
                
                float dx = distance(l, r);
                float dy = distance(t, b);
                
                return (dx + dy) * 0.5;
            }
            
            void main() {
                vec4 centerColor = texture2D(u_image, v_texCoord);
                
                // Skip if intensity is zero
                if (u_intensity < 0.01) {
                    gl_FragColor = centerColor;
                    return;
                }
                
                float normalizedIntensity = u_intensity / 100.0;
                
                // Get edge strength
                float edgeStrength = getEdgeStrength(v_texCoord);
                
                // Strong edges should be preserved (threshold raised for more smoothing)
                if (edgeStrength > 0.25) {
                    gl_FragColor = centerColor;
                    return;
                }
                
                // Check if skin-colored
                bool isSkin = isSkinColor(centerColor.rgb);
                
                // Apply bilateral filter
                vec3 sum = vec3(0.0);
                float weightSum = 0.0;
                
                // STRONGER parameters for visible effect
                float blurRadius = 2.0 + normalizedIntensity * 4.0;  // 2-6 pixels
                float sigma_r = 0.08 + normalizedIntensity * 0.15;   // Range: 0.08-0.23
                
                // 9x9 kernel for stronger smoothing
                for (int i = -4; i <= 4; i++) {
                    for (int j = -4; j <= 4; j++) {
                        vec2 offset = vec2(float(i), float(j)) * blurRadius / u_resolution;
                        vec4 sampleColor = texture2D(u_image, v_texCoord + offset);
                        
                        // Spatial weight
                        float spatialDist = float(i*i + j*j);
                        float spatialWeight = exp(-spatialDist / 32.0);
                        
                        // Range weight (color difference)
                        float colorDist = distance(centerColor.rgb, sampleColor.rgb);
                        float rangeWeight = exp(-colorDist * colorDist / (2.0 * sigma_r * sigma_r));
                        
                        // For skin, use both weights; for non-skin reduce effect
                        float skinFactor = isSkin ? 1.0 : 0.3;
                        float weight = spatialWeight * rangeWeight * skinFactor;
                        
                        sum += sampleColor.rgb * weight;
                        weightSum += weight;
                    }
                }
                
                vec3 filtered = (weightSum > 0.0) ? sum / weightSum : centerColor.rgb;
                
                // STRONGER blend - more visible smoothing
                // Skin areas get full effect, edges get reduced effect
                float edgeFactor = 1.0 - clamp(edgeStrength * 5.0, 0.0, 0.8);
                float skinBoost = isSkin ? 1.0 : 0.5;
                float blendAmount = normalizedIntensity * edgeFactor * skinBoost;
                
                // Apply with stronger blending (up to 100% at max intensity)
                vec3 finalColor = mix(centerColor.rgb, filtered, blendAmount);
                
                gl_FragColor = vec4(finalColor, centerColor.a);
            }
        `;

        // Fragment shader: Brightness/Contrast + Lip/Blush
        const colorAdjustShaderSource = `
            precision mediump float;
            uniform sampler2D u_image;
            uniform float u_brightness;
            uniform float u_contrast;
            uniform vec3 u_lipColor;
            uniform float u_lipIntensity;
            uniform vec3 u_blushColor;
            uniform float u_blushIntensity;
            uniform vec2 u_resolution;
            uniform vec4 u_lipRect;
            uniform vec4 u_blushLeft;
            uniform vec4 u_blushRight;
            varying vec2 v_texCoord;
            
            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                
                // Apply brightness and contrast
                float brightness = u_brightness / 100.0;
                float contrast = 1.0 + u_contrast / 100.0;
                color.rgb = (color.rgb - 0.5) * contrast + 0.5 + brightness;
                
                // Lip color overlay
                if (u_lipIntensity > 0.0) {
                    vec2 lipCenter = u_lipRect.xy;
                    vec2 lipSize = u_lipRect.zw;
                    vec2 lipDiff = (v_texCoord - lipCenter) / lipSize;
                    float lipDist = length(lipDiff);
                    
                    if (lipDist < 1.0) {
                        float lipBlend = (1.0 - lipDist) * u_lipIntensity / 100.0 * 0.5;
                        color.rgb = mix(color.rgb, u_lipColor, lipBlend);
                    }
                }
                
                // Blush overlay
                if (u_blushIntensity > 0.0) {
                    vec2 leftPos = u_blushLeft.xy;
                    float leftRadius = u_blushLeft.z;
                    float leftDist = distance(v_texCoord, leftPos) / leftRadius;
                    
                    if (leftDist < 1.0) {
                        float blushBlend = pow(1.0 - leftDist, 1.5) * u_blushIntensity / 100.0 * 0.35;
                        color.rgb = mix(color.rgb, u_blushColor, blushBlend);
                    }
                    
                    vec2 rightPos = u_blushRight.xy;
                    float rightRadius = u_blushRight.z;
                    float rightDist = distance(v_texCoord, rightPos) / rightRadius;
                    
                    if (rightDist < 1.0) {
                        float blushBlend = pow(1.0 - rightDist, 1.5) * u_blushIntensity / 100.0 * 0.35;
                        color.rgb = mix(color.rgb, u_blushColor, blushBlend);
                    }
                }
                
                color.rgb = clamp(color.rgb, 0.0, 1.0);
                gl_FragColor = color;
            }
        `;

        // Compile shaders
        this.programs.bilateral = this.createProgram(vertexShaderSource, bilateralShaderSource);
        this.programs.colorAdjust = this.createProgram(vertexShaderSource, colorAdjustShaderSource);

        // Setup vertex buffers
        this.setupVertexBuffers();
    }

    /**
     * Create and compile a shader program
     */
    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('[WebGL Beauty] Program link error:', gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    /**
     * Compile a shader
     */
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('[WebGL Beauty] Shader compile error:', gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }

    /**
     * Setup vertex buffers
     */
    setupVertexBuffers() {
        const gl = this.gl;

        // Full-screen quad positions
        const positions = new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1
        ]);

        // Texture coordinates for source image (flip Y for image loading)
        // WebGL textures are loaded upside down, so we flip here
        const texCoordsSource = new Float32Array([
            0, 1, 1, 1, 0, 0,
            0, 0, 1, 1, 1, 0
        ]);

        // Texture coordinates for framebuffer (NO flip - already correct orientation)
        const texCoordsFB = new Float32Array([
            0, 0, 1, 0, 0, 1,
            0, 1, 1, 0, 1, 1
        ]);

        this.buffers = {
            position: gl.createBuffer(),
            texCoordSource: gl.createBuffer(),
            texCoordFB: gl.createBuffer()
        };

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoordSource);
        gl.bufferData(gl.ARRAY_BUFFER, texCoordsSource, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoordFB);
        gl.bufferData(gl.ARRAY_BUFFER, texCoordsFB, gl.STATIC_DRAW);
    }

    /**
     * Setup framebuffers for multi-pass rendering
     */
    setupFramebuffers() {
        const gl = this.gl;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Create ping-pong framebuffers
        this.framebuffers = [];
        this.textures.fb = [];

        for (let i = 0; i < 2; i++) {
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

            this.framebuffers.push(fb);
            this.textures.fb.push(tex);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /**
     * Create texture from image
     */
    createTexture(image) {
        const gl = this.gl;
        const texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        return texture;
    }

    /**
     * Set parameter and re-render
     */
    setParam(key, value) {
        this.params[key] = value;
        this.render();
    }

    /**
     * Set multiple parameters at once
     */
    setParams(params) {
        Object.assign(this.params, params);
        this.render();
    }

    /**
     * Main render function - multi-pass pipeline
     */
    render() {
        if (!this.isInitialized) return;

        const startTime = performance.now();
        const gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        let currentTexture = this.textures.source;
        let fbIndex = 0;

        // Track if current texture is the source (needs Y flip) or from FB (no flip)
        let isFromSource = true;

        // Pass 1: Bilateral Filter (Skin Smoothing)
        if (this.params.smoothIntensity > 0) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[fbIndex]);
            this.renderBilateral(currentTexture, isFromSource);
            currentTexture = this.textures.fb[fbIndex];
            isFromSource = false; // Now from framebuffer
            fbIndex = 1 - fbIndex;
        }

        // Pass 2: Color Adjustment + Makeup (Final pass to screen)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.renderColorAdjust(currentTexture, isFromSource);

        const renderTime = performance.now() - startTime;
        console.log(`[WebGL Beauty]Rendered in ${renderTime.toFixed(1)} ms`);
    }

    /**
     * Render bilateral filter pass
     */
    renderBilateral(inputTexture, isSourceTexture) {
        const gl = this.gl;
        const program = this.programs.bilateral;

        gl.useProgram(program);

        // Set uniforms
        gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), this.params.smoothIntensity);
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), this.canvas.width, this.canvas.height);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

        this.drawQuad(program, isSourceTexture);
    }

    /**
     * Render color adjustment pass
     */
    renderColorAdjust(inputTexture, isSourceTexture) {
        const gl = this.gl;
        const program = this.programs.colorAdjust;

        gl.useProgram(program);

        // Set uniforms
        gl.uniform1f(gl.getUniformLocation(program, 'u_brightness'), this.params.brightness);
        gl.uniform1f(gl.getUniformLocation(program, 'u_contrast'), this.params.contrast);
        gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), this.canvas.width, this.canvas.height);

        // Lip color
        gl.uniform3fv(gl.getUniformLocation(program, 'u_lipColor'), this.params.lipColor);
        gl.uniform1f(gl.getUniformLocation(program, 'u_lipIntensity'), this.params.lipIntensity);

        // Calculate lip position (estimated for ID photo)
        const lipY = 0.42;  // Normalized Y position (from top)
        const lipH = 0.05;
        const lipW = 0.15;
        gl.uniform4f(gl.getUniformLocation(program, 'u_lipRect'), 0.5, lipY, lipW, lipH);

        // Blush color
        gl.uniform3fv(gl.getUniformLocation(program, 'u_blushColor'), this.params.blushColor);
        gl.uniform1f(gl.getUniformLocation(program, 'u_blushIntensity'), this.params.blushIntensity);

        // Blush positions (estimated for ID photo)
        const blushY = 0.48;
        const blushRadius = 0.08;
        gl.uniform4f(gl.getUniformLocation(program, 'u_blushLeft'), 0.35, blushY, blushRadius, 0);
        gl.uniform4f(gl.getUniformLocation(program, 'u_blushRight'), 0.65, blushY, blushRadius, 0);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

        this.drawQuad(program, isSourceTexture);
    }

    /**
     * Draw full-screen quad
     * @param {WebGLProgram} program 
     * @param {boolean} isSourceTexture - true if rendering source image, false if rendering from framebuffer
     */
    drawQuad(program, isSourceTexture = false) {
        const gl = this.gl;

        // Position attribute
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // TexCoord attribute - use different buffer based on texture source
        const texLoc = gl.getAttribLocation(program, 'a_texCoord');
        const texBuffer = isSourceTexture ? this.buffers.texCoordSource : this.buffers.texCoordFB;
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
        gl.enableVertexAttribArray(texLoc);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    /**
     * Apply eye enlargement (Canvas-based warping)
     */
    applyEyeEnlarge() {
        if (this.params.eyeEnlarge <= 100) return;

        // Eye enlargement requires Canvas 2D for mesh warping
        // This is done as a post-process after WebGL rendering
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const scale = this.params.eyeEnlarge / 100;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Estimated eye positions for ID photo
        const leftEye = { x: w * 0.35, y: h * 0.35 };
        const rightEye = { x: w * 0.65, y: h * 0.35 };
        const eyeRadius = w * 0.08;

        [leftEye, rightEye].forEach(eye => {
            this.magnifyRegion(ctx, eye.x, eye.y, eyeRadius, scale);
        });
    }

    /**
     * Magnify a circular region for eye enlargement
     */
    magnifyRegion(ctx, cx, cy, radius, scale) {
        const r = Math.ceil(radius);
        const x = Math.max(0, Math.floor(cx - r));
        const y = Math.max(0, Math.floor(cy - r));
        const size = r * 2;

        const imageData = ctx.getImageData(x, y, size, size);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size;
        tempCanvas.height = size;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        const offset = (size * (scale - 1)) / 2;
        ctx.drawImage(tempCanvas, x - offset, y - offset, size * scale, size * scale);
        ctx.restore();
    }

    /**
     * Get final image as data URL
     */
    getImageDataURL(format = 'image/jpeg', quality = 0.92) {
        return this.canvas.toDataURL(format, quality);
    }

    /**
     * Reset all parameters
     */
    reset() {
        this.params = {
            brightness: 0,
            contrast: 0,
            smoothIntensity: 0,
            lipColor: [0.86, 0.31, 0.31],
            lipIntensity: 0,
            blushColor: [1.0, 0.59, 0.59],
            blushIntensity: 0,
            eyeEnlarge: 100,
        };
        this.render();
    }

    /**
     * Fallback to Canvas 2D if WebGL not available
     */
    initFallback(sourceImage, landmarks) {
        console.warn('[WebGL Beauty] Using Canvas 2D fallback');
        this.isWebGL = false;
        // Fallback implementation would go here
        return this;
    }

    /**
     * Convert hex color to normalized RGB array
     */
    static hexToRGB(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
    }
}

// Create global instance
window.webglBeautyRenderer = new WebGLBeautyRenderer();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebGLBeautyRenderer;
}
