<!-- app/components/PublicMenu.vue — 公開頁右上角的選單（相簿首頁／系列頁／故事頁／公開出席回覆頁共用）
     取代原本散在頁尾的兩顆 UButton 與底部的系列膠囊：那兩者一個是後台元件混進編輯風格的頁面，
     一個只有捲到最底才出現，中段整段沒有導覽。
     互動抄 vue-bits 的 Flowing Menu——滑過某一列時，一條跑馬燈從游標進入的那一側掃進來——
     但外觀整組換成本站語彙：紙色底、墨色字、襯線 display 字體、金色細線，
     跑馬燈裡放的是**該系列自己的照片**，效果本身就是內容。
     只用 CSS transition 與 keyframes，不引入動畫函式庫。
     跑馬燈是 hover 驅動的，觸控裝置沒有 hover：手機上它退化成一份乾淨的清單，功能不受影響。 -->
<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

const props = withDefaults(defineProps<{
  weddingId: string
  /** 相簿首頁把系列列做成錨點跳段，其他頁做成路由 */
  seriesAnchors?: boolean
  /**
   * 開關的顏色怎麼決定：true＝白線用 mix-blend-mode: difference 自動翻色（相簿頁：滿版照片與紙底交錯，沒有人回報底色）；
   * false＝由頁面各區塊透過 usePublicChrome 回報「底下是不是深色」，深色換紙白、否則墨色（故事頁：中灰的石牆混色翻不出對比）
   */
  blend?: boolean
}>(), { blend: true })

const { light } = usePublicChrome()

interface MenuRow {
  label: string
  word: string
  to: string
  image: string
}

const content = useGalleryContent()
const route = useRoute()

/** 選單裡每個連結都帶著網址上的婚禮簽章（?sig=），換頁不會掉；錨點連結不帶（見 useSignedLink） */
const { withSig } = useSignedLink()

const rows = computed<MenuRow[]>(() => {
  const list: MenuRow[] = content.series.map(series => ({
    label: series.title,
    word: series.word,
    to: props.seriesAnchors ? `#series-${series.slug}` : `/gallery/${props.weddingId}/${series.slug}`,
    // 跑馬燈縮圖是 3:2 置中裁切，只吃專為它挑的橫式照片（menuThumb），
    // 不再沿用 preview——那是為系列頁滿版預告卡挑的，直式的話這裡會切掉人物
    image: series.menuThumb,
  }))
  list.push(
    { label: '婚紗相簿', word: 'Gallery', to: `/gallery/${props.weddingId}`, image: content.hero.src },
    { label: '我們的故事', word: 'Our Story', to: `/story/${props.weddingId}`, image: content.series[1]?.cover ?? content.hero.src },
    { label: '喜帖', word: 'Invitation', to: `/invite/${props.weddingId}`, image: content.inviteThumb },
  )
  const rowsForPage = route.path === `/story/${props.weddingId}`
    ? [
        { label: '婚宴資訊', word: 'Wedding Day', to: '#wedding-info', image: '/images/story/venue-hall.webp' },
        { label: '出席回覆', word: 'RSVP', to: `/rsvp/public/${props.weddingId}`, image: content.inviteThumb },
        ...list.filter(row => ['Gallery', 'Invitation'].includes(row.word)),
      ]
    // 出席回覆頁：只列三個公開頁（故事、相簿、喜帖），相簿的系列頁不列——那是相簿裡面的分頁，從回覆表單直接跳過去太跳
    : route.path === `/rsvp/public/${props.weddingId}`
      ? list.filter(row => ['Our Story', 'Gallery', 'Invitation'].includes(row.word))
      // 喜帖頁：就是桌上那三個出口（故事、相簿、出席回覆），相簿的系列頁同樣不列
      : route.path === `/invite/${props.weddingId}`
        ? [
            ...list.filter(row => ['Our Story', 'Gallery'].includes(row.word)),
            { label: '出席回覆', word: 'RSVP', to: `/rsvp/public/${props.weddingId}`, image: content.inviteThumb },
          ]
      // 不連到自己所在的那一頁
        : list.filter(row => row.to !== route.path)
  return rowsForPage.map(row => ({ ...row, to: withSig(row.to) }))
})

const isOpen = ref(false)
const hoverIndex = ref<number | null>(null)
const toggleRef = ref<HTMLElement | null>(null)

// 依列的索引存，面板卸載時 Vue 會用 null 呼叫一次、這裡跟著清掉。
// 原本只 push 不清：關掉再打開時陣列前面還是上一次已經拆掉的節點，
// 第二次開啟焦點進不了第一個連結、跑馬燈也改到舊的那條（PR #159 Copilot 審查，實測第二次開啟即重現）
const marquees: (HTMLElement | null)[] = []
const links: (HTMLElement | null)[] = []

