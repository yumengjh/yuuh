<template>
  <div class="min-h-screen bg-#ffffff text-#1f2937" :style="rootStyleVars">
    <main class="mx-auto w-full pb-24px">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  DEFAULT_WORKSPACE_PREFERENCE_SETTINGS,
  useDocsApi,
} from "~/composables/useDocsApi";

const { getWorkspacePreferenceSettings } = useDocsApi();

const { data: workspacePreference } = await useAsyncData(
  "workspace-preference-settings",
  async () => {
    try {
      return await getWorkspacePreferenceSettings();
    } catch {
      return DEFAULT_WORKSPACE_PREFERENCE_SETTINGS;
    }
  },
  {
    default: () => DEFAULT_WORKSPACE_PREFERENCE_SETTINGS,
  },
);

const rootStyleVars = computed(() => {
  const settings = workspacePreference.value || DEFAULT_WORKSPACE_PREFERENCE_SETTINGS;
  return {
    "--doc-reader-content-width": `${settings.reader.contentWidth}px`,
    "--doc-reader-font-size": `${settings.reader.fontSize}px`,
    "--doc-code-font-family": settings.advanced.codeFontFamily,
    "--doc-list-spacing": settings.advanced.compactList ? "0px" : "8px",
  };
});
</script>
