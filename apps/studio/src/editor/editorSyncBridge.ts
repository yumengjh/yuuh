export type EditorSyncBridge = {
  flushAutoSync: () => Promise<void>;
};

let currentEditorSyncBridge: EditorSyncBridge | null = null;

export const registerEditorSyncBridge = (bridge: EditorSyncBridge) => {
  currentEditorSyncBridge = bridge;
};

export const unregisterEditorSyncBridge = () => {
  currentEditorSyncBridge = null;
};

export const getEditorSyncBridge = (): EditorSyncBridge | null => {
  return currentEditorSyncBridge;
};
