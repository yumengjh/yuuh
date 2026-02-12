<template>
  <article
    ref="rowRef"
    class="doc-reader-row"
    :class="`depth-${safeDepth}`"
    :style="{ '--row-top': `${top}px` }"
  >
    <div class="doc-reader-row-content" v-html="html"></div>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  blockId: string;
  depth: number;
  top: number;
  html: string;
  renderKey: string;
}>();

const emit = defineEmits<{
  measured: [blockId: string, height: number];
}>();

const rowRef = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;

const safeDepth = computed(() => {
  if (!Number.isFinite(props.depth)) return 0;
  return Math.max(0, Math.min(6, Math.floor(props.depth)));
});

const reportSize = () => {
  const height = rowRef.value?.getBoundingClientRect().height;
  if (!height || Number.isNaN(height)) return;
  emit("measured", props.blockId, Math.ceil(height) + 8);
};

onMounted(() => {
  void nextTick(reportSize);
  if (typeof ResizeObserver === "undefined" || !rowRef.value) return;
  observer = new ResizeObserver(() => {
    reportSize();
  });
  observer.observe(rowRef.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});

watch(
  () => [props.renderKey, props.html],
  () => {
    void nextTick(reportSize);
  },
);
</script>
