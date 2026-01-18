# 标签 API

标签模块提供标签的创建、管理、使用统计等功能。

## 接口列表

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/tags` | 创建标签 | 是 |
| GET | `/tags` | 标签列表 | 是 |
| GET | `/tags/:tagId` | 标签详情 | 是 |
| GET | `/tags/:tagId/usage` | 标签使用统计 | 是 |
| PATCH | `/tags/:tagId` | 更新标签 | 是 |
| DELETE | `/tags/:tagId` | 删除标签 | 是 |

## 创建标签

**接口：** `POST /api/v1/tags`

**说明：** 在工作空间中创建新标签

**请求头：**
```
Authorization: Bearer <your-access-token>
Content-Type: application/json
```

**请求体：**
```json
{
  "workspaceId": "ws_1705123456789_abc123",
  "name": "重要",
  "color": "#ff4d4f"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workspaceId` | string | ✅ | 工作空间ID |
| `name` | string | ✅ | 标签名称，1-50个字符 |
| `color` | string | ❌ | 标签颜色（十六进制），默认随机生成 |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "tagId": "tag_1705123456789_xyz456",
    "workspaceId": "ws_1705123456789_abc123",
    "name": "重要",
    "color": "#ff4d4f",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**状态码：**
- `201 Created` - 创建成功
- `400 Bad Request` - 请求参数错误
- `403 Forbidden` - 没有权限访问工作空间
- `409 Conflict` - 标签名已存在

## 获取标签列表

**接口：** `GET /api/v1/tags`

**说明：** 获取工作空间的标签列表

**请求头：**
```
Authorization: Bearer <your-access-token>
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `workspaceId` | string | ✅ | 工作空间ID |
| `page` | number | ❌ | 页码，默认 1 |
| `pageSize` | number | ❌ | 每页数量，默认 20 |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "tagId": "tag_1705123456789_xyz456",
        "workspaceId": "ws_1705123456789_abc123",
        "name": "重要",
        "color": "#ff4d4f",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

**状态码：**
- `200 OK` - 获取成功
- `400 Bad Request` - 缺少 workspaceId 参数

## 获取标签详情

**接口：** `GET /api/v1/tags/:tagId`

**说明：** 获取标签的详细信息

**请求头：**
```
Authorization: Bearer <your-access-token>
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tagId` | string | 标签ID |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "tagId": "tag_1705123456789_xyz456",
    "workspaceId": "ws_1705123456789_abc123",
    "name": "重要",
    "color": "#ff4d4f",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**状态码：**
- `200 OK` - 获取成功
- `404 Not Found` - 标签不存在
- `403 Forbidden` - 没有权限访问

## 获取标签使用统计

**接口：** `GET /api/v1/tags/:tagId/usage`

**说明：** 获取标签的使用统计信息（使用该标签的文档数量）

**请求头：**
```
Authorization: Bearer <your-access-token>
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tagId` | string | 标签ID |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "tagId": "tag_1705123456789_xyz456",
    "name": "重要",
    "documentCount": 5
  }
}
```

**状态码：**
- `200 OK` - 获取成功
- `404 Not Found` - 标签不存在
- `403 Forbidden` - 没有权限访问

## 更新标签

**接口：** `PATCH /api/v1/tags/:tagId`

**说明：** 更新标签的名称和颜色，更新名称时会同步更新所有使用该标签的文档

**请求头：**
```
Authorization: Bearer <your-access-token>
Content-Type: application/json
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tagId` | string | 标签ID |

**请求体：**
```json
{
  "name": "更新后的标签名",
  "color": "#52c41a"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ❌ | 标签名称，1-50个字符 |
| `color` | string | ❌ | 标签颜色（十六进制） |

**权限要求：** owner、admin 或 editor

**响应示例：**
```json
{
  "success": true,
  "data": {
    "tagId": "tag_1705123456789_xyz456",
    "name": "更新后的标签名",
    "color": "#52c41a",
    ...
  }
}
```

**说明：**
- 更新标签名称时，所有使用该标签的文档的 `tags` 数组中的标签名也会同步更新

**状态码：**
- `200 OK` - 更新成功
- `404 Not Found` - 标签不存在
- `403 Forbidden` - 没有权限
- `409 Conflict` - 新标签名已存在

## 删除标签

**接口：** `DELETE /api/v1/tags/:tagId`

**说明：** 删除标签，并从所有使用该标签的文档中移除

**请求头：**
```
Authorization: Bearer <your-access-token>
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `tagId` | string | 标签ID |

**权限要求：** owner、admin 或 editor

**响应示例：**
```json
{
  "success": true,
  "data": {
    "message": "标签已删除"
  }
}
```

**说明：**
- 删除标签时，所有使用该标签的文档的 `tags` 数组中的标签名会被移除

**状态码：**
- `200 OK` - 删除成功
- `404 Not Found` - 标签不存在
- `403 Forbidden` - 没有权限

## 代码示例

### JavaScript / TypeScript

```typescript
// 创建标签
async function createTag(workspaceId: string) {
  const response = await fetch('http://localhost:5200/api/v1/tags', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      workspaceId,
      name: '重要',
      color: '#ff4d4f',
    }),
  });
  return await response.json();
}

// 获取标签列表
async function getTags(workspaceId: string) {
  const response = await fetch(
    `http://localhost:5200/api/v1/tags?workspaceId=${workspaceId}&page=1&pageSize=20`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  return await response.json();
}

// 更新标签
async function updateTag(tagId: string, name: string, color: string) {
  const response = await fetch(`http://localhost:5200/api/v1/tags/${tagId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ name, color }),
  });
  return await response.json();
}
```

