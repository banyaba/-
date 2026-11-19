import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Clock,
  Coffee,
  Monitor,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CLASS_LIST,
  COMPUTER_ROOMS,
  DEFAULT_SCHEDULE_TIMES,
  WEEKDAYS_MON_FRI,
  type AppSettings,
  type DayOfWeek,
  type SchedulePeriodConfig,
  type ScheduleTimeSettings,
  type Subject,
  type TeachingScheduleSlot,
  type UserRole,
} from '../types';
import { api } from '../api/client';
import { formatThaiFullDate, getTodayISO } from '../utils/thaiDate';
import { ConfirmModal } from './ConfirmModal';

interface TeachingSchedulePanelProps {
  role: UserRole;
  schedules: TeachingScheduleSlot[];
  subjects: Subject[];
  settings: AppSettings;
  onScheduleSaved: (slot: TeachingScheduleSlot) => void;
  onScheduleDeleted: (id: string) => void;
  onSchedulesSeeded: (items: TeachingScheduleSlot[]) => void;
  onScheduleTimesUpdated: (next: ScheduleTimeSettings) => void;
  onQuickBookRoom?: (room: string, startTime: string, endTime: string) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const SCHEDULE_CLASS_OPTIONS: readonly string[] = [
  ...CLASS_LIST,
  'ชุมนุมคอมพิวเตอร์',
  'กิจกรรมพัฒนาผู้เรียน',
  'อบรม / กิจกรรมพิเศษ',
];

export function TeachingSchedulePanel({
  role,
  schedules,
  subjects,
  settings,
  onScheduleSaved,
  onScheduleDeleted,
  onSchedulesSeeded,
  onScheduleTimesUpdated,
  onQuickBookRoom,
  onNotify,
}: TeachingSchedulePanelProps) {
  const [roomFilter, setRoomFilter] = useState<'all' | string>('all');
  const [seeding, setSeeding] = useState(false);

  const activeScheduleTimes: ScheduleTimeSettings = useMemo(() => {
    const raw = settings.scheduleTimes;
    if (raw && Array.isArray(raw.periods) && raw.periods.length === 6 && raw.lunchBreak) {
      return raw;
    }
    return DEFAULT_SCHEDULE_TIMES;
  }, [settings.scheduleTimes]);

  // Admin Edit Period & Lunch Times Modal State
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [draftPeriods, setDraftPeriods] = useState<SchedulePeriodConfig[]>(() =>
    activeScheduleTimes.periods.map((p) => ({ ...p }))
  );
  const [draftLunchStart, setDraftLunchStart] = useState(activeScheduleTimes.lunchBreak.startTime);
  const [draftLunchEnd, setDraftLunchEnd] = useState(activeScheduleTimes.lunchBreak.endTime);
  const [savingTimes, setSavingTimes] = useState(false);

  // Admin Add/Edit Slot Modal State
  const [modalTarget, setModalTarget] = useState<{
    computerRoom: string;
    dayOfWeek: DayOfWeek;
    period: number;
    existing: TeachingScheduleSlot | null;
  } | null>(null);
  const [formStartTime, setFormStartTime] = useState('08:30');
  const [formEndTime, setFormEndTime] = useState('09:30');
  const [formClassName, setFormClassName] = useState(CLASS_LIST[9] || CLASS_LIST[0]);
  const [formSubjectChoice, setFormSubjectChoice] = useState('');
  const [formCustomSubject, setFormCustomSubject] = useState('');
  const [formTeacherName, setFormTeacherName] = useState(settings.labManager || '');
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TeachingScheduleSlot | null>(null);
  const [deleting, setDeleting] = useState(false);

  const slotMap = useMemo(() => {
    const map = new Map<string, TeachingScheduleSlot>();
    for (const s of schedules) {
      map.set(`${s.computerRoom}::${s.dayOfWeek}::${s.period}`, s);
    }
    return map;
  }, [schedules]);

  const visibleRooms = useMemo(
    () => (roomFilter === 'all' ? [...COMPUTER_ROOMS] : [roomFilter]),
    [roomFilter]
  );

  const morningPeriods = activeScheduleTimes.periods.filter((p) => p.period <= 4);
  const afternoonPeriods = activeScheduleTimes.periods.filter((p) => p.period >= 5);

  const openTimeSettingsModal = () => {
    if (role !== 'admin') return;
    setDraftPeriods(activeScheduleTimes.periods.map((p) => ({ ...p })));
    setDraftLunchStart(activeScheduleTimes.lunchBreak.startTime);
    setDraftLunchEnd(activeScheduleTimes.lunchBreak.endTime);
    setTimeModalOpen(true);
  };

  const handleResetDefaultTimes = () => {
    setDraftPeriods(DEFAULT_SCHEDULE_TIMES.periods.map((p) => ({ ...p })));
    setDraftLunchStart(DEFAULT_SCHEDULE_TIMES.lunchBreak.startTime);
    setDraftLunchEnd(DEFAULT_SCHEDULE_TIMES.lunchBreak.endTime);
  };

  const handleSaveScheduleTimes = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const p of draftPeriods) {
      if (!p.startTime || !p.endTime || p.endTime <= p.startTime) {
        onNotify('error', `เวลาของ${p.label}ไม่ถูกต้อง (เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม)`);
        return;
      }
    }
    if (!draftLunchStart || !draftLunchEnd || draftLunchEnd <= draftLunchStart) {
      onNotify('error', 'เวลาพักกลางวันไม่ถูกต้อง (เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม)');
      return;
    }

