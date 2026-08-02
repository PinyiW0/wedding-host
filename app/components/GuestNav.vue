<!-- app/components/GuestNav.vue -->
<script setup lang="ts">
// 賓客公開頁導覽列（issue #132）：桌機一列平鋪 + 右側單一 CTA，行動裝置收進漢堡選單。
// 平鋪斷點取 lg（#135）：賓客級簽名最多六個項目，768 放不下會擠成兩三行，平板改走漢堡。
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

// 展開後拉寬到桌機斷點：overlay 被 lg:hidden 藏起來，殘留的捲動鎖要一併解除
function handleBreakpointChange(event: MediaQueryListEvent) {
  if (event.matches)
    closeMenu()
}

onMounted(() => {
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('keydown', handleKeydown)
  desktopQuery = window.matchMedia('(min-width: 1024px)')
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
    <!-- 三欄 grid：導覽靠左、品牌固定在中欄、CTA 靠右。
         品牌曾用 absolute 置中，但項目一多就被壓在導覽文字上（#135），改由 grid 分欄各佔各的位置。
         display:none 的分支（桌機導覽／行動漢堡）不生成 box，欄位因此不會被空元素佔走 -->
    <div class="mx-auto grid h-16 max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
      <nav v-if="hasNav" aria-label="賓客導覽" class="col-start-1 hidden items-center gap-5 whitespace-nowrap lg:flex">
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
        class="col-start-1 justify-self-start lg:hidden"
        @click="toggleMenu"
      />

      <NuxtLink
        v-if="homeTo"
        :to="homeTo"
        class="group col-start-2 flex flex-col items-center justify-center justify-self-center px-4"
      >
        <!-- 滑過品牌時灑出金色小心軌跡（純裝飾，reduced-motion 下不產生） -->
        <TextCursor :spacing="26" :max-points="6" font-class="text-base">
          <svg viewBox="0 0 24 24" fill="currentColor" class="size-4 text-gold">
            <path d="M12 20.4c-.28 0-.55-.1-.76-.29C7.9 17.2 3.4 13.5 3.4 9.1 3.4 6.3 5.5 4.1 8.2 4.1c1.5 0 2.9.7 3.8 1.9.9-1.2 2.3-1.9 3.8-1.9 2.7 0 4.8 2.2 4.8 5 0 4.4-4.5 8.1-7.84 11-.21.19-.48.29-.76.29Z" />
          </svg>
        </TextCursor>
        <span class="font-display text-2xl font-semibold tracking-wide text-ink transition-transform duration-400 ease-emphasized group-hover:-translate-y-px">
          EverAfter
        </span>
      </NuxtLink>
      <span
        v-else
        class="col-start-2 justify-self-center font-display text-2xl font-semibold tracking-wide text-ink"
      >
        EverAfter
      </span>

      <UButton
        v-if="ctaItem"
        :to="ctaItem.to"
        data-testid="vibe-guest-nav-cta"
        color="primary"
        size="sm"
        class="col-start-3 hidden justify-self-end lg:inline-flex"
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
      class="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto bg-cream/90 backdrop-blur-xl lg:hidden"
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
