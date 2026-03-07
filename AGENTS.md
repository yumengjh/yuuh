# AGENTS 指南

- 目的：为在本仓库中运行的智能代理提供可落地的开发、构建、风格与质量规范。
- 适用范围：`F:/react-demo/app` 仓库的所有自动化或交互式代理（含本助手）。
- 当前日期参考：2026-01-31；请尊重仓库实际配置和脚本。
- 语言约定：文档与交流均使用中文；代码内保持现有双引号与英文标识。
- 当前无 Cursor/Copilot 额外规则文件（`.cursor/rules/`、`.cursorrules`、`.github/copilot-instructions.md` 均不存在）。

## Monorepo 迁移说明（2026-02-12）

- 仓库已改造为 `pnpm workspaces` monorepo。
- 应用目录：
  - `apps/studio`：主 React 应用（包名 `@infinitedoc/studio`）
  - `apps/publish`：文档站 Nuxt 应用（包名 `@infinitedoc/publish`）
  - `apps/server`：Nest 后端 API 服务（包名 `@infinitedoc/server`）
- 根目录命令应优先使用 workspace 脚本（如 `pnpm dev:studio`、`pnpm dev:publish`、`pnpm build`、`pnpm lint`）。
- 本文档中涉及原 `src/`、`public/`、`vite.config.ts` 等主应用路径时，默认对应 `apps/studio/` 下同名路径。

## 环境与包管理

- Node.js：README 建议 >= 18，依赖列表适配 18+；优先使用最新版 LTS。
- 包管理器：使用 `pnpm`（锁文件为 `pnpm-lock.yaml`）；不要混用 npm/yarn。
- 模块体系：ESM-only（`"type": "module"`，`moduleResolution: bundler`）。
- 路径风格：相对路径为主；允许在导入中带 `.ts/.tsx` 扩展（`allowImportingTsExtensions: true`）。
- 构建工具：Vite（rolldown-vite 7.2.5 包装）+ TypeScript `tsc -b` 预检查。
- 浏览器 API：`globals.browser` 已注入 eslint；前端可直接用 DOM API。

## 安装与启动

- 安装依赖：`pnpm install`。
- 主应用开发：`pnpm dev:studio`（等价 `pnpm dev`，Vite 默认 5173 端口）。
- 文档站开发：`pnpm dev:publish`（Nuxt 默认配置，当前脚本端口 4300）。
- 后端开发：`pnpm dev:server`（Nest watch 模式，默认 5200 端口）。
- 同时开发：`pnpm dev:all`。
- 预览主应用：`pnpm preview:studio`（基于 `apps/studio/dist`，端口 3000）。
- 构建：`pnpm build`（构建 server/studio/publish）；也可使用 `pnpm build:server` / `pnpm build:studio` / `pnpm build:publish`。
- 主应用运行前确保环境变量 `VITE_API_BASE_URL` 设置，未设默认 `http://localhost:5200`。

## Lint 与格式

- Lint 命令：`pnpm lint`（根目录统一执行），可选 `pnpm lint:studio` / `pnpm lint:publish` / `pnpm lint:server` / `pnpm lint:strict`（零 warning）。
- 格式化命令：`pnpm format`（写入）/ `pnpm format:check`（本地缓存检查）/ `pnpm format:check:ci`（CI 无缓存检查）。
- 拼写检查命令：`pnpm spellcheck`（本地缓存检查）/ `pnpm spellcheck:ci`（CI 无缓存检查）。
- 扩展：`@eslint/js` recommended、`typescript-eslint` recommended、`react-hooks` recommended、`react-refresh` vite preset。
- ESLint 配置统一位于根目录 `eslint.config.mjs`（Flat Config，monorepo 统一规则）。
- Prettier 配置统一位于根目录（`.prettierrc.json` + `.prettierignore`，含 server override），子应用不再维护重复配置。
- CSpell 配置统一位于根目录（`.cspell.json` + `.cspell/project-words.txt`）。
- 语法目标：ES2020+，React JSX（`react-jsx`）。
- 若新增文件，确保符合规则后再提交；尽量零 eslint 警告。

