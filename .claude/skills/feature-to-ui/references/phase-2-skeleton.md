# Phase 2: 路由骨架

## 必讀規範

```
僅需讀取：
- spec/report/route-map.yaml（`/feature-to-api` Phase 0 產生的路由對照表）
- rules.md [P2] 段落（testid 規範）

若存在，額外讀取（testid 來源）：
- spec/e2e-flows/pages/*.elements.md（各頁面的 testid 定義）

Sync 模式額外讀取：
- spec/report/sync-report.md（變更報告的「路由變更」段落）
```

> ⚠️ 若 `pages/*.elements.md` 存在，頁面骨架的 `data-testid` **必須**使用該檔案定義的 testid，不可自行命名。
> 若不存在，按 [rules.md](rules.md) > testid 規範 的命名規則自行定義。

---

## 增量模式判斷

Phase 2 開始前，先檢查 `spec/report/sync-report.md` 是否存在：

| 條件 | 模式 | 行為 |
|------|------|------|
| `sync-report.md` **不存在** | **全量模式** | 執行下方「全量模式執行步驟」（現有流程不動） |
| `sync-report.md` **存在** | **增量模式** | 讀取報告，只處理新增的路由 |

### 增量模式步驟

1. **讀取 sync-report.md** 的「路由變更」表格
2. **新增的路由** → 建立空殼頁面（與全量模式相同範本）
3. **已存在的路由** → 跳過（不修改現有頁面骨架）
4. **刪除的路由** → **不執行刪除**，列在確認清單提醒用戶
5. **詢問用戶確認**

增量確認格式：
```
Phase 2 增量更新完成

新建頁面：
- [done] app/pages/coaches/index.vue（空殼，含 testid）

跳過（已存在）：
- [skip] app/pages/login.vue
- [skip] app/pages/teams/index.vue

待刪除（不自動執行）：
- （無）

確認後繼續？
```

---

## 全量模式執行步驟

1. **讀取路由規劃表**（`spec/report/route-map.yaml`）
2. **檢查 `spec/e2e-flows/pages/` 是否存在 elements.md 檔案**
   - 存在 → 讀取對應頁面的 elements.md，提取 testid
   - 不存在 → 按命名規則定義 testid
3. **根據路由規劃建立所有頁面空殼**（帶入 testid）
4. **每個頁面只包含基本結構**
5. **詢問用戶確認**

## 頁面空殼範例

```vue
<!-- app/pages/index.vue（根路由 redirect） -->
<!-- ⚠️ redirect 頁面必須在 Phase 2 直接實作，不留到 Phase 5 -->
<!-- ⚠️ 禁止使用 redirectCode（HTTP redirect 會被瀏覽器快取，影響同 port 的其他專案） -->
<!-- 從 route-map.yaml 的 note 欄位讀取 redirect 目標 -->
<script setup lang="ts">
if (import.meta.client) {
  await navigateTo('/<目標路由>', { replace: true })
}
</script>

<template>
  <div />
</template>
```

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'auth' })
</script>

<template>
  <div data-testid="login-page">
    <!-- Phase 5 實作：登入表單 -->
    <p class="text-neutral-500">登入頁面（待實作）</p>
  </div>
</template>
```

```vue
<!-- app/pages/teams/index.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<template>
  <div data-testid="teams-page" class="flex h-full flex-col">
    <!-- Phase 5 實作：球隊列表 -->
    <p class="text-neutral-500">球隊列表頁面（待實作）</p>
  </div>
</template>
```

```vue
<!-- app/pages/teams/[id].vue -->
<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const teamId = computed(() => route.params.id)
</script>

<template>
  <div data-testid="team-detail-page" class="flex h-full flex-col">
    <!-- Phase 5 實作：球隊詳情 -->
    <p class="text-neutral-500">球隊詳情頁面 #{{ teamId }}（待實作）</p>
  </div>
</template>
```

## 輸出結構

```
app/pages/
├── login.vue
├── index.vue
├── teams/
│   ├── index.vue
│   └── [id].vue
└── players/
    └── index.vue
```
