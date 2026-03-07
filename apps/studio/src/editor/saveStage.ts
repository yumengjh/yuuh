export type SaveStage = "idle" | "dirty" | "saving" | "committing" | "synced" | "error";

export const SAVE_STAGE_TEXT_MAP: Record<SaveStage, string> = {
  idle: "就绪",
  dirty: "有未同步修改",
  saving: "保存中…",
  committing: "提交中…",
  synced: "已同步",
  error: "保存失败",
};