## 测试策略

- 当前仓库未配置测试脚本或测试依赖（`package.json` 无 `test`，无 `*.test.*` 文件）。
- 若需单元测试，推荐引入 Vitest + React Testing Library；添加后可使用：
  - 全量：`pnpm vitest run`。
  - 单测文件：`pnpm vitest run src/foo/bar.test.tsx`。
  - 单个用例：`pnpm vitest run src/foo/bar.test.tsx --filter "should xxx"`。
- 在正式添加测试前，请勿虚构测试命令；如需验证逻辑，可使用临时脚本或 Storybook 风格的手动页面。

## 目录速览

- `src/main.tsx`：入口，挂载 React、Router，保留 `StrictMode` 注释。
- `src/App.tsx`：应用骨架，包含 Sidebar/Header/Toolbar/Footer，基于路由与登录状态切换布局。
- `src/routes`：路由定义与守卫（`RequireAuth`）。
- `src/context`：React Context（数据、文档、编辑状态）。
- `src/api`：axios 客户端、认证与错误归一化工具；`tokenManager` 管理 Access/Refresh Token。
- `src/editor` / `src/component` / `src/engine`：编辑器、通用组件与文档引擎实现。
- `public/`：静态资源；`index.html` 为 Vite 模板。

## 构建与发布注意

- `pnpm build` 前确保类型通过；`tsc -b` 依赖 `tsconfig.json` 引用 app/node 子配置。
- 构建自动执行 gzipper；如需跳过压缩请修改脚本后说明原因。
- 生产预览使用 `pnpm preview`，不要直接用 `vite preview` 以避免脚本偏差。
- 若需 CI，请复用上述命令；避免引入与本地不一致的构建流程。

## TypeScript 约定

- `strict: true`，保持类型完备；不要依赖 `any`，必要时使用 `unknown` + 类型守卫。
- `noUnusedLocals/Parameters` 在 app 配置为 false，但仍应手动移除未用符号；node 配置为 true，配置文件需无冗余。
- `verbatimModuleSyntax: true`：请在纯类型导入时使用 `import type`，避免值/类型混用被裁剪。
- `moduleDetection: force`：所有文件需显式使用 ESM 导入导出；避免脚本式全局变量。
- JSX 工厂为 `react-jsx`，组件文件使用 `.tsx`。
- 环境类型：前端文件自动包含 `vite/client`，Node 脚本包含 `node` 类型。

## 导入与代码组织

- 导入顺序建议：第三方包 → 绝对/别名（无别名时省略）→ 相对路径 → 样式文件。
- 保持双引号，末尾分号与尾随逗号按照现有格式（存在逗号时保持）。
- 相对路径尽量简短；无路径别名时不要虚构 `@/` 前缀。
- 侧效应导入需有注释说明目的（受 `noUncheckedSideEffectImports` 影响）。
- 按需拆分懒加载：使用 `lazy + Suspense`，提供明显的 fallback。

## React 组件约定

- 使用函数组件与 Hooks；避免类组件。
- 状态管理优先 React Hooks 与 Context；全局状态可用 `zustand`，保持 store 模块化。
- 组件命名 PascalCase；hook 命名 `useXxx`。
- Props 使用显式类型/接口；必要时提供默认值或可选链防御。
- 避免在 render 中声明未 memo 的大对象/函数，必要时使用 `useMemo`/`useCallback`。
- 路由组件如需鉴权，包裹于 `RequireAuth`；登录页例外。

## 样式与资源

- 全局样式入口 `src/index.css`、组件级样式 `App.css` 等，保持样式导入置于文件顶部附近。
- 保持响应式设计，与 README 描述一致；新增样式时避免污染全局命名，优先 BEM/模块化命名惯例。
- 静态资源放入 `public/`；构建时会按 Vite 规则处理。

