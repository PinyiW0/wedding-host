<template>
  <div>
    <NuxtRouteAnnouncer />
    <!-- 切頁 loading 過場：全頁遮罩擋互動，throttle 避免快速切頁閃爍 -->
    <PageLoadingOverlay />
    <UApp :toaster="{ position: 'top-right', duration: 3000 }">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </div>
</template>
