<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NuxtLoadingIndicator
        color="linear-gradient(90deg, #06b6d4 0%, #10b981 55%, #34d399 100%)"
        error-color="#ef4444"
        :height="2"
        :throttle="0"
        :duration="260"
      />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider, type GlobalThemeOverrides } from "naive-ui";

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#2563eb",
    primaryColorHover: "#3b82f6",
    primaryColorPressed: "#1d4ed8",
    primaryColorSuppl: "#2563eb",
    infoColor: "#2563eb",
    infoColorHover: "#3b82f6",
    infoColorPressed: "#1d4ed8",
    infoColorSuppl: "#2563eb",
  },
};
</script>
