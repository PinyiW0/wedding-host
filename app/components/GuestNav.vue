<!-- app/components/GuestNav.vue -->
<script setup lang="ts">
// 賓客公開頁導覽列（issue #132）：桌機一列平鋪 + 右側單一 CTA，行動裝置收進漢堡選單。
// 可見項目由 useGuestNav 依連結簽名等級決定——婚禮級簽名不會拿到個人頁入口（點了必 401）。
import { useGuestNav } from '~/composables/useGuestNav'

const { menuItems, ctaItem, homeTo, isCurrent } = useGuestNav()
const route = useRoute()

const isMenuOpen = ref(false)
const isScrolled = ref(false)

// 缺 weddingId（連結沒帶）時組不出任何目的地，導覽整組收起、header 退回單純品牌列
const hasNav = computed(() => menuItems.value.length > 0 || Boolean(ctaItem.value))

let desktopQuery: MediaQueryList | null = null

function closeMenu() {
  isMenuOpen.value = false
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function handleScroll() {
  isScrolled.value = window.scrollY > 8
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    closeMenu()
}

// 展開後拉寬到桌機斷點：overlay 被 md:hidden 藏起來，殘留的捲動鎖要一併解除
function handleBreakpointChange(event: MediaQueryListEvent) {
  if (event.matches)
    closeMenu()
}

onMounted(() => {
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('keydown', handleKeydown)
  desktopQuery = window.matchMedia('(min-width: 768px)')
  desktopQuery.addEventListener('change', handleBreakpointChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('keydown', handleKeydown)
  desktopQuery?.removeEventListener('change', handleBreakpointChange)
  document.body.classList.remove('overflow-hidden')
})

// 選單佔滿視窗時鎖住背景捲動，避免底層跟著滾動失去閱讀位置
watch(isMenuOpen, (open) => {
  document.body.classList.toggle('overflow-hidden', open)
})

// 導覽完成即收合
watch(() => route.fullPath, closeMenu)
</script>

<template>
  <header
    data-testid="vibe-guest-nav"
    class="sticky top-0 z-40 shrink-0 border-b transition duration-400 ease-emphasized"
    :class="isScrolled ? 'border-line bg-paper/75 backdrop-blur-lg' : 'border-transparent bg-paper/30 backdrop-blur-sm'"
  >
    <!-- 三欄：導覽靠左、品牌置中（絕對定位，不隨兩側項目數飄移）、CTA 靠右 -->
    <div class="relative mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4">
      <nav v-if="hasNav" aria-label="賓客導覽" class="hidden items-center gap-5 md:flex">
        <NuxtLink
          v-for="item in menuItems"
          :key="item.key"
          :to="item.to"
          :data-testid="`vibe-guest-nav-item-${item.key}`"
          :aria-current="isCurrent(item.to) ? 'page' : undefined"
          class="text-caption tracking-wide transition-colors duration-250 ease-emphasized hover:text-ink"
          :class="isCurrent(item.to) ? 'text-ink' : 'text-ink-500'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <UButton
        v-if="hasNav"
        :icon="isMenuOpen ? 'i-heroicons-x-mark' : 'i-heroicons-bars-3'"
        :aria-label="isMenuOpen ? '關閉選單' : '開啟選單'"
        :aria-expanded="isMenuOpen"
        aria-controls="guest-nav-menu"
        data-testid="vibe-guest-nav-toggle"
        color="neutral"
        variant="ghost"
        class="md:hidden"
        @click="toggleMenu"
      />

      <NuxtLink
        v-if="homeTo"
        :to="homeTo"
        class="group absolute inset-y-0 left-1/2 flex -translate-x-1/2 flex-col items-center justify-center"
      >
        <span class="font-display text-2xl font-semibold tracking-wide text-ink transition-transform duration-400 ease-emphasized group-hover:-translate-y-px">
          EverAfter
        </span>
      </NuxtLink>
      <span
        v-else
        class="absolute left-1/2 -translate-x-1/2 font-display text-2xl font-semibold tracking-wide text-ink"
      >
        EverAfter
      </span>

      <UButton
        v-if="ctaItem"
        :to="ctaItem.to"
        data-testid="vibe-guest-nav-cta"
        color="primary"
        size="sm"
        class="hidden md:inline-flex"
      >
        {{ ctaItem.label }}
      </UButton>
    </div>
  </header>

  <!-- 行動裝置全幅選單：header 留在上方，漢堡原地變關閉鍵。
       置於 header 之外 —— header 的 backdrop-filter 會成為 containing block，
       選單留在裡面的話 fixed 會相對 header 而非視窗 -->
  <Transition
    enter-active-class="transition duration-400 ease-emphasized"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-250 ease-emphasized"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isMenuOpen"
      id="guest-nav-menu"
      data-testid="vibe-guest-nav-overlay"
      class="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-cream/90 backdrop-blur-xl md:hidden"
    >
      <nav aria-label="賓客導覽選單" class="mx-auto flex max-w-2xl flex-col px-6 py-6">
        <NuxtLink
          v-for="item in menuItems"
          :key="item.key"
          :to="item.to"
          :data-testid="`vibe-guest-nav-mobile-item-${item.key}`"
          :aria-current="isCurrent(item.to) ? 'page' : undefined"
          class="border-b border-line py-4 text-body-l"
          :class="isCurrent(item.to) ? 'text-ink' : 'text-ink-500'"
        >
          {{ item.label }}
        </NuxtLink>
        <UButton
          v-if="ctaItem"
          :to="ctaItem.to"
          data-testid="vibe-guest-nav-mobile-cta"
          color="primary"
          size="lg"
          block
          class="mt-8"
        >
          {{ ctaItem.label }}
        </UButton>
      </nav>
    </div>
  </Transition>
</template>