    setSavingTimes(true);
    try {
      const updated = await api.updateScheduleTimes(
        {
          periods: draftPeriods,
          lunchBreak: {
            startTime: draftLunchStart,
            endTime: draftLunchEnd,
          },
        },
        role
      );
      onScheduleTimesUpdated(updated);
      setTimeModalOpen(false);
      onNotify('success', 'บันทึกเวลาคาบที่ 1–6 และพักกลางวันเรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกเวลาคาบสอนได้');
    } finally {
      setSavingTimes(false);
    }
  };

  const openSlotModal = (
    computerRoom: string,
    dayOfWeek: DayOfWeek,
    period: number,
    existing: TeachingScheduleSlot | null
  ) => {
    if (role !== 'admin') return;
    const pCfg =
      activeScheduleTimes.periods.find((p) => p.period === period) || activeScheduleTimes.periods[0];
    setModalTarget({ computerRoom, dayOfWeek, period, existing });

    if (existing) {
      setFormStartTime(existing.startTime);
      setFormEndTime(existing.endTime);
      setFormClassName(existing.className);
      const matchesSubject = subjects.some((s) => s.name === existing.subjectName);
      if (matchesSubject) {
        setFormSubjectChoice(existing.subjectName);
        setFormCustomSubject('');
      } else {
        setFormSubjectChoice('__custom__');
        setFormCustomSubject(existing.subjectName);
      }
      setFormTeacherName(existing.teacherName);
      setFormNote(existing.note || '');
    } else {
      setFormStartTime(pCfg.startTime);
      setFormEndTime(pCfg.endTime);
      setFormClassName(CLASS_LIST[9] || CLASS_LIST[0]);
      if (subjects.length > 0) {
        setFormSubjectChoice(subjects[0].name);
        setFormCustomSubject('');
      } else {
        setFormSubjectChoice('__custom__');
        setFormCustomSubject('วิทยาการคำนวณ');
      }
      setFormTeacherName(settings.labManager || '');
      setFormNote('');
    }
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTarget) return;
    const resolvedSubject =
      formSubjectChoice === '__custom__' ? formCustomSubject.trim() : formSubjectChoice.trim();

    if (!resolvedSubject || !formClassName.trim() || !formTeacherName.trim()) {
      onNotify('error', 'กรุณากรอกชั้นเรียน รายวิชา และชื่อครูผู้สอนให้ครบถ้วน');
      return;
    }
    if (formEndTime <= formStartTime) {
      onNotify('error', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
      return;
    }

    setSaving(true);
    try {
      const saved = await api.upsertTeachingScheduleSlot(
        {
          computerRoom: modalTarget.computerRoom,
          dayOfWeek: modalTarget.dayOfWeek,
          period: modalTarget.period,
          startTime: formStartTime,
          endTime: formEndTime,
          className: formClassName.trim(),
          subjectName: resolvedSubject,
          teacherName: formTeacherName.trim(),
          note: formNote.trim(),
        },
        role
      );
      onScheduleSaved(saved);
      setModalTarget(null);
      onNotify('success', 'บันทึกตารางคาบสอนเรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกตารางคาบสอนได้');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteTeachingScheduleSlot(deleteTarget.id, role);
      onScheduleDeleted(deleteTarget.id);
      setDeleteTarget(null);
      setModalTarget(null);
      onNotify('success', 'ลบคาบสอนเรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบคาบสอนได้');
    } finally {
      setDeleting(false);
    }
  };

  const handleSeedSample = async () => {
    setSeeding(true);
    try {
      const created = await api.seedDefaultTeachingSchedules(settings.labManager, role);
      onSchedulesSeeded(created);
      onNotify('success', `สร้างตัวอย่างตารางคาบสอน (${created.length} คาบ) เรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถสร้างตัวอย่างตารางสอนได้');
    } finally {
      setSeeding(false);
    }
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const renderCell = (
    room: string,
    day: DayOfWeek,
    periodCfg: SchedulePeriodConfig
  ) => {
    const slot = slotMap.get(`${room}::${day}::${periodCfg.period}`) || null;
    const isRoom1 = room === COMPUTER_ROOMS[0];

    if (slot) {
      return (
        <td
          key={`${room}_${day}_${periodCfg.period}`}
          className="border border-slate-200 dark:border-slate-700/80 p-1.5 align-top min-w-[130px]"
        >
          <div
            onClick={
              role === 'admin'
                ? () => openSlotModal(room, day, periodCfg.period, slot)
                : undefined
            }
            className={`group relative rounded-lg p-2.5 h-full min-h-[78px] border transition-all ${
              isRoom1
                ? 'border-sky-200/90 dark:border-sky-800/70 bg-gradient-to-br from-sky-50/90 to-blue-50/50 dark:from-sky-950/50 dark:to-blue-950/30'
                : 'border-emerald-200/90 dark:border-emerald-800/70 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 dark:from-emerald-950/50 dark:to-teal-950/30'
            } ${role === 'admin' ? 'cursor-pointer hover:shadow-xs' : ''}`}
          >
            <div className="flex items-center justify-between gap-1">
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                  isRoom1
                    ? 'bg-sky-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {slot.className}
              </span>
              {role === 'admin' && (
                <Pencil className="no-print h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              )}
            </div>
            <div className="mt-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
              {slot.subjectName}
            </div>
            <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 truncate">
              {slot.teacherName}
            </div>
            {(slot.startTime !== periodCfg.startTime || slot.endTime !== periodCfg.endTime) && (
              <div className="mt-0.5 font-mono-num text-[10px] text-slate-500 dark:text-slate-400">
                {slot.startTime}–{slot.endTime}
              </div>
            )}
          </div>
        </td>
      );
    }

    return (
      <td
        key={`${room}_${day}_${periodCfg.period}`}
        className="border border-slate-200 dark:border-slate-700/80 p-1.5 align-top min-w-[130px]"
      >
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/30 p-2 h-full min-h-[78px] flex flex-col items-center justify-center text-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            ว่าง
          </span>
          {role === 'admin' ? (
            <button
              type="button"
              onClick={() => openSlotModal(room, day, periodCfg.period, null)}
              className="no-print inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>เพิ่มคาบ</span>
            </button>
          ) : (
            onQuickBookRoom && (
              <button
                type="button"
                onClick={() => onQuickBookRoom(room, periodCfg.startTime, periodCfg.endTime)}
                className="no-print inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
              >
                จองคาบนี้
              </button>
            )
          )}
        </div>
      </td>
    );
  };

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xs shrink-0">
              <CalendarDays className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                ตารางคาบสอน วันจันทร์ – วันศุกร์ (ห้องคอม 1 และ ห้องคอม 2)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {role === 'admin'
                  ? 'คลิกที่ช่องตารางเพื่อเพิ่ม แก้ไข ลบคาบสอน หรือแก้ไขเวลาคาบที่ 1–6 และพักกลางวัน'
                  : 'ตรวจสอบคาบที่มีการเรียนการสอนประจำ และกด "จองคาบนี้" ในช่องว่างเพื่อขอจอง'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Room Switcher */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {[
                { id: 'all', label: 'ทั้ง 2 ห้อง' },
                ...COMPUTER_ROOMS.map((r) => ({ id: r, label: `ห้อง ${r}` })),
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRoomFilter(opt.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    roomFilter === opt.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {role === 'admin' && (
              <button
                type="button"
                onClick={openTimeSettingsModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 dark:border-violet-800/80 bg-violet-50/80 dark:bg-violet-950/40 px-3.5 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors whitespace-nowrap"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>แก้ไขเวลาคาบที่ 1–6 / พักกลางวัน</span>
              </button>
            )}

            {role === 'admin' && schedules.length === 0 && (
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedSample}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{seeding ? 'กำลังสร้าง...' : 'เติมตัวอย่างตารางสอน'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/80 dark:bg-indigo-950/40 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>พิมพ์ตารางคาบสอน</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Timetable Container */}
      <div className="print-only-container space-y-6">
        {/* Print-only school header */}
        <div className="hidden print:block text-center border-b-2 border-slate-800 pb-3 mb-4">
          <h2 className="text-base font-bold text-slate-900">{settings.schoolName}</h2>
          <p className="text-sm font-semibold text-slate-800">
            ตารางการใช้ห้องคอมพิวเตอร์ประจำสัปดาห์ (วันจันทร์ – วันศุกร์)
          </p>
          <p className="text-xs text-slate-600">
            ปีการศึกษา {settings.academicYear} · ผู้รับผิดชอบ: {settings.labManager} · พิมพ์เมื่อ{' '}
            {formatThaiFullDate(getTodayISO())}
          </p>
        </div>

        {visibleRooms.map((room) => {
          const isRoom1 = room === COMPUTER_ROOMS[0];
          const roomCount = schedules.filter((s) => s.computerRoom === room).length;
          const totalSlots = WEEKDAYS_MON_FRI.length * activeScheduleTimes.periods.length;

          return (
            <section
              key={room}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden"
            >
              <div
                className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b ${
                  isRoom1
                    ? 'border-sky-100/80 dark:border-sky-900/50 bg-gradient-to-r from-sky-50/90 via-blue-50/60 to-transparent dark:from-sky-950/40 dark:via-blue-950/30 dark:to-transparent'
                    : 'border-emerald-100/80 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-transparent dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-xs shrink-0 ${
                      isRoom1
                        ? 'bg-gradient-to-br from-sky-600 to-blue-600'
                        : 'bg-gradient-to-br from-emerald-600 to-teal-600'
                    }`}
                  >
                    <Monitor className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      ห้องปฏิบัติการคอมพิวเตอร์ ({room})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ตารางสอนวันจันทร์ – วันศุกร์ (คาบที่ 1 – 6)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
                    มีคาบสอน {roomCount} คาบ
                  </span>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-300">
                    ว่าง {Math.max(0, totalSlots - roomCount)} คาบ
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto p-4">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200">
                      <th className="border border-slate-200 dark:border-slate-700/80 px-3 py-2.5 text-left whitespace-nowrap w-28">
                        วัน / คาบ
                      </th>
                      {morningPeriods.map((p) => (
                        <th
                          key={p.period}
                          className="border border-slate-200 dark:border-slate-700/80 px-2.5 py-2 text-center whitespace-nowrap"
                        >
                          <div className="font-bold">{p.label}</div>
                          <div className="font-mono-num text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {p.startTime}–{p.endTime}
                          </div>
                        </th>
                      ))}
                      <th className="border border-slate-200 dark:border-slate-700/80 bg-amber-50/70 dark:bg-amber-950/30 px-2 py-2 text-center text-[11px] font-semibold text-amber-700 dark:text-amber-300 w-10">
                        พัก
                      </th>
                      {afternoonPeriods.map((p) => (
                        <th
                          key={p.period}
                          className="border border-slate-200 dark:border-slate-700/80 px-2.5 py-2 text-center whitespace-nowrap"
                        >
                          <div className="font-bold">{p.label}</div>
                          <div className="font-mono-num text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            {p.startTime}–{p.endTime}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {WEEKDAYS_MON_FRI.map((day, dayIdx) => (
                      <tr key={day.id}>
                        <th className="border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-3 text-left font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {day.label}
                        </th>
                        {morningPeriods.map((p) => renderCell(room, day.id, p))}
                        {dayIdx === 0 && (
                          <td
                            rowSpan={WEEKDAYS_MON_FRI.length}
                            className="border border-slate-200 dark:border-slate-700/80 bg-amber-50/50 dark:bg-amber-950/20 text-center align-middle px-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                          >
                            <div className="font-mono-num [writing-mode:vertical-rl] rotate-180 mx-auto tracking-wide">
                              พักกลางวัน {activeScheduleTimes.lunchBreak.startTime}–
                              {activeScheduleTimes.lunchBreak.endTime}
                            </div>
                          </td>
                        )}
                        {afternoonPeriods.map((p) => renderCell(room, day.id, p))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {/* Admin Edit Period 1-6 & Lunch Break Times Modal */}
      {timeModalOpen && role === 'admin' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="time-settings-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50/90 to-indigo-50/50 dark:from-violet-950/40 dark:to-indigo-950/20 px-6 py-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <div>
                  <h3 id="time-settings-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    แก้ไขเวลาคาบที่ 1–6 และพักกลางวัน
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ใช้แสดงบนหัวตารางคาบสอนและตัวเลือกช่วงเวลาจองห้องคอม
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTimeModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleTimes} className="p-6 space-y-3 overflow-y-auto">
              {draftPeriods.slice(0, 4).map((p, idx) => (
                <div
                  key={p.period}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-3.5 py-2.5"
                >
                  <div className="sm:col-span-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {p.label}
                  </div>
                  <div className="sm:col-span-8 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">เริ่ม</span>
                      <input
                        type="time"
                        required
                        aria-label={`${p.label} เวลาเริ่ม`}
                        value={p.startTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftPeriods((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, startTime: val } : item))
                          );
                        }}
                        className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">ถึง</span>
                      <input
                        type="time"
                        required
                        aria-label={`${p.label} เวลาสิ้นสุด`}
                        value={p.endTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftPeriods((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, endTime: val } : item))
                          );
                        }}
                        className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Lunch Break Row */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-2.5">
                <div className="sm:col-span-4 flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <Coffee className="h-3.5 w-3.5 shrink-0" />
                  <span>พักกลางวัน</span>
                </div>
                <div className="sm:col-span-8 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-amber-700 dark:text-amber-300 shrink-0">เริ่ม</span>
                    <input
                      type="time"
                      required
                      aria-label="พักกลางวัน เวลาเริ่ม"
                      value={draftLunchStart}
                      onChange={(e) => setDraftLunchStart(e.target.value)}
                      className="font-mono-num w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-amber-700 dark:text-amber-300 shrink-0">ถึง</span>
                    <input
                      type="time"
                      required
                      aria-label="พักกลางวัน เวลาสิ้นสุด"
                      value={draftLunchEnd}
                      onChange={(e) => setDraftLunchEnd(e.target.value)}
                      className="font-mono-num w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {draftPeriods.slice(4, 6).map((p, sliceIdx) => {
                const idx = sliceIdx + 4;
                return (
                  <div
                    key={p.period}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-3.5 py-2.5"
                  >
                    <div className="sm:col-span-4 text-xs font-bold text-slate-800 dark:text-slate-200">
                      {p.label}
                    </div>
                    <div className="sm:col-span-8 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">เริ่ม</span>
                        <input
                          type="time"
                          required
                          aria-label={`${p.label} เวลาเริ่ม`}
                          value={p.startTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftPeriods((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, startTime: val } : item))
                            );
                          }}
                          className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">ถึง</span>
                        <input
                          type="time"
                          required
                          aria-label={`${p.label} เวลาสิ้นสุด`}
                          value={p.endTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftPeriods((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, endTime: val } : item))
                            );
                          }}
                          className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleResetDefaultTimes}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>รีเซ็ตค่าเริ่มต้น</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTimeModalOpen(false)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={savingTimes}
                    className="rounded-lg bg-violet-600 hover:bg-violet-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {savingTimes ? 'กำลังบันทึก...' : 'บันทึกเวลาคาบสอน'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Add/Edit Schedule Slot Modal */}
      {modalTarget && role === 'admin' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/90 to-violet-50/50 dark:from-indigo-950/40 dark:to-violet-950/20 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 id="schedule-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {modalTarget.existing ? 'แก้ไขข้อมูลคาบสอน' : 'เพิ่มคาบสอนประจำ'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ห้อง {modalTarget.computerRoom} ·{' '}
                    {WEEKDAYS_MON_FRI.find((d) => d.id === modalTarget.dayOfWeek)?.label} · คาบที่{' '}
                    {modalTarget.period}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sch-start" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    เวลาเริ่ม *
                  </label>
                  <input
                    id="sch-start"
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="sch-end" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    เวลาสิ้นสุด *
                  </label>
                  <input
                    id="sch-end"
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sch-class" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  ชั้นเรียน / กลุ่มผู้เรียน *
                </label>
                <select
                  id="sch-class"
                  value={formClassName}
                  onChange={(e) => setFormClassName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  {SCHEDULE_CLASS_OPTIONS.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sch-subject" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  รายวิชาที่สอน *
                </label>
                <select
                  id="sch-subject"
                  value={formSubjectChoice}
                  onChange={(e) => setFormSubjectChoice(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.code ? `${sub.code} — ${sub.name}` : sub.name}
                    </option>
                  ))}
                  <option value="__custom__">ระบุชื่อรายวิชาเอง...</option>
                </select>
                {formSubjectChoice === '__custom__' && (
                  <input
                    type="text"
                    required
                    value={formCustomSubject}
                    onChange={(e) => setFormCustomSubject(e.target.value)}
                    placeholder="พิมพ์ชื่อรายวิชา เช่น วิทยาการคำนวณ"
                    className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                )}
              </div>

              <div>
                <label htmlFor="sch-teacher" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  ครูผู้สอน *
                </label>
                <input
                  id="sch-teacher"
                  type="text"
                  required
                  value={formTeacherName}
                  onChange={(e) => setFormTeacherName(e.target.value)}
                  placeholder="ระบุชื่อครูผู้สอน"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="sch-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <input
                  id="sch-note"
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="เช่น สอนกลุ่ม A สัปดาห์คี่"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {modalTarget.existing ? (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(modalTarget.existing)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>ลบคาบนี้</span>
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTarget(null)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? 'กำลังบันทึก...' : 'บันทึกคาบสอน'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบคาบสอน"
        description={`ต้องการลบคาบสอน "${deleteTarget?.subjectName || ''}" (${deleteTarget?.className || ''}) ห้อง ${
          deleteTarget?.computerRoom || ''
        } คาบที่ ${deleteTarget?.period || ''} ออกจากตารางหรือไม่?`}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
