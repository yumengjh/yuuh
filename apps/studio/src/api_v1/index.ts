export * from "./client";
export * from "./types";

export * from "./auth";
export * from "./workspaces";
export * from "./documents";
export * from "./blocks";
export * from "./tags";
export * from "./favorites";
export * from "./comments";
export * from "./search";
export * from "./activities";
export * from "./assets";
export * from "./security";
export * from "./settings";

import { authApi } from "./auth";
import { workspaceApi } from "./workspaces";
import { documentApi } from "./documents";
import { blockApi } from "./blocks";
import { tagApi } from "./tags";
import { favoriteApi } from "./favorites";
import { commentApi } from "./comments";
import { searchApi } from "./search";
import { activityApi } from "./activities";
import { assetApi } from "./assets";
import { securityApi } from "./security";
import { settingsApi } from "./settings";

export const apiV1 = {
  auth: authApi,
  workspaces: workspaceApi,
  documents: documentApi,
  blocks: blockApi,
  tags: tagApi,
  favorites: favoriteApi,
  comments: commentApi,
  search: searchApi,
  activities: activityApi,
  assets: assetApi,
  security: securityApi,
  settings: settingsApi,
};
