import { api, apiClient, unwrap } from "./client";
import type { AssetItem, PaginatedResult, PaginationQuery } from "./types";
import type { RequestConfig } from "./client";

export interface UploadAssetPayload {
  workspaceId: string;
  file: File;
}

export const uploadAsset = (
  payload: UploadAssetPayload,
  config?: RequestConfig & { additionalData?: Record<string, string | Blob> }
) => {
  const { file, workspaceId } = payload;
  const additionalData = { workspaceId, ...(config?.additionalData ?? {}) };
  return unwrap<AssetItem>(api.upload("/assets/upload", file, additionalData, config));
};

export const listAssets = (
  query: PaginationQuery & { workspaceId: string },
  config?: RequestConfig
) => {
  return unwrap<PaginatedResult<AssetItem>>(api.get("/assets", { ...query }, config));
};

export const getAssetFile = async (assetId: string, config?: RequestConfig) => {
  const res = await apiClient.get<Blob>(`/assets/${assetId}/file`, {
    responseType: "blob",
    ...config,
  });
  return res.data;
};

export const deleteAsset = (assetId: string, config?: RequestConfig) => {
  return unwrap<void>(api.delete(`/assets/${assetId}`, config));
};

export const assetApi = {
  uploadAsset,
  listAssets,
  getAssetFile,
  deleteAsset,
};
