---
name: test
description: E2E 測試開發流程 — Playwright
---

# E2E 測試開發流程

使用 Playwright 測試使用者操作流程（`test/e2e/`）。

## 使用方式

> **前置條件**：`.flow.md` 必須已放入 `spec/e2e-flows/`（外部產出）。

```bash
/test e2e                # 自動偵測模式 — 分析狀態、產出執行計畫
/test e2e setup          # 建立測試基礎架構（helpers、hooks）
/test e2e spec <feature> # .flow.md → .spec.ts 生成
/test e2e batch <start> <end>  # 批次生成 spec
/test e2e auto [--limit N]     # 自動偵測缺 spec 的 feature
/test e2e red <feature>  # 紅燈 - 跑測試收集失敗
/test e2e green <feature>  # 綠燈 - 修復 UI/mock/API 讓測試通過
/test e2e pipeline <feature>   # 完整流程 (spec→red→green)
/test e2e handwritten [<path>]  # vibe 視覺/互動測試（diff-driven，獨立於 spec）
```

### 參數說明

| 參數 | 說明 | 範例 |
|------|------|------|
| `<feature>` | feature 檔案名稱或編號 | `01`, `01-使用者登入` |
| `<start>` `<end>` | feature 編號範圍 | `03 10` |
| `--limit N` | 最多處理 N 個（auto） | |
| `--continue-on-error` | 失敗時繼續（batch） | |

## 現有 Feature 檔案

!`ls -1 spec/gherkin-feature/*.dsl.feature 2>/dev/null | head -15 || echo "(無)"`

---

## 必讀文件

根據指令讀取對應的子檔（每個子檔包含該 phase 的完整規則、範例和流程）：

| Phase | 子檔 |
|-------|------|
| e2e（自動偵測） | [detect.md](e2e/references/detect.md) |
| e2e setup | [setup.md](e2e/references/setup.md) |
| e2e spec | [spec.md](e2e/references/spec.md) |
| e2e batch / auto / pipeline | [pipeline.md](e2e/references/pipeline.md) |
| e2e red | [red.md](e2e/references/red.md) |
| e2e green | [green.md](e2e/references/green.md) |
| e2e handwritten | [handwritten.md](e2e/references/handwritten.md) |

> Flow 檔案（`.flow.md`）由外部工具產出，手動放入 `spec/e2e-flows/`。

---

## 測試指令

```bash
npm run test:e2e              # Headless（自動啟動 dev server）
npm run test:e2e:headed       # 有頭模式
npm run test:e2e:ui           # Playwright UI 模式
```
