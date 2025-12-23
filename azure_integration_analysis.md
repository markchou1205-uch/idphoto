# Azure Face API 整合分析報告

## 1. 現有 API 介面分析

目前 `js/api.js` 中與合規檢查相關的函式如下：

```javascript
// js/api.js

// 1. 人臉偵測
export async function detectFace(base64) {
    try {
        const res = await fetch(`${API_BASE_URL}/generate/detect`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ image_base64: base64 })
        });
        if (res.ok) return await res.json();
    } catch (e) { console.error(e); }
    return null;
}

// 2. 合規檢查 (Check)
export async function runCheckApi(imgBase64) {
    try {
        const res = await fetch(`${API_BASE_URL}/generate/check`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            // 傳送圖片與規格 ID
            body: JSON.stringify({ image_base64: imgBase64, spec_id: state.currentSpecId })
        });
        return await res.json();
    } catch (e) { throw e; }
}
```

### 後端回傳 JSON 格式

根據 `main.js` 中 `renderReport(data)` 函式的邏輯，目前後端回傳的 `data` 結構如下：

```json
{
  "results": [
    {
      "category": "basic",       // 分類: basic(基礎), compliance(合規), quality(畫質)
      "status": "pass",          // 狀態: pass, warn, fail
      "item": "五官定位",         // 檢查項目名稱
      "standard": "需清晰可見",   // 標準描述 (可選)
      "value": "檢測通過"         // 檢測數值或結果描述
    },
    {
      "category": "compliance",
      "status": "fail",
      "item": "嘴巴閉合",
      "standard": "不可露齒",
      "value": "偵測到露齒"
    }
    // ...更多項目
  ]
}
```

**人臉座標格式**：
根據 `detectFace` 的一般慣例與 `editor.js` (雖然未詳細列出但可推斷)，通常回傳格式包含 `faceRectangle` 或類似結構：
```json
{
  "found": true,
  "box": { "x": 100, "y": 100, "width": 200, "height": 200 }, // 或是 faceRectangle
  "landmarks": { ... } // 五官點
}
```

---

## 2. 圖片資料流確認

*   **目前方式**：前端將圖片轉為 **Base64** 字串，透過 JSON Body 發送 (`Content-Type: application/json`)。
*   **Azure Face API 需求**：
    *   Azure 支援 URL 或 **Binary (application/octet-stream)**。
    *   Azure **不直接支援** 在 JSON Body 中傳送 Base64 字串。
    *   **整合建議**：前端需將 Base64 轉換為 **Blob** 或 **ArrayBuffer**，並以 `application/octet-stream` 發送至 Azure 端點。

---

## 3. 規格連動邏輯分析

目前 `photo_specs.json` 檔案存在但**未被前端直接使用**。
前端的規格邏輯是寫死在 `main.js` (lines 6-11) 與 `js/config.js` (lines 3-32) 中。

**現行流程**：
1.  使用者在 UI 選擇規格 (如 `passport`)，更新 `state.currentSpecId`。
2.  呼叫 `runCheckApi` 時，將 `spec_id: 'passport'` 傳給後端。
3.  **後端伺服器** 負責讀取對應的規則 (如：不可露齒、不可戴眼鏡) 並進行判定。

**Azure 整合挑戰**：
Azure Face API **只會回傳客觀數據** (例如：`smile: 0.8` (笑), `glass: NoGlasses` (無眼鏡))，它**不懂**「台灣護照」的規則。
因此，若要改用 Azure，**「判定邏輯」必須從後端移至前端 (或中間層)**。

**新流程建議**：
1.  呼叫 Azure API 取得屬性 (Attributes)。
2.  前端讀取 `photo_specs.json` (或 `config.js` 裡的 `ai_rules`)。
3.  前端比對：`if (spec.ai_rules.teeth_exposure === false && azureResult.smile > 0.1) -> FAIL`。

---

## 4. 環境變數準備

目前專案**沒有**環境變數管理機制。`js/config.js` 僅匯出常數。

建議修改 `js/config.js` 如下，以便填入 Azure 資訊：

```javascript
export const CONFIG = {
    API_BASE_URL: "https://video.pdfsolution.dpdns.org", // 既有後端 (若仍需保留部分功能)
    AZURE: {
        ENDPOINT: "https://<your-resource-name>.cognitiveservices.azure.com",
        KEY: "<your-subscription-key>" // 注意：純前端專案暴露 Key 有資安風險
    }
};
// 為了相容舊代碼
export const API_BASE_URL = CONFIG.API_BASE_URL;
```

---

## 5. 修改建議與整合計畫

要在不大幅改動 `main.js` 的情況下切換至 Azure，我們需要重寫 `js/api.js` 中的 `runCheckApi`，讓它充當「轉接器 (Adapter)」。

### 擬定修改策略：

1.  **引入規格定義**：在 `api.js` 引入 `DEFAULT_SPECS` 或 `photo_specs.json`。
2.  **實作 Base64 to Blob**：新增 helper function 處理圖片轉換。
3.  **呼叫 Azure**：使用 `fetch` POST binary 到 Azure Detect Endpoint。
4.  **轉譯結果 (關鍵)**：
    *   Azure 回傳 raw data。
    *   `runCheckApi` 內部自行實作 mapping 邏輯，將 Azure data 轉換為原本後端回傳的 `{ results: [...] }` 格式。
    *   這樣 `main.js` 的 `renderReport` 完全不用改。

### 程式碼範本 (預覽)：

```javascript
// 偽代碼概念
export async function runCheckApi(imgBase64) {
    // 1. 準備資料
    const blob = base64ToBlob(imgBase64);
    
    // 2. 呼叫 Azure
    const azureRes = await fetch(`${AZURE_ENDPOINT}/face/v1.0/detect?returnFaceAttributes=...`, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': AZURE_KEY,
            'Content-Type': 'application/octet-stream'
        },
        body: blob
    });
    const azureData = await azureRes.json();
    
    // 3. 讀取當前規格規則
    const currentRules = SPECS[state.currentSpecId].ai_rules;
    
    // 4. 在前端進行判定 (模擬原有後端邏輯)
    const results = [];
    if (currentRules.teeth_exposure === false && azureData[0].faceAttributes.smile > 0.1) {
        results.push({ category: 'compliance', status: 'fail', item: '表情', value: '偵測到笑容/露齒' });
    }
    // ... 更多規則
    
    return { results }; // 傳回符合 UI 預期的格式
}
```
