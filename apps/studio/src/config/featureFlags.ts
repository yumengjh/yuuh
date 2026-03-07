const parseBooleanFlag = (value: string | undefined, fallback = false): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

export const featureFlags = {
  enableApiTest: parseBooleanFlag(import.meta.env.VITE_STUDIO_ENABLE_API_TEST, false),
} as const;
