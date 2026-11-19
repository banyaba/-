import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  Users,
  UserCheck,
  CheckSquare,
  Square,
  Save,
  RefreshCw,
  Zap,
  X,
  SlidersHorizontal,
  Plus,
} from 'lucide-react';
import {
  CLASS_LIST,
  COMPUTER_ROOMS,
  COMPUTER_STATIONS,
  EXTERNAL_VISITOR_CATEGORIES,
  EXTERNAL_VISITOR_CLASS,
  type Student,
  type Subject,
  type UsageLog,
  type UserRole,
} from '../types';
import { getCurrentTimeHHMM, getTodayISO } from '../utils/thaiDate';
import { api } from '../api/client';
import { UsageTypesManagerModal } from './UsageTypesManagerModal';

interface AddDataViewProps {
  role: UserRole;
  students: Student[];
  subjects: Subject[];
  usageTypes: string[];
  defaultRecorder: string;
  editingLog: UsageLog | null;
  onCancelEdit: () => void;
  onLogSaved: (log: UsageLog, isEdit: boolean) => void;
  onBatchSaved: (logs: UsageLog[]) => void;
  onUsageTypesChanged: (next: string[]) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function AddDataView({
  role,
  students,
  subjects,
  usageTypes,
  defaultRecorder,
  editingLog,
  onCancelEdit,
  onLogSaved,
  onBatchSaved,
  onUsageTypesChanged,
  onNotify,
}: AddDataViewProps) {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch' | 'external'>('individual');

  const studentCountByClass = useMemo(() => {
    const map: Record<string, number> = {};
    for (const stu of students) {
      const cls = stu.className.trim();
      map[cls] = (map[cls] || 0) + 1;
    }
    return map;
  }, [students]);

  const defaultPopulatedClass = useMemo(() => {
    return CLASS_LIST.find((cls) => (studentCountByClass[cls] || 0) > 0) || CLASS_LIST[0];
  }, [studentCountByClass]);

  // Individual Tab State
  const [indDate, setIndDate] = useState(getTodayISO());
  const [indTimeIn, setIndTimeIn] = useState(getCurrentTimeHHMM());
  const [indComputerRoom, setIndComputerRoom] = useState(COMPUTER_ROOMS[0]);
  const [indComputerNumber, setIndComputerNumber] = useState('1');
  const [indClass, setIndClass] = useState(() => defaultPopulatedClass);
  const [indStudentName, setIndStudentName] = useState('');
  const [indStudentId, setIndStudentId] = useState<string | undefined>(undefined);
  const [indManualName, setIndManualName] = useState(false);
  const [indSubjectName, setIndSubjectName] = useState('');
  const [indUsageTypes, setIndUsageTypes] = useState<string[]>(['ค้นคว้าข้อมูล']);
  const [indCustomUsage, setIndCustomUsage] = useState('');
  const [indNote, setIndNote] = useState('');
  const [indRecorder, setIndRecorder] = useState(defaultRecorder);
  const [indSaving, setIndSaving] = useState(false);

  // Batch Tab State
  const [batchDate, setBatchDate] = useState(getTodayISO());
  const [batchTimeIn, setBatchTimeIn] = useState(getCurrentTimeHHMM());
  const [batchComputerRoom, setBatchComputerRoom] = useState(COMPUTER_ROOMS[0]);
  const [batchClass, setBatchClass] = useState(() => defaultPopulatedClass);
  const [batchSubjectName, setBatchSubjectName] = useState('');
  const [batchRecorder, setBatchRecorder] = useState(defaultRecorder);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [batchStationMap, setBatchStationMap] = useState<Record<string, string>>({});
  const [batchUsageTypes, setBatchUsageTypes] = useState<string[]>(['ค้นคว้าข้อมูล']);
  const [batchCustomUsage, setBatchCustomUsage] = useState('');
  const [addingCustomUsage, setAddingCustomUsage] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);

  // External Visitor Tab State (แท็บ 3: บุคคลภายนอก)
  const [extDate, setExtDate] = useState(getTodayISO());
  const [extTimeIn, setExtTimeIn] = useState(getCurrentTimeHHMM());
  const [extComputerRoom, setExtComputerRoom] = useState(COMPUTER_ROOMS[0]);
  const [extComputerNumber, setExtComputerNumber] = useState('1');
  const [extVisitorName, setExtVisitorName] = useState('');
  const [extCategory, setExtCategory] = useState(EXTERNAL_VISITOR_CATEGORIES[0]);
  const [extCustomCategory, setExtCustomCategory] = useState('');
  const [extUsageTypes, setExtUsageTypes] = useState<string[]>(['ค้นคว้าข้อมูล']);
  const [extCustomUsage, setExtCustomUsage] = useState('');
  const [extNote, setExtNote] = useState('');
  const [extRecorder, setExtRecorder] = useState(defaultRecorder);
  const [extSaving, setExtSaving] = useState(false);

