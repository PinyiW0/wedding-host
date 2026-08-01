<template>
  <!-- 賓客公開頁面（RSVP / 報到 / 祝福 / 謝卡 / LINE 綁定）：行動裝置優先，
       導覽列可見項目依連結簽名等級決定（見 useGuestNav） -->
  <div class="flex min-h-screen flex-col bg-cream">
    <GuestNav />
    <main class="flex flex-1 flex-col items-center px-4 py-6">
      <div class="w-full max-w-2xl">
        <slot />
      </div>
    </main>
  </div>
</template>
