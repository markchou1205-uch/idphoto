
import os
import requests
import onnxruntime as ort
import numpy as np
from PIL import Image
import io
import base64

# --- API LOGIC (DIRECT PASTE TO ENSURE FIDELITY) ---
# Copied from api/index.py (simplified imports)

MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx"
MODEL_PATH = "isnet-general-use.onnx" # Local

if not os.path.exists(MODEL_PATH):
    print("Downloading ISNet Model...")
    response = requests.get(MODEL_URL)
    with open(MODEL_PATH, "wb") as f:
        f.write(response.content)

print("Loading Session...")
session = ort.InferenceSession(MODEL_PATH)

def preprocess(image):
    # Resize to 1024x1024 (ISNet Native Resolution)
    img = image.resize((1024, 1024), Image.BILINEAR)
    img_np = np.array(img).astype(np.float32)
    img_np /= 255.0
    # ISNet Normalization: Mean [0.5, 0.5, 0.5], Std [1.0, 1.0, 1.0]
    img_np -= np.array([0.5, 0.5, 0.5])
    img_np /= np.array([1.0, 1.0, 1.0])
    img_np = img_np.transpose((2, 0, 1))
    img_np = np.expand_dims(img_np, axis=0)
    return img_np

def postprocess(pred, original_size):
    ma = np.squeeze(pred)
    ma = (ma - ma.min()) / (ma.max() - ma.min() + 1e-8)
    ma_img = Image.fromarray((ma * 255).astype(np.uint8), mode='L')
    ma_img = ma_img.resize(original_size, Image.LANCZOS)
    return ma_img

# --- REPRODUCTION ---
image_path = r"C:/Users/user/.gemini/antigravity/brain/4ecef0e0-7e5d-4137-b681-74f1955ebbc7/uploaded_image_1767280360701.png"
if not os.path.exists(image_path):
    print("Failing Image Not Found!")
    exit()

print(f"Processing Failing Image: {image_path}")
input_image = Image.open(image_path).convert("RGB")
input_name = session.get_inputs()[0].name
img_input = preprocess(input_image)

# Run Model
output = session.run(None, {input_name: img_input})

# Post Process
mask = postprocess(output[0], input_image.size)
mask_np = np.array(mask)
print(f"Mask Mean: {mask_np.mean():.4f} (Should be > 10 for visibility)")

# Save Debug Images
mask.save("debug_mask.png")
empty = Image.new("RGBA", input_image.size, 0)
final_image = Image.composite(input_image, empty, mask)
final_image.save("debug_final.png")
print("Saved debug_mask.png and debug_final.png")
