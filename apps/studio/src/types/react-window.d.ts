declare module "react-window" {
  import type { ComponentType, CSSProperties } from "react";
  import type * as React from "react";

  export type ListOnItemsRenderedProps = {
    overscanStartIndex: number;
    overscanStopIndex: number;
    visibleStartIndex: number;
    visibleStopIndex: number;
  };

  export type ListChildComponentProps<T = unknown> = {
    index: number;
    style: CSSProperties;
    data: T;
    isScrolling?: boolean;
  };

  export type VariableSizeListProps<T = unknown> = {
    width: number | string;
    height: number;
    itemCount: number;
    itemSize: (index: number) => number;
    itemData: T;
    overscanCount?: number;
    onItemsRendered?: (props: ListOnItemsRenderedProps) => void;
    children: ComponentType<ListChildComponentProps<T>>;
  };

  export class VariableSizeList<T = unknown> extends React.Component<VariableSizeListProps<T>> {
    resetAfterIndex(index: number, shouldForceUpdate?: boolean): void;
  }
}
