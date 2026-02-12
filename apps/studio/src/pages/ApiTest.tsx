import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Tabs,
  Typography,
  Upload,
  message,
} from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd/es/upload/interface";
import type { RcFile } from "antd/es/upload";
import JsonView from "@uiw/react-json-view";
import { apiV1, tokenManager } from "../api_v1";

type FormValues = Record<string, string>;

const { Paragraph, Text } = Typography;

const toRenderable = (value: unknown) => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  try {
    const seen = new WeakSet();
    const json = JSON.parse(
      JSON.stringify(value, (key, val) => {
        if (typeof val === "object" && val !== null) {
          if (seen.has(val as object)) return "[Circular]";
          seen.add(val as object);
        }
        if (typeof val === "function") return `[Function ${val.name || "anonymous"}]`;
        return val;
      })
    );
    return json;
  } catch {
    return { value: String(value) };
  }
};

const useLog = () => {
  const [entry, setEntry] = useState<{ title: string; data: unknown } | null>(null);
  const append = (label: string, payload: unknown) => {
    const title = `${new Date().toLocaleTimeString()} | ${label}`;
    setEntry({ title, data: toRenderable(payload) });
  };
  return { entry, append };
};

const pickErrorMessage = (error: unknown): string | undefined => {
  const visited = new WeakSet<object>();

  const walk = (val: unknown): string | undefined => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed ? trimmed : undefined;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        const found = walk(item);
        if (found) return found;
      }
      return undefined;
    }
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (visited.has(obj)) return undefined;
      visited.add(obj);

      // 常见字段优先
      const candidates = [obj.message, obj.msg, obj.error, obj.code];
      for (const c of candidates) {
        const found = walk(c);
        if (found) return found;
      }

      for (const v of Object.values(obj)) {
        const found = walk(v);
        if (found) return found;
      }
    }
    return undefined;
  };

  // 直接尝试 error 自身
  const primary = walk(error);
  if (primary) return primary;

  // 针对 axios 包装的响应体
  if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    const raw = errObj.raw as Record<string, unknown> | undefined;
    const respData = (errObj.response as { data?: unknown } | undefined)?.data;
    const rawRespData = (raw?.response as { data?: unknown } | undefined)?.data;
    const secondary = walk(respData) || walk(rawRespData) || walk(raw);
    if (secondary) return secondary;
  }

  return undefined;
};

