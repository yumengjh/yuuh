# InfiniteDoc

InfiniteDoc 是一个面向**超大文档场景**的文档系统。  
立意是「**无限文档**」——文档长度不设限，支持超大规模内容的编辑、管理与发布展示。

## 项目定位

- **@infinitedoc/studio**：文档创作与管理端（React + Vite）
- **@infinitedoc/publish**：已发布文档展示端（Nuxt）

> 当前仓库已采用 pnpm workspaces 管理，后续会逐步抽离共享模块到 `packages/`。

## 仓库结构

```text
.
├─ apps/
│  ├─ studio/       # @infinitedoc/studio
│  └─ publish/      # @infinitedoc/publish（Nuxt 展示端）
├─ packages/        # 共享模块预留（types/api/utils 等）
├─ docs/
├─ package.json
└─ pnpm-workspace.yaml
```

## 快速开始（根目录）

```bash
pnpm install

# 默认启动 Studio
pnpm dev

# 分别启动
pnpm dev:studio
pnpm dev:publish

# 同时启动两个子项目
pnpm dev:all

# 若你使用 npm，也可直接执行
npm run dev:studio
```

## 构建与检查

```bash
# 全量
pnpm build
pnpm lint

# 分项目
pnpm build:studio
pnpm build:publish

pnpm --filter @infinitedoc/studio build
pnpm --filter @infinitedoc/publish build
```

## 下一步

- 按优先级逐步抽离共享模块（`types` → `api-client` → `utils`）
- 保持 studio / publish 独立构建、独立发布
