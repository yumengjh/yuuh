import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiV1 } from "../api_v1";
import type { WorkspaceMember } from "../api_v1";
import { useSessionStore } from "../store";
import "./Workspace.css";

type CreateWorkspaceFormValues = {
  name: string;
  description?: string;
  icon?: string;
};

type ManageWorkspaceFormValues = {
  name: string;
  description?: string;
  icon?: string;
};

type InviteMemberFormValues = {
  userId?: string;
  email?: string;
  role: string;
};

const MEMBER_ROLE_OPTIONS = [
  { label: "管理员（admin）", value: "admin" },
  { label: "编辑者（editor）", value: "editor" },
  { label: "只读（viewer）", value: "viewer" },
];

const getErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") return "请求失败，请稍后重试";
  const errObj = error as { message?: unknown };
  if (typeof errObj.message === "string" && errObj.message.trim()) return errObj.message;
  if (Array.isArray(errObj.message)) {
    const joined = errObj.message.filter((item) => typeof item === "string").join("；");
    if (joined.trim()) return joined;
  }
  return "请求失败，请稍后重试";
};

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { workspaceId: workspaceIdFromRoute } = useParams<{ workspaceId: string }>();
  const [createForm] = Form.useForm<CreateWorkspaceFormValues>();
  const [manageForm] = Form.useForm<ManageWorkspaceFormValues>();
  const [inviteForm] = Form.useForm<InviteMemberFormValues>();

  const workspaceId = useSessionStore((state) => state.workspaceId);
  const workspaceList = useSessionStore((state) => state.workspaceList);
  const currentWorkspace = useSessionStore((state) => state.currentWorkspace);
  const loadWorkspaceList = useSessionStore((state) => state.loadWorkspaceList);
  const loadWorkspaceDetail = useSessionStore((state) => state.loadWorkspaceDetail);
  const loadDocListByWorkspace = useSessionStore((state) => state.loadDocListByWorkspace);
  const setWorkspace = useSessionStore((state) => state.setWorkspace);
  const workspaceListStatus = useSessionStore((state) => state.status.workspaceList);
  const workspaceDetailStatus = useSessionStore((state) => state.status.workspaceDetail);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);

  const currentWorkspaceId = workspaceIdFromRoute || workspaceId || null;

  const loadMembers = useCallback(async (id: string) => {
    setLoadingMembers(true);
    try {
      const res = await apiV1.workspaces.listMembers(id, { page: 1, pageSize: 100 });
      setMembers(Array.isArray(res?.items) ? res.items : []);
    } catch (error) {
      setMembers([]);
      message.error(`获取成员列表失败：${getErrorMessage(error)}`);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaceList();
  }, [loadWorkspaceList]);

  useEffect(() => {
    if (!currentWorkspaceId) {
      setWorkspace(null);
      setMembers([]);
      manageForm.resetFields();
      inviteForm.resetFields();
      return;
    }

    void loadWorkspaceDetail(currentWorkspaceId).then((workspace) => {
      if (!workspace) return;
      setWorkspace(workspace.workspaceId);
      manageForm.setFieldsValue({
        name: workspace.name || "",
        description: workspace.description || "",
        icon: workspace.icon || "",
      });
      void loadDocListByWorkspace(workspace.workspaceId);
    });
    void loadMembers(currentWorkspaceId);
  }, [
    currentWorkspaceId,
    inviteForm,
    loadDocListByWorkspace,
    loadMembers,
    loadWorkspaceDetail,
    manageForm,
    setWorkspace,
  ]);

  const onCreateWorkspace = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const res = await apiV1.workspaces.createWorkspace({
        name: values.name.trim(),
        description: values.description?.trim(),
        icon: values.icon?.trim(),
      });
      message.success("工作空间创建成功");
      createForm.resetFields();
      await loadWorkspaceList();
      setWorkspace(res.workspaceId);
      await loadDocListByWorkspace(res.workspaceId);
      navigate(`/workspace/${res.workspaceId}`);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(`创建工作空间失败：${getErrorMessage(error)}`);
    } finally {
      setCreating(false);
    }
  };

  const onSaveWorkspace = async () => {
    if (!currentWorkspaceId) return;
    try {
      const values = await manageForm.validateFields();
      setSaving(true);
      const res = await apiV1.workspaces.updateWorkspace(currentWorkspaceId, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        icon: values.icon?.trim() || null,
      });
      await loadWorkspaceList();
      await loadWorkspaceDetail(currentWorkspaceId);
      setWorkspace(res.workspaceId);
      message.success("工作空间更新成功");
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(`更新工作空间失败：${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteWorkspace = async () => {
    if (!currentWorkspaceId) return;
    try {
      setDeleting(true);
      await apiV1.workspaces.deleteWorkspace(currentWorkspaceId);
      message.success("工作空间已删除");
      await loadWorkspaceList();
      setWorkspace(null);
      navigate("/workspace");
    } catch (error) {
      message.error(`删除工作空间失败：${getErrorMessage(error)}`);
    } finally {
      setDeleting(false);
    }
  };

  const onInviteMember = async () => {
    if (!currentWorkspaceId) return;
    try {
      const values = await inviteForm.validateFields();
      if (!values.userId?.trim() && !values.email?.trim()) {
        message.warning("userId 和 email 至少填写一项");
        return;
      }
      setInviting(true);
      await apiV1.workspaces.inviteMember(currentWorkspaceId, {
        userId: values.userId?.trim() || undefined,
        email: values.email?.trim() || undefined,
        role: values.role,
      });
      message.success("成员邀请成功");
      inviteForm.resetFields(["userId", "email"]);
      await loadMembers(currentWorkspaceId);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(`邀请成员失败：${getErrorMessage(error)}`);
    } finally {
      setInviting(false);
    }
  };

  const onUpdateMemberRole = async (userId: string, role: string) => {
    if (!currentWorkspaceId) return;
    try {
      setUpdatingMemberId(userId);
      await apiV1.workspaces.updateMemberRole(currentWorkspaceId, userId, { role });
      message.success("成员角色已更新");
      await loadMembers(currentWorkspaceId);
    } catch (error) {
      message.error(`更新成员角色失败：${getErrorMessage(error)}`);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const onRemoveMember = async (userId: string) => {
    if (!currentWorkspaceId) return;
    try {
      setRemovingMemberId(userId);
      await apiV1.workspaces.removeMember(currentWorkspaceId, userId);
      message.success("成员已移除");
      await loadMembers(currentWorkspaceId);
    } catch (error) {
      message.error(`移除成员失败：${getErrorMessage(error)}`);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const memberColumns = [
    {
      title: "成员",
      key: "member",
      render: (_: unknown, record: WorkspaceMember) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.displayName || record.userId}</Typography.Text>
          <Typography.Text type="secondary">{record.email || record.userId}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "角色",
      key: "role",
      render: (_: unknown, record: WorkspaceMember) => (
        <Select
          className="workspace-role-select"
          value={record.role}
          options={MEMBER_ROLE_OPTIONS}
          loading={updatingMemberId === record.userId}
          disabled={updatingMemberId === record.userId}
          onChange={(role) => void onUpdateMemberRole(record.userId, role)}
        />
      ),
    },
    {
      title: "操作",
      key: "actions",
      align: "right" as const,
      render: (_: unknown, record: WorkspaceMember) => (
        <div className="workspace-member-actions">
          <Popconfirm
            title="确认移除该成员？"
            okText="移除"
            cancelText="取消"
            onConfirm={() => void onRemoveMember(record.userId)}
          >
            <Button danger size="small" loading={removingMemberId === record.userId}>
              移除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="workspace-page">
      <div className="workspace-page__header">
        <Typography.Title level={3} style={{ margin: 0 }}>
          工作空间
        </Typography.Title>
        <Typography.Text type="secondary">
          工作空间信息已统一写入上游状态，供 Sidebar / Header / 文档模块共享。
        </Typography.Text>
        <Typography.Text className="workspace-page__path" code>
          当前路径：{currentWorkspaceId ? `/workspace/${currentWorkspaceId}` : "/workspace"}
        </Typography.Text>
      </div>

      {currentWorkspaceId && (
        <Alert
          showIcon
          type="info"
          message={
            <Space>
              <span>当前 workspaceId</span>
              <Tag color="blue">{currentWorkspaceId}</Tag>
            </Space>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={9}>
          <Card title="创建工作空间" bordered={false}>
            <Form<CreateWorkspaceFormValues>
              form={createForm}
              layout="vertical"
              initialValues={{ name: "", description: "", icon: "📁" }}
            >
              <Form.Item
                label="名称"
                name="name"
                rules={[
                  { required: true, message: "请输入工作空间名称" },
                  { max: 100, message: "名称不超过 100 个字符" },
                ]}
              >
                <Input placeholder="例如：研发知识库" allowClear />
              </Form.Item>
              <Form.Item label="描述" name="description">
                <Input.TextArea rows={3} placeholder="工作空间用途说明" allowClear />
              </Form.Item>
              <Form.Item label="图标" name="icon">
                <Input placeholder="例如：📁" allowClear />
              </Form.Item>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={() => void onCreateWorkspace()}>
                  创建并进入管理
                </Button>
                <Button onClick={() => createForm.resetFields()}>重置</Button>
              </Space>
            </Form>
          </Card>

          <Card
            title="工作空间列表"
            bordered={false}
            style={{ marginTop: 16 }}
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                loading={workspaceListStatus === "loading"}
                onClick={() => void loadWorkspaceList()}
              />
            }
          >
            <List
              loading={workspaceListStatus === "loading"}
              locale={{ emptyText: <Empty description="暂无工作空间" /> }}
              dataSource={workspaceList}
              renderItem={(item) => (
                <List.Item>
                  <div className="workspace-list-item">
                    <div className="workspace-list-item__meta">
                      <Typography.Text className="workspace-list-item__title">
                        {item.icon ? `${item.icon} ` : ""}
                        {item.name}
                      </Typography.Text>
                      <Typography.Text type="secondary" ellipsis>
                        {item.workspaceId}
                      </Typography.Text>
                    </div>
                    <Button
                      size="small"
                      loading={switchingWorkspaceId === item.workspaceId}
                      onClick={() => {
                        setSwitchingWorkspaceId(item.workspaceId);
                        setWorkspace(item.workspaceId);
                        void loadDocListByWorkspace(item.workspaceId)
                          .finally(() => {
                            setSwitchingWorkspaceId(null);
                            navigate(`/workspace/${item.workspaceId}`);
                          });
                      }}
                    >
                      管理
                    </Button>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          {!currentWorkspaceId ? (
            <Card bordered={false}>
              <Empty
                description="请先创建工作空间，或从左侧列表选择已有工作空间进行管理"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          ) : (
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Card
                title="工作空间管理"
                bordered={false}
                extra={
                  <Button
                    icon={<ReloadOutlined />}
                    loading={workspaceDetailStatus === "loading"}
                    onClick={() => currentWorkspaceId && void loadWorkspaceDetail(currentWorkspaceId)}
                  >
                    刷新
                  </Button>
                }
              >
                {workspaceDetailStatus === "loading" && (
                  <div style={{ marginBottom: 12 }}>
                    <Spin size="small" />
                  </div>
                )}
                {currentWorkspace && (
                  <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="workspaceId">
                      <Typography.Text code>{currentWorkspace.workspaceId}</Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="当前角色">
                      <Tag>{currentWorkspace.userRole || "未知"}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="更新时间">{currentWorkspace.updatedAt || "-"}</Descriptions.Item>
                  </Descriptions>
                )}

                <Form<ManageWorkspaceFormValues> form={manageForm} layout="vertical">
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="名称"
                        name="name"
                        rules={[
                          { required: true, message: "请输入工作空间名称" },
                          { max: 100, message: "名称不超过 100 个字符" },
                        ]}
                      >
                        <Input allowClear />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="图标" name="icon">
                        <Input allowClear />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="描述" name="description">
                    <Input.TextArea rows={4} allowClear />
                  </Form.Item>
                  <Space>
                    <Button type="primary" loading={saving} onClick={() => void onSaveWorkspace()}>
                      保存变更
                    </Button>
                    <Popconfirm
                      title="确认删除当前工作空间？"
                      description="删除后不可恢复，请谨慎操作。"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => void onDeleteWorkspace()}
                    >
                      <Button danger loading={deleting}>
                        删除工作空间
                      </Button>
                    </Popconfirm>
                  </Space>
                </Form>
              </Card>

              <Card
                title="成员管理"
                bordered={false}
                extra={
                  <Button icon={<ReloadOutlined />} loading={loadingMembers} onClick={() => currentWorkspaceId && void loadMembers(currentWorkspaceId)}>
                    刷新成员
                  </Button>
                }
              >
                <Form<InviteMemberFormValues> form={inviteForm} layout="vertical" initialValues={{ role: "editor" }}>
                  <Row gutter={12}>
                    <Col xs={24} md={8}>
                      <Form.Item label="用户 ID" name="userId">
                        <Input placeholder="可选，填写 userId" allowClear />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="邮箱" name="email">
                        <Input placeholder="可选，填写邮箱邀请" allowClear />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="角色" name="role" rules={[{ required: true }]}>
                        <Select options={MEMBER_ROLE_OPTIONS} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                    填写 userId 或 email 至少一种方式即可邀请成员。
                  </Typography.Text>
                  <Button type="primary" loading={inviting} onClick={() => void onInviteMember()}>
                    邀请成员
                  </Button>
                </Form>

                <Table<WorkspaceMember>
                  style={{ marginTop: 16 }}
                  rowKey={(record) => record.userId}
                  columns={memberColumns}
                  loading={loadingMembers}
                  dataSource={members}
                  pagination={false}
                  locale={{ emptyText: "暂无成员数据" }}
                />
              </Card>
            </Space>
          )}
        </Col>
      </Row>
    </div>
  );
}
