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
    seal: string
    // 後台 Live Preview 需要 template-preview testid（凍結 toHaveText），由 prop 傳入；公開頁不傳
    contentTestid?: string
  }>(),
  {
    placeholder: '',
  },
)
</script>

<template>
  <article class="relative overflow-hidden rounded-lg bg-paper shadow-xl dark:bg-neutral-900">
    <!-- 內金線框 -->
    <span class="pointer-events-none absolute inset-2.5 z-10 rounded border border-gold/30" />
    <!-- 極淡紙紋 -->
    <span
      class="pointer-events-none absolute inset-0"
      style="background-image: radial-gradient(circle at 30% 18%, rgba(184, 150, 90, 0.06), transparent 55%)"
    />

    <!-- 頂部主視覺帶（有上傳圖才顯示） -->
    <div v-if="imageUrl" class="relative">
      <img :src="imageUrl" alt="" class="h-40 w-full object-cover">
      <span class="block h-px w-full bg-gold/50" />
    </div>

    <div class="ty-card-body relative px-8 py-10 text-left sm:px-10 sm:py-12">
      <!-- 首行：左 greeting eyebrow / 右描邊金印（quiet luxury，去色塊） -->
      <div class="flex items-start justify-between gap-4">
        <p class="pt-2 text-overline uppercase text-gold-deep">
          {{ greeting }}
        </p>
        <span class="flex size-12 shrink-0 items-center justify-center rounded-full border border-gold font-display text-body font-semibold text-gold-deep">
          {{ seal }}
        </span>
      </div>

      <span class="mt-6 block h-px w-12 bg-gold" />

      <!-- 賓客稱呼（type-led 主角） -->
      <p
        v-if="guestName"
        class="mt-6 font-display text-h1 font-semibold leading-tight text-ink dark:text-paper"
      >
        親愛的 {{ guestName }}
      </p>

      <!-- 內文 -->
      <p
        v-if="content"
        :data-testid="contentTestid"
        class="mt-6 whitespace-pre-line text-body-l leading-loose text-ink-700 dark:text-neutral-300"
      >
        {{ content }}
      </p>
      <p v-else-if="placeholder" class="mt-6 text-body-l leading-loose text-ink-500">
        {{ placeholder }}
      </p>

      <!-- 署名（整塊右對齊，非對稱留白） -->
      <div class="mt-10 text-right">
        <p
          v-if="signature"
          class="text-balance font-display text-h2 font-semibold leading-tight text-ink dark:text-paper"
        >
          {{ signature }}
        </p>
        <p v-if="signatureDate" class="mt-2 text-caption tracking-widest text-ink-500">
          {{ signatureDate }}
        </p>
      </div>
    </div>

    <!-- 書口鍍金邊 -->
    <span class="block h-1 w-full bg-gold/70" />
  </article>
</template>
