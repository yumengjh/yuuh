import { useEffect, useState } from "react";
import { Button, Card, Empty, List, Space, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../../store";
import { getErrorMessage } from "./workspaceShared";
import "./Workspaces.css";

export default function WorkspacesListPage() {
  const navigate = useNavigate();
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);
  const workspaceList = useSessionStore((state) => state.workspaceList);
  const workspaceListStatus = useSessionStore((state) => state.status.workspaceList);
  const loadWorkspaceList = useSessionStore((state) => state.loadWorkspaceList);
  const loadDocListByWorkspace = useSessionStore((state) => state.loadDocListByWorkspace);
  const setWorkspace = useSessionStore((state) => state.setWorkspace);

  useEffect(() => {
    void loadWorkspaceList();
  }, [loadWorkspaceList]);

  return (
    <Card
      title="我的工作空间"
      extra={
        <Button
          icon={<ReloadOutlined />}
          loading={workspaceListStatus === "loading"}
          onClick={() => void loadWorkspaceList()}
        >
          刷新
        </Button>
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
              <Space>
                <Button
                  size="small"
                  loading={switchingWorkspaceId === item.workspaceId}
                  onClick={() => {
                    setSwitchingWorkspaceId(item.workspaceId);
                    setWorkspace(item.workspaceId);
                    void loadDocListByWorkspace(item.workspaceId)
                      .catch((error) => {
                        message.error(`切换工作空间失败：${getErrorMessage(error)}`);
                      })
                      .finally(() => {
                        setSwitchingWorkspaceId(null);
                        navigate("/settings/workspaces/overview");
                      });
                  }}
                >
                  进入管理
                </Button>
              </Space>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}
