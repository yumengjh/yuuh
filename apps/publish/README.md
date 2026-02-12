# docs-web

Nuxt 文档展示站（只读）。

## 功能

- 只展示指定工作空间下**已发布**文档（`publishedHead > 0`）
- 列表页 + 详情页
- 详情页固定读取 `version=publishedHead`
- 服务端代理转发 API，并由服务端注入 Bearer Token

## 环境变量

参考 `.env.example`：

- `DOCS_API_BASE_URL`：后端地址（如 `http://localhost:5200`）
- `DOCS_API_TOKEN`：服务端调用 API 使用的 Token
- `NUXT_PUBLIC_WORKSPACE_ID`：固定工作空间 ID（前端可读）

## 本地运行

```bash
pnpm -C apps/docs-web install
pnpm -C apps/docs-web dev
```

## 构建

```bash
pnpm -C apps/docs-web build
pnpm -C apps/docs-web preview
```
