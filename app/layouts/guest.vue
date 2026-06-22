<template>
  <!-- 賓客公開頁面（RSVP / 報到 / 祝福 / LINE 綁定）：無後台導航，行動裝置優先 -->
  <div class="flex min-h-screen flex-col bg-cream">
    <header class="shrink-0 border-b border-line bg-paper">
      <div class="mx-auto flex h-16 max-w-2xl items-center justify-center px-4">
        <span class="font-display text-2xl font-semibold tracking-wide text-ink">EverAfter</span>
      </div>
    </header>
    <main class="flex flex-1 flex-col items-center px-4 py-6">
      <div class="w-full max-w-2xl">
        <slot />
      </div>
    </main>
  </div>
</template>
