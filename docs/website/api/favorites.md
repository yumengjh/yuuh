# 收藏 API

收藏模块提供文档收藏功能。

## 接口列表

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/favorites` | 添加收藏 | 是 |
| GET | `/favorites` | 收藏列表 | 是 |
| DELETE | `/favorites/:docId` | 取消收藏 | 是 |

## 添加收藏

**接口：** `POST /api/v1/favorites`

**说明：** 收藏文档

**请求头：**
```
Authorization: Bearer <your-access-token>
Content-Type: application/json
```

**请求体：**
```json
{
  "docId": "doc_1705123456789_xyz456"
}
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `docId` | string | ✅ | 文档ID |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "favoriteId": "fav_1705123456789_abc123",
    "userId": "u_1705123456789_abc123",
    "docId": "doc_1705123456789_xyz456",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**说明：**
- 同一用户同一文档不可重复收藏
- 收藏时会自动增加文档的 `favoriteCount`

**状态码：**
- `201 Created` - 收藏成功
- `400 Bad Request` - 请求参数错误
- `403 Forbidden` - 没有权限访问文档
- `404 Not Found` - 文档不存在
- `409 Conflict` - 已经收藏过

## 获取收藏列表

**接口：** `GET /api/v1/favorites`

**说明：** 获取当前用户的收藏列表

**请求头：**
```
Authorization: Bearer <your-access-token>
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | number | ❌ | 页码，默认 1 |
| `pageSize` | number | ❌ | 每页数量，默认 20 |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "favoriteId": "fav_1705123456789_abc123",
        "docId": "doc_1705123456789_xyz456",
        "document": {
          "docId": "doc_1705123456789_xyz456",
          "title": "我的第一篇文档",
          "icon": "📄",
          "status": "normal",
          "updatedAt": "2024-01-15T10:30:00.000Z"
        },
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

**说明：**
- 返回的收藏项包含关联的文档信息
- 已删除的文档会被自动过滤

**状态码：**
- `200 OK` - 获取成功

## 取消收藏

**接口：** `DELETE /api/v1/favorites/:docId`

**说明：** 取消收藏文档

**请求头：**
```
Authorization: Bearer <your-access-token>
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `docId` | string | 文档ID |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "message": "已取消收藏"
  }
}
```

**说明：**
- 取消收藏时会自动减少文档的 `favoriteCount`

**状态码：**
- `200 OK` - 取消收藏成功
- `404 Not Found` - 收藏不存在

## 代码示例

### JavaScript / TypeScript

```typescript
// 添加收藏
async function addFavorite(docId: string) {
  const response = await fetch('http://localhost:5200/api/v1/favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ docId }),
  });
  return await response.json();
}

// 获取收藏列表
async function getFavorites() {
  const response = await fetch(
    'http://localhost:5200/api/v1/favorites?page=1&pageSize=20',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  return await response.json();
}

// 取消收藏
async function removeFavorite(docId: string) {
  const response = await fetch(
    `http://localhost:5200/api/v1/favorites/${docId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  return await response.json();
}
```

