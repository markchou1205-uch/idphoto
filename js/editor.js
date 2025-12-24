export class ManualEditor {
    constructor(imageUrl, onConfirm, onCancel) {
        this.imageUrl = imageUrl;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        // State
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;

        // Constants (350x450 box)
        this.cw = 350;
        this.ch = 450;

        this.initUI();
    }

    initUI() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'id-modal-overlay';
        this.overlay.style.flexDirection = 'column';
        this.overlay.style.overflow = 'hidden';

        this.overlay.innerHTML = `
            <div style="color:white; font-size:1.2rem; margin-bottom:10px; font-weight:bold;">手動調整 / 裁切</div>
            <div style="color:#ccc; margin-bottom:15px; font-size:0.9rem;">
                滾輪縮放 • 拖曳移動 • 需將頭頂與下巴對齊紅線
            </div>
            
            <div id="editor-stage" style="position:relative; width: 350px; height: 450px; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5); border: 2px solid white;">
                <!-- Canvas Layer -->
                <canvas id="editor-canvas" width="350" height="450" style="position:absolute; top:0; left:0; cursor: move;"></canvas>
                
                <!-- Guidelines Layer (Pointer Events None) -->
                <div id="editor-guides" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></div>
            </div>
            
            <div style="margin-top:20px; display:flex; gap:15px; z-index:10001">
                 <button class="id-btn id-btn-secondary" id="editor-cancel">取消</button>
                 <button class="id-btn id-btn-primary" id="editor-confirm">確認建立成品</button>
            </div>
            <div style="margin-top:10px; z-index:10001">
                 <label style="color:white; cursor:pointer"><input type="checkbox" id="guide-toggle" checked> 顯示對照線</label>
            </div>
        `;

        document.body.appendChild(this.overlay);

        this.canvas = this.overlay.querySelector('#editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.guides = this.overlay.querySelector('#editor-guides');

        this.initGuides();
        this.loadImage();
        this.bindEvents();

        // Bind Buttons
        this.overlay.querySelector('#editor-confirm').onclick = () => this.handleConfirm();
        this.overlay.querySelector('#editor-cancel').onclick = () => this.close();
        this.overlay.querySelector('#guide-toggle').onchange = (e) => {
            this.guides.style.display = e.target.checked ? 'block' : 'none';
        };
    }

    initGuides() {
        // Red dashed lines
        // Top: 0.45cm -> ~10%
        // Bottom: 0.45cm -> ~10% from bottom (or Chin Max 80%)

        const createLine = (topPercent, color) => {
            const l = document.createElement('div');
            l.style.position = 'absolute';
            l.style.left = '0';
            l.style.width = '100%';
            l.style.top = `${topPercent}%`;
            l.style.borderTop = `1px dashed ${color}`;
            return l;
        };

        // Hair Top (10%)
        this.guides.appendChild(createLine(10, 'red'));

        // Chin Bottom (90%) - ensure head leaves some space
        this.guides.appendChild(createLine(90, 'red'));

        // Center V-Line
        const v = document.createElement('div');
        v.style.position = 'absolute';
        v.style.top = '0';
        v.style.height = '100%';
        v.style.left = '50%';
        v.style.borderLeft = '1px dashed rgba(255,255,255,0.5)';
        this.guides.appendChild(v);
    }

    loadImage() {
        this.img = new Image();
        this.img.onload = () => {
            // Initial Fit: Cover
            const rImg = this.img.width / this.img.height;
            const rCan = this.cw / this.ch;

            if (rImg > rCan) {
                // Image wider, fit height
                this.baseScale = this.ch / this.img.height;
            } else {
                // Image taller, fit width
                this.baseScale = this.cw / this.img.width;
            }
            this.scale = this.baseScale;

            // Center
            this.offsetX = (this.cw - this.img.width * this.scale) / 2;
            this.offsetY = (this.ch - this.img.height * this.scale) / 2;

            this.draw();
        };
        this.img.src = this.imageUrl;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.cw, this.ch);
        // Draw with transforms
        // We draw the image at (offsetX, offsetY) with size (w*scale, h*scale)
        this.ctx.drawImage(this.img, this.offsetX, this.offsetY, this.img.width * this.scale, this.img.height * this.scale);
    }

    bindEvents() {
        // Drag
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.lastX = e.clientX;
            this.lastY = e.clientY;

            this.offsetX += dx;
            this.offsetY += dy;
            this.draw();
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Wheel Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const delta = -e.deltaY * zoomSpeed;
            const newScale = Math.max(0.1, this.scale + delta);

            // Zoom towards center of canvas (simplified) or mouse?
            // Simplified: Center zoom for stability, or update offsets
            // Let's do simple scale update, keeping current center?
            // Actually, usually zoom is towards pointer.
            // Let's implement Center Zoom based on canvas center (175, 225)

            const rect = this.canvas.getBoundingClientRect();
            const mx = (rect.left + rect.width / 2) - rect.left; // 175
            const my = (rect.top + rect.height / 2) - rect.top; // 225

            // Old World Pos of Center
            const wx = (mx - this.offsetX) / this.scale;
            const wy = (my - this.offsetY) / this.scale;

            this.scale = newScale;

            // New Offset
            this.offsetX = mx - wx * this.scale;
            this.offsetY = my - wy * this.scale;

            this.draw();
        });
    }

    handleConfirm() {
        // Export the current canvas view
        // The canvas already contains the pixels we see (it's 350x450).
        // So we can just export the canvas content!
        // Wait, standard `toDataURL` exports the CANVAS content, exactly what we want.

        const b64 = this.canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
        if (this.onConfirm) this.onConfirm(b64);
        this.close();
    }

    close() {
        this.overlay.remove();
        if (this.onCancel) this.onCancel();
    }
}
