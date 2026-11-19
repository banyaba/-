import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  DEFAULT_SCHEDULE_TIMES,
  DEFAULT_SETTINGS,
  DEFAULT_USAGE_TYPES,
  TEACHING_PERIODS,
  type AppSettings,
  type BookingMode,
  type BookingStatus,
  type DayOfWeek,
  type LabDatabase,
  type RoomBooking,
  type ScheduleTimeSettings,
  type Student,
  type Subject,
  type TeachingScheduleSlot,
  type UsageLog,
  type UserRole,
} from '../types';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import {
  assertValidBookingTimeRange,
  assertValidClassName,
  assertValidIsoDate,
  assertValidLogClassName,
  clampString,
  LIMITS,
  sanitizeId,
  sanitizeThemeColors,
  sanitizeUsageTypes,
} from './validation';
import {
  getDefaultPinHashes,
  hashPin6,
  isValidPin6,
  sanitizeExtraAdmins,
  setCachedPinHashes,
  type ExtraAdminPin,
  type PinHashes,
} from './pinAuth';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return new Date().toISOString();
}

function getActorUid(): string {
  const user = auth.currentUser;
  if (user && user.emailVerified && /^[a-zA-Z0-9_-]+$/.test(user.uid)) {
    return user.uid;
  }
  const STORAGE_KEY = 'lab_kiosk_actor_id';
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^lab_[a-zA-Z0-9_-]+$/.test(existing)) {
      return existing;
    }
    const generated = `lab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return 'lab_kiosk_default';
  }
}

export async function checkIsAdminUser(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  const path = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (err) {
    // Permission denied means user is not an admin
    if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
      return false;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

function mapStudent(id: string, data: Record<string, unknown>): Student {
  return {
    id,
    number: typeof data.number === 'number' ? data.number : undefined,
    name: String(data.name ?? ''),
    className: String(data.className ?? ''),
    createdAt: toIsoString(data.createdAt),
  };
}

function mapSubject(id: string, data: Record<string, unknown>): Subject {
  return {
    id,
    name: String(data.name ?? ''),
    code: data.code ? String(data.code) : '',
    note: data.note ? String(data.note) : '',
    createdAt: toIsoString(data.createdAt),
  };
}

function mapUsageLog(id: string, data: Record<string, unknown>): UsageLog {
  return {
    id,
    date: String(data.date ?? ''),
    timeIn: data.timeIn ? String(data.timeIn) : '',
    computerRoom: data.computerRoom ? String(data.computerRoom) : '',
    computerNumber: data.computerNumber ? String(data.computerNumber) : '',
    studentId: data.studentId ? String(data.studentId) : undefined,
    studentName: String(data.studentName ?? ''),
    className: String(data.className ?? ''),
    subjectId: data.subjectId ? String(data.subjectId) : undefined,
    subjectName: String(data.subjectName ?? ''),
    usageTypes: Array.isArray(data.usageTypes) ? data.usageTypes.map(String) : [],
    note: data.note ? String(data.note) : '',
    recorder: String(data.recorder ?? ''),
    createdAt: toIsoString(data.createdAt),
  };
}

function mapBooking(id: string, data: Record<string, unknown>): RoomBooking {
  const rawStatus = String(data.status ?? 'pending');
  const status: BookingStatus =
    rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';
  const rawMode = String(data.bookingMode ?? 'full_room');
  const bookingMode: BookingMode = rawMode === 'individual' ? 'individual' : 'full_room';
  return {
    id,
    bookingMode,
    date: String(data.date ?? ''),
    startTime: String(data.startTime ?? ''),
    endTime: String(data.endTime ?? ''),
    computerRoom: String(data.computerRoom ?? ''),
    computerNumber: data.computerNumber ? String(data.computerNumber) : '',
    requesterName: String(data.requesterName ?? ''),
    className: String(data.className ?? ''),
    subjectName: String(data.subjectName ?? ''),
    seatCount: typeof data.seatCount === 'number' ? data.seatCount : Number(data.seatCount || 30),
    note: data.note ? String(data.note) : '',
    status,
    decisionNote: data.decisionNote ? String(data.decisionNote) : '',
    decidedBy: data.decidedBy ? String(data.decidedBy) : '',
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt ?? data.createdAt),
  };
}

function mapTeachingSchedule(id: string, data: Record<string, unknown>): TeachingScheduleSlot {
  const rawDay = String(data.dayOfWeek ?? 'mon');
  const dayOfWeek: DayOfWeek =
    rawDay === 'tue' || rawDay === 'wed' || rawDay === 'thu' || rawDay === 'fri' ? rawDay : 'mon';
  return {
    id,
    computerRoom: String(data.computerRoom ?? 'คอม1'),
    dayOfWeek,
    period: Math.max(1, Math.min(8, Number(data.period || 1))),
    startTime: String(data.startTime ?? '08:30'),
    endTime: String(data.endTime ?? '09:30'),
    className: String(data.className ?? ''),
    subjectName: String(data.subjectName ?? ''),
    teacherName: String(data.teacherName ?? ''),
    note: data.note ? String(data.note) : '',
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt ?? data.createdAt),
  };
}

function makeScheduleDocId(computerRoom: string, dayOfWeek: DayOfWeek, period: number): string {
  const roomKey = computerRoom === 'คอม1' ? 'r1' : computerRoom === 'คอม2' ? 'r2' : 'rx';
  return `sch_${roomKey}_${dayOfWeek}_p${period}`;
}

function findApprovedBookingConflict(
  candidate: {
    id?: string;
    bookingMode: BookingMode;
    date: string;
    startTime: string;
    endTime: string;
    computerRoom: string;
    computerNumber?: string;
  },
  existingList: RoomBooking[]
): RoomBooking | undefined {
  return existingList.find((b) => {
    if (candidate.id && b.id === candidate.id) return false;
    if (b.status !== 'approved') return false;
    if (b.date !== candidate.date || b.computerRoom !== candidate.computerRoom) return false;
    const overlaps = candidate.startTime < b.endTime && candidate.endTime > b.startTime;
    if (!overlaps) return false;
    if (candidate.bookingMode === 'full_room' || b.bookingMode === 'full_room') {
      return true;
    }
    return (b.computerNumber || '') === (candidate.computerNumber || '');
  });
}

function sanitizeScheduleTimes(raw: unknown): ScheduleTimeSettings {
  const defaults = DEFAULT_SCHEDULE_TIMES;
  if (!raw || typeof raw !== 'object') {
    return {
      periods: defaults.periods.map((p) => ({ ...p })),
      lunchBreak: { ...defaults.lunchBreak },
    };
  }
  const obj = raw as Record<string, unknown>;
  const rawPeriods = Array.isArray(obj.periods) ? obj.periods : [];
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  const periods = defaults.periods.map((def, idx) => {
    const candidate = rawPeriods[idx] as Record<string, unknown> | undefined;
    const startTime =
      candidate && typeof candidate.startTime === 'string' && timePattern.test(candidate.startTime)
        ? candidate.startTime
        : def.startTime;
    const endTime =
      candidate &&
      typeof candidate.endTime === 'string' &&
      timePattern.test(candidate.endTime) &&
      candidate.endTime > startTime
        ? candidate.endTime
        : def.endTime;
    const label =
      candidate && typeof candidate.label === 'string' && candidate.label.trim()
        ? candidate.label.trim().slice(0, 40)
        : def.label;
    return {
      period: def.period,
      label,
      startTime: endTime > startTime ? startTime : def.startTime,
      endTime: endTime > startTime ? endTime : def.endTime,
    };
  });

  const rawLunch = (obj.lunchBreak as Record<string, unknown> | undefined) || {};
  const lunchStart =
    typeof rawLunch.startTime === 'string' && timePattern.test(rawLunch.startTime)
      ? rawLunch.startTime
      : defaults.lunchBreak.startTime;
  const lunchEnd =
    typeof rawLunch.endTime === 'string' &&
    timePattern.test(rawLunch.endTime) &&
    rawLunch.endTime > lunchStart
      ? rawLunch.endTime
      : defaults.lunchBreak.endTime;

  return {
    periods,
    lunchBreak: {
      startTime: lunchEnd > lunchStart ? lunchStart : defaults.lunchBreak.startTime,
      endTime: lunchEnd > lunchStart ? lunchEnd : defaults.lunchBreak.endTime,
    },
  };
}

const MAX_LAB_MANAGERS = 20;

export function sanitizeLabManagers(raw: unknown, primaryManager: string): string[] {
  const cleanPrimary =
    clampString(primaryManager, LIMITS.RECORDER_MAX) || DEFAULT_SETTINGS.labManager;
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of list) {
    if (typeof item !== 'string') continue;
    const trimmed = clampString(item, LIMITS.RECORDER_MAX);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_LAB_MANAGERS) break;
  }

  if (!seen.has(cleanPrimary)) {
    if (result.length >= MAX_LAB_MANAGERS) {
      result.pop();
    }
    result.unshift(cleanPrimary);
  }

  return result;
}

function mapSettings(data: Record<string, unknown>): {
  settings: AppSettings;
  usageTypes: string[];
} {
  const rawColors = (data.colors as Record<string, string> | undefined) || {};
  const primaryManager = String(data.labManager || DEFAULT_SETTINGS.labManager);
  return {
    settings: {
      schoolName: String(data.schoolName || DEFAULT_SETTINGS.schoolName),
      academicYear: String(data.academicYear || DEFAULT_SETTINGS.academicYear),
      labManager: primaryManager,
      labManagers: sanitizeLabManagers(data.labManagers, primaryManager),
      colors: sanitizeThemeColors(rawColors),
      scheduleTimes: sanitizeScheduleTimes(data.scheduleTimes),
    },
    usageTypes: Array.isArray(data.usageTypes)
      ? data.usageTypes.map(String)
      : [...DEFAULT_USAGE_TYPES],
  };
}

function buildDefaultSeed(): LabDatabase {
  const now = new Date();
  const currentYear = now.getFullYear();
  const todayISO = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const students: Student[] = [
    { id: 'stu_1', number: 1, name: 'เด็กชายกิตติภพ วงศ์สุวรรณ', className: 'ป.4/1', createdAt: now.toISOString() },
    { id: 'stu_2', number: 2, name: 'เด็กหญิงปภาวรินท์ ศรีสวัสดิ์', className: 'ป.4/1', createdAt: now.toISOString() },
    { id: 'stu_3', number: 3, name: 'เด็กชายธนดล มณีรัตน์', className: 'ป.4/1', createdAt: now.toISOString() },
    { id: 'stu_4', number: 1, name: 'เด็กชายสมชาย ใจดี', className: 'ป.5/1', createdAt: now.toISOString() },
    { id: 'stu_5', number: 2, name: 'เด็กหญิงสมหญิง รักเรียน', className: 'ป.5/1', createdAt: now.toISOString() },
    { id: 'stu_6', number: 3, name: 'เด็กชายณัฐวุฒิ พงษ์ไพบูลย์', className: 'ป.5/1', createdAt: now.toISOString() },
    { id: 'stu_7', number: 4, name: 'เด็กหญิงพิมพ์ชนก แก้วมณี', className: 'ป.5/1', createdAt: now.toISOString() },
    { id: 'stu_8', number: 1, name: 'เด็กชายภูวดล ชัยชนะ', className: 'ป.5/2', createdAt: now.toISOString() },
    { id: 'stu_9', number: 2, name: 'เด็กหญิงกัญญารัตน์ ทองคำ', className: 'ป.5/2', createdAt: now.toISOString() },
    { id: 'stu_10', number: 1, name: 'เด็กชายอธิปติ์ บุญมี', className: 'ป.6/1', createdAt: now.toISOString() },
    { id: 'stu_11', number: 2, name: 'เด็กหญิงชลธิชา ประเสริฐ', className: 'ป.6/1', createdAt: now.toISOString() },
    { id: 'stu_12', number: 3, name: 'เด็กชายวรเมธ แสงจันทร์', className: 'ป.6/1', createdAt: now.toISOString() },
    { id: 'stu_13', number: 1, name: 'เด็กหญิงนภัสสร อินทร์แก้ว', className: 'ป.3/1', createdAt: now.toISOString() },
    { id: 'stu_14', number: 2, name: 'เด็กชายพีรพล วัฒนกุล', className: 'ป.3/1', createdAt: now.toISOString() },
  ];

  const subjects: Subject[] = [
    { id: 'sub_1', name: 'วิทยาการคำนวณ', code: 'IT01', note: 'การคิดเชิงคำนวณและโปรแกรมพื้นฐาน', createdAt: now.toISOString() },
    { id: 'sub_2', name: 'เทคโนโลยีสารสนเทศ', code: 'IT02', note: 'การใช้โปรแกรมสำนักงานและอินเทอร์เน็ต', createdAt: now.toISOString() },
    { id: 'sub_3', name: 'วิทยาศาสตร์', code: 'SC101', note: 'สืบค้นข้อมูลและจำลองการทดลอง', createdAt: now.toISOString() },
    { id: 'sub_4', name: 'คณิตศาสตร์', code: 'MA101', note: 'แบบฝึกหัดออนไลน์และเรขาคณิต', createdAt: now.toISOString() },
    { id: 'sub_5', name: 'ภาษาไทย', code: 'TH101', note: 'ฝึกพิมพ์สัมผัสและจัดทำโครงงาน', createdAt: now.toISOString() },
    { id: 'sub_6', name: 'ภาษาอังกฤษ', code: 'EN101', note: 'บทเรียนออนไลน์และสื่อโสตทัศน์', createdAt: now.toISOString() },
  ];

  const monthlyCounts = [
    { month: '01', usage: ['เขียนโปรแกรม', 'ค้นคว้าข้อมูล'], time: '09:00', count: 4 },
    { month: '02', usage: ['ฝึกพิมพ์', 'โปรแกรมการศึกษา'], time: '10:00', count: 5 },
    { month: '03', usage: ['สืบค้นอินเทอร์เน็ต', 'โครงงาน'], time: '13:30', count: 3 },
    { month: '04', usage: ['แบบฝึกหัดออนไลน์'], time: '09:30', count: 2 },
    { month: '05', usage: ['เขียนโปรแกรม', 'ศึกษาบทเรียนออนไลน์'], time: '08:45', count: 7 },
    { month: '06', usage: ['ฝึกพิมพ์', 'สื่อการเรียน'], time: '10:15', count: 9 },
    { month: '07', usage: ['ค้นคว้าข้อมูล', 'โครงงาน'], time: '11:00', count: 8 },
    { month: '08', usage: ['เขียนโปรแกรม', 'แบบฝึกหัดออนไลน์'], time: '13:00', count: 11 },
    { month: '09', usage: ['ศึกษาบทเรียนออนไลน์', 'สื่อการเรียน'], time: '14:00', count: 6 },
    { month: '10', usage: ['ฝึกพิมพ์'], time: '09:15', count: 5 },
    { month: '11', usage: ['ค้นคว้าข้อมูล', 'เขียนโปรแกรม'], time: '09:00', count: 8 },
    { month: '12', usage: ['แบบฝึกหัดออนไลน์', 'โปรแกรมการศึกษา'], time: '10:30', count: 4 },
  ];

  const logs: UsageLog[] = [];
  let seq = 1;
  for (const item of monthlyCounts) {
    for (let i = 0; i < item.count; i++) {
      const stu = students[(seq + i) % students.length];
      const sub = subjects[(seq + i) % subjects.length];
      const day = String(Math.min(28, 3 + i * 2)).padStart(2, '0');
      const logDate =
        item.month === String(now.getMonth() + 1).padStart(2, '0') && i === 0
          ? todayISO
          : `${currentYear}-${item.month}-${day}`;
      logs.push({
        id: `log_${seq++}`,
        date: logDate,
        timeIn: item.time,
        computerRoom: seq % 2 === 0 ? 'คอม1' : 'คอม2',
        computerNumber: String(((seq + i) % 30) + 1),
        studentId: stu.id,
        studentName: stu.name,
        className: stu.className,
        subjectId: sub.id,
        subjectName: sub.name,
        usageTypes: item.usage,
        note: i === 0 ? 'ใช้งานปกติ' : '',
        recorder: DEFAULT_SETTINGS.labManager,
        createdAt: now.toISOString(),
      });
    }
  }

  return {
    students,
    subjects,
    logs,
    usageTypes: [...DEFAULT_USAGE_TYPES],
    settings: {
      ...DEFAULT_SETTINGS,
      academicYear: String(currentYear + 543),
    },
  };
}

async function getDocServerOrCache(ref: DocumentReference<DocumentData>) {
  try {
    return await getDocFromServer(ref);
  } catch {
    return await getDoc(ref);
  }
}

async function getDocsServerOrCache(q: Query<DocumentData>) {
  try {
    return await getDocsFromServer(q);
  } catch {
    return await getDocs(q);
  }
}

export async function seedInitialFirestoreIfEmpty(): Promise<void> {
  const uid = getActorUid();
  const settingsRef = doc(db, 'settings', 'app');

  try {
    const snap = await getDocServerOrCache(settingsRef);
    if (snap.exists()) {
      return;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/app');
  }

  // Verify ALL primary collections on server before seeding so existing user data is NEVER overwritten
  try {
    const [stuCheck, subCheck, logCheck, bookCheck, schCheck] = await Promise.all([
      getDocsServerOrCache(query(collection(db, 'students'), where('visibility', '==', 'school'), limit(1))),
      getDocsServerOrCache(query(collection(db, 'subjects'), where('visibility', '==', 'school'), limit(1))),
      getDocsServerOrCache(query(collection(db, 'logs'), where('visibility', '==', 'school'), limit(1))),
      getDocsServerOrCache(query(collection(db, 'bookings'), where('visibility', '==', 'school'), limit(1))),
      getDocsServerOrCache(
        query(collection(db, 'teachingSchedules'), where('visibility', '==', 'school'), limit(1))
      ),
    ]);

    const hasExistingUserData =
      !stuCheck.empty || !subCheck.empty || !logCheck.empty || !bookCheck.empty || !schCheck.empty;

    if (hasExistingUserData) {
      // Only restore missing settings/app without touching or injecting demo students/subjects/logs
      await setDoc(settingsRef, {
        schoolName: DEFAULT_SETTINGS.schoolName,
        academicYear: DEFAULT_SETTINGS.academicYear,
        labManager: DEFAULT_SETTINGS.labManager,
        labManagers: sanitizeLabManagers(DEFAULT_SETTINGS.labManagers, DEFAULT_SETTINGS.labManager),
        colors: sanitizeThemeColors(DEFAULT_SETTINGS.colors),
        usageTypes: [...DEFAULT_USAGE_TYPES],
        scheduleTimes: sanitizeScheduleTimes(undefined),
        ownerId: uid,
        visibility: 'school',
        updatedAt: serverTimestamp(),
      });
      return;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'seed-check');
  }

  const seed = buildDefaultSeed();
  const operations: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

  operations.push({
    ref: settingsRef,
    data: {
      schoolName: clampString(seed.settings?.schoolName || DEFAULT_SETTINGS.schoolName, LIMITS.SCHOOL_NAME_MAX),
      academicYear: clampString(seed.settings?.academicYear || DEFAULT_SETTINGS.academicYear, LIMITS.ACADEMIC_YEAR_MAX),
      labManager: clampString(seed.settings?.labManager || DEFAULT_SETTINGS.labManager, LIMITS.RECORDER_MAX),
      labManagers: sanitizeLabManagers(
        seed.settings?.labManagers,
        seed.settings?.labManager || DEFAULT_SETTINGS.labManager
      ),
      colors: sanitizeThemeColors(seed.settings?.colors),
      usageTypes: sanitizeUsageTypes(seed.usageTypes || [...DEFAULT_USAGE_TYPES], LIMITS.USAGE_TYPES_PRESET_MAX),
      scheduleTimes: sanitizeScheduleTimes(seed.settings?.scheduleTimes),
      ownerId: uid,
      visibility: 'school',
      updatedAt: serverTimestamp(),
    },
  });

  for (const stu of seed.students || []) {
    const id = sanitizeId(stu.id) || generateId('stu');
    operations.push({
      ref: doc(db, 'students', id),
      data: {
        number: typeof stu.number === 'number' && stu.number >= 1 ? Math.min(999, Math.trunc(stu.number)) : null,
        name: clampString(stu.name, LIMITS.NAME_MAX) || 'นักเรียน',
        className: assertValidClassName(stu.className),
        ownerId: uid,
        visibility: 'school',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  for (const sub of seed.subjects || []) {
    const id = sanitizeId(sub.id) || generateId('sub');
    operations.push({
      ref: doc(db, 'subjects', id),
      data: {
        name: clampString(sub.name, LIMITS.NAME_MAX) || 'รายวิชา',
        code: clampString(sub.code, LIMITS.CODE_MAX),
        note: clampString(sub.note, LIMITS.SUBJECT_NOTE_MAX),
        ownerId: uid,
        visibility: 'school',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  for (const log of seed.logs || []) {
    const id = sanitizeId(log.id) || generateId('log');
    operations.push({
      ref: doc(db, 'logs', id),
      data: {
        date: assertValidIsoDate(log.date),
        timeIn: clampString(log.timeIn, LIMITS.TIME_MAX),
        computerRoom: clampString(log.computerRoom, LIMITS.ROOM_MAX),
        computerNumber: clampString(log.computerNumber, LIMITS.STATION_MAX),
        studentId: sanitizeId(log.studentId),
        studentName: clampString(log.studentName, LIMITS.NAME_MAX) || 'นักเรียน',
        className: assertValidLogClassName(log.className),
        subjectId: sanitizeId(log.subjectId),
        subjectName: clampString(log.subjectName, LIMITS.NAME_MAX) || 'รายวิชา',
        usageTypes: sanitizeUsageTypes(log.usageTypes, LIMITS.USAGE_TYPES_LOG_MAX),
        note: clampString(log.note, LIMITS.NOTE_MAX),
        recorder: clampString(log.recorder, LIMITS.RECORDER_MAX) || DEFAULT_SETTINGS.labManager,
        ownerId: uid,
        visibility: 'school',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  try {
    const CHUNK = 400;
    for (let i = 0; i < operations.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const op of operations.slice(i, i + CHUNK)) {
        batch.set(op.ref, op.data);
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seed');
  }
}

export interface LabSubscriptionsCallbacks {
  onStudents: (students: Student[]) => void;
  onSubjects: (subjects: Subject[]) => void;
  onLogs: (logs: UsageLog[]) => void;
  onBookings?: (bookings: RoomBooking[]) => void;
  onTeachingSchedules?: (schedules: TeachingScheduleSlot[]) => void;
  onSettings: (settings: AppSettings, usageTypes: string[]) => void;
  onError: (err: Error) => void;
}

export function subscribeLabDatabase(callbacks: LabSubscriptionsCallbacks): Unsubscribe {
  const unsubSettings = onSnapshot(
    doc(db, 'settings', 'app'),
    (snap) => {
      if (snap.exists()) {
        const mapped = mapSettings(snap.data() as Record<string, unknown>);
        callbacks.onSettings(mapped.settings, mapped.usageTypes);
      } else {
        callbacks.onSettings(DEFAULT_SETTINGS, [...DEFAULT_USAGE_TYPES]);
      }
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, 'settings/app');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubStudents = onSnapshot(
    query(collection(db, 'students'), where('visibility', '==', 'school')),
    (snap) => {
      const items = snap.docs.map((d) => mapStudent(d.id, d.data() as Record<string, unknown>));
      callbacks.onStudents(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'students');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubSubjects = onSnapshot(
    query(collection(db, 'subjects'), where('visibility', '==', 'school')),
    (snap) => {
      const items = snap.docs.map((d) => mapSubject(d.id, d.data() as Record<string, unknown>));
      callbacks.onSubjects(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'subjects');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubLogs = onSnapshot(
    query(collection(db, 'logs'), where('visibility', '==', 'school')),
    (snap) => {
      const items = snap.docs
        .map((d) => mapUsageLog(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          const dateDiff = b.date.localeCompare(a.date);
          if (dateDiff !== 0) return dateDiff;
          return b.createdAt.localeCompare(a.createdAt);
        });
      callbacks.onLogs(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'logs');
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubBookings = callbacks.onBookings
    ? onSnapshot(
        query(collection(db, 'bookings'), where('visibility', '==', 'school')),
        (snap) => {
          const items = snap.docs
            .map((d) => mapBooking(d.id, d.data() as Record<string, unknown>))
            .sort((a, b) => {
              const dateDiff = b.date.localeCompare(a.date);
              if (dateDiff !== 0) return dateDiff;
              return a.startTime.localeCompare(b.startTime);
            });
          callbacks.onBookings?.(items);
        },
        (err) => {
          try {
            handleFirestoreError(err, OperationType.LIST, 'bookings');
          } catch (wrapped) {
            callbacks.onError(wrapped as Error);
          }
        }
      )
    : () => {};

  const unsubSchedules = callbacks.onTeachingSchedules
    ? onSnapshot(
        query(collection(db, 'teachingSchedules'), where('visibility', '==', 'school')),
        (snap) => {
          const dayOrder: Record<DayOfWeek, number> = {
            mon: 1,
            tue: 2,
            wed: 3,
            thu: 4,
            fri: 5,
          };
          const items = snap.docs
            .map((d) => mapTeachingSchedule(d.id, d.data() as Record<string, unknown>))
            .sort((a, b) => {
              const roomDiff = a.computerRoom.localeCompare(b.computerRoom, 'th');
              if (roomDiff !== 0) return roomDiff;
              const dayDiff = dayOrder[a.dayOfWeek] - dayOrder[b.dayOfWeek];
              if (dayDiff !== 0) return dayDiff;
              return a.period - b.period;
            });
          callbacks.onTeachingSchedules?.(items);
        },
        (err) => {
          try {
            handleFirestoreError(err, OperationType.LIST, 'teachingSchedules');
          } catch (wrapped) {
            callbacks.onError(wrapped as Error);
          }
        }
      )
    : () => {};

  return () => {
    unsubSettings();
    unsubStudents();
    unsubSubjects();
    unsubLogs();
    unsubBookings();
    unsubSchedules();
  };
}

function buildUsageLogDoc(
  payload: Omit<UsageLog, 'id' | 'createdAt'>,
  uid: string,
  isCreate: boolean
): Record<string, unknown> {
  const studentName = clampString(payload.studentName, LIMITS.NAME_MAX);
  const subjectName = clampString(payload.subjectName, LIMITS.NAME_MAX);
  const recorder = clampString(payload.recorder, LIMITS.RECORDER_MAX);
  if (!studentName || !subjectName || !recorder) {
    throw new Error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
  }
  const base: Record<string, unknown> = {
    date: assertValidIsoDate(payload.date),
    timeIn: clampString(payload.timeIn, LIMITS.TIME_MAX),
    computerRoom: clampString(payload.computerRoom, LIMITS.ROOM_MAX),
    computerNumber: clampString(payload.computerNumber, LIMITS.STATION_MAX),
    studentId: sanitizeId(payload.studentId),
    studentName,
    className: assertValidLogClassName(payload.className),
    subjectId: sanitizeId(payload.subjectId),
    subjectName,
    usageTypes: sanitizeUsageTypes(payload.usageTypes, LIMITS.USAGE_TYPES_LOG_MAX),
    note: clampString(payload.note, LIMITS.NOTE_MAX),
    recorder,
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.ownerId = uid;
    base.visibility = 'school';
    base.createdAt = serverTimestamp();
  }
  return base;
}

async function deleteDocRefsInChunks(
  refs: ReturnType<typeof doc>[],
  pathLabel: string
): Promise<number> {
  if (refs.length === 0) return 0;
  try {
    const CHUNK = 400;
    for (let i = 0; i < refs.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const ref of refs.slice(i, i + CHUNK)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
    return refs.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, pathLabel);
  }
}

export const firestoreApi = {
  // Logs
  createLog: async (payload: Omit<UsageLog, 'id' | 'createdAt'>): Promise<UsageLog> => {
    const uid = getActorUid();
    const id = generateId('log');
    const path = `logs/${id}`;
    const docData = buildUsageLogDoc(payload, uid, true);
    try {
      await setDoc(doc(db, 'logs', id), docData);
      return {
        ...payload,
        id,
        studentName: String(docData.studentName),
        subjectName: String(docData.subjectName),
        recorder: String(docData.recorder),
        usageTypes: docData.usageTypes as string[],
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  createLogsBatch: async (
    items: Omit<UsageLog, 'id' | 'createdAt'>[]
  ): Promise<{ count: number; items: UsageLog[] }> => {
    const uid = getActorUid();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('ไม่มีรายการที่จะบันทึก');
    }
    const created: UsageLog[] = [];
    const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const id = generateId('log');
      const data = buildUsageLogDoc(item, uid, true);
      ops.push({ ref: doc(db, 'logs', id), data });
      created.push({
        ...item,
        id,
        studentName: String(data.studentName),
        subjectName: String(data.subjectName),
        recorder: String(data.recorder),
        usageTypes: data.usageTypes as string[],
        createdAt: nowIso,
      });
    }

    try {
      const CHUNK = 400;
      for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + CHUNK)) {
          batch.set(op.ref, op.data);
        }
        await batch.commit();
      }
      return { count: created.length, items: created };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'logs');
    }
  },

  updateLog: async (id: string, payload: Partial<UsageLog>): Promise<UsageLog> => {
    const uid = getActorUid();
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสรายการไม่ถูกต้อง');
    const path = `logs/${safeId}`;
    try {
      const ref = doc(db, 'logs', safeId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw new Error('ไม่พบข้อมูลที่ต้องการแก้ไข');
      }
      const existingLog = mapUsageLog(snap.id, snap.data() as Record<string, unknown>);
      const merged: Omit<UsageLog, 'id' | 'createdAt'> = {
        date: payload.date ?? existingLog.date,
        timeIn: payload.timeIn ?? existingLog.timeIn ?? '',
        computerRoom: payload.computerRoom ?? existingLog.computerRoom ?? '',
        computerNumber: payload.computerNumber ?? existingLog.computerNumber ?? '',
        studentId: payload.studentId ?? existingLog.studentId ?? '',
        studentName: payload.studentName ?? existingLog.studentName,
        className: payload.className ?? existingLog.className,
        subjectId: payload.subjectId ?? existingLog.subjectId ?? '',
        subjectName: payload.subjectName ?? existingLog.subjectName,
        usageTypes: payload.usageTypes ?? existingLog.usageTypes,
        note: payload.note ?? existingLog.note ?? '',
        recorder: payload.recorder ?? existingLog.recorder,
      };
      const updatePayload = buildUsageLogDoc(merged, uid, false);
      await updateDoc(ref, updatePayload);
      return {
        ...existingLog,
        ...merged,
        studentName: String(updatePayload.studentName),
        subjectName: String(updatePayload.subjectName),
        recorder: String(updatePayload.recorder),
        usageTypes: updatePayload.usageTypes as string[],
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  deleteLog: async (id: string): Promise<{ ok: boolean }> => {
    getActorUid();
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสรายการไม่ถูกต้อง');
    const path = `logs/${safeId}`;
    try {
      await deleteDoc(doc(db, 'logs', safeId));
      return { ok: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  },

  deleteLogsByDate: async (date: string): Promise<{ deleted: number }> => {
    getActorUid();
    const safeDate = assertValidIsoDate(date);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'logs'),
          where('visibility', '==', 'school'),
          where('date', '==', safeDate)
        )
      );
      const deleted = await deleteDocRefsInChunks(
        snap.docs.map((d) => d.ref),
        'logs'
      );
      return { deleted };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'logs');
    }
  },

  // Students
  createStudent: async (payload: Omit<Student, 'id' | 'createdAt'>): Promise<Student> => {
    const uid = getActorUid();
    const name = clampString(payload.name, LIMITS.NAME_MAX);
    if (!name) throw new Error('กรุณากรอกชื่อ-สกุล');
    const className = assertValidClassName(payload.className);
    const id = generateId('stu');
    const numberVal =
      payload.number !== undefined && Number.isInteger(payload.number) && payload.number >= 1
        ? Math.min(999, payload.number)
        : null;
    try {
      await setDoc(doc(db, 'students', id), {
        number: numberVal,
        name,
        className,
        ownerId: uid,
        visibility: 'school',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id,
        number: numberVal ?? undefined,
        name,
        className,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `students/${id}`);
    }
  },

  createStudentsBulk: async (
    items: Omit<Student, 'id' | 'createdAt'>[]
  ): Promise<{ count: number; items: Student[] }> => {
    const uid = getActorUid();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('ไม่มีข้อมูลนักเรียนที่จะนำเข้า');
    }
    const created: Student[] = [];
    const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const name = clampString(item.name, LIMITS.NAME_MAX);
      if (!name) continue;
      const className = assertValidClassName(item.className);
      const id = generateId('stu');
      const numberVal =
        item.number !== undefined && Number.isInteger(item.number) && item.number >= 1
          ? Math.min(999, item.number)
          : null;
      ops.push({
        ref: doc(db, 'students', id),
        data: {
          number: numberVal,
          name,
          className,
          ownerId: uid,
          visibility: 'school',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
      created.push({
        id,
        number: numberVal ?? undefined,
        name,
        className,
        createdAt: nowIso,
      });
    }

    try {
      const CHUNK = 400;
      for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + CHUNK)) {
          batch.set(op.ref, op.data);
        }
        await batch.commit();
      }
      return { count: created.length, items: created };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students');
    }
  },

  updateStudent: async (id: string, payload: Partial<Student>): Promise<Student> => {
    getActorUid();
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสนักเรียนไม่ถูกต้อง');
    const path = `students/${safeId}`;
    try {
      const ref = doc(db, 'students', safeId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('ไม่พบข้อมูลนักเรียน');
      const existingStu = mapStudent(snap.id, snap.data() as Record<string, unknown>);
      const name = clampString(payload.name ?? existingStu.name, LIMITS.NAME_MAX);
      if (!name) throw new Error('กรุณากรอกชื่อ-สกุล');
      const className = assertValidClassName(payload.className ?? existingStu.className);
      const nextNumber =
        payload.number !== undefined
          ? Number.isInteger(payload.number) && payload.number >= 1
            ? Math.min(999, payload.number)
            : null
          : existingStu.number ?? null;

      await updateDoc(ref, {
        number: nextNumber,
        name,
        className,
        updatedAt: serverTimestamp(),
      });
      return {
        ...existingStu,
        number: nextNumber ?? undefined,
        name,
        className,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  deleteStudent: async (id: string): Promise<{ ok: boolean }> => {
    getActorUid();
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสนักเรียนไม่ถูกต้อง');
    try {
      await deleteDoc(doc(db, 'students', safeId));
      return { ok: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${safeId}`);
    }
  },

  bulkDeleteStudents: async (ids: string[]): Promise<{ deleted: number }> => {
    getActorUid();
    const refs = ids
      .map((id) => sanitizeId(id))
      .filter(Boolean)
      .map((id) => doc(db, 'students', id));
    const deleted = await deleteDocRefsInChunks(refs, 'students');
    return { deleted };
  },

  deleteStudentsByClass: async (className: string): Promise<{ deleted: number }> => {
    getActorUid();
    const safeClass = assertValidClassName(className);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'students'),
          where('visibility', '==', 'school'),
          where('className', '==', safeClass)
        )
      );
      const deleted = await deleteDocRefsInChunks(
        snap.docs.map((d) => d.ref),
        'students'
      );
      return { deleted };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'students');
    }
  },

  promoteStudentsAllGrades: async (options: {
    p6Action: 'delete' | 'keep';
    nextAcademicYear?: string;
  }): Promise<{
    promotedCount: number;
    deletedP6Count: number;
    updatedStudents: Student[];
    updatedAcademicYear?: string;
  }> => {
    const uid = getActorUid();
    let cleanNextYear: string | undefined;
    if (options.nextAcademicYear !== undefined) {
      const trimmed = clampString(options.nextAcademicYear, LIMITS.ACADEMIC_YEAR_MAX);
      if (trimmed) {
        if (trimmed.length < 4) {
          throw new Error('ปีการศึกษา (พ.ศ.) ต้องมีความยาวอย่างน้อย 4 หลัก เช่น 2570');
        }
        cleanNextYear = trimmed;
      }
    }

    try {
      const snap = await getDocs(
        query(collection(db, 'students'), where('visibility', '==', 'school'))
      );

      const ops: Array<
        | { type: 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
        | { type: 'delete'; ref: ReturnType<typeof doc> }
        | { type: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
      > = [];

      let promotedCount = 0;
      let deletedP6Count = 0;
      const updatedStudents: Student[] = [];

      for (const d of snap.docs) {
        const stu = mapStudent(d.id, d.data() as Record<string, unknown>);
        const match = /^ป\.([1-6])\/([1-3])$/.exec(stu.className.trim());
        if (!match) {
          updatedStudents.push(stu);
          continue;
        }
        const grade = Number(match[1]);
        const room = match[2];

        if (grade >= 1 && grade <= 5) {
          const nextClass = assertValidClassName(`ป.${grade + 1}/${room}`);
          ops.push({
            type: 'update',
            ref: d.ref,
            data: {
              className: nextClass,
              updatedAt: serverTimestamp(),
            },
          });
          promotedCount += 1;
          updatedStudents.push({ ...stu, className: nextClass });
        } else if (grade === 6) {
          if (options.p6Action === 'delete') {
            ops.push({ type: 'delete', ref: d.ref });
            deletedP6Count += 1;
          } else {
            updatedStudents.push(stu);
          }
        } else {
          updatedStudents.push(stu);
        }
      }

      if (promotedCount === 0 && deletedP6Count === 0 && !cleanNextYear) {
        throw new Error('ไม่พบรายชื่อนักเรียนที่สามารถปรับระดับชั้นได้');
      }

      if (cleanNextYear) {
        const settingsRef = doc(db, 'settings', 'app');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          ops.push({
            type: 'update',
            ref: settingsRef,
            data: {
              academicYear: cleanNextYear,
              updatedAt: serverTimestamp(),
            },
          });
        } else {
          ops.push({
            type: 'set',
            ref: settingsRef,
            data: {
              schoolName: DEFAULT_SETTINGS.schoolName,
              academicYear: cleanNextYear,
              labManager: DEFAULT_SETTINGS.labManager,
              labManagers: sanitizeLabManagers(undefined, DEFAULT_SETTINGS.labManager),
              colors: sanitizeThemeColors(),
              usageTypes: [...DEFAULT_USAGE_TYPES],
              scheduleTimes: sanitizeScheduleTimes(undefined),
              ownerId: uid,
              visibility: 'school',
              updatedAt: serverTimestamp(),
            },
          });
        }
      }

      const CHUNK = 400;
      for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + CHUNK)) {
          if (op.type === 'update') {
            batch.update(op.ref, op.data);
          } else if (op.type === 'delete') {
            batch.delete(op.ref);
          } else {
            batch.set(op.ref, op.data);
          }
        }
        await batch.commit();
      }

      return {
        promotedCount,
        deletedP6Count,
        updatedStudents,
        updatedAcademicYear: cleanNextYear,
      };
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ปีการศึกษา') || err.message.includes('ไม่พบรายชื่อนักเรียน'))
      ) {
        throw err;
      }
      handleFirestoreError(err, OperationType.WRITE, 'students');
    }
  },

  moveStudentsClass: async (options: {
    fromClass: string;
    toClass: string;
    studentIds?: string[];
    nextAcademicYear?: string;
  }): Promise<{
    movedCount: number;
    updatedStudents: Student[];
    updatedAcademicYear?: string;
  }> => {
    const uid = getActorUid();
    const safeFrom = assertValidClassName(options.fromClass);
    const safeTo = assertValidClassName(options.toClass);
    if (safeFrom === safeTo) {
      throw new Error('กรุณาเลือกชั้นเรียนปลายทางที่แตกต่างจากชั้นเรียนเดิม');
    }

    let cleanNextYear: string | undefined;
    if (options.nextAcademicYear !== undefined) {
      const trimmed = clampString(options.nextAcademicYear, LIMITS.ACADEMIC_YEAR_MAX);
      if (trimmed) {
        if (trimmed.length < 4) {
          throw new Error('ปีการศึกษา (พ.ศ.) ต้องมีความยาวอย่างน้อย 4 หลัก เช่น 2570');
        }
        cleanNextYear = trimmed;
      }
    }

    const idFilter =
      Array.isArray(options.studentIds) && options.studentIds.length > 0
        ? new Set(options.studentIds.map((id) => sanitizeId(id)).filter(Boolean))
        : null;

    try {
      const snap = await getDocs(
        query(collection(db, 'students'), where('visibility', '==', 'school'))
      );

      const ops: Array<
        | { type: 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
        | { type: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
      > = [];

      let movedCount = 0;
      const updatedStudents: Student[] = [];

      for (const d of snap.docs) {
        const stu = mapStudent(d.id, d.data() as Record<string, unknown>);
        const matchesClass = stu.className === safeFrom;
        const matchesId = idFilter === null || idFilter.has(stu.id);
        if (matchesClass && matchesId) {
          ops.push({
            type: 'update',
            ref: d.ref,
            data: {
              className: safeTo,
              updatedAt: serverTimestamp(),
            },
          });
          movedCount += 1;
          updatedStudents.push({ ...stu, className: safeTo });
        } else {
          updatedStudents.push(stu);
        }
      }

      if (movedCount === 0) {
        throw new Error(`ไม่พบรายชื่อนักเรียนที่เลือกในชั้น ${safeFrom}`);
      }

      if (cleanNextYear) {
        const settingsRef = doc(db, 'settings', 'app');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          ops.push({
            type: 'update',
            ref: settingsRef,
            data: {
              academicYear: cleanNextYear,
              updatedAt: serverTimestamp(),
            },
          });
        } else {
          ops.push({
            type: 'set',
            ref: settingsRef,
            data: {
              schoolName: DEFAULT_SETTINGS.schoolName,
              academicYear: cleanNextYear,
              labManager: DEFAULT_SETTINGS.labManager,
              labManagers: sanitizeLabManagers(undefined, DEFAULT_SETTINGS.labManager),
              colors: sanitizeThemeColors(),
              usageTypes: [...DEFAULT_USAGE_TYPES],
              scheduleTimes: sanitizeScheduleTimes(undefined),
              ownerId: uid,
              visibility: 'school',
              updatedAt: serverTimestamp(),
            },
          });
        }
      }

      const CHUNK = 400;
      for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + CHUNK)) {
          if (op.type === 'update') {
            batch.update(op.ref, op.data);
          } else {
            batch.set(op.ref, op.data);
          }
        }
        await batch.commit();
      }

      return {
        movedCount,
        updatedStudents,
        updatedAcademicYear: cleanNextYear,
      };
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ปีการศึกษา') ||
          err.message.includes('ไม่พบรายชื่อนักเรียน') ||
          err.message.includes('ชั้นเรียน'))
      ) {
        throw err;
      }
      handleFirestoreError(err, OperationType.WRITE, 'students');
    }
  },

  // Subjects
  createSubject: async (payload: Omit<Subject, 'id' | 'createdAt'>): Promise<Subject> => {
    const uid = getActorUid();
    const name = clampString(payload.name, LIMITS.NAME_MAX);
    if (!name) throw new Error('กรุณากรอกชื่อวิชา');
    const code = clampString(payload.code, LIMITS.CODE_MAX);
    const note = clampString(payload.note, LIMITS.SUBJECT_NOTE_MAX);
    const id = generateId('sub');
    try {
      await setDoc(doc(db, 'subjects', id), {
        name,
        code,
        note,
        ownerId: uid,
        visibility: 'school',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id,
        name,
        code,
        note,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `subjects/${id}`);
    }
  },

  createSubjectsBulk: async (
    items: Omit<Subject, 'id' | 'createdAt'>[]
  ): Promise<{ count: number; items: Subject[] }> => {
    const uid = getActorUid();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('ไม่มีข้อมูลรายวิชาที่จะนำเข้า');
    }
    const created: Subject[] = [];
    const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const name = clampString(item.name, LIMITS.NAME_MAX);
      if (!name) continue;
      const code = clampString(item.code, LIMITS.CODE_MAX);
      const note = clampString(item.note, LIMITS.SUBJECT_NOTE_MAX);
      const id = generateId('sub');
      ops.push({
        ref: doc(db, 'subjects', id),
        data: {
          name,
          code,
          note,
          ownerId: uid,
          visibility: 'school',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
      created.push({ id, name, code, note, createdAt: nowIso });
    }

    try {
      const CHUNK = 400;
      for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + CHUNK)) {
          batch.set(op.ref, op.data);
        }
        await batch.commit();
      }
      return { count: created.length, items: created };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'subjects');
    }
  },

  updateSubject: async (id: string, payload: Partial<Subject>): Promise<Subject> => {
    getActorUid();
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสรายวิชาไม่ถูกต้อง');
    const path = `subjects/${safeId}`;
    try {
      const ref = doc(db, 'subjects', safeId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('ไม่พบข้อมูลรายวิชา');
      const existingSub = mapSubject(snap.id, snap.data() as Record<string, unknown>);
      const name = clampString(payload.name ?? existingSub.name, LIMITS.NAME_MAX);
      if (!name) throw new Error('กรุณากรอกชื่อวิชา');
      const code = clampString(payload.code ?? existingSub.code, LIMITS.CODE_MAX);
      const note = clampString(payload.note ?? existingSub.note, LIMITS.SUBJECT_NOTE_MAX);

      await updateDoc(ref, {
        name,
        code,
        note,
        updatedAt: serverTimestamp(),
      });
      return { ...existingSub, name, code, note };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  deleteSubject: async (id: string): Promise<{ ok: boolean }> => {
    getActorUid();
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสรายวิชาไม่ถูกต้อง');
    try {
      await deleteDoc(doc(db, 'subjects', safeId));
      return { ok: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `subjects/${safeId}`);
    }
  },

  // Usage Types (stored on settings/app)
  addUsageType: async (name: string): Promise<{ usageTypes: string[] }> => {
    getActorUid();
    const trimmed = clampString(name, LIMITS.USAGE_TYPE_ITEM_MAX);
    if (!trimmed) throw new Error('กรุณากรอกชื่อรูปแบบการใช้');
    const path = 'settings/app';
    try {
      const ref = doc(db, 'settings', 'app');
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? mapSettings(snap.data() as Record<string, unknown>).usageTypes
        : [...DEFAULT_USAGE_TYPES];
      if (current.includes(trimmed)) {
        throw new Error('รูปแบบการใช้นี้มีอยู่ในระบบแล้ว');
      }
      const next = sanitizeUsageTypes([...current, trimmed], LIMITS.USAGE_TYPES_PRESET_MAX);
      await updateDoc(ref, { usageTypes: next, updatedAt: serverTimestamp() });
      return { usageTypes: next };
    } catch (err) {
      if (err instanceof Error && err.message.includes('มีอยู่ในระบบแล้ว')) throw err;
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  updateUsageType: async (index: number, name: string): Promise<{ usageTypes: string[] }> => {
    getActorUid();
    const trimmed = clampString(name, LIMITS.USAGE_TYPE_ITEM_MAX);
    if (!trimmed) throw new Error('ชื่อรูปแบบการใช้ห้ามว่าง');
    const path = 'settings/app';
    try {
      const ref = doc(db, 'settings', 'app');
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? mapSettings(snap.data() as Record<string, unknown>).usageTypes
        : [...DEFAULT_USAGE_TYPES];
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error('ไม่พบรูปแบบการใช้ที่ต้องการแก้ไข');
      }
      if (current.some((u, i) => i !== index && u === trimmed)) {
        throw new Error('รูปแบบการใช้นี้มีอยู่ในระบบแล้ว');
      }
      const next = [...current];
      next[index] = trimmed;
      await updateDoc(ref, {
        usageTypes: sanitizeUsageTypes(next, LIMITS.USAGE_TYPES_PRESET_MAX),
        updatedAt: serverTimestamp(),
      });
      return { usageTypes: next };
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('มีอยู่ในระบบแล้ว') || err.message.includes('ไม่พบรูปแบบ'))
      ) {
        throw err;
      }
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  deleteUsageType: async (index: number): Promise<{ usageTypes: string[] }> => {
    getActorUid();
    const path = 'settings/app';
    try {
      const ref = doc(db, 'settings', 'app');
      const snap = await getDoc(ref);
      const current = snap.exists()
        ? mapSettings(snap.data() as Record<string, unknown>).usageTypes
        : [...DEFAULT_USAGE_TYPES];
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new Error('ไม่พบรูปแบบการใช้ที่ต้องการลบ');
      }
      const next = [...current];
      next.splice(index, 1);
      await updateDoc(ref, { usageTypes: next, updatedAt: serverTimestamp() });
      return { usageTypes: next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  resetUsageTypes: async (): Promise<{ usageTypes: string[] }> => {
    getActorUid();
    const next = [...DEFAULT_USAGE_TYPES];
    try {
      await updateDoc(doc(db, 'settings', 'app'), {
        usageTypes: next,
        updatedAt: serverTimestamp(),
      });
      return { usageTypes: next };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/app');
    }
  },

  // Settings
  updateSettings: async (payload: AppSettings): Promise<AppSettings> => {
    const uid = getActorUid();
    const schoolName = clampString(payload.schoolName, LIMITS.SCHOOL_NAME_MAX);
    const academicYear = clampString(payload.academicYear, LIMITS.ACADEMIC_YEAR_MAX);
    const labManager = clampString(payload.labManager, LIMITS.RECORDER_MAX);
    if (!schoolName || !academicYear || !labManager) {
      throw new Error('กรุณากรอกข้อมูลโรงเรียน ปีการศึกษา และผู้รับผิดชอบให้ครบถ้วน');
    }
    const colors = sanitizeThemeColors(payload.colors);
    const path = 'settings/app';
    try {
      const ref = doc(db, 'settings', 'app');
      const snap = await getDoc(ref);
      const existingData = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      const existingScheduleTimes = snap.exists()
        ? sanitizeScheduleTimes(existingData.scheduleTimes)
        : sanitizeScheduleTimes(payload.scheduleTimes);
      const nextLabManagers = sanitizeLabManagers(
        payload.labManagers ?? existingData.labManagers,
        labManager
      );

      if (snap.exists()) {
        await updateDoc(ref, {
          schoolName,
          academicYear,
          labManager,
          labManagers: nextLabManagers,
          colors,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          schoolName,
          academicYear,
          labManager,
          labManagers: nextLabManagers,
          colors,
          usageTypes: [...DEFAULT_USAGE_TYPES],
          scheduleTimes: existingScheduleTimes,
          ownerId: uid,
          visibility: 'school',
          updatedAt: serverTimestamp(),
        });
      }
      return {
        schoolName,
        academicYear,
        labManager,
        labManagers: nextLabManagers,
        colors,
        scheduleTimes: existingScheduleTimes,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  updateLabManagers: async (
    primaryManager: string,
    managers: string[]
  ): Promise<{ labManager: string; labManagers: string[] }> => {
    const uid = getActorUid();
    const seen = new Set<string>();
    const cleanedList: string[] = [];

    for (const entry of managers) {
      const trimmed = clampString(entry, LIMITS.RECORDER_MAX);
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      cleanedList.push(trimmed);
      if (cleanedList.length >= MAX_LAB_MANAGERS) break;
    }

    if (cleanedList.length === 0) {
      throw new Error('ต้องมีรายชื่อผู้รับผิดชอบห้องคอมพิวเตอร์อย่างน้อย 1 คน');
    }

    const cleanPrimary = clampString(primaryManager, LIMITS.RECORDER_MAX);
    const resolvedPrimary =
      cleanPrimary && seen.has(cleanPrimary) ? cleanPrimary : cleanedList[0];

    const path = 'settings/app';
    try {
      const ref = doc(db, 'settings', 'app');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, {
          labManager: resolvedPrimary,
          labManagers: cleanedList,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          schoolName: DEFAULT_SETTINGS.schoolName,
          academicYear: DEFAULT_SETTINGS.academicYear,
          labManager: resolvedPrimary,
          labManagers: cleanedList,
          colors: sanitizeThemeColors(),
          usageTypes: [...DEFAULT_USAGE_TYPES],
          scheduleTimes: sanitizeScheduleTimes(undefined),
          ownerId: uid,
          visibility: 'school',
          updatedAt: serverTimestamp(),
        });
      }
      return {
        labManager: resolvedPrimary,
        labManagers: cleanedList,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  updateScheduleTimes: async (
    payload: ScheduleTimeSettings,
    role: UserRole
  ): Promise<ScheduleTimeSettings> => {
    const uid = getActorUid();
    if (role !== 'admin') {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์แก้ไขเวลาคาบสอนและพักกลางวัน');
    }

    if (!payload || !Array.isArray(payload.periods) || payload.periods.length !== 6) {
      throw new Error('ข้อมูลคาบสอนต้องมีครบทั้ง 6 คาบ');
    }

    const validatedPeriods = payload.periods.map((p, idx) => {
      const range = assertValidBookingTimeRange(p.startTime, p.endTime);
      const label = clampString(p.label, 40) || `คาบที่ ${idx + 1}`;
      return {
        period: idx + 1,
        label,
        startTime: range.startTime,
        endTime: range.endTime,
      };
    });

    const lunchRange = assertValidBookingTimeRange(
      payload.lunchBreak?.startTime || '',
      payload.lunchBreak?.endTime || ''
    );

    const nextScheduleTimes: ScheduleTimeSettings = {
      periods: validatedPeriods,
      lunchBreak: {
        startTime: lunchRange.startTime,
        endTime: lunchRange.endTime,
      },
    };

    const path = 'settings/app';
    try {
      const ref = doc(db, 'settings', 'app');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, {
          scheduleTimes: nextScheduleTimes,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          schoolName: DEFAULT_SETTINGS.schoolName,
          academicYear: DEFAULT_SETTINGS.academicYear,
          labManager: DEFAULT_SETTINGS.labManager,
          labManagers: sanitizeLabManagers(undefined, DEFAULT_SETTINGS.labManager),
          colors: sanitizeThemeColors(),
          usageTypes: [...DEFAULT_USAGE_TYPES],
          scheduleTimes: nextScheduleTimes,
          ownerId: uid,
          visibility: 'school',
          updatedAt: serverTimestamp(),
        });
      }
      return nextScheduleTimes;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  // Bulk Data Clear
  clearUsageLogsOnly: async (): Promise<{ deletedCount: number }> => {
    getActorUid();
    try {
      const snap = await getDocs(
        query(collection(db, 'logs'), where('visibility', '==', 'school'))
      );
      const deletedCount = await deleteDocRefsInChunks(
        snap.docs.map((d) => d.ref),
        'logs'
      );
      return { deletedCount };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'logs');
    }
  },

  clearAllData: async (): Promise<{
    deletedLogs: number;
    deletedStudents: number;
    deletedSubjects: number;
  }> => {
    getActorUid();
    try {
      const [logsSnap, stuSnap, subSnap] = await Promise.all([
        getDocs(query(collection(db, 'logs'), where('visibility', '==', 'school'))),
        getDocs(query(collection(db, 'students'), where('visibility', '==', 'school'))),
        getDocs(query(collection(db, 'subjects'), where('visibility', '==', 'school'))),
      ]);

      const [deletedLogs, deletedStudents, deletedSubjects] = await Promise.all([
        deleteDocRefsInChunks(
          logsSnap.docs.map((d) => d.ref),
          'logs'
        ),
        deleteDocRefsInChunks(
          stuSnap.docs.map((d) => d.ref),
          'students'
        ),
        deleteDocRefsInChunks(
          subSnap.docs.map((d) => d.ref),
          'subjects'
        ),
      ]);

      return { deletedLogs, deletedStudents, deletedSubjects };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'data/all');
    }
  },

  // Room Bookings (Anyone can book; only Admin can approve/reject/delete)
  createBooking: async (payload: {
    bookingMode: BookingMode;
    date: string;
    startTime: string;
    endTime: string;
    computerRoom: string;
    computerNumber?: string;
    requesterName: string;
    className: string;
    subjectName: string;
    seatCount: number;
    note?: string;
  }): Promise<RoomBooking> => {
    const uid = getActorUid();
    const bookingMode: BookingMode =
      payload.bookingMode === 'individual' ? 'individual' : 'full_room';
    const date = assertValidIsoDate(payload.date);
    const { startTime, endTime } = assertValidBookingTimeRange(payload.startTime, payload.endTime);
    const computerRoom = clampString(payload.computerRoom, LIMITS.ROOM_MAX);
    const computerNumber =
      bookingMode === 'individual'
        ? clampString(payload.computerNumber, LIMITS.STATION_MAX)
        : '';
    const requesterName = clampString(payload.requesterName, LIMITS.NAME_MAX);
    const className = clampString(payload.className, LIMITS.BOOKING_CLASS_MAX);
    const subjectName = clampString(payload.subjectName, LIMITS.NAME_MAX);
    const note = clampString(payload.note, LIMITS.NOTE_MAX);
    const seatCount =
      bookingMode === 'individual'
        ? 1
        : Math.max(1, Math.min(100, Math.round(Number(payload.seatCount) || 30)));

    if (!computerRoom || !requesterName || className.length < 2 || !subjectName) {
      throw new Error('กรุณากรอกข้อมูลการจองให้ครบถ้วน');
    }
    if (bookingMode === 'individual' && !computerNumber) {
      throw new Error('กรุณาเลือกหมายเลขเครื่องที่ต้องการจอง');
    }

    try {
      const existingSnap = await getDocs(
        query(collection(db, 'bookings'), where('visibility', '==', 'school'))
      );
      const existingBookings = existingSnap.docs.map((d) =>
        mapBooking(d.id, d.data() as Record<string, unknown>)
      );
      const conflict = findApprovedBookingConflict(
        {
          bookingMode,
          date,
          startTime,
          endTime,
          computerRoom,
          computerNumber,
        },
        existingBookings
      );
      if (conflict) {
        const conflictTarget =
          conflict.bookingMode === 'full_room'
            ? 'จองเครื่องทั้งห้อง'
            : `เครื่องที่ ${conflict.computerNumber || '-'}`;
        throw new Error(
          `ห้อง ${computerRoom} (${conflictTarget}) เวลา ${conflict.startTime}–${conflict.endTime} น. ได้รับอนุญาตให้ "${conflict.requesterName}" จองไว้แล้ว`
        );
      }

      const id = generateId('book');
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, 'bookings', id), {
        bookingMode,
        date,
        startTime,
        endTime,
        computerRoom,
        computerNumber,
        requesterName,
        className,
        subjectName,
        seatCount,
        note,
        status: 'pending',
        decisionNote: '',
        decidedBy: '',
        ownerId: uid,
        visibility: 'school',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        id,
        bookingMode,
        date,
        startTime,
        endTime,
        computerRoom,
        computerNumber,
        requesterName,
        className,
        subjectName,
        seatCount,
        note,
        status: 'pending',
        decisionNote: '',
        decidedBy: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes('ได้รับอนุญาตให้')) {
        throw err;
      }
      handleFirestoreError(err, OperationType.CREATE, 'bookings');
    }
  },

  decideBooking: async (
    id: string,
    decision: {
      status: 'approved' | 'rejected';
      decisionNote?: string;
      decidedBy: string;
      role: UserRole;
    }
  ): Promise<RoomBooking> => {
    getActorUid();
    if (decision.role !== 'admin') {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์อนุญาตหรือไม่อนุญาตการจอง');
    }
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสการจองไม่ถูกต้อง');

    const decidedBy = clampString(decision.decidedBy, LIMITS.RECORDER_MAX) || 'ผู้ดูแลระบบ';
    const decisionNote = clampString(decision.decisionNote, LIMITS.NOTE_MAX);
    const path = `bookings/${safeId}`;

    try {
      const ref = doc(db, 'bookings', safeId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw new Error('ไม่พบรายการจองที่ต้องการพิจารณา');
      }
      const existingBooking = mapBooking(snap.id, snap.data() as Record<string, unknown>);

      if (decision.status === 'approved') {
        const allSnap = await getDocs(
          query(collection(db, 'bookings'), where('visibility', '==', 'school'))
        );
        const allBookings = allSnap.docs.map((d) =>
          mapBooking(d.id, d.data() as Record<string, unknown>)
        );
        const conflict = findApprovedBookingConflict(existingBooking, allBookings);
        if (conflict) {
          const conflictTarget =
            conflict.bookingMode === 'full_room'
              ? 'จองเครื่องทั้งห้อง'
              : `เครื่องที่ ${conflict.computerNumber || '-'}`;
          throw new Error(
            `ไม่สามารถอนุญาตซ้อนได้: ห้อง ${conflict.computerRoom} (${conflictTarget}) เวลา ${conflict.startTime}–${conflict.endTime} น. อนุญาตให้ "${conflict.requesterName}" ไปแล้ว`
          );
        }
      }

      await updateDoc(ref, {
        status: decision.status,
        decisionNote,
        decidedBy,
        updatedAt: serverTimestamp(),
      });

      return {
        ...existingBooking,
        status: decision.status,
        decisionNote,
        decidedBy,
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('ไม่สามารถอนุญาตซ้อนได้') || err.message.includes('ไม่พบรายการจอง'))
      ) {
        throw err;
      }
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  },

  deleteBooking: async (id: string, role: UserRole): Promise<{ ok: boolean }> => {
    getActorUid();
    if (role !== 'admin') {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์ลบรายการจอง');
    }
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสการจองไม่ถูกต้อง');
    try {
      await deleteDoc(doc(db, 'bookings', safeId));
      return { ok: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `bookings/${safeId}`);
    }
  },

  upsertTeachingScheduleSlot: async (
    payload: {
      computerRoom: string;
      dayOfWeek: DayOfWeek;
      period: number;
      startTime: string;
      endTime: string;
      className: string;
      subjectName: string;
      teacherName: string;
      note?: string;
    },
    role: UserRole
  ): Promise<TeachingScheduleSlot> => {
    const uid = getActorUid();
    if (role !== 'admin') {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์จัดการตารางคาบสอน');
    }
    const computerRoom = clampString(payload.computerRoom, LIMITS.ROOM_MAX);
    const dayOfWeek: DayOfWeek =
      payload.dayOfWeek === 'tue' ||
      payload.dayOfWeek === 'wed' ||
      payload.dayOfWeek === 'thu' ||
      payload.dayOfWeek === 'fri'
        ? payload.dayOfWeek
        : 'mon';
    const period = Math.max(1, Math.min(8, Math.round(Number(payload.period) || 1)));
    const { startTime, endTime } = assertValidBookingTimeRange(payload.startTime, payload.endTime);
    const className = clampString(payload.className, LIMITS.BOOKING_CLASS_MAX);
    const subjectName = clampString(payload.subjectName, LIMITS.NAME_MAX);
    const teacherName = clampString(payload.teacherName, LIMITS.NAME_MAX);
    const note = clampString(payload.note, LIMITS.SUBJECT_NOTE_MAX);

    if (!computerRoom || !className || !subjectName || !teacherName) {
      throw new Error('กรุณากรอกข้อมูลคาบสอน (ห้อง ชั้นเรียน วิชา และครูผู้สอน) ให้ครบถ้วน');
    }

    const id = makeScheduleDocId(computerRoom, dayOfWeek, period);
    const path = `teachingSchedules/${id}`;
    const nowIso = new Date().toISOString();

    try {
      const ref = doc(db, 'teachingSchedules', id);
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) {
        await updateDoc(ref, {
          computerRoom,
          dayOfWeek,
          period,
          startTime,
          endTime,
          className,
          subjectName,
          teacherName,
          note,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          computerRoom,
          dayOfWeek,
          period,
          startTime,
          endTime,
          className,
          subjectName,
          teacherName,
          note,
          ownerId: uid,
          visibility: 'school',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      return {
        id,
        computerRoom,
        dayOfWeek,
        period,
        startTime,
        endTime,
        className,
        subjectName,
        teacherName,
        note,
        createdAt: existingSnap.exists()
          ? toIsoString(existingSnap.data().createdAt)
          : nowIso,
        updatedAt: nowIso,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  deleteTeachingScheduleSlot: async (id: string, role: UserRole): Promise<{ ok: boolean }> => {
    getActorUid();
    if (role !== 'admin') {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์ลบคาบสอน');
    }
    const safeId = sanitizeId(id);
    if (!safeId) throw new Error('รหัสคาบสอนไม่ถูกต้อง');
    try {
      await deleteDoc(doc(db, 'teachingSchedules', safeId));
      return { ok: true };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `teachingSchedules/${safeId}`);
    }
  },

  seedDefaultTeachingSchedules: async (
    defaultTeacher: string,
    role: UserRole
  ): Promise<TeachingScheduleSlot[]> => {
    const uid = getActorUid();
    if (role !== 'admin') {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์สร้างตัวอย่างตารางคาบสอน');
    }
    const teacher = clampString(defaultTeacher, LIMITS.NAME_MAX) || 'ครูธนากร สุขสวัสดิ์';
    const sampleDefs: Array<{
      computerRoom: string;
      dayOfWeek: DayOfWeek;
      period: number;
      className: string;
      subjectName: string;
      teacherName: string;
    }> = [
      { computerRoom: 'คอม1', dayOfWeek: 'mon', period: 1, className: 'ป.4/1', subjectName: 'วิทยาการคำนวณ', teacherName: teacher },
      { computerRoom: 'คอม1', dayOfWeek: 'mon', period: 2, className: 'ป.4/2', subjectName: 'วิทยาการคำนวณ', teacherName: teacher },
      { computerRoom: 'คอม1', dayOfWeek: 'tue', period: 1, className: 'ป.5/1', subjectName: 'เทคโนโลยีสารสนเทศ', teacherName: teacher },
      { computerRoom: 'คอม1', dayOfWeek: 'tue', period: 4, className: 'ป.5/2', subjectName: 'เทคโนโลยีสารสนเทศ', teacherName: teacher },
      { computerRoom: 'คอม1', dayOfWeek: 'wed', period: 2, className: 'ป.6/1', subjectName: 'วิทยาการคำนวณ', teacherName: teacher },
      { computerRoom: 'คอม1', dayOfWeek: 'thu', period: 1, className: 'ป.3/1', subjectName: 'วิทยาการคำนวณ', teacherName: teacher },
      { computerRoom: 'คอม1', dayOfWeek: 'fri', period: 2, className: 'ป.6/2', subjectName: 'โครงงานคอมพิวเตอร์', teacherName: teacher },
      { computerRoom: 'คอม2', dayOfWeek: 'mon', period: 4, className: 'ป.1/1', subjectName: 'ฝึกพิมพ์และสื่อการเรียน', teacherName: 'ครูศิริพร แก้วมณี' },
      { computerRoom: 'คอม2', dayOfWeek: 'tue', period: 2, className: 'ป.2/1', subjectName: 'วิทยาการคำนวณ', teacherName: 'ครูศิริพร แก้วมณี' },
      { computerRoom: 'คอม2', dayOfWeek: 'wed', period: 4, className: 'ป.3/2', subjectName: 'เทคโนโลยีสารสนเทศ', teacherName: 'ครูศิริพร แก้วมณี' },
      { computerRoom: 'คอม2', dayOfWeek: 'thu', period: 2, className: 'ป.4/3', subjectName: 'วิทยาศาสตร์', teacherName: 'ครูศิริพร แก้วมณี' },
      { computerRoom: 'คอม2', dayOfWeek: 'fri', period: 4, className: 'ป.5/3', subjectName: 'ภาษาอังกฤษ', teacherName: 'ครูศิริพร แก้วมณี' },
    ];

    const nowIso = new Date().toISOString();
    const created: TeachingScheduleSlot[] = [];

    try {
      const batch = writeBatch(db);
      for (const def of sampleDefs) {
        const periodCfg = TEACHING_PERIODS.find((p) => p.period === def.period) || TEACHING_PERIODS[0];
        const id = makeScheduleDocId(def.computerRoom, def.dayOfWeek, def.period);
        batch.set(doc(db, 'teachingSchedules', id), {
          computerRoom: def.computerRoom,
          dayOfWeek: def.dayOfWeek,
          period: def.period,
          startTime: periodCfg.startTime,
          endTime: periodCfg.endTime,
          className: def.className,
          subjectName: def.subjectName,
          teacherName: def.teacherName,
          note: '',
          ownerId: uid,
          visibility: 'school',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created.push({
          id,
          computerRoom: def.computerRoom,
          dayOfWeek: def.dayOfWeek,
          period: def.period,
          startTime: periodCfg.startTime,
          endTime: periodCfg.endTime,
          className: def.className,
          subjectName: def.subjectName,
          teacherName: def.teacherName,
          note: '',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
      await batch.commit();
      return created;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'teachingSchedules');
    }
  },

  exportFullBackup: async (): Promise<FullBackupPayload> => {
    try {
      const [settingsSnap, stuSnap, subSnap, logSnap, bookSnap, schSnap] = await Promise.all([
        getDocServerOrCache(doc(db, 'settings', 'app')),
        getDocsServerOrCache(query(collection(db, 'students'), where('visibility', '==', 'school'))),
        getDocsServerOrCache(query(collection(db, 'subjects'), where('visibility', '==', 'school'))),
        getDocsServerOrCache(query(collection(db, 'logs'), where('visibility', '==', 'school'))),
        getDocsServerOrCache(query(collection(db, 'bookings'), where('visibility', '==', 'school'))),
        getDocsServerOrCache(
          query(collection(db, 'teachingSchedules'), where('visibility', '==', 'school'))
        ),
      ]);

      const mappedSettings = settingsSnap.exists()
        ? mapSettings(settingsSnap.data() as Record<string, unknown>)
        : { settings: DEFAULT_SETTINGS, usageTypes: [...DEFAULT_USAGE_TYPES] };

      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: mappedSettings.settings,
        usageTypes: mappedSettings.usageTypes,
        students: stuSnap.docs.map((d) => mapStudent(d.id, d.data() as Record<string, unknown>)),
        subjects: subSnap.docs.map((d) => mapSubject(d.id, d.data() as Record<string, unknown>)),
        logs: logSnap.docs.map((d) => mapUsageLog(d.id, d.data() as Record<string, unknown>)),
        bookings: bookSnap.docs.map((d) => mapBooking(d.id, d.data() as Record<string, unknown>)),
        teachingSchedules: schSnap.docs.map((d) =>
          mapTeachingSchedule(d.id, d.data() as Record<string, unknown>)
        ),
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'backup/export');
    }
  },

  restoreFullBackup: async (
    raw: unknown
  ): Promise<{
    students: number;
    subjects: number;
    logs: number;
    bookings: number;
    teachingSchedules: number;
    settingsUpdated: boolean;
  }> => {
    const uid = getActorUid();
    if (!raw || typeof raw !== 'object') {
      throw new Error('รูปแบบไฟล์สำรองข้อมูลไม่ถูกต้อง');
    }
    const payload = raw as Partial<FullBackupPayload>;
    const rawStudents = Array.isArray(payload.students) ? payload.students : [];
    const rawSubjects = Array.isArray(payload.subjects) ? payload.subjects : [];
    const rawLogs = Array.isArray(payload.logs) ? payload.logs : [];
    const rawBookings = Array.isArray(payload.bookings) ? payload.bookings : [];
    const rawSchedules = Array.isArray(payload.teachingSchedules) ? payload.teachingSchedules : [];

    if (
      rawStudents.length === 0 &&
      rawSubjects.length === 0 &&
      rawLogs.length === 0 &&
      rawBookings.length === 0 &&
      rawSchedules.length === 0 &&
      !payload.settings
    ) {
      throw new Error('ไม่พบข้อมูลสำหรับกู้คืนในไฟล์สำรองนี้');
    }

    try {
      const [settingsSnap, stuSnap, subSnap, logSnap, bookSnap, schSnap] = await Promise.all([
        getDocServerOrCache(doc(db, 'settings', 'app')),
        getDocsServerOrCache(query(collection(db, 'students'), where('visibility', '==', 'school'))),
        getDocsServerOrCache(query(collection(db, 'subjects'), where('visibility', '==', 'school'))),
        getDocsServerOrCache(query(collection(db, 'logs'), where('visibility', '==', 'school'))),
        getDocsServerOrCache(query(collection(db, 'bookings'), where('visibility', '==', 'school'))),
        getDocsServerOrCache(
          query(collection(db, 'teachingSchedules'), where('visibility', '==', 'school'))
        ),
      ]);

      const existingStuIds = new Set(stuSnap.docs.map((d) => d.id));
      const existingSubIds = new Set(subSnap.docs.map((d) => d.id));
      const existingLogIds = new Set(logSnap.docs.map((d) => d.id));
      const existingBookIds = new Set(bookSnap.docs.map((d) => d.id));
      const existingSchIds = new Set(schSnap.docs.map((d) => d.id));

      type BatchOp =
        | { type: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown> }
        | { type: 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown> };

      const phase1Ops: BatchOp[] = [];
      const phase2BookingFollowups: BatchOp[] = [];

      let settingsUpdated = false;
      if (payload.settings || Array.isArray(payload.usageTypes)) {
        const currentMapped = settingsSnap.exists()
          ? mapSettings(settingsSnap.data() as Record<string, unknown>)
          : { settings: DEFAULT_SETTINGS, usageTypes: [...DEFAULT_USAGE_TYPES] };

        const incomingSettings = payload.settings || currentMapped.settings;
        const schoolName =
          clampString(incomingSettings.schoolName, LIMITS.SCHOOL_NAME_MAX) ||
          currentMapped.settings.schoolName;
        const academicYear =
          clampString(incomingSettings.academicYear, LIMITS.ACADEMIC_YEAR_MAX) ||
          currentMapped.settings.academicYear;
        const cleanYear = academicYear.length >= 4 ? academicYear : DEFAULT_SETTINGS.academicYear;
        const labManager =
          clampString(incomingSettings.labManager, LIMITS.RECORDER_MAX) ||
          currentMapped.settings.labManager;
        const labManagers = sanitizeLabManagers(incomingSettings.labManagers, labManager);
        const colors = sanitizeThemeColors(incomingSettings.colors || currentMapped.settings.colors);
        const usageTypes = sanitizeUsageTypes(
          Array.isArray(payload.usageTypes) ? payload.usageTypes : currentMapped.usageTypes,
          LIMITS.USAGE_TYPES_PRESET_MAX
        );
        const scheduleTimes = sanitizeScheduleTimes(
          incomingSettings.scheduleTimes || currentMapped.settings.scheduleTimes
        );

        const settingsRef = doc(db, 'settings', 'app');
        if (settingsSnap.exists()) {
          phase1Ops.push({
            type: 'update',
            ref: settingsRef,
            data: {
              schoolName,
              academicYear: cleanYear,
              labManager,
              labManagers,
              colors,
              usageTypes,
              scheduleTimes,
              updatedAt: serverTimestamp(),
            },
          });
        } else {
          phase1Ops.push({
            type: 'set',
            ref: settingsRef,
            data: {
              schoolName,
              academicYear: cleanYear,
              labManager,
              labManagers,
              colors,
              usageTypes,
              scheduleTimes,
              ownerId: uid,
              visibility: 'school',
              updatedAt: serverTimestamp(),
            },
          });
        }
        settingsUpdated = true;
      }

      let studentsCount = 0;
      for (const stu of rawStudents) {
        if (!stu || typeof stu !== 'object') continue;
        const name = clampString(stu.name, LIMITS.NAME_MAX);
        if (!name) continue;
        let className: string;
        try {
          className = assertValidClassName(stu.className);
        } catch {
          continue;
        }
        const id = sanitizeId(stu.id) || generateId('stu');
        const numberVal =
          typeof stu.number === 'number' && Number.isInteger(stu.number) && stu.number >= 1
            ? Math.min(999, stu.number)
            : null;
        const ref = doc(db, 'students', id);
        if (existingStuIds.has(id)) {
          phase1Ops.push({
            type: 'update',
            ref,
            data: { number: numberVal, name, className, updatedAt: serverTimestamp() },
          });
        } else {
          phase1Ops.push({
            type: 'set',
            ref,
            data: {
              number: numberVal,
              name,
              className,
              ownerId: uid,
              visibility: 'school',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });
        }
        studentsCount += 1;
      }

      let subjectsCount = 0;
      for (const sub of rawSubjects) {
        if (!sub || typeof sub !== 'object') continue;
        const name = clampString(sub.name, LIMITS.NAME_MAX);
        if (!name) continue;
        const code = clampString(sub.code, LIMITS.CODE_MAX);
        const note = clampString(sub.note, LIMITS.SUBJECT_NOTE_MAX);
        const id = sanitizeId(sub.id) || generateId('sub');
        const ref = doc(db, 'subjects', id);
        if (existingSubIds.has(id)) {
          phase1Ops.push({
            type: 'update',
            ref,
            data: { name, code, note, updatedAt: serverTimestamp() },
          });
        } else {
          phase1Ops.push({
            type: 'set',
            ref,
            data: {
              name,
              code,
              note,
              ownerId: uid,
              visibility: 'school',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });
        }
        subjectsCount += 1;
      }

      let logsCount = 0;
      for (const log of rawLogs) {
        if (!log || typeof log !== 'object') continue;
        let docData: Record<string, unknown>;
        try {
          docData = buildUsageLogDoc(
            {
              date: log.date,
              timeIn: log.timeIn,
              computerRoom: log.computerRoom,
              computerNumber: log.computerNumber,
              studentId: log.studentId,
              studentName: log.studentName,
              className: log.className,
              subjectId: log.subjectId,
              subjectName: log.subjectName,
              usageTypes: Array.isArray(log.usageTypes) ? log.usageTypes : [],
              note: log.note,
              recorder: log.recorder || DEFAULT_SETTINGS.labManager,
            },
            uid,
            false
          );
        } catch {
          continue;
        }
        const id = sanitizeId(log.id) || generateId('log');
        const ref = doc(db, 'logs', id);
        if (existingLogIds.has(id)) {
          phase1Ops.push({ type: 'update', ref, data: docData });
        } else {
          phase1Ops.push({
            type: 'set',
            ref,
            data: {
              ...docData,
              ownerId: uid,
              visibility: 'school',
              createdAt: serverTimestamp(),
            },
          });
        }
        logsCount += 1;
      }

      let bookingsCount = 0;
      for (const b of rawBookings) {
        if (!b || typeof b !== 'object') continue;
        let date: string;
        let startTime: string;
        let endTime: string;
        try {
          date = assertValidIsoDate(b.date);
          const range = assertValidBookingTimeRange(b.startTime, b.endTime);
          startTime = range.startTime;
          endTime = range.endTime;
        } catch {
          continue;
        }
        const bookingMode: BookingMode = b.bookingMode === 'individual' ? 'individual' : 'full_room';
        const computerRoom = clampString(b.computerRoom, LIMITS.ROOM_MAX);
        const computerNumber =
          bookingMode === 'individual' ? clampString(b.computerNumber, LIMITS.STATION_MAX) : '';
        const requesterName = clampString(b.requesterName, LIMITS.NAME_MAX);
        const className = clampString(b.className, LIMITS.BOOKING_CLASS_MAX);
        const subjectName = clampString(b.subjectName, LIMITS.NAME_MAX);
        if (!computerRoom || !requesterName || className.length < 2 || !subjectName) continue;
        if (bookingMode === 'individual' && !computerNumber) continue;

        const seatCount =
          bookingMode === 'individual'
            ? 1
            : Math.max(1, Math.min(100, Math.round(Number(b.seatCount) || 30)));
        const note = clampString(b.note, LIMITS.NOTE_MAX);
        const status: BookingStatus =
          b.status === 'approved' || b.status === 'rejected' ? b.status : 'pending';
        const decisionNote = clampString(b.decisionNote, LIMITS.NOTE_MAX);
        const decidedBy = clampString(b.decidedBy, LIMITS.RECORDER_MAX);

        const id = sanitizeId(b.id) || generateId('book');
        const ref = doc(db, 'bookings', id);
        if (existingBookIds.has(id)) {
          phase1Ops.push({
            type: 'update',
            ref,
            data: {
              status,
              decisionNote,
              decidedBy,
              updatedAt: serverTimestamp(),
            },
          });
        } else {
          // firestore.rules requires bookings create to start as pending with empty decision fields
          phase1Ops.push({
            type: 'set',
            ref,
            data: {
              bookingMode,
              date,
              startTime,
              endTime,
              computerRoom,
              computerNumber,
              requesterName,
              className,
              subjectName,
              seatCount,
              note,
              status: 'pending',
              decisionNote: '',
              decidedBy: '',
              ownerId: uid,
              visibility: 'school',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });
          if (status !== 'pending' || decisionNote || decidedBy) {
            phase2BookingFollowups.push({
              type: 'update',
              ref,
              data: {
                status,
                decisionNote,
                decidedBy,
                updatedAt: serverTimestamp(),
              },
            });
          }
        }
        bookingsCount += 1;
      }

      let schedulesCount = 0;
      for (const s of rawSchedules) {
        if (!s || typeof s !== 'object') continue;
        let startTime: string;
        let endTime: string;
        try {
          const range = assertValidBookingTimeRange(s.startTime, s.endTime);
          startTime = range.startTime;
          endTime = range.endTime;
        } catch {
          continue;
        }
        const computerRoom = clampString(s.computerRoom, LIMITS.ROOM_MAX);
        const dayOfWeek: DayOfWeek =
          s.dayOfWeek === 'tue' ||
          s.dayOfWeek === 'wed' ||
          s.dayOfWeek === 'thu' ||
          s.dayOfWeek === 'fri'
            ? s.dayOfWeek
            : 'mon';
        const period = Math.max(1, Math.min(8, Math.round(Number(s.period) || 1)));
        const className = clampString(s.className, LIMITS.BOOKING_CLASS_MAX);
        const subjectName = clampString(s.subjectName, LIMITS.NAME_MAX);
        const teacherName = clampString(s.teacherName, LIMITS.NAME_MAX);
        const note = clampString(s.note, LIMITS.SUBJECT_NOTE_MAX);
        if (!computerRoom || !className || !subjectName || !teacherName) continue;

        const id = sanitizeId(s.id) || makeScheduleDocId(computerRoom, dayOfWeek, period);
        const ref = doc(db, 'teachingSchedules', id);
        if (existingSchIds.has(id)) {
          phase1Ops.push({
            type: 'update',
            ref,
            data: {
              computerRoom,
              dayOfWeek,
              period,
              startTime,
              endTime,
              className,
              subjectName,
              teacherName,
              note,
              updatedAt: serverTimestamp(),
            },
          });
        } else {
          phase1Ops.push({
            type: 'set',
            ref,
            data: {
              computerRoom,
              dayOfWeek,
              period,
              startTime,
              endTime,
              className,
              subjectName,
              teacherName,
              note,
              ownerId: uid,
              visibility: 'school',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });
        }
        schedulesCount += 1;
      }

      const commitOps = async (ops: BatchOp[]) => {
        const CHUNK = 400;
        for (let i = 0; i < ops.length; i += CHUNK) {
          const batch = writeBatch(db);
          for (const op of ops.slice(i, i + CHUNK)) {
            if (op.type === 'set') {
              batch.set(op.ref, op.data);
            } else {
              batch.update(op.ref, op.data);
            }
          }
          await batch.commit();
        }
      };

      await commitOps(phase1Ops);
      if (phase2BookingFollowups.length > 0) {
        await commitOps(phase2BookingFollowups);
      }

      return {
        students: studentsCount,
        subjects: subjectsCount,
        logs: logsCount,
        bookings: bookingsCount,
        teachingSchedules: schedulesCount,
        settingsUpdated,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'backup/restore');
    }
  },
};

export interface FullBackupPayload {
  version: number;
  exportedAt: string;
  settings: AppSettings;
  usageTypes: string[];
  students: Student[];
  subjects: Subject[];
  logs: UsageLog[];
  bookings: RoomBooking[];
  teachingSchedules: TeachingScheduleSlot[];
}

export function subscribeSecurityPins(
  onPins: (hashes: PinHashes) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'security/pins';
  return onSnapshot(
    doc(db, 'security', 'pins'),
    async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        if (
          typeof data.adminPinHash === 'string' &&
          /^[a-f0-9]{64}$/.test(data.adminPinHash) &&
          typeof data.userPinHash === 'string' &&
          /^[a-f0-9]{64}$/.test(data.userPinHash)
        ) {
          const hashes: PinHashes = {
            adminPinHash: data.adminPinHash,
            userPinHash: data.userPinHash,
            extraAdmins: sanitizeExtraAdmins(data.extraAdmins),
          };
          setCachedPinHashes(hashes);
          onPins(hashes);
          return;
        }
      }
      const defaults = await getDefaultPinHashes();
      setCachedPinHashes(defaults);
      onPins(defaults);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

async function persistSecurityPinsDoc(nextHashes: PinHashes): Promise<PinHashes> {
  const uid = getActorUid();
  const extraAdmins = sanitizeExtraAdmins(nextHashes.extraAdmins);
  const path = 'security/pins';
  const ref = doc(db, 'security', 'pins');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        adminPinHash: nextHashes.adminPinHash,
        userPinHash: nextHashes.userPinHash,
        extraAdmins,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        adminPinHash: nextHashes.adminPinHash,
        userPinHash: nextHashes.userPinHash,
        extraAdmins,
        ownerId: uid,
        updatedAt: serverTimestamp(),
      });
    }
    const normalized: PinHashes = {
      adminPinHash: nextHashes.adminPinHash,
      userPinHash: nextHashes.userPinHash,
      extraAdmins,
    };
    setCachedPinHashes(normalized);
    return normalized;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateSecurityPins(
  adminPin6: string | null,
  userPin6: string | null,
  currentHashes?: PinHashes | null,
  actorAdminId?: string
): Promise<PinHashes> {
  getActorUid();
  if (actorAdminId) {
    throw new Error('ผู้ดูแลระบบเพิ่มเติมไม่มีสิทธิ์แก้ไขรหัส PIN หลักหรือรหัสของผู้อื่น');
  }
  if (adminPin6 !== null && !isValidPin6(adminPin6)) {
    throw new Error('รหัส PIN ผู้ดูแลระบบต้องเป็นตัวเลข 6 หลัก');
  }
  if (userPin6 !== null && !isValidPin6(userPin6)) {
    throw new Error('รหัส PIN ผู้ใช้งานทั่วไปต้องเป็นตัวเลข 6 หลัก');
  }

  const base = currentHashes ?? (await getDefaultPinHashes());
  const extraAdmins = sanitizeExtraAdmins(base.extraAdmins);
  const nextAdminHash = adminPin6 !== null ? await hashPin6(adminPin6) : base.adminPinHash;
  const nextUserHash = userPin6 !== null ? await hashPin6(userPin6) : base.userPinHash;

  if (nextAdminHash === nextUserHash) {
    throw new Error('รหัส PIN 6 หลักของ Admin และ User ต้องไม่ซ้ำกัน');
  }
  if (extraAdmins.some((a) => a.pinHash === nextAdminHash || a.pinHash === nextUserHash)) {
    throw new Error('รหัส PIN 6 หลักนี้ซ้ำกับรหัสของผู้ดูแลระบบเพิ่มเติมที่มีอยู่แล้ว');
  }

  return persistSecurityPinsDoc({
    adminPinHash: nextAdminHash,
    userPinHash: nextUserHash,
    extraAdmins,
  });
}

export async function addExtraAdminPin(
  name: string,
  pin6: string,
  currentHashes?: PinHashes | null,
  actorAdminId?: string
): Promise<PinHashes> {
  getActorUid();
  if (actorAdminId) {
    throw new Error('เฉพาะผู้ดูแลระบบหลักเท่านั้นที่สามารถเพิ่มผู้ดูแลระบบเพิ่มเติมได้');
  }
  const cleanName = clampString(name, LIMITS.NAME_MAX);
  if (!cleanName) {
    throw new Error('กรุณาระบุชื่อผู้ดูแลระบบ');
  }
  if (!isValidPin6(pin6)) {
    throw new Error('รหัส PIN ใหม่ต้องเป็นตัวเลข 6 หลัก');
  }

  const base = currentHashes ?? (await getDefaultPinHashes());
  const extraAdmins = sanitizeExtraAdmins(base.extraAdmins);
  if (extraAdmins.length >= 4) {
    throw new Error('สามารถเพิ่มผู้ดูแลระบบเพิ่มเติมได้สูงสุด 4 คน');
  }

  const pinHash = await hashPin6(pin6);
  if (
    pinHash === base.adminPinHash ||
    pinHash === base.userPinHash ||
    extraAdmins.some((a) => a.pinHash === pinHash)
  ) {
    throw new Error('รหัส PIN 6 หลักนี้ถูกใช้งานแล้ว กรุณาตั้งรหัสใหม่ไม่ให้ซ้ำกัน');
  }

  const newEntry: ExtraAdminPin = {
    id: generateId('adm'),
    name: cleanName,
    pinHash,
    updatedAt: new Date().toISOString(),
  };

  return persistSecurityPinsDoc({
    adminPinHash: base.adminPinHash,
    userPinHash: base.userPinHash,
    extraAdmins: [...extraAdmins, newEntry],
  });
}

export async function updateExtraAdminPin(
  id: string,
  name: string,
  newPin6: string | null,
  currentHashes?: PinHashes | null,
  actorAdminId?: string
): Promise<PinHashes> {
  getActorUid();
  const safeId = sanitizeId(id);
  if (!safeId) throw new Error('รหัสอ้างอิงผู้ดูแลระบบไม่ถูกต้อง');
  if (actorAdminId && actorAdminId !== safeId) {
    throw new Error('ผู้ดูแลระบบเพิ่มเติมไม่สามารถดูหรือแก้ไขรหัสผ่านของผู้ดูแลระบบคนอื่นได้');
  }
  const cleanName = clampString(name, LIMITS.NAME_MAX);
  if (!cleanName) {
    throw new Error('กรุณาระบุชื่อผู้ดูแลระบบ');
  }
  if (newPin6 !== null && !isValidPin6(newPin6)) {
    throw new Error('รหัส PIN ใหม่ต้องเป็นตัวเลข 6 หลัก');
  }

  const base = currentHashes ?? (await getDefaultPinHashes());
  const extraAdmins = sanitizeExtraAdmins(base.extraAdmins);
  const existing = extraAdmins.find((a) => a.id === safeId);
  if (!existing) {
    throw new Error('ไม่พบข้อมูลผู้ดูแลระบบที่ต้องการแก้ไข');
  }

  const nextPinHash = newPin6 !== null ? await hashPin6(newPin6) : existing.pinHash;
  if (
    nextPinHash === base.adminPinHash ||
    nextPinHash === base.userPinHash ||
    extraAdmins.some((a) => a.id !== safeId && a.pinHash === nextPinHash)
  ) {
    throw new Error('รหัส PIN 6 หลักนี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น');
  }

  const nextExtraAdmins = extraAdmins.map((a) =>
    a.id === safeId
      ? {
          ...a,
          name: cleanName,
          pinHash: nextPinHash,
          updatedAt: new Date().toISOString(),
        }
      : a
  );

  return persistSecurityPinsDoc({
    adminPinHash: base.adminPinHash,
    userPinHash: base.userPinHash,
    extraAdmins: nextExtraAdmins,
  });
}

export async function deleteExtraAdminPin(
  id: string,
  currentHashes?: PinHashes | null,
  actorAdminId?: string
): Promise<PinHashes> {
  getActorUid();
  if (actorAdminId) {
    throw new Error('เฉพาะผู้ดูแลระบบหลักเท่านั้นที่สามารถลบผู้ดูแลระบบเพิ่มเติมได้');
  }
  const safeId = sanitizeId(id);
  if (!safeId) throw new Error('รหัสอ้างอิงผู้ดูแลระบบไม่ถูกต้อง');

  const base = currentHashes ?? (await getDefaultPinHashes());
  const extraAdmins = sanitizeExtraAdmins(base.extraAdmins);

  return persistSecurityPinsDoc({
    adminPinHash: base.adminPinHash,
    userPinHash: base.userPinHash,
    extraAdmins: extraAdmins.filter((a) => a.id !== safeId),
  });
}
