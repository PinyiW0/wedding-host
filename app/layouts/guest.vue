<template>
  <!-- 賓客公開頁面（RSVP / 報到 / 祝福 / LINE 綁定）：無後台導航，行動裝置優先 -->
  <div class="flex min-h-screen flex-col bg-neutral-100">
    <header class="shrink-0 border-b border-neutral-200 bg-white">
      <div class="mx-auto flex h-14 max-w-2xl items-center justify-center px-4">
        <span class="text-lg font-bold text-primary-600">EverAfter</span>
      </div>
    </header>
    <main class="flex flex-1 flex-col items-center px-4 py-6">
      <div class="w-full max-w-2xl">
        <slot />
      </div>
    </main>
  </div>
</template>
