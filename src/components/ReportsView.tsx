import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarRange,
  BookOpenCheck,
  BarChart3,
  FileText,
  Printer,
  Download,
  Monitor,
  Layers,
} from 'lucide-react';
import {
  getActiveComputerRooms,
  THAI_MONTHS,
  type AppSettings,
  type UsageLog,
} from '../types';
import {
  exportLogsToCSV,
  filterLogsForReport,
  formatBuddhistISO,
  formatThaiFullDate,
  getTodayISO,
} from '../utils/thaiDate';

interface ReportsViewProps {
  logs: UsageLog[];
  settings: AppSettings;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

type ReportType = 'daily' | 'monthly' | 'semester' | 'yearly';

interface ReportCriteria {
  type: ReportType;
  date: string;
  month: number;
  beYear: number;
  semester: '1' | '2';
  academicYear: number;
  yearlyMode: 'academic' | 'calendar';
  roomFilter: 'all' | string;
}

export function ReportsView({ logs, settings, onNotify }: ReportsViewProps) {
  const now = new Date();
  const defaultBeYear = Number(settings.academicYear) || now.getFullYear() + 543;

  const activeRooms = useMemo(() => getActiveComputerRooms(settings), [settings]);
  const allKnownRooms = useMemo(
    () =>
      Array.from(
        new Set([
          ...activeRooms,
          ...logs.map((l) => (l.computerRoom || '').trim()).filter(Boolean),
        ])
      ),
    [activeRooms, logs]
  );

  const [draft, setDraft] = useState<ReportCriteria>({
    type: 'monthly',
    date: getTodayISO(),
    month: now.getMonth() + 1,
    beYear: defaultBeYear,
    semester: '1',
    academicYear: defaultBeYear,
    yearlyMode: 'academic',
    roomFilter: 'all',
  });

  const [applied, setApplied] = useState<ReportCriteria>(draft);

  useEffect(() => {
    if (draft.roomFilter !== 'all' && !allKnownRooms.includes(draft.roomFilter)) {
      setDraft((prev) => ({ ...prev, roomFilter: 'all' }));
    }
    if (applied.roomFilter !== 'all' && !allKnownRooms.includes(applied.roomFilter)) {
      setApplied((prev) => ({ ...prev, roomFilter: 'all' }));
    }
  }, [allKnownRooms, draft.roomFilter, applied.roomFilter]);

  const availableBeYears = useMemo(() => {
    const set = new Set<number>([defaultBeYear, now.getFullYear() + 543, 2568, 2567]);
    logs.forEach((l) => {
      if (l.date && /^\d{4}/.test(l.date)) {
        set.add(Number(l.date.slice(0, 4)) + 543);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [logs, defaultBeYear]);

  // Usage counts per room for the current draft period (for quick indicator on room buttons)
  const draftPeriodLogs = useMemo(
    () => filterLogsForReport(logs, { ...draft, roomFilter: 'all' }),
    [logs, draft]
  );

  const draftRoomCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of allKnownRooms) {
      counts.set(r, 0);
    }
    for (const log of draftPeriodLogs) {
      const rm = (log.computerRoom || '').trim();
      if (rm) {
        counts.set(rm, (counts.get(rm) || 0) + 1);
      }
    }
    return counts;
  }, [draftPeriodLogs, allKnownRooms]);

  const reportLogs = useMemo(
    () =>
      filterLogsForReport(logs, applied).sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return (a.timeIn || '').localeCompare(b.timeIn || '');
      }),
    [logs, applied]
  );

  const reportStats = useMemo(() => {
    const studentSet = new Set<string>();
    const classSet = new Set<string>();
    const subjectSet = new Set<string>();
    for (const log of reportLogs) {
      studentSet.add(`${log.className}::${log.studentName}`);
      classSet.add(log.className);
      subjectSet.add(log.subjectName);
    }
    return {
      totalUsages: reportLogs.length,
      uniqueStudents: studentSet.size,
      uniqueClasses: classSet.size,
      uniqueSubjects: subjectSet.size,
    };
  }, [reportLogs]);

