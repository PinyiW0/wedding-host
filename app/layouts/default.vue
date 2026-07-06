<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const { wedding, weddingId } = useCurrentWedding()
const isMobileMenuOpen = ref(false)
const isCollapsed = ref(false)

// 全域導覽（未進入特定婚禮時顯示）；接待員只保留「接待報到」（帶 weddingId）
const globalNav = computed(() => {
  // 接待員：接待報到 + 投影祝福審核
  if (authStore.isReceptionist) {
    const id = authStore.weddingId ?? 'wedding-001'
    return [
      { label: '接待報到', icon: 'i-heroicons-clipboard-document-check', to: `/reception?weddingId=${id}` },
      { label: '投影祝福審核', icon: 'i-heroicons-sparkles', to: `/weddings/${id}/blessings` },
    ]
  }
  // 人在接待台時，新人/管理者需要返回後台的入口（接待員無後台可回，不顯示）
  const isOnReception = route.path.startsWith('/reception')
  // 新人：只管理自己的婚禮，不顯示「所有婚禮」
  if (authStore.isCouple) {
    const id = authStore.weddingId ?? 'wedding-001'
    return [
      ...(isOnReception
        ? [{ label: '返回後台', icon: 'i-heroicons-arrow-uturn-left', to: `/weddings/${id}` }]
        : []),
      { label: '接待報到', icon: 'i-heroicons-clipboard-document-check', to: `/reception?weddingId=${id}` },
    ]
  }
  // 管理者：可看所有婚禮
  const backTarget = route.query.weddingId ? `/weddings/${route.query.weddingId}` : '/weddings'
  return [
    ...(isOnReception
      ? [{ label: '返回後台', icon: 'i-heroicons-arrow-uturn-left', to: backTarget }]
      : []),
    { label: '所有婚禮', icon: 'i-heroicons-heart', to: '/weddings' },
    // 管理者限定入口（新人/接待員的分支不會走到這裡）
    { label: '新人帳號', icon: 'i-heroicons-user-group', to: '/users' },
    { label: '接待報到', icon: 'i-heroicons-clipboard-document-check', to: '/reception' },
  ]
})

// 導覽項目：單一連結（to）或可展開群組（children）
interface NavChild { label: string, to: string }
interface NavItem { label: string, icon: string, to?: string, children?: NavChild[] }

// 婚禮模組導覽（進入某場婚禮後顯示，對齊參考稿後台側邊欄）
const weddingNav = computed<NavItem[]>(() => {
  const id = weddingId.value
  if (!id)
    return []
  const items: NavItem[] = [
    { label: '婚禮總覽', icon: 'i-heroicons-squares-2x2', to: `/weddings/${id}` },
    { label: '當天流程', icon: 'i-heroicons-queue-list', to: `/weddings/${id}/rundown` },
    { label: '賓客名單', icon: 'i-heroicons-users', to: `/weddings/${id}/guests` },
    { label: '桌次規劃', icon: 'i-heroicons-table-cells', to: `/weddings/${id}/seating` },
    // RSVP 收成子選單（回覆 / 題目 / 外觀），避免側邊欄平鋪過多項目
    {
      label: 'RSVP',
      icon: 'i-heroicons-envelope-open',
      children: [
        { label: '回覆總覽', to: `/weddings/${id}/rsvp` },
        { label: '題目設定', to: `/weddings/${id}/rsvp/questions` },
        { label: '外觀設定', to: `/weddings/${id}/rsvp/appearance` },
      ],
    },
    { label: '喜餅', icon: 'i-heroicons-gift', to: `/weddings/${id}/cake-box` },
    { label: '婚禮小物', icon: 'i-heroicons-gift-top', to: `/weddings/${id}/gifts` },
    { label: '投影祝福審核', icon: 'i-heroicons-sparkles', to: `/weddings/${id}/blessings` },
    { label: '電子謝卡', icon: 'i-heroicons-heart', to: `/weddings/${id}/thank-you` },
    { label: 'LINE 邀請', icon: 'i-heroicons-chat-bubble-left-right', to: `/weddings/${id}/line` },
    { label: '帳號設定', icon: 'i-heroicons-cog-6-tooth', to: `/weddings/${id}/accounts` },
  ]
  // 接待員在婚禮情境下只保留投影祝福審核（其餘後台頁由守衛導回接待台）
  if (authStore.isReceptionist)
    return items.filter(item => item.to?.endsWith('/blessings'))
  return items
})

// 子選單展開狀態：預設展開「含作用中子頁」的群組，使用者可手動切換
const openGroups = ref<Record<string, boolean>>({})
function isGroupActive(item: NavItem) {
  return !!item.children?.some(c => isActive(c.to))
}
function isGroupOpen(item: NavItem) {
  return openGroups.value[item.label] ?? isGroupActive(item)
}
function toggleGroup(item: NavItem) {
  openGroups.value = { ...openGroups.value, [item.label]: !isGroupOpen(item) }
}

const inWedding = computed(() => weddingNav.value.length > 0)

// 使用者頭像首字
const avatarChar = computed(() => (authStore.user?.account ?? '?').charAt(0).toUpperCase())

