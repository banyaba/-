export type UserRole = 'admin' | 'user';

export type PageId =
  | 'dashboard'
  | 'add-data'
  | 'bookings'
  | 'data-table'
  | 'statistics'
  | 'students'
  | 'subjects'
  | 'reports'
  | 'settings';

export const CLASS_LIST: readonly string[] = [
  'ป.1/1', 'ป.1/2', 'ป.1/3',
  'ป.2/1', 'ป.2/2', 'ป.2/3',
  'ป.3/1', 'ป.3/2', 'ป.3/3',
  'ป.4/1', 'ป.4/2', 'ป.4/3',
  'ป.5/1', 'ป.5/2', 'ป.5/3',
  'ป.6/1', 'ป.6/2', 'ป.6/3',
];

export const EXTERNAL_VISITOR_CLASS = 'บุคคลภายนอก';

export const EXTERNAL_VISITOR_CATEGORIES: readonly string[] = [
  'ผู้ปกครองนักเรียน',
  'ครู/บุคลากรต่างโรงเรียน',
  'เจ้าหน้าที่/หน่วยงานภายนอก',
  'นักเรียนต่างโรงเรียน',
  'ประชาชนทั่วไป / ชุมชน',
  'วิทยากร / ผู้มาติดต่อราชการ',
];

export const COMPUTER_ROOMS: readonly string[] = ['คอม1', 'คอม2'];

export const COMPUTER_STATIONS: readonly string[] = Array.from(
  { length: 30 },
  (_, i) => String(i + 1)
);

export const DEFAULT_USAGE_TYPES: readonly string[] = [
  'ค้นคว้าข้อมูล',
  'ศึกษาบทเรียนออนไลน์',
  'โปรแกรมการศึกษา',
  'ฝึกพิมพ์',
  'เขียนโปรแกรม',
  'แบบฝึกหัดออนไลน์',
  'โครงงาน',
  'สืบค้นอินเทอร์เน็ต',
  'สื่อการเรียน',
  'อื่นๆ',
];

export const USAGE_TYPES = DEFAULT_USAGE_TYPES;

export interface MonthConfig {
  index: number; // 0 - 11
  short: string;
  full: string;
  from: string;
  to: string;
  shadow: string;
}

export const THAI_MONTHS: readonly MonthConfig[] = [
  { index: 0, short: 'ม.ค.', full: 'มกราคม', from: '#2563eb', to: '#60a5fa', shadow: 'rgba(37, 99, 235, 0.35)' },
  { index: 1, short: 'ก.พ.', full: 'กุมภาพันธ์', from: '#0284c7', to: '#38bdf8', shadow: 'rgba(2, 132, 199, 0.35)' },
  { index: 2, short: 'มี.ค.', full: 'มีนาคม', from: '#0891b2', to: '#22d3ee', shadow: 'rgba(8, 145, 178, 0.35)' },
  { index: 3, short: 'เม.ย.', full: 'เมษายน', from: '#0d9488', to: '#2dd4bf', shadow: 'rgba(13, 148, 136, 0.35)' },
  { index: 4, short: 'พ.ค.', full: 'พฤษภาคม', from: '#059669', to: '#34d399', shadow: 'rgba(5, 150, 105, 0.35)' },
  { index: 5, short: 'มิ.ย.', full: 'มิถุนายน', from: '#16a34a', to: '#4ade80', shadow: 'rgba(22, 163, 74, 0.35)' },
  { index: 6, short: 'ก.ค.', full: 'กรกฎาคม', from: '#ca8a04', to: '#facc15', shadow: 'rgba(202, 138, 4, 0.35)' },
  { index: 7, short: 'ส.ค.', full: 'สิงหาคม', from: '#ea580c', to: '#fb923c', shadow: 'rgba(234, 88, 12, 0.35)' },
  { index: 8, short: 'ก.ย.', full: 'กันยายน', from: '#e11d48', to: '#fb7185', shadow: 'rgba(225, 29, 72, 0.35)' },
  { index: 9, short: 'ต.ค.', full: 'ตุลาคม', from: '#db2777', to: '#f472b6', shadow: 'rgba(219, 39, 119, 0.35)' },
  { index: 10, short: 'พ.ย.', full: 'พฤศจิกายน', from: '#c026d3', to: '#e879f9', shadow: 'rgba(192, 38, 211, 0.35)' },
  { index: 11, short: 'ธ.ค.', full: 'ธันวาคม', from: '#7c3aed', to: '#a78bfa', shadow: 'rgba(124, 58, 237, 0.35)' },
];

export interface Student {
  id: string;
  number?: number;
  name: string;
  className: string;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  note?: string;
  createdAt: string;
}

