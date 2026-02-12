import { api, unwrap } from "./client";
import type { FavoriteItem, PaginatedResult, PaginationQuery } from "./types";
import type { RequestConfig } from "./client";

export interface AddFavoritePayload {
  docId: string;
}

export const addFavorite = (payload: AddFavoritePayload, config?: RequestConfig) => {
  return unwrap<void>(api.post("/favorites", payload, config));
};

export const listFavorites = (
  query: PaginationQuery = { page: 1, pageSize: 20 },
  config?: RequestConfig
) => {
  return unwrap<PaginatedResult<FavoriteItem>>(api.get("/favorites", { ...query }, config));
};

export const removeFavorite = (docId: string, config?: RequestConfig) => {
  return unwrap<void>(api.delete(`/favorites/${docId}`, config));
};

export const favoriteApi = {
  addFavorite,
  listFavorites,
  removeFavorite,
};
