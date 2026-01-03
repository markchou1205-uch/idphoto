export class ManualEditor {
    constructor(imageUrl, onConfirm, onCancel, initialCrop = null) {
        this.imageUrl = imageUrl;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
        this.initialCrop = initialCrop;

        // Canvas state
        this.canvas = null;
        this.ctx = null;
        this.scale = 1;
        this.offset = { x: 0, y: 0 }; // Use Object for vector
        this.isDragging = false;
        this.lastPos = { x: 0, y: 0 };
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
            
            <div style="margin-top:20px; display:flex; gap:15px; z-index:10001; align-items:center;">
                 <button class="id-btn id-btn-secondary" id="zoom-out" title="縮小"><i class="bi bi-dash-lg"></i> －</button>
                 <button class="id-btn id-btn-secondary" id="zoom-in" title="放大"><i class="bi bi-plus-lg"></i> ＋</button>
                 <div style="width:20px;"></div>
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

        // Zoom Buttons
        this.overlay.querySelector('#zoom-in').onclick = () => {
            this.scale *= 1.05;
            this.draw();
        };
        this.overlay.querySelector('#zoom-out').onclick = () => {
            this.scale *= 0.95;
            this.draw();
        };
    }

    initGuides() {
        // Red dashed lines REMOVED

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
            // Calculated Logic
            if (this.initialCrop) {
                // Inherit System Crop
                // Target Canvas is 350x450
                // initialCrop = {x,y,w,h} (source coordinates)

                // We want: source rect (x,y,w,h) to fill canvas (350,450)
                // Scale = CanvasW / CropW
                this.scale = this.canvas.width / this.initialCrop.w;

                // Offset calculation:
                // We want point (CropX, CropY) to be at (0,0) on canvas
                // DrawImage(img, offX, offY, imgW*scale, imgH*scale)
                // So offX = -CropX * scale
                this.offset = {
                    x: -this.initialCrop.x * this.scale,
                    y: -this.initialCrop.y * this.scale
                };
            } else {
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
                this.offset.x = (this.cw - this.img.width * this.scale) / 2;
                this.offset.y = (this.ch - this.img.height * this.scale) / 2;
            }
            this.draw();
        };
        this.img.src = this.imageUrl;
    }

    draw() {
        if (!this.img) return;

        // Clear with WHITE
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // Apply Filters (Brightness + Contrast)
        this.ctx.filter = 'brightness(1.1) contrast(1.05)';

        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);
        this.ctx.drawImage(this.img, 0, 0);

        this.ctx.restore();
    }

    bindEvents() {
        // Drag
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastPos.x = e.clientX;
            this.lastPos.y = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastPos.x;
            const dy = e.clientY - this.lastPos.y;
            this.lastPos.x = e.clientX;
            this.lastPos.y = e.clientY;

            this.offset.x += dx;
            this.offset.y += dy;
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

            // Center Zoom based on canvas center
            const rect = this.canvas.getBoundingClientRect();
            const mx = rect.width / 2;
            const my = rect.height / 2;

            // Old World Pos of Center
            const wx = (mx - this.offset.x) / this.scale;
            const wy = (my - this.offset.y) / this.scale;

            this.scale = newScale;

            // New Offset
            this.offset.x = mx - wx * this.scale;
            this.offset.y = my - wy * this.scale;

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
