<!-- app/components/gallery/GalleryLogoMark.vue — 婚禮字樣的「手寫」揭開
     字樣是輪廓化字形（單一 fill path、沒有 stroke），路徑資料在 galleryLogoPath.ts。

     做法：<mask> 裡放一條很粗的描邊當筆刷，沿「筆的中心線」掃過去，揭開底下的填色字樣——
     填色只存在於字的範圍內，筆刷溢出邊界不影響結果。
     直接對 fill path 下 stroke-dashoffset 是行不通的：那畫的是字的「外框輪廓」，看起來像雕邊而不是書寫。

     筆刷的軌跡 2026-09-17 從「字的輪廓線」換成「筆的中心線」（新人：有些小地方後面才畫到）：
     第一版拿輪廓本身當軌跡——筆走完一筆的左緣要繞一大圈才回來走右緣，粗的那幾筆先出現半邊、隔很久才補另一半；
     字裡的兩個洞是另外的 subpath，虛線在每個 subpath 重新起算，所以洞的內緣要到最後 5% 才出現。
     換一張更順的原稿解不了（一樣是輪廓），要的是一條中心線：從字形細線化反推出來、照筆順接成一條
     （galleryLogoPath.ts 的 LOGO_CENTERLINE），筆刷粗細＝最粗那一筆的全寬，每一筆經過時整個粗細一次出現。 -->
<script setup lang="ts">
import { LOGO_BRUSH, LOGO_CENTERLINE, LOGO_GLYPH, LOGO_HEIGHT, LOGO_VIEWBOX, LOGO_WIDTH } from './galleryLogoPath'

const props = withDefaults(defineProps<{
  /** 0~1 書寫進度 */
  progress?: number
}>(), { progress: 1 })

/** 筆刷會超出字的邊界，遮罩範圍要留餘裕，否則掃到邊緣會被裁掉 */
const MASK_PAD = 40

const maskId = `logo-ink-${useId()}`
const strokeRef = ref<SVGPathElement | null>(null)
/** 中心線總長。不用 pathLength 屬性正規化成 1——那是大小寫敏感的 SVG 屬性，
    經 Vue 模板會變成 pathlength 而失效（虛線變成密集短點，看起來像一開始就寫完了）。 */
const totalLength = ref(0)

const dashArray = computed(() => `${totalLength.value} ${totalLength.value}`)
/** 從起筆那一端往前揭：offset 從整條長度收到 0 */
const dashOffset = computed(() => {
  const p = Math.min(Math.max(props.progress, 0), 1)
  return (1 - p) * totalLength.value
})

onMounted(() => {
  totalLength.value = strokeRef.value?.getTotalLength() ?? 0
})
</script>

<template>
  <svg class="lm" :viewBox="LOGO_VIEWBOX" role="img" :aria-label="$attrs['aria-label'] as string ?? undefined">
    <defs>
      <path :id="`${maskId}-glyph`" :d="LOGO_GLYPH" />
      <mask
        :id="maskId"
        mask-units="userSpaceOnUse"
        :x="-MASK_PAD"
        :y="-MASK_PAD"
        :width="LOGO_WIDTH + MASK_PAD * 2"
        :height="LOGO_HEIGHT + MASK_PAD * 2"
      >
        <!-- 還沒量到長度（SSR、掛載前）筆刷不上色：整個字維持底稿的樣子。
             不能靠 dasharray 收起來——長度 0 的虛線配圓端點會畫出一顆顆圓，連起來就是整條實線 -->
        <path
          ref="strokeRef"
          :d="LOGO_CENTERLINE"
          fill="none"
          :stroke="totalLength ? '#fff' : 'none'"
          :stroke-width="LOGO_BRUSH"
          stroke-linecap="round"
          stroke-linejoin="round"
          :stroke-dasharray="dashArray"
          :stroke-dashoffset="dashOffset"
        />
      </mask>
    </defs>

    <!-- 底稿：還沒寫到的地方留一個淡淡的引導；寫滿之後會被墨線完全蓋住 -->
    <use :href="`#${maskId}-glyph`" class="lm-ghost" />
    <use :href="`#${maskId}-glyph`" class="lm-ink" :mask="`url(#${maskId})`" />
  </svg>
</template>

<style scoped>
.lm {
  display: block;
  width: 100%;
  height: auto;
}

.lm-ghost {
  fill: var(--color-ink-700);
  opacity: 0.15;
}

.lm-ink {
  fill: var(--color-ink-700);
}
</style>
