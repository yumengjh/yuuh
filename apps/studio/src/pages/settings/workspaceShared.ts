import type { WorkspaceMember } from "../../api_v1";

export const MEMBER_ROLE_OPTIONS = [
  { label: "管理员（admin）", value: "admin" },
  { label: "编辑者（editor）", value: "editor" },
  { label: "只读（viewer）", value: "viewer" },
];

export const getErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== "object") return "请求失败，请稍后重试";
  const errObj = error as { message?: unknown };
  if (typeof errObj.message === "string" && errObj.message.trim()) return errObj.message;
  if (Array.isArray(errObj.message)) {
    const joined = errObj.message.filter((item) => typeof item === "string").join("；");
    if (joined.trim()) return joined;
  }
  return "请求失败，请稍后重试";
};

export type MemberColumnsRecord = WorkspaceMember;

