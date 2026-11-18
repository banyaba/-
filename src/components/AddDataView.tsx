import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  Users,
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
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');

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

  // Sync default subject when subjects load
  useEffect(() => {
    if (subjects.length > 0 && !indSubjectName) {
      setIndSubjectName(subjects[0].name);
    }
    if (subjects.length > 0 && !batchSubjectName) {
      setBatchSubjectName(subjects[0].name);
    }
  }, [subjects, indSubjectName, batchSubjectName]);

  // Populate Individual Tab when editingLog changes
  useEffect(() => {
    if (editingLog) {
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
  };

  const indDisplayUsageTypes = useMemo(
    () => Array.from(new Set([...usageTypes, ...indUsageTypes])),
    [usageTypes, indUsageTypes]
  );

  const batchDisplayUsageTypes = useMemo(
    () => Array.from(new Set([...usageTypes, ...batchUsageTypes])),
    [usageTypes, batchUsageTypes]
  );

  const handleQuickAddUsageType = async (mode: 'individual' | 'batch') => {
    const raw = mode === 'individual' ? indCustomUsage : batchCustomUsage;
    const trimmed = raw.trim();
    if (!trimmed) {
      onNotify('error', 'กรุณากรอกรูปแบบการใช้ที่ต้องการเพิ่ม');
      return;
    }

    const clearInput = () => {
      if (mode === 'individual') setIndCustomUsage('');
      else setBatchCustomUsage('');
    };

    const selectValue = (val: string) => {
      if (mode === 'individual') {
        setIndUsageTypes((prev) => (prev.includes(val) ? prev : [...prev, val]));
      } else {
        setBatchUsageTypes((prev) => (prev.includes(val) ? prev : [...prev, val]));
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
      onNotify('error', 'กรุณากรอกวันที่ ชั้นเรียน รายวิชา และผู้บันทึก');
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

  return (
    <div className="space-y-6">
      {/* Segmented Mode Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'individual'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'batch'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>แท็บ 2: รายชั้น (Batch Import)</span>
          </button>
        </div>

        {editingLog && activeTab === 'individual' && (
          <div className="flex items-center gap-3 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span>กำลังแก้ไขข้อมูลของ: {editingLog.studentName}</span>
            <button
              type="button"
              onClick={() => {
                onCancelEdit();
                resetIndividualForm();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" />
              <span>ยกเลิกการแก้ไข</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Individual Entry */}
      {activeTab === 'individual' ? (
        <form
          onSubmit={handleIndividualSubmit}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-6"
        >
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
                ผู้บันทึก <span className="text-rose-500">*</span>
              </label>
              <input
                id="ind-recorder"
                type="text"
                required
                value={indRecorder}
                onChange={(e) => setIndRecorder(e.target.value)}
                placeholder="ชื่อครูหรือผู้ดูแลห้อง"
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{role === 'admin' ? 'เพิ่ม / แก้ไข / ลบตัวเลือก' : 'เพิ่ม / แก้ไขตัวเลือก'}</span>
                </button>
              </div>
            </div>
            {indDisplayUsageTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                ยังไม่มีตัวเลือกรูปแบบการใช้ กรอกเพิ่มด้านล่างหรือกดปุ่มจัดการตัวเลือก
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
                          ? 'border-blue-500 bg-blue-50/70 text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
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

            {/* Inline Custom Usage Input */}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
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
                placeholder="เพิ่มรูปแบบการใช้เอง (เช่น ตัดต่อวิดีโอ, สอบออนไลน์)..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={addingCustomUsage || !indCustomUsage.trim()}
                onClick={() => handleQuickAddUsageType('individual')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addingCustomUsage ? 'กำลังเพิ่ม...' : 'เพิ่มและเลือก'}</span>
              </button>
            </div>
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
        </form>
      ) : (
        /* Tab 2: Batch Class Entry */
        <form
          onSubmit={handleBatchSubmit}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-6"
        >
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
                ผู้บันทึก <span className="text-rose-500">*</span>
              </label>
              <input
                id="batch-recorder"
                type="text"
                required
                value={batchRecorder}
                onChange={(e) => setBatchRecorder(e.target.value)}
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
                          ? 'border-blue-500 bg-blue-50/70 text-slate-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-slate-100'
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
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{role === 'admin' ? 'เพิ่ม / แก้ไข / ลบตัวเลือก' : 'เพิ่ม / แก้ไขตัวเลือก'}</span>
                </button>
              </div>
            </div>
            {batchDisplayUsageTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                ยังไม่มีตัวเลือกรูปแบบการใช้ กรอกเพิ่มด้านล่างหรือกดปุ่มจัดการตัวเลือก
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
                          ? 'border-blue-500 bg-blue-50/70 text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
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

            {/* Inline Custom Usage Input */}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
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
                placeholder="เพิ่มรูปแบบการใช้เอง (เช่น ตัดต่อวิดีโอ, สอบออนไลน์)..."
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={addingCustomUsage || !batchCustomUsage.trim()}
                onClick={() => handleQuickAddUsageType('batch')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addingCustomUsage ? 'กำลังเพิ่ม...' : 'เพิ่มและเลือก'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={batchSaving || selectedStudentIds.length === 0}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
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
