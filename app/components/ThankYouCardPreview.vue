<!-- app/components/ThankYouCardPreview.vue — 謝卡信箋本體（公開頁與後台 Live Preview 共用，確保兩處永遠同步） -->
<script setup lang="ts">
// editorial-minimal 非對稱信箋：左 greeting / 右描邊金印、serif 大字稱呼、右對齊署名、書口鍍金邊
withDefaults(
  defineProps<{
    greeting?: string | null
    // 公開頁帶入賓客名（凍結：只能渲染一次）；後台預覽不帶
    guestName?: string | null
    content?: string | null
    // 內文為空時的替代文字（公開頁與後台語境不同）
    placeholder?: string
    signature?: string | null
    signatureDate?: string | null
    imageUrl?: string | null
    // 已不在卡面顯示（2026-07-10 拿掉金印），保留供呼叫端相容
    seal?: string
    // 後台 Live Preview 需要 template-preview testid（凍結 toHaveText），由 prop 傳入；公開頁不傳
    contentTestid?: string
  }>(),
  {
    placeholder: '',
  },
)
</script>

<template>
  <article class="craft-paper relative overflow-hidden rounded-lg bg-rose-50 shadow-xl">
    <!-- 雙線框＋角飾（玫瑰金） -->
    <span class="pointer-events-none absolute inset-2 z-10 border border-rose-300/60" />
    <span class="pointer-events-none absolute inset-3.5 z-10 border border-rose-200/50" />
    <span class="craft-corners pointer-events-none absolute inset-2 z-10 text-rose-300" />

    <!-- 金線花枝（botanical line art）：左下主枝與右上小枝對角呼應 -->
    <svg
      class="pointer-events-none absolute -bottom-3 -left-2 z-10 h-40 w-40 opacity-50"
      viewBox="0 0 140 140"
      fill="none"
      stroke="var(--color-rose-300)"
      stroke-width="1.4"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M10 134 Q 40 110 58 80 Q 70 58 66 36" />
      <path d="M44 106 Q 60 102 70 106" />
      <path d="M56 84 Q 44 74 40 62" />
      <path d="M44 106 Q 52 96 64 94 Q 58 106 44 106 Z" />
      <path d="M40 62 Q 30 54 28 42 Q 40 48 40 62 Z" />
      <path d="M70 106 Q 82 100 90 102 Q 82 112 70 106 Z" />
      <g transform="translate(66 30)">
        <path d="M0 -13 Q 7 -7 5 2 Q 0 7 -5 2 Q -7 -7 0 -13 Z" />
        <path d="M0 -13 Q 7 -7 5 2 Q 0 7 -5 2 Q -7 -7 0 -13 Z" transform="rotate(72)" />
        <path d="M0 -13 Q 7 -7 5 2 Q 0 7 -5 2 Q -7 -7 0 -13 Z" transform="rotate(144)" />
        <path d="M0 -13 Q 7 -7 5 2 Q 0 7 -5 2 Q -7 -7 0 -13 Z" transform="rotate(216)" />
        <path d="M0 -13 Q 7 -7 5 2 Q 0 7 -5 2 Q -7 -7 0 -13 Z" transform="rotate(288)" />
        <circle r="3" />
      </g>
    </svg>
    <svg
      class="pointer-events-none absolute -right-3 -top-3 z-10 h-24 w-24 rotate-180 opacity-40"
      viewBox="0 0 140 140"
      fill="none"
      stroke="var(--color-rose-300)"
      stroke-width="1.6"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M10 134 Q 40 110 58 80 Q 70 58 66 36" />
      <path d="M56 84 Q 44 74 40 62" />
      <path d="M40 62 Q 30 54 28 42 Q 40 48 40 62 Z" />
      <path d="M44 106 Q 52 96 64 94 Q 58 106 44 106 Z" />
    </svg>

    <!-- 頂部主視覺帶（有上傳圖才顯示） -->
    <div v-if="imageUrl" class="relative">
      <img :src="imageUrl" alt="" class="h-40 w-full object-cover">
      <span class="block h-px w-full bg-rose-300/60" />
    </div>

    <div class="ty-card-body relative px-8 py-10 text-left sm:px-10 sm:py-12">
      <!-- 首行：greeting eyebrow -->
      <p class="pt-2 text-overline uppercase text-rose-400">
        {{ greeting }}
      </p>

      <div class="mt-6 flex items-center gap-3">
        <span class="h-px w-12 bg-rose-300/70" />
        <span class="size-1 rotate-45 bg-rose-300" />
      </div>

      <!-- 賓客稱呼（手寫體、暗玫瑰；親愛的 16px／名字 20px） -->
      <p
        v-if="guestName"
        class="mt-6 font-hand leading-relaxed text-rose-ink"
      >
        <span class="text-xl">親愛的 </span><span class="text-2xl">{{ guestName }}</span>
      </p>

      <!-- 內文（手寫體、暖玫瑰褐） -->
      <p
        v-if="content"
        :data-testid="contentTestid"
        class="mt-6 whitespace-pre-line font-hand text-xl leading-loose text-rose-950/75"
      >
        {{ content }}
      </p>
      <p v-else-if="placeholder" class="mt-6 font-hand text-xl leading-loose text-rose-950/75">
        {{ placeholder }}
      </p>

      <!-- 署名（手寫體、暗玫瑰，整塊右對齊；自動補「敬上」，署名已含敬語則不重複） -->
      <div class="mt-10 text-right">
        <p
          v-if="signature"
          class="text-balance font-hand text-xl leading-relaxed text-rose-ink"
        >
          {{ signature }}<span v-if="!/[敬謹]上/.test(signature)" class="ml-2 text-base">敬上</span>
        </p>
        <p v-if="signatureDate" class="mt-2 text-caption tracking-widest text-rose-ink/70">
          {{ signatureDate }}
        </p>
      </div>
    </div>

    <!-- 書口緞粉邊 -->
    <span class="block h-1 w-full bg-rose-300" />
  </article>
</template>
