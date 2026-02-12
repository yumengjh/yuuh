import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Space,
  Typography,
  message,
} from "antd";
import { UserOutlined } from "@ant-design/icons";
import { apiV1 } from "../../api_v1";
import "./ProfileSettingsPage.css";

type ProfileFormValues = {
  avatar?: string;
  displayName?: string;
  bio?: string;
};

type UserProfileView = {
  userId: string;
  username: string;
  email: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  avatar: string;
  bio: string;
};

const normalizeMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") return "请求失败，请稍后重试";
  const withMessage = error as { message?: unknown };
  if (typeof withMessage.message === "string" && withMessage.message.trim()) {
    return withMessage.message;
  }
  if (Array.isArray(withMessage.message)) {
    const joined = withMessage.message.filter((item) => typeof item === "string").join("；");
    if (joined.trim()) return joined;
  }
  return "请求失败，请稍后重试";
};

const normalizeOptionalText = (value: string | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const formatDateTime = (value: string): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

export default function ProfileSettingsPage() {
  const [form] = Form.useForm<ProfileFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [profile, setProfile] = useState<UserProfileView | null>(null);
  const avatarInput = Form.useWatch("avatar", form);

  const avatarPreview = useMemo(() => {
    if (typeof avatarInput !== "string") return undefined;
    const trimmed = avatarInput.trim();
    return trimmed || undefined;
  }, [avatarInput]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const me = await apiV1.auth.me();
        if (cancelled) return;
        const nextProfile: UserProfileView = {
          userId: me.userId || "-",
          username: me.username || "-",
          email: me.email || "-",
          status: me.status || "active",
          createdAt: me.createdAt || "",
          updatedAt: me.updatedAt || "",
          displayName: me.displayName || "",
          avatar: me.avatar || "",
          bio: me.bio || "",
        };
        setProfile(nextProfile);
        form.setFieldsValue({
          displayName: nextProfile.displayName,
          avatar: nextProfile.avatar,
          bio: nextProfile.bio,
        });
      } catch (err) {
        if (cancelled) return;
        setError(normalizeMessage(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [form]);

  const onSubmit = async () => {
    if (!profile) {
      message.warning("用户信息尚未加载完成");
      return;
    }
    try {
      const values = await form.validateFields();
      setSaving(true);
      setError(undefined);

      const nextDisplayName = normalizeOptionalText(values.displayName);
      const nextAvatar = normalizeOptionalText(values.avatar);
      const nextBio = normalizeOptionalText(values.bio);

      const payload: {
        displayName?: string;
        avatar?: string;
        bio?: string;
      } = {};
      const ignoredClearFields: string[] = [];

      if ((nextDisplayName || "") !== profile.displayName) {
        if (nextDisplayName) {
          payload.displayName = nextDisplayName;
        } else {
          ignoredClearFields.push("displayName");
        }
      }
      if ((nextAvatar || "") !== profile.avatar) {
        if (nextAvatar) {
          payload.avatar = nextAvatar;
        } else {
          ignoredClearFields.push("avatar");
        }
      }
      if ((nextBio || "") !== profile.bio) {
        if (nextBio) {
          payload.bio = nextBio;
        } else {
          ignoredClearFields.push("bio");
        }
      }

      if (ignoredClearFields.length > 0) {
        message.warning(`当前接口暂不支持清空字段：${ignoredClearFields.join("、")}`);
      }

      if (Object.keys(payload).length === 0) {
        message.info("没有可提交的资料变更");
        return;
      }

      const updated = await apiV1.auth.updateMyProfile(payload);
      const nextProfile: UserProfileView = {
        userId: updated.userId || profile.userId,
        username: updated.username || profile.username,
        email: updated.email || profile.email,
        status: updated.status || profile.status || "active",
        createdAt: updated.createdAt || profile.createdAt,
        updatedAt: updated.updatedAt || profile.updatedAt,
        displayName: updated.displayName || "",
        avatar: updated.avatar || "",
        bio: updated.bio || "",
      };
      setProfile(nextProfile);
      form.setFieldsValue({
        displayName: nextProfile.displayName,
        avatar: nextProfile.avatar,
        bio: nextProfile.bio,
      });
      message.success("用户信息已更新");
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      setError(normalizeMessage(err));
      message.error(normalizeMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-settings-page">
      <header className="profile-settings-header">
        <Typography.Title level={3} style={{ margin: 0 }}>
          账号信息
        </Typography.Title>
        <Typography.Text type="secondary">
          当前接口仅支持更新 displayName / avatar / bio（支持部分字段更新）。
        </Typography.Text>
      </header>

      {error && (
        <Alert
          className="profile-settings-alert"
          type="warning"
          showIcon
          message={error}
        />
      )}

      <Card loading={loading} title="账户基础信息（只读）">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="用户ID">{profile?.userId || "-"}</Descriptions.Item>
          <Descriptions.Item label="用户名">{profile?.username || "-"}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{profile?.email || "-"}</Descriptions.Item>
          <Descriptions.Item label="状态">{profile?.status || "-"}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {formatDateTime(profile?.createdAt || "")}
          </Descriptions.Item>
          <Descriptions.Item label="上次更新时间">
            {formatDateTime(profile?.updatedAt || "")}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={loading} title="公开资料（可编辑）">
        <Form layout="vertical" form={form} autoComplete="off">
          <div className="profile-settings-grid">
            <Form.Item label="显示名称" name="displayName">
              <Input placeholder="用于文档展示的作者名称（displayName）" />
            </Form.Item>
          </div>

          <Form.Item label="头像地址" name="avatar">
            <Input placeholder="https://example.com/avatar.png" />
          </Form.Item>

          <div className="profile-avatar-preview">
            <Avatar size={56} src={avatarPreview} icon={<UserOutlined />} />
            <Typography.Text type="secondary">头像预览（根据地址实时显示）</Typography.Text>
          </div>

          <Form.Item label="个人简介" name="bio">
            <Input.TextArea rows={4} placeholder="介绍一下你自己" />
          </Form.Item>

          <Space>
            <Button type="primary" loading={saving} onClick={() => void onSubmit()}>
              保存账号信息
            </Button>
            <Typography.Text type="secondary">当前仅基础编辑，后续再补充字段校验。</Typography.Text>
          </Space>
        </Form>
      </Card>

      <Card title="账号安全（暂未开放）">
        <div className="profile-settings-grid">
          <div className="profile-readonly-field">
            <Typography.Text type="secondary">邮箱（单独接口，暂未开放）</Typography.Text>
            <Input value={profile?.email || ""} disabled />
          </div>
          <div className="profile-readonly-field">
            <Typography.Text type="secondary">密码（单独接口，暂未开放）</Typography.Text>
            <Input.Password value="********" disabled />
          </div>
        </div>
        <Space>
          <Button disabled>修改邮箱（暂未开放）</Button>
          <Button disabled>修改密码（暂未开放）</Button>
        </Space>
      </Card>
    </div>
  );
}
