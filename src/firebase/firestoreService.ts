import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  DEFAULT_SETTINGS,
  DEFAULT_USAGE_TYPES,
  type AppSettings,
  type LabDatabase,
  type Student,
  type Subject,
  type UsageLog,
} from '../types';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import {
  assertValidClassName,
  assertValidIsoDate,
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
  setCachedPinHashes,
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

function mapSettings(data: Record<string, unknown>): {
  settings: AppSettings;
  usageTypes: string[];
} {
  const rawColors = (data.colors as Record<string, string> | undefined) || {};
  return {
    settings: {
      schoolName: String(data.schoolName || DEFAULT_SETTINGS.schoolName),
      academicYear: String(data.academicYear || DEFAULT_SETTINGS.academicYear),
      labManager: String(data.labManager || DEFAULT_SETTINGS.labManager),
      colors: sanitizeThemeColors(rawColors),
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

export async function seedInitialFirestoreIfEmpty(): Promise<void> {
  const uid = getActorUid();
  const settingsRef = doc(db, 'settings', 'app');

  try {
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/app');
  }

  // Try importing existing local data from /api/bootstrap if available, else default seed
  let seed: LabDatabase;
  try {
    const res = await fetch('/api/bootstrap');
    if (res.ok) {
      seed = (await res.json()) as LabDatabase;
    } else {
      seed = buildDefaultSeed();
    }
  } catch {
    seed = buildDefaultSeed();
  }

  const operations: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

  operations.push({
    ref: settingsRef,
    data: {
      schoolName: clampString(seed.settings?.schoolName || DEFAULT_SETTINGS.schoolName, LIMITS.SCHOOL_NAME_MAX),
      academicYear: clampString(seed.settings?.academicYear || DEFAULT_SETTINGS.academicYear, LIMITS.ACADEMIC_YEAR_MAX),
      labManager: clampString(seed.settings?.labManager || DEFAULT_SETTINGS.labManager, LIMITS.RECORDER_MAX),
      colors: sanitizeThemeColors(seed.settings?.colors),
      usageTypes: sanitizeUsageTypes(seed.usageTypes || [...DEFAULT_USAGE_TYPES], LIMITS.USAGE_TYPES_PRESET_MAX),
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
        className: assertValidClassName(log.className),
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

  return () => {
    unsubSettings();
    unsubStudents();
    unsubSubjects();
    unsubLogs();
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
    className: assertValidClassName(payload.className),
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
      if (snap.exists()) {
        await updateDoc(ref, {
          schoolName,
          academicYear,
          labManager,
          colors,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          schoolName,
          academicYear,
          labManager,
          colors,
          usageTypes: [...DEFAULT_USAGE_TYPES],
          ownerId: uid,
          visibility: 'school',
          updatedAt: serverTimestamp(),
        });
      }
      return { schoolName, academicYear, labManager, colors };
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
};

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

export async function updateSecurityPins(
  adminPin6: string | null,
  userPin6: string | null,
  currentHashes?: PinHashes | null
): Promise<PinHashes> {
  const uid = getActorUid();
  if (adminPin6 !== null && !isValidPin6(adminPin6)) {
    throw new Error('รหัส PIN ผู้ดูแลระบบต้องเป็นตัวเลข 6 หลัก');
  }
  if (userPin6 !== null && !isValidPin6(userPin6)) {
    throw new Error('รหัส PIN ผู้ใช้งานทั่วไปต้องเป็นตัวเลข 6 หลัก');
  }

  const base = currentHashes ?? (await getDefaultPinHashes());
  const nextAdminHash = adminPin6 !== null ? await hashPin6(adminPin6) : base.adminPinHash;
  const nextUserHash = userPin6 !== null ? await hashPin6(userPin6) : base.userPinHash;

  if (nextAdminHash === nextUserHash) {
    throw new Error('รหัส PIN 6 หลักของ Admin และ User ต้องไม่ซ้ำกัน');
  }

  const path = 'security/pins';
  const ref = doc(db, 'security', 'pins');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        adminPinHash: nextAdminHash,
        userPinHash: nextUserHash,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        adminPinHash: nextAdminHash,
        userPinHash: nextUserHash,
        ownerId: uid,
        updatedAt: serverTimestamp(),
      });
    }
    const nextHashes: PinHashes = {
      adminPinHash: nextAdminHash,
      userPinHash: nextUserHash,
    };
    setCachedPinHashes(nextHashes);
    return nextHashes;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