## API 与错误处理

- 统一使用 `src/api/client.ts` 提供的 `api`/`apiClient`/`unwrap`，不要重复创建 axios 实例。
- 鉴权：`tokenManager` 读写 localStorage；401 会自动尝试刷新 Token，失败则清理 Token 并跳转 `/login`。
- 自定义请求可通过 `config.skipAuth` 跳过鉴权头；重放逻辑依赖 `_retry` 标记，请勿手动覆盖。
- 错误归一化：捕获异常后抛出 `NormalizedApiError`，包含 `status/code/message/raw`；UI 层应使用友好提示。
- 上传使用 `api.upload` 生成 `FormData`；附加字段通过 `additionalData`。

## 数据与存储

- 内存存储默认实现 `InMemoryStorage`；若接入后端，请保持接口兼容并补充持久化实现。
- 文档引擎与版本差异依赖 `diff-match-patch`、自定义 `DocumentEngine`；修改时确保历史与对比功能仍可用。

## 路由与导航

- 使用 React Router v7（`Routes/Route` 组件）；路由表在 `src/routes/index.tsx`。
- 新增路由需同时更新侧边栏 `sidebarItems` 以便导航。
- 登录状态通过 `tokenManager.isAuthenticated()` 判断；未登录访问受保护路由应被重定向。

## 国际化与文案

- 当前文案多为中文；新增文案保持中文优先，必要时提供英文补充但勿混杂语言风格。
- 字符编码保持 ASCII/UTF-8；避免引入全角空格等不可见字符。

## 日志与调试

- 浏览器端调试使用标准 `console.*`；提交前移除临时调试日志。
- 网络请求失败使用归一化错误信息；必要时在 UI 提示中展示 `code` 便于排障。

## 性能与可用性

- 长列表优先使用 `react-window` 等虚拟滚动方案（已依赖）。
- 组件内避免不必要的重渲染；条件渲染时尽量减少布局抖动，使用占位/骨架屏。
- 懒加载路由或重组件，提供显式 loading 态（参考 `App.tsx` 中的 Suspense fallback）。

## Git 与提交

- 避免提交 `dist/`、本地调试产物或环境密钥；遵循 `.gitignore`。
- 未经要求不要强制改动用户已有的未提交变更。
- 若添加新脚本或配置，请在此文档与 README 补充说明。

## 安全与凭据

- Token 存储在 localStorage；处理刷新失败需清理并跳转登录。
- 不要把密钥、私有 URL、密码写入仓库；使用 `.env`（未纳入仓库）管理。
- 上传接口需限制文件类型/大小时，请在请求前校验并在 UI 给出反馈。

## 代码示例惯例

- 类型导入：`import type { ApiResponse } from "./types";`
- 值导入：`import { api, unwrap } from "./api";`
- 组件：

```tsx
import { useEffect } from "react";
import { api, unwrap } from "../api";

export function Example() {
  useEffect(() => {
    unwrap(api.get("/ping")).then(console.log).catch(console.error);
  }, []);
  return <div className="example">Hello</div>;
}
```

## 新功能落地流程建议

- 先在 `src` 下确定模块位置，遵循现有目录划分（component/editor/engine/pages/routes/context）。
- 定义类型与接口，补充 API 调用时使用 `unwrap` 处理错误。
- 添加 UI 时复用现有组件风格（Ant Design 6）并保持响应式布局。
- 如需全局状态，评估是否放入 Context 或 Zustand，避免过度提升状态。
- 更新文档：README/AGENTS 若新增命令或重要流程。

## 已知缺失与后续补充点

- 无正式测试体系；新增测试时请在 `package.json` 添加脚本并更新本文件命令示例。
- 已统一接入 Prettier；如需升级规则，请优先调整根目录 Prettier 配置并评估全仓库影响。
- 未设 CI/CD；如需落地，请沿用 `pnpm install && pnpm lint && pnpm build`。

