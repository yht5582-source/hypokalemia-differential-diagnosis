# 低血鉀鑑別診斷互動流程 · Hypokalemia Interactive Workup

單一 HTML 檔的低血鉀 (hypokalemia) 臨床決策輔助與教學工具。整合 Harrison's 20e 演算法、內科學誌《低血鉀的診斷與治療》(2010;21:31-39) 與 NHS WAHT-PHA-020 補鉀指引。

**零相依、離線可用**：整份 CSS 與 JavaScript 內嵌於同一檔案，沒有 CDN、沒有建置流程、沒有網路請求。用瀏覽器直接開啟 `index.html` 即可。

---

## 檔案

| 檔案 | 說明 |
|---|---|
| `index.html` | 主程式，約 1,300 行，自給自足的單一檔案 |
| `README.md` | 本文件 |
| `claude/hypokalemia-decision-tree.md` | 決策樹內容主檔（存於 Claude Project），修訂內容時的參考 |

Cowork artifact id：`hypokalemia-workup`（可從桌面版 artifact 側欄直接開啟）

---

## 功能

### 1. 逐步鑑別 Step-by-step
互動式決策樹。每一題包含：

- **判讀依據 (cut-offs)** — 該步驟所有數值切點
- **為什麼問這一題** — 背後的生理機轉，不只是「照著走」
- **麵包屑路徑** — 可點擊任一步跳回去改答案，不必從頭重來

終點卡片提供完整鑑別診斷清單（重點病因以藍色標線標示）、確認檢查、治療指引與警語。

### 2. 檢驗計算機 Calculator
輸入血液與尿液數值，即時計算：

| 指標 | 公式 |
|---|---|
| TTKG | (U<sub>K</sub>/P<sub>K</sub>) ÷ (U<sub>osm</sub>/P<sub>osm</sub>) |
| FE<sub>K</sub> | (U<sub>K</sub>×P<sub>Cr</sub>) ÷ (P<sub>K</sub>×U<sub>Cr</sub>) × 100% |
| Urine K/Cr | U<sub>K</sub> ÷ U<sub>Cr</sub> (mmol/mmol) |
| Urine osmolar gap | 實測 U<sub>osm</sub> − [2(U<sub>Na</sub>+U<sub>K</sub>) + urea + glucose] ≈ 2 × U<sub>NH4</sub> |
| Serum anion gap | Na⁺ − Cl⁻ − HCO₃⁻ |
| 估計缺鉀量 | 分段線性（K⁺ 4→3 ≈ 350 mmol；4→2 ≈ 750 mmol） |

底部的「流程判讀」會綜合尿鉀排泄與酸鹼狀態，直接指出應該走哪一個分支。

Creatinine 欄位可切換 mg/dL 或 mmol/L（換算係數 ÷ 11.312）。TTKG 在 U<sub>osm</sub> ≤ P<sub>osm</sub> 或 U<sub>Na</sub> ≤ 25 mmol/L 時會顯示無效警告。

### 3. 完整流程圖 Full chart
由同一份決策資料**自動繪製**的左至右決策樹 —— 改 `TREE` 物件，流程圖跟著變，不會走鐘。可縮放 (30%–160%)、可直接列印成口袋卡。

### 4. 治療補鉀 Treatment
WAHT-PHA-020 的嚴重度分級表（含口服/靜脈劑量與監測頻率）、靜脈補鉀安全規範、治療五步驟、鉀鹽選擇（KCl vs KHCO₃ vs K citrate vs K phosphate）、特殊情境、ECG 與臨床表現。

### 5. 檢驗參考 Lab panel
內科學誌表二（五項尿鉀排泄指標的預期值與陷阱）、公式速查、鉀離子生理背景、四項臨床迷思。

### 6. 案例測驗 Cases
8 個臨床情境，涵蓋 TPP、原發性高醛固酮症、Gitelman、腸胃道流失、異位性 ACTH、toluene 濫用、自我催吐、甘草誘發之 AME。答題後顯示推理路徑與完整說明。

---

## 修改內容

所有醫學內容集中在 `<script>` 內的三個資料物件，改資料不必動版面：

### `TREE` — 決策樹
```js
節點id: {
  type: "q",                    // "q" = 問題節點；"end" = 終點節點
  step: "Step 5 · 關鍵分岔",     // 顯示於卡片上方與流程圖節點
  title: "尿液鉀排泄率是低還是高？",
  en:    "Rate of urinary K⁺ excretion",
  why:   "為什麼問這一題（支援 HTML）",
  cutoffs: ["切點一", "切點二"],
  opts: [
    { l:"低 Low", s:"副標說明", go:"low_ab", tone:"danger|warn|ok" }
  ]
}
```

