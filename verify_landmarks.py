import urllib.request
import urllib.error
import json
import math
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

ENDPOINT = "https://my-face-check-01.cognitiveservices.azure.com/face/v1.0/detect?returnFaceAttributes=glasses,occlusion&returnFaceLandmarks=true&detectionModel=detection_01&returnFaceId=false"
KEY = "9R4yKV3pVJAMIwE040Pwp4pyH5Mslu3vJp7gz82iQZClGdSQuH7xJQQJ99BLACqBBLyXJ3w3AAAKACOGKXtB"
IMAGE_PATH = r"C:/Users/user/.gemini/antigravity/brain/e2e3b401-9531-4bca-a94d-08c03fcfebc5/uploaded_image_1766484788767.png"

print(f"Analyzing Landmarks: {IMAGE_PATH}")

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
            lm = data[0]['faceLandmarks']
            
            # Key Points
            nose_tip = lm['noseTip']
            nose_root = lm['noseRootLeft'] # Rough center approximation or average with Right
            # Better midline: Average of noseRootLeft and noseRootRight? API gives noseRootLeft/Right? 
            # Actually Azure gives 'noseRootLeft' and 'noseRootRight' ? Let's check keys.
            # Azure keys: noseTip, noseRootLeft, noseRootRight? No, usually noseRootLeft/Right are for eye corners?
            # Standard Azure: pupilLeft, pupilRight, noseTip, mouthLeft, mouthRight, eyebrowLeftOuter...
            
            # Let's calculate midline X based on Nose Tip first
            mid_x = nose_tip['x']
            
            # Eyebrows
            lb_outer = lm['eyebrowLeftOuter']
            rb_outer = lm['eyebrowRightOuter']
            
            l_dist = mid_x - lb_outer['x']
            r_dist = rb_outer['x'] - mid_x
            
            diff = abs(l_dist - r_dist)
            avg_dist = (l_dist + r_dist) / 2
            ratio = diff / avg_dist if avg_dist > 0 else 0
            
            print(f"\n--- Symmetry Analysis (Center: NoseTip X={mid_x:.1f}) ---")
            print(f"Left Eyebrow Outer X: {lb_outer['x']:.1f} | Dist: {l_dist:.1f}")
            print(f"Right Eyebrow Outer X: {rb_outer['x']:.1f} | Dist: {r_dist:.1f}")
            print(f"Difference: {diff:.1f}")
            print(f"Asymmetry Ratio: {ratio:.2%} (Threshold: 10%)")
            
            # Eyes
            le_outer = lm['eyeLeftOuter']
            re_outer = lm['eyeRightOuter']
            l_eye_dist = mid_x - le_outer['x']
            r_eye_dist = re_outer['x'] - mid_x
            eye_ratio = abs(l_eye_dist - r_eye_dist) / ((l_eye_dist + r_eye_dist)/2)
            
            print(f"\nEye Symmetry Ratio: {eye_ratio:.2%}")

            # Dump relevant landmarks
            print("\n--- Raw Landmarks (Partial) ---")
            print(f"noseTip: {nose_tip}")
            print(f"eyebrowLeftOuter: {lb_outer}")
            print(f"eyebrowRightOuter: {rb_outer}")

except Exception as e:
    print(f"Error: {e}")
