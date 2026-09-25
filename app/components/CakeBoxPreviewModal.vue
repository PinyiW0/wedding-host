<script setup lang="ts">
import type { CakeBoxTypeListItem } from '~/types/api/cakebox'

const props = defineProps<{ type: CakeBoxTypeListItem | null, types: CakeBoxTypeListItem[] }>()
const open = defineModel<boolean>('open', { default: false })
const contents = computed(() => (props.type?.componentTypeIds ?? [])
  .map(id => props.types.find(t => t.cakeBoxTypeId === id))
  .filter((t): t is CakeBoxTypeListItem => !!t))
</script>

<template>
  <UModal v-model:open="open" :title="type?.name ?? '禮盒內容預覽'" :ui="{ title: 'whitespace-normal break-words', content: 'sm:max-w-2xl' }">
    <template #body>
      <div v-if="type" data-testid="cake-box-preview" class="space-y-5">
        <img v-if="type.imageUrl" :src="type.imageUrl" :alt="type.name" class="max-h-72 w-full rounded object-contain">
        <p class="whitespace-pre-wrap break-words">
          {{ type.description || '尚未填寫款式說明' }}
        </p>
        <p v-if="type.price != null" class="font-medium text-gold-deep">
          單價 NT$ {{ type.price.toLocaleString() }}
        </p>
        <template v-if="contents.length">
          <h4 class="font-semibold">
            組合內容
          </h4>
          <div v-for="part in contents" :key="part.cakeBoxTypeId" class="flex gap-4 border-t border-line pt-4">
            <img v-if="part.imageUrl" :src="part.imageUrl" :alt="part.name" class="size-28 shrink-0 rounded object-contain">
            <div class="min-w-0 space-y-2">
              <h5 class="break-words font-medium">
                {{ part.name }}
              </h5>
              <p class="whitespace-pre-wrap break-words text-ink-500">
                {{ part.description || '尚未填寫款式說明' }}
              </p>
              <p v-if="part.price != null">
                NT$ {{ part.price.toLocaleString() }}
              </p>
            </div>
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
