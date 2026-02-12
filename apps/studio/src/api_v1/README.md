# api_v1 使用说明

本目录提供基于 `/api/v1` 的前端请求封装，覆盖认证、工作空间、文档、块、标签、收藏、评论、搜索、活动、资产、安全等模块。统一使用 axios + 自动刷新 Token，自动过滤空值，返回数据通过 `unwrap` 提取业务 `data`。

## 快速上手

```ts
import { apiV1 } from "../api_v1";

async function demo() {
  // 登录
  const loginRes = await apiV1.auth.login({ emailOrUsername: "john", password: "pwd" });
  // token 已自动存入 localStorage，可直接调用受保护接口
  const me = await apiV1.auth.me();

  // 创建工作空间
  const ws = await apiV1.workspaces.createWorkspace({ name: "我的空间" });

  // 创建文档
  const doc = await apiV1.documents.createDocument({ workspaceId: ws.workspaceId, title: "测试文档" });

  // 上传资产
  // file 为 File 对象，例如来自 <input type="file">
  // await apiV1.assets.uploadAsset({ workspaceId: ws.workspaceId, file });
}
```

## 设计要点

- **客户端**：`apiClient` 封装 axios，自动附带 accessToken，401 时尝试 refresh，失败则清理 token 并跳转 `/login`。
- **unwrap**：
  - 优先识别 `{ success, data, error }` 包裹；若 `success === false` 或存在 `error`，抛出规范化错误。
  - 若无包裹但存在 `data` 字段，返回其值；否则直接返回响应体。
- **错误格式**：`NormalizedApiError { status?, code?, message, raw }`。
- **空值过滤**：请求前自动移除 `null`/`undefined`/空字符串/空数组/空对象（含嵌套），减少“垃圾”字段。
- **Token 管理**：`tokenManager` 提供 `get/set/clear/isAuthenticated`，默认使用 localStorage 的 `accessToken`/`refreshToken`。
- **Auth 选择**：
  - 默认所有请求使用鉴权；
  - 登录/注册/刷新可传 `withoutAuth(config)`（已在函数内部处理）。

## 模块 API 摘要

以下仅列函数签名与主要参数，详细字段可参考后端接口文档或源码类型定义 `types.ts`。

### auth

- `register(payload: { username; email; password; displayName? }, config?)`
- `login(payload: { emailOrUsername; password }, config?)`
- `refresh(refreshToken?, config?)` — 默认使用存储的 refreshToken
- `me(config?)`
- `logout(token?, config?)` — 默认取 refreshToken 或 accessToken

### workspaces

- `createWorkspace({ name, description?, icon? }, config?)`
- `listWorkspaces(query?: { page?, pageSize? }, config?)`
- `getWorkspace(workspaceId, config?)`
- `updateWorkspace(workspaceId, { name?, description?, icon? }, config?)`
- `deleteWorkspace(workspaceId, config?)`
- 成员：
  - `inviteMember(workspaceId, { userId?, email?, role }, config?)`
  - `listMembers(workspaceId, query?: { page?, pageSize? }, config?)`
  - `updateMemberRole(workspaceId, userId, { role }, config?)`
  - `removeMember(workspaceId, userId, config?)`

### documents

- `createDocument({ workspaceId, title, icon?, cover?, visibility?, parentId?, tags?, category? }, config?)`
- `listDocuments(query?: ListDocumentsQuery, config?)`
- `searchDocuments({ query, workspaceId?, ... }, config?)`
- `getDocument(docId, config?)`
- `getDocumentContent(docId, query?: { version?, maxDepth?, startBlockId?, limit? }, config?)`
- `updateDocument(docId, { title?, parentId?, tags?, category?, ... }, config?)`
- `publishDocument(docId, config?)`
- `moveDocument(docId, { parentId?, sortOrder? }, config?)`
- `deleteDocument(docId, config?)`
- 版本相关：
  - `getRevisions(docId, query?: { page?, pageSize? }, config?)`
  - `getDiff(docId, { fromVer, toVer }, config?)`
  - `revertDocument(docId, { version }, config?)`
  - `createSnapshot(docId, config?)`
  - `commitDocument(docId, { message? }, config?)`
  - `getPendingVersions(docId, config?)`

