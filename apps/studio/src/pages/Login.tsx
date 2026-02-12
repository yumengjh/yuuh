import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Typography, message } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { authApi, tokenManager, type NormalizedApiError } from "../api";

type LoginFormValues = {
  emailOrUsername: string;
  password: string;
};

function getErrorMessage(err: unknown): string {
  const e = err as Partial<NormalizedApiError> | undefined;
  return e?.message || "登录失败，请稍后重试";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from || "/dash";
  }, [location.state]);

  const onFinish = async (values: LoginFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const session = await authApi.login(values);
      tokenManager.setTokens(session.accessToken, session.refreshToken);
      message.success("登录成功");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 120px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Card style={{ width: 420, maxWidth: "100%" }} bordered>
        <div style={{ marginBottom: 16 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            登录
          </Typography.Title>
          <Typography.Text type="secondary">使用你的账号登录知识库</Typography.Text>
        </div>

        {error && (
          <div style={{ marginBottom: 12 }}>
            <Alert type="error" showIcon message={error} />
          </div>
        )}

        <Form<LoginFormValues>
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          initialValues={{ emailOrUsername: "", password: "" }}
        >
          <Form.Item
            label="邮箱或用户名"
            name="emailOrUsername"
            rules={[{ required: true, message: "请输入邮箱或用户名" }]}
          >
            <Input
              size="large"
              prefix={<UserOutlined />}
              placeholder="john@example.com / john_doe"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
