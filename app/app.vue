<template>
  <div>
    <NuxtRouteAnnouncer />
    <UApp :toaster="{ position: 'top-right', duration: 3000 }">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </div>
</template>