// 角色標籤（依登入者角色顯示）
const roleLabel = computed(() => {
  if (authStore.isReceptionist)
    return '接待 · 接待員'
  if (authStore.isCouple)
    return '新人 · 婚禮主'
  return '主辦 · 管理員'
})

// 婚禮列表與婚禮總覽需精確比對，避免被子頁路徑前綴誤判為作用中
function isActive(to: string | undefined) {
  if (!to)
    return false
  // 列表 / 總覽 / RSVP 回覆首頁需精確比對，避免被子頁路徑前綴誤判為作用中
  if (
    to === '/weddings'
    || to === `/weddings/${weddingId.value}`
    || to === `/weddings/${weddingId.value}/rsvp`
  ) {
    return route.path === to
  }
  return route.path === to || route.path.startsWith(`${to}/`)
}

// 群組收合時導向第一個子頁（如 RSVP → 回覆總覽）
function groupFirstTo(item: NavItem) {
  return item.children?.[0]?.to ?? item.to ?? ''
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
          <p class="mt-1 truncate font-display text-base font-semibold text-ink dark:text-paper">
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
          <template v-for="item in weddingNav" :key="item.label">
            <!-- 單一連結 -->
            <NuxtLink
              v-if="!item.children"
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

            <!-- 群組（收合時 → 圖示連到第一個子頁；展開時 → 可切換子選單） -->
            <NuxtLink
              v-else-if="isCollapsed"
              :to="groupFirstTo(item)"
              class="flex items-center justify-center rounded border-l-[3px] px-3 py-2.5 transition-colors duration-200"
              :class="isGroupActive(item)
                ? 'border-gold bg-primary-100 text-ink dark:bg-primary-950 dark:text-paper'
                : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400'"
            >
              <UIcon :name="item.icon" class="size-5 shrink-0" :class="isGroupActive(item) && 'text-gold-deep'" />
            </NuxtLink>
            <div v-else>
              <button
                type="button"
                :data-testid="`vibe-nav-group-${item.label}`"
                :aria-expanded="isGroupOpen(item)"
                class="flex w-full items-center gap-3 rounded border-l-[3px] px-3 py-2.5 transition-colors duration-200"
                :class="isGroupActive(item)
                  ? 'border-gold font-medium text-ink dark:text-paper'
                  : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400'"
                @click="toggleGroup(item)"
              >
                <UIcon :name="item.icon" class="size-5 shrink-0" :class="isGroupActive(item) && 'text-gold-deep'" />
                <span class="flex-1 truncate text-left">{{ item.label }}</span>
                <UIcon
                  name="i-heroicons-chevron-down"
                  class="size-4 shrink-0 transition-transform duration-200"
                  :class="isGroupOpen(item) && 'rotate-180'"
                />
              </button>
              <div v-if="isGroupOpen(item)" class="mt-1 space-y-1">
                <NuxtLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  :data-testid="isActive(child.to) ? 'vibe-nav-active' : undefined"
                  class="flex items-center rounded border-l-[3px] py-2 pl-11 pr-3 text-sm transition-colors duration-200"
                  :class="isActive(child.to)
                    ? 'border-gold bg-primary-100 font-medium text-ink dark:bg-primary-950 dark:text-paper'
                    : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400'"
                >
                  <span class="truncate">{{ child.label }}</span>
                </NuxtLink>
              </div>
            </div>
          </template>
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
            <p data-testid="vibe-user-role" class="text-caption text-ink-300">
              {{ roleLabel }}
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
              <template v-for="item in weddingNav" :key="item.label">
                <!-- 單一連結 -->
                <NuxtLink
                  v-if="!item.children"
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

                <!-- 群組（可切換子選單） -->
                <div v-else>
                  <button
                    type="button"
                    :aria-expanded="isGroupOpen(item)"
                    class="flex w-full items-center gap-3 rounded border-l-[3px] px-3 py-2.5 transition-colors duration-200"
                    :class="isGroupActive(item)
                      ? 'border-gold font-medium text-ink dark:text-paper'
                      : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400'"
                    @click="toggleGroup(item)"
                  >
                    <UIcon :name="item.icon" class="size-5" :class="isGroupActive(item) && 'text-gold-deep'" />
                    <span class="flex-1 text-left">{{ item.label }}</span>
                    <UIcon
                      name="i-heroicons-chevron-down"
                      class="size-4 transition-transform duration-200"
                      :class="isGroupOpen(item) && 'rotate-180'"
                    />
                  </button>
                  <div v-if="isGroupOpen(item)" class="mt-1 space-y-1">
                    <NuxtLink
                      v-for="child in item.children"
                      :key="child.to"
                      :to="child.to"
                      class="flex items-center rounded border-l-[3px] py-2 pl-11 pr-3 text-sm transition-colors duration-200"
                      :class="isActive(child.to)
                        ? 'border-gold bg-primary-100 font-medium text-ink dark:bg-primary-950 dark:text-paper'
                        : 'border-transparent text-ink-500 hover:bg-primary-100/50 hover:text-ink dark:text-neutral-400'"
                      @click="isMobileMenuOpen = false"
                    >
                      <span>{{ child.label }}</span>
                    </NuxtLink>
                  </div>
                </div>
              </template>
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
      <main class="stable-scroll flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
