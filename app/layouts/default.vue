<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const { wedding, weddingId } = useCurrentWedding()
const isMobileMenuOpen = ref(false)
const isCollapsed = ref(false)

// 全域導覽（未進入特定婚禮時顯示）
const globalNav = [
  { label: '所有婚禮', icon: 'i-heroicons-heart', to: '/weddings' },
  { label: '接待報到', icon: 'i-heroicons-clipboard-document-check', to: '/reception' },
]

// 婚禮模組導覽（進入某場婚禮後顯示，對齊參考稿後台側邊欄）
const weddingNav = computed(() => {
  const id = weddingId.value
  if (!id)
    return []
  return [
    { label: '婚禮總覽', icon: 'i-heroicons-squares-2x2', to: `/weddings/${id}` },
    { label: '賓客名單', icon: 'i-heroicons-users', to: `/weddings/${id}/guests` },
    { label: '桌次規劃', icon: 'i-heroicons-table-cells', to: `/weddings/${id}/seating` },
    { label: 'RSVP 回覆', icon: 'i-heroicons-envelope-open', to: `/weddings/${id}/rsvp` },
    { label: '喜餅', icon: 'i-heroicons-gift', to: `/weddings/${id}/cake-box` },
    { label: '祝福審核', icon: 'i-heroicons-chat-bubble-left-heart', to: `/weddings/${id}/blessings` },
    { label: '電子謝卡', icon: 'i-heroicons-heart', to: `/weddings/${id}/thank-you` },
    { label: 'LINE 邀請', icon: 'i-heroicons-chat-bubble-left-right', to: `/weddings/${id}/line` },
    { label: '帳號設定', icon: 'i-heroicons-cog-6-tooth', to: `/weddings/${id}/accounts` },
  ]
})

const inWedding = computed(() => weddingNav.value.length > 0)

// 使用者頭像首字
const avatarChar = computed(() => (authStore.user?.account ?? '?').charAt(0).toUpperCase())

// 婚禮列表與婚禮總覽需精確比對，避免被子頁路徑前綴誤判為作用中
function isActive(to: string) {
  if (to === '/weddings' || to === `/weddings/${weddingId.value}`)
    return route.path === to
  return route.path === to || route.path.startsWith(`${to}/`)
}

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