function toElement(el: Element | ComponentPublicInstance | null): HTMLElement | null {
  const node = el instanceof HTMLElement ? el : (el as ComponentPublicInstance | null)?.$el
  return node instanceof HTMLElement ? node : null
}

function setMarqueeRef(el: Element | ComponentPublicInstance | null, index: number) {
  marquees[index] = toElement(el)
}

function setLinkRef(el: Element | ComponentPublicInstance | null, index: number) {
  links[index] = toElement(el)
}

/** 游標從這一列的上緣還是下緣進來：-1 上、1 下 */
function edgeOf(event: PointerEvent, row: HTMLElement): number {
  const rect = row.getBoundingClientRect()
  return event.clientY - rect.top < rect.height / 2 ? -1 : 1
}

function onRowEnter(event: PointerEvent, index: number) {
  const marquee = marquees[index]
  const row = event.currentTarget
  if (marquee && row instanceof HTMLElement) {
    // 換邊時要先關掉過場，否則跑馬燈會從對側「掃」過整列才歸位
    marquee.style.transition = 'none'
    marquee.style.setProperty('--edge', String(edgeOf(event, row)))
    void marquee.offsetHeight
    marquee.style.transition = ''
  }
  hoverIndex.value = index
}

function onRowLeave(event: PointerEvent, index: number) {
  const marquee = marquees[index]
  const row = event.currentTarget
  if (marquee && row instanceof HTMLElement)
    marquee.style.setProperty('--edge', String(edgeOf(event, row)))
  if (hoverIndex.value === index)
    hoverIndex.value = null
}

function close() {
  isOpen.value = false
  hoverIndex.value = null
  nextTick(() => toggleRef.value?.focus())
}

function toggle() {
  if (isOpen.value) {
    close()
    return
  }
  isOpen.value = true
  nextTick(() => links[0]?.focus())
}

/** 開啟時把焦點鎖在「開關 + 選單連結」之間，Tab 不會跑到蓋住的頁面上 */
function onKeydown(event: KeyboardEvent) {
  if (!isOpen.value)
    return
  if (event.key === 'Escape') {
    close()
    return
  }
  if (event.key !== 'Tab')
    return
  const focusables = [toggleRef.value, ...links].filter((el): el is HTMLElement => !!el)
  if (focusables.length < 2)
    return
  const first = focusables[0]!
  const last = focusables.at(-1)!
  const active = document.activeElement
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

// 開啟時鎖住背景捲動，不然選單後面的頁面會跟著滑
watch(isOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="pm">
    <button
      ref="toggleRef"
      type="button"
      class="pm-toggle"
      :class="blend ? 'pm-toggle-blend' : light ? 'pm-toggle-light' : 'pm-toggle-ink'"
      :aria-label="isOpen ? '關閉選單' : '開啟選單'"
      :aria-expanded="isOpen"
      aria-controls="public-menu-panel"
      @click="toggle"
    >
      <span class="pm-bars" :class="{ 'pm-bars-on': isOpen }" aria-hidden="true">
        <span class="pm-bar" />
        <span class="pm-bar" />
        <span class="pm-bar" />
      </span>
    </button>

    <Transition name="pm">
      <div v-if="isOpen" id="public-menu-panel" class="pm-panel">
        <nav class="pm-list" aria-label="網站導覽">
          <div
            v-for="(row, i) in rows"
            :key="row.to"
            class="pm-row"
            :style="{ '--i': String(i) }"
            :data-on="hoverIndex === i ? 'true' : 'false'"
            @pointerenter="onRowEnter($event, i)"
            @pointerleave="onRowLeave($event, i)"
          >
            <NuxtLink :ref="el => setLinkRef(el, i)" :to="row.to" class="pm-link" @click="close">
              <span class="pm-label">{{ row.label }}</span>
              <span class="pm-word">{{ row.word }}</span>
            </NuxtLink>

            <span :ref="el => setMarqueeRef(el, i)" class="pm-marquee" aria-hidden="true">
              <span class="pm-track">
                <template v-for="n in 8" :key="n">
                  <span class="pm-run">{{ row.label }}</span>
                  <img :src="row.image" alt="" class="pm-run-img" loading="lazy" decoding="async">
                </template>
              </span>
            </span>
          </div>
        </nav>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 白線、沒有底色也沒有陰影（新人指示）。
   純白線只在 hero 滿版照片上看得見——往下捲整頁都是紙色底，白線會直接消失。
   相簿頁（blend）用 mix-blend-mode: difference：線本身是白的，蓋在深色照片上就是白的，
   蓋在紙色底上自動翻成深色。一條規則、不需要 JS 判斷捲到哪，也不必加回陰影。
   故事頁（不 blend）改成明講：混色遇到中灰的石牆（書第一跨）翻出來還是中灰，
   所以由區塊回報底色——深色換紙白（pm-toggle-light）、否則墨色（pm-toggle-ink），換色 250ms。 */
.pm-toggle {
  position: fixed;
  top: clamp(14px, 3vh, 30px);
  right: clamp(14px, 3vw, 34px);
  z-index: 70;
  display: inline-flex;
  align-items: center;
  padding: 10px;
  transition:
    opacity 250ms var(--ease-standard),
    color 250ms var(--ease-standard);
}

.pm-toggle-blend {
  color: #fff;
  mix-blend-mode: difference;
}

.pm-toggle-ink {
  color: var(--color-ink);
}

.pm-toggle-light {
  color: var(--color-paper);
}

.pm-toggle:hover,
.pm-toggle:focus-visible {
  opacity: 0.7;
}

.pm-toggle:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 3px;
}

.pm-bars {
  display: grid;
  gap: 5px;
  width: 22px;
}

.pm-bar {
  display: block;
  height: 1px;
  background: currentcolor;
  transition:
    transform 300ms var(--ease-emphasized),
    opacity 200ms var(--ease-standard);
}

/* 開啟時中間那條讓開，上下兩條交叉成 X——只動 transform 與 opacity */
.pm-bars-on .pm-bar:first-child {
  transform: translateY(6px) rotate(45deg);
}

.pm-bars-on .pm-bar:nth-child(2) {
  opacity: 0;
}

.pm-bars-on .pm-bar:last-child {
  transform: translateY(-6px) rotate(-45deg);
}

.pm-panel {
  position: fixed;
  inset: 0;
  z-index: 65;
  display: grid;
  align-content: center;
  overflow-y: auto;
  padding-block: clamp(72px, 12vh, 132px);
  background: var(--color-paper);
}

.pm-fade-enter-active,
.pm-fade-leave-active {
  transition: opacity 320ms var(--ease-standard);
}

.pm-enter-active,
.pm-leave-active {
  transition: opacity 320ms var(--ease-standard);
}

.pm-enter-from,
.pm-leave-to {
  opacity: 0;
}

.pm-row {
  position: relative;
  overflow: hidden;
  border-top: 1px solid var(--color-line);
  /* 逐列升起，step 60ms */
  animation: pm-rise 520ms var(--ease-emphasized) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}

.pm-row:last-child {
  border-bottom: 1px solid var(--color-line);
}

@keyframes pm-rise {
  from {
    opacity: 0;
    transform: translateY(22px);
  }
}

.pm-link {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: clamp(18px, 3.4vh, 34px) clamp(20px, 6vw, 88px);
  font-family: var(--font-display);
}

.pm-link:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: -4px;
}

