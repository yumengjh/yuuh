export type PreferenceWidth = number;

export type PreferenceSettings = {
  reader: {
    contentWidth: PreferenceWidth;
    fontSize: number;
  };
  editor: {
    contentWidth: PreferenceWidth;
    fontSize: number;
  };
  advanced: {
    compactList: boolean;
    codeFontFamily: string;
  };
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

export const DEFAULT_CODE_FONT_FAMILY =
  'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace';

export const DEFAULT_PREFERENCE_SETTINGS: PreferenceSettings = {
  reader: {
    contentWidth: 800,
    fontSize: 16,
  },
  editor: {
    contentWidth: 800,
    fontSize: 16,
  },
  advanced: {
    compactList: true,
    codeFontFamily: DEFAULT_CODE_FONT_FAMILY,
  },
};

export const MIN_CONTENT_WIDTH = 680;
export const MAX_CONTENT_WIDTH = 1200;
export const MIN_FONT_SIZE = 13;
export const MAX_FONT_SIZE = 22;
