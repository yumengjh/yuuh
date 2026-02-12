import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import "./style.css";

type Point = { x: number; y: number };

const BALL_SIZE = 64;
const PADDING = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function FloatingBall() {
  const ballRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const dragMovedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });

  const viewport = useMemo(() => {
    if (typeof window === "undefined") {
      return { width: 1280, height: 720 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  }, []);

  useEffect(() => {
    const width = typeof window !== "undefined" ? window.innerWidth : viewport.width;
    const height = typeof window !== "undefined" ? window.innerHeight : viewport.height;
    setPosition({ x: width - BALL_SIZE - PADDING, y: height - BALL_SIZE - 96 });
  }, [viewport.height, viewport.width]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setPosition((prev) => ({
        x: clamp(prev.x, PADDING, window.innerWidth - BALL_SIZE - PADDING),
        y: clamp(prev.y, PADDING, window.innerHeight - BALL_SIZE - PADDING),
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const stopDragging = () => {
    if (pointerIdRef.current !== null && ballRef.current) {
      try {
        ballRef.current.releasePointerCapture(pointerIdRef.current);
      } catch (error) {
        // 忽略释放失败
      }
    }
    pointerIdRef.current = null;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;

    const rect = ballRef.current?.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
    dragMovedRef.current = false;
    pointerIdRef.current = event.pointerId;

    ballRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;

    const nextX = clamp(
      event.clientX - dragOffsetRef.current.x,
      PADDING,
      (typeof window !== "undefined" ? window.innerWidth : viewport.width) - BALL_SIZE - PADDING,
    );
    const nextY = clamp(
      event.clientY - dragOffsetRef.current.y,
      PADDING,
      (typeof window !== "undefined" ? window.innerHeight : viewport.height) - BALL_SIZE - PADDING,
    );

    setPosition({ x: nextX, y: nextY });
    dragMovedRef.current = true;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;

    const moved = dragMovedRef.current;
    stopDragging();
    dragMovedRef.current = false;

    if (!moved) {
      setExpanded((prev) => !prev);
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    stopDragging();
    dragMovedRef.current = false;
  };

  if (!visible) return null;

  return createPortal(
    <div
      className="floating-ball"
      ref={ballRef}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      role="button"
      aria-label="测试悬浮球"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="floating-ball__core">
        <div className="floating-ball__dot" />
        <span className="floating-ball__text">TEST</span>
      </div>

      {expanded && (
        <div className="floating-ball__panel">
          <div className="floating-ball__panel-header">
            <span>调试面板</span>
            <div className="floating-ball__panel-actions">
              <button
                type="button"
                className="floating-ball__action"
                onClick={() => setExpanded(false)}
              >
                收起
              </button>
              <button
                type="button"
                className="floating-ball__action floating-ball__action--danger"
                onClick={() => setVisible(false)}
              >
                关闭
              </button>
            </div>
          </div>
          <div className="floating-ball__panel-body">
            <p className="floating-ball__tip">后续可在此插入变量/状态预览。</p>
            <p className="floating-ball__tip">当前仅提供拖拽、展开与关闭能力。</p>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

export default FloatingBall;
