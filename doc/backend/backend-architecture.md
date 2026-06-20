# 後端架構：整潔架構 + FCIS + Decider + Event Sourcing

## 架構組成

四個概念各管一件事，疊加使用：

```
整潔架構  → 分層結構、依賴方向（外層依賴內層，反過來不行）
FCIS     → 隔離策略（業務規則是純函數，IO 在外層殼）
Decider  → 簽名約束（decide / evolve / initialState，映射 Gherkin）
ES       → 持久化策略（Event Store 是唯一真相，Read Model 是投影）
```

### 整潔架構：管分層和依賴

```
server/api/              → Imperative Shell（HTTP 入口，只呼叫 Application 或直接讀 Read Model）
  ↓ 呼叫
server/application/      → Use Case 編排（per-module use case + 泛型 executeCommand）
  ↓ 呼叫
server/domain/           → Functional Core（純函數，不 import 任何外層）

server/infrastructure/   → Driven Adapter（Event Store + Read Model 讀寫）
  ↑ 被 Application 呼叫
```

依賴規則：
- `domain/` 不 import `infrastructure/`、`api/`、`application/`（嚴格遵守）
- `application/` 可 import `domain/` 和 `infrastructure/`
- `api/` 寫入操作只呼叫 `application/`；查詢（GET）可直接呼叫 `infrastructure/persistence/`

### FCIS：管副作用隔離

Functional Core, Imperative Shell（Gary Bernhardt, 2012）。

| Functional Core（domain/） | Imperative Shell（application/ + api/） |
|---|---|
| 不讀 DB、不寫 DB | 讀 DB、寫 DB |
| 不呼叫外部 API | 呼叫外部服務 |
| 接收值，回傳值 | 組裝輸入，處理輸出 |
| 零 mock 測試 | 整合測試 |

整潔架構只保證 Domain 不依賴基礎設施，**不保證 Domain 是純函數**（OOP Entity 有 mutable state 也符合整潔架構）。FCIS 進一步約束：Domain 必須是純函數。

### Decider 慣例：管函數簽名

Decider Pattern（Jérémie Chassaing）定義三元組：

```text
initialState: State
decide(state: State, command: Command): Event[] | { error: string }
evolve(state: State, event: Event): State
```

這個簽名讓 Gherkin 可以機械式映射成程式碼：

```
Given 已發生 X → state = evolve(initialState, X)    ← evolve 建 State
When 執行 Y    → result = decide(state, Y)           ← decide 做決策
Then 應產出 Z  → assert(result, Z)                   ← 驗證回傳值
```

沒有其他 pattern 能提供這種 Given/When/Then → State/Command/Event 的一對一映射。

### Event Sourcing：管持久化策略

Event Store 是唯一寫入真相，Read Model 是同步投影。

```
Command → decide() → Event[] → append to Event Store
                                  ↓ sync projection
                              Read Model（SQL 表，供查詢用）
```

選用 ES 的理由：

1. **Gherkin codegen 直譯** — Given = past events、When = command、Then = produced events，1:1 映射
2. **審計追蹤** — append-only，完整歷史
3. **時間旅行 / Undo** — replay 到任意時間點
4. **退路簡單** — 砍掉 Event Store 層就退回 CRUD，Domain 零改動

### Codegen 轉換路徑

ES 是 Gherkin 和 CRUD 之間的中繼站：

```
Gherkin ──直譯──→ ES ──減法──→ CRUD
   │                              ↑
   └──────語意翻譯（麻煩）─────────┘
```

**Gherkin → ES（直譯）**：Gherkin 的 Given/When/Then 和 ES 的 evolve/decide/assert 結構同構，codegen 是 1:1 語法轉換，不需要額外知識。

**ES → CRUD（減法）**：砍掉 Event Store + Application 層，API handler 直接查 Read Model 組裝 State → decide → 寫 Read Model。Domain 不動，Read Model 表不動，只是拔掉 event store 那層間接。

**Gherkin → CRUD（語意翻譯）**：Given 寫的是 past events，但 CRUD 沒有 event store — codegen 必須知道「每個 event 對應哪些表的哪些欄位」才能生成 test setup。Then 同理，要知道「產出的 event 最終寫到哪些表」才能生成 assert。這層 mapping 知識 Gherkin 裡沒有，codegen 推不出來。

