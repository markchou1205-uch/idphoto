# AI Studio Pro (AI 影像工作室 Pro) - Project Overview

## 1. 任務與目標 (Mission)
本專案為一個 Web-based 的 **AI 證件照製作工具**，旨在提供使用者快速、自動化的證件照生成服務。
主要功能包含：
- **自動偵測與裁切**：上傳照片後，自動偵測人臉並依據所選規格裁切。
- **多規格支援**：支援台灣護照、身分證、健保卡、駕照、美國簽證等多種標準尺寸。
- **AI 智能審查**：檢查照片是否符合官方規範（如五官定位、光線陰影、背景色等）。
- **智能修復**：針對未通過審查的照片提供 AI 修復功能。
- **排版與下載**：提供單張下載或 4x6 排版下載功能，並支援 Email 寄送。

## 2. 檔案配置 (File Configuration)

專案目錄結構如下：

```text
/
├── index.html          # 主頁面 (UI 結構)
├── style.css           # 自定義樣式表
├── main.js             # 主程式邏輯 (Controller)
├── photo_specs.json    # 證件照規格設定檔
├── admin.html          # (尚待開發/內部用) 管理頁面
├── js/
│   ├── api.js          # API 呼叫封裝
│   ├── config.js       # 全域設定 (包含 API URL)
│   ├── editor.js       # 圖片編輯與畫布操作邏輯
│   ├── state.js        # 全域狀態管理
│   └── ui.js           # UI 渲染與互動邏輯
└── .git/               # Git 版本控制
```

## 3. 架構 (Architecture)

本應用採用 **前後端分離 (Client-Server)** 架構：

- **Frontend (Client)**: 
  - 純靜態 HTML/JS 網頁。
  - 使用瀏覽器原生 ES Modules 進行模組化開發。
  - 狀態管理透過 `state.js` 集中控管。
  - 透過 `fetch` API 與後端溝通。

- **Backend (Server)**:
  - 外部 API 服務，Base URL 設定於 `js/config.js`。
  - 負責繁重的 AI 運算（人臉偵測、圖片生成、合規檢查）。

## 4. 技術棧 (Technology Stack)

- **核心語言**: HTML5, CSS3, JavaScript (ES6+ Module)
- **UI 框架**: Bootstrap 5.3 (排版與元件), Bootstrap Icons (圖示)
- **樣式**: Vanilla CSS (搭配 Bootstrap)
- **外部依賴**: 無大型 Frontend Framework (如 React/Vue)，保持輕量化。

## 5. API 呼叫 (API Endpoints)

後端 API Base URL: `https://video.pdfsolution.dpdns.org`

| 功能 | HTTP Method | Endpoint | 描述 |
|Desc|Method|Path|Details|
|---|---|---|---|
| **人臉偵測** | POST | `/generate/detect` | 上傳圖片，回傳人臉位置資訊。 |
| **預覽生成** | POST | `/generate/preview` | 依據規格 ID 與裁切參數，生成預覽(藍/白底)圖片。 |
| **合規檢查** | POST | `/generate/check` | 對生成圖片進行多項合規性檢測 (光線, 角度等)。 |
| **智能修復** | POST | `/generate/fix` | 修復照片畫質、移除背景雜訊等。 |
| **排版生成** | POST | `/generate/layout` | 產生 4x6 沖印用排版圖片。 |
| **寄送郵件** | POST | `/send-email` | 將成品寄送至指定 Email。 |

## 6. 重要設定 (Configuration)

- **規格定義 (`photo_specs.json` & `config.js`)**: 定義了不同證件照的尺寸 (mm)、像素解析度、頭部比例限制等。
- **版本資訊**: 如 `14.8 (URL Fixed)`，顯示於頁面左下角。