async function handleLogout() {
  authStore.clearAuth()
  await router.push('/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-cream">
    <!-- Sidebar：lg 以上顯示，可收合 -->
    <aside
      data-testid="vibe-sidebar"
      class="hidden shrink-0 border-r border-line bg-paper transition-all duration-300 lg:flex lg:flex-col dark:border-neutral-800 dark:bg-neutral-900"
      :class="isCollapsed ? 'w-16' : 'w-64'"
    >
      <!-- 婚禮情境標頭 + 收合按鈕 -->
      <div
        class="flex shrink-0 items-start border-b border-line py-5 dark:border-neutral-800"
        :class="isCollapsed ? 'justify-center px-2' : 'justify-between px-6'"
      >
        <div v-if="!isCollapsed" data-testid="vibe-wedding-context" class="min-w-0">
          <p class="text-overline uppercase text-gold-deep">
            {{ wedding ? 'The Wedding of' : 'The Wedding Platform' }}
          </p>
          <p class="mt-1 truncate font-display text-2xl font-semibold text-ink dark:text-paper">
            {{ wedding?.title ?? 'EverAfter' }}
          </p>
          <p v-if="wedding" class="mt-0.5 truncate text-caption text-ink-500 dark:text-neutral-400">
            {{ wedding.date }} · {{ wedding.venue }}
          </p>
        </div>
        <UButton
          :icon="isCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-left'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="toggleSidebar"
        />
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 overflow-y-auto p-3">
        <!-- 婚禮模組導覽（進入某場婚禮後顯示） -->
        <template v-if="inWedding">
          <p v-if="!isCollapsed" class="px-3 pb-1 pt-1 text-overline uppercase text-gold-deep">
            婚禮管理
          </p>
          <NuxtLink
            v-for="item in weddingNav"
            :key="item.to"
            :to="item.to"
            :data-testid="isActive(item.to) ? 'vibe-nav-active' : undefined"
            class="flex items-center rounded border-l-[3px] px-3 py-2.5 transition-colors duration-200"
            :class="[
              isActive(item.to)
                ? 'border-gold bg-primary-100 font-medium text-ink dark:bg-primary-950 dark:text-paper'
                : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400',
              isCollapsed ? 'justify-center' : 'gap-3',
            ]"
          >
            <UIcon :name="item.icon" class="size-5 shrink-0" :class="isActive(item.to) && 'text-gold-deep'" />
            <span v-if="!isCollapsed" class="truncate">{{ item.label }}</span>
          </NuxtLink>
          <div class="my-3 border-t border-line dark:border-neutral-800" />
        </template>

        <!-- 全域導覽 -->
        <NuxtLink
          v-for="item in globalNav"
          :key="item.to"
          :to="item.to"
          :data-testid="isActive(item.to) ? 'vibe-nav-active' : undefined"
          class="flex items-center rounded border-l-[3px] px-3 py-2.5 transition-colors duration-200"
          :class="[
            isActive(item.to)
              ? 'border-gold bg-primary-100 font-medium text-ink dark:bg-primary-950 dark:text-paper'
              : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400',
            isCollapsed ? 'justify-center' : 'gap-3',
          ]"
        >
          <UIcon :name="item.icon" class="size-5 shrink-0" :class="isActive(item.to) && 'text-gold-deep'" />
          <span v-if="!isCollapsed" class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- 底部功能區：使用者 + 登出 -->
      <div data-testid="vibe-user-menu" class="shrink-0 border-t border-line p-3 dark:border-neutral-800">
        <div v-if="!isCollapsed" class="flex items-center gap-3 px-2 py-1.5">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold font-display text-base font-semibold text-white">
            {{ avatarChar }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-body text-ink dark:text-paper">
              {{ authStore.user?.account ?? '未登入' }}
            </p>
            <p class="text-caption text-ink-300">
              主辦 · 管理員
            </p>
          </div>
          <UButton
            icon="i-heroicons-arrow-right-on-rectangle"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="handleLogout"
          />
        </div>
        <!-- 收合時：垂直排列 + Tooltip 提示 -->
        <div v-else class="flex flex-col items-center gap-2">
          <UTooltip :text="authStore.user?.account ?? '未登入'">
            <span class="flex size-8 items-center justify-center rounded-full bg-gold font-display text-sm font-semibold text-white">
              {{ avatarChar }}
            </span>
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
        <div class="flex h-full flex-col bg-paper dark:bg-neutral-900">
          <!-- Mobile 情境標頭 -->
          <div class="flex h-16 items-center justify-between border-b border-line px-5 dark:border-neutral-800">
            <div class="min-w-0">
              <p class="text-overline uppercase text-gold-deep">
                {{ wedding ? 'The Wedding of' : 'EverAfter' }}
              </p>
              <p class="truncate font-display text-xl font-semibold text-ink dark:text-paper">
                {{ wedding?.title ?? 'EverAfter' }}
              </p>
            </div>
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              @click="isMobileMenuOpen = false"
            />
          </div>
          <!-- Mobile Navigation -->
          <nav class="flex-1 space-y-1 overflow-y-auto p-4">
            <!-- 婚禮模組導覽（進入某場婚禮後顯示） -->
            <template v-if="inWedding">
              <p class="px-3 pb-1 text-overline uppercase text-gold-deep">
                婚禮管理
              </p>
              <NuxtLink
                v-for="item in weddingNav"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-3 rounded border-l-[3px] px-3 py-2.5 transition-colors duration-200"
                :class="isActive(item.to)
                  ? 'border-gold bg-primary-100 font-medium text-ink dark:bg-primary-950 dark:text-paper'
                  : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400'"
                @click="isMobileMenuOpen = false"
              >
                <UIcon :name="item.icon" class="size-5" :class="isActive(item.to) && 'text-gold-deep'" />
                <span>{{ item.label }}</span>
              </NuxtLink>
              <div class="my-3 border-t border-line dark:border-neutral-800" />
            </template>

            <!-- 全域導覽 -->
            <NuxtLink
              v-for="item in globalNav"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded border-l-[3px] px-3 py-2.5 transition-colors duration-200"
              :class="isActive(item.to)
                ? 'border-gold bg-primary-100 font-medium text-ink dark:bg-primary-950 dark:text-paper'
                : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400'"
              @click="isMobileMenuOpen = false"
            >
              <UIcon :name="item.icon" class="size-5" :class="isActive(item.to) && 'text-gold-deep'" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
          <!-- Mobile 底部功能區 -->
          <div class="shrink-0 border-t border-line p-4 dark:border-neutral-800">
            <div class="flex items-center gap-3 px-2 py-1.5">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold font-display text-base font-semibold text-white">
                {{ avatarChar }}
              </span>
              <span class="flex-1 truncate text-body text-ink dark:text-paper">
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
      <div
        class="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-paper px-4 lg:hidden dark:border-neutral-800 dark:bg-neutral-900"
      >
        <button @click="isMobileMenuOpen = true">
          <UIcon name="i-heroicons-bars-3" class="size-6 text-ink" />
        </button>
        <span class="font-display text-xl font-semibold text-ink dark:text-paper">EverAfter</span>
      </div>
      <main class="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