**結論**：走上面那條路（Gherkin → ES → CRUD），兩步都是機械化操作。走下面那條直達路（Gherkin → CRUD），需要人工補 schema mapping 知識。因此 ES 是 codegen 流程的最佳中繼架構。

### 與官方定義的差異

本專案的 ES 實作基於 Decider Pattern（Jérémie Chassaing）和整潔架構（Robert C. Martin），但有三處務實取捨：

**1. Stream 粒度：Per-Project（非 Per-Aggregate）**

官方 ES 每個 aggregate 有獨立 event stream。本專案所有 decider 共用 `project-{id}` 一條 stream，每個 decider 的 `evolve` 只處理自己關心的 event type，忽略其餘。

原因：單用戶工具、每個 project 幾百到低千個 events。Per-Project 最簡單，避免跨 stream 組裝 state 的複雜度。

**2. Per-Slice（非 Per-Aggregate）**

官方 Decider 一個 decider = 一個 aggregate（有明確的一致性邊界）。本專案是 Per-Slice（SDD Stage 4 切出的開發單元），多個 slice 可能操作同一 aggregate 的資料。

原因：一個 slice = 一個 Gherkin feature = 一個自包含資料夾，為 codegen 優化。

**3. Sync Projection（非 Async Projection）**

官方 ES 的 projection 通常是非同步 — event 寫入 event store 後，由獨立的 subscriber 在背景更新 read model，讀取可能拿到舊資料（eventual consistency）。本專案的 append events 和 project to read model 在同一個請求內依序完成，寫完即可讀到最新資料（strong consistency）。

原因：單用戶工具，不需要 async 帶來的 scalability。Async projection 是分散式系統的取捨，對本專案是多餘的複雜度。

## 各層職責

### Domain（純函數，零 import 外層）

**放什麼**：所有業務判斷 — 只要是「如果 A 則 B」的規則都在這裡。

**判斷標準**：拿掉 DB、拿掉 HTTP，這段邏輯還有沒有意義？有 → Domain。

```
✓ decide：命令合不合法、產出什麼事件
✓ evolve：事件發生後狀態怎麼變
✓ 配對規則：Slice 的元素怎麼配對
✓ 傳播規則：Event 變更影響哪些 Slice
✓ 階段規則：哪個 Stage 算完成
✓ 格式驗證：Gherkin 內容是否合法

✗ DB 查詢
✗ HTTP 解析
✗ 檔案讀寫
```

Command / Automation / Translation Slice：

```ts
// domain/create-menu-item/decider.ts — 純函數，零 import
export const initialState: State = { nameExists: false }

export function decide(state: State, command: Command): Event[] | { error: string } {
  if (state.nameExists)
    return { error: '名稱重複' }
  return [{ type: 'MenuItemCreated', name: command.name, price: command.price }]
}

export function evolve(state: State, event: RelevantEvent): State {
  switch (event.type) {
    case 'MenuItemCreated':
      return { ...state, nameExists: true }
    default:
      return state
  }
}
```

Decider 產出 **lean event**（只含業務決策最小欄位），由 Application 層的 enrich 函式補全為 **fat StoredEvent**（含投影所需的完整欄位）。詳見 Application 層說明。

View Slice：

```ts
// domain/menu-list-view/projector.ts
export function project(events: MenuEvent[]): MenuItem[] {
  return events.reduce((items, event) => {
    switch (event.type) {
      case 'MenuItemCreated':
        return [...items, { name: event.name, price: event.price }]
      case 'MenuItemPriceUpdated':
        return items.map(i => i.name === event.name ? { ...i, price: event.newPrice } : i)
      case 'MenuItemDeleted':
        return items.filter(i => i.name !== event.name)
      default:
        return items
    }
  }, [] as MenuItem[])
}
```

### Application（Use Case 編排）

**放什麼**：per-module use case 函式 + 底層泛型引擎。每個 domain module 一個檔案，封裝 enrich 邏輯、persistence 查詢、command 組裝。

