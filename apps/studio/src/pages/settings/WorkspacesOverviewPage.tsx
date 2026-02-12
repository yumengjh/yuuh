import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import { ReloadOutlined } from "@ant-design/icons";
import { apiV1 } from "../../api_v1";
import { useSessionStore } from "../../store";
import { getErrorMessage } from "./workspaceShared";

type ManageWorkspaceFormValues = {
  name: string;
  description?: string;
  icon?: string;
};

export default function WorkspacesOverviewPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<ManageWorkspaceFormValues>();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const workspaceId = useSessionStore((state) => state.workspaceId);
  const currentWorkspace = useSessionStore((state) => state.currentWorkspace);
  const workspaceDetailStatus = useSessionStore((state) => state.status.workspaceDetail);
  const loadWorkspaceDetail = useSessionStore((state) => state.loadWorkspaceDetail);
  const loadWorkspaceList = useSessionStore((state) => state.loadWorkspaceList);
  const loadDocListByWorkspace = useSessionStore((state) => state.loadDocListByWorkspace);
  const setWorkspace = useSessionStore((state) => state.setWorkspace);

  useEffect(() => {
    if (!workspaceId) return;
    void loadWorkspaceDetail(workspaceId).then((workspace) => {
      if (!workspace) return;
      form.setFieldsValue({
        name: workspace.name || "",
        description: workspace.description || "",
        icon: workspace.icon || "",
      });
    });
  }, [form, loadWorkspaceDetail, workspaceId]);

  const onSaveWorkspace = async () => {
    if (!workspaceId) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await apiV1.workspaces.updateWorkspace(workspaceId, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        icon: values.icon?.trim() || null,
      });
      await loadWorkspaceList();
      await loadWorkspaceDetail(workspaceId);
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
    if (!workspaceId) return;
    try {
      setDeleting(true);
      await apiV1.workspaces.deleteWorkspace(workspaceId);
      message.success("工作空间已删除");
      await loadWorkspaceList();
      setWorkspace(null);
      navigate("/settings/workspaces/list");
    } catch (error) {
      message.error(`删除工作空间失败：${getErrorMessage(error)}`);
    } finally {
      setDeleting(false);
    }
  };

  if (!workspaceId) {
    return (
      <Card bordered={false}>
        <Empty
          description="当前未选择工作空间，请先到“我的工作空间”选择。"
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
        title="工作空间概览"
        extra={
          <Button
            icon={<ReloadOutlined />}
            loading={workspaceDetailStatus === "loading"}
            onClick={() => {
              void loadWorkspaceDetail(workspaceId).then((workspace) => {
                if (!workspace) return;
                form.setFieldsValue({
                  name: workspace.name || "",
                  description: workspace.description || "",
                  icon: workspace.icon || "",
                });
                void loadDocListByWorkspace(workspace.workspaceId);
              });
            }}
          >
            刷新
          </Button>
        }
      >
        {currentWorkspace ? (
          <Descriptions column={1} size="small" style={{ marginBottom: 12 }}>
            <Descriptions.Item label="名称">{currentWorkspace.name}</Descriptions.Item>
            <Descriptions.Item label="图标">{currentWorkspace.icon || "-"}</Descriptions.Item>
            <Descriptions.Item label="描述">
              {currentWorkspace.description || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag>{currentWorkspace.userRole || "未知"}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {currentWorkspace.updatedAt || "-"}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type="secondary">暂无工作空间详情数据</Typography.Text>
        )}
      </Card>

      <Card title="编辑当前工作空间">
        <Form<ManageWorkspaceFormValues> form={form} layout="vertical">
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
          <Form.Item label="图标" name="icon">
            <Input allowClear />
          </Form.Item>
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
    </Space>
  );
}

