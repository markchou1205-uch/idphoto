import requests
import os

url = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx"
output_path = "api/silueta.onnx"

def download_file(url, path):
    print(f"Downloading {url} to {path}...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print("Download complete.")
    except Exception as e:
        print(f"Error downloading: {e}")

if __name__ == "__main__":
    download_file(url, output_path)