**判斷標準**：這段邏輯是「把各層串起來」的膠水嗎？是 → Application。

```
✓ per-module use case（defineActor、updateActor、removeActor...）
✓ enrich lean events to fat StoredEvents
✓ 查詢 Read Model 補充 command 所需資訊（如 eventId → eventName）
✓ load events → replay → decide → append → project（底層引擎）

✗ 業務判斷（屬於 Domain）
✗ HTTP 解析（屬於 API）
✗ SQL 查詢細節（屬於 Infrastructure）
```

Per-module use case（API handler 呼叫這些函式）：

```ts
// application/actor.ts
import * as defineActorDecider from '../domain/define-actor/decider'
import * as removeActorDecider from '../domain/remove-actor/decider'
import * as updateActorDecider from '../domain/update-actor/decider'
import { executeCommand } from './execute-command'

export async function defineActor(input: { projectId, name, label, description }) {
  const streamId = `project-${input.projectId}`
  const command = { type: 'DefineActor', actor: 'SpecDesigner', ...input }
  return executeCommand(streamId, defineActorDecider, command, e => ({
    type: 'ActorDefined',
    projectId: (e as any).projectId,
    actorName: (e as any).actorName,
  }))
}

export async function updateActor(input: { projectId, actorName, name, label, description }) {
  const streamId = `project-${input.projectId}`
  const command = { type: 'UpdateActor', actor: 'SpecDesigner', ...input }
  return executeCommand(streamId, updateActorDecider, command, e => ({
    type: 'ActorUpdated',
    projectId: (e as any).projectId,
    actorName: (e as any).actorName,
    newName: (e as any).newName,
  }))
}

export async function removeActor(input: { projectId, actorName }) {
  const streamId = `project-${input.projectId}`
  const command = { type: 'RemoveActor', actor: 'SpecDesigner', ...input }
  return executeCommand(streamId, removeActorDecider, command, e => ({
    type: 'ActorRemoved',
    projectId: (e as any).projectId,
    actorName: (e as any).actorName,
  }))
}
```

#### executeCommand — 完整 Decider 路徑（底層引擎）

泛型函式，被 per-module use case 呼叫：

```ts
// application/execute-command.ts
interface Decider<S, C, E> {
  initialState: S
  evolve: (state: S, event: E) => S
  decide: (state: S, command: C) => E[] | { error: string }
}

export async function executeCommand<S, C, E>(
  streamId: string,
  decider: Decider<S, C, E>,
  command: C,
  enrich: (event: E, command: C) => StoredEvent,
): Promise<StoredEvent[] | { error: string }> {
  // 1. Load + Replay
  const pastEvents = loadEvents(streamId)
  const state = pastEvents.reduce(
    (s, e) => decider.evolve(s, e as unknown as E),
    decider.initialState,
  )
  // 2. Decide
  const result = decider.decide(state, command)
  if (!Array.isArray(result))
    return result
  // 3. Enrich lean → fat
  const storedEvents = result.map(e => enrich(e, command))
  // 4. Append + Project
  const version = getCurrentVersion(streamId)
  appendEvents(streamId, storedEvents, version)
  await projectEvents(storedEvents)
  return storedEvents
}
```

**Lean Event vs Fat StoredEvent**：Decider 的 `decide` 產出 lean event（只含決策欄位），replay 時 `evolve` 也只看這些欄位。`enrich` 把 lean event 補全為 StoredEvent（加入投影所需的完整資料如 label、description 等）。Event Store 存的是 fat StoredEvent，replay 時以 `as unknown as E` 讓 evolve 只看自己關心的欄位。

### Infrastructure（Event Store + Read Model）

**放什麼**：Event Store 的 append / load，以及 Read Model 的投影寫入和查詢。

```
✓ Event Store：appendEvents、loadEvents（append-only 表）
✓ Projection：event → Read Model 表的寫入（同步）
✓ Read Model 查詢：getMenuItems、getProjectById（供 API GET 用）
✓ M:N 關聯管理：setViewEvents、setScreenViews
✓ Upsert 邏輯：存在就更新、不存在就新增

✗ 「哪些 Slice 該標 dirty」的判斷（屬於 Domain）
✗ 「View pattern 怎麼配對 Screen」的規則（屬於 Domain）
✗ 「哪個 Stage 算完成」的條件（屬於 Domain）
```

