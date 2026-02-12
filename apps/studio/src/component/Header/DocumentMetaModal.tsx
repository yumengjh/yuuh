import { useEffect, useMemo, useState } from "react";
import { Form, Input, message, Modal, Select } from "antd";
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

const normalizeOptionalText = (value?: string): string | null => {
  const next = (value || "").trim();
  return next ? next : null;
};

const normalizeTags = (tags?: string[]): string[] => {
  return Array.from(new Set((tags || []).filter((item) => typeof item === "string" && item.trim()))).sort();
};

export default function DocumentMetaModal(props: DocumentMetaModalProps) {
  const { open, onClose, currentDoc, fallbackDocId, workspaceId } = props;
  const updateDocMeta = useSessionStore((state) => state.updateDocMeta);
  const loadWorkspaceTags = useSessionStore((state) => state.loadWorkspaceTags);

  const [form] = Form.useForm<DocMetaFormValues>();
  const [saving, setSaving] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagOptions, setTagOptions] = useState<WorkspaceTag[]>([]);

  const targetDocId = useMemo(() => currentDoc?.docId || fallbackDocId || "", [currentDoc?.docId, fallbackDocId]);

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

    const targetWorkspaceId = currentDoc?.workspaceId || workspaceId || null;
    if (!targetWorkspaceId) {
      setTagOptions([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setTagLoading(true);
      try {
        const tags = await loadWorkspaceTags(targetWorkspaceId);
        if (!cancelled) {
          setTagOptions(tags);
        }
      } finally {
        if (!cancelled) {
          setTagLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [currentDoc?.workspaceId, loadWorkspaceTags, open, workspaceId]);

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

        <Form.Item label="封面地址" name="cover" rules={[{ max: 500, message: "封面地址长度不能超过 500" }]}>
          <Input placeholder="https://example.com/cover.jpg" />
        </Form.Item>

        <Form.Item label="分类" name="category" rules={[{ max: 50, message: "分类长度不能超过 50" }]}>
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
            placeholder={tagLoading ? "正在加载标签..." : "请选择标签"}
            options={tagOptions.map((item) => ({
              label: item.name,
              value: item.tagId,
            }))}
            notFoundContent={tagLoading ? "正在加载..." : "当前工作空间暂无标签"}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
