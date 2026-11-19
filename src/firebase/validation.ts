import { CLASS_LIST, DEFAULT_THEME_COLORS, EXTERNAL_VISITOR_CLASS, type ThemeColors } from '../types';

export const LIMITS = {
  NAME_MAX: 120,
  CLASS_MAX: 20,
  CODE_MAX: 32,
  NOTE_MAX: 300,
  SUBJECT_NOTE_MAX: 240,
  RECORDER_MAX: 120,
  ROOM_MAX: 32,
  STATION_MAX: 16,
  TIME_MAX: 10,
  ID_MAX: 128,
  SCHOOL_NAME_MAX: 160,
  ACADEMIC_YEAR_MAX: 10,
  USAGE_TYPES_LOG_MAX: 30,
  USAGE_TYPES_PRESET_MAX: 50,
  USAGE_TYPE_ITEM_MAX: 100,
  BOOKING_CLASS_MAX: 40,
} as const;

export const PATTERNS = {
  ID: /^[a-zA-Z0-9_\-]+$/,
  CLASS_NAME: /^ป\.[1-6]\/[1-3]$/,
  ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
  TIME_HHMM: /^([01]\d|2[0-3]):[0-5]\d$/,
  HEX_COLOR: /^#[0-9a-fA-F]{6}$/,
} as const;

export function clampString(value: string | undefined | null, maxLen: number): string {
  return (value ?? '').trim().slice(0, maxLen);
}

export function sanitizeId(value: string | undefined | null): string {
  const cleaned = clampString(value, LIMITS.ID_MAX);
  return cleaned && PATTERNS.ID.test(cleaned) ? cleaned : '';
}

export function assertValidClassName(className: string): string {
  const trimmed = clampString(className, LIMITS.CLASS_MAX);
  if (!PATTERNS.CLASS_NAME.test(trimmed) || !CLASS_LIST.includes(trimmed)) {
    throw new Error('ชั้นเรียนไม่ถูกต้อง (ต้องเป็น ป.1/1 - ป.6/3)');
  }
  return trimmed;
}

export function assertValidLogClassName(className: string): string {
  const trimmed = clampString(className, LIMITS.CLASS_MAX);
  if (trimmed === EXTERNAL_VISITOR_CLASS) {
    return trimmed;
  }
  return assertValidClassName(trimmed);
}

export function assertValidIsoDate(date: string): string {
  const trimmed = clampString(date, 10);
  if (!PATTERNS.ISO_DATE.test(trimmed)) {
    throw new Error('รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)');
  }
  return trimmed;
}

export function assertValidTimeHHMM(time: string, label = 'เวลา'): string {
  const trimmed = clampString(time, 5);
  if (!PATTERNS.TIME_HHMM.test(trimmed)) {
    throw new Error(`${label}ไม่ถูกต้อง (ต้องเป็นรูปแบบ HH:mm)`);
  }
  return trimmed;
}

export function assertValidBookingTimeRange(startTime: string, endTime: string): {
  startTime: string;
  endTime: string;
} {
  const start = assertValidTimeHHMM(startTime, 'เวลาเริ่ม');
  const end = assertValidTimeHHMM(endTime, 'เวลาสิ้นสุด');
  if (end <= start) {
    throw new Error('เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
  }
  return { startTime: start, endTime: end };
}

export function sanitizeUsageTypes(list: string[] | undefined, maxItems: number): string[] {
  if (!Array.isArray(list)) return [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const trimmed = clampString(item, LIMITS.USAGE_TYPE_ITEM_MAX);
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      unique.push(trimmed);
      if (unique.length >= maxItems) break;
    }
  }
  return unique;
}

export function sanitizeThemeColors(colors?: Partial<ThemeColors>): ThemeColors {
  const pick = (val: string | undefined, fallback: string) =>
    val && PATTERNS.HEX_COLOR.test(val.trim()) ? val.trim() : fallback;
  return {
    primary: pick(colors?.primary, DEFAULT_THEME_COLORS.primary),
    surface: pick(colors?.surface, DEFAULT_THEME_COLORS.surface),
    text: pick(colors?.text, DEFAULT_THEME_COLORS.text),
    accent: pick(colors?.accent, DEFAULT_THEME_COLORS.accent),
    secondary: pick(colors?.secondary, DEFAULT_THEME_COLORS.secondary),
  };
}