Event Store：

```ts
// infrastructure/event-store/index.ts
export function appendEvents(streamId: string, events: StoredEvent[], expectedVersion: number) {
  // optimistic concurrency check + 逐筆寫入 events 表
}

export function loadEvents(streamId: string): StoredEvent[] {
  // 按 version 順序讀取該 stream 的所有 events
}
```

Projection（event 驅動寫入 Read Model）：

```ts
// infrastructure/projection/index.ts — 中央 dispatcher
export async function projectEvents(events: StoredEvent[]): Promise<void> {
  for (const event of events) {
    // switch on event.type → 呼叫對應的 projection 函式
    await projectEvent(event)
  }
}
```

Projection 按領域分檔：

```
infrastructure/projection/
  index.ts          ← 中央 dispatcher（switch on event.type）
  project.ts        ← ProjectCreated / ProjectUpdated / ProjectDeleted / Draft / Glossary / Prompt
  big-picture.ts    ← Actor / ExternalSystem / Event / Storyline / Integration
  model.ts          ← Command / View / ViewConnect / ViewDisconnect
  design.ts         ← Swimlane / Slice / Route / ApiEndpoint
  spec.ts           ← Feature / Progress
  versioning.ts     ← Snapshot
```

Persistence（Read Model 查詢 + 寫入）：

```
infrastructure/persistence/
  project.ts        ← getAllProjects / getProjectById / createProject / updateProject / deleteProject
  big-picture.ts    ← getEvents / getActors / getStorylines / ...
  model.ts          ← getCommands / getViews / ...
  design.ts         ← getSwimlanes / getSlices / getRoutes / getApiEndpoints / ...
  spec.ts           ← getFeatures / ...
  versioning.ts     ← getSnapshots / startDraft / discardDraft / ...
```

Read Model 表不變 — 既有的 40+ 張 relational table 原封不動，變成 projection 的產出。

### API（Imperative Shell — HTTP 薄層）

**放什麼**：HTTP 解析 + 呼叫 Application use case + 格式化回應。不再組裝 State，不再直接呼叫 Persistence（寫入操作），不再包含 enrich 邏輯。

```
✓ readBody、getQuery — 解析 HTTP 輸入
✓ 呼叫 Application 層的 use case 函式
✓ 回傳格式：{ success, data } 或 createError(422)

✗ 組裝 State（屬於 Application）
✗ 直接呼叫 Persistence 寫入（屬於 Application）
✗ enrich 邏輯（屬於 Application）
✗ 業務判斷（屬於 Domain）
```

寫入 handler（呼叫 application use case）：

```ts
// server/api/spec/actor.post.ts
import { defineActor } from '../../application/actor'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.projectId)
    throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  const result = await defineActor({
    projectId: Number(body.projectId),
    name: body.name,
    label: body.label ?? '',
    description: body.description ?? '',
  })

  if (!Array.isArray(result))
    throw createError({ statusCode: 422, statusMessage: result.error })

  return { success: true }
})
```

```ts
// server/api/spec/actor.put.ts
import { updateActor } from '../../application/actor'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { id, projectId, ...fields } = body

  await updateActor({
    projectId: Number(projectId),
    id: Number(id),
    fields,
  })

  return { success: true }
})
```

純查詢 handler（直接讀 Read Model）：

```ts
// server/api/spec/projects.get.ts
import { getAllProjects } from '../../infrastructure/persistence/project'

export default defineEventHandler(async () => {
  const projects = await getAllProjects()
  return { success: true, projects }
})
```

## Per-Slice 縱切

SDD Stage 4 切出的每個 Slice 是一個獨立開發單元。Per-Slice 意味著每個 Slice 有自己獨立的 State、evolve、decide：