### blocks

- `createBlock({ docId, type, payload, parentId?, sortKey?, indent?, collapsed?, createVersion? }, config?)`
- `updateBlockContent(blockId, { payload, plainText?, createVersion? }, config?)`
- `moveBlock(blockId, { parentId, sortKey, indent?, createVersion? }, config?)`
- `deleteBlock(blockId, config?)`
- `getBlockVersions(blockId, query?: { page?, pageSize? }, config?)`
- `batchBlocks({ docId, operations, createVersion? }, config?)`

### tags

- `createTag({ workspaceId, name, color? }, config?)`
- `listTags({ workspaceId, page?, pageSize? }, config?)`
- `getTag(tagId, config?)`
- `getTagUsage(tagId, config?)`
- `updateTag(tagId, { name?, color? }, config?)`
- `deleteTag(tagId, config?)`

### favorites

- `addFavorite({ docId }, config?)`
- `listFavorites(query?: { page?, pageSize? }, config?)`
- `removeFavorite(docId, config?)`

### comments

- `createComment({ docId, content, blockId?, mentions?, parentCommentId? }, config?)`
- `listComments({ docId, blockId?, page?, pageSize? }, config?)`
- `getComment(commentId, config?)`
- `updateComment(commentId, { content }, config?)`
- `deleteComment(commentId, config?)`

### search

- `globalSearch({ query, workspaceId?, type?, page?, pageSize? }, config?)`
- `advancedSearch(payload, config?)` — 支持 tags、日期、排序等

### activities

- `listActivities({ workspaceId, userId?, action?, entityType?, startDate?, endDate?, page?, pageSize? }, config?)`

### assets

- `uploadAsset({ workspaceId, file }, config?)` — `config.additionalData` 可附加字段
- `listAssets({ workspaceId, page?, pageSize? }, config?)`
- `getAssetFile(assetId, config?)` — 返回 `Blob`
- `deleteAsset(assetId, config?)`

### security

- `getSecurityEvents({ eventType?, userId?, ip?, startDate?, endDate?, page?, pageSize? }, config?)`
- `getAuditLogs({ userId?, action?, resourceType?, resourceId?, startDate?, endDate?, page?, pageSize? }, config?)`

## 工具与导出

- `apiV1` 聚合：`auth/workspaces/documents/blocks/tags/favorites/comments/search/activities/assets/security`。
- `tokenManager`：手动注入或清理 Token，可配合测试页的手动输入。
- `withAuth(config)` / `withoutAuth(config)`：显式开启/跳过鉴权头（多数接口已内置）。

## 常见问题

1. **后端返回格式不一致怎么办？**
   - `unwrap` 兼容 `{ success, data }` 包裹和直接 `{ data }` 返回；若未包含 data，将直接返回响应体。

2. **为何请求体里空字符串/空数组被过滤？**
   - 请求前会清理空值，避免向后端提交无效字段。如需保留空值，可在发送前改用字符串占位（例如 "" -> " "）。

3. **401 自动刷新失败的行为？**
   - 清理 Token 并跳转 `/login`，并将错误向上抛出；需要拦截可在调用处 catch。

4. **上传附加字段？**
   - `uploadAsset` 的 `config` 支持 `additionalData`，会一并加入 FormData。

5. **如何局部自定义 axios 配置？**
   - 所有请求函数的 `config` 会透传给 axios（如 headers、timeout），并支持 `skipAuth`。

## 参考

- 后端接口参考：`docs/API_USAGE.md` 及在线文档。
- 全量类型定义：`src/api_v1/types.ts`。
- 默认客户端实现：`src/api_v1/client.ts`。