  const roomBreakdown = useMemo(() => {
    if (applied.roomFilter !== 'all') return [];
    const total = reportLogs.length;
    const rows = allKnownRooms.map((room) => {
      const items = reportLogs.filter((l) => (l.computerRoom || '').trim() === room);
      const stuSet = new Set(items.map((l) => `${l.className}::${l.studentName}`));
      const pct = total > 0 ? Math.round((items.length / total) * 100) : 0;
      return {
        room,
        usages: items.length,
        uniqueStudents: stuSet.size,
        pct,
      };
    });
    const unspecified = reportLogs.filter((l) => !(l.computerRoom || '').trim());
    if (unspecified.length > 0) {
      const stuSet = new Set(unspecified.map((l) => `${l.className}::${l.studentName}`));
      rows.push({
        room: 'ไม่ระบุห้อง',
        usages: unspecified.length,
        uniqueStudents: stuSet.size,
        pct: total > 0 ? Math.round((unspecified.length / total) * 100) : 0,
      });
    }
    return rows;
  }, [applied.roomFilter, reportLogs, allKnownRooms]);

  const reportRoomLabel = useMemo(() => {
    if (applied.roomFilter === 'all') {
      return 'รวมทุกห้อง';
    }
    return applied.roomFilter.startsWith('ห้อง')
      ? applied.roomFilter
      : `ห้อง ${applied.roomFilter}`;
  }, [applied.roomFilter]);

  const reportTitle = useMemo(() => {
    const roomSuffix = ` (${reportRoomLabel})`;
    if (applied.type === 'daily') {
      return `รายงานการใช้ห้องคอมพิวเตอร์${roomSuffix} ประจำวันที่ ${formatThaiFullDate(applied.date)}`;
    }
    if (applied.type === 'monthly') {
      const m = THAI_MONTHS[applied.month - 1];
      return `รายงานการใช้ห้องคอมพิวเตอร์${roomSuffix} ประจำเดือน ${m ? m.full : applied.month} พ.ศ. ${applied.beYear}`;
    }
    if (applied.type === 'semester') {
      const semLabel =
        applied.semester === '1' ? 'ภาคเรียนที่ 1 (พ.ค. – ก.ย.)' : 'ภาคเรียนที่ 2 (ต.ค. – เม.ย.)';
      return `รายงานการใช้ห้องคอมพิวเตอร์${roomSuffix} ${semLabel} ปีการศึกษา ${applied.academicYear}`;
    }
    return applied.yearlyMode === 'academic'
      ? `รายงานการใช้ห้องคอมพิวเตอร์${roomSuffix} ประจำปีการศึกษา ${applied.academicYear} (พ.ค. ${applied.academicYear} – เม.ย. ${applied.academicYear + 1})`
      : `รายงานการใช้ห้องคอมพิวเตอร์${roomSuffix} ประจำปี พ.ศ. ${applied.academicYear} (ม.ค. – ธ.ค.)`;
  }, [applied, reportRoomLabel]);

  const handleRoomSelect = (room: 'all' | string) => {
    setDraft((prev) => ({ ...prev, roomFilter: room }));
    setApplied((prev) => ({ ...prev, roomFilter: room }));
  };

  const handleGenerate = () => {
    setApplied({ ...draft });
    onNotify('success', 'สร้างตัวอย่างรายงานเรียบร้อยแล้ว');
  };

  const handlePrint = () => {
    setApplied({ ...draft });
    setTimeout(() => {
      window.print();
    }, 80);
  };