| | Per-Slice | Per-Swimlane |
|---|---|---|
| Codegen 依賴 | 零——一個 Feature = 一個自包含資料夾 | 需知道 Slice 屬於哪個 Swimlane |
| AI TDD 認知範圍 | 最小——AI 只看一個資料夾 | 需理解整個 Swimlane 的狀態結構 |
| State 設計 | 精準——每個 Slice 只包含它需要的欄位 | 完整——包含 Swimlane 所有狀態 |
| 平行開發 | 多個 Slice 可同時 codegen + TDD，零衝突 | Slice 間共享 evolve，可能衝突 |

### Event Stream 策略

Stream 以 Project 為單位：`project-{id}`。每個 decider 的 `evolve` 只處理自己關心的 event type，忽略其餘。

對單用戶 spec 設計工具，一個 project 幾百到低千個 events，replay 成本 1-5ms，不需要 snapshot 優化。

## 資料夾結構

```
server/
  domain/                          ← Functional Core（純函數）
    {slice-name}/
      decider.ts                   ← initialState + decide + evolve
      decider.spec.ts              ← Gherkin codegen 產出
    {view-name}/
      projector.ts                 ← project(events) → ViewModel
      projector.spec.ts            ← Gherkin codegen 產出

  application/                     ← Use Case 編排（per-module use case + 底層引擎）
    {module}.ts                    ← per-module use case（defineActor、updateActor、removeActor...）
    execute-command.ts             ← 底層引擎（load → replay → decide → enrich → append → project）

  infrastructure/
    event-store/                   ← Event Store（append-only）
      index.ts                     ← appendEvents / loadEvents / getCurrentVersion
      types.ts                     ← StoredEvent union type（50+ 種 fat events）
    persistence/                   ← Read Model（投影產出 + 查詢）
      {module}.ts                  ← CRUD 函式（供 projection 寫入 + GET API 查詢）
    projection/                    ← Projector（event → Read Model 寫入）
      index.ts                     ← 中央 dispatcher（switch on event.type）
      {module}.ts                  ← 按領域分檔的 projection 函式
    database/
      index.ts                     ← Drizzle + postgres.js 連線
      schema.ts                    ← Drizzle schema（domainEvents 表 + Read Model 40+ 張表）

  api/                             ← Imperative Shell（HTTP 薄層，只呼叫 Application）
    spec/
      {resource}.post.ts           ← create/update/remove → application/{module}.xxxXxx()
      {resource}.get.ts            ← query → 直接讀 persistence
```

### 範例：菜單 Swimlane，4 個 Slice

```
server/
  domain/
    create-menu-item/
      decider.ts
      decider.spec.ts
    update-menu-item-price/
      decider.ts
      decider.spec.ts
    delete-menu-item/
      decider.ts
      decider.spec.ts
    menu-list-view/
      projector.ts
      projector.spec.ts

  application/
    menu.ts                       ← createMenuItem / updateMenuItemPrice / deleteMenuItem
    execute-command.ts             ← 底層引擎（所有 module 共用）

  infrastructure/
    event-store/
      index.ts
    persistence/
      menu.ts                     ← Read Model 查詢（getMenuItems）
    projection/
      menu.ts                     ← projectEvents（MenuItemCreated → addMenuItem）

  api/
    menu/
      item.post.ts                ← create → application/menu.createMenuItem(input)
      item.put.ts                 ← update → application/menu.updateMenuItem(input)
      item.delete.ts              ← delete → application/menu.removeMenuItem(input)
      items.get.ts                ← query → 直接呼叫 persistence/menu（讀 Read Model）
```

## 分層判斷規則

碰到不確定放哪層時，問一個問題：**這段邏輯的原因是「業務要求」還是「技術要求」？**

| 原因 | 放哪層 | 例子 |
|---|---|---|
| 業務要求 | Domain | 「已取消的訂單不能確認」 |
| 串接各層 | Application | 「load → replay → decide → append → project」 |
| 協議格式 | API | 「readBody → 呼叫 use case → 回傳 422」 |
| 資料格式 | Infrastructure | 「DB 的 JSON 欄位要 parse 成物件」 |

### 寫入路徑

所有寫入操作（create / update / delete）都走 `executeCommand`，經過 decider 驗證。每個操作對應一個獨立的 spec slice、decider、domain test。