終點節點：
```js
節點id: {
  type: "end",
  kind: "dx" | "em" | "stop",   // 影響標籤顏色：鑑別診斷 / 急症 / 流程終止
  title, en, lead,
  causes:   [{ n:"病因名稱", d:"說明", key:1 }],   // key:1 = 重點病因，藍色標線
  sections: [{ h:"確認 Confirm", li:["項目一","項目二"] }],
  note:  "黃色提示框",
  alarm: "紅色警告框",
  next:  { l:"按鈕文字", go:"下一個節點id" }        // 選用；靜態流程圖不會展開此連結
}
```

新增分支只需要加節點並在上游 `opts` 指向它 —— 步驟卡片、麵包屑與靜態流程圖三處都會自動更新。麵包屑的短標籤在 `SHORT` 對照表中設定。

### `CASES` — 案例測驗
```js
{
  story: "病史敘述",
  labs:  ["K⁺ 1.9 mmol/L", "TTKG 2"],   // 第一個空白前的字會自動加粗
  opts:  ["選項A","選項B","選項C","選項D"],
  a:     0,                              // 正確答案索引（0 起算）
  path:  "推理路徑（支援 HTML）",
  ex:    "詳細說明"
}
```

### `F` — 計算機欄位
陣列，每筆 `{ id, l:中文標籤, s:英文說明, u:單位, v:預設值 }`。`u:"sel"` / `"sel2"` 會渲染成可切換單位的下拉選單。

---

## 設計

- **深色模式**：以 `prefers-color-scheme` 自動切換，跟隨系統設定
- **響應式**：手機直式（390px）到桌機（1400px+）皆可用
- **列印**：`@media print` 會隱藏導覽與按鈕、展開全部分頁；流程圖分頁另起新頁
- **無障礙**：分頁使用 `role="tablist"` / `aria-selected`；配色對比符合一般閱讀需求

---

## 已知的內容陷阱（已在頁面內處理）

這幾點是實作過程中經審閱發現、原始文獻本身即存在歧異或風險的地方：

1. **尿 Ca/Cr 的單位** — Harrison's 演算法將 0.20 / 0.15 標示為 molar ratio，但這組數字實為 **mg/mg**（換算 mmol/mmol 須 × 2.82；Gitelman 常用標準為 < 0.20 mmol/mmol）。照字面套用會把 Gitelman 誤判到 Bartter 分支。頁面同時標註兩種單位並附警語。
2. **靜脈補鉀速率** — 僅採 NHS 的 10 mmol/hr（緊急且具連續心電圖監視可至 20 mmol/hr）。文獻中出現的 60 mmol/hour 未予採用。
3. **DKA 的歸屬** — 屬高 anion gap 且 NH₄⁺ 排泄**增加**的分支，不放在 RTA（低 NH₄⁺）病因清單，僅於 RTA 節點以對照方式說明。
4. **FE<sub>K</sub> 切點** — 內科學誌採 < 2%，另有文獻採 < 6.5%，兩者並陳並建議合併 TTKG 與 K/Cr 判讀。
5. **缺鉀量估計** — 採分段線性使 K⁺ = 3.0 與 2.0 兩個引用點連續；細胞內移型低血鉀**不適用**此估計。

---

## 資料來源

1. 李忠政、黃文德、林石化。低血鉀的診斷與治療 (Diagnosis and Treatment of Hypokalemia)。內科學誌 J Intern Med Taiwan 2010;21:31-39 — 圖四、圖五鑑別診斷樹、表二尿鉀排泄指標、表三治療原則
2. Jameson JL, Fauci AS, Kasper DL, Hauser SL, Longo DL, Loscalzo J. *Harrison's Principles of Internal Medicine*, 20th ed. — Diagnostic approach to hypokalemia
3. Worcestershire Acute Hospitals NHS Trust. *Guideline for the Management of Hypokalaemia in Adults*, WAHT-PHA-020 v3 (2023) — 嚴重度分級、口服/靜脈補鉀劑量與注意事項
4. Lin SH, Halperin ML. Hypokalemia: a practical approach to diagnosis and its genetic basis. *Curr Med Chem* 2007;14:1551-65

---

## 免責聲明

本工具為**教學與臨床決策輔助**用途，不能取代臨床判斷、當地醫院處方集與藥物劑量規範。補鉀劑量、輸注速率與濃度務必依照所屬機構之規定執行。使用前請自行核對關鍵數值與最新版指引。
