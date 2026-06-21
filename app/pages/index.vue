<!-- app/pages/index.vue（根路由：依登入狀態導向） -->
<script setup lang="ts">
if (import.meta.client) {
  const auth = useAuthStore()
  await navigateTo(auth.isAuthenticated ? '/weddings' : '/login', { replace: true })
}
</script>

<template>
  <div />
</template>
