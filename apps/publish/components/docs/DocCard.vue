<template>
  <NuxtLink :to="`/doc/${doc.docId}`" class="block no-underline text-inherit">
    <NCard hoverable class="h-full border border-#ebeef5!">
      <template #header>
        <div class="flex items-center gap-8px">
          <span class="text-lg leading-none">{{ doc.icon || "📄" }}</span>
          <span class="line-clamp-1 text-15px font-600 text-#111827">{{
            doc.title || "未命名文档"
          }}</span>
        </div>
      </template>
      <NSpace vertical size="small">
        <div class="text-13px text-#6b7280">文档 ID：{{ doc.docId }}</div>
        <div class="text-13px text-#6b7280">已发布版本：v{{ doc.publishedHead }}</div>
        <div class="text-12px text-#9ca3af">{{ formatTime(doc.updatedAt || doc.createdAt) }}</div>
      </NSpace>
    </NCard>
  </NuxtLink>
</template>

<script setup lang="ts">
import { NCard, NSpace } from "naive-ui";
import type { DocumentMeta } from "~/types/api";

defineProps<{
  doc: DocumentMeta;
}>();

const formatTime = (value?: string) => {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};
</script>
