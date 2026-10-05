<!-- app/pages/rundown/[weddingId].vue — 公開當天流程表（免登入，工作人員照表執行）
     帶 ?role= → 角色版（只看自己那份，issue #188）；不帶 → 全部角色總覽 -->
<script setup lang="ts">
definePageMeta({ layout: 'guest' })

const route = useRoute()
const weddingId = computed(() => String(route.params.weddingId))
const roleId = computed(() => {
  const role = route.query.role
  return typeof role === 'string' ? role : ''
})
</script>

<template>
  <div data-testid="public-rundown" class="flex flex-col">
    <PublicRundownRoleSheet v-if="roleId" :wedding-id="weddingId" :role-id="roleId" />
    <PublicRundownOverview v-else :wedding-id="weddingId" />
  </div>
</template>
