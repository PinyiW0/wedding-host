---
paths:
  - "server/**/*.ts"
---

# Server 安全慣例

每條規則各對應一個實際專案被打穿的漏洞（wedding-host 全站安全審查），不是假想威脅。
mock 端點一律適用——實際專案會把 mock 演化成 production server，查詢過濾、欄位投影、輸入驗證這些 pattern 會存活下來。

## 禁止事項

| # | 禁止行為 | 正確做法 |
|---|----------|----------|
| 1 | 巢狀端點查詢漏帶父層 path 參數（跨租戶 IDOR） | path 有幾個參數、查詢條件就用幾個參數：`/projects/[projectId]/tasks/[taskId]` 的查詢必含 `projectId` 與 `taskId` |
| 2 | 同目錄兄弟 handler 的 scope 過濾不一致（PATCH 有、DELETE 漏） | 新增或修改 handler 前先讀同目錄兄弟檔，過濾條件逐字等價 |
| 3 | 寫入時 spread body（`{ ...body }`／`Object.assign(entity, body)`） | 逐欄白名單手構；id／owner／租戶／狀態機欄位一律由 server 決定，body 不得覆蓋 |
| 4 | 寫入端點未經 runtime 驗證直接信 body | 數字欄驗整數與範圍（NaN／負值／溢位擋下）、enum 欄驗白名單、字串驗長度上限——界限從 spec 萃取，違反回 400 |
| 5 | 把 body/query 的 `xxxId` 當操作者身分（冒用） | 操作者身分只取自 auth context 或已驗證的簽名憑證；公開端點自報的身分欄位忽略或 400 |
| 6 | 回應整筆吐出或黑名單刪欄位 | 白名單挑欄位出去；密碼雜湊、token、審核理由、內部備註不進任何回應；公開／匿名端點只回已發布狀態資料的公開層欄位 |
| 7 | 密鑰寫死、dev 預設值成為 production fallback | secret 一律走 env（runtimeConfig）；production 啟動守衛擋 dev 預設值（本專案：`server/plugins/00.security-guard.ts`） |
| 8 | 錯誤訊息洩漏內部細節或資料存在性 | `statusMessage` 用固定訊息，不帶 stack／DB 原文；歸屬檢查失敗回 404，不讓外人探測資源存在 |

## 一行示例（最常踩的三條）

```ts
// [X] 1：只用自身 id 過濾——B 專案的人可以刪 A 專案的 task
const task = mockTasks.find(t => t.taskId === taskId)
// [O] 1：父層參數全部進條件
const task = mockTasks.find(t => t.taskId === taskId && t.projectId === projectId)

// [X] 3：body.projectId 覆蓋前面的值 → 跨租戶寫入
mockTasks.push({ projectId, ...body })
// [O] 3：逐欄手構，server 決定的欄位不給 body 碰
mockTasks.push({ taskId: crypto.randomUUID(), projectId, title: body.title, priority: body.priority })

// [X] 5：信任 body 自報身分
const authorId = body.memberId
// [O] 5：身分取自 auth context
const authorId = event.context.authUser.accountId
```

## 消費地圖

產生範本與 production 基礎設施（env 守衛／限流／安全標頭）住 `.claude/skills/feature-to-api/references/`；
審查查法住 `.claude/skills/sdd-review/references/checks.md` §3。
本檔在 subagent 內不會自動注入——skill 產 server 端點前須明文指讀本檔。
兜底防線：PostToolUse hook（`.claude/hooks/server-security-guard.mjs`）對主對話與所有 subagent 生效——
編輯 `server/**/*.ts` 時注入本檔摘要（摘要與上表同步維護），並對 `server/api/**` 機械偵測規則 1、3 的可 grep 違規。
