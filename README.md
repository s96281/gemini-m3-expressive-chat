# Gemini M3 Expressive Chat

> 一款深度借鑒 **Google Gemini** 與 **OpenAI ChatGPT** 頂級互動體驗，並全面採用 **Material 3 Expressive** 現代設計語言打造的高表現力 AI 對話網頁應用。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)
![E2E Tests](https://img.shields.io/badge/Playwright%20E2E-251%20Passed-success?logo=playwright)

---

## ✨ 核心特色與體驗設計

### 1. 汲取 Gemini 的精緻互動
- **動態推理折疊面板（Thinking Accordion）**：即時呈現思維鏈（Reasoning / Thinking Tokens），附帶動態計時秒數，支援流暢平滑展開與收合。
- **浮動膠囊輸入底座（Floating Pill Input Dock）**：採用 M3 表現力 28px Squircle 圓角與浮動投影，支援動態多行自動撐高（44px ~ 200px）。
- **靈感建議卡片（Zero State Suggestion Chips）**：首頁提供多面向的提示詞卡片引導，點擊即時發問。

### 2. 借鑒 ChatGPT 的成熟架構
- **對話樹分支與多版本導航（Branch Stepper `< 1/2 >`）**：在任一歷史訊息重新編輯或重試時，自動建立分支版本，並可隨時切換不同版本回答。
- **懸浮操作列（Message Action Toolbar）**：支援一鍵複製、重新生成、分支導航、反饋評價與語音朗讀。
- **時間軸分類側邊欄**：自動依「今天、昨天、前 7 天、前 30 天、更早」分類歷史對話，支援標題即時重命名、置頂釘選、全文模糊搜尋與多格式匯出（Markdown / JSON / 純文字）。

### 3. Material 3 Expressive 現代設計語言
- **5 組動態主題色盤**：內建 Ocean（大洋藍）、Purple（流光紫）、Emerald（翡翠綠）、Rose（玫瑰粉）、Amber（琥珀黃）種子色盤。
- **完整暗黑模式支援**：支援深色、淺色及隨系統自適應模式。
- **高表現力曲率與形變動畫**：Squircle 圓角、Elevation 層級陰影，以及隨串流狀態變形的發送/停止（Morphing Send/Stop）按鈕。

### 4. 強大多功能內容呈現（Rich Content & Artifact Sandbox）
- **GitHub Flavored Markdown**：完整支援表格、任務清單、引用塊與標籤。
- **PrismJS 語法著色**：支援代碼高亮、行號顯示與一鍵複製代碼。
- **KaTeX 數學公式**：流暢渲染行內及塊級 LaTeX 數學與科學公式。
- **互動沙盒抽屜（Artifact Sandbox Pane）**：自動提取對話中的 HTML / SVG / 網頁代碼，可在右側安全沙盒中即時預覽並進行互動！

### 5. 雙模式 Universal AI 串流引擎
- **即開即玩（免 Key 智慧模擬）**：內建模擬打字時延與隨機抖動引擎，無須配置 API Key 即可體驗完整的流式串流、停止生成與思考鏈。
- **支援主流真實 API**：可在設定面板輕鬆填入並直接調用：
  - **Google Gemini API** (SSE)
  - **OpenAI 兼容 API** (SSE)
  - **本機 Ollama 串流**

---

## 🚀 快速開始

### 環境需求
- Node.js >= 18
- npm 或 pnpm / yarn

### 安裝與啟動
```bash
# 1. 複製專案庫
git clone https://github.com/s96281/gemini-m3-expressive-chat.git
cd gemini-m3-expressive-chat

# 2. 安裝依賴
npm install

# 3. 啟動本機開發伺服器
npm run dev
```

開啟瀏覽器前往 `http://localhost:5173` 即可開始體驗！

### 生產建置
```bash
# 執行 TypeScript 檢查與 Vite 構建
npm run build

# 本機預覽生產打包成品
npm run preview
```

### 執行測試
```bash
# 執行 Vitest 單元測試 (76 項測試)
npm run test

# 執行 Playwright 端到端 (E2E) 測試 (251 項測試)
npm run test:e2e
```

---

## 📂 專案架構一覽

```
src/
├── components/
│   ├── artifact/       # Artifact 沙盒側邊抽屜（即時網頁/SVG預覽）
│   ├── conversation/   # 對話流、訊息氣泡、思考鏈面板、分支切換器
│   ├── dock/           # 浮動膠囊輸入底座、變形按鈕、語音與附件按鈕
│   ├── layout/         # M3 AppShell、導航側邊欄、頂部導覽列
│   ├── rich/           # Markdown 渲染器、KaTeX 公式、Prism 代碼塊、資料表格
│   └── settings/       # 模型設定、Personas 人設預設、M3 滑桿與開關
├── services/           # 通用 AI 串流引擎 (Simulated / Gemini / OpenAI / Ollama)
├── store/              # Zustand 對話、設定與 Artifact 狀態機
├── theme/              # M3 Expressive Tokens 與 ThemeProvider
├── types/              # 完整的 TypeScript 型別定義
└── utils/              # 對話樹分支演算法與持久化儲存
```

---

## 📄 授權條款

本專案採用 [MIT License](LICENSE) 授權。
