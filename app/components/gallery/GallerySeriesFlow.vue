<!-- app/components/gallery/GallerySeriesFlow.vue — 系列內頁的照片流
     不是一路等寬滑到底，而是照一組循環的節奏錯落排：置中中圖 → 左大右小（右邊往下錯開）
     → 滿版出血 → 左小右大 → 置中小圖。留白也跟著變，翻起來才有起伏。
     每張照片的進場**幅度不同**：小圖拖得慢、大圖幾乎跟著頁面走（遠的東西移得慢），
     靠邊的還會往外側偏一點，滿版那張則是照片在框內自己走、框釘死。
     --gt 由 useScrollProgress 以「通過視窗的行程」寫入（0 在下、0.5 置中、1 在上），
     預設 0.5＝正對中心＝定位尺寸，所以沒有 JS 或 reduced-motion 時就是一般的靜態排版。 -->
<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { GalleryPhoto } from '~/types/gallery'

const props = defineProps<{
  photos: GalleryPhoto[]
}>()

/** 一輪的排版節奏，每列 1~2 張；照片用完就停，不足的列自然收短 */
const ROW_PATTERN = [
  ['center'],
  ['left', 'right-small'],
  ['full'],
  ['left-small', 'right'],
  ['center-small'],
] as const

const activeIndex = ref<number | null>(null)
const items: HTMLElement[] = []

const { register } = useScrollProgress()

const rows = computed(() => {
  const result: { kind: string, photo: GalleryPhoto, index: number }[][] = []
  let cursor = 0
  let step = 0
  while (cursor < props.photos.length) {
    const pattern = ROW_PATTERN[step % ROW_PATTERN.length]!
    const row: { kind: string, photo: GalleryPhoto, index: number }[] = []
    for (const kind of pattern) {
      const photo = props.photos[cursor]
      if (!photo)
        break
      row.push({ kind, photo, index: cursor })
      cursor += 1
    }
    if (row.length)
      result.push(row)
    step += 1
  }
  return result
})

function setItemRef(el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement && !items.includes(el))
    items.push(el)
}

onMounted(() => {
  for (const el of items)
    register(el, { varName: '--gt', mode: 'travel' })
})
</script>

<template>
  <div class="sf">
    <div
      v-for="(row, r) in rows"
      :key="r"
      class="sf-row"
    >
      <figure
        v-for="slot in row"
        :ref="setItemRef"
        :key="slot.photo.src"
        class="sf-slot"
        :class="`sf-${slot.kind}`"
      >
        <button type="button" class="sf-btn" data-cursor="View" @click="activeIndex = slot.index">
          <span class="sf-media">
            <img
              :src="slot.photo.src"
              :alt="slot.photo.alt"
              :loading="slot.photo.eager ? 'eager' : 'lazy'"
              decoding="async"
              class="sf-img"
            >
            <!-- 光影：離視窗中心越遠壓得越暗、暈影越重；滑到中央才完全亮起來 -->
            <span class="sf-shade" aria-hidden="true" />
            <span class="sf-glow" aria-hidden="true" />
          </span>
          <span class="sr-only">放大檢視</span>
        </button>
        <figcaption v-if="slot.photo.caption" class="sf-caption">
          {{ slot.photo.caption }}
        </figcaption>
      </figure>
    </div>

    <GalleryLightbox v-model:index="activeIndex" :photos="photos" />
  </div>
</template>

<style scoped>
.sf {
  position: relative;
  width: 100%;
  overflow-x: hidden;
}

/* 手機：一律單欄，只用寬度與左右靠邊做變化 */
.sf-row {
  display: grid;
  gap: clamp(28px, 6vh, 72px);
  margin-block: clamp(40px, 8vh, 96px);
}

.sf-slot {
  /* --gt 帶方向，位移要靠它才知道往哪推；這裡順手折成「離中心多近」（0＝最遠、1＝正中央），
     壓暗與暖光用這個。用 max() 代替 abs()——abs() 的瀏覽器支援還不夠 */
  --near: calc(1 - max(var(--gt, 0.5) * 2 - 1, 1 - var(--gt, 0.5) * 2));

  width: 86vw;
  margin-inline: auto;
}

