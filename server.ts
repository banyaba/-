import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type { LabDatabase, Student, Subject, UsageLog, AppSettings } from './src/types';
import { DEFAULT_SETTINGS, DEFAULT_USAGE_TYPES } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'lab-db.json');

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialSeed(): LabDatabase {
  const now = new Date();
  const currentYear = now.getFullYear();
  const todayISO = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
    { month: '01', student: students[3], subject: subjects[0], usage: ['เขียนโปรแกรม', 'ค้นคว้าข้อมูล'], time: '09:00', count: 4 },
    { month: '02', student: students[4], subject: subjects[1], usage: ['ฝึกพิมพ์', 'โปรแกรมการศึกษา'], time: '10:00', count: 5 },
    { month: '03', student: students[9], subject: subjects[2], usage: ['สืบค้นอินเทอร์เน็ต', 'โครงงาน'], time: '13:30', count: 3 },
    { month: '04', student: students[0], subject: subjects[3], usage: ['แบบฝึกหัดออนไลน์'], time: '09:30', count: 2 },
    { month: '05', student: students[5], subject: subjects[0], usage: ['เขียนโปรแกรม', 'ศึกษาบทเรียนออนไลน์'], time: '08:45', count: 7 },
    { month: '06', student: students[6], subject: subjects[1], usage: ['ฝึกพิมพ์', 'สื่อการเรียน'], time: '10:15', count: 9 },
    { month: '07', student: students[7], subject: subjects[2], usage: ['ค้นคว้าข้อมูล', 'โครงงาน'], time: '11:00', count: 8 },
    { month: '08', student: students[10], subject: subjects[0], usage: ['เขียนโปรแกรม', 'แบบฝึกหัดออนไลน์'], time: '13:00', count: 11 },
    { month: '09', student: students[11], subject: subjects[5], usage: ['ศึกษาบทเรียนออนไลน์', 'สื่อการเรียน'], time: '14:00', count: 6 },
    { month: '10', student: students[12], subject: subjects[4], usage: ['ฝึกพิมพ์'], time: '09:15', count: 5 },
    { month: '11', student: students[3], subject: subjects[0], usage: ['ค้นคว้าข้อมูล', 'เขียนโปรแกรม'], time: '09:00', count: 8 },
    { month: '12', student: students[1], subject: subjects[3], usage: ['แบบฝึกหัดออนไลน์', 'โปรแกรมการศึกษา'], time: '10:30', count: 4 },
  ];

  const logs: UsageLog[] = [];
  let seq = 1;
  for (const item of monthlyCounts) {
    for (let i = 0; i < item.count; i++) {
      const stu = students[(seq + i) % students.length];
      const sub = subjects[(seq + i) % subjects.length];
      const day = String(Math.min(28, 3 + i * 2)).padStart(2, '0');
      const logDate = item.month === String(now.getMonth() + 1).padStart(2, '0') && i === 0
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

function readDb(): LabDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seed = createInitialSeed();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as LabDatabase;
    return {
      students: Array.isArray(parsed.students) ? parsed.students : [],
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      usageTypes: Array.isArray(parsed.usageTypes) ? parsed.usageTypes : [...DEFAULT_USAGE_TYPES],
      settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings, colors: { ...DEFAULT_SETTINGS.colors, ...(parsed.settings.colors || {}) } } : DEFAULT_SETTINGS,
    };
  } catch {
    const seed = createInitialSeed();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

function writeDb(db: LabDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Bootstrap all initial app data
  app.get('/api/bootstrap', (_req, res) => {
    const db = readDb();
    res.json(db);
  });

  // Logs CRUD
  app.post('/api/logs', (req, res) => {
    const db = readDb();
    const payload = req.body as Partial<UsageLog>;
    if (!payload.date || !payload.studentName || !payload.className || !payload.subjectName || !payload.recorder) {
      res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
      return;
    }
    const newLog: UsageLog = {
      id: generateId('log'),
      date: payload.date,
      timeIn: payload.timeIn || '',
      computerRoom: payload.computerRoom || '',
      computerNumber: payload.computerNumber || '',
      studentId: payload.studentId,
      studentName: payload.studentName.trim(),
      className: payload.className,
      subjectId: payload.subjectId,
      subjectName: payload.subjectName.trim(),
      usageTypes: Array.isArray(payload.usageTypes) ? payload.usageTypes : [],
      note: payload.note?.trim() || '',
      recorder: payload.recorder.trim(),
      createdAt: new Date().toISOString(),
    };
    db.logs.unshift(newLog);
    writeDb(db);
    res.status(201).json(newLog);
  });

  app.post('/api/logs/batch', (req, res) => {
    const db = readDb();
    const { items } = req.body as { items: Partial<UsageLog>[] };
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'ไม่มีรายการที่จะบันทึก' });
      return;
    }
    const created: UsageLog[] = [];
    for (const payload of items) {
      if (!payload.date || !payload.studentName || !payload.className || !payload.subjectName || !payload.recorder) {
        continue;
      }
      const entry: UsageLog = {
        id: generateId('log'),
        date: payload.date,
        timeIn: payload.timeIn || '',
        computerRoom: payload.computerRoom || '',
        computerNumber: payload.computerNumber || '',
        studentId: payload.studentId,
        studentName: payload.studentName.trim(),
        className: payload.className,
        subjectId: payload.subjectId,
        subjectName: payload.subjectName.trim(),
        usageTypes: Array.isArray(payload.usageTypes) ? payload.usageTypes : [],
        note: payload.note?.trim() || '',
        recorder: payload.recorder.trim(),
        createdAt: new Date().toISOString(),
      };
      db.logs.unshift(entry);
      created.push(entry);
    }
    writeDb(db);
    res.status(201).json({ count: created.length, items: created });
  });

  app.put('/api/logs/:id', (req, res) => {
    const db = readDb();
    const idx = db.logs.findIndex((l) => l.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
      return;
    }
    const payload = req.body as Partial<UsageLog>;
    db.logs[idx] = {
      ...db.logs[idx],
      date: payload.date ?? db.logs[idx].date,
      timeIn: payload.timeIn ?? db.logs[idx].timeIn,
      computerRoom: payload.computerRoom ?? db.logs[idx].computerRoom,
      computerNumber: payload.computerNumber ?? db.logs[idx].computerNumber,
      studentId: payload.studentId ?? db.logs[idx].studentId,
      studentName: payload.studentName?.trim() ?? db.logs[idx].studentName,
      className: payload.className ?? db.logs[idx].className,
      subjectId: payload.subjectId ?? db.logs[idx].subjectId,
      subjectName: payload.subjectName?.trim() ?? db.logs[idx].subjectName,
      usageTypes: Array.isArray(payload.usageTypes) ? payload.usageTypes : db.logs[idx].usageTypes,
      note: payload.note !== undefined ? payload.note.trim() : db.logs[idx].note,
      recorder: payload.recorder?.trim() ?? db.logs[idx].recorder,
    };
    writeDb(db);
    res.json(db.logs[idx]);
  });

  app.delete('/api/logs/by-date/:date', (req, res) => {
    const db = readDb();
    const before = db.logs.length;
    db.logs = db.logs.filter((l) => l.date !== req.params.date);
    const deleted = before - db.logs.length;
    writeDb(db);
    res.json({ deleted });
  });

  app.delete('/api/logs/:id', (req, res) => {
    const db = readDb();
    db.logs = db.logs.filter((l) => l.id !== req.params.id);
    writeDb(db);
    res.json({ ok: true });
  });

  // Bulk Data Clear Endpoints
  app.delete('/api/data/logs', (_req, res) => {
    const db = readDb();
    const deletedCount = db.logs.length;
    db.logs = [];
    writeDb(db);
    res.json({ deletedCount });
  });

  app.delete('/api/data/all', (_req, res) => {
    const db = readDb();
    const deletedLogs = db.logs.length;
    const deletedStudents = db.students.length;
    const deletedSubjects = db.subjects.length;
    db.logs = [];
    db.students = [];
    db.subjects = [];
    writeDb(db);
    res.json({ deletedLogs, deletedStudents, deletedSubjects });
  });

  // Students CRUD
  app.post('/api/students', (req, res) => {
    const db = readDb();
    const { number, name, className } = req.body as Partial<Student>;
    if (!name || !className) {
      res.status(400).json({ error: 'กรุณากรอกชื่อ-สกุล และชั้นเรียน' });
      return;
    }
    const student: Student = {
      id: generateId('stu'),
      number: number !== undefined && number !== null && String(number) !== '' ? Number(number) : undefined,
      name: name.trim(),
      className,
      createdAt: new Date().toISOString(),
    };
    db.students.push(student);
    writeDb(db);
    res.status(201).json(student);
  });

  app.post('/api/students/bulk', (req, res) => {
    const db = readDb();
    const { items } = req.body as { items: Partial<Student>[] };
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'ไม่มีข้อมูลนักเรียนที่จะนำเข้า' });
      return;
    }
    const created: Student[] = [];
    for (const item of items) {
      if (!item.name || !item.className) continue;
      const stu: Student = {
        id: generateId('stu'),
        number: item.number !== undefined && item.number !== null && String(item.number) !== '' ? Number(item.number) : undefined,
        name: item.name.trim(),
        className: item.className,
        createdAt: new Date().toISOString(),
      };
      db.students.push(stu);
      created.push(stu);
    }
    writeDb(db);
    res.status(201).json({ count: created.length, items: created });
  });

  app.put('/api/students/:id', (req, res) => {
    const db = readDb();
    const idx = db.students.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'ไม่พบข้อมูลนักเรียน' });
      return;
    }
    const { number, name, className } = req.body as Partial<Student>;
    db.students[idx] = {
      ...db.students[idx],
      number: number !== undefined ? (String(number) === '' ? undefined : Number(number)) : db.students[idx].number,
      name: name?.trim() ?? db.students[idx].name,
      className: className ?? db.students[idx].className,
    };
    writeDb(db);
    res.json(db.students[idx]);
  });

  app.post('/api/students/bulk-delete', (req, res) => {
    const db = readDb();
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'Invalid ids' });
      return;
    }
    const idSet = new Set(ids);
    const before = db.students.length;
    db.students = db.students.filter((s) => !idSet.has(s.id));
    writeDb(db);
    res.json({ deleted: before - db.students.length });
  });

  app.delete('/api/students/class/:className', (req, res) => {
    const db = readDb();
    const targetClass = decodeURIComponent(req.params.className);
    const before = db.students.length;
    db.students = db.students.filter((s) => s.className !== targetClass);
    writeDb(db);
    res.json({ deleted: before - db.students.length });
  });

  app.delete('/api/students/:id', (req, res) => {
    const db = readDb();
    db.students = db.students.filter((s) => s.id !== req.params.id);
    writeDb(db);
    res.json({ ok: true });
  });

  // Subjects CRUD
  app.post('/api/subjects', (req, res) => {
    const db = readDb();
    const { name, code, note } = req.body as Partial<Subject>;
    if (!name) {
      res.status(400).json({ error: 'กรุณากรอกชื่อวิชา' });
      return;
    }
    const subject: Subject = {
      id: generateId('sub'),
      name: name.trim(),
      code: code?.trim() || '',
      note: note?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    db.subjects.push(subject);
    writeDb(db);
    res.status(201).json(subject);
  });

  app.post('/api/subjects/bulk', (req, res) => {
    const db = readDb();
    const { items } = req.body as { items: Partial<Subject>[] };
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'ไม่มีข้อมูลรายวิชาที่จะนำเข้า' });
      return;
    }
    const created: Subject[] = [];
    for (const item of items) {
      if (!item.name) continue;
      const sub: Subject = {
        id: generateId('sub'),
        name: item.name.trim(),
        code: item.code?.trim() || '',
        note: item.note?.trim() || '',
        createdAt: new Date().toISOString(),
      };
      db.subjects.push(sub);
      created.push(sub);
    }
    writeDb(db);
    res.status(201).json({ count: created.length, items: created });
  });

  app.put('/api/subjects/:id', (req, res) => {
    const db = readDb();
    const idx = db.subjects.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'ไม่พบข้อมูลรายวิชา' });
      return;
    }
    const { name, code, note } = req.body as Partial<Subject>;
    db.subjects[idx] = {
      ...db.subjects[idx],
      name: name?.trim() ?? db.subjects[idx].name,
      code: code !== undefined ? code.trim() : db.subjects[idx].code,
      note: note !== undefined ? note.trim() : db.subjects[idx].note,
    };
    writeDb(db);
    res.json(db.subjects[idx]);
  });

  app.delete('/api/subjects/:id', (req, res) => {
    const db = readDb();
    db.subjects = db.subjects.filter((s) => s.id !== req.params.id);
    writeDb(db);
    res.json({ ok: true });
  });

  // Usage Types CRUD
  app.post('/api/usage-types', (req, res) => {
    const db = readDb();
    const { name } = req.body as { name?: string };
    const trimmed = name?.trim() || '';
    if (!trimmed) {
      res.status(400).json({ error: 'กรุณากรอกชื่อรูปแบบการใช้' });
      return;
    }
    if (db.usageTypes.includes(trimmed)) {
      res.status(400).json({ error: 'รูปแบบการใช้นี้มีอยู่ในระบบแล้ว' });
      return;
    }
    db.usageTypes.push(trimmed);
    writeDb(db);
    res.status(201).json({ usageTypes: db.usageTypes });
  });

  app.put('/api/usage-types/:index', (req, res) => {
    const db = readDb();
    const idx = Number(req.params.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= db.usageTypes.length) {
      res.status(404).json({ error: 'ไม่พบรูปแบบการใช้ที่ต้องการแก้ไข' });
      return;
    }
    const { name } = req.body as { name?: string };
    const trimmed = name?.trim() || '';
    if (!trimmed) {
      res.status(400).json({ error: 'ชื่อรูปแบบการใช้ห้ามว่าง' });
      return;
    }
    const duplicateIdx = db.usageTypes.findIndex((u, i) => i !== idx && u === trimmed);
    if (duplicateIdx !== -1) {
      res.status(400).json({ error: 'รูปแบบการใช้นี้มีอยู่ในระบบแล้ว' });
      return;
    }
    db.usageTypes[idx] = trimmed;
    writeDb(db);
    res.json({ usageTypes: db.usageTypes });
  });

  app.delete('/api/usage-types/:index', (req, res) => {
    const db = readDb();
    const idx = Number(req.params.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= db.usageTypes.length) {
      res.status(404).json({ error: 'ไม่พบรูปแบบการใช้ที่ต้องการลบ' });
      return;
    }
    db.usageTypes.splice(idx, 1);
    writeDb(db);
    res.json({ usageTypes: db.usageTypes });
  });

  app.post('/api/usage-types/reset', (_req, res) => {
    const db = readDb();
    db.usageTypes = [...DEFAULT_USAGE_TYPES];
    writeDb(db);
    res.json({ usageTypes: db.usageTypes });
  });

  // Settings
  app.put('/api/settings', (req, res) => {
    const db = readDb();
    const payload = req.body as Partial<AppSettings>;
    db.settings = {
      schoolName: payload.schoolName?.trim() || db.settings.schoolName,
      academicYear: payload.academicYear?.trim() || db.settings.academicYear,
      labManager: payload.labManager?.trim() || db.settings.labManager,
      colors: {
        ...db.settings.colors,
        ...(payload.colors || {}),
      },
    };
    writeDb(db);
    res.json(db.settings);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
