import { createError, getMethod, getQuery, readBody, setResponseStatus } from "h3";
import type { FetchError } from "ofetch";
import { joinURL } from "ufo";

const canContainBody = (method: string): boolean => {
  const normalized = method.toUpperCase();
  return normalized !== "GET" && normalized !== "HEAD";
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (!config.docsApiBaseUrl) {
    throw createError({ statusCode: 500, statusMessage: "缺少 DOCS_API_BASE_URL 配置" });
  }
  if (!config.docsApiToken) {
    throw createError({ statusCode: 500, statusMessage: "缺少 DOCS_API_TOKEN 配置" });
  }
  const pathParam = event.context.params?.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : pathParam || "";
  const targetUrl = joinURL(config.docsApiBaseUrl, "api/v1", path);
  const method = getMethod(event);
  const query = getQuery(event);
  const body = canContainBody(method) ? await readBody(event) : undefined;

  try {
    const response = await $fetch.raw(targetUrl, {
      method,
      query,
      body,
      headers: {
        Authorization: `Bearer ${config.docsApiToken}`,
      },
    });
    setResponseStatus(event, response.status, response.statusText);
    return response._data;
  } catch (error) {
    const fetchError = error as FetchError;
    const statusCode = fetchError?.response?.status || 500;
    const statusMessage = fetchError?.response?.statusText || "Proxy Request Failed";
    throw createError({
      statusCode,
      statusMessage,
      data: fetchError?.response?._data || {
        message: fetchError?.message || "请求失败",
      },
    });
  }
});