export default function ApiTestPage() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("auth");
  const { entry, append } = useLog();

  const run = useCallback(async <T,>(key: string, task: () => Promise<T>) => {
    try {
      setLoadingKey(key);
      const res = await task();
      append(key, res);
      message.success(`${key} 成功`);
      return res;
    } catch (error) {
      append(`${key} 失败`, error);
      const errMsg = pickErrorMessage(error);
      message.error(errMsg ? `${key} 失败：${errMsg}` : `${key} 失败`);
      // 同步到控制台便于调试
      console.debug("[api_v1 demo] run error", { key, error });
      return undefined;
    } finally {
      setLoadingKey(null);
    }
  }, [append]);

  const [authForm] = Form.useForm<FormValues>();
  const [workspaceForm] = Form.useForm<FormValues>();
  const [docForm] = Form.useForm<FormValues>();
  const [blockForm] = Form.useForm<FormValues>();
  const [tagForm] = Form.useForm<FormValues>();
  const [favoriteForm] = Form.useForm<FormValues>();
  const [commentForm] = Form.useForm<FormValues>();
  const [searchForm] = Form.useForm<FormValues>();
  const [activityForm] = Form.useForm<FormValues>();
  const [securityForm] = Form.useForm<FormValues>();
  const [assetForm] = Form.useForm<FormValues>();
  const [tokenForm] = Form.useForm<FormValues>();
  const [tokenVersion, setTokenVersion] = useState(0);

  const uploadProps: UploadProps = useMemo(
    () => ({
      multiple: false,
      showUploadList: false,
      beforeUpload: (file: RcFile) => {
        const workspaceId =
          assetForm.getFieldValue("workspaceId") ||
          tagForm.getFieldValue("workspaceId") ||
          workspaceForm.getFieldValue("workspaceId");
        if (!workspaceId) {
          message.warning("请先填写 workspaceId 再上传");
          return false;
        }
        run("uploadAsset", () =>
          apiV1.assets.uploadAsset({
            workspaceId,
            file,
          })
        );
        return false;
      },
    }),
    [run, assetForm, tagForm, workspaceForm]
  );

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={16}>
        <Card
          title="测试 Token 注入"
          size="small"
          style={{ marginBottom: 12 }}
          bordered={false}
        >
          <Form
            form={tokenForm}
            layout="vertical"
            initialValues={{
              accessToken: tokenManager.getAccessToken() || "",
              refreshToken: tokenManager.getRefreshToken() || "",
            }}
          >
            <Row gutter={12}>
              <Col span={24}>
                <Form.Item label="accessToken" name="accessToken">
                  <Input placeholder="手动填写 accessToken" allowClear />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="refreshToken" name="refreshToken">
                  <Input placeholder="可选 refreshToken" allowClear />
                </Form.Item>
              </Col>
            </Row>
            <Space wrap>
              <Button
                onClick={() => {
                  const { accessToken, refreshToken } = tokenForm.getFieldsValue();
                  if (!accessToken) {
                    message.warning("请填写 accessToken");
                    return;
                  }
                  tokenManager.setTokens(accessToken, refreshToken || tokenManager.getRefreshToken() || "");
                  setTokenVersion((v) => v + 1);
                  message.success("已应用 Access Token");
                }}
              >
                应用 Access
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  const { accessToken, refreshToken } = tokenForm.getFieldsValue();
                  if (!accessToken || !refreshToken) {
                    message.warning("请填写 accessToken 与 refreshToken");
                    return;
                  }
                  tokenManager.setTokens(accessToken, refreshToken);
                  setTokenVersion((v) => v + 1);
                  message.success("已应用 Access + Refresh");
                }}
              >
                应用双 Token
              </Button>
              <Button
                danger
                onClick={() => {
                  tokenManager.clearTokens();
                  tokenForm.resetFields();
                  setTokenVersion((v) => v + 1);
                  message.success("已清空 Token");
                }}
              >
                清空 Token
              </Button>
            </Space>
          </Form>
        </Card>
        <Card title="API 功能测试" bordered={false}>
          {loadingKey && (
            <Alert
              style={{ marginBottom: 12 }}
              type="info"
              showIcon
              icon={<LoadingOutlined spin />}
              message={`正在执行：${loadingKey}`}
            />
          )}
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            {
              key: "auth",
              label: "认证",
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                  <Alert
                    type="info"
                    message="登录示例账号前请确认后端存在该用户；未配置时可在此注册。"
                    showIcon
                  />
                  <Form
                    form={authForm}
                    layout="vertical"
                    initialValues={{
                      username: `tester_${Date.now()}`,
                      email: `tester_${Date.now()}@demo.dev`,
                      emailOrUsername: "john@example.com",
                      password: "SecurePass123!",
                      displayName: "Api Tester",
                    }}
                  >
                    <Divider>注册</Divider>
                    <Row gutter={12}>
                      <Col xs={24} md={12}>
                        <Form.Item label="username" name="username" rules={[{ required: true }]}>
                          <Input placeholder="用户名" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="email" name="email" rules={[{ required: true }]}>
                          <Input placeholder="邮箱" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col xs={24} md={12}>
                        <Form.Item label="password" name="password" rules={[{ required: true }]}>
                          <Input.Password placeholder="密码" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="displayName" name="displayName">
                          <Input placeholder="显示名称" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Button
                      type="dashed"
                      block
                      loading={loadingKey === "register"}
                      onClick={() => {
                        const { username, email, password, displayName } = authForm.getFieldsValue();
                        return run("register", () =>
                          apiV1.auth.register({ username, email, password, displayName })
                        );
                      }}
                    >
                      注册
                    </Button>

                    <Divider>登录 / Token</Divider>
                    <Form.Item label="Email / Username" name="emailOrUsername">
                      <Input placeholder="邮箱或用户名" />
                    </Form.Item>
                    <Form.Item label="Password" name="password">
                      <Input.Password placeholder="密码" />
                    </Form.Item>
                    <Space>
                      <Button
                        type="primary"
                        loading={loadingKey === "login"}
                        onClick={() => {
                          const { emailOrUsername, password } = authForm.getFieldsValue();
                          return run("login", () => apiV1.auth.login({ emailOrUsername, password }));
                        }}
                      >
                        登录
                      </Button>
                      <Button
                        loading={loadingKey === "me"}
                        onClick={() => run("me", () => apiV1.auth.me())}
                      >
                        获取当前用户
                      </Button>
                      <Button
                        loading={loadingKey === "refresh"}
                        onClick={() => {
                          const refreshToken = authForm.getFieldValue("refreshToken");
                          return run("refresh", () => apiV1.auth.refresh(refreshToken));
                        }}
                      >
                        刷新 Token
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "logout"}
                        onClick={() => run("logout", () => apiV1.auth.logout())}
                      >
                        登出
                      </Button>
                    </Space>
                  </Form>
                  <Paragraph style={{ wordBreak: "break-all" }}>
                    当前 accessToken: {tokenVersion >= 0 ? tokenManager.getAccessToken() || "(空)" : ""}
                  </Paragraph>
                  <Paragraph style={{ wordBreak: "break-all" }}>
                    当前 refreshToken: {tokenVersion >= 0 ? tokenManager.getRefreshToken() || "(空)" : "(空)"}
                  </Paragraph>
                </Space>
              ),
            },
            {
              key: "workspace",
              label: "工作空间",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Form
                    form={workspaceForm}
                    layout="vertical"
                    initialValues={{
                      name: `测试空间_${Date.now()}`,
                      description: "临时测试空间",
                      icon: "📁",
                      memberRole: "editor",
                    }}
                  >
                    <Form.Item label="workspaceId" name="workspaceId">
                      <Input placeholder="用于查询/下游调用" allowClear />
                    </Form.Item>
                    <Form.Item label="name" name="name" rules={[{ required: true }]}>
                      <Input placeholder="空间名称" />
                    </Form.Item>
                    <Form.Item label="description" name="description">
                      <Input placeholder="描述" />
                    </Form.Item>
                    <Form.Item label="icon" name="icon">
                      <Input placeholder="emoji 或图标" />
                    </Form.Item>
                    <Space>
                      <Button
                        type="primary"
                        loading={loadingKey === "createWorkspace"}
                        onClick={async () => {
                          const res = await run("createWorkspace", () =>
                            apiV1.workspaces.createWorkspace({
                              name: workspaceForm.getFieldValue("name") ?? `测试空间_${Date.now()}`,
                              description: workspaceForm.getFieldValue("description"),
                              icon: workspaceForm.getFieldValue("icon"),
                            })
                          );
                          if (res?.workspaceId) {
                            workspaceForm.setFieldsValue({ workspaceId: res.workspaceId });
                          }
                        }}
                      >
                        创建
                      </Button>
                      <Button
                        loading={loadingKey === "listWorkspaces"}
                        onClick={() => run("listWorkspaces", () => apiV1.workspaces.listWorkspaces())}
                      >
                        列表
                      </Button>
                      <Button
                        loading={loadingKey === "getWorkspace"}
                        onClick={() => {
                          const id = workspaceForm.getFieldValue("workspaceId");
                          return run("getWorkspace", () => apiV1.workspaces.getWorkspace(id));
                        }}
                      >
                        详情
                      </Button>
                      <Button
                        loading={loadingKey === "updateWorkspace"}
                        onClick={() => {
                          const id = workspaceForm.getFieldValue("workspaceId");
                          return run("updateWorkspace", () =>
                            apiV1.workspaces.updateWorkspace(id, {
                              name: workspaceForm.getFieldValue("name"),
                              description: workspaceForm.getFieldValue("description"),
                              icon: workspaceForm.getFieldValue("icon"),
                            })
                          );
                        }}
                      >
                        更新
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "deleteWorkspace"}
                        onClick={() => {
                          const id = workspaceForm.getFieldValue("workspaceId");
                          return run("deleteWorkspace", () => apiV1.workspaces.deleteWorkspace(id));
                        }}
                      >
                        删除
                      </Button>
                    </Space>
                    <Divider>成员管理</Divider>
                    <Form.Item label="member userId" name="memberUserId">
                      <Input placeholder="邀请/更新/移除用 userId" />
                    </Form.Item>
                    <Form.Item label="member email" name="memberEmail">
                      <Input placeholder="可选，后端若支持邮箱邀请" />
                    </Form.Item>
                    <Form.Item label="member role" name="memberRole" initialValue="editor">
                      <Input placeholder="owner/admin/editor/viewer" />
                    </Form.Item>
                    <Space wrap>
                      <Button
                        loading={loadingKey === "inviteMember"}
                        onClick={() => {
                          const workspaceId = workspaceForm.getFieldValue("workspaceId");
                          return run("inviteMember", () =>
                            apiV1.workspaces.inviteMember(workspaceId, {
                              userId: workspaceForm.getFieldValue("memberUserId"),
                              email: workspaceForm.getFieldValue("memberEmail"),
                              role: workspaceForm.getFieldValue("memberRole") || "editor",
                            })
                          );
                        }}
                      >
                        邀请成员
                      </Button>
                      <Button
                        loading={loadingKey === "listMembers"}
                        onClick={() => {
                          const workspaceId = workspaceForm.getFieldValue("workspaceId");
                          return run("listMembers", () =>
                            apiV1.workspaces.listMembers(workspaceId, { page: 1, pageSize: 20 })
                          );
                        }}
                      >
                        成员列表
                      </Button>
                      <Button
                        loading={loadingKey === "updateMemberRole"}
                        onClick={() => {
                          const workspaceId = workspaceForm.getFieldValue("workspaceId");
                          const userId = workspaceForm.getFieldValue("memberUserId");
                          return run("updateMemberRole", () =>
                            apiV1.workspaces.updateMemberRole(workspaceId, userId, {
                              role: workspaceForm.getFieldValue("memberRole") || "editor",
                            })
                          );
                        }}
                      >
                        更新成员角色
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "removeMember"}
                        onClick={() => {
                          const workspaceId = workspaceForm.getFieldValue("workspaceId");
                          const userId = workspaceForm.getFieldValue("memberUserId");
                          return run("removeMember", () =>
                            apiV1.workspaces.removeMember(workspaceId, userId)
                          );
                        }}
                      >
                        移除成员
                      </Button>
                    </Space>
                  </Form>
                </Space>
              ),
            },
            {
              key: "document",
              label: "文档",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Form form={docForm} layout="vertical">
                    <Form.Item label="workspaceId" name="workspaceId">
                      <Input placeholder="创建/列表需要" />
                    </Form.Item>
                    <Form.Item label="docId" name="docId">
                      <Input placeholder="文档 ID" />
                    </Form.Item>
                    <Form.Item label="title" name="title" initialValue={`测试文档_${Date.now()}`}>
                      <Input placeholder="标题" />
                    </Form.Item>
                    <Form.Item label="parentId" name="parentId">
                      <Input placeholder="父文档，可空" />
                    </Form.Item>
                    <Form.Item label="tags (逗号分隔)" name="tags">
                      <Input placeholder="tagId1,tagId2" />
                    </Form.Item>
                    <Form.Item label="category" name="category">
                      <Input placeholder="分类，可选" />
                    </Form.Item>
                    <Form.Item label="sortOrder" name="sortOrder">
                      <Input placeholder="移动文档用，可选" />
                    </Form.Item>
                    <Form.Item label="fromVer" name="fromVer">
                      <Input placeholder="diff 用，整数" />
                    </Form.Item>
                    <Form.Item label="toVer" name="toVer">
                      <Input placeholder="diff 用，整数" />
                    </Form.Item>
                    <Form.Item label="revertVersion" name="revertVersion">
                      <Input placeholder="回滚版本号" />
                    </Form.Item>
                    <Form.Item label="commitMessage" name="commitMessage" initialValue="完成编辑">
                      <Input placeholder="提交版本备注" />
                    </Form.Item>
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={loadingKey === "createDocument"}
                        onClick={async () => {
                          const workspaceId = docForm.getFieldValue("workspaceId");
                          const title = docForm.getFieldValue("title") ?? `测试文档_${Date.now()}`;
                          const res = await run("createDocument", () =>
                            apiV1.documents.createDocument({ workspaceId, title })
                          );
                          if (res?.docId) {
                            docForm.setFieldsValue({ docId: res.docId, title: res.title });
                          }
                        }}
                      >
                        创建
                      </Button>
                      <Button
                        loading={loadingKey === "listDocuments"}
                        onClick={() =>
                          run("listDocuments", () =>
                            apiV1.documents.listDocuments({ workspaceId: docForm.getFieldValue("workspaceId") })
                          )
                        }
                      >
                        列表
                      </Button>
                      <Button
                        loading={loadingKey === "searchDocuments"}
                        onClick={() =>
                          run("searchDocuments", () =>
                            apiV1.documents.searchDocuments({
                              query: docForm.getFieldValue("title") || "",
                              workspaceId: docForm.getFieldValue("workspaceId"),
                              page: 1,
                              pageSize: 10,
                            })
                          )
                        }
                      >
                        搜索
                      </Button>
                      <Button
                        loading={loadingKey === "getDocument"}
                        onClick={() => run("getDocument", () => apiV1.documents.getDocument(docForm.getFieldValue("docId")))}
                      >
                        详情
                      </Button>
                      <Button
                        loading={loadingKey === "content"}
                        onClick={() =>
                          run("content", () => apiV1.documents.getDocumentContent(docForm.getFieldValue("docId")))
                        }
                      >
                        内容
                      </Button>
                      <Button
                        loading={loadingKey === "updateDocument"}
                        onClick={() => {
                          const docId = docForm.getFieldValue("docId");
                          const tags = (docForm.getFieldValue("tags") || "")
                            .split(",")
                            .map((t: string) => t.trim())
                            .filter(Boolean);
                          return run("updateDocument", () =>
                            apiV1.documents.updateDocument(docId, {
                              title: docForm.getFieldValue("title"),
                              parentId: docForm.getFieldValue("parentId") || null,
                              tags: tags.length ? tags : undefined,
                              category: docForm.getFieldValue("category") || undefined,
                            })
                          );
                        }}
                      >
                        更新
                      </Button>
                      <Button
                        loading={loadingKey === "publish"}
                        onClick={() => run("publish", () => apiV1.documents.publishDocument(docForm.getFieldValue("docId")))}
                      >
                        发布
                      </Button>
                      <Button
                        loading={loadingKey === "moveDocument"}
                        onClick={() => {
                          const docId = docForm.getFieldValue("docId");
                          const sortOrder = Number(docForm.getFieldValue("sortOrder"));
                          return run("moveDocument", () =>
                            apiV1.documents.moveDocument(docId, {
                              parentId: docForm.getFieldValue("parentId") || null,
                              sortOrder: Number.isNaN(sortOrder) ? undefined : sortOrder,
                            })
                          );
                        }}
                      >
                        移动
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "deleteDocument"}
                        onClick={() => run("deleteDocument", () => apiV1.documents.deleteDocument(docForm.getFieldValue("docId")))}
                      >
                        删除
                      </Button>
                      <Button
                        loading={loadingKey === "revisions"}
                        onClick={() =>
                          run("revisions", () =>
                            apiV1.documents.getRevisions(docForm.getFieldValue("docId"), { page: 1, pageSize: 20 })
                          )
                        }
                      >
                        修订历史
                      </Button>
                      <Button
                        loading={loadingKey === "diff"}
                        onClick={() =>
                          run("diff", () =>
                            apiV1.documents.getDiff(docForm.getFieldValue("docId"), {
                              fromVer: Number(docForm.getFieldValue("fromVer")),
                              toVer: Number(docForm.getFieldValue("toVer")),
                            })
                          )
                        }
                      >
                        版本对比
                      </Button>
                      <Button
                        loading={loadingKey === "revert"}
                        onClick={() =>
                          run("revert", () =>
                            apiV1.documents.revertDocument(docForm.getFieldValue("docId"), {
                              version: Number(docForm.getFieldValue("revertVersion")),
                            })
                          )
                        }
                      >
                        回滚版本
                      </Button>
                      <Button
                        loading={loadingKey === "snapshot"}
                        onClick={() => run("snapshot", () => apiV1.documents.createSnapshot(docForm.getFieldValue("docId")))}
                      >
                        创建快照
                      </Button>
                      <Button
                        loading={loadingKey === "commit"}
                        onClick={() =>
                          run("commit", () =>
                            apiV1.documents.commitDocument(docForm.getFieldValue("docId"), {
                              message: docForm.getFieldValue("commitMessage") || "",
                            })
                          )
                        }
                      >
                        手动创建版本
                      </Button>
                      <Button
                        loading={loadingKey === "pending"}
                        onClick={() =>
                          run("pending", () => apiV1.documents.getPendingVersions(docForm.getFieldValue("docId")))
                        }
                      >
                        待创建版本数
                      </Button>
                    </Space>
                  </Form>
                </Space>
              ),
            },
            {
              key: "block",
              label: "块",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Form
                    form={blockForm}
                    layout="vertical"
                    initialValues={{
                      type: "paragraph",
                      payload: "{ \"text\": \"示例内容\" }",
                      plainText: "示例内容",
                      indent: "0",
                      operations: `[{"type":"create","payload":{"docId":"DOC_ID","type":"paragraph","payload":{"text":"批量创建"}}}]`,
                    }}
                  >
                    <Form.Item label="docId" name="docId">
                      <Input placeholder="所属文档" />
                    </Form.Item>
                    <Form.Item label="parentId" name="parentId">
                      <Input placeholder="父块，可留空" />
                    </Form.Item>
                    <Form.Item label="blockId" name="blockId">
                      <Input placeholder="更新/删除/版本查询用" />
                    </Form.Item>
                    <Form.Item label="type" name="type">
                      <Input />
                    </Form.Item>
                    <Form.Item label="payload(JSON)" name="payload">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item label="plainText" name="plainText">
                      <Input placeholder="可选，更新内容时传递" />
                    </Form.Item>
                    <Form.Item label="sortKey" name="sortKey">
                      <Input placeholder="移动或创建时可选，建议不传" />
                    </Form.Item>
                    <Form.Item label="indent" name="indent">
                      <Input placeholder="数字，默认0" />
                    </Form.Item>
                    <Form.Item label="batch operations(JSON)" name="operations">
                      <Input.TextArea rows={4} />
                    </Form.Item>
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={loadingKey === "createBlock"}
                        onClick={() => {
                          try {
                            const raw = blockForm.getFieldValue("payload");
                            const payload = raw ? JSON.parse(raw) : {};
                            return run("createBlock", () =>
                              apiV1.blocks.createBlock({
                                docId: blockForm.getFieldValue("docId"),
                                parentId: blockForm.getFieldValue("parentId"),
                                type: blockForm.getFieldValue("type") ?? "paragraph",
                                payload,
                                createVersion: false,
                              })
                            );
                          } catch (error) {
                            message.error("payload 需要有效 JSON");
                            append("parse payload 失败", error);
                            return undefined;
                          }
                        }}
                      >
                        创建
                      </Button>
                      <Button
                        loading={loadingKey === "updateBlock"}
                        onClick={() => {
                          try {
                            const raw = blockForm.getFieldValue("payload");
                            const payload = raw ? JSON.parse(raw) : {};
                            const blockId = blockForm.getFieldValue("blockId");
                            return run("updateBlock", () =>
                              apiV1.blocks.updateBlockContent(blockId, {
                                payload,
                                plainText: blockForm.getFieldValue("plainText") || undefined,
                                createVersion: false,
                              })
                            );
                          } catch (error) {
                            message.error("payload 需要有效 JSON");
                            append("parse payload 失败", error);
                            return undefined;
                          }
                        }}
                      >
                        更新内容
                      </Button>
                      <Button
                        loading={loadingKey === "moveBlock"}
                        onClick={() => {
                          const blockId = blockForm.getFieldValue("blockId");
                          const indentRaw = Number(blockForm.getFieldValue("indent"));
                          return run("moveBlock", () =>
                            apiV1.blocks.moveBlock(blockId, {
                              parentId: blockForm.getFieldValue("parentId"),
                              sortKey: blockForm.getFieldValue("sortKey") || "",
                              indent: Number.isNaN(indentRaw) ? undefined : indentRaw,
                              createVersion: true,
                            })
                          );
                        }}
                      >
                        移动
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "deleteBlock"}
                        onClick={() => {
                          const blockId = blockForm.getFieldValue("blockId");
                          return run("deleteBlock", () => apiV1.blocks.deleteBlock(blockId));
                        }}
                      >
                        删除
                      </Button>
                      <Button
                        loading={loadingKey === "blockVersions"}
                        onClick={() => {
                          const blockId = blockForm.getFieldValue("blockId");
                          return run("blockVersions", () =>
                            apiV1.blocks.getBlockVersions(blockId, { page: 1, pageSize: 20 })
                          );
                        }}
                      >
                        版本历史
                      </Button>
                      <Button
                        loading={loadingKey === "batchBlocks"}
                        onClick={() => {
                          try {
                            const operationsRaw = blockForm.getFieldValue("operations") || "[]";
                            const operations = JSON.parse(operationsRaw);
                            return run("batchBlocks", () =>
                              apiV1.blocks.batchBlocks({
                                docId: blockForm.getFieldValue("docId"),
                                operations,
                                createVersion: true,
                              })
                            );
                          } catch (error) {
                            message.error("operations 需要有效 JSON 数组");
                            append("parse operations 失败", error);
                            return undefined;
                          }
                        }}
                      >
                        批量操作
                      </Button>
                    </Space>
                  </Form>
                </Space>
              ),
            },
            {
              key: "tag",
              label: "标签与收藏",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Form form={tagForm} layout="vertical">
                    <Form.Item label="workspaceId" name="workspaceId">
                      <Input placeholder="标签所属空间" />
                    </Form.Item>
                    <Form.Item label="tagId" name="tagId">
                      <Input placeholder="查询/更新用" />
                    </Form.Item>
                    <Form.Item label="tag name" name="name" initialValue={`标签_${Date.now()}`}>
                      <Input />
                    </Form.Item>
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={loadingKey === "createTag"}
                        onClick={async () => {
                          const res = await run("createTag", () =>
                            apiV1.tags.createTag({
                              workspaceId: tagForm.getFieldValue("workspaceId"),
                              name: tagForm.getFieldValue("name") ?? `标签_${Date.now()}`,
                            })
                          );
                          if ((res as unknown as { tagId?: string })?.tagId) {
                            tagForm.setFieldsValue({ tagId: (res as { tagId?: string }).tagId });
                          }
                        }}
                      >
                        创建标签
                      </Button>
                      <Button
                        loading={loadingKey === "listTags"}
                        onClick={() =>
                          run("listTags", () =>
                            apiV1.tags.listTags({ workspaceId: tagForm.getFieldValue("workspaceId"), page: 1, pageSize: 20 })
                          )
                        }
                      >
                        标签列表
                      </Button>
                      <Button
                        loading={loadingKey === "getTag"}
                        onClick={() => run("getTag", () => apiV1.tags.getTag(tagForm.getFieldValue("tagId")))}
                      >
                        标签详情
                      </Button>
                      <Button
                        loading={loadingKey === "updateTag"}
                        onClick={() => {
                          return run("updateTag", () =>
                            apiV1.tags.updateTag(tagForm.getFieldValue("tagId"), {
                              name: tagForm.getFieldValue("name"),
                            })
                          );
                        }}
                      >
                        更新标签
                      </Button>
                      <Button
                        loading={loadingKey === "tagUsage"}
                        onClick={() => run("tagUsage", () => apiV1.tags.getTagUsage(tagForm.getFieldValue("tagId")))}
                      >
                        使用统计
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "deleteTag"}
                        onClick={() => run("deleteTag", () => apiV1.tags.deleteTag(tagForm.getFieldValue("tagId")))}
                      >
                        删除标签
                      </Button>
                    </Space>
                  </Form>
                  <Divider />
                  <Form form={favoriteForm} layout="vertical">
                    <Form.Item label="docId" name="docId">
                      <Input placeholder="要收藏的文档" />
                    </Form.Item>
                    <Space>
                      <Button
                        type="primary"
                        loading={loadingKey === "addFavorite"}
                        onClick={() => run("addFavorite", () => apiV1.favorites.addFavorite({ docId: favoriteForm.getFieldValue("docId") }))}
                      >
                        添加收藏
                      </Button>
                      <Button
                        loading={loadingKey === "listFavorites"}
                        onClick={() => run("listFavorites", () => apiV1.favorites.listFavorites())}
                      >
                        收藏列表
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "removeFavorite"}
                        onClick={() => run("removeFavorite", () => apiV1.favorites.removeFavorite(favoriteForm.getFieldValue("docId")))}
                      >
                        取消收藏
                      </Button>
                    </Space>
                  </Form>
                </Space>
              ),
            },
            {
              key: "comment",
              label: "评论",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Form form={commentForm} layout="vertical">
                    <Form.Item label="docId" name="docId">
                      <Input placeholder="所属文档" />
                    </Form.Item>
                    <Form.Item label="blockId" name="blockId">
                      <Input placeholder="可选" />
                    </Form.Item>
                    <Form.Item label="commentId" name="commentId">
                      <Input placeholder="用于查询" />
                    </Form.Item>
                    <Form.Item label="content" name="content" initialValue="这是一条测试评论">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item label="reply parentCommentId" name="parentCommentId">
                      <Input placeholder="可选" />
                    </Form.Item>
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={loadingKey === "createComment"}
                        onClick={() =>
                          run("createComment", () =>
                            apiV1.comments.createComment({
                              docId: commentForm.getFieldValue("docId"),
                              blockId: commentForm.getFieldValue("blockId"),
                              content: commentForm.getFieldValue("content") ?? "测试评论",
                              parentCommentId: commentForm.getFieldValue("parentCommentId") || undefined,
                            })
                          )
                        }
                      >
                        创建
                      </Button>
                      <Button
                        loading={loadingKey === "listComments"}
                        onClick={() =>
                          run("listComments", () =>
                            apiV1.comments.listComments({
                              docId: commentForm.getFieldValue("docId"),
                              blockId: commentForm.getFieldValue("blockId"),
                              page: 1,
                              pageSize: 20,
                            })
                          )
                        }
                      >
                        列表
                      </Button>
                      <Button
                        loading={loadingKey === "getComment"}
                        onClick={() => run("getComment", () => apiV1.comments.getComment(commentForm.getFieldValue("commentId")))}
                      >
                        详情
                      </Button>
                      <Button
                        loading={loadingKey === "updateComment"}
                        onClick={() =>
                          run("updateComment", () =>
                            apiV1.comments.updateComment(commentForm.getFieldValue("commentId"), {
                              content: commentForm.getFieldValue("content") ?? "更新的评论",
                            })
                          )
                        }
                      >
                        更新
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "deleteComment"}
                        onClick={() => run("deleteComment", () => apiV1.comments.deleteComment(commentForm.getFieldValue("commentId")))}
                      >
                        删除
                      </Button>
                    </Space>
                  </Form>
                </Space>
              ),
            },
            {
              key: "search",
              label: "搜索与活动",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Form form={searchForm} layout="vertical" initialValues={{ query: "demo" }}>
                    <Form.Item label="query" name="query">
                      <Input placeholder="搜索关键词" />
                    </Form.Item>
                    <Form.Item label="workspaceId" name="workspaceId">
                      <Input placeholder="可选" />
                    </Form.Item>
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={loadingKey === "globalSearch"}
                        onClick={() =>
                          run("globalSearch", () =>
                            apiV1.search.globalSearch({
                              query: searchForm.getFieldValue("query") || "",
                              workspaceId: searchForm.getFieldValue("workspaceId"),
                              page: 1,
                              pageSize: 10,
                            })
                          )
                        }
                      >
                        全局搜索
                      </Button>
                      <Button
                        loading={loadingKey === "advancedSearch"}
                        onClick={() =>
                          run("advancedSearch", () =>
                            apiV1.search.advancedSearch({
                              query: searchForm.getFieldValue("query") || "",
                              workspaceId: searchForm.getFieldValue("workspaceId"),
                              page: 1,
                              pageSize: 10,
                            })
                          )
                        }
                      >
                        高级搜索
                      </Button>
                    </Space>
                  </Form>
                  <Divider />
                  <Form form={activityForm} layout="vertical">
                    <Form.Item label="workspaceId" name="workspaceId">
                      <Input placeholder="必填" />
                    </Form.Item>
                    <Space>
                      <Button
                        loading={loadingKey === "listActivities"}
                        onClick={() =>
                          run("listActivities", () =>
                            apiV1.activities.listActivities({
                              workspaceId: activityForm.getFieldValue("workspaceId"),
                              page: 1,
                              pageSize: 20,
                              action: activityForm.getFieldValue("action"),
                              entityType: activityForm.getFieldValue("entityType"),
                              userId: activityForm.getFieldValue("userId"),
                            })
                          )
                        }
                      >
                        活动列表
                      </Button>
                    </Space>
                  </Form>
                </Space>
              ),
            },
            {
              key: "asset",
              label: "资产与安全",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Upload {...uploadProps}>
                    <Button loading={loadingKey === "uploadAsset"}>上传资产（使用 workspaceId）</Button>
                  </Upload>
                  <Form form={assetForm} layout="vertical">
                    <Form.Item label="assetId" name="assetId">
                      <Input placeholder="用于下载/删除" />
                    </Form.Item>
                    <Form.Item label="workspaceId" name="workspaceId">
                      <Input placeholder="列出资产需要" />
                    </Form.Item>
                    <Space wrap>
                      <Button
                        loading={loadingKey === "listAssets"}
                        onClick={() =>
                          run("listAssets", () =>
                            apiV1.assets.listAssets({
                              workspaceId: assetForm.getFieldValue("workspaceId"),
                              page: 1,
                              pageSize: 20,
                            })
                          )
                        }
                      >
                        资产列表
                      </Button>
                      <Button
                        loading={loadingKey === "getAssetFile"}
                        onClick={() =>
                          run("getAssetFile", async () => {
                            const assetId = assetForm.getFieldValue("assetId") || "asset";
                            const blob = await apiV1.assets.getAssetFile(assetId);
                            const url = URL.createObjectURL(blob);
                            const anchor = document.createElement("a");
                            anchor.href = url;
                            anchor.download = `${assetId}.bin`;
                            anchor.style.display = "none";
                            document.body.appendChild(anchor);
                            anchor.click();
                            document.body.removeChild(anchor);
                            URL.revokeObjectURL(url);
                            return { blobType: blob.type, size: blob.size, filename: `${assetId}.bin` };
                          })
                        }
                      >
                        下载资产
                      </Button>
                      <Button
                        danger
                        loading={loadingKey === "deleteAsset"}
                        onClick={() => run("deleteAsset", () => apiV1.assets.deleteAsset(assetForm.getFieldValue("assetId")))}
                      >
                        删除资产
                      </Button>
                    </Space>
                  </Form>
                  <Divider />
                  <Form form={securityForm} layout="vertical">
                    <Form.Item label="workspaceId" name="workspaceId">
                      <Input placeholder="列出资产/安全需要" />
                    </Form.Item>
                    <Form.Item label="action" name="action">
                      <Input placeholder="活动 action 过滤" />
                    </Form.Item>
                    <Form.Item label="entityType" name="entityType">
                      <Input placeholder="活动实体类型过滤" />
                    </Form.Item>
                    <Form.Item label="userId" name="userId">
                      <Input placeholder="活动/安全过滤" />
                    </Form.Item>
                    <Space wrap>
                      <Button
                        loading={loadingKey === "securityEvents"}
                        onClick={() =>
                          run("securityEvents", () =>
                            apiV1.security.getSecurityEvents({ page: 1, pageSize: 20 })
                          )
                        }
                      >
                        安全事件
                      </Button>
                      <Button
                        loading={loadingKey === "auditLogs"}
                        onClick={() =>
                          run("auditLogs", () => apiV1.security.getAuditLogs({ page: 1, pageSize: 20 }))
                        }
                      >
                        审计日志
                      </Button>
                    </Space>
                  </Form>
                </Space>
              ),
            },
          ]} />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card title="响应结果" bordered={false}>
          {entry ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text type="secondary">{entry.title}</Text>
              <div
                style={{
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  padding: 8,
                  maxHeight: 420,
                  overflow: "auto",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                <JsonView
                  value={{ result: entry.data }}
                  collapsed={1}
                  enableClipboard={false}
                  style={{ fontFamily: "SFMono-Regular,Consolas,Menlo,monospace" }}
                />
              </div>
            </Space>
          ) : (
            <Text type="secondary">暂无结果，点击左侧按钮开始调用。</Text>
          )}
        </Card>
      </Col>
    </Row>
  );
}
