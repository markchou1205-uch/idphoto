# Modal Auto Hair Deployment Guide

## 🚀 Quick Start

### Step 1: Authenticate Modal

```bash
# In terminal
cd modal_app
modal token new
```

會打開瀏覽器讓您登入Modal賬號並授權。

### Step 2: Deploy to Modal

```bash
# Deploy the app
modal deploy auto_hair.py
```

部署完成後會顯示webhook URL，例如：
```
✓ Created web function hair-api => https://USERNAME--auto-hair-segmentation-hair-api.modal.run
```

### Step 3: 更新前端配置

複製webhook URL，然後更新`js/modalHairEnhancement.js`:

```javascript
const MODAL_WEBHOOK_URL = 'https://YOUR_USERNAME--auto-hair-segmentation-hair-api.modal.run';
```

替換為您實際的URL。

### Step 4: 本地測試

```bash
# Test with a sample image
modal run auto_hair.py --image-path ../test_portrait.jpg
```

---

## 🧪 測試Modal API

### 方法1: 使用curl測試

```bash
# Prepare base64 image
base64 test_portrait.jpg > test_b64.txt

# Call API
curl -X POST https://YOUR_USERNAME--auto-hair-segmentation-hair-api.modal.run \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(cat test_b64.txt)\"}"
```

### 方法2: 使用Python測試

```python
import requests
import base64

# Read image
with open('test_portrait.jpg', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()

# Call API
response = requests.post(
    'https://YOUR_URL/hair-api',
    json={'image': img_b64}
)

result = response.json()
print(f"Success: {result['success']}")
print(f"Timings: {result['timings']}")

# Save result
if result['success']:
    with open('output_enhanced.png', 'wb') as f:
        f.write(base64.b64decode(result['refined_image']))
```

---

## 📊 監控使用量

### 在Modal Dashboard查看

1. 訪問 https://modal.com/apps
2. 選擇 `auto-hair-segmentation`
3. 查看:
   - 調用次數
   - GPU使用時間
   - 成本統計

### 設置成本告警

在Modal Dashboard: Settings → Spending Limits

建議設置:
- 每日上限: $1
- 每月上限: $30 (使用完免費額度)

---

## 🔧 開發模式

### 即時測試

```bash
# Serve locally (無GPU，僅測試API結構)
modal serve auto_hair.py
```

### 更新部署

```bash
# 修改代碼後重新部署
modal deploy auto_hair.py
```

Modal會自動版本控制，舊版本自動失效。

---

## 🐛 Troubleshooting

### 問題1: modal command not found

```bash
# Windows
pip install modal --user
# Add to PATH: %USERPROFILE%\AppData\Local\Programs\Python\PythonXX\Scripts

# 或使用python -m
python -m modal deploy auto_hair.py
```

### 問題2: GPU timeout

增加timeout設置:
```python
@app.cls(
    gpu="T4",
    timeout=180,  # 增加到3分鐘
    # ...
)
```

### 問題3: 圖片太大導致失敗

在前端壓縮:
```javascript
// 在調用前先壓縮
const MAX_SIZE = 1500;  // Max dimension
const compressed = await resizeImage(originalImage, MAX_SIZE);
await enhanceHairWithModal(compressed);
```

---

## 💰 成本控制

### 預算規劃

**免費額度**: $30/月

| 每月使用量 | 預估成本 | 剩餘免費額度 |
|-----------|---------|-------------|
| 1,000張 | $1.00 | $29 |
| 5,000張 | $5.00 | $25 |
| 10,000張 | $10.00 | $20 |
| 30,000張 | $30.00 | $0 |

### 省錢技巧

1. **容器保持warm** (已設置 `container_idle_timeout=300`)
   - 避免重複冷啟動
   
2. **批量處理** (未來優化)
   - 一次處理多張圖片
   
3. **條件調用**
   - 只在需要時使用Modal
   - 簡單圖片可跳過

---

## 🔒 安全建議

### 1. 保護API端點

添加API Key驗證:

```python
# auto_hair.py
@app.function()
@modal.web_endpoint(method="POST", label="hair-api")
def api_endpoint(data: dict):
    # Verify API key
    api_key = data.get("api_key")
    if api_key != os.environ.get("AUTO_HAIR_API_KEY"):
        return {"error": "Unauthorized"}, 401
    
    # ...
```

### 2. 設置Modal Secrets

```bash
# Create secret
modal secret create auto-hair-api-key AUTO_HAIR_API_KEY=your_secret_key_here
```

然後更新app:
```python
@app.cls(
    # ...
    secrets=[modal.Secret.from_name("auto-hair-api-key")]
)
```

---

## 📈 性能優化

### 當前配置
- GPU: T4 (最便宜，足夠用)
- Container warm time: 5分鐘
- Timeout: 120秒

### 升級選項

如果需要更快速度:

```python
@app.cls(
    gpu="A10G",  # 更快，但貴2-3倍
    # ...
)
```

---

## 🎉 下一步

1. ✅ 部署成功
2. ⬜ 整合到前端API
3. ⬜ 測試實際效果
4. ⬜ 優化參數（dilate, erode, etc.）
5. ⬜ 監控成本與效能

**準備好部署了嗎？執行:**

```bash
cd modal_app
modal deploy auto_hair.py
```