  // Sync default subject when subjects load
  useEffect(() => {
    if (subjects.length > 0 && !indSubjectName) {
      setIndSubjectName(subjects[0].name);
    }
    if (subjects.length > 0 && !batchSubjectName) {
      setBatchSubjectName(subjects[0].name);
    }
  }, [subjects, indSubjectName, batchSubjectName]);

  // Populate Individual or External Tab when editingLog changes
  useEffect(() => {
    if (editingLog) {
      if (editingLog.className === EXTERNAL_VISITOR_CLASS) {
        setActiveTab('external');
        setExtDate(editingLog.date);
        setExtTimeIn(editingLog.timeIn || '');
        setExtComputerRoom(editingLog.computerRoom || COMPUTER_ROOMS[0]);
        setExtComputerNumber(editingLog.computerNumber || '');
        setExtVisitorName(editingLog.studentName);
        if (EXTERNAL_VISITOR_CATEGORIES.includes(editingLog.subjectName)) {
          setExtCategory(editingLog.subjectName);
          setExtCustomCategory('');
        } else {
          setExtCategory('__custom__');
          setExtCustomCategory(editingLog.subjectName);
        }
        setExtUsageTypes(editingLog.usageTypes);
        setExtNote(editingLog.note || '');
        setExtRecorder(editingLog.recorder);
        return;
      }

      setActiveTab('individual');
      setIndDate(editingLog.date);
      setIndTimeIn(editingLog.timeIn || '');
      setIndComputerRoom(editingLog.computerRoom || COMPUTER_ROOMS[0]);
      setIndComputerNumber(editingLog.computerNumber || '');
      setIndClass(editingLog.className);
      setIndStudentName(editingLog.studentName);
      setIndStudentId(editingLog.studentId);
      const existsInClass = students.some(
        (s) => s.className === editingLog.className && s.name === editingLog.studentName
      );
      setIndManualName(!existsInClass);
      setIndSubjectName(editingLog.subjectName);
      setIndUsageTypes(editingLog.usageTypes);
      setIndNote(editingLog.note || '');
      setIndRecorder(editingLog.recorder);
    }
  }, [editingLog, students]);

  const classStudents = useMemo(
    () =>
      students
        .filter((s) => s.className.trim() === indClass.trim())
        .sort((a, b) => {
          const numDiff = (a.number ?? 999) - (b.number ?? 999);
          if (numDiff !== 0) return numDiff;
          return a.name.localeCompare(b.name, 'th');
        }),
    [students, indClass]
  );

  // When class changes in individual mode (and not editing), auto-select first student from student table
  useEffect(() => {
    if (editingLog) return;
    setIndManualName(false);
    if (classStudents.length > 0) {
      setIndStudentName(classStudents[0].name);
      setIndStudentId(classStudents[0].id);
    } else {
      setIndStudentName('');
      setIndStudentId(undefined);
    }
  }, [indClass, classStudents, editingLog]);

  const batchClassStudents = useMemo(
    () =>
      students
        .filter((s) => s.className.trim() === batchClass.trim())
        .sort((a, b) => {
          const numDiff = (a.number ?? 999) - (b.number ?? 999);
          if (numDiff !== 0) return numDiff;
          return a.name.localeCompare(b.name, 'th');
        }),
    [students, batchClass]
  );

  // Auto select all students in batch class when class changes
  useEffect(() => {
    setSelectedStudentIds(batchClassStudents.map((s) => s.id));
    const nextMap: Record<string, string> = {};
    batchClassStudents.forEach((stu, index) => {
      if (index < 30) {
        nextMap[stu.id] = String(index + 1);
      }
    });
    setBatchStationMap(nextMap);
  }, [batchClass, batchClassStudents]);

  const toggleUsageType = (list: string[], setList: (v: string[]) => void, value: string) => {
    if (list.includes(value)) {
      setList(list.filter((item) => item !== value));
    } else {
      setList([...list, value]);
    }
  };

  const handleUsageTypesSync = (
    next: string[],
    renamed?: { oldName: string; newName: string }
  ) => {
    onUsageTypesChanged(next);
    const nextSet = new Set(next);
    const syncList = (current: string[]) => {
      const mapped = renamed
        ? current.map((v) => (v === renamed.oldName ? renamed.newName : v))
        : current;
      return mapped.filter((v) => nextSet.has(v));
    };
    setIndUsageTypes((prev) => syncList(prev));
    setBatchUsageTypes((prev) => syncList(prev));
    setExtUsageTypes((prev) => syncList(prev));
  };

  const indDisplayUsageTypes = useMemo(
    () => Array.from(new Set([...usageTypes, ...indUsageTypes])),
    [usageTypes, indUsageTypes]
  );

  const batchDisplayUsageTypes = useMemo(
    () => Array.from(new Set([...usageTypes, ...batchUsageTypes])),
    [usageTypes, batchUsageTypes]
  );