## 快速检查清单（提交前）

- 依赖是否通过 `pnpm install`、构建是否通过 `pnpm build`。
- Lint 是否通过 `pnpm lint`，无新增警告。
- 新增路由是否受守卫控制、导航可达。
- API 调用是否使用 `api`/`unwrap`，错误是否友好显示。
- 样式是否符合响应式，未污染全局作用域。
- 文档（README/AGENTS）是否同步更新。

## 联系与协作

- 若规则与实际代码冲突，以代码与 lint 配置为准，并在更新后修订本文件。
- 发现缺口或需要新增流程，请直接补充本文件并在 PR 说明理由。

## 完成任务后执行命令进行检查：

pnpm lint:<任务模块>

pnpm --filter @infinitedoc/<任务模块> exec tsc -p tsconfig.json --noEmit

- 主要是进行类型检查和语法验证，确保代码质量和一致性，可以按需调整。


## 文件访问与作用域规则（重要）

除非我明确要求，否则**不要打开、读取、搜索或总结任何大型自动生成文件或依赖产物**，尤其包括：

- pnpm-lock.yaml / package-lock.json / yarn.lock
- node_modules/**
- dist/** / build/** / .next/** / out/**
- coverage/** / .turbo/** / .cache/** / .pnpm-store/**
- *.min.js / *.map
- 自动生成的 snapshot 文件
- 体积很大的 JSON / 日志文件

### 默认行为

- 将 lockfile 与构建产物视为“自动生成文件”，不是源码的权威来源。
- 优先阅读：
  - package.json
  - pnpm-workspace.yaml
  - tsconfig*.json
  - vite.config.*
  - next.config.*
  - 以及 src/** 下的源码文件

### 关于依赖与版本问题

如果需要查看依赖或版本信息：

1. 先读取 package.json
2. 结合报错日志与配置文件分析
3. 只有在以下情况才允许查看 lockfile：
   - 我明确要求
   - 出现 CI / 安装失败 / 依赖解析冲突，且无法通过 package.json 判断

### 强制约束

在没有明确授权的情况下：

- 不要加载整个 lockfile
- 不要将其纳入上下文
- 不要对其做全文件扫描
- 不要因为“可能有关”而主动阅读

如果确实必须引用，仅允许做**精确关键词检索**，禁止读取完整文件。

## 编码风格与 API 新鲜度规则（重要）

### 1) 禁止过度兼容 / 过度封装
除非我明确要求支持旧环境/旧浏览器/旧版本依赖，否则：
- 不要引入“兼容层 / polyfill / adapter / wrapper”来包装标准库或框架能力
- 不要为了“可能以后扩展”提前抽象（YAGNI）
- 优先用**最直接、最短、可读性最强**的实现
- 如果你觉得需要封装：先解释“为什么必须封装”，并给出“无需封装的更简单版本”对比

### 2) 禁止使用已废弃 API（强制）
在使用任何第三方库/框架 API（React/Next/Node/工具库/组件库等）前：
- 必须通过 Context7 MCP 查证该 API 在当前主流版本是否仍推荐使用
- 若 API 已废弃/不推荐：必须换成官方推荐的新 API
- 不要凭记忆猜版本/接口；不确定就查 Context7

### 3) 版本与约束优先级
- 以项目现有依赖版本（package.json）为准
- 以 Context7 查到的**最新官方文档/迁移指南**为准
- 如果文档与项目版本不一致：明确说明冲突点，并给出“按当前版本可用的最佳实践”

### 4) 输出要求（每次改动都遵守）
- 尽量减少新增文件与新增抽象层
- 避免“为了兼容而兼容”的冗长写法
- 每个新增 util/wrapper 都要说明：用途、替代方案、为何必要
- 若涉及 API 选择：在 PR/说明里标注“查证来源：Context7”
