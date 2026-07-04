<!-- app/pages/index.vue（根路由：依登入狀態導向） -->
<script setup lang="ts">
if (import.meta.client) {
  const auth = useAuthStore()
  // 依角色導向：未登入→登入頁；接待員→接待台；新人→自己的婚禮；管理者→所有婚禮
  if (!auth.isAuthenticated)
    await navigateTo('/login', { replace: true })
  else if (auth.isReceptionist)
    await navigateTo(`/reception?weddingId=${auth.weddingId ?? 'wedding-001'}`, { replace: true })
  else if (auth.isCouple)
    await navigateTo(`/weddings/${auth.weddingId ?? 'wedding-001'}`, { replace: true })
  else
    await navigateTo('/weddings', { replace: true })
}
</script>

<template>
  <div />
</template>
