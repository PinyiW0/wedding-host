<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const isMobileMenuOpen = ref(false)
const isCollapsed = ref(false)

// 頂層管理導航（婚禮細部頁面為 wedding 範圍，從列表進入）
const navigation = [
  { label: '婚禮', icon: 'i-heroicons-heart', to: '/weddings' },
  { label: '接待', icon: 'i-heroicons-clipboard-document-check', to: '/reception' },
]

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

async function handleLogout() {
  authStore.clearAuth()
  await router.push('/login')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-neutral-100">
    <!-- Sidebar：lg 以上顯示，可收合 -->
    <aside
      class="hidden shrink-0 border-r border-neutral-200 bg-white transition-all duration-300 lg:flex lg:flex-col"
      :class="isCollapsed ? 'w-16' : 'w-64'"
    >
      <!-- Logo + 收合按鈕 -->
      <div
        class="flex h-16 shrink-0 items-center border-b border-neutral-200"
        :class="isCollapsed ? 'justify-center px-2' : 'justify-between px-4'"
      >
        <span v-if="!isCollapsed" class="truncate text-lg font-bold text-primary-600">
          EverAfter
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
          class="flex items-center rounded-lg px-3 py-2 text-neutral-700 transition-colors duration-300 hover:bg-primary-50 hover:text-primary-600"
          :class="isCollapsed ? 'justify-center' : 'gap-3'"
        >
          <UIcon :name="item.icon" class="size-5 shrink-0" />
          <span v-if="!isCollapsed" class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <!-- 底部功能區：使用者名稱 + 登出 -->
      <div class="shrink-0 border-t border-neutral-200 p-2">
        <div v-if="!isCollapsed" class="flex items-center gap-3 rounded-lg px-3 py-2">
          <UIcon name="i-heroicons-user-circle" class="size-5 shrink-0 text-primary-600" />
          <span class="flex-1 truncate text-sm text-neutral-700">
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
            <UIcon name="i-heroicons-user-circle" class="size-5 text-primary-600" />
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
        <div class="flex h-full flex-col bg-white">
          <!-- Mobile Header -->
          <div class="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
            <span class="text-lg font-bold text-primary-600">EverAfter</span>
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
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-neutral-700 transition-colors duration-300 hover:bg-primary-50 hover:text-primary-600"
              @click="isMobileMenuOpen = false"
            >
              <UIcon :name="item.icon" class="size-5" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </nav>
          <!-- Mobile 底部功能區 -->
          <div class="shrink-0 border-t border-neutral-200 p-4">
            <div class="flex items-center gap-3 rounded-lg px-3 py-2">
              <UIcon name="i-heroicons-user-circle" class="size-5 text-primary-600" />
              <span class="flex-1 truncate text-sm text-neutral-700">
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
        class="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 lg:hidden"
      >
        <button @click="isMobileMenuOpen = true">
          <UIcon name="i-heroicons-bars-3" class="size-6 text-neutral-900" />
        </button>
        <span class="text-lg font-bold text-primary-600">EverAfter</span>
      </div>
      <main class="flex min-h-0 flex-1 flex-col overflow-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