/* ── 錯落的行程 ──
   --rise：這張比頁面慢多少（值越大＝拖得越後面＝看起來越遠）
   --drift：橫向偏移，只給靠邊的那幾張，往它自己那一側再讓開一點
   --zoom：離中心最遠時的縮小程度（回到中心一律 1）
   數字刻意不成等差：等差看起來還是「一起動」，差距要參差才像各走各的 */
.sf-center {
  --rise: 3vh;
  --zoom: 0.96;
}

.sf-left {
  --rise: 5vh;
  --zoom: 0.93;
}

.sf-right-small {
  --rise: 8vh;
  --zoom: 0.9;
}

.sf-left-small {
  --rise: 7vh;
  --zoom: 0.9;
}

.sf-right {
  --rise: 4vh;
  --zoom: 0.94;
}

.sf-center-small {
  --rise: 6vh;
  --zoom: 0.92;
}

.sf-full {
  width: 100%;
}

.sf-center-small,
.sf-left-small,
.sf-right-small {
  width: 62vw;
}

.sf-left,
.sf-left-small {
  margin-left: 6vw;
  margin-right: auto;
}

.sf-right,
.sf-right-small {
  margin-right: 6vw;
  margin-left: auto;
}

/* 桌機：12 欄格線，錯落靠欄位與 margin-top 做 */
@media (min-width: 768px) {
  .sf-row {
    grid-template-columns: repeat(12, 1fr);
    align-items: start;
    gap: 0;
    margin-block: clamp(64px, 12vh, 168px);
  }

  .sf-slot {
    width: auto;
    margin-inline: 0;
  }

  .sf-center {
    grid-column: 4 / 11;
  }

  .sf-center-small {
    grid-column: 5 / 10;
  }

  .sf-full {
    grid-column: 1 / -1;
  }

  .sf-left {
    grid-column: 2 / 8;
  }

  .sf-right-small {
    grid-column: 9 / 12;
    margin-top: 24vh;
    --rise: 12vh;
    --drift: 1.6vw;
  }

  .sf-left-small {
    grid-column: 2 / 5;
    margin-top: 20vh;
    --rise: 11vh;
    --drift: -1.6vw;
  }

  .sf-right {
    grid-column: 6 / 12;
    --rise: 5vh;
    --drift: 1.1vw;
  }

  .sf-center {
    --rise: 4vh;
  }

  .sf-left {
    --rise: 7vh;
    --drift: -1.1vw;
  }

  .sf-center-small {
    --rise: 9vh;
  }
}

.sf-btn {
  display: block;
  width: 100%;
  cursor: zoom-in;
}

.sf-btn:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 6px;
}

/* 位移與縮放都掛在外層：光影層要跟著一起走，才不會在邊緣露出一圈 */
.sf-media {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: var(--radius);
  /* 還在視窗下方時往下壓、到中心歸零＝看起來比頁面慢半拍；離中心最遠縮到 --zoom，中心一律 1 */
  transform:
    translate3d(
      calc((0.5 - var(--gt, 0.5)) * var(--drift, 0px)),
      calc((0.5 - var(--gt, 0.5)) * var(--rise, 0px)),
      0
    )
    scale(calc(var(--zoom, 0.94) + var(--near) * (1 - var(--zoom, 0.94))));
  will-change: transform;
}

/* 出血這張不整塊位移——邊會露出來。改成框釘死、照片在框內自己上下走 */
.sf-full .sf-media {
  border-radius: 0;
  transform: none;
}

.sf-full .sf-img {
  /* 放大 12% 換來上下各 6% 的餘裕，位移最多走 4.5%；不動時就只是裁得稍緊一點 */
  transform: translate3d(0, calc((0.5 - var(--gt, 0.5)) * 9%), 0) scale(1.12);
  will-change: transform;
}

.sf-img {
  display: block;
  width: 100%;
  height: auto;
  background: var(--color-cream);
}

/* 暈影＋壓暗：正中央時完全退開，離越遠越重 */
.sf-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(125% 95% at 50% 46%, transparent 36%, rgb(17 17 17 / 66%) 100%);
  opacity: calc((1 - var(--near)) * 0.82);
}

/* 斜落的暖光：滑到中央時最亮，像光落在相紙上 */
.sf-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(118deg, rgb(255 248 233 / 62%) 0%, transparent 48%);
  opacity: calc(var(--near) * 0.1);
}

.sf-caption {
  margin-top: 12px;
  text-align: center;
  font-size: var(--text-body);
  color: var(--color-ink-500);
}
</style>