  const handleExportCSV = () => {
    const rowsToExport = filterLogsForReport(logs, draft).sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.timeIn || '').localeCompare(b.timeIn || '');
    });
    if (rowsToExport.length === 0) {
      onNotify('error', 'ไม่มีข้อมูลในช่วงเวลาและห้องคอมที่เลือกสำหรับส่งออก CSV');
      return;
    }
    const suffix =
      draft.type === 'daily'
        ? draft.date
        : draft.type === 'monthly'
        ? `${draft.beYear}-${String(draft.month).padStart(2, '0')}`
        : draft.type === 'semester'
        ? `${draft.academicYear}-sem${draft.semester}`
        : `${draft.academicYear}`;
    const roomSlug =
      draft.roomFilter === 'all' ? 'all-rooms' : draft.roomFilter.replace(/\s+/g, '-');
    exportLogsToCSV(rowsToExport, `computer-lab-report-${roomSlug}-${suffix}.csv`);
    onNotify('success', `ส่งออกไฟล์ CSV จำนวน ${rowsToExport.length} รายการเรียบร้อยแล้ว`);
  };

  const todayThai = formatThaiFullDate(getTodayISO());

  return (
    <div className="space-y-6">
      {/* Control Panel (hidden on print) */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-rose-100/80 dark:border-rose-900/50 bg-gradient-to-r from-rose-50/90 via-pink-50/60 to-transparent dark:from-rose-950/40 dark:via-pink-950/30 dark:to-transparent px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600 to-pink-600 text-white shadow-xs shrink-0">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              กำหนดเงื่อนไขและออกรายงานการใช้ห้องคอมพิวเตอร์
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เลือกรูปแบบช่วงเวลา เลือกดูแยกตามห้องคอมหรือรวมทุกห้อง พิมพ์ A4 หรือส่งออกไฟล์ CSV
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* 4 Report Type Buttons */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              {
                id: 'daily' as const,
                label: '1. รายวัน',
                icon: Calendar,
                activeGrad: 'from-sky-600 to-cyan-600',
                iconBg: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
              },
              {
                id: 'monthly' as const,
                label: '2. รายเดือน',
                icon: CalendarRange,
                activeGrad: 'from-indigo-600 to-violet-600',
                iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
              },
              {
                id: 'semester' as const,
                label: '3. รายภาค',
                icon: BookOpenCheck,
                activeGrad: 'from-amber-500 to-orange-600',
                iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
              },
              {
                id: 'yearly' as const,
                label: '4. รายปี',
                icon: BarChart3,
                activeGrad: 'from-rose-600 to-pink-600',
                iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = draft.type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, type: item.id }))}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap ${
                    active
                      ? `border-transparent bg-gradient-to-r ${item.activeGrad} text-white shadow-sm`
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md shrink-0 ${
                      active ? 'bg-white/20 text-white' : item.iconBg
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Criteria Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {draft.type === 'daily' && (
              <div>
                <label htmlFor="rep-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  เลือกวันที่
                </label>
                <input
                  id="rep-date"
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {draft.type === 'monthly' && (
              <>
                <div>
                  <label htmlFor="rep-month" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    เลือกเดือน
                  </label>
                  <select
                    id="rep-month"
                    value={draft.month}
                    onChange={(e) => setDraft((p) => ({ ...p, month: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {THAI_MONTHS.map((m) => (
                      <option key={m.index} value={m.index + 1}>
                        {m.full}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rep-year" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ปี พ.ศ.
                  </label>
                  <select
                    id="rep-year"
                    value={draft.beYear}
                    onChange={(e) => setDraft((p) => ({ ...p, beYear: Number(e.target.value) }))}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {availableBeYears.map((y) => (
                      <option key={y} value={y}>
                        พ.ศ. {y}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {draft.type === 'semester' && (
              <>
                <div>
                  <label htmlFor="rep-sem" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ภาคเรียน
                  </label>
                  <select
                    id="rep-sem"
                    value={draft.semester}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, semester: e.target.value as '1' | '2' }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="1">ภาคเรียนที่ 1 (พ.ค. – ก.ย.)</option>
                    <option value="2">ภาคเรียนที่ 2 (ต.ค. – เม.ย.)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rep-acad" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ปีการศึกษา
                  </label>
                  <select
                    id="rep-acad"
                    value={draft.academicYear}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, academicYear: Number(e.target.value) }))
                    }
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {availableBeYears.map((y) => (
                      <option key={y} value={y}>
                        ปีการศึกษา {y}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {draft.type === 'yearly' && (
              <>
                <div>
                  <label htmlFor="rep-yearly-acad" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ปีการศึกษา
                  </label>
                  <select
                    id="rep-yearly-acad"
                    value={draft.academicYear}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, academicYear: Number(e.target.value) }))
                    }
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    {availableBeYears.map((y) => (
                      <option key={y} value={y}>
                        ปีการศึกษา {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="rep-yearly-mode" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ขอบเขตเดือน
                  </label>
                  <select
                    id="rep-yearly-mode"
                    value={draft.yearlyMode}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        yearlyMode: e.target.value as 'academic' | 'calendar',
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="academic">ตามปีการศึกษา (พ.ค. – เม.ย.)</option>
                    <option value="calendar">ตามปีปฏิทิน (ม.ค. – ธ.ค.)</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Computer Room Scope Filter (Separate or Combined) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                เลือกห้องคอมพิวเตอร์ (แยกห้อง หรือ รวมทุกห้อง)
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                คลิกเพื่อสลับดูรายงานทันที
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRoomSelect('all')}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                  draft.roomFilter === 'all'
                    ? 'border-transparent bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                }`}
              >
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span>รวมทุกห้อง</span>
                <span
                  className={`font-mono-num text-[11px] ${
                    draft.roomFilter === 'all'
                      ? 'text-slate-300 dark:text-slate-600'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  ({draftPeriodLogs.length})
                </span>
              </button>

              {allKnownRooms.map((room) => {
                const isSelected = draft.roomFilter === room;
                const count = draftRoomCounts.get(room) || 0;
                const isConfigured = activeRooms.includes(room);
                return (
                  <button
                    key={room}
                    type="button"
                    onClick={() => handleRoomSelect(room)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                      isSelected
                        ? 'border-transparent bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {room}
                      {!isConfigured ? ' (เดิม)' : ''}
                    </span>
                    <span
                      className={`font-mono-num text-[11px] ${
                        isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 whitespace-nowrap"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              <FileText className="h-4 w-4" />
              <span>สร้างรายงาน</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 px-4 py-2.5 text-sm font-medium text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
            >
              <Printer className="h-4 w-4" />
              <span>พิมพ์ A4</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 whitespace-nowrap"
              style={{ backgroundColor: 'var(--theme-accent)' }}
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Print-Friendly A4 Document Preview */}
      <article className="print-only-container mx-auto max-w-[920px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 p-8 sm:p-10 shadow-sm">
        {/* Document Header */}
        <header className="border-b-2 border-slate-800 pb-4 text-center">
          <h2 className="text-lg font-bold text-slate-900">{settings.schoolName}</h2>
          <p className="mt-1 text-base font-semibold text-indigo-900">{reportTitle}</p>
          <p className="mt-1 text-xs text-slate-500">
            ปีการศึกษา {settings.academicYear} · ขอบเขต: {reportRoomLabel} · ผู้รับผิดชอบห้องคอมพิวเตอร์: {settings.labManager}
          </p>
        </header>

        {/* 4 Summary Stat Cards */}
        <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-blue-200/80 bg-blue-50/70 p-3.5 text-center">
            <div className="text-xs font-medium text-blue-700">ครั้งการใช้</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-blue-950">
              {reportStats.totalUsages.toLocaleString('th-TH')}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-3.5 text-center">
            <div className="text-xs font-medium text-emerald-700">นักเรียน</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-emerald-950">
              {reportStats.uniqueStudents.toLocaleString('th-TH')}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3.5 text-center">
            <div className="text-xs font-medium text-amber-700">ชั้นเรียน</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-amber-950">
              {reportStats.uniqueClasses.toLocaleString('th-TH')}
            </div>
          </div>
          <div className="rounded-lg border border-violet-200/80 bg-violet-50/70 p-3.5 text-center">
            <div className="text-xs font-medium text-violet-700">วิชา</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-violet-950">
              {reportStats.uniqueSubjects.toLocaleString('th-TH')}
            </div>
          </div>
        </section>

        {/* Per-Room Summary Breakdown (when viewing combined report) */}
        {applied.roomFilter === 'all' && roomBreakdown.length > 0 && (
          <section className="mt-4">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              สรุปจำนวนการใช้งานแยกตามห้องคอมพิวเตอร์
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {roomBreakdown.map((item) => (
                <div
                  key={item.room}
                  className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {item.room}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-num">
                      {item.uniqueStudents.toLocaleString('th-TH')} คน
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono-num text-sm font-bold text-indigo-900">
                      {item.usages.toLocaleString('th-TH')} ครั้ง
                    </div>
                    <div className="font-mono-num text-[11px] text-slate-500">{item.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Detail Table */}
        <section className="mt-6">
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800">
                <th className="border border-slate-300 px-2.5 py-2 text-center w-12">ลำดับ</th>
                <th className="border border-slate-300 px-2.5 py-2 text-left whitespace-nowrap">วันที่</th>
                <th className="border border-slate-300 px-2.5 py-2 text-center whitespace-nowrap">เข้าใช้</th>
                <th className="border border-slate-300 px-2.5 py-2 text-center whitespace-nowrap">ห้อง/เครื่อง</th>
                <th className="border border-slate-300 px-2.5 py-2 text-left">ชื่อ</th>
                <th className="border border-slate-300 px-2.5 py-2 text-center whitespace-nowrap">ชั้น</th>
                <th className="border border-slate-300 px-2.5 py-2 text-left">วิชา</th>
                <th className="border border-slate-300 px-2.5 py-2 text-left">รูปแบบการใช้</th>
              </tr>
            </thead>
            <tbody>
              {reportLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="border border-slate-300 px-4 py-8 text-center text-slate-500"
                  >
                    ไม่พบข้อมูลการใช้ห้องคอมพิวเตอร์ในช่วงเวลาที่เลือก
                  </td>
                </tr>
              ) : (
                reportLogs.map((log, i) => (
                  <tr key={log.id} className="odd:bg-white even:bg-slate-50/50">
                    <td className="border border-slate-300 px-2.5 py-1.5 text-center font-mono-num">
                      {i + 1}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 font-mono-num whitespace-nowrap">
                      {formatBuddhistISO(log.date)}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-center font-mono-num whitespace-nowrap">
                      {log.timeIn || '-'}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-center font-mono-num whitespace-nowrap">
                      {log.computerRoom || log.computerNumber
                        ? `${log.computerRoom || '-'}${
                            log.computerNumber ? `/${log.computerNumber}` : ''
                          }`
                        : '-'}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 font-medium">
                      {log.studentName}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-center whitespace-nowrap">
                      {log.className}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5">
                      {log.subjectName}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5">
                      {log.usageTypes.length > 0 ? log.usageTypes.join(', ') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Signatures Block */}
        <section className="mt-12 grid grid-cols-3 gap-6 text-center text-xs text-slate-800 break-inside-avoid">
          <div>
            <p className="mb-8">ลงชื่อ ............................................</p>
            <p>(............................................)</p>
            <p className="mt-1 font-semibold">ผู้ตรวจสอบ 1</p>
          </div>
          <div>
            <p className="mb-8">ลงชื่อ ............................................</p>
            <p>(............................................)</p>
            <p className="mt-1 font-semibold">ผู้ตรวจสอบ 2</p>
          </div>
          <div>
            <p className="mb-8">ลงชื่อ ............................................</p>
            <p>({settings.labManager})</p>
            <p className="mt-1 font-semibold">ผู้รับผิดชอบ</p>
          </div>
        </section>

        {/* Document Footer */}
        <footer className="mt-10 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>หน้า 1 / 1</span>
          <span>วันที่พิมพ์: {todayThai}</span>
          <span>{settings.schoolName}</span>
        </footer>
      </article>
    </div>
  );
}
