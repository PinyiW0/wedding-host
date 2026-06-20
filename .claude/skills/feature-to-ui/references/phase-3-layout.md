# Phase 3: Layout 建置

## 必讀規範

```
必須讀取：
- ui-config.yaml > project.name（網站名稱）
- ui-config.yaml > colorMode（深淺模式）
- ui-config.yaml > responsive.sidebar（響應式設定）
- ui-config.yaml > icons.common（常用 icon）
- spec/report/route-map.yaml > routes（所有路由，用於建立 sidebar 導航項目）
- rules.md [P3] 段落（配色策略、深淺模式與對比色、Layout 規範）

執行 /nuxt-ui 載入組件文檔
```

## 模式判斷

Phase 3 開始前，先檢查 `spec/report/sync-report.md` 是否存在：

| 條件 | 模式 | 行為 |
|------|------|------|
| `sync-report.md` **不存在** | **全量模式** | 執行下方「全量模式執行步驟」 |
| `sync-report.md` **存在** | **Sync 模式** | 只讀取現有 `default.vue`，比對 `route-map.yaml` 新路由，將缺少的導航項目加入 `navigation` 陣列（使用 Edit）。不重建 Layout、不問偏好。 |

> ⚠️ **Phase 3 是導航同步的主責 Phase**。全量模式建立完整導航，Sync 模式補齊新路由。Phase 5 僅做 fallback 防漏檢查。

---

## 全量模式執行步驟

1. **載入 NuxtUI 文檔**：執行 `/nuxt-ui`
2. **從 ui-config.yaml 讀取 Layout 偏好**（不詢問用戶，直接使用設定值）
   - `responsive.sidebar.collapsible: true` → 可收合 Sidebar
   - `responsive.sidebar.collapsible: false` → 左側固定 Sidebar
   - `colorMode.enabled: true` → 支援深淺模式切換
   - `colorMode.enabled: false` → 不支援切換（使用 `colorMode.default` 指定的模式）
3. **建立 default.vue**（含 Sidebar）
4. **建立 auth.vue**（無 Sidebar）
5. **⚠️ 如果本 Phase 有建立任何 layout，則更新 app.vue**（見下方說明）
6. **輸出完成摘要**（告知用戶下一步指令，不用「要我繼續嗎？」的問法）

## ⚠️ 條件式 app.vue 設定（極度重要！）

**判斷邏輯**：如果 Phase 3 建立了任何 layout 檔案（`app/layouts/*.vue`），則**必須**同步更新 `app.vue` 加入 `<NuxtLayout>` + `<UApp>`。

#### 有 Layout 時的 app.vue

```vue
<!-- app/app.vue -->
<template>
  <div>
    <NuxtRouteAnnouncer />
    <UApp :toaster="{ position: '...from ui-config.yaml > toast.position', duration: ...from ui-config.yaml > toast.duration }">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </div>
</template>
```

#### 無 Layout 時的 app.vue

```vue
<!-- app/app.vue -->
<template>
  <div>
    <NuxtRouteAnnouncer />
    <UApp :toaster="{ position: '...from ui-config.yaml > toast.position', duration: ...from ui-config.yaml > toast.duration }">
      <NuxtPage />
    </UApp>
  </div>
</template>
```

> ⚠️ **toaster 設定** 必須從 `ui-config.yaml > toast` 讀取 `position` 和 `duration`，完整帶入 `:toaster="{ position, duration }"`
>
> ⚠️ **不要在 `<UApp>` 之外額外放 `<UToaster>`**

## Layout 偏好判斷（從 ui-config.yaml 自動讀取，不詢問用戶）

根據 `ui-config.yaml` 的設定自動決定：

| 設定值 | Sidebar 風格 |
|--------|-------------|
| `responsive.sidebar.collapsible: true` | 可收合 Sidebar（含收合按鈕） |
| `responsive.sidebar.collapsible: false` | 左側固定 Sidebar |

| 設定值 | 深淺模式 |
|--------|---------|
| `colorMode.enabled: true` | 支援切換 |
| `colorMode.enabled: false` + `default: "dark"` | 只用深色 |
| `colorMode.enabled: false` + `default: "light"` | 只用淺色 |

## default.vue 範例（可收合 Sidebar）

> ⚠️ **Sidebar 規範** → 詳見 [rules.md](rules.md) > Layout 規範