export interface UsageLog {
  id: string;
  date: string; // YYYY-MM-DD (Gregorian ISO)
  timeIn?: string; // HH:mm
  computerRoom?: string; // คอม1 | คอม2
  computerNumber?: string; // 1 - 30
  studentId?: string;
  studentName: string;
  className: string;
  subjectId?: string;
  subjectName: string;
  usageTypes: string[];
  note?: string;
  recorder: string;
  createdAt: string;
}

export type BookingStatus = 'pending' | 'approved' | 'rejected';

export type BookingMode = 'individual' | 'full_room';

export interface RoomBooking {
  id: string;
  bookingMode: BookingMode;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  computerRoom: string; // คอม1 | คอม2
  computerNumber?: string; // 1 - 30 (สำหรับจองรายคน)
  requesterName: string;
  className: string; // ชั้นเรียน หรือ บุคคลภายนอก / หลายชั้นเรียน
  subjectName: string;
  seatCount: number;
  note?: string;
  status: BookingStatus;
  decisionNote?: string;
  decidedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const BOOKING_GROUP_OPTIONS: readonly string[] = [
  ...CLASS_LIST,
  EXTERNAL_VISITOR_CLASS,
  'หลายชั้นเรียน / กิจกรรมรวม',
];

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export const WEEKDAYS_MON_FRI: readonly { id: DayOfWeek; label: string; short: string }[] = [
  { id: 'mon', label: 'วันจันทร์', short: 'จ.' },
  { id: 'tue', label: 'วันอังคาร', short: 'อ.' },
  { id: 'wed', label: 'วันพุธ', short: 'พ.' },
  { id: 'thu', label: 'วันพฤหัสบดี', short: 'พฤ.' },
  { id: 'fri', label: 'วันศุกร์', short: 'ศ.' },
];

export const TEACHING_PERIODS: readonly {
  period: number;
  label: string;
  startTime: string;
  endTime: string;
}[] = [
  { period: 1, label: 'คาบที่ 1', startTime: '08:30', endTime: '09:30' },
  { period: 2, label: 'คาบที่ 2', startTime: '09:30', endTime: '10:30' },
  { period: 3, label: 'คาบที่ 3', startTime: '10:30', endTime: '11:30' },
  { period: 4, label: 'คาบที่ 4', startTime: '11:30', endTime: '12:30' },
  { period: 5, label: 'คาบที่ 5', startTime: '13:30', endTime: '14:30' },
  { period: 6, label: 'คาบที่ 6', startTime: '14:30', endTime: '15:30' },
];

export interface TeachingScheduleSlot {
  id: string;
  computerRoom: string; // คอม1 | คอม2
  dayOfWeek: DayOfWeek;
  period: number; // 1..6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  className: string;
  subjectName: string;
  teacherName: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulePeriodConfig {
  period: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface LunchBreakConfig {
  startTime: string;
  endTime: string;
}

export interface ScheduleTimeSettings {
  periods: SchedulePeriodConfig[];
  lunchBreak: LunchBreakConfig;
}

export const DEFAULT_SCHEDULE_TIMES: ScheduleTimeSettings = {
  periods: TEACHING_PERIODS.map((p) => ({ ...p })),
  lunchBreak: {
    startTime: '12:30',
    endTime: '13:30',
  },
};

export interface ThemeColors {
  primary: string;
  surface: string;
  text: string;
  accent: string;
  secondary: string;
}

export interface AppSettings {
  schoolName: string;
  academicYear: string; // Buddhist Era string e.g. '2569'
  labManager: string;
  labManagers?: string[];
  colors: ThemeColors;
  scheduleTimes?: ScheduleTimeSettings;
  classList?: string[];
  computerRooms?: string[];
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: '#2563eb',
  surface: '#ffffff',
  text: '#0f172a',
  accent: '#10b981',
  secondary: '#7c3aed',
};

export const DEFAULT_SETTINGS: AppSettings = {
  schoolName: 'โรงเรียนสาธิตเทคโนโลยีวิทยา',
  academicYear: '2569',
  labManager: 'ครูธนากร สุขสวัสดิ์',
  labManagers: ['ครูธนากร สุขสวัสดิ์'],
  colors: DEFAULT_THEME_COLORS,
  scheduleTimes: DEFAULT_SCHEDULE_TIMES,
  classList: [...CLASS_LIST],
  computerRooms: [...COMPUTER_ROOMS],
};

export function getActiveClassList(settings?: Partial<AppSettings>): string[] {
  const list = settings?.classList;
  if (Array.isArray(list) && list.length > 0) {
    return list;
  }
  return [...CLASS_LIST];
}

export function getActiveComputerRooms(settings?: Partial<AppSettings>): string[] {
  const rooms = settings?.computerRooms;
  if (Array.isArray(rooms) && rooms.length > 0) {
    return rooms;
  }
  return [...COMPUTER_ROOMS];
}

export interface LabDatabase {
  students: Student[];
  subjects: Subject[];
  logs: UsageLog[];
  usageTypes: string[];
  settings: AppSettings;
}
