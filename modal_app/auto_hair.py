"""
Modal Auto Hair - Lightweight Hair Segmentation Enhancement
Optimized version using KNN Matting instead of heavy Deep Image Matting
"""
import modal
import io
import base64
import numpy as np
from PIL import Image

# Define Modal image with dependencies
auto_hair_image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "torch==2.0.1",
        "torchvision==0.15.2", 
        "opencv-contrib-python-headless==4.8.0.74",  # Need contrib for ximgproc
        "Pillow==10.0.0",
        "numpy==1.24.3",
        "scikit-image==0.21.0",
        "fastapi[standard]==0.115.0",  # Required for web endpoints
    )
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
)

# Create Modal app
app = modal.App("auto-hair-segmentation", image=auto_hair_image)

# Volume for caching models
models_volume = modal.Volume.from_name("auto-hair-models", create_if_missing=True)


@app.cls(
    gpu="T4",
    timeout=120,
    container_idle_timeout=300,  # Keep warm 5 min
    volumes={"/models": models_volume},
)
class AutoHairModel:
    """Auto Hair Segmentation Model - Lightweight Version"""
    
    @modal.enter()
    def load_models(self):
        """Load models on container start"""
        import torch
        import torchvision
        
        print("🚀 Loading Auto Hair models...")
        
        # Load DeepLab v3+ for segmentation
        self.model = torchvision.models.segmentation.deeplabv3_resnet101(
            weights='DEFAULT'
        )
        self.model.eval()
        
        if torch.cuda.is_available():
            self.model = self.model.cuda()
            print("✅ Models loaded on GPU")
        else:
            print("⚠️ Models loaded on CPU")
    
    @modal.method()
    def enhance_hair(self, image_b64: str) -> dict:
        """
        Main hair enhancement pipeline
        
        Pipeline:
        1. DeepLab v3+ Segmentation
        2. Trimap Generation  
        3. KNN Matting (lightweight alternative to Deep Image Matting)
        4. Alpha Refinement
        """
        import time
        import torch
        import cv2
        
        start_time = time.time()
        timings = {}
        
        try:
            # Decode image
            img_array = self._decode_image(image_b64)
            h, w = img_array.shape[:2]
            
            # Stage 1: Segmentation
            print("🎯 Stage 1: DeepLab Segmentation...")
            stage_start = time.time()
            mask = self._run_segmentation(img_array)
            timings['segmentation'] = time.time() - stage_start
            
            # Stage 2: Trimap Generation
            print("🎨 Stage 2: Trimap Generation...")
            stage_start = time.time()
            trimap = self._generate_trimap(mask, dilate=10, erode=5)
            timings['trimap'] = time.time() - stage_start
            
            # Stage 3: Hair Region Enhancement
            print("✨ Stage 3: Hair Enhancement...")
            stage_start = time.time()
            alpha = self._enhance_hair_region(img_array, trimap, mask)
            timings['enhancement'] = time.time() - stage_start
            
            # Stage 4: Composite
            stage_start = time.time()
            result_img = self._composite_alpha(img_array, alpha)
            timings['composite'] = time.time() - stage_start
            
            # Encode output
            result_b64 = self._encode_image(result_img)
            
            total_time = time.time() - start_time
            timings['total'] = total_time
            
            print(f"✅ Processing complete in {total_time:.2f}s")
            
            return {
                "refined_image": result_b64,
                "timings": {k: f"{v:.3f}s" for k, v in timings.items()},
                "success": True,
                "size": f"{w}x{h}"
            }
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
            
            return {
                "error": str(e),
                "success": False,
                "timings": timings
            }
    
    def _decode_image(self, b64_str: str) -> np.ndarray:
        """Decode base64 to numpy array"""
        # Remove data URL prefix
        if 'base64,' in b64_str:
            b64_str = b64_str.split('base64,')[1]
        
        img_bytes = base64.b64decode(b64_str)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        
        return np.array(img)
    
    def _encode_image(self, img: np.ndarray) -> str:
        """Encode RGBA numpy array to base64 PNG with compression"""
        # [FIX 1] Memory Alignment - Ensure contiguous array to prevent stride errors
        img_contiguous = np.ascontiguousarray(img.astype('uint8'))
        
        pil_img = Image.fromarray(img_contiguous, mode='RGBA')
        buffer = io.BytesIO()
        
        # PNG compression for smaller transfer size
        pil_img.save(buffer, format='PNG', optimize=True, compress_level=6)
        
        img_bytes = buffer.getvalue()
        # Return PURE Base64 without data URL prefix
        # Frontend will add prefix if needed
        b64_str = base64.b64encode(img_bytes).decode('utf-8')
        
        return b64_str
    
    def _run_segmentation(self, img: np.ndarray) -> np.ndarray:
        """Run DeepLab v3+ person segmentation"""
        import torch
        import torchvision.transforms as T
        
        # Prepare input
        transform = T.Compose([
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        # Convert to tensor
        input_tensor = transform(img).unsqueeze(0)
        
        if torch.cuda.is_available():
            input_tensor = input_tensor.cuda()
        
        # Run inference
        with torch.no_grad():
            output = self.model(input_tensor)['out'][0]
        
        # Get person mask (class 15 in COCO)
        mask = output.argmax(0).cpu().numpy()
        person_mask = (mask == 15).astype(np.uint8) * 255
        
        return person_mask
    
    def _generate_trimap(self, mask: np.ndarray, dilate: int = 10, erode: int = 5) -> np.ndarray:
        """Generate trimap with automatic boundary detection"""
        import cv2
        
        # Ensure binary
        _, binary_mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        
        # Erode for definite foreground
        kernel_erode = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode, erode))
        fg_mask = cv2.erode(binary_mask, kernel_erode, iterations=1)
        
        # Dilate for definite background
        kernel_dilate = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate, dilate))
        bg_mask = cv2.dilate(binary_mask, kernel_dilate, iterations=1)
        bg_mask = 255 - bg_mask
        
        # Create trimap (0=bg, 128=unknown, 255=fg)
        trimap = np.full(mask.shape, 128, dtype=np.uint8)
        trimap[fg_mask == 255] = 255  
        trimap[bg_mask == 255] = 0
        
        return trimap
    
    def _enhance_hair_region(self, img: np.ndarray, trimap: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """
        [ULTRA-AGGRESSIVE] Complete grey halo elimination:
        1. 6px Erosion (was 4px)
        2. Binary Threshold  
        3. Strong Alpha Power Falloff (1.5)
        4. Very Strict Clipping (<80)
        """
        import cv2
        
        # 1. Ultra-aggressive 6px Erosion - Cut deep into edges
        kernel_harden = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        alpha_uint8 = cv2.erode(mask, kernel_harden, iterations=6)  # 6 iterations!
        
        # 2. Binary Threshold
        _, alpha_binary = cv2.threshold(alpha_uint8, 10, 255, cv2.THRESH_BINARY)
        
        # 3. [ULTRA] Strong Power Falloff - Force faster decay
        alpha_float = alpha_binary.astype(np.float32) / 255.0
        alpha_falloff = np.power(alpha_float, 1.5)  # 1.5 for aggressive decay
        alpha_result = (alpha_falloff * 255).astype(np.uint8)
        
        # 4. [ULTRA] Very Strict Alpha Clipping
        # Cut at 80 (31% opacity) - removes ALL visible grey
        alpha_result[alpha_result < 80] = 0
        
        return alpha_result
    
    def _detect_hair_region(self, mask: np.ndarray, img_shape: tuple) -> np.ndarray:
        """Detect hair region (upper 40% of person mask)"""
        import cv2
        
        # Find bounding box of person
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return np.zeros_like(mask)
        
        # Get largest contour (person)
        largest_contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Hair region: top 40% of person bbox
        hair_region = np.zeros_like(mask)
        hair_height = int(h * 0.4)
        hair_region[y:y+hair_height, x:x+w] = 255
        
        # Combine with person mask
        return cv2.bitwise_and(hair_region, mask)
    
    def _feather_edges(self, alpha: np.ndarray, trimap: np.ndarray, width: int = 5) -> np.ndarray:
        """Apply gradient-based feathering to edges"""
        import cv2
        from skimage.filters import gaussian
        
        # Detect edges
        edges = (trimap == 128)
        
        # Apply gaussian blur to smooth edges
        if np.any(edges):
            alpha_smooth = gaussian(alpha, sigma=2, preserve_range=True)
            alpha[edges] = alpha_smooth[edges]
        
        return alpha
    
    def _composite_alpha(self, img: np.ndarray, alpha: np.ndarray) -> np.ndarray:
        """[ULTRA] Maximum inpainting coverage for complete grey removal"""
        import cv2
        
        # Ensure alpha is same size
        if alpha.shape != img.shape[:2]:
            alpha = cv2.resize(alpha, (img.shape[1], img.shape[0]))
        
        # 1. Color de-contamination with MAXIMUM radius
        edge_mask = (alpha > 0).astype(np.uint8) * 255
        
        # [ULTRA] Massive inpaint radius: 25 (was 15)
        # Ensures complete grey halo coverage on high-res images
        img_clean = cv2.inpaint(img, 255 - edge_mask, 25, cv2.INPAINT_TELEA)
        
        # 2. Alpha Channel Integrity
        img_clean = np.nan_to_num(img_clean, nan=0.0)
        img_clean = np.clip(img_clean, 0, 255)
        alpha = np.nan_to_num(alpha, nan=0.0)
        alpha = np.clip(alpha, 0, 255)
        
        # 3. Strict Clipping
        result = np.dstack((img_clean, alpha))
        
        return result
    
    def _decontaminate_colors(self, img: np.ndarray, alpha: np.ndarray) -> np.ndarray:
        """[EXTREME FIX] Aggressive color dilation - expand clean colors outward"""
        import cv2
        
        # Expanded edge range
        edge_mask = (alpha > 1) & (alpha < 254)
        
        # [EXTREME FIX] Massively dilate edge_mask (15px expansion)
        # This ensures contaminated region is 100% covered
        kernel_massive = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))  # 15px radius
        edge_mask_dilated = cv2.dilate(edge_mask.astype(np.uint8), kernel_massive, iterations=1)
        edge_mask_dilated = edge_mask_dilated.astype(bool)
        
        # Find interior region (source of clean colors)
        interior_mask = (alpha >= 245).astype(np.uint8) * 255
        
        if interior_mask.sum() == 0:
            return img
        
        # [EXTREME FIX] Use morphological color expansion
        # Dilate interior colors to aggressively overwrite grey contamination
        
        # Create mask of interior region
        interior_region = (alpha >= 245)
        
        # Extract interior colors
        img_interior = img.copy()
        img_interior[~interior_region] = 0  # Zero out non-interior
        
        # Aggressively dilate interior colors to cover edge
        kernel_expand = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        img_expanded = cv2.dilate(img_interior, kernel_expand, iterations=2)
        
        # Apply expanded colors to edge region
        mask_3d = np.stack([edge_mask_dilated] * 3, axis=-1)
        result = np.where(mask_3d & (img_expanded > 0).all(axis=-1, keepdims=True), 
                         img_expanded, img)
        
        # Fallback to LAB inpainting for any remaining gaps
        remaining_gaps = edge_mask_dilated & (img_expanded == 0).any(axis=-1)
        if remaining_gaps.any():
            img_lab = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_BGR2LAB)
            L, A, B = cv2.split(img_lab)
            
            gap_mask = remaining_gaps.astype(np.uint8) * 255
            L_clean = cv2.inpaint(L, gap_mask, inpaintRadius=10, flags=cv2.INPAINT_TELEA)
            
            img_lab_clean = cv2.merge([L_clean, A, B])
            result = cv2.cvtColor(img_lab_clean, cv2.COLOR_LAB2BGR)
        
        # Gamma compensation
        result = self._apply_gamma_compensation(result, alpha)
        
        return result.astype(np.uint8)
    
    def _apply_gamma_compensation(self, img: np.ndarray, alpha: np.ndarray) -> np.ndarray:
        """Apply gamma/brightness boost to semi-transparent pixels"""
        import cv2
        
        # Semi-transparent pixels that need brightening
        semi_trans = (alpha > 5) & (alpha < 250)
        
        if not semi_trans.any():
            return img
        
        # Calculate boost factor based on transparency
        # More transparent = more boost (towards white)
        alpha_norm = alpha.astype(np.float32) / 255.0
        boost_factor = 1.0 + (1.0 - alpha_norm) * 0.3  # Up to 30% boost
        
        # Apply boost only to semi-transparent pixels
        result = img.astype(np.float32)
        for c in range(3):
            result[semi_trans, c] = np.clip(
                result[semi_trans, c] * boost_factor[semi_trans],
                0, 255
            )
        
        return result.astype(np.uint8)
    
    def _unpremultiply_alpha(self, img: np.ndarray, alpha: np.ndarray) -> np.ndarray:
        """Un-premultiply RGB channels if they were pre-multiplied with alpha"""
        # Convert to float for division
        img_float = img.astype(np.float32)
        alpha_float = alpha.astype(np.float32) / 255.0
        
        # Avoid division by zero
        alpha_safe = np.maximum(alpha_float, 0.001)
        
        # [OPTIMIZED] Widened range from (10,250) to (5,255)
        # This ensures even sharp edges near 255 are corrected
        edge_mask = (alpha > 5) & (alpha < 255)
        
        if edge_mask.any():
            for c in range(3):
                img_float[edge_mask, c] = np.clip(
                    img_float[edge_mask, c] / alpha_safe[edge_mask],
                    0, 255
                )
        
        return img_float.astype(np.uint8)


