import type { ReactNode } from "react";
import { useMemo } from "react";
import type { MenuProps } from "antd";
import { Dropdown, Input, Modal, Space, Tooltip } from "antd";
import type { Editor } from "@tiptap/react";
import {
  BgColorsOutlined,
  BoldOutlined,
  CheckSquareOutlined,
  ClearOutlined,
  CodeOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { useDocumentEngineStore } from "../../editor/useDocumentEngineStore";
import { ColorPickerDropdown } from "./ColorPickerDropdown";
import {
  codeLanguageItems,
  fontSizeItems,
  orderedListTypeItems,
  titleLevelItems,
} from "./toolbarData";
import { useToolbarActions } from "./useToolbarActions";
import { useToolbarEditorState } from "./useToolbarEditorState";
import "./style.css";

type ToolbarItem = {
  id: string;
  label: string;
  content: ReactNode;
  type?: "dropdown" | "color-picker";
};

function renderCheckmark(active: boolean) {
  return active ? "✓" : "";
}

export default function Toolbar() {
  const { editor } = useDocumentEngineStore();
  const tiptap = editor as Editor | null;

  const {
    alignItems,
    currentAlignment,
    currentCodeLanguage,
    currentFontSize,
    currentHeadingKey,
    currentHeadingLabel,
    currentOrderedListType,
    editorReady,
    isActive,
  } = useToolbarEditorState(tiptap);

  const {
    applyLink,
    closeLinkModal,
    handleBgColorSelect,
    handleColorSelect,
    handleDropdownSelect,
    handleGradientSelect,
    handleToolbarClick,
    hideTooltip,
    linkModalOpen,
    linkValue,
    selectedBgColor,
    selectedColor,
    setLinkValue,
    setTooltipVisible,
    tooltipOpen,
  } = useToolbarActions(tiptap);

  const currentCodeLanguageLabel =
    codeLanguageItems.find((item) => item.key === currentCodeLanguage)?.label ?? currentCodeLanguage;

  const toolbarGroups = useMemo<ToolbarItem[][]>(
    () => [
      [
        { id: "undo", label: "撤销", content: <UndoOutlined /> },
        { id: "redo", label: "重做", content: <RedoOutlined /> },
        { id: "clearFormat", label: "清除格式", content: <ClearOutlined /> },
      ],
      [{ id: "cursor", label: "光标", content: <EditOutlined /> }],
      [
        {
          id: "text-mode",
          label: "标题",
          content: <span className="text-label heading-text">{currentHeadingLabel}</span>,
          type: "dropdown",
        },
        {
          id: "font-size",
          label: "字号",
          content: <span className="text-label">{currentFontSize}</span>,
          type: "dropdown",
        },
      ],
      [
        { id: "bold", label: "加粗", content: <BoldOutlined /> },
        { id: "italic", label: "斜体", content: <ItalicOutlined /> },
        { id: "strike", label: "删除线", content: <StrikethroughOutlined /> },
        { id: "underline", label: "下划线", content: <UnderlineOutlined /> },
      ],
      [
        {
          id: "text-color",
          label: "文字颜色",
          content: (
            <span className="dropdown-icon-text">
              <EditOutlined />
              <span className="text-color-icon" style={{ color: selectedColor }}>
                A
              </span>
            </span>
          ),
          type: "color-picker",
        },
        {
          id: "bg-color",
          label: "背景颜色",
          content: (
            <span className="dropdown-icon-text">
              <BgColorsOutlined />
              <span className="bg-color-icon" style={{ color: selectedBgColor }}>
                A
              </span>
            </span>
          ),
          type: "color-picker",
        },
      ],
      [
        {
          id: "text-align",
          label: "对齐方式",
          content: <span className="dropdown-icon-text">{currentAlignment.icon}</span>,
          type: "dropdown",
        },
      ],
      [
        { id: "bullet-list", label: "无序列表", content: <UnorderedListOutlined /> },
        {
          id: "ordered-list",
          label: "有序列表",
          content: (
            <span className="dropdown-icon-text">
              <OrderedListOutlined />
              <span className="text-label">
                {orderedListTypeItems.find((item) => item.key === currentOrderedListType)
                  ?.description ?? "数字"}
              </span>
            </span>
          ),
          type: "dropdown",
        },
        { id: "check-list", label: "待办列表", content: <CheckSquareOutlined /> },
      ],
      [
        { id: "blockquote", label: "引用", content: <FileTextOutlined /> },
        { id: "code-block", label: "代码块", content: <CodeOutlined /> },
        {
          id: "code-language",
          label: "代码语言",
          content: <span className="text-label">{currentCodeLanguageLabel}</span>,
          type: "dropdown",
        },
        { id: "link", label: "链接", content: <LinkOutlined /> },
      ],
    ],
    [
      currentAlignment.icon,
      currentCodeLanguageLabel,
      currentFontSize,
      currentHeadingLabel,
      currentOrderedListType,
      selectedBgColor,
      selectedColor,
    ],
  );

  const menuItemsById = useMemo<Record<string, NonNullable<MenuProps["items"]>>>(() => {
    return {
      "text-mode": titleLevelItems.map((item) => {
        const active = item.key === currentHeadingKey;
        return {
          key: item.key,
          label: (
            <div className={active ? "heading-menu-item is-active" : "heading-menu-item"}>
              <div className="heading-menu-left">
                <span className="heading-menu-check">{renderCheckmark(active)}</span>
                <span
                  className={
                    item.key === "0"
                      ? "heading-menu-label is-body"
                      : `heading-menu-label is-${item.size}`
                  }
                >
                  {item.label}
                </span>
              </div>
              <div className="heading-menu-shortcut">{item.shortcut}</div>
            </div>
          ),
        };
      }),
      "font-size": fontSizeItems.map((item) => {
        const active = item.key === currentFontSize;
        return {
          key: item.key,
          label: (
            <div className="font-size-menu-item">
              <span className="font-size-menu-check">{renderCheckmark(active)}</span>
              <span className="font-size-menu-label">{item.label}</span>
            </div>
          ),
        };
      }),
      "ordered-list": orderedListTypeItems.map((item) => ({
        key: item.key,
        label: `${item.label} ${item.description}`,
        ...(item.key === currentOrderedListType
          ? { icon: <span style={{ color: "#1890ff" }}>✓</span> }
          : {}),
      })),
      "code-language": codeLanguageItems.map((item) => ({
        key: item.key,
        label: item.label,
        ...(item.key === currentCodeLanguage
          ? { icon: <span style={{ color: "#1890ff" }}>✓</span> }
          : {}),
      })),
      "text-align": alignItems.map((item) => ({
        key: item.key,
        label: item.icon,
        ...(item.key === currentAlignment.key
          ? { icon: <span style={{ color: "#1890ff" }}>✓</span> }
          : {}),
      })),
    };
  }, [
    alignItems,
    currentAlignment.key,
    currentCodeLanguage,
    currentFontSize,
    currentHeadingKey,
    currentOrderedListType,
  ]);

  return (
    <div className="toolbar">
      {toolbarGroups.map((group, index) => (
        <div className="toolbar-group" key={`toolbar-group-${index}`}>
          {group.map((item) => {
            if (item.type === "dropdown") {
              return (
                <Tooltip
                  key={item.id}
                  placement="bottom"
                  title={item.label}
                  trigger="hover"
                  mouseEnterDelay={0.5}
                  open={tooltipOpen[item.id]}
                  onOpenChange={(open) => setTooltipVisible(item.id, open)}
                >
                  <Dropdown
                    overlayClassName={item.id === "text-align" ? "align-dropdown" : undefined}
                    dropdownRender={
                      item.id === "text-align"
                        ? () => (
                            <div className="align-menu-panel">
                              <div className="align-menu-row">
                                {alignItems.map((alignItem) => {
                                  const active = alignItem.key === currentAlignment.key;
                                  return (
                                    <Tooltip
                                      key={alignItem.key}
                                      title={alignItem.label}
                                      placement="bottom"
                                    >
                                      <button
                                        type="button"
                                        className={
                                          active ? "align-menu-btn is-active" : "align-menu-btn"
                                        }
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleDropdownSelect("text-align", alignItem.key);
                                        }}
                                      >
                                        {alignItem.icon}
                                      </button>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </div>
                          )
                        : undefined
                    }
                    menu={{
                      items: menuItemsById[item.id],
                      onClick: ({ key }) => {
                        hideTooltip(item.id);
                        handleDropdownSelect(item.id, key);
                      },
                    }}
                    trigger={["click"]}
                    disabled={!editorReady}
                    onOpenChange={(open) => {
                      if (open) {
                        hideTooltip(item.id);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="dropdown-trigger-button"
                      disabled={!editorReady}
                      aria-label={item.label}
                      onClick={() => hideTooltip(item.id)}
                    >
                      <span className="dropdown-text">{item.content}</span>
                      <span className="dropdown-caret">
                        <DownOutlined style={{ fontSize: "12px", color: "#666666" }} />
                      </span>
                    </button>
                  </Dropdown>
                </Tooltip>
              );
            }

            if (item.type === "color-picker") {
              const isBgColor = item.id === "bg-color";
              const currentColor = isBgColor ? selectedBgColor : selectedColor;
              const handleSelect = isBgColor ? handleBgColorSelect : handleColorSelect;

              return (
                <Tooltip
                  key={item.id}
                  placement="bottom"
                  title={item.label}
                  trigger="hover"
                  mouseEnterDelay={0.5}
                  open={tooltipOpen[item.id]}
                  onOpenChange={(open) => setTooltipVisible(item.id, open)}
                >
                  <Dropdown
                    placement="bottomLeft"
                    align={{ offset: [0, 4] }}
                    dropdownRender={() => (
                      <ColorPickerDropdown
                        currentColor={currentColor}
                        onSelect={handleSelect}
                        onGradientSelect={handleGradientSelect}
                      />
                    )}
                    trigger={["click"]}
                    disabled={!editorReady}
                    onOpenChange={(open) => {
                      if (open) {
                        hideTooltip(item.id);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="dropdown-trigger-button"
                      disabled={!editorReady}
                      aria-label={item.label}
                      onClick={() => hideTooltip(item.id)}
                    >
                      <span className="dropdown-text">{item.content}</span>
                      <span className="dropdown-caret">
                        <DownOutlined style={{ fontSize: "12px", color: "#666666" }} />
                      </span>
                    </button>
                  </Dropdown>
                </Tooltip>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                className={`toolbar-button ${isActive(item.id) ? "active" : ""}`}
                disabled={!editorReady}
                aria-label={item.label}
                onClick={() => handleToolbarClick(item.id)}
              >
                <Tooltip placement="bottom" title={item.label}>
                  <span className="toolbar-content">{item.content}</span>
                </Tooltip>
              </button>
            );
          })}
        </div>
      ))}

      <Modal
        title="插入链接"
        open={linkModalOpen}
        onOk={applyLink}
        onCancel={closeLinkModal}
        okText="应用"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://example.com"
            allowClear
          />
        </Space>
      </Modal>
    </div>
  );
}