```vue
<!-- app/layouts/default.vue -->
<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const colorMode = useColorMode()
const isMobileMenuOpen = ref(false)
const isCollapsed = ref(false)

const navigation = [
  { label: '首頁', icon: 'i-heroicons-home', to: '/' },
  { label: '球隊', icon: 'i-heroicons-user-group', to: '/teams' },
  { label: '球員', icon: 'i-heroicons-users', to: '/players' },
]

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

async function handleLogout() {
  authStore.clearAuth()
  await router.push('/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-neutral-100 dark:bg-neutral-950">
    <!-- Sidebar：lg 以上顯示，可收合 -->
    <aside
      class="hidden shrink-0 border-r border-neutral-200 bg-white transition-all duration-300 lg:flex lg:flex-col dark:border-neutral-800 dark:bg-neutral-900"
      :class="isCollapsed ? 'w-16' : 'w-64'"
    >
      <!-- Logo + 收合按鈕 -->
      <div class="flex h-16 shrink-0 items-center border-b border-neutral-200 dark:border-neutral-800" :class="isCollapsed ? 'justify-center px-2' : 'justify-between px-4'">
        <span v-if="!isCollapsed" class="truncate text-lg font-bold text-neutral-900 dark:text-white">
          網站名稱
        </span>
        <UButton
          :icon="isCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-left'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="toggleSidebar"
        />
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 p-2">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex items-center rounded-lg px-3 py-2 text-neutral-700 transition-colors duration-300 hover:bg-primary-50 hover:text-primary-600 dark:text-neutral-300 dark:hover:bg-primary-950 dark:hover:text-primary-400"
          :class="isCollapsed ? 'justify-center' : 'gap-3'"
        >
          <UIcon :name="item.icon" class="size-5 shrink-0" />
          <span v-if="!isCollapsed" class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- 底部功能區：會員名稱 + 登出 + 深淺模式 -->
      <div class="shrink-0 border-t border-neutral-200 p-2 dark:border-neutral-800">
        <!-- 深淺模式切換 -->
        <button
          class="flex w-full items-center rounded-lg px-3 py-2 text-neutral-700 transition-colors duration-300 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          :class="isCollapsed ? 'justify-center' : 'gap-3'"
          @click="toggleColorMode"
        >
          <UIcon
            :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
            class="size-5 shrink-0"
          />
          <span v-if="!isCollapsed" class="truncate text-sm">
            {{ colorMode.value === 'dark' ? '淺色模式' : '深色模式' }}
          </span>
        </button>

        <!-- 會員名稱 + 登出 -->
        <div
          v-if="!isCollapsed"
          class="flex items-center gap-3 rounded-lg px-3 py-2"
        >
          <UIcon name="i-heroicons-user-circle" class="size-5 shrink-0 text-primary-600 dark:text-primary-400" />
          <span class="flex-1 truncate text-sm text-neutral-700 dark:text-neutral-300">
            {{ authStore.user?.account ?? '未登入' }}
          </span>
          <UButton
            icon="i-heroicons-arrow-right-on-rectangle"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="handleLogout"
          />
        </div>
        <!-- 收合時：垂直排列 + Tooltip 提示 -->
        <div v-else class="flex flex-col items-center gap-1">
          <UTooltip text="使用者">
            <UIcon name="i-heroicons-user-circle" class="size-5 text-primary-600 dark:text-primary-400" />
          </UTooltip>
          <UTooltip text="登出">
            <UButton
              icon="i-heroicons-arrow-right-on-rectangle"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="handleLogout"
            />
          </UTooltip>
        </div>
      </div>
    </aside>

    <!-- Mobile Drawer -->
    <USlideover v-model:open="isMobileMenuOpen" side="left">
      <template #content>
        <div class="flex h-full flex-col bg-white dark:bg-neutral-900">
          <!-- Mobile Header -->
          <div class="flex h-14 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
            <span class="text-lg font-bold text-neutral-900 dark:text-white">網站名稱</span>
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              @click="isMobileMenuOpen = false"
            />
          </div>
          <!-- Mobile Navigation -->
          <nav class="flex-1 space-y-1 p-4">
            <NuxtLink
              v-for="item in navigation"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-neutral-700 transition-colors duration-300 hover:bg-primary-50 hover:text-primary-600 dark:text-neutral-300 dark:hover:bg-primary-950 dark:hover:text-primary-400"
              @click="isMobileMenuOpen = false"
            >
              <UIcon :name="item.icon" class="size-5" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
          <!-- Mobile 底部功能區 -->
          <div class="shrink-0 border-t border-neutral-200 p-4 dark:border-neutral-800">
            <button
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-neutral-700 transition-colors duration-300 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="toggleColorMode"
            >
              <UIcon
                :name="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
                class="size-5"
              />
              <span class="text-sm">{{ colorMode.value === 'dark' ? '淺色模式' : '深色模式' }}</span>
            </button>
            <div class="flex items-center gap-3 rounded-lg px-3 py-2">
              <UIcon name="i-heroicons-user-circle" class="size-5 text-primary-600 dark:text-primary-400" />
              <span class="flex-1 truncate text-sm text-neutral-700 dark:text-neutral-300">
                {{ authStore.user?.account ?? '未登入' }}
              </span>
              <UButton
                icon="i-heroicons-arrow-right-on-rectangle"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="handleLogout"
              />
            </div>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Main Content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Mobile Top Bar（in-flow，不會覆蓋內容） -->
      <div class="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 lg:hidden dark:border-neutral-800 dark:bg-neutral-900">
        <button @click="isMobileMenuOpen = true">
          <UIcon name="i-heroicons-bars-3" class="size-6 text-neutral-900 dark:text-white" />
        </button>
        <span class="text-lg font-bold text-neutral-900 dark:text-white">網站名稱</span>
      </div>
      <main class="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
```

## auth.vue 範例

```vue
<!-- app/layouts/auth.vue -->
<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-100 dark:bg-neutral-950">
    <slot />
  </div>
</template>
```
