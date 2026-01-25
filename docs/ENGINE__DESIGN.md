# 超大文档知识库系统设计文档

## 目录
- [1. 系统概述](#1-系统概述)
- [2. 核心设计理念](#2-核心设计理念)
- [3. 技术架构](#3-技术架构)
- [4. 数据结构设计](#4-数据结构设计)
- [5. 核心实现](#5-核心实现)
- [6. 性能优化策略](#6-性能优化策略)
- [7. API 设计](#7-api-设计)
- [8. TODO 列表](#8-todo-列表)

---

## 1. 系统概述

### 1.1 项目目标
构建一个支持**超大文档**（10万+ 块）的知识库系统，实现：
- ✅ 流畅的编辑体验（无卡顿）
- ✅ 增量加载与虚拟滚动
- ✅ 实时协作能力
- ✅ 完整的版本控制
- ✅ 灵活的 Mock/真实后端切换

### 1.2 核心挑战
- **性能**：大文档渲染（10万块 → 虚拟化）
- **一致性**：乐观更新 + 冲突解决
- **可扩展性**：支持插件化块类型
- **开发体验**：Mock 模式快速开发

---

## 2. 核心设计理念

### 2.1 虚拟化渲染
```
只渲染可视区域 ±50 块 → 减少 DOM 节点
使用 IntersectionObserver 动态加载
```

### 2.2 增量更新
```
前端本地缓存 → 乐观更新 → 后端同步
冲突检测：版本号 + 时间戳
```

### 2.3 分层架构
```
UI 层 (React/Vue)
    ↓
状态层 (Zustand/Pinia + Immer)
    ↓
引擎层 (Document Engine)
    ↓
API 层 (Adapter: Mock / Real Backend)
    ↓
后端 (NestJS + PostgreSQL)
```

---

## 3. 技术架构

### 3.1 技术栈

#### 前端
```typescript
- React 18 / Vue 3
- TypeScript 5+
- Zustand / Pinia (状态管理)
- Immer (不可变更新)
- TanStack Virtual (虚拟滚动)
- diff-match-patch (文本 diff)
```

#### 后端
```typescript
- NestJS 10+
- PostgreSQL 15+ (JSONB + GIN 索引)
- TypeORM / Prisma
- Redis (缓存 + 锁)
- WebSocket (实时协作)
```

### 3.2 目录结构
```
document-engine/
├── src/
│   ├── core/                 # 核心引擎
│   │   ├── engine.ts         # 主引擎类
│   │   ├── block.ts          # 块操作
│   │   ├── version.ts        # 版本控制
│   │   └── diff.ts           # 差异计算
│   ├── api/                  # API 层
│   │   ├── adapter.ts        # 适配器接口
│   │   ├── mock-adapter.ts   # Mock 实现
│   │   ├── http-adapter.ts   # 真实后端
│   │   └── config.ts         # 配置管理
│   ├── types/                # 类型定义
│   │   ├── block.ts
│   │   ├── document.ts
│   │   └── api.ts
│   ├── utils/                # 工具函数
│   │   ├── id-generator.ts
│   │   ├── virtual-scroller.ts
│   │   └── conflict-resolver.ts
│   └── index.ts              # 导出入口
├── tests/
├── examples/
└── docs/
```

---

## 4. 数据结构设计

### 4.1 块（Block）定义

```typescript
// types/block.ts

export type BlockType = 
  | 'root'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'code'
  | 'quote'
  | 'image'
  | 'table'
  | string; // 支持自定义类型

export interface BlockPayload {
  type: string;
  text?: string;
  level?: number;        // heading 专用
  items?: ListItem[];    // list 专用
  language?: string;     // code 专用
  [key: string]: any;    // 扩展字段
}

export interface Block {
  blockId: string;
  type: BlockType;
  payload: BlockPayload;
  children: Block[];
  
  // 元数据（不参与渲染）
  meta?: {
    version: number;
    updatedAt: number;
    createdAt: number;
    parentId?: string;
    sortKey?: string;    // 排序键（fractional indexing）
  };
}

export interface ListItem {
  text: string;
  checked?: boolean;    // checkbox 专用
  children?: ListItem[];
}
```

### 4.2 文档（Document）定义

```typescript
// types/document.ts

export interface Document {
  docId: string;
  title: string;
  version: number;        // 文档版本
  updatedAt: number;
  createdAt: number;
  
  root: Block;            // 根块（包含所有子块）
  
  // 扁平化索引（快速查找）
  blockIndex: Map<string, Block>;
  
  // 版本历史（可选）
  history?: DocumentVersion[];
}

export interface DocumentVersion {
  version: number;
  timestamp: number;
  patches: BlockPatch[];
  message?: string;
}

export interface BlockPatch {
  blockId: string;
  action: 'create' | 'update' | 'delete' | 'move';
  before?: Partial<Block>;
  after?: Partial<Block>;
}
```

### 4.3 虚拟滚动数据结构

```typescript
// utils/virtual-scroller.ts

export interface VirtualItem {
  blockId: string;
  index: number;         // 在扁平列表中的位置
  offsetTop: number;     // 距离顶部的像素
  height: number;        // 块高度（估算/实际）
  depth: number;         // 嵌套深度
}

export interface VirtualScrollState {
  scrollTop: number;
  viewportHeight: number;
  totalHeight: number;
  overscan: number;      // 缓冲区大小（默认 50）
  
  visibleRange: {
    start: number;
    end: number;
  };
  
  items: VirtualItem[];
}
```

---

## 5. 核心实现

### 5.1 配置管理

```typescript
// api/config.ts

export interface EngineConfig {
  // API 配置
  baseURL: string;
  mode: 'mock' | 'http';
  timeout: number;
  
  // 虚拟滚动配置
  virtualScroll: {
    enabled: boolean;
    overscan: number;
    estimatedItemHeight: number;
  };
  
  // 性能配置
  performance: {
    debounceDelay: number;      // 输入防抖
    batchUpdateDelay: number;   // 批量更新延迟
    maxCacheSize: number;       // 最大缓存块数
  };
  
  // 功能开关
  features: {
    versionControl: boolean;
    collaboration: boolean;
    autoSave: boolean;
  };
}

export const defaultConfig: EngineConfig = {
  baseURL: 'http://localhost:5200/api/v1',
  mode: 'mock',
  timeout: 10000,
  
  virtualScroll: {
    enabled: true,
    overscan: 50,
    estimatedItemHeight: 60,
  },
  
  performance: {
    debounceDelay: 300,
    batchUpdateDelay: 1000,
    maxCacheSize: 10000,
  },
  
  features: {
    versionControl: true,
    collaboration: false,
    autoSave: true,
  },
};

export class ConfigManager {
  private config: EngineConfig;
  
  constructor(userConfig?: Partial<EngineConfig>) {
    this.config = { ...defaultConfig, ...userConfig };
  }
  
  get(key: keyof EngineConfig): any {
    return this.config[key];
  }
  
  set(key: keyof EngineConfig, value: any): void {
    this.config[key] = value;
  }
  
  setBaseURL(url: string): void {
    this.config.baseURL = url;
  }
  
  switchMode(mode: 'mock' | 'http'): void {
    this.config.mode = mode;
  }
  
  getFullConfig(): EngineConfig {
    return { ...this.config };
  }
}
```

### 5.2 API 适配器接口

```typescript
// api/adapter.ts

export interface BlockDTO {
  blockId: string;
  type: BlockType;
  payload: BlockPayload;
  parentId?: string;
  children?: BlockDTO[];
}

export interface DocumentDTO {
  docId: string;
  title: string;
  version: number;
  root: BlockDTO;
  updatedAt: number;
  createdAt: number;
}

export interface APIAdapter {
  // 文档操作
  getDocument(docId: string): Promise<DocumentDTO>;
  updateDocument(docId: string, doc: Partial<DocumentDTO>): Promise<DocumentDTO>;
  createDocument(doc: Omit<DocumentDTO, 'docId' | 'version'>): Promise<DocumentDTO>;
  
  // 块操作
  getBlocks(docId: string, blockIds: string[]): Promise<BlockDTO[]>;
  createBlock(docId: string, block: Omit<BlockDTO, 'blockId'>): Promise<BlockDTO>;
  updateBlock(docId: string, blockId: string, updates: Partial<BlockDTO>): Promise<BlockDTO>;
  deleteBlock(docId: string, blockId: string): Promise<void>;
  moveBlock(docId: string, blockId: string, toParentId: string, afterBlockId?: string): Promise<BlockDTO>;
  
  // 批量操作
  batchUpdate(docId: string, operations: BlockOperation[]): Promise<BatchResult>;
  
  // 版本控制
  getVersions(docId: string, limit?: number): Promise<DocumentVersion[]>;
  revertToVersion(docId: string, version: number): Promise<DocumentDTO>;
}

export interface BlockOperation {
  type: 'create' | 'update' | 'delete' | 'move';
  blockId?: string;
  data?: Partial<BlockDTO>;
}

export interface BatchResult {
  success: boolean;
  operations: Array<{
    type: BlockOperation['type'];
    blockId?: string;
    success: boolean;
    error?: string;
  }>;
}
```

### 5.3 Mock 适配器实现

```typescript
// api/mock-adapter.ts

export class MockAdapter implements APIAdapter {
  private storage: Map<string, DocumentDTO> = new Map();
  private delay: number = 100; // 模拟网络延迟
  
  constructor(initialData?: Record<string, DocumentDTO>) {
    if (initialData) {
      Object.entries(initialData).forEach(([id, doc]) => {
        this.storage.set(id, doc);
      });
    }
  }
  
  private async simulateDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.delay));
  }
  
  async getDocument(docId: string): Promise<DocumentDTO> {
    await this.simulateDelay();
    const doc = this.storage.get(docId);
    if (!doc) throw new Error(`Document ${docId} not found`);
    return JSON.parse(JSON.stringify(doc)); // 深拷贝
  }
  
  async updateDocument(docId: string, updates: Partial<DocumentDTO>): Promise<DocumentDTO> {
    await this.simulateDelay();
    const doc = await this.getDocument(docId);
    const updated = { ...doc, ...updates, version: doc.version + 1, updatedAt: Date.now() };
    this.storage.set(docId, updated);
    return updated;
  }
  
  async createDocument(doc: Omit<DocumentDTO, 'docId' | 'version'>): Promise<DocumentDTO> {
    await this.simulateDelay();
    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const newDoc: DocumentDTO = {
      ...doc,
      docId,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.storage.set(docId, newDoc);
    return newDoc;
  }
  
  async createBlock(docId: string, block: Omit<BlockDTO, 'blockId'>): Promise<BlockDTO> {
    await this.simulateDelay();
    const doc = await this.getDocument(docId);
    
    const blockId = `b_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const newBlock: BlockDTO = { ...block, blockId, children: [] };
    
    // 插入到父块的 children
    const parentId = block.parentId || doc.root.blockId;
    this.insertBlockIntoTree(doc.root, parentId, newBlock);
    
    await this.updateDocument(docId, { root: doc.root });
    return newBlock;
  }
  
  async updateBlock(docId: string, blockId: string, updates: Partial<BlockDTO>): Promise<BlockDTO> {
    await this.simulateDelay();
    const doc = await this.getDocument(docId);
    
    const block = this.findBlockInTree(doc.root, blockId);
    if (!block) throw new Error(`Block ${blockId} not found`);
    
    Object.assign(block, updates);
    await this.updateDocument(docId, { root: doc.root });
    return block;
  }
  
  async deleteBlock(docId: string, blockId: string): Promise<void> {
    await this.simulateDelay();
    const doc = await this.getDocument(docId);
    
    this.removeBlockFromTree(doc.root, blockId);
    await this.updateDocument(docId, { root: doc.root });
  }
  
  async moveBlock(docId: string, blockId: string, toParentId: string, afterBlockId?: string): Promise<BlockDTO> {
    await this.simulateDelay();
    const doc = await this.getDocument(docId);
    
    // 1. 从原位置移除
    const block = this.findBlockInTree(doc.root, blockId);
    if (!block) throw new Error(`Block ${blockId} not found`);
    this.removeBlockFromTree(doc.root, blockId);
    
    // 2. 插入到新位置
    this.insertBlockIntoTree(doc.root, toParentId, block, afterBlockId);
    
    await this.updateDocument(docId, { root: doc.root });
    return block;
  }
  
  async batchUpdate(docId: string, operations: BlockOperation[]): Promise<BatchResult> {
    await this.simulateDelay();
    const results: BatchResult['operations'] = [];
    
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'create':
            await this.createBlock(docId, op.data as any);
            results.push({ type: 'create', success: true });
            break;
          case 'update':
            await this.updateBlock(docId, op.blockId!, op.data!);
            results.push({ type: 'update', blockId: op.blockId, success: true });
            break;
          case 'delete':
            await this.deleteBlock(docId, op.blockId!);
            results.push({ type: 'delete', blockId: op.blockId, success: true });
            break;
          case 'move':
            await this.moveBlock(docId, op.blockId!, op.data!.parentId!, op.data!.afterBlockId);
            results.push({ type: 'move', blockId: op.blockId, success: true });
            break;
        }
      } catch (error: any) {
        results.push({ type: op.type, blockId: op.blockId, success: false, error: error.message });
      }
    }
    
    return { success: true, operations: results };
  }
  
  async getVersions(docId: string, limit?: number): Promise<DocumentVersion[]> {
    await this.simulateDelay();
    // Mock: 返回空数组（实际需实现历史记录）
    return [];
  }
  
  async revertToVersion(docId: string, version: number): Promise<DocumentDTO> {
    await this.simulateDelay();
    throw new Error('Version control not implemented in mock');
  }
  
  async getBlocks(docId: string, blockIds: string[]): Promise<BlockDTO[]> {
    await this.simulateDelay();
    const doc = await this.getDocument(docId);
    const blocks: BlockDTO[] = [];
    
    for (const blockId of blockIds) {
      const block = this.findBlockInTree(doc.root, blockId);
      if (block) blocks.push(block);
    }
    
    return blocks;
  }
  
  // ==================== 辅助方法 ====================
  
  private findBlockInTree(node: BlockDTO, blockId: string): BlockDTO | null {
    if (node.blockId === blockId) return node;
    
    for (const child of node.children || []) {
      const found = this.findBlockInTree(child, blockId);
      if (found) return found;
    }
    
    return null;
  }
  
  private removeBlockFromTree(node: BlockDTO, blockId: string): boolean {
    if (!node.children) return false;
    
    const index = node.children.findIndex(c => c.blockId === blockId);
    if (index >= 0) {
      node.children.splice(index, 1);
      return true;
    }
    
    for (const child of node.children) {
      if (this.removeBlockFromTree(child, blockId)) return true;
    }
    
    return false;
  }
  
  private insertBlockIntoTree(
    node: BlockDTO,
    parentId: string,
    block: BlockDTO,
    afterBlockId?: string
  ): boolean {
    if (node.blockId === parentId) {
      if (!node.children) node.children = [];
      
      if (afterBlockId) {
        const index = node.children.findIndex(c => c.blockId === afterBlockId);
        node.children.splice(index + 1, 0, block);
      } else {
        node.children.push(block);
      }
      
      return true;
    }
    
    for (const child of node.children || []) {
      if (this.insertBlockIntoTree(child, parentId, block, afterBlockId)) return true;
    }
    
    return false;
  }
}
```

### 5.4 HTTP 适配器实现

```typescript
// api/http-adapter.ts

export class HttpAdapter implements APIAdapter {
  private baseURL: string;
  private timeout: number;
  
  constructor(baseURL: string, timeout: number = 10000) {
    this.baseURL = baseURL.replace(/\/$/, ''); // 移除末尾斜杠
    this.timeout = timeout;
  }
  
  private async request<T>(
    method: string,
    path: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const token = this.getAuthToken();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      return result.data || result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }
  
  private getAuthToken(): string | null {
    // 从 localStorage 或其他地方获取 token
    return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  }
  
  async getDocument(docId: string): Promise<DocumentDTO> {
    return this.request<DocumentDTO>('GET', `/documents/${docId}/content`);
  }
  
  async updateDocument(docId: string, updates: Partial<DocumentDTO>): Promise<DocumentDTO> {
    return this.request<DocumentDTO>('PATCH', `/documents/${docId}`, updates);
  }
  
  async createDocument(doc: Omit<DocumentDTO, 'docId' | 'version'>): Promise<DocumentDTO> {
    return this.request<DocumentDTO>('POST', '/documents', doc);
  }
  
  async getBlocks(docId: string, blockIds: string[]): Promise<BlockDTO[]> {
    return this.request<BlockDTO[]>('POST', `/documents/${docId}/blocks/batch-get`, { blockIds });
  }
  
  async createBlock(docId: string, block: Omit<BlockDTO, 'blockId'>): Promise<BlockDTO> {
    return this.request<BlockDTO>('POST', '/blocks', { docId, ...block });
  }
  
  async updateBlock(docId: string, blockId: string, updates: Partial<BlockDTO>): Promise<BlockDTO> {
    return this.request<BlockDTO>('PATCH', `/blocks/${blockId}/content`, { docId, ...updates });
  }
  
  async deleteBlock(docId: string, blockId: string): Promise<void> {
    await this.request<void>('DELETE', `/blocks/${blockId}`, { docId });
  }
  
  async moveBlock(docId: string, blockId: string, toParentId: string, afterBlockId?: string): Promise<BlockDTO> {
    return this.request<BlockDTO>('POST', `/blocks/${blockId}/move`, {
      docId,
      parentId: toParentId,
      afterBlockId,
    });
  }
  
  async batchUpdate(docId: string, operations: BlockOperation[]): Promise<BatchResult> {
    return this.request<BatchResult>('POST', '/blocks/batch', { docId, operations });
  }
  
  async getVersions(docId: string, limit: number = 50): Promise<DocumentVersion[]> {
    return this.request<DocumentVersion[]>('GET', `/documents/${docId}/revisions?limit=${limit}`);
  }
  
  async revertToVersion(docId: string, version: number): Promise<DocumentDTO> {
    return this.request<DocumentDTO>('POST', `/documents/${docId}/revert`, { version });
  }
}
```

### 5.5 核心引擎实现

```typescript
// core/engine.ts

import { produce } from 'immer';

export class DocumentEngine {
  private config: ConfigManager;
  private adapter: APIAdapter;
  private cache: Map<string, Document> = new Map();
  private pendingUpdates: Map<string, BlockOperation[]> = new Map();
  private updateTimer: NodeJS.Timeout | null = null;
  
  constructor(config?: Partial<EngineConfig>) {
    this.config = new ConfigManager(config);
    this.adapter = this.createAdapter();
  }
  
  private createAdapter(): APIAdapter {
    const mode = this.config.get('mode');
    const baseURL = this.config.get('baseURL');
    const timeout = this.config.get('timeout');
    
    if (mode === 'mock') {
      return new MockAdapter();
    } else {
      return new HttpAdapter(baseURL, timeout);
    }
  }
  
  // ==================== 配置管理 ====================
  
  setBaseURL(url: string): void {
    this.config.setBaseURL(url);
    this.adapter = this.createAdapter();
  }
  
  switchMode(mode: 'mock' | 'http'): void {
    this.config.switchMode(mode);
    this.adapter = this.createAdapter();
  }
  
  // ==================== 文档操作 ====================
  
  async loadDocument(docId: string): Promise<Document> {
    // 1. 检查缓存
    if (this.cache.has(docId)) {
      return this.cache.get(docId)!;
    }
    
    // 2. 从后端加载
    const dto = await this.adapter.getDocument(docId);
    const doc = this.dtoToDocument(dto);
    
    // 3. 建立扁平化索引
    doc.blockIndex = this.buildBlockIndex(doc.root);
    
    // 4. 缓存
    this.cache.set(docId, doc);
    
    return doc;
  }
  
  async createDocument(title: string): Promise<Document> {
    const rootBlock: BlockDTO = {
      blockId: 'temp_root',
      type: 'root',
      payload: { type: 'root', text: '', children: [] },
      children: [],
    };
    
    const dto = await this.adapter.createDocument({
      title,
      root: rootBlock,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    });
    
    return this.dtoToDocument(dto);
  }
  
  // ==================== 块操作 ====================
  
  async createBlock(
    docId: string,
    type: BlockType,
    payload: BlockPayload,
    parentId?: string,
    afterBlockId?: string
  ): Promise<Block> {
    const doc = await this.loadDocument(docId);
    
    // 乐观更新
    const tempId = `temp_${Date.now()}`;
    const newBlock: Block = {
      blockId: tempId,
      type,
      payload,
      children: [],
      meta: {
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        parentId,
      },
    };
    
    // 本地插入
    this.insertBlockLocally(doc, newBlock, parentId || doc.root.blockId, afterBlockId);
    
    // 记录待同步操作
    this.queueOperation(docId, {
      type: 'create',
      data: { type, payload, parentId, afterBlockId } as any,
    });
    
    return newBlock;
  }
  
  async updateBlock(docId: string, blockId: string, updates: Partial<BlockPayload>): Promise<void> {
    const doc = await this.loadDocument(docId);
    const block = doc.blockIndex.get(blockId);
    
    if (!block) throw new Error(`Block ${blockId} not found`);
    
    // 乐观更新
    const nextDoc = produce(doc, draft => {
      const draftBlock = draft.blockIndex.get(blockId);
      if (draftBlock) {
        Object.assign(draftBlock.payload, updates);
        if (draftBlock.meta) {
          draftBlock.meta.version++;
          draftBlock.meta.updatedAt = Date.now();
        }
      }
    });
    
    this.cache.set(docId, nextDoc);
    
    // 记录待同步操作
    this.queueOperation(docId, {
      type: 'update',
      blockId,
      data: { payload: updates } as any,
    });
  }
  
  async deleteBlock(docId: string, blockId: string): Promise<void> {
    const doc = await this.loadDocument(docId);
    
    // 乐观删除
    this.removeBlockLocally(doc, blockId);
    
    // 记录待同步操作
    this.queueOperation(docId, {
      type: 'delete',
      blockId,
    });
  }
  
  async moveBlock(docId: string, blockId: string, toParentId: string, afterBlockId?: string): Promise<void> {
    const doc = await this.loadDocument(docId);
    const block = doc.blockIndex.get(blockId);
    
    if (!block) throw new Error(`Block ${blockId} not found`);
    
    // 乐观移动
    this.removeBlockLocally(doc, blockId);
    this.insertBlockLocally(doc, block, toParentId, afterBlockId);
    
    // 记录待同步操作
    this.queueOperation(docId, {
      type: 'move',
      blockId,
      data: { parentId: toParentId, afterBlockId } as any,
    });
  }
  
  // ==================== 批量同步 ====================
  
  private queueOperation(docId: string, operation: BlockOperation): void {
    if (!this.pendingUpdates.has(docId)) {
      this.pendingUpdates.set(docId, []);
    }
    
    this.pendingUpdates.get(docId)!.push(operation);
    
    // 防抖批量提交
    if (this.updateTimer) clearTimeout(this.updateTimer);
    
    const delay = this.config.get('performance').batchUpdateDelay;
    this.updateTimer = setTimeout(() => this.flushUpdates(docId), delay);
  }
  
  private async flushUpdates(docId: string): Promise<void> {
    const operations = this.pendingUpdates.get(docId);
    if (!operations || operations.length === 0) return;
    
    try {
      await this.adapter.batchUpdate(docId, operations);
      this.pendingUpdates.delete(docId);
    } catch (error) {
      console.error('Failed to sync updates:', error);
      // 可实现重试逻辑
    }
  }
  
  async forceSync(docId: string): Promise<void> {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    await this.flushUpdates(docId);
  }
  
  // ==================== 辅助方法 ====================
  
  private dtoToDocument(dto: DocumentDTO): Document {
    const root = this.dtoToBlock(dto.root);
    
    return {
      docId: dto.docId,
      title: dto.title,
      version: dto.version,
      updatedAt: dto.updatedAt,
      createdAt: dto.createdAt,
      root,
      blockIndex: new Map(),
    };
  }
  
  private dtoToBlock(dto: BlockDTO): Block {
    return {
      blockId: dto.blockId,
      type: dto.type,
      payload: dto.payload,
      children: (dto.children || []).map(c => this.dtoToBlock(c)),
      meta: {
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        parentId: dto.parentId,
      },
    };
  }
  
  private buildBlockIndex(block: Block, index: Map<string, Block> = new Map()): Map<string, Block> {
    index.set(block.blockId, block);
    for (const child of block.children) {
      this.buildBlockIndex(child, index);
    }
    return index;
  }
  
  private insertBlockLocally(doc: Document, block: Block, parentId: string, afterBlockId?: string): void {
    const parent = doc.blockIndex.get(parentId);
    if (!parent) throw new Error(`Parent ${parentId} not found`);
    
    if (afterBlockId) {
      const index = parent.children.findIndex(c => c.blockId === afterBlockId);
      parent.children.splice(index + 1, 0, block);
    } else {
      parent.children.push(block);
    }
    
    doc.blockIndex.set(block.blockId, block);
  }
  
  private removeBlockLocally(doc: Document, blockId: string): void {
    const block = doc.blockIndex.get(blockId);
    if (!block) return;
    
    // 从父节点移除
    const parentId = block.meta?.parentId || doc.root.blockId;
    const parent = doc.blockIndex.get(parentId);
    
    if (parent) {
      const index = parent.children.findIndex(c => c.blockId === blockId);
      if (index >= 0) parent.children.splice(index, 1);
    }
    
    // 递归删除子块
    const removeRecursive = (b: Block) => {
      doc.blockIndex.delete(b.blockId);
      b.children.forEach(removeRecursive);
    };
    
    removeRecursive(block);
  }
  
  // ==================== 虚拟滚动支持 ====================
  
  getFlattenedBlocks(docId: string): Block[] {
    const doc = this.cache.get(docId);
    if (!doc) return [];
    
    const result: Block[] = [];
    
    const traverse = (block: Block) => {
      result.push(block);
      block.children.forEach(traverse);
    };
    
    traverse(doc.root);
    return result;
  }
}
```

### 5.6 虚拟滚动工具

```typescript
// utils/virtual-scroller.ts

export class VirtualScroller {
  private state: VirtualScrollState;
  private itemHeights: Map<string, number> = new Map();
  
  constructor(
    private items: Block[],
    private config: {
      viewportHeight: number;
      estimatedItemHeight: number;
      overscan: number;
    }
  ) {
    this.state = {
      scrollTop: 0,
      viewportHeight: config.viewportHeight,
      totalHeight: 0,
      overscan: config.overscan,
      visibleRange: { start: 0, end: 0 },
      items: [],
    };
    
    this.calculateLayout();
  }
  
  updateScrollTop(scrollTop: number): void {
    this.state.scrollTop = scrollTop;
    this.updateVisibleRange();
  }
  
  updateItemHeight(blockId: string, height: number): void {
    this.itemHeights.set(blockId, height);
    this.calculateLayout();
  }
  
  private calculateLayout(): void {
    let offset = 0;
    const virtualItems: VirtualItem[] = [];
    
    for (let i = 0; i < this.items.length; i++) {
      const block = this.items[i];
      const height = this.itemHeights.get(block.blockId) || this.config.estimatedItemHeight;
      
      virtualItems.push({
        blockId: block.blockId,
        index: i,
        offsetTop: offset,
        height,
        depth: this.calculateDepth(block),
      });
      
      offset += height;
    }
    
    this.state.items = virtualItems;
    this.state.totalHeight = offset;
    this.updateVisibleRange();
  }
  
  private updateVisibleRange(): void {
    const { scrollTop, viewportHeight, overscan, items } = this.state;
    
    let start = 0;
    let end = items.length - 1;
    
    // 二分查找起始索引
    for (let i = 0; i < items.length; i++) {
      if (items[i].offsetTop >= scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
    }
    
    // 查找结束索引
    for (let i = start; i < items.length; i++) {
      if (items[i].offsetTop > scrollTop + viewportHeight) {
        end = Math.min(items.length - 1, i + overscan);
        break;
      }
    }
    
    this.state.visibleRange = { start, end };
  }
  
  private calculateDepth(block: Block): number {
    // 简化实现：从 meta 读取或递归计算
    return 0;
  }
  
  getVisibleItems(): VirtualItem[] {
    const { start, end } = this.state.visibleRange;
    return this.state.items.slice(start, end + 1);
  }
  
  getState(): VirtualScrollState {
    return { ...this.state };
  }
}
```

---

## 6. 性能优化策略

### 6.1 虚拟滚动
```typescript
// React 示例
import { useVirtualizer } from '@tanstack/react-virtual';

function DocumentEditor({ docId }: { docId: string }) {
  const engine = useDocumentEngine();
  const blocks = engine.getFlattenedBlocks(docId);
  
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 50,
  });
  
  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <BlockRenderer block={blocks[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6.2 防抖与节流
```typescript
// 输入防抖
import { debounce } from 'lodash-es';

const handleContentChange = debounce((blockId: string, text: string) => {
  engine.updateBlock(docId, blockId, { text });
}, 300);
```

### 6.3 增量加载
```typescript
// 分页加载块
async loadMoreBlocks(docId: string, startIndex: number, count: number) {
  const flatBlocks = this.getFlattenedBlocks(docId);
  const slice = flatBlocks.slice(startIndex, startIndex + count);
  
  // 只加载必要的块详情
  const blockIds = slice.map(b => b.blockId);
  return this.adapter.getBlocks(docId, blockIds);
}
```

### 6.4 缓存策略
```typescript
// LRU 缓存
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  
  constructor(private maxSize: number) {}
  
  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value); // 移到最后
    return value;
  }
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }
}
```

---

## 7. API 设计

### 7.1 后端接口规范

#### 获取文档内容（支持分页）
```http
GET /api/v1/documents/:docId/content?startBlockId=xxx&limit=1000&maxDepth=5
```

响应：
```json
{
  "success": true,
  "data": {
    "docId": "doc_xxx",
    "title": "示例文档",
    "version": 5,
    "root": {
      "blockId": "b_root",
      "type": "root",
      "payload": {},
      "children": [...]
    },
    "pagination": {
      "totalBlocks": 100000,
      "returnedBlocks": 1000,
      "hasMore": true,
      "nextStartBlockId": "b_xxx"
    }
  }
}
```

#### 批量块操作
```http
POST /api/v1/blocks/batch
```

请求：
```json
{
  "docId": "doc_xxx",
  "operations": [
    {
      "type": "create",
      "data": {
        "type": "paragraph",
        "payload": { "text": "新段落" },
        "parentId": "b_parent"
      }
    },
    {
      "type": "update",
      "blockId": "b_123",
      "data": {
        "payload": { "text": "更新后的内容" }
      }
    },
    {
      "type": "delete",
      "blockId": "b_456"
    }
  ]
}
```

响应：
```json
{
  "success": true,
  "data": {
    "operations": [
      { "type": "create", "success": true, "blockId": "b_new_xxx" },
      { "type": "update", "blockId": "b_123", "success": true },
      { "type": "delete", "blockId": "b_456", "success": true }
    ]
  }
}
```

---

## 8. TODO 列表

### Phase 1: 核心功能 ✅ (Week 1-2)
- [x] 配置管理系统
- [x] Mock Adapter 实现
- [x] HTTP Adapter 实现
- [x] 文档引擎核心逻辑
- [x] 块操作（CRUD）
- [x] 批量更新机制
- [x] 虚拟滚动工具

### Phase 2: 性能优化 🔄 (Week 3-4)
- [ ] 实现 LRU 缓存
- [ ] 优化虚拟滚动性能
- [ ] 防抖/节流优化
- [ ] 增量加载优化
- [ ] 内存泄漏检测与修复
- [ ] 性能基准测试（10万块）

### Phase 3: 版本控制 📅 (Week 5)
- [ ] 版本历史记录
- [ ] 差异计算优化
- [ ] 版本回滚功能
- [ ] 冲突检测与解决
- [ ] 快照机制

### Phase 4: 协作功能 📅 (Week 6-7)
- [ ] WebSocket 集成
- [ ] OT/CRDT 算法实现
- [ ] 多人光标显示
- [ ] 实时同步机制
- [ ] 冲突自动合并

### Phase 5: UI 集成 📅 (Week 8)
- [ ] React 组件库
- [ ] Vue 组件库
- [ ] 富文本编辑器集成
- [ ] 拖拽排序功能
- [ ] 快捷键系统

### Phase 6: 测试与文档 📅 (Week 9-10)
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试
- [ ] E2E 测试
- [ ] API 文档（Swagger）
- [ ] 使用示例与教程
- [ ] 性能优化指南

### Phase 7: 生产部署 📅 (Week 11-12)
- [ ] Docker 镜像构建
- [ ] CI/CD 配置
- [ ] 监控与日志
- [ ] 错误追踪（Sentry）
- [ ] 数据库迁移脚本
- [ ] 备份恢复方案

### Backlog (未来功能)
- [ ] 插件系统
- [ ] 自定义块类型
- [ ] AI 辅助编辑
- [ ] 导入/导出（Markdown, Word, PDF）
- [ ] 移动端适配
- [ ] 离线模式
- [ ] 端到端加密

---

## 附录

### A. 示例代码

```typescript
// main.ts - 快速开始

import { DocumentEngine } from './core/engine';

// 1. 初始化引擎（Mock 模式）
const engine = new DocumentEngine({
  mode: 'mock',
  virtualScroll: {
    enabled: true,
    overscan: 50,
  },
});

// 2. 创建文档
const doc = await engine.createDocument('我的第一个文档');
console.log('Document created:', doc.docId);

// 3. 添加块
await engine.createBlock(
  doc.docId,
  'heading',
  { text: '欢迎', level: 1 },
  doc.root.blockId
);

await engine.createBlock(
  doc.docId,
  'paragraph',
  { text: '这是一个超大文档测试' },
  doc.root.blockId
);

// 4. 更新块
const blocks = engine.getFlattenedBlocks(doc.docId);
await engine.updateBlock(doc.docId, blocks[1].blockId, { text: '内容已更新' });

// 5. 强制同步到后端
await engine.forceSync(doc.docId);

// 6. 切换到真实后端
engine.setBaseURL('https://api.example.com/v1');
engine.switchMode('http');
```

### B. 后端数据库 Schema

```sql
-- PostgreSQL Schema

CREATE TABLE documents (
  doc_id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(64) NOT NULL,
  workspace_id VARCHAR(64),
  status VARCHAR(20) DEFAULT 'draft',
  visibility VARCHAR(20) DEFAULT 'private'
);

CREATE TABLE blocks (
  block_id VARCHAR(64) PRIMARY KEY,
  doc_id VARCHAR(64) NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  parent_id VARCHAR(64),
  sort_key VARCHAR(255),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_blocks_doc_parent ON blocks(doc_id, parent_id);
CREATE INDEX idx_blocks_payload_gin ON blocks USING GIN(payload);

CREATE TABLE document_versions (
  id SERIAL PRIMARY KEY,
  doc_id VARCHAR(64) NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  patches JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(64) NOT NULL,
  message TEXT,
  UNIQUE(doc_id, version)
);
```

---

**文档版本**: v1.0.0  
**最后更新**: 2024-01-17  
**维护者**: Claude Code Team