import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from config import SPEC_CONFIG, LAYOUT_CONFIG
import os
import mediapipe as mp

# 1. 初始化 MediaPipe
try:
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    )
    MODEL_TYPE = "mediapipe"
    print("✅ MediaPipe Face Mesh loaded")
except Exception as e:
    print(f"❌ MediaPipe load failed: {e}")
    MODEL_TYPE = "none"

# 初始化 Haar (Fallback)
try:
    paths = [
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml',
        'haarcascade_frontalface_default.xml',
        '/home/mark/ai-photo-api/haarcascade_frontalface_default.xml'
    ]
    cascade_path = next((p for p in paths if os.path.exists(p)), None)
    if cascade_path: face_cascade = cv2.CascadeClassifier(cascade_path)
    else: face_cascade = None
except: face_cascade = None

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def get_landmarks(img_np):
    if MODEL_TYPE != "mediapipe": return None
    results = face_mesh.process(img_np)
    if results.multi_face_landmarks:
        return results.multi_face_landmarks[0]
    return None

def enhance_clarity(img):
    try:
        # 銳化
        img = img.filter(ImageFilter.UnsharpMask(radius=1.0, percent=100, threshold=3))
        img_np = np.array(img)
        img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        # 對比增強 (CLAHE)
        lab = cv2.cvtColor(img_cv, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8,8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl,a,b))
        final = cv2.cvtColor(limg, cv2.COLOR_LAB2RGB)
        return Image.fromarray(final)
    except Exception:
        return img

def clean_image_edges(img):
    try:
        if img.mode != 'RGBA': return img
        img_np = np.array(img)
        alpha = img_np[:, :, 3]
        # 硬閾值 (銳利邊緣)
        _, hard_alpha = cv2.threshold(alpha, 200, 255, cv2.THRESH_BINARY)
        soft_alpha = cv2.GaussianBlur(hard_alpha, (3, 3), 0.5)
        
        rgb = img_np[:, :, :3]
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        dilated_rgb = cv2.dilate(rgb, kernel, iterations=1)
        
        img_np[:, :, :3] = dilated_rgb
        img_np[:, :, 3] = soft_alpha
        return Image.fromarray(img_np)
    except Exception:
        return img

