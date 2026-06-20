# E2E Pipeline / Batch / Auto

## 目標

管理 E2E 測試的完整生命週期：生成 spec → 跑紅燈 → 修綠燈。支援單一、批次和自動偵測模式。

> **前置條件**：`.flow.md` 必須已放入 `spec/e2e-flows/`（外部產出）。本 skill 不負責 flow 生成。

---

## 五種模式

### spec — Spec 生成

```bash
/test e2e spec <feature>
```

讀取 `.flow.md` → 產出 `.spec.ts`。詳見 [spec.md](spec.md)。

### batch — 批次 Spec 生成

```bash
/test e2e batch <start> <end>
/test e2e batch <start> <end> --continue-on-error
```

對指定範圍的 features 依序執行 spec 生成。

### auto — 自動偵測未生成的 Spec

```bash
/test e2e auto [--limit N]
```

掃描所有已有 `.flow.md` 但尚未有 `.spec.ts` 的 feature，依序生成。

### red — 紅燈（跑測試、收集失敗）

```bash
/test e2e red <feature>           # 單一 feature
/test e2e red <start> <end>       # 批次紅燈
```

執行 spec，輸出診斷報告。詳見 [red.md](red.md)。

### green — 綠燈（修復 UI、讓測試通過）

```bash
/test e2e green <feature>         # 單一 feature
/test e2e green <start> <end>     # 批次綠燈
```

分析失敗、修復、重跑直到通過。詳見 [green.md](green.md)。

### pipeline — 完整流程（spec → red → green）

```bash
/test e2e pipeline <feature>              # 單一 feature
/test e2e pipeline <start> <end>          # 批次 pipeline
```

自動依序執行 spec → red → green：

```
spec（生成 .spec.ts）
  │
  ├─ 已存在？→ 跳過 spec 生成
  │
  ↓
red（跑測試、收集失敗）
  │
  ├─ 全部通過？→ 結束（已是綠燈）
  │
  ↓
green（修復 UI、讓測試通過）
  │
  ├─ 全部通過？→ 結束 ✅
  └─ 部分失敗？→ 輸出剩餘失敗報告 ⚠️
```

---

## 前置條件

| 檢查項 | 檔案 | 不存在時 |
|--------|------|---------|
| Flow 架構 | `spec/e2e-flows/_common.flow.md` | 提示「請先將 `_common.flow.md` 放入 `spec/e2e-flows/`」 |
| 目標 Flow | `spec/e2e-flows/{NN}-{name}.flow.md` | 提示「請先將對應的 `.flow.md` 放入 `spec/e2e-flows/`」 |
| E2E 基礎 | `test/e2e/helpers/actions.ts` | 提示先執行 `/test e2e setup` |

---

## 完成判斷

一個 feature 的 E2E 視為「完成」的條件：

```
spec/e2e-flows/{NN}-{name}.flow.md 存在
  AND
test/e2e/specs/{NN}-{name}.spec.ts 存在
  AND
npx playwright test test/e2e/specs/{NN}-{name}.spec.ts 全部通過
```

### auto 偵測邏輯

```
for each spec/e2e-flows/{NN}-{name}.flow.md:
    spec_exists = test/e2e/specs/{NN}-{name}.spec.ts 存在？
    if not spec_exists:
        需要處理 → 加入待處理清單
```

---

## 執行流程

### spec / batch / auto 流程

```
開始
  │
  ├─ 檢查前置條件
  │   ├─ _common.flow.md 存在？ → 不存在 → 提示「請先放入 _common.flow.md」
  │   ├─ 目標 .flow.md 存在？ → 不存在 → 提示「請先放入對應的 .flow.md」
  │   └─ actions.ts 存在？ → 不存在 → 提示 /test e2e setup
  │
  ├─ 讀取 .flow.md + _common.flow.md
  ├─ 更新 fixtures.ts（如有新路由/帳號）
  ├─ 產出 .spec.ts
  │
  └─ 完成 → 輸出摘要
```

### pipeline 流程

```
開始
  │
  ├─ spec 階段
  │   ├─ .spec.ts 已存在？→ 跳過
  │   └─ 不存在？→ 執行 spec 生成
  │
  ├─ red 階段
  │   ├─ 執行 npx playwright test
  │   ├─ 全部通過？→ 輸出「已是綠燈」→ 結束
  │   └─ 有失敗？→ 輸出診斷報告 → 進入 green
  │
  └─ green 階段
      ├─ 分析根因
      ├─ 修復（最多 5 次迭代）
      ├─ 全部通過？→ 輸出綠燈報告 → 結束
      └─ 仍有失敗？→ 輸出部分失敗報告 → 結束
```

---

## 選項

| 選項 | 適用模式 | 說明 |
|------|---------|------|
| `--continue-on-error` | batch, pipeline (batch) | 失敗時繼續下一個（預設：停止） |
| `--limit N` | auto | 最多處理 N 個 feature |
| `--red-only` | pipeline | 只跑到紅燈（不自動修綠燈） |

---

## 輸出摘要格式

### spec 摘要

```
E2E Spec 完成：04-建立球隊

  spec → test/e2e/specs/04-建立球隊.spec.ts ✅
  測試數：4（正常 3 + skip 1）
```

### batch 摘要

```
E2E Batch 完成：03 → 06

  03-查詢球隊列表  ✅
  04-建立球隊      ✅
  05-編輯球隊      ✅
  06-刪除球隊      ✅

  成功：4 / 4
```

### pipeline 摘要

```
E2E Pipeline 完成：04-建立球隊

  spec  → test/e2e/specs/04-建立球隊.spec.ts ✅（已存在，跳過）
  red   → 2 fail / 1 pass / 1 skip
  green → ✅ 全部通過（迭代 2 次）

  修復：
  - app/pages/teams/index.vue（2 處 testid）
  - server/mock/data/teams.ts（1 處數值）
```

---

## Lint Gate（必須通過）

Pipeline 中每個產出程式碼的階段結束前，**必須執行 lint 修復並確認零錯誤**：

```bash
npm run lint --fix
npm run lint    # 確認 0 errors
```

> **阻塞條件**：lint 不通過則該階段視為失敗，pipeline 停止。不通過 lint 的程式碼會導致 pre-commit hook 失敗，無法 commit。

---

## 檢查清單

- [ ] 前置條件已滿足（.flow.md 存在、helpers/actions.ts 存在）
- [ ] fixtures.ts 已包含所需的路由和測試帳號
- [ ] .spec.ts 已產出（從 helpers import 共用操作，不含本地定義）
- [ ] `npm run lint` 零錯誤
- [ ] 輸出摘要包含成功/失敗/跳過數量
- [ ] pipeline 模式：紅燈報告 + 綠燈修復完成