  const extDisplayUsageTypes = useMemo(
    () => Array.from(new Set([...usageTypes, ...extUsageTypes])),
    [usageTypes, extUsageTypes]
  );

  const handleQuickAddUsageType = async (mode: 'individual' | 'batch' | 'external') => {
    const raw =
      mode === 'individual'
        ? indCustomUsage
        : mode === 'batch'
        ? batchCustomUsage
        : extCustomUsage;
    const trimmed = raw.trim();
    if (!trimmed) {
      onNotify('error', 'กรุณากรอกรูปแบบการใช้ที่ต้องการเพิ่ม');
      return;
    }

    const clearInput = () => {
      if (mode === 'individual') setIndCustomUsage('');
      else if (mode === 'batch') setBatchCustomUsage('');
      else setExtCustomUsage('');
    };

    const selectValue = (val: string) => {
      if (mode === 'individual') {
        setIndUsageTypes((prev) => (prev.includes(val) ? prev : [...prev, val]));
      } else if (mode === 'batch') {
        setBatchUsageTypes((prev) => (prev.includes(val) ? prev : [...prev, val]));
      } else {
        setExtUsageTypes((prev) => (prev.includes(val) ? prev : [...prev, val]));
      }
    };

    if (usageTypes.includes(trimmed)) {
      selectValue(trimmed);
      clearInput();
      onNotify('success', `เลือกรูปแบบการใช้ "${trimmed}" เรียบร้อยแล้ว`);
      return;
    }

    setAddingCustomUsage(true);
    try {
      const res = await api.addUsageType(trimmed);
      onUsageTypesChanged(res.usageTypes);
      selectValue(trimmed);
      clearInput();
      onNotify('success', `เพิ่มและเลือกรูปแบบการใช้ "${trimmed}" เรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถเพิ่มรูปแบบการใช้ได้');
    } finally {
      setAddingCustomUsage(false);
    }
  };

  const resetIndividualForm = () => {
    setIndDate(getTodayISO());
    setIndTimeIn(getCurrentTimeHHMM());
    setIndNote('');
    setIndCustomUsage('');
    setIndUsageTypes(usageTypes[0] ? [usageTypes[0]] : []);
    setIndRecorder(defaultRecorder);
    if (classStudents.length > 0) {
      setIndManualName(false);
      setIndStudentName(classStudents[0].name);
      setIndStudentId(classStudents[0].id);
    } else {
      setIndStudentName('');
      setIndStudentId(undefined);
    }
  };

  const mergeCustomUsage = (selected: string[], customText: string) => {
    const extras = customText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set([...selected, ...extras]));
  };

  const handleIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!indDate || !indClass || !indStudentName.trim() || !indSubjectName || !indRecorder.trim()) {
      onNotify('error', 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    const finalUsageTypes = mergeCustomUsage(indUsageTypes, indCustomUsage);
    const matchedSub = subjects.find((s) => s.name === indSubjectName);
    setIndSaving(true);
    try {
      const payload = {
        date: indDate,
        timeIn: indTimeIn,
        computerRoom: indComputerRoom,
        computerNumber: indComputerNumber,
        studentId: indStudentId,
        studentName: indStudentName.trim(),
        className: indClass,
        subjectId: matchedSub?.id,
        subjectName: indSubjectName,
        usageTypes: finalUsageTypes,
        note: indNote.trim(),
        recorder: indRecorder.trim(),
      };

      if (editingLog) {
        const updated = await api.updateLog(editingLog.id, payload);
        onLogSaved(updated, true);
        onNotify('success', 'อัปเดตข้อมูลการใช้ห้องคอมพิวเตอร์เรียบร้อยแล้ว');
        resetIndividualForm();
      } else {
        const created = await api.createLog(payload);
        onLogSaved(created, false);
        onNotify('success', `บันทึกข้อมูลของ ${created.studentName} สำเร็จ`);
        resetIndividualForm();
      }
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setIndSaving(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchDate || !batchClass || !batchSubjectName || !batchRecorder.trim()) {
      onNotify('error', 'กรุณากรอกวันที่ ชั้นเรียน รายวิชา และครูผู้สอน');
      return;
    }
    if (selectedStudentIds.length === 0) {
      onNotify('error', 'กรุณาเลือกนักเรียนอย่างน้อย 1 คน');
      return;
    }

    const finalUsageTypes = mergeCustomUsage(batchUsageTypes, batchCustomUsage);
    const matchedSub = subjects.find((s) => s.name === batchSubjectName);
    const selectedSet = new Set(selectedStudentIds);
    const items = batchClassStudents
      .filter((s) => selectedSet.has(s.id))
      .map((stu) => ({
        date: batchDate,
        timeIn: batchTimeIn,
        computerRoom: batchComputerRoom,
        computerNumber: batchStationMap[stu.id] || '',
        studentId: stu.id,
        studentName: stu.name,
        className: batchClass,
        subjectId: matchedSub?.id,
        subjectName: batchSubjectName,
        usageTypes: finalUsageTypes,
        note: '',
        recorder: batchRecorder.trim(),
      }));

    setBatchSaving(true);
    try {
      const res = await api.createLogsBatch(items);
      onBatchSaved(res.items);
      setBatchCustomUsage('');
      onNotify('success', `บันทึกรายชั้น ${batchClass} จำนวน ${res.count} รายการเรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกรายชั้นได้');
    } finally {
      setBatchSaving(false);
    }
  };

  const resetExternalForm = () => {
    setExtDate(getTodayISO());
    setExtTimeIn(getCurrentTimeHHMM());
    setExtVisitorName('');
    setExtCategory(EXTERNAL_VISITOR_CATEGORIES[0]);
    setExtCustomCategory('');
    setExtCustomUsage('');
    setExtUsageTypes(usageTypes[0] ? [usageTypes[0]] : []);
    setExtNote('');
    setExtRecorder(defaultRecorder);
  };

  const handleExternalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedCategory =
      extCategory === '__custom__' ? extCustomCategory.trim() : extCategory.trim();

    if (!extDate || !extVisitorName.trim() || !resolvedCategory || !extRecorder.trim()) {
      onNotify('error', 'กรุณากรอกข้อมูลบุคคลภายนอกที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }

    const finalUsageTypes = mergeCustomUsage(extUsageTypes, extCustomUsage);
    setExtSaving(true);
    try {
      const payload = {
        date: extDate,
        timeIn: extTimeIn,
        computerRoom: extComputerRoom,
        computerNumber: extComputerNumber,
        studentId: undefined,
        studentName: extVisitorName.trim(),
        className: EXTERNAL_VISITOR_CLASS,
        subjectId: undefined,
        subjectName: resolvedCategory,
        usageTypes: finalUsageTypes,
        note: extNote.trim(),
        recorder: extRecorder.trim(),
      };

      if (editingLog && editingLog.className === EXTERNAL_VISITOR_CLASS) {
        const updated = await api.updateLog(editingLog.id, payload);
        onLogSaved(updated, true);
        onNotify('success', 'อัปเดตข้อมูลบุคคลภายนอกเรียบร้อยแล้ว');
        resetExternalForm();
      } else {
        const created = await api.createLog(payload);
        onLogSaved(created, false);
        onNotify('success', `บันทึกข้อมูลบุคคลภายนอก (${created.studentName}) สำเร็จ`);
        resetExternalForm();
      }
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลบุคคลภายนอกได้');
    } finally {
      setExtSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Segmented Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-slate-900 dark:to-blue-950/40 p-1.5">
          <button
            type="button"
            onClick={() => {
              if (editingLog && editingLog.className === EXTERNAL_VISITOR_CLASS) {
                onCancelEdit();
                resetExternalForm();
              }
              setActiveTab('individual');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'individual'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-blue-700 dark:hover:text-blue-300'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>แท็บ 1: รายบุคคล</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (editingLog) onCancelEdit();
              setActiveTab('batch');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'batch'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-blue-700 dark:hover:text-blue-300'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>แท็บ 2: รายชั้น (Batch Import)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (editingLog && editingLog.className !== EXTERNAL_VISITOR_CLASS) {
                onCancelEdit();
                resetIndividualForm();
              }
              setActiveTab('external');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'external'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-emerald-700 dark:hover:text-emerald-300'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>แท็บ 3: บุคคลภายนอก</span>
          </button>
        </div>

        {editingLog && (activeTab === 'individual' || activeTab === 'external') && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            <span>กำลังแก้ไขข้อมูลของ: {editingLog.studentName}</span>
            <button
              type="button"
              onClick={() => {
                onCancelEdit();
                resetIndividualForm();
                resetExternalForm();
              }}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 dark:border-amber-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-slate-700 dark:text-slate-200 hover:bg-amber-100/60 dark:hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              <span>ยกเลิกการแก้ไข</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Individual Entry */}
      {activeTab === 'individual' && (
        <form
          onSubmit={handleIndividualSubmit}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-blue-100/80 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-transparent dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs shrink-0">
                <UserPlus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {editingLog ? 'แก้ไขบันทึกการใช้ห้องคอมพิวเตอร์' : 'บันทึกการใช้ห้องคอมพิวเตอร์รายบุคคล'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  เลือกห้อง เครื่องที่ใช้ รายชื่อนักเรียน และรูปแบบการใช้งาน
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="ind-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                วันที่ <span className="text-rose-500">*</span>
              </label>
              <input
                id="ind-date"
                type="date"
                required
                value={indDate}
                onChange={(e) => setIndDate(e.target.value)}
                className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="ind-time" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                เข้าใช้ (เวลา)
              </label>
              <input
                id="ind-time"
                type="time"
                value={indTimeIn}
                onChange={(e) => setIndTimeIn(e.target.value)}
                className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ind-room" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  ห้องคอม
                </label>
                <select
                  id="ind-room"
                  value={indComputerRoom}
                  onChange={(e) => setIndComputerRoom(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {COMPUTER_ROOMS.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ind-station" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  เครื่องที่ใช้
                </label>
                <select
                  id="ind-station"
                  value={indComputerNumber}
                  onChange={(e) => setIndComputerNumber(e.target.value)}
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">ไม่ระบุ</option>
                  {COMPUTER_STATIONS.map((num) => (
                    <option key={num} value={num}>
                      เครื่องที่ {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="ind-class" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ชั้นเรียน <span className="text-rose-500">*</span>
              </label>
              <select
                id="ind-class"
                required
                value={indClass}
                onChange={(e) => setIndClass(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLASS_LIST.map((cls) => {
                  const count = studentCountByClass[cls] || 0;
                  return (
                    <option key={cls} value={cls}>
                      {cls} ({count} คน)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label htmlFor="ind-student" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  ชื่อนักเรียน <span className="text-rose-500">*</span>{' '}
                  <span className="font-normal text-slate-500 dark:text-slate-400">
                    (จากตารางรายชื่อชั้น {indClass}: {classStudents.length} คน)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIndManualName((prev) => !prev);
                    if (!indManualName) {
                      setIndStudentId(undefined);
                      setIndStudentName('');
                    } else if (classStudents[0]) {
                      setIndStudentId(classStudents[0].id);
                      setIndStudentName(classStudents[0].name);
                    } else {
                      setIndStudentId(undefined);
                      setIndStudentName('');
                    }
                  }}
                  className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {indManualName ? 'เลือกจากตารางรายชื่อ' : 'พิมพ์ชื่อเอง'}
                </button>
              </div>

              {!indManualName ? (
                <select
                  id="ind-student"
                  required
                  value={indStudentName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setIndStudentName(name);
                    const found = classStudents.find((s) => s.name === name);
                    setIndStudentId(found?.id);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {classStudents.length === 0 ? (
                    <option value="">
                      -- ยังไม่มีรายชื่อนักเรียนในชั้น {indClass} --
                    </option>
                  ) : (
                    classStudents.map((stu) => (
                      <option key={stu.id} value={stu.name}>
                        {stu.number ? `เลขที่ ${stu.number} · ` : ''}
                        {stu.name}
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <input
                  id="ind-student"
                  type="text"
                  required
                  value={indStudentName}
                  onChange={(e) => {
                    setIndStudentName(e.target.value);
                    setIndStudentId(undefined);
                  }}
                  placeholder={`พิมพ์ชื่อ-สกุลนักเรียนชั้น ${indClass}`}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ind-subject" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                รายวิชา <span className="text-rose-500">*</span>
              </label>
              {subjects.length > 0 ? (
                <select
                  id="ind-subject"
                  required
                  value={indSubjectName}
                  onChange={(e) => setIndSubjectName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.code ? `[${sub.code}] ` : ''}
                      {sub.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="ind-subject"
                  type="text"
                  required
                  value={indSubjectName}
                  onChange={(e) => setIndSubjectName(e.target.value)}
                  placeholder="กรอกชื่อรายวิชา"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div>
              <label htmlFor="ind-recorder" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ครูผู้สอน <span className="text-rose-500">*</span>
              </label>
              <input
                id="ind-recorder"
                type="text"
                required
                value={indRecorder}
                onChange={(e) => setIndRecorder(e.target.value)}
                placeholder="ชื่อครูผู้สอน"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Usage Types Checkboxes */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                รูปแบบการใช้ (เลือกได้หลายตัวเลือก)
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  เลือกแล้ว {indUsageTypes.length} รายการ
                </span>
                <button
                  type="button"
                  onClick={() => setManageModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{role === 'admin' ? 'เพิ่ม / แก้ไข / ลบตัวเลือก' : 'เพิ่ม / แก้ไขตัวเลือก'}</span>
                </button>
              </div>
            </div>
            {/* Inline Custom Usage Input (Top) */}
            <div className="mb-3 flex flex-col sm:flex-row gap-2">
              <input
                id="ind-custom-usage"
                type="text"
                value={indCustomUsage}
                onChange={(e) => setIndCustomUsage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAddUsageType('individual');
                  }
                }}
                placeholder="เพิ่มรูปแบบการใช้งานเอง (เช่น ตัดต่อวิดีโอ, สอบออนไลน์)..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={addingCustomUsage || !indCustomUsage.trim()}
                onClick={() => handleQuickAddUsageType('individual')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800/80 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/60 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addingCustomUsage ? 'กำลังเพิ่ม...' : 'เพิ่มและเลือก'}</span>
              </button>
            </div>

            {indDisplayUsageTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                ยังไม่มีตัวเลือกรูปแบบการใช้ กรอกเพิ่มด้านบนหรือกดปุ่มจัดการตัวเลือก
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {indDisplayUsageTypes.map((type) => {
                  const checked = indUsageTypes.includes(type);
                  return (
                    <label
                      key={type}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                        checked
                          ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50/80 text-blue-900 dark:border-blue-500/80 dark:from-blue-950/60 dark:to-indigo-950/50 dark:text-blue-100'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-blue-200 hover:bg-blue-50/30 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUsageType(indUsageTypes, setIndUsageTypes, type)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{type}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="ind-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <input
              id="ind-note"
              type="text"
              value={indNote}
              onChange={(e) => setIndNote(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม เช่น เครื่องที่ 12 หรือหมายเหตุอื่นๆ"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {editingLog && (
              <button
                type="button"
                onClick={() => {
                  onCancelEdit();
                  resetIndividualForm();
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                ยกเลิก
              </button>
            )}
            <button
              type="submit"
              disabled={indSaving}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60 whitespace-nowrap"
              style={{
                backgroundColor: editingLog ? 'var(--theme-secondary)' : 'var(--theme-primary)',
              }}
            >
              {editingLog ? <RefreshCw className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span>
                {indSaving
                  ? 'กำลังบันทึก...'
                  : editingLog
                  ? 'อัปเดตข้อมูล'
                  : 'บันทึกข้อมูล'}
              </span>
            </button>
          </div>
          </div>
        </form>
      )}

      {/* Tab 2: Batch Class Entry */}
      {activeTab === 'batch' && (
        <form
          onSubmit={handleBatchSubmit}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-indigo-100/80 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-transparent dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-xs shrink-0">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  บันทึกการใช้ห้องคอมพิวเตอร์แบบรายชั้นเรียน
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  เลือกทั้งห้อง เรียงหมายเลขเครื่อง 1–30 อัตโนมัติ และบันทึกพร้อมกัน
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="batch-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                วันที่ <span className="text-rose-500">*</span>
              </label>
              <input
                id="batch-date"
                type="date"
                required
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="batch-time" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                เข้าใช้ (เวลา)
              </label>
              <input
                id="batch-time"
                type="time"
                value={batchTimeIn}
                onChange={(e) => setBatchTimeIn(e.target.value)}
                className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="batch-room" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ห้องคอม
              </label>
              <select
                id="batch-room"
                value={batchComputerRoom}
                onChange={(e) => setBatchComputerRoom(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMPUTER_ROOMS.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="batch-class" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ชั้นเรียน <span className="text-rose-500">*</span>
              </label>
              <select
                id="batch-class"
                required
                value={batchClass}
                onChange={(e) => setBatchClass(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLASS_LIST.map((cls) => {
                  const count = studentCountByClass[cls] || 0;
                  return (
                    <option key={cls} value={cls}>
                      {cls} ({count} คน)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="batch-subject" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                รายวิชา <span className="text-rose-500">*</span>
              </label>
              <select
                id="batch-subject"
                required
                value={batchSubjectName}
                onChange={(e) => setBatchSubjectName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.name}>
                    {sub.code ? `[${sub.code}] ` : ''}
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="batch-recorder" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ครูผู้สอน <span className="text-rose-500">*</span>
              </label>
              <input
                id="batch-recorder"
                type="text"
                required
                value={batchRecorder}
                onChange={(e) => setBatchRecorder(e.target.value)}
                placeholder="ชื่อครูผู้สอน"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Student Selection List */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  รายชื่อนักเรียนชั้น {batchClass}
                </span>
                <span className="ml-2 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                  (เลือกแล้ว {selectedStudentIds.length} / {batchClassStudents.length} คน)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMap: Record<string, string> = {};
                    let stationNum = 1;
                    batchClassStudents.forEach((stu) => {
                      if (selectedStudentIds.includes(stu.id) && stationNum <= 30) {
                        nextMap[stu.id] = String(stationNum++);
                      }
                    });
                    setBatchStationMap(nextMap);
                  }}
                  disabled={selectedStudentIds.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  <span>เรียงเครื่อง 1–30 อัตโนมัติ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds(batchClassStudents.map((s) => s.id))}
                  disabled={batchClassStudents.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>เลือกทั้งหมด</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  disabled={selectedStudentIds.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>ยกเลิก</span>
                </button>
              </div>
            </div>

            {batchClassStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                ยังไม่มีรายชื่อนักเรียนในชั้น {batchClass} กรุณาเพิ่มนักเรียนในเมนูปรับรายชื่อนักเรียน
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {batchClassStudents.map((stu) => {
                  const isSelected = selectedStudentIds.includes(stu.id);
                  return (
                    <div
                      key={stu.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        isSelected
                          ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50/70 text-slate-900 dark:border-blue-500/80 dark:from-blue-950/50 dark:to-indigo-950/40 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedStudentIds((prev) => prev.filter((id) => id !== stu.id));
                            } else {
                              setSelectedStudentIds((prev) => [...prev, stu.id]);
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400 w-5 shrink-0">
                          {stu.number ?? '-'}
                        </span>
                        <span className="truncate font-medium">{stu.name}</span>
                      </label>

                      <select
                        value={batchStationMap[stu.id] || ''}
                        onChange={(e) =>
                          setBatchStationMap((prev) => ({ ...prev, [stu.id]: e.target.value }))
                        }
                        aria-label={`เครื่องที่ใช้ของ ${stu.name}`}
                        className="font-mono-num shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
                      >
                        <option value="">เครื่อง -</option>
                        {COMPUTER_STATIONS.map((num) => (
                          <option key={num} value={num}>
                            เครื่อง {num}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Usage Types */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                รูปแบบการใช้ (ใช้ร่วมกันทั้งชั้น)
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  เลือกแล้ว {batchUsageTypes.length} รายการ
                </span>
                <button
                  type="button"
                  onClick={() => setManageModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{role === 'admin' ? 'เพิ่ม / แก้ไข / ลบตัวเลือก' : 'เพิ่ม / แก้ไขตัวเลือก'}</span>
                </button>
              </div>
            </div>
            {/* Inline Custom Usage Input (Top) */}
            <div className="mb-3 flex flex-col sm:flex-row gap-2">
              <input
                id="batch-custom-usage"
                type="text"
                value={batchCustomUsage}
                onChange={(e) => setBatchCustomUsage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAddUsageType('batch');
                  }
                }}
                placeholder="เพิ่มรูปแบบการใช้งานเอง (เช่น ตัดต่อวิดีโอ, สอบออนไลน์)..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={addingCustomUsage || !batchCustomUsage.trim()}
                onClick={() => handleQuickAddUsageType('batch')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800/80 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/60 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addingCustomUsage ? 'กำลังเพิ่ม...' : 'เพิ่มและเลือก'}</span>
              </button>
            </div>

            {batchDisplayUsageTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                ยังไม่มีตัวเลือกรูปแบบการใช้ กรอกเพิ่มด้านบนหรือกดปุ่มจัดการตัวเลือก
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {batchDisplayUsageTypes.map((type) => {
                  const checked = batchUsageTypes.includes(type);
                  return (
                    <label
                      key={type}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                        checked
                          ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50/80 text-blue-900 dark:border-blue-500/80 dark:from-blue-950/60 dark:to-indigo-950/50 dark:text-blue-100'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-blue-200 hover:bg-blue-50/30 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUsageType(batchUsageTypes, setBatchUsageTypes, type)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{type}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={batchSaving || selectedStudentIds.length === 0}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              <Zap className="h-4 w-4" />
              <span>
                {batchSaving
                  ? `กำลังบันทึกรายชั้น (${selectedStudentIds.length} คน)...`
                  : `บันทึกรายชั้น (${selectedStudentIds.length} คน)`}
              </span>
            </button>
          </div>
          </div>
        </form>
      )}

      {/* Tab 3: External Visitor Entry (บุคคลภายนอก) */}
      {activeTab === 'external' && (
        <form
          onSubmit={handleExternalSubmit}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-emerald-100/80 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-transparent dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xs shrink-0">
                <UserCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {editingLog && editingLog.className === EXTERNAL_VISITOR_CLASS
                    ? 'แก้ไขบันทึกการใช้ห้องคอมพิวเตอร์ (บุคคลภายนอก)'
                    : 'บันทึกการใช้ห้องคอมพิวเตอร์สำหรับบุคคลภายนอก'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  สำหรับผู้ปกครอง ครูต่างโรงเรียน เจ้าหน้าที่ หรือบุคคลทั่วไปที่ไม่ได้อยู่ในรายชื่อนักเรียน
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="ext-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  วันที่ <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ext-date"
                  type="date"
                  required
                  value={extDate}
                  onChange={(e) => setExtDate(e.target.value)}
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="ext-time" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  เข้าใช้ (เวลา)
                </label>
                <input
                  id="ext-time"
                  type="time"
                  value={extTimeIn}
                  onChange={(e) => setExtTimeIn(e.target.value)}
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ext-room" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ห้องคอม
                  </label>
                  <select
                    id="ext-room"
                    value={extComputerRoom}
                    onChange={(e) => setExtComputerRoom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {COMPUTER_ROOMS.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="ext-station" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    เครื่องที่ใช้
                  </label>
                  <select
                    id="ext-station"
                    value={extComputerNumber}
                    onChange={(e) => setExtComputerNumber(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">ไม่ระบุ</option>
                    {COMPUTER_STATIONS.map((num) => (
                      <option key={num} value={num}>
                        เครื่องที่ {num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="ext-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  ชื่อ–สกุล บุคคลภายนอก <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ext-name"
                  type="text"
                  required
                  value={extVisitorName}
                  onChange={(e) => setExtVisitorName(e.target.value)}
                  placeholder="กรอกชื่อ-นามสกุล หรือคำนำหน้าของผู้เข้าใช้งาน"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="ext-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  ประเภทบุคคลภายนอก <span className="text-rose-500">*</span>
                </label>
                <select
                  id="ext-category"
                  required
                  value={extCategory}
                  onChange={(e) => setExtCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {EXTERNAL_VISITOR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__custom__">อื่นๆ (ระบุประเภท/วัตถุประสงค์เอง)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {extCategory === '__custom__' && (
                <div>
                  <label htmlFor="ext-custom-cat" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ระบุประเภท / วัตถุประสงค์ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ext-custom-cat"
                    type="text"
                    required
                    value={extCustomCategory}
                    onChange={(e) => setExtCustomCategory(e.target.value)}
                    placeholder="เช่น คณะศึกษาดูงาน, ช่างซ่อมบำรุงเครือข่าย"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className={extCategory === '__custom__' ? '' : 'md:col-span-2'}>
                <label htmlFor="ext-recorder" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  ครูผู้สอน / ผู้ดูแลห้อง <span className="text-rose-500">*</span>
                </label>
                <input
                  id="ext-recorder"
                  type="text"
                  required
                  value={extRecorder}
                  onChange={(e) => setExtRecorder(e.target.value)}
                  placeholder="ชื่อครูผู้สอนหรือเจ้าหน้าที่ผู้รับผิดชอบ"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Usage Types Checkboxes */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  รูปแบบการใช้ (เลือกได้หลายตัวเลือก)
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    เลือกแล้ว {extUsageTypes.length} รายการ
                  </span>
                  <button
                    type="button"
                    onClick={() => setManageModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{role === 'admin' ? 'เพิ่ม / แก้ไข / ลบตัวเลือก' : 'เพิ่ม / แก้ไขตัวเลือก'}</span>
                  </button>
                </div>
              </div>

              {/* Inline Custom Usage Input (Top) */}
              <div className="mb-3 flex flex-col sm:flex-row gap-2">
                <input
                  id="ext-custom-usage"
                  type="text"
                  value={extCustomUsage}
                  onChange={(e) => setExtCustomUsage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAddUsageType('external');
                    }
                  }}
                  placeholder="เพิ่มรูปแบบการใช้งานเอง (เช่น ประชุมออนไลน์, พิมพ์เอกสารราชการ)..."
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  disabled={addingCustomUsage || !extCustomUsage.trim()}
                  onClick={() => handleQuickAddUsageType('external')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/60 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{addingCustomUsage ? 'กำลังเพิ่ม...' : 'เพิ่มและเลือก'}</span>
                </button>
              </div>

              {extDisplayUsageTypes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  ยังไม่มีตัวเลือกรูปแบบการใช้ กรอกเพิ่มด้านบนหรือกดปุ่มจัดการตัวเลือก
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {extDisplayUsageTypes.map((type) => {
                    const checked = extUsageTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                          checked
                            ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50/80 text-emerald-900 dark:border-emerald-500/80 dark:from-emerald-950/60 dark:to-teal-950/50 dark:text-emerald-100'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-emerald-200 hover:bg-emerald-50/30 dark:hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUsageType(extUsageTypes, setExtUsageTypes, type)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="truncate">{type}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="ext-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                สังกัด / หน่วยงาน / เบอร์ติดต่อ / หมายเหตุ (ไม่บังคับ)
              </label>
              <input
                id="ext-note"
                type="text"
                value={extNote}
                onChange={(e) => setExtNote(e.target.value)}
                placeholder="เช่น สังกัด สพป. / โทร 08x-xxx-xxxx / รายละเอียดเพิ่มเติม"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              {editingLog && editingLog.className === EXTERNAL_VISITOR_CLASS && (
                <button
                  type="button"
                  onClick={() => {
                    onCancelEdit();
                    resetExternalForm();
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  ยกเลิก
                </button>
              )}
              <button
                type="submit"
                disabled={extSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60 whitespace-nowrap"
              >
                {editingLog && editingLog.className === EXTERNAL_VISITOR_CLASS ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>
                  {extSaving
                    ? 'กำลังบันทึก...'
                    : editingLog && editingLog.className === EXTERNAL_VISITOR_CLASS
                    ? 'อัปเดตข้อมูล'
                    : 'บันทึกข้อมูลบุคคลภายนอก'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      <UsageTypesManagerModal
        open={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        usageTypes={usageTypes}
        canDelete={role === 'admin'}
        onUsageTypesChanged={handleUsageTypesSync}
        onNotify={onNotify}
      />
    </div>
  );
}
