import { useState } from "react";
import { Button, Card, Form, Input, Space, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { apiV1 } from "../../api_v1";
import { useSessionStore } from "../../store";
import { getErrorMessage } from "./workspaceShared";

type CreateWorkspaceFormValues = {
  name: string;
  description?: string;
  icon?: string;
};

export default function WorkspaceCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<CreateWorkspaceFormValues>();
  const [creating, setCreating] = useState(false);
  const loadWorkspaceList = useSessionStore((state) => state.loadWorkspaceList);
  const loadDocListByWorkspace = useSessionStore((state) => state.loadDocListByWorkspace);
  const setWorkspace = useSessionStore((state) => state.setWorkspace);

  const onCreateWorkspace = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      const res = await apiV1.workspaces.createWorkspace({
        name: values.name.trim(),
        description: values.description?.trim(),
        icon: values.icon?.trim(),
      });
      message.success("工作空间创建成功");
      form.resetFields();
      await loadWorkspaceList();
      setWorkspace(res.workspaceId);
      await loadDocListByWorkspace(res.workspaceId);
      navigate("/settings/workspaces/overview");
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(`创建工作空间失败：${getErrorMessage(error)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card title="创建工作空间">
      <Form<CreateWorkspaceFormValues>
        form={form}
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
          <Input.TextArea rows={4} placeholder="工作空间用途说明" allowClear />
        </Form.Item>
        <Form.Item label="图标" name="icon">
          <Input placeholder="例如：📁" allowClear />
        </Form.Item>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={creating}
            onClick={() => void onCreateWorkspace()}
          >
            创建并进入管理
          </Button>
          <Button onClick={() => form.resetFields()}>重置</Button>
        </Space>
      </Form>
    </Card>
  );
}