.pm-label {
  font-size: clamp(1.75rem, 5vw, 3.25rem);
  line-height: 1.1;
  color: var(--color-ink);
}

.pm-word {
  font-style: italic;
  font-size: clamp(0.875rem, 1.6vw, 1.25rem);
  color: var(--color-ink-300);
}

/* 跑馬燈：從游標進入的那一側掃進來（--edge -1 上、1 下），墨底紙字＝相紙的負片 */
.pm-marquee {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  overflow: hidden;
  /* 蓋在連結上面，但點擊要穿透下去給連結 */
  pointer-events: none;
  background: var(--color-ink);
  transform: translateY(calc(var(--edge, 1) * 101%));
  transition: transform 480ms var(--ease-emphasized);
}

.pm-row[data-on="true"] .pm-marquee {
  transform: translateY(0);
}

.pm-track {
  display: flex;
  align-items: center;
  gap: clamp(16px, 3vw, 40px);
  padding-left: clamp(16px, 3vw, 40px);
  white-space: nowrap;
  animation: pm-slide 22s linear infinite;
}

@keyframes pm-slide {
  to {
    transform: translateX(-50%);
  }
}

.pm-run {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 4vw, 2.75rem);
  color: var(--color-paper);
}

.pm-run-img {
  width: clamp(64px, 9vw, 128px);
  aspect-ratio: 3 / 2;
  border-radius: var(--radius);
  object-fit: cover;
}

/* 關掉動效：不跑無限跑馬燈，滑過就只換色（creative-direction §4） */
@media (prefers-reduced-motion: reduce) {
  .pm-row {
    animation: none;
  }

  .pm-marquee {
    display: none;
  }

  .pm-row[data-on="true"] .pm-link {
    background: var(--color-ink);
  }

  .pm-row[data-on="true"] .pm-label {
    color: var(--color-paper);
  }

  .pm-row[data-on="true"] .pm-word {
    color: var(--color-line);
  }
}
</style>
