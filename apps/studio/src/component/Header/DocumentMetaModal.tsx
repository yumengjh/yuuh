import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Input, message, Modal, Select, Typography } from "antd";
import { apiV1 } from "../../api_v1";
import type { DocumentMeta, Tag as WorkspaceTag, UpdateDocumentPayload } from "../../api_v1";
import { useSessionStore } from "../../store";

type DocMetaFormValues = {
  title: string;
  icon?: string;
  cover?: string;
  category?: string;
  visibility?: string;
  tags?: string[];
};

type DocumentMetaModalProps = {
  open: boolean;
  onClose: () => void;
  currentDoc: DocumentMeta | null;
  fallbackDocId?: string | null;
  workspaceId?: string | null;
};

type TagActionLoadingState = {
  create: boolean;
  updateId: string | null;
  deleteId: string | null;
};

const HEX_COLOR_REGEXP = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const normalizeOptionalText = (value?: string): string | null => {
  const next = (value || "").trim();
  return next ? next : null;
};

const normalizeTagName = (value?: string): string => {
  return (value || "").trim();
};

const normalizeTagColor = (value?: string): string => {
  const next = (value || "").trim();
  if (!next) return "";
  if (!HEX_COLOR_REGEXP.test(next)) {
    throw new Error("颜色格式应为 #RGB 或 #RRGGBB");
  }
  return next;
};

const normalizeTags = (tags?: string[]): string[] => {
  return Array.from(
    new Set((tags || []).filter((item) => typeof item === "string" && item.trim())),
  ).sort();
};

const toTagIdList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error || typeof error !== "object") return fallback;
  const errObj = error as { message?: unknown };

  if (typeof errObj.message === "string" && errObj.message.trim()) {
    return errObj.message;
  }

  if (Array.isArray(errObj.message)) {
    const joined = errObj.message.filter((item) => typeof item === "string").join("；");
    if (joined.trim()) return joined;
  }

  return fallback;
};

const isDropdownInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input,textarea,button,.ant-input,.ant-btn,.ant-checkbox,.ant-checkbox-wrapper"),
  );
};

