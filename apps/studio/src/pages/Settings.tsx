import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  InputNumber,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { usePreferenceStore, useSessionStore } from "../store";
import {
  MAX_CONTENT_WIDTH,
  MAX_FONT_SIZE,
  MIN_CONTENT_WIDTH,
  MIN_FONT_SIZE,
} from "../types/preferences";
import "./Settings.css";

const { Title, Text } = Typography;

type TabKey = "user" | "workspace" | "effective";
type SourceKey =
  | "reader.contentWidth"
  | "reader.fontSize"
  | "editor.contentWidth"
  | "editor.fontSize"
  | "advanced.compactList"
  | "advanced.codeFontFamily";
type SourceValue = "default" | "user" | "workspace";

const SOURCE_LABEL_MAP: Record<SourceValue, string> = {
  default: "默认",
  user: "用户",
  workspace: "空间",
};

const SOURCE_COLOR_MAP: Record<SourceValue, string> = {
  default: "#94a3b8",
  user: "blue",
  workspace: "gold",
};

export default function SettingsPage() {
  const workspaceId = useSessionStore((state) => state.workspaceId);
  const workspaceName = useSessionStore((state) => state.currentWorkspace?.name);

  const userSettings = usePreferenceStore((state) => state.userSettings);
  const workspaceSettings = usePreferenceStore((state) => state.workspaceSettings);
  const effectiveSettings = usePreferenceStore((state) => state.effectiveSettings);
  const sources = usePreferenceStore((state) => state.sources);
  const status = usePreferenceStore((state) => state.status);
  const errors = usePreferenceStore((state) => state.errors);
  const hydrate = usePreferenceStore((state) => state.hydrate);
  const saveUserSettings = usePreferenceStore((state) => state.saveUserSettings);
  const saveWorkspaceSettings = usePreferenceStore((state) => state.saveWorkspaceSettings);
  const clearWorkspaceSettings = usePreferenceStore((state) => state.clearWorkspaceSettings);

  const [activeTab, setActiveTab] = useState<TabKey>("user");

  const [userReaderWidth, setUserReaderWidth] = useState(userSettings.reader.contentWidth);
  const [userEditorWidth, setUserEditorWidth] = useState(userSettings.editor.contentWidth);
  const [userReaderFontSize, setUserReaderFontSize] = useState(userSettings.reader.fontSize);
  const [userEditorFontSize, setUserEditorFontSize] = useState(userSettings.editor.fontSize);
  const [userCompactList, setUserCompactList] = useState(
    userSettings.advanced.compactList
  );
  const [userCodeFontFamily, setUserCodeFontFamily] = useState(
    userSettings.advanced.codeFontFamily
  );

  const workspaceEffective = useMemo(() => {
    if (!workspaceSettings) return effectiveSettings;
    return {
      reader: {
        contentWidth:
          workspaceSettings.reader?.contentWidth ??
          effectiveSettings.reader.contentWidth,
        fontSize:
          workspaceSettings.reader?.fontSize ??
          effectiveSettings.reader.fontSize,
      },
      editor: {
        contentWidth:
          workspaceSettings.editor?.contentWidth ??
          effectiveSettings.editor.contentWidth,
        fontSize:
          workspaceSettings.editor?.fontSize ??
          effectiveSettings.editor.fontSize,
      },
      advanced: {
        compactList:
          workspaceSettings.advanced?.compactList ??
          effectiveSettings.advanced.compactList,
        codeFontFamily:
          workspaceSettings.advanced?.codeFontFamily ??
          effectiveSettings.advanced.codeFontFamily,
      },
    };
  }, [effectiveSettings, workspaceSettings]);

  const [workspaceEnabled, setWorkspaceEnabled] = useState(Boolean(workspaceSettings));
  const [workspaceReaderWidth, setWorkspaceReaderWidth] = useState(
    workspaceEffective.reader.contentWidth
  );
  const [workspaceEditorWidth, setWorkspaceEditorWidth] = useState(
    workspaceEffective.editor.contentWidth
  );
  const [workspaceReaderFontSize, setWorkspaceReaderFontSize] = useState(
    workspaceEffective.reader.fontSize
  );
  const [workspaceEditorFontSize, setWorkspaceEditorFontSize] = useState(
    workspaceEffective.editor.fontSize
  );
  const [workspaceCompactList, setWorkspaceCompactList] = useState(
    workspaceEffective.advanced.compactList
  );
  const [workspaceCodeFontFamily, setWorkspaceCodeFontFamily] = useState(
    workspaceEffective.advanced.codeFontFamily
  );

  useEffect(() => {
    void hydrate(workspaceId);
  }, [hydrate, workspaceId]);

  useEffect(() => {
    setUserReaderWidth(userSettings.reader.contentWidth);
    setUserEditorWidth(userSettings.editor.contentWidth);
    setUserReaderFontSize(userSettings.reader.fontSize);
    setUserEditorFontSize(userSettings.editor.fontSize);
    setUserCompactList(userSettings.advanced.compactList);
    setUserCodeFontFamily(userSettings.advanced.codeFontFamily);
  }, [userSettings]);

  useEffect(() => {
    setWorkspaceEnabled(Boolean(workspaceSettings));
    setWorkspaceReaderWidth(workspaceEffective.reader.contentWidth);
    setWorkspaceEditorWidth(workspaceEffective.editor.contentWidth);
    setWorkspaceReaderFontSize(workspaceEffective.reader.fontSize);
    setWorkspaceEditorFontSize(workspaceEffective.editor.fontSize);
    setWorkspaceCompactList(workspaceEffective.advanced.compactList);
    setWorkspaceCodeFontFamily(workspaceEffective.advanced.codeFontFamily);
  }, [workspaceEffective, workspaceSettings]);

  const resolveSource = (field: SourceKey): SourceValue => {
    const source = sources[field];
    if (source === "user" || source === "workspace" || source === "default") {
      return source;
    }
    return "default";
  };

  const renderFieldLabel = (label: string, field: SourceKey) => {
    const source = resolveSource(field);
    return (
      <span className="settings-field-label">
        <span>{label}</span>
        <Tag className="settings-source-tag" color={SOURCE_COLOR_MAP[source]}>
          {SOURCE_LABEL_MAP[source]}
        </Tag>
      </span>
    );
  };

  const saveUser = async () => {
    const ok = await saveUserSettings({
      reader: {
        contentWidth: userReaderWidth,
        fontSize: userReaderFontSize,
      },
      editor: {
        contentWidth: userEditorWidth,
        fontSize: userEditorFontSize,
      },
      advanced: {
        compactList: userCompactList,
        codeFontFamily: userCodeFontFamily.trim(),
      },
    });
    if (ok) message.success("用户偏好已保存");
  };

  const saveWorkspace = async () => {
    if (!workspaceId) {
      message.warning("请先选择工作空间");
      return;
    }
    if (!workspaceEnabled) {
      const ok = await clearWorkspaceSettings(workspaceId);
      if (ok) message.success("已清除工作空间覆盖配置");
      return;
    }
    const ok = await saveWorkspaceSettings(
      {
        reader: {
          contentWidth: workspaceReaderWidth,
          fontSize: workspaceReaderFontSize,
        },
        editor: {
          contentWidth: workspaceEditorWidth,
          fontSize: workspaceEditorFontSize,
        },
        advanced: {
          compactList: workspaceCompactList,
          codeFontFamily: workspaceCodeFontFamily.trim(),
        },
      },
      workspaceId
    );
    if (ok) message.success("工作空间覆盖配置已保存");
  };

  const commonError =
    errors.user || errors.workspace || errors.saveUser || errors.saveWorkspace;

  return (
    <div className="settings-page">
      <header className="settings-page-header">
        <Title level={3} className="settings-title">
          体验设置
        </Title>
        <Text type="secondary">
          当前生效：阅读 {effectiveSettings.reader.contentWidth}px /{" "}
          {effectiveSettings.reader.fontSize}px · 编辑 {effectiveSettings.editor.contentWidth}px /{" "}
          {effectiveSettings.editor.fontSize}px
        </Text>
      </header>

      {commonError && (
        <Alert
          className="settings-alert"
          type="warning"
          showIcon
          message={commonError}
        />
      )}

      <Card className="settings-tabs-card">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as TabKey)}
          items={[
            {
              key: "user",
              label: "用户默认",
              children: (
                <div className="settings-tab-pane">
                  <div className="settings-pane-meta">
                    <Tag color="blue">跨工作空间生效</Tag>
                    {status.user === "loading" && <Text type="secondary">加载中...</Text>}
                  </div>
                  <div className="settings-form-grid">
                    <label className="settings-field">
                      {renderFieldLabel("阅读区域宽度", "reader.contentWidth")}
                      <InputNumber
                        min={MIN_CONTENT_WIDTH}
                        max={MAX_CONTENT_WIDTH}
                        value={userReaderWidth}
                        onChange={(value) =>
                          setUserReaderWidth(
                            Number(value) || userSettings.reader.contentWidth
                          )
                        }
                        addonAfter="px"
                      />
                    </label>
                    <label className="settings-field">
                      {renderFieldLabel("阅读字体大小", "reader.fontSize")}
                      <InputNumber
                        min={MIN_FONT_SIZE}
                        max={MAX_FONT_SIZE}
                        value={userReaderFontSize}
                        onChange={(value) =>
                          setUserReaderFontSize(
                            Number(value) || userSettings.reader.fontSize
                          )
                        }
                        addonAfter="px"
                      />
                    </label>
                    <label className="settings-field">
                      {renderFieldLabel("编辑区域宽度", "editor.contentWidth")}
                      <InputNumber
                        min={MIN_CONTENT_WIDTH}
                        max={MAX_CONTENT_WIDTH}
                        value={userEditorWidth}
                        onChange={(value) =>
                          setUserEditorWidth(
                            Number(value) || userSettings.editor.contentWidth
                          )
                        }
                        addonAfter="px"
                      />
                    </label>
                    <label className="settings-field">
                      {renderFieldLabel("编辑字体大小", "editor.fontSize")}
                      <InputNumber
                        min={MIN_FONT_SIZE}
                        max={MAX_FONT_SIZE}
                        value={userEditorFontSize}
                        onChange={(value) =>
                          setUserEditorFontSize(
                            Number(value) || userSettings.editor.fontSize
                          )
                        }
                        addonAfter="px"
                      />
                    </label>
                  </div>
                  <Divider />
                  <div className="settings-form-grid">
                    <label className="settings-field settings-field-inline">
                      {renderFieldLabel("紧凑列表间距", "advanced.compactList")}
                      <Switch checked={userCompactList} onChange={setUserCompactList} />
                    </label>
                    <label className="settings-field">
                      {renderFieldLabel("代码字体", "advanced.codeFontFamily")}
                      <Input
                        value={userCodeFontFamily}
                        onChange={(event) => setUserCodeFontFamily(event.target.value)}
                        placeholder='SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace'
                      />
                    </label>
                  </div>
                  <Space>
                    <Button
                      type="primary"
                      loading={status.saveUser === "loading"}
                      onClick={() => void saveUser()}
                    >
                      保存用户偏好
                    </Button>
                    <Text type="secondary">建议：宽度 800，字号 16</Text>
                  </Space>
                </div>
              ),
            },
            {
              key: "workspace",
              label: "工作空间覆盖",
              children: (
                <div className="settings-tab-pane">
                  {!workspaceId ? (
                    <Alert type="info" showIcon message="当前未选择工作空间，无法配置覆盖项" />
                  ) : (
                    <>
                      <div className="settings-pane-meta">
                        <Tag color="gold">{workspaceName || workspaceId}</Tag>
                        <label className="settings-field settings-field-inline settings-inline-toggle">
                          <span>启用覆盖</span>
                          <Switch
                            checked={workspaceEnabled}
                            onChange={setWorkspaceEnabled}
                          />
                        </label>
                      </div>
                      <div className="settings-form-grid">
                        <label className="settings-field">
                          {renderFieldLabel("阅读区域宽度", "reader.contentWidth")}
                          <InputNumber
                            min={MIN_CONTENT_WIDTH}
                            max={MAX_CONTENT_WIDTH}
                            value={workspaceReaderWidth}
                            disabled={!workspaceEnabled}
                            onChange={(value) =>
                              setWorkspaceReaderWidth(
                                Number(value) || workspaceEffective.reader.contentWidth
                              )
                            }
                            addonAfter="px"
                          />
                        </label>
                        <label className="settings-field">
                          {renderFieldLabel("阅读字体大小", "reader.fontSize")}
                          <InputNumber
                            min={MIN_FONT_SIZE}
                            max={MAX_FONT_SIZE}
                            value={workspaceReaderFontSize}
                            disabled={!workspaceEnabled}
                            onChange={(value) =>
                              setWorkspaceReaderFontSize(
                                Number(value) || workspaceEffective.reader.fontSize
                              )
                            }
                            addonAfter="px"
                          />
                        </label>
                        <label className="settings-field">
                          {renderFieldLabel("编辑区域宽度", "editor.contentWidth")}
                          <InputNumber
                            min={MIN_CONTENT_WIDTH}
                            max={MAX_CONTENT_WIDTH}
                            value={workspaceEditorWidth}
                            disabled={!workspaceEnabled}
                            onChange={(value) =>
                              setWorkspaceEditorWidth(
                                Number(value) || workspaceEffective.editor.contentWidth
                              )
                            }
                            addonAfter="px"
                          />
                        </label>
                        <label className="settings-field">
                          {renderFieldLabel("编辑字体大小", "editor.fontSize")}
                          <InputNumber
                            min={MIN_FONT_SIZE}
                            max={MAX_FONT_SIZE}
                            value={workspaceEditorFontSize}
                            disabled={!workspaceEnabled}
                            onChange={(value) =>
                              setWorkspaceEditorFontSize(
                                Number(value) || workspaceEffective.editor.fontSize
                              )
                            }
                            addonAfter="px"
                          />
                        </label>
                      </div>
                      <Divider />
                      <div className="settings-form-grid">
                        <label className="settings-field settings-field-inline">
                          {renderFieldLabel("紧凑列表间距", "advanced.compactList")}
                          <Switch
                            checked={workspaceCompactList}
                            disabled={!workspaceEnabled}
                            onChange={setWorkspaceCompactList}
                          />
                        </label>
                        <label className="settings-field">
                          {renderFieldLabel("代码字体", "advanced.codeFontFamily")}
                          <Input
                            value={workspaceCodeFontFamily}
                            disabled={!workspaceEnabled}
                            onChange={(event) =>
                              setWorkspaceCodeFontFamily(event.target.value)
                            }
                          />
                        </label>
                      </div>
                      <Space>
                        <Button
                          type="primary"
                          loading={status.saveWorkspace === "loading"}
                          onClick={() => void saveWorkspace()}
                        >
                          保存工作空间配置
                        </Button>
                        <Button
                          disabled={!workspaceEnabled}
                          onClick={() => {
                            setWorkspaceEnabled(false);
                            void (async () => {
                              const ok = await clearWorkspaceSettings(workspaceId);
                              if (ok) message.success("已清除工作空间覆盖配置");
                            })();
                          }}
                        >
                          清除覆盖
                        </Button>
                      </Space>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: "effective",
              label: "当前生效",
              children: (
                <div className="settings-tab-pane">
                  <div className="settings-effective-grid">
                    <div className="settings-effective-item">
                      {renderFieldLabel("阅读宽度", "reader.contentWidth")}
                      <strong>{effectiveSettings.reader.contentWidth}px</strong>
                    </div>
                    <div className="settings-effective-item">
                      {renderFieldLabel("阅读字号", "reader.fontSize")}
                      <strong>{effectiveSettings.reader.fontSize}px</strong>
                    </div>
                    <div className="settings-effective-item">
                      {renderFieldLabel("编辑宽度", "editor.contentWidth")}
                      <strong>{effectiveSettings.editor.contentWidth}px</strong>
                    </div>
                    <div className="settings-effective-item">
                      {renderFieldLabel("编辑字号", "editor.fontSize")}
                      <strong>{effectiveSettings.editor.fontSize}px</strong>
                    </div>
                    <div className="settings-effective-item">
                      {renderFieldLabel("列表间距", "advanced.compactList")}
                      <strong>{effectiveSettings.advanced.compactList ? "紧凑" : "标准"}</strong>
                    </div>
                    <div className="settings-effective-item">
                      {renderFieldLabel("代码字体", "advanced.codeFontFamily")}
                      <strong className="settings-font-preview">
                        {effectiveSettings.advanced.codeFontFamily}
                      </strong>
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
