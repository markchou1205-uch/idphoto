
import os
import requests
import onnxruntime as ort
import numpy as np
from PIL import Image
import io

# --- Mock Constants ---
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx"
MODEL_PATH = "silueta.onnx" # Local test path

# Ensure Model Exists
if not os.path.exists(MODEL_PATH):
    print("Downloading Model...")
    response = requests.get(MODEL_URL)
    with open(MODEL_PATH, "wb") as f:
        f.write(response.content)
    print("Download Complete.")

# Load Session
session = ort.InferenceSession(MODEL_PATH)

def preprocess(image):
    # Resize to 320x320 (Silueta Native Resolution)
    img = image.resize((320, 320), Image.BILINEAR)
    
    img_np = np.array(img).astype(np.float32)
    
    # TEST: -1 to 1 Normalization
    img_np /= 255.0
    img_np -= np.array([0.5, 0.5, 0.5])
    img_np /= np.array([0.5, 0.5, 0.5])
    
    # HWC -> CHW
    img_np = img_np.transpose((2, 0, 1))
    img_np = np.expand_dims(img_np, axis=0)
    return img_np

def postprocess(pred, original_size):
    ma = np.squeeze(pred)
    ma = (ma - ma.min()) / (ma.max() - ma.min() + 1e-8)
    ma_img = Image.fromarray((ma * 255).astype(np.uint8), mode='L')
    ma_img = ma_img.resize(original_size, Image.LANCZOS)
    return ma_img

# Test Execution
image_path = r"C:/Users/user/.gemini/antigravity/brain/4ecef0e0-7e5d-4137-b681-74f1955ebbc7/uploaded_image_1767279296613.png"
if not os.path.exists(image_path):
    print(f"Error: Image not found at {image_path}")
    exit()

print(f"Processing {image_path}...")
input_image = Image.open(image_path).convert("RGB")
input_name = session.get_inputs()[0].name
img_input = preprocess(input_image)

print(f"Input Shape: {img_input.shape}")
print(f"Input Min/Max: {img_input.min():.4f}, {img_input.max():.4f}")

output = session.run(None, {input_name: img_input})
mask = postprocess(output[0], input_image.size)

# Apply and Save
empty = Image.new("RGBA", input_image.size, 0)
final_image = Image.composite(input_image, empty, mask)
final_image.save("test_output_silueta.png")
print("Saved test_output_silueta.png")

# Debug: Is mask empty?
mask_np = np.array(mask)
print(f"Mask Mean: {mask_np.mean():.4f} (0=Empty, 255=Full)")
