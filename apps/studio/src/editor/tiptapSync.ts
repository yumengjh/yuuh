import type { NormalizedDocBlock } from "./contentAdapter";

export const DEFAULT_SYNC_CONCURRENCY = 8;
export const MIN_SYNC_CONCURRENCY = 1;
export const MAX_SYNC_CONCURRENCY = 24;
export const TITLE_AUTO_SAVE_DEBOUNCE_MS = 700;
export const AUTO_BLOCK_SYNC_DEBOUNCE_MS = 900;
export const AUTO_BLOCK_SYNC_MAX_WAIT_MS = 8000;
export const AUTO_BLOCK_SYNC_OPERATION_THRESHOLD = 20;

export const normalizeSortKey = (sortKey?: string): number => {
  if (!sortKey) return 0;
  const parsed = Number(sortKey);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const clampSyncConcurrency = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_SYNC_CONCURRENCY;
  return Math.max(MIN_SYNC_CONCURRENCY, Math.min(MAX_SYNC_CONCURRENCY, Math.floor(value)));
};

export const parseSyncConcurrencyEnv = (): "auto" | number => {
  const raw = import.meta.env.VITE_BLOCK_SYNC_CONCURRENCY;
  if (!raw || !raw.trim()) return DEFAULT_SYNC_CONCURRENCY;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "auto") return "auto";
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return DEFAULT_SYNC_CONCURRENCY;
  return clampSyncConcurrency(parsed);
};

export const resolveAutoSyncConcurrency = (docBlockSize: number): number => {
  if (docBlockSize <= 300) return 4;
  if (docBlockSize <= 1000) return 8;
  if (docBlockSize <= 3000) return 12;
  if (docBlockSize <= 8000) return 16;
  return 20;
};

export const resolveSyncConcurrency = (docBlockSize: number): number => {
  const envValue = parseSyncConcurrencyEnv();
  if (envValue === "auto") {
    return clampSyncConcurrency(resolveAutoSyncConcurrency(docBlockSize));
  }
  return clampSyncConcurrency(envValue);
};

export const runWithConcurrency = async <T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = DEFAULT_SYNC_CONCURRENCY,
): Promise<R[]> => {
  if (items.length === 0) return [];

  const maxConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runner = async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: maxConcurrency }, () => runner()));
  return results;
};

export const buildBlockSignature = (
  block: Pick<NormalizedDocBlock, "type" | "text" | "level" | "ordered" | "checked" | "language">,
): string => {
  return JSON.stringify({
    type: block.type,
    text: (block.text || "").trim(),
    level: block.level ?? null,
    ordered: block.ordered ?? null,
    checked: block.checked ?? null,
    language: block.language ?? null,
  });
};

export const buildLcsPairs = (
  remoteSignatures: string[],
  localSignatures: string[],
): Array<{ remoteIndex: number; localIndex: number }> => {
  const m = remoteSignatures.length;
  const n = localSignatures.length;

  if (m === 0 || n === 0) return [];

  if (m * n > 250000) {
    const pairs: Array<{ remoteIndex: number; localIndex: number }> = [];
    let remoteStart = 0;
    let localStart = 0;
    while (
      remoteStart < m &&
      localStart < n &&
      remoteSignatures[remoteStart] === localSignatures[localStart]
    ) {
      pairs.push({ remoteIndex: remoteStart, localIndex: localStart });
      remoteStart += 1;
      localStart += 1;
    }

    let remoteEnd = m - 1;
    let localEnd = n - 1;
    const suffix: Array<{ remoteIndex: number; localIndex: number }> = [];
    while (
      remoteEnd >= remoteStart &&
      localEnd >= localStart &&
      remoteSignatures[remoteEnd] === localSignatures[localEnd]
    ) {
      suffix.push({ remoteIndex: remoteEnd, localIndex: localEnd });
      remoteEnd -= 1;
      localEnd -= 1;
    }

    return [...pairs, ...suffix.reverse()];
  }

  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (remoteSignatures[i - 1] === localSignatures[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const pairs: Array<{ remoteIndex: number; localIndex: number }> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (remoteSignatures[i - 1] === localSignatures[j - 1]) {
      pairs.push({ remoteIndex: i - 1, localIndex: j - 1 });
      i -= 1;
      j -= 1;
      continue;
    }
    if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return pairs.reverse();
};

const formatSortKey = (value: number): string | undefined => {
  if (!Number.isFinite(value)) return undefined;
  return String(Number(value.toFixed(6)));
};

export const calcSortKeyForCreate = (
  localIndex: number,
  placementSortKeys: Array<number | undefined>,
): string | undefined => {
  let prev: number | undefined;
  for (let i = localIndex - 1; i >= 0; i -= 1) {
    const key = placementSortKeys[i];
    if (typeof key === "number" && Number.isFinite(key)) {
      prev = key;
      break;
    }
  }

  let next: number | undefined;
  for (let i = localIndex + 1; i < placementSortKeys.length; i += 1) {
    const key = placementSortKeys[i];
    if (typeof key === "number" && Number.isFinite(key)) {
      next = key;
      break;
    }
  }

  if (typeof prev === "number" && typeof next === "number") {
    if (next - prev <= 0.000001) {
      return formatSortKey(prev + 0.000001);
    }
    return formatSortKey((prev + next) / 2);
  }

  if (typeof prev === "number") {
    return formatSortKey(prev + 1000);
  }

  if (typeof next === "number") {
    return formatSortKey(next / 2);
  }

  return formatSortKey((localIndex + 1) * 1000);
};