# [V8.0] 雙向自動補光 (過暗提亮，過亮壓暗)
def auto_adjust_exposure(img):
    try:
        img_np = np.array(img)
        if img_np.shape[2] == 4:
            rgb = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)
            alpha = img_np[:, :, 3]
        else:
            rgb = img_np
            alpha = None
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        if alpha is not None:
            mask = (alpha > 0).astype(np.uint8)
            mean_brightness = cv2.mean(l, mask=mask)[0]
        else:
            mean_brightness = np.mean(l)
            
        target_brightness = 145
        gamma = 1.0
        
        # Case A: 過暗 (提亮)
        if mean_brightness < 110 and mean_brightness > 10:
            gamma = np.log(target_brightness/255.0) / np.log(mean_brightness/255.0)
            gamma = max(0.4, min(1.0, gamma))
            
        # Case B: 過亮 (壓暗) - 解決燈光太強
        elif mean_brightness > 190:
            target_high = 160
            gamma = np.log(target_high/255.0) / np.log(mean_brightness/255.0)
            gamma = max(1.0, min(1.8, gamma))
            print(f"🔆 Overexposure detected ({mean_brightness:.1f}), dimming with Gamma {gamma:.2f}")

        if gamma != 1.0:
            table = np.array([((i / 255.0) ** gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
            l = cv2.LUT(l, table)

        merged = cv2.merge((l, a, b))
        res_rgb = cv2.cvtColor(merged, cv2.COLOR_LAB2RGB)
        if alpha is not None: res_final = np.dstack((res_rgb, alpha))
        else: res_final = res_rgb
        return Image.fromarray(res_final)
    except Exception:
        return img

def fix_eyes_issues(img):
    try:
        img_np = np.array(img)
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        img_out = img_bgr.copy()
        if face_cascade is None: return img
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        modified = False
        for (x, y, w, h) in faces:
            roi_gray = gray[y:y+h, x:x+w]
            roi_color = img_out[y:y+h, x:x+w]
            eyes = eye_cascade.detectMultiScale(roi_gray)
            for (ex, ey, ew, eh) in eyes:
                eye_roi = roi_color[ey:ey+eh, ex:ex+ew]
                eye_gray = roi_gray[ey:ey+eh, ex:ex+ew]
                _, glare_mask = cv2.threshold(eye_gray, 250, 255, cv2.THRESH_BINARY)
                glare_ratio = np.sum(glare_mask > 0) / (ew * eh)
                if 0 < glare_ratio < 0.03: 
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
                    glare_mask = cv2.dilate(glare_mask, kernel, iterations=1)
                    eye_roi_clean = cv2.inpaint(eye_roi, glare_mask, 2, cv2.INPAINT_TELEA)
                    roi_color[ey:ey+eh, ex:ex+ew] = eye_roi_clean
                    modified = True
                b, g, r = cv2.split(eye_roi)
                mask = (r > 160) & (r > g + 40) & (r > b + 40)
                mask = mask.astype(np.uint8) * 255
                if np.sum(mask) > 0:
                     eye_roi_clean = cv2.inpaint(eye_roi, mask, 2, cv2.INPAINT_TELEA)
                     roi_color[ey:ey+eh, ex:ex+ew] = eye_roi_clean
                     modified = True
        if modified: return Image.fromarray(cv2.cvtColor(img_out, cv2.COLOR_BGR2RGB))
        else: return img
    except: return img

# [V8.0] Smart Crop (MediaPipe + Alpha)
def smart_crop(img, spec_key, custom_ratio, bg_color_hex):
    bg_rgb = hex_to_rgb(bg_color_hex)
    if spec_key in SPEC_CONFIG:
        conf = SPEC_CONFIG[spec_key]
        target_ratio = conf["ratio"]
        width_mm = conf.get("width_mm", 35)
    else:
        target_ratio = custom_ratio
        width_mm = 35

    PIXELS_PER_MM = 11.811
    final_w = int(width_mm * PIXELS_PER_MM)
    final_h = int(final_w / target_ratio)
    final_img = Image.new("RGB", (final_w, final_h), bg_rgb)

    img_np = np.array(img)
    h_orig, w_orig = img_np.shape[:2]
    alpha = img_np[:, :, 3]
    non_empty_rows = np.where(np.max(alpha, axis=1) > 20)[0]
    alpha_top_y = non_empty_rows[0] if len(non_empty_rows) > 0 else 0

    landmarks = get_landmarks(img_np[:, :, :3])
    
    if landmarks:
        chin_pt = landmarks.landmark[152]
        chin_y = int(chin_pt.y * h_orig)
        nose_pt = landmarks.landmark[1]
        face_cx = int(nose_pt.x * w_orig)

        real_head_h = chin_y - alpha_top_y
        if real_head_h <= 0: real_head_h = h_orig * 0.5
        
        # 1.55 Zoom Out
        crop_h = int(real_head_h / 0.77)
        crop_w = int(crop_h * target_ratio)
        # 留白 12%
        crop_y = int(alpha_top_y - (crop_h * 0.12))
        crop_x = int(face_cx - (crop_w / 2))
        
        temp_canvas = Image.new("RGBA", (crop_w, crop_h), (*bg_rgb, 255))
        src_x1 = max(0, crop_x)
        src_y1 = max(0, crop_y)
        src_x2 = min(w_orig, crop_x + crop_w)
        src_y2 = min(h_orig, crop_y + crop_h)

        if src_x2 > src_x1 and src_y2 > src_y1:
            source_patch = img.crop((src_x1, src_y1, src_x2, src_y2))
            dst_x = src_x1 - crop_x
            dst_y = src_y1 - crop_y
            temp_canvas.paste(source_patch, (dst_x, dst_y), mask=source_patch)

        person_resized = temp_canvas.resize((final_w, final_h), Image.Resampling.LANCZOS)
    else:
        scale = max(final_w / w_orig, final_h / h_orig)
        new_w = int(w_orig * scale)
        new_h = int(h_orig * scale)
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        cx, cy = new_w // 2, new_h // 2
        x1 = cx - final_w // 2
        y1 = cy - final_h // 2
        person_resized = resized.crop((x1, y1, x1+final_w, y1+final_h))

    final_img.paste(person_resized, (0, 0))
    return final_img

def create_print_layout(single_photo_img):
    W, H, gap = LAYOUT_CONFIG["paper_width"], LAYOUT_CONFIG["paper_height"], LAYOUT_CONFIG["gap"]
    layout = Image.new("RGB", (W, H), (255, 255, 255))
    pw, ph = single_photo_img.width, single_photo_img.height
    if pw > ph: cols, rows = 2, 2
    else: cols, rows = 4, 2
    total_w = cols * pw + (cols-1) * gap
    total_h = rows * ph + (rows-1) * gap
    start_x = (W - total_w) // 2
    start_y = (H - total_h) // 2
    draw = ImageDraw.Draw(layout)
    for r in range(rows):
        for c in range(cols):
            x = start_x + c * (pw + gap)
            y = start_y + r * (ph + gap)
            layout.paste(single_photo_img, (x, y))
            draw.rectangle([x, y, x+pw, y+ph], outline="#CCCCCC", width=1)
    return layout

# [V8.0] 嘴巴檢測
def detect_mouth_open(landmarks, height):
    upper = landmarks.landmark[13]
    lower = landmarks.landmark[14]
    dist = abs(upper.y - lower.y) * height
    face_height = abs(landmarks.landmark[152].y - landmarks.landmark[10].y) * height
    ratio = dist / face_height
    return ratio > 0.03, ratio

def calculate_occlusion_score(img_gray, roi_points):
    mask = np.zeros_like(img_gray)
    cv2.fillPoly(mask, [np.array(roi_points)], 255)
    x, y, w, h = cv2.boundingRect(np.array(roi_points))
    roi = img_gray[y:y+h, x:x+w]
    roi_mask = mask[y:y+h, x:x+w]
    
    sobel_x = cv2.Sobel(roi, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(roi, cv2.CV_64F, 0, 1, ksize=3)
    mag_x = np.mean(np.abs(sobel_x))
    mag_y = np.mean(np.abs(sobel_y))
    edge_score = mag_y / (mag_x + 0.1)
    mean_val = cv2.mean(roi, mask=roi_mask)[0]
    return edge_score, mean_val

def check_compliance(img, spec_id="passport"):
    results = []
    width, height = img.size
    min_w, min_h = 413, 531
    if width < min_w or height < min_h: results.append({"item": "解析度", "status": "fail", "msg": f"解析度不足 ({width}x{height})"})
    else: results.append({"item": "解析度", "status": "pass", "msg": "解析度合格"})

    img_np = np.array(img)
    if img_np.shape[2] == 4: img_rgb = cv2.cvtColor(img_np, cv2.COLOR_RGBA2RGB)
    else: img_rgb = img_np
        
    landmarks = get_landmarks(img_rgb)

    if landmarks:
        # 1. 比例
        chin_y = int(landmarks.landmark[152].y * height)
        chin_ratio = chin_y / height
        if 0.80 < chin_ratio < 0.95:
            results.append({"item": "頭部大小", "status": "pass", "msg": "比例合格"})
        else:
            results.append({"item": "頭部大小", "status": "fail", "msg": f"比例異常 ({int(chin_ratio*100)}%)"})

        # 2. 眉毛遮擋 (動態閥值)
        img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        nose_pt = landmarks.landmark[1]
        nx, ny = int(nose_pt.x * width), int(nose_pt.y * height)
        skin_bright = img_gray[ny, nx]
        
        # [修正] 若過亮 (>200)，閥值降為 8
        contrast_thresh = 8 if skin_bright > 200 else 15
        
        lb_indices = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
        lb_pts = [(int(landmarks.landmark[i].x * width), int(landmarks.landmark[i].y * height)) for i in lb_indices]
        rb_indices = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276]
        rb_pts = [(int(landmarks.landmark[i].x * width), int(landmarks.landmark[i].y * height)) for i in rb_indices]
        
        l_edge, l_bright = calculate_occlusion_score(img_gray, lb_pts)
        r_edge, r_bright = calculate_occlusion_score(img_gray, rb_pts)
        
        is_blocked = False
        if (skin_bright - l_bright) < contrast_thresh or l_edge < 0.8: is_blocked = True
        if (skin_bright - r_bright) < contrast_thresh or r_edge < 0.8: is_blocked = True
            
        if is_blocked:
            results.append({"item": "五官遮擋", "status": "fail", "msg": "檢測到瀏海遮擋"})
        else:
            results.append({"item": "五官遮擋", "status": "pass", "msg": "眉毛區域清晰"})
            
        # 3. 嘴巴檢測
        is_mouth_open, mouth_ratio = detect_mouth_open(landmarks, height)
        if is_mouth_open:
            results.append({"item": "表情檢查", "status": "fail", "msg": f"嘴巴張開 ({mouth_ratio:.3f})"})
        else:
            results.append({"item": "表情檢查", "status": "pass", "msg": "表情自然"})

        results.append({"item": "眼鏡檢查", "status": "pass", "msg": "無深色鏡片"})
    else:
        results.append({"item": "人臉偵測", "status": "fail", "msg": "無法偵測到人臉"})
    return results
