export default defineNuxtConfig({
  modules: ["@unocss/nuxt"],
  compatibilityDate: "2026-02-10",
  css: ["~/assets/css/main.css", "~/assets/css/markdown.css"],
  build: {
    transpile: ["naive-ui", "vueuc", "seemly", "@css-render/vue3-ssr"],
  },
  vite: {
    ssr: {
      noExternal: ["naive-ui", "vueuc", "seemly", "@css-render/vue3-ssr"],
    },
  },
  runtimeConfig: {
    docsApiBaseUrl: process.env.DOCS_API_BASE_URL || "http://localhost:5200",
    docsApiToken: process.env.DOCS_API_TOKEN || "",
    public: {
      workspaceId: process.env.NUXT_PUBLIC_WORKSPACE_ID || "",
      showDocDebugMeta:
        process.env.NUXT_PUBLIC_SHOW_DOC_DEBUG_META ?? process.env.NODE_ENV !== "production",
    },
  },
  devtools: {
    enabled: true,
  },
  app: {
    head: {
      title: "文档展示站",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
    },
  },
});