export default function DocumentMetaModal(props: DocumentMetaModalProps) {
  const { open, onClose, currentDoc, fallbackDocId, workspaceId } = props;
  const updateDocMeta = useSessionStore((state) => state.updateDocMeta);

  const [form] = Form.useForm<DocMetaFormValues>();
  const [saving, setSaving] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagOptions, setTagOptions] = useState<WorkspaceTag[]>([]);
  const [tagActionLoading, setTagActionLoading] = useState<TagActionLoadingState>({
    create: false,
    updateId: null,
    deleteId: null,
  });
  const [creatingTagName, setCreatingTagName] = useState("");
  const [creatingTagColor, setCreatingTagColor] = useState("");
  const [tagKeyword, setTagKeyword] = useState("");
  const [inlineEditingTagId, setInlineEditingTagId] = useState<string | null>(null);
  const [inlineEditingName, setInlineEditingName] = useState("");
  const [inlineEditingColor, setInlineEditingColor] = useState("");
  const selectedTagValue = Form.useWatch("tags", form);
  const inlineEditDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineEditingTagIdRef = useRef<string | null>(null);

  const selectedTagIds = useMemo(() => {
    return toTagIdList(selectedTagValue);
  }, [selectedTagValue]);

  useEffect(() => {
    inlineEditingTagIdRef.current = inlineEditingTagId;
  }, [inlineEditingTagId]);

  const targetDocId = useMemo(
    () => currentDoc?.docId || fallbackDocId || "",
    [currentDoc?.docId, fallbackDocId],
  );
  const targetWorkspaceId = useMemo(
    () => currentDoc?.workspaceId || workspaceId || "",
    [currentDoc?.workspaceId, workspaceId],
  );

  const clearInlineEditDebounce = useCallback(() => {
    if (!inlineEditDebounceRef.current) return;
    clearTimeout(inlineEditDebounceRef.current);
    inlineEditDebounceRef.current = null;
  }, []);

  const resetInlineEditState = useCallback(() => {
    clearInlineEditDebounce();
    setInlineEditingTagId(null);
    setInlineEditingName("");
    setInlineEditingColor("");
  }, [clearInlineEditDebounce]);

  const refreshWorkspaceTags = useCallback(
    async (silent = false): Promise<WorkspaceTag[]> => {
      if (!targetWorkspaceId) {
        setTagOptions([]);
        return [];
      }

      setTagLoading(true);
      try {
        const result = await apiV1.tags.listTags({
          workspaceId: targetWorkspaceId,
          page: 1,
          pageSize: 100,
        });
        const items = Array.isArray(result?.items) ? result.items : [];
        setTagOptions(items);
        return items;
      } catch (error) {
        if (!silent) {
          message.error(getErrorMessage(error, "加载标签失败"));
        }
        return [];
      } finally {
        setTagLoading(false);
      }
    },
    [targetWorkspaceId],
  );

  const filteredTagOptions = useMemo(() => {
    const keyword = tagKeyword.trim().toLowerCase();
    if (!keyword) return tagOptions;
    return tagOptions.filter((tag) => (tag.name || "").toLowerCase().includes(keyword));
  }, [tagKeyword, tagOptions]);

  const setTagSelected = useCallback(
    (tagId: string, checked: boolean) => {
      const currentTags = toTagIdList(form.getFieldValue("tags"));
      const exists = currentTags.includes(tagId);

      if (checked && !exists) {
        form.setFieldValue("tags", [...currentTags, tagId]);
        return;
      }

      if (!checked && exists) {
        form.setFieldValue(
          "tags",
          currentTags.filter((item) => item !== tagId),
        );
      }
    },
    [form],
  );

  useEffect(() => {
    if (!open || !currentDoc) return;

    form.setFieldsValue({
      title: currentDoc.title || "",
      icon: currentDoc.icon || "",
      cover: currentDoc.cover || "",
      category: currentDoc.category || "",
      visibility: currentDoc.visibility || "private",
      tags: currentDoc.tags || [],
    });
  }, [currentDoc, form, open]);

  useEffect(() => {
    if (!open) return;
    void refreshWorkspaceTags();
  }, [open, refreshWorkspaceTags]);

  useEffect(() => {
    if (open) return;
    setCreatingTagName("");
    setCreatingTagColor("");
    setTagKeyword("");
    setTagActionLoading({
      create: false,
      updateId: null,
      deleteId: null,
    });
    resetInlineEditState();
  }, [open, resetInlineEditState]);

  useEffect(() => {
    return () => {
      clearInlineEditDebounce();
    };
  }, [clearInlineEditDebounce]);

  const onCreateTag = async () => {
    if (!targetWorkspaceId) {
      message.warning("请先选择工作空间后再管理标签");
      return;
    }

    const name = normalizeTagName(creatingTagName);
    if (!name) {
      message.warning("请输入标签名称");
      return;
    }

    let color = "";
    try {
      color = normalizeTagColor(creatingTagColor);
    } catch (error) {
      message.warning(getErrorMessage(error, "颜色格式不正确"));
      return;
    }

    setTagActionLoading((prev) => ({ ...prev, create: true }));
    try {
      const created = await apiV1.tags.createTag({
        workspaceId: targetWorkspaceId,
        name,
        ...(color ? { color } : {}),
      });
      setCreatingTagName("");
      setCreatingTagColor("");
      const currentTags = toTagIdList(form.getFieldValue("tags"));
      form.setFieldValue("tags", normalizeTags([...currentTags, created.tagId]));
      await refreshWorkspaceTags(true);
      message.success("标签创建成功");
    } catch (error) {
      message.error(getErrorMessage(error, "创建标签失败"));
    } finally {
      setTagActionLoading((prev) => ({ ...prev, create: false }));
    }
  };

  const onStartInlineEdit = (tag: WorkspaceTag) => {
    clearInlineEditDebounce();
    const previousTagId = inlineEditingTagIdRef.current;
    if (previousTagId && previousTagId !== tag.tagId) {
      void onCommitInlineEdit(previousTagId, inlineEditingName, inlineEditingColor);
    }
    setInlineEditingTagId(tag.tagId);
    setInlineEditingName(tag.name || "");
    setInlineEditingColor(tag.color || "");
  };

  const onCommitInlineEdit = useCallback(
    async (tagId: string, nextNameRaw: string, nextColorRaw: string) => {
      const currentTag = tagOptions.find((item) => item.tagId === tagId);
      if (!currentTag) {
        resetInlineEditState();
        return;
      }

      const nextName = normalizeTagName(nextNameRaw);
      if (!nextName) {
        message.warning("请输入标签名称");
        return;
      }

      let nextColor = "";
      try {
        nextColor = normalizeTagColor(nextColorRaw);
      } catch (error) {
        message.warning(getErrorMessage(error, "颜色格式不正确"));
        return;
      }

      const currentName = currentTag.name || "";
      const currentColor = currentTag.color || "";
      if (nextName === currentName && nextColor === currentColor) {
        if (inlineEditingTagIdRef.current === tagId) {
          resetInlineEditState();
        }
        return;
      }

      setTagActionLoading((prev) => ({ ...prev, updateId: tagId }));
      try {
        await apiV1.tags.updateTag(tagId, {
          name: nextName,
          ...(nextColor ? { color: nextColor } : {}),
        });
        await refreshWorkspaceTags(true);
        if (inlineEditingTagIdRef.current === tagId) {
          resetInlineEditState();
        }
      } catch (error) {
        message.error(getErrorMessage(error, "更新标签失败"));
      } finally {
        setTagActionLoading((prev) => ({ ...prev, updateId: null }));
      }
    },
    [refreshWorkspaceTags, resetInlineEditState, tagOptions],
  );

  const onScheduleInlineEditCommit = useCallback(
    (tagId: string, nextNameRaw: string, nextColorRaw: string) => {
      clearInlineEditDebounce();
      inlineEditDebounceRef.current = setTimeout(() => {
        void onCommitInlineEdit(tagId, nextNameRaw, nextColorRaw);
      }, 300);
    },
    [clearInlineEditDebounce, onCommitInlineEdit],
  );

  const onCancelInlineEdit = useCallback(() => {
    resetInlineEditState();
  }, [resetInlineEditState]);

  const onDeleteTag = (tag: WorkspaceTag) => {
    if (!targetWorkspaceId) {
      message.warning("请先选择工作空间后再管理标签");
      return;
    }

    Modal.confirm({
      title: "删除标签",
      content: `确定删除标签「${tag.name}」吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        setTagActionLoading((prev) => ({ ...prev, deleteId: tag.tagId }));
        try {
          await apiV1.tags.deleteTag(tag.tagId);
          const currentTags = toTagIdList(form.getFieldValue("tags"));
          if (currentTags.includes(tag.tagId)) {
            form.setFieldValue(
              "tags",
              currentTags.filter((item) => item !== tag.tagId),
            );
          }
          if (inlineEditingTagIdRef.current === tag.tagId) {
            resetInlineEditState();
          }
          await refreshWorkspaceTags(true);
          message.success("标签已删除");
        } catch (error) {
          message.error(getErrorMessage(error, "删除标签失败"));
        } finally {
          setTagActionLoading((prev) => ({ ...prev, deleteId: null }));
        }
      },
    });
  };

  const onSave = async () => {
    if (!targetDocId || !currentDoc) {
      message.warning("请先进入文档后再编辑文档信息");
      return;
    }

    let values: DocMetaFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const payload: UpdateDocumentPayload = {};

    const nextTitle = values.title.trim();
    if (nextTitle !== (currentDoc.title || "")) {
      payload.title = nextTitle;
    }

    const nextIcon = normalizeOptionalText(values.icon);
    const currentIcon = currentDoc.icon || null;
    if (nextIcon !== currentIcon) {
      payload.icon = nextIcon;
    }

    const nextCover = normalizeOptionalText(values.cover);
    const currentCover = currentDoc.cover || null;
    if (nextCover !== currentCover) {
      payload.cover = nextCover;
    }

    const nextCategory = normalizeOptionalText(values.category);
    const currentCategory = currentDoc.category || null;
    if (nextCategory !== currentCategory) {
      payload.category = nextCategory;
    }

    const nextVisibility = (values.visibility || "private").trim();
    const currentVisibility = (currentDoc.visibility || "private").trim();
    if (nextVisibility !== currentVisibility) {
      payload.visibility = nextVisibility;
    }

    const nextTags = normalizeTags(values.tags);
    const currentTags = normalizeTags(currentDoc.tags);
    if (nextTags.join("|") !== currentTags.join("|")) {
      payload.tags = nextTags;
    }

    if (Object.keys(payload).length === 0) {
      message.info("未检测到变更");
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updated = await updateDocMeta(targetDocId, payload);
      if (!updated) {
        const latestError = useSessionStore.getState().errors.doc;
        message.error(latestError || "更新文档信息失败");
        return;
      }
      message.success("文档信息已更新");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="编辑文档信息"
      open={open}
      onCancel={onClose}
      onOk={() => {
        void onSave();
      }}
      confirmLoading={saving}
      destroyOnClose
      width={640}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="标题"
          name="title"
          rules={[
            { required: true, message: "请输入标题" },
            { max: 255, message: "标题长度不能超过 255" },
          ]}
        >
          <Input placeholder="请输入文档标题" />
        </Form.Item>

        <Form.Item label="图标" name="icon" rules={[{ max: 10, message: "图标长度不能超过 10" }]}>
          <Input placeholder="例如：📘" />
        </Form.Item>

        <Form.Item
          label="封面地址"
          name="cover"
          rules={[{ max: 500, message: "封面地址长度不能超过 500" }]}
        >
          <Input placeholder="https://example.com/cover.jpg" />
        </Form.Item>

        <Form.Item
          label="分类"
          name="category"
          rules={[{ max: 50, message: "分类长度不能超过 50" }]}
        >
          <Input placeholder="如：技术文档" />
        </Form.Item>

        <Form.Item label="可见性" name="visibility">
          <Select
            options={[
              { label: "仅自己可见 (private)", value: "private" },
              { label: "工作空间可见 (workspace)", value: "workspace" },
              { label: "公开 (public)", value: "public" },
            ]}
          />
        </Form.Item>

        <Form.Item label="标签" name="tags">
          <Select
            mode="multiple"
            loading={tagLoading}
            allowClear
            showSearch={false}
            placeholder={tagLoading ? "正在加载标签..." : "请选择标签"}
            options={tagOptions.map((item) => ({
              label: item.name,
              value: item.tagId,
            }))}
            notFoundContent={tagLoading ? "正在加载..." : "当前工作空间暂无标签"}
            dropdownRender={() => {
              const isTagManageDisabled = !targetWorkspaceId;
              return (
                <div
                  className="doc-meta-tag-dropdown"
                  onMouseDown={(event) => {
                    if (isDropdownInteractiveTarget(event.target)) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  {isTagManageDisabled ? (
                    <Typography.Text type="secondary" className="doc-meta-tag-disabled">
                      请先选择工作空间后再管理标签
                    </Typography.Text>
                  ) : (
                    <>
                      <div className="doc-meta-tag-toolbar doc-meta-tag-toolbar-compact">
                        <Input
                          size="small"
                          className="doc-meta-tag-search"
                          placeholder="搜索标签"
                          value={tagKeyword}
                          allowClear
                          onChange={(event) => {
                            setTagKeyword(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                          }}
                        />

                        <Input
                          size="small"
                          className="doc-meta-tag-create-name"
                          placeholder="新标签名称"
                          value={creatingTagName}
                          maxLength={50}
                          onChange={(event) => {
                            setCreatingTagName(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                          }}
                        />
                        <Input
                          size="small"
                          className="doc-meta-tag-create-color"
                          placeholder="#1677ff (可选)"
                          value={creatingTagColor}
                          maxLength={7}
                          onChange={(event) => {
                            setCreatingTagColor(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                          }}
                        />
                        <Button
                          type="primary"
                          size="small"
                          loading={tagActionLoading.create}
                          onClick={() => {
                            void onCreateTag();
                          }}
                        >
                          新建
                        </Button>
                      </div>

                      <div className="doc-meta-tag-list">
                        {filteredTagOptions.length ? (
                          filteredTagOptions.map((tag) => {
                            const isEditing = inlineEditingTagId === tag.tagId;
                            const isDeleting = tagActionLoading.deleteId === tag.tagId;
                            const checked = selectedTagIds.includes(tag.tagId);

                            return (
                              <div
                                className={`doc-meta-tag-row ${checked ? "doc-meta-tag-row-active" : ""}`}
                                key={tag.tagId}
                              >
                                <div className="doc-meta-tag-row-main">
                                  <Checkbox
                                    checked={checked}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                    }}
                                    onChange={(event) => {
                                      setTagSelected(tag.tagId, event.target.checked);
                                    }}
                                  />
                                  <span
                                    className="doc-meta-tag-dot"
                                    style={{
                                      backgroundColor: tag.color || "#d9d9d9",
                                    }}
                                  />

                                  {isEditing ? (
                                    <div
                                      className="doc-meta-tag-inline-editor"
                                      onBlur={(event) => {
                                        const nextTarget = event.relatedTarget;
                                        if (
                                          nextTarget instanceof Node &&
                                          event.currentTarget.contains(nextTarget)
                                        ) {
                                          return;
                                        }
                                        onScheduleInlineEditCommit(
                                          tag.tagId,
                                          inlineEditingName,
                                          inlineEditingColor,
                                        );
                                      }}
                                    >
                                      <Input
                                        size="small"
                                        value={inlineEditingName}
                                        maxLength={50}
                                        autoFocus
                                        onChange={(event) => {
                                          setInlineEditingName(event.target.value);
                                        }}
                                        onKeyDown={(event) => {
                                          event.stopPropagation();
                                          if (event.key === "Escape") {
                                            event.preventDefault();
                                            onCancelInlineEdit();
                                            return;
                                          }
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            clearInlineEditDebounce();
                                            void onCommitInlineEdit(
                                              tag.tagId,
                                              inlineEditingName,
                                              inlineEditingColor,
                                            );
                                          }
                                        }}
                                      />
                                      <Input
                                        size="small"
                                        value={inlineEditingColor}
                                        maxLength={7}
                                        placeholder="#1677ff"
                                        className="doc-meta-tag-inline-color"
                                        onChange={(event) => {
                                          setInlineEditingColor(event.target.value);
                                        }}
                                        onKeyDown={(event) => {
                                          event.stopPropagation();
                                          if (event.key === "Escape") {
                                            event.preventDefault();
                                            onCancelInlineEdit();
                                            return;
                                          }
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            clearInlineEditDebounce();
                                            void onCommitInlineEdit(
                                              tag.tagId,
                                              inlineEditingName,
                                              inlineEditingColor,
                                            );
                                          }
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="doc-meta-tag-name-trigger"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onStartInlineEdit(tag);
                                      }}
                                    >
                                      <Typography.Text
                                        className="doc-meta-tag-name"
                                        ellipsis={{ tooltip: tag.name }}
                                      >
                                        {tag.name}
                                      </Typography.Text>
                                    </button>
                                  )}
                                </div>

                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  loading={isDeleting}
                                  icon={<DeleteOutlined />}
                                  className="doc-meta-tag-delete"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onDeleteTag(tag);
                                  }}
                                />
                              </div>
                            );
                          })
                        ) : (
                          <Typography.Text type="secondary" className="doc-meta-tag-empty">
                            {tagKeyword.trim() ? "未找到匹配标签" : "当前工作空间暂无标签"}
                          </Typography.Text>
                        )}
                      </div>
                      <div className="doc-meta-tag-hint">
                        <Typography.Text type="secondary">
                          点击标签文字即可编辑，失焦自动保存（300ms 防抖）
                        </Typography.Text>
                      </div>
                    </>
                  )}
                </div>
              );
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
