from http.server import BaseHTTPRequestHandler
import os
import io
import requests
import base64
import numpy as np
from PIL import Image
import onnxruntime as ort
import json

# Configuration
# Switching to U2NetP (Light weight) ~4.7MB to avoid Vercel Memory/Timeout limits.
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx"
MODEL_PATH = "/tmp/u2netp.onnx"

class U2NetSession:
    def __init__(self):
        self.session = None

    def ensure_session(self):
        if self.session:
            return self.session
        
        if not os.path.exists(MODEL_PATH):
            print("Downloading U2Net Model...")
            response = requests.get(MODEL_URL, stream=True)
            with open(MODEL_PATH, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print("Download Complete.")
        
        print("Loading ONNX Session...")
        self.session = ort.InferenceSession(MODEL_PATH)
        return self.session

# Global Singleton
u2net = U2NetSession()

def preprocess(image):
    # Resize to 320x320 (Standard U2Net Input)
    img = image.resize((320, 320), Image.BILINEAR)
    
    img_np = np.array(img).astype(np.float32)
    # Normalize: (Img - Mean) / Std
    # Mean: [0.485, 0.456, 0.406], Std: [0.229, 0.224, 0.225]
    img_np /= 255.0
    img_np -= np.array([0.485, 0.456, 0.406])
    img_np /= np.array([0.229, 0.224, 0.225])
    
    # HWC -> CHW (1, 3, 320, 320)
    img_np = img_np.transpose((2, 0, 1))
    img_np = np.expand_dims(img_np, axis=0)
    return img_np

def postprocess(pred, original_size):
    # Pred: (1, 1, 320, 320) -> Alpha Mask
    ma = np.squeeze(pred) # (320, 320)
    
    # 1. Normalize 0..1
    ma = (ma - ma.min()) / (ma.max() - ma.min() + 1e-8)
    
    # 2. Hardening Edges (Contrast Boost)
    # Push semi-transparent pixels towards 0 or 1 to reduce blur
    # Thresholding: values < 0.2 become 0, values > 0.8 become 1
    # This simulates a "Harder" mask common in higher res models
    ma = (ma - 0.2) / (0.8 - 0.2) 
    ma = np.clip(ma, 0, 1)

    # 3. Resize back to original size with High Quality Interpolation
    ma_img = Image.fromarray((ma * 255).astype(np.uint8), mode='L')
    ma_img = ma_img.resize(original_size, Image.LANCZOS)
    return ma_img

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "Content-Length required")
                return

            post_data = self.rfile.read(content_length)
            input_image = Image.open(io.BytesIO(post_data)).convert("RGB")
            
            # 1. Prepare Session
            session = u2net.ensure_session()
            
            # 2. Inference
            input_name = session.get_inputs()[0].name
            img_input = preprocess(input_image)
            output = session.run(None, {input_name: img_input})
            
            # 3. Post Process (Mask)
            mask = postprocess(output[0], input_image.size)
            
            # 4. Apply Mask
            empty = Image.new("RGBA", input_image.size, 0)
            final_image = Image.composite(input_image, empty, mask)
            
            # 5. Output
            buffered = io.BytesIO()
            final_image.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()

            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(img_str.encode())
            
        except Exception as e:
            # Capture and return actual error details
            error_msg = f"Internal Error: {str(e)}"
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(error_msg.encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
