import urllib.request
import urllib.error
import json
import ssl

# Bypass SSL context if needed (local dev environment)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

ENDPOINT = "https://my-face-check-01.cognitiveservices.azure.com/face/v1.0/detect?returnFaceAttributes=glasses,occlusion&returnFaceLandmarks=true&detectionModel=detection_01&returnFaceId=false"
KEY = "9R4yKV3pVJAMIwE040Pwp4pyH5Mslu3vJp7gz82iQZClGdSQuH7xJQQJ99BLACqBBLyXJ3w3AAAKACOGKXtB"

# Absolute path to the user's uploaded image
IMAGE_PATH = r"C:/Users/user/.gemini/antigravity/brain/e2e3b401-9531-4bca-a94d-08c03fcfebc5/uploaded_image_1766484788767.png"

print(f"Analyzing Image: {IMAGE_PATH}")

try:
    with open(IMAGE_PATH, 'rb') as f:
        img_data = f.read()
    
    headers = {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'application/octet-stream'
    }

    req = urllib.request.Request(ENDPOINT, data=img_data, headers=headers, method='POST')

    with urllib.request.urlopen(req, context=ctx) as response:
        data = json.loads(response.read().decode('utf-8'))
        
        if len(data) == 0:
            print("No face detected.")
        else:
            face = data[0]
            attrs = face['faceAttributes']
            print("\n--- Detection Results ---")
            print(f"Occlusion Data: {json.dumps(attrs['occlusion'], indent=2)}")
            print(f"Glasses Data: {attrs['glasses']}")
            # Also check coordinates of eyebrows/eyes if needed for custom logic
            # print(f"Landmarks: {json.dumps(face['faceLandmarks'], indent=2)}")

except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
