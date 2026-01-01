
import os
import requests
import onnxruntime as ort
import numpy as np
from PIL import Image
import io

# --- ISNet Configuration ---
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx"
MODEL_PATH = "isnet.onnx"

if not os.path.exists(MODEL_PATH):
    print("Downloading ISNet Model...")
    response = requests.get(MODEL_URL)
    with open(MODEL_PATH, "wb") as f:
        f.write(response.content)
    print("Download Complete.")

session = ort.InferenceSession(MODEL_PATH)

def preprocess(image):
    # ISNet Native Resolution
    img = image.resize((1024, 1024), Image.BILINEAR)
    
    img_np = np.array(img).astype(np.float32)
    img_np /= 255.0
    
    # ISNet Normalization
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

# Test
image_path = r"C:/Users/user/.gemini/antigravity/brain/4ecef0e0-7e5d-4137-b681-74f1955ebbc7/uploaded_image_1767271186747.png"
if not os.path.exists(image_path):
    print("Image not found")
    exit()

print(f"Processing {image_path} with ISNet...")
input_image = Image.open(image_path).convert("RGB")
# Debug Input
input_np = np.array(input_image)
print(f"Input Image Mean: {input_np.mean():.4f}, Min: {input_np.min()}, Max: {input_np.max()}")

input_name = session.get_inputs()[0].name
img_input = preprocess(input_image)
output = session.run(None, {input_name: img_input})
mask = postprocess(output[0], input_image.size)

# Stats
mask_np = np.array(mask)
print(f"Mask Mean: {mask_np.mean():.4f}")

# Save
empty = Image.new("RGBA", input_image.size, 0)
final_image = Image.composite(input_image, empty, mask)
final_image.save("test_output_isnet.png")
print("Saved.")
