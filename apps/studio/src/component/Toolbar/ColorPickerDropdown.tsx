import { BgColorsOutlined } from "@ant-design/icons";
import { ColorPicker, Divider } from "antd";
import { gradientColors, solidColors } from "./toolbarData";

type ColorPickerDropdownProps = {
  currentColor: string;
  onSelect: (color: string) => void;
  onGradientSelect: (gradientId: string) => void;
};

export function ColorPickerDropdown({
  currentColor,
  onSelect,
  onGradientSelect,
}: ColorPickerDropdownProps) {
  return (
    <div className="color-picker-dropdown">
      <div className="color-picker-section">
        <div className="color-picker-header">
          <span>默认色板</span>
        </div>
        <div className="color-grid">
          {solidColors.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="color-grid-row">
              {row.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${currentColor === color ? "selected" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => onSelect(color)}
                  title={color}
                >
                  {currentColor === color ? <span className="color-checkmark">✓</span> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="color-picker-section">
        <div className="color-picker-header">
          <span>渐变色</span>
        </div>
        <div className="gradient-grid">
          {gradientColors.map((gradient) => (
            <button
              key={gradient.id}
              type="button"
              className="gradient-swatch"
              style={{
                background: `linear-gradient(to right, ${gradient.colors[0]}, ${gradient.colors[1]})`,
              }}
              onClick={() => onGradientSelect(gradient.id)}
            />
          ))}
        </div>
      </div>

      <div className="color-picker-section">
        <div className="color-picker-header">
          <span>最近使用的自定义颜色</span>
        </div>
        <div className="color-picker-empty">暂无</div>
      </div>

      <Divider style={{ margin: "6px 0" }} />

      <div className="color-picker-section">
        <div className="color-picker-header-advanced">
          <div className="color-picker-header">
            <BgColorsOutlined style={{ fontSize: "12px" }} />
            <span>更多颜色</span>
          </div>
          <div className="color-picker-advanced">
            <ColorPicker
              value={currentColor}
              onChange={(color) => onSelect(color.toHexString())}
              showText
              size="small"
              getPopupContainer={(triggerNode) => {
                const dropdown = triggerNode.closest(".ant-dropdown") as HTMLElement | null;
                return dropdown ?? document.body;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
