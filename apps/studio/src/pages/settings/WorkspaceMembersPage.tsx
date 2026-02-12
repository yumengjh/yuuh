import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { apiV1 } from "../../api_v1";
import type { WorkspaceMember } from "../../api_v1";
import { useSessionStore } from "../../store";
import { MEMBER_ROLE_OPTIONS, getErrorMessage } from "./workspaceShared";
import "./Workspaces.css";

type InviteMemberFormValues = {
  userId?: string;
  email?: string;
  role: string;
};

export default function WorkspaceMembersPage() {
  const navigate = useNavigate();
  const [inviteForm] = Form.useForm<InviteMemberFormValues>();
  const workspaceId = useSessionStore((state) => state.workspaceId);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

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
    if (!workspaceId) return;
    void loadMembers(workspaceId);
  }, [loadMembers, workspaceId]);

  const onInviteMember = async () => {
    if (!workspaceId) return;
    try {
      const values = await inviteForm.validateFields();
      if (!values.userId?.trim() && !values.email?.trim()) {
        message.warning("userId 和 email 至少填写一项");
        return;
      }
      setInviting(true);
      await apiV1.workspaces.inviteMember(workspaceId, {
        userId: values.userId?.trim() || undefined,
        email: values.email?.trim() || undefined,
        role: values.role,
      });
      message.success("成员邀请成功");
      inviteForm.resetFields(["userId", "email"]);
      await loadMembers(workspaceId);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(`邀请成员失败：${getErrorMessage(error)}`);
    } finally {
      setInviting(false);
    }
  };

  const onUpdateMemberRole = async (userId: string, role: string) => {
    if (!workspaceId) return;
    try {
      setUpdatingMemberId(userId);
      await apiV1.workspaces.updateMemberRole(workspaceId, userId, { role });
      message.success("成员角色已更新");
      await loadMembers(workspaceId);
    } catch (error) {
      message.error(`更新成员角色失败：${getErrorMessage(error)}`);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const onRemoveMember = async (userId: string) => {
    if (!workspaceId) return;
    try {
      setRemovingMemberId(userId);
      await apiV1.workspaces.removeMember(workspaceId, userId);
      message.success("成员已移除");
      await loadMembers(workspaceId);
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

  if (!workspaceId) {
    return (
      <Card bordered={false}>
        <Empty
          description="请先选择工作空间，再进行成员管理。"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => navigate("/settings/workspaces/list")}>
            去选择工作空间
          </Button>
        </Empty>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message={
          <Space>
            <span>当前 workspaceId</span>
            <Tag color="blue">{workspaceId}</Tag>
          </Space>
        }
      />

      <Card
        title="成员管理"
        extra={
          <Button
            icon={<ReloadOutlined />}
            loading={loadingMembers}
            onClick={() => void loadMembers(workspaceId)}
          >
            刷新成员
          </Button>
        }
      >
        <Form<InviteMemberFormValues>
          form={inviteForm}
          layout="vertical"
          initialValues={{ role: "editor" }}
        >
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
  );
}
