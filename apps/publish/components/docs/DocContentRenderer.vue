<template>
  <article class="doc-markdown" v-html="html"></article>
</template>

<script setup lang="ts">
defineProps<{
  html: string;
}>();
</script>
