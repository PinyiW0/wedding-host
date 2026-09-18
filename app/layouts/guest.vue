<template>
  <!-- 賓客公開頁面（RSVP / 報到 / 祝福 / 謝卡 / LINE 綁定）：行動裝置優先，
       導覽列可見項目依連結簽名等級決定（見 useGuestNav） -->
  <!-- overflow-x-clip：大圖模板的照片區塊用 100vw 掙脫出內容欄位鋪滿螢幕，
       而 100vw 含捲軸寬，會多出十幾 px 的水平捲動 -->
  <div class="flex min-h-screen flex-col overflow-x-clip bg-cream">
    <GuestNav />
    <!-- --bleed-top 要跟 py-6 的上緣同值（見 RsvpBannerCollage 的滿寬處理） -->
    <main class="flex flex-1 flex-col items-center px-4 py-6 [--bleed-top:1.5rem]">
      <div class="w-full max-w-2xl">
        <slot />
      </div>
    </main>
    <ClickSpark />
  </div>
</template>
