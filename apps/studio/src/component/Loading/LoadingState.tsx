import { Spin } from "antd";

type LoadingStateProps = {
  tip?: string;
  minHeight?: number | string;
};

export default function LoadingState({
  tip = "正在加载...",
  minHeight = 240,
}: LoadingStateProps) {
  return (
    <div
      style={{
        width: "100%",
        minHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Spin tip={tip} />
    </div>
  );
}