# Webhook for API access
@app.function()
@modal.web_endpoint(method="POST", label="hair-api")
def api_endpoint(data: dict):
    """
    Public API endpoint
    
    POST Request:
    {
        "image": "base64_string"
    }
    """
    image_b64 = data.get("image")
    
    if not image_b64:
        return {"error": "No image provided", "success": False}, 400
    
    # Process
    model = AutoHairModel()
    result = model.enhance_hair.remote(image_b64)
    
    return result


# Health check endpoint
@app.function()
@modal.web_endpoint(method="GET", label="health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "auto-hair-segmentation"}


# Local test entrypoint
@app.local_entrypoint()
def test_local():
    """Test the model locally with a sample image"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: modal run auto_hair.py --image-path <path>")
        return
    
    image_path = sys.argv[1]
    
    print(f"🧪 Testing Auto Hair with: {image_path}")
    
    # Read image
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode('utf-8')
    
    # Process
    model = AutoHairModel()
    result = model.enhance_hair.remote(img_b64)
    
    if result['success']:
        print(f"✅ Success!")
        print(f"Timings: {result['timings']}")
        
        # Save result
        output_path = image_path.replace('.', '_enhanced.')
        output_b64 = result['refined_image']
        img_bytes = base64.b64decode(output_b64)
        
        with open(output_path, 'wb') as f:
            f.write(img_bytes)
        
        print(f"💾 Saved to: {output_path}")
    else:
        print(f"❌ Failed: {result.get('error')}")
