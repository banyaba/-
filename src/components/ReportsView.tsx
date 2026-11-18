import { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarRange,
  BookOpenCheck,
  BarChart3,
  FileText,
  Printer,
  Download,
} from 'lucide-react';
import { THAI_MONTHS, type AppSettings, type UsageLog } from '../types';
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
}

export function ReportsView({ logs, settings, onNotify }: ReportsViewProps) {
  const now = new Date();
  const defaultBeYear = Number(settings.academicYear) || now.getFullYear() + 543;

  const [draft, setDraft] = useState<ReportCriteria>({
    type: 'monthly',
    date: getTodayISO(),
    month: now.getMonth() + 1,
    beYear: defaultBeYear,
    semester: '1',
    academicYear: defaultBeYear,
    yearlyMode: 'academic',
  });

  const [applied, setApplied] = useState<ReportCriteria>(draft);

  const availableBeYears = useMemo(() => {
    const set = new Set<number>([defaultBeYear, now.getFullYear() + 543, 2568, 2567]);
    logs.forEach((l) => {
      if (l.date && /^\d{4}/.test(l.date)) {
        set.add(Number(l.date.slice(0, 4)) + 543);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [logs, defaultBeYear]);

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

  const reportTitle = useMemo(() => {
    if (applied.type === 'daily') {
      return `รายงานการใช้ห้องคอมพิวเตอร์ ประจำวันที่ ${formatThaiFullDate(applied.date)}`;
    }
    if (applied.type === 'monthly') {
      const m = THAI_MONTHS[applied.month - 1];
      return `รายงานการใช้ห้องคอมพิวเตอร์ ประจำเดือน ${m ? m.full : applied.month} พ.ศ. ${applied.beYear}`;
    }
    if (applied.type === 'semester') {
      const semLabel =
        applied.semester === '1' ? 'ภาคเรียนที่ 1 (พ.ค. – ก.ย.)' : 'ภาคเรียนที่ 2 (ต.ค. – เม.ย.)';
      return `รายงานการใช้ห้องคอมพิวเตอร์ ${semLabel} ปีการศึกษา ${applied.academicYear}`;
    }
    return applied.yearlyMode === 'academic'
      ? `รายงานการใช้ห้องคอมพิวเตอร์ ประจำปีการศึกษา ${applied.academicYear} (พ.ค. ${applied.academicYear} – เม.ย. ${applied.academicYear + 1})`
      : `รายงานการใช้ห้องคอมพิวเตอร์ ประจำปี พ.ศ. ${applied.academicYear} (ม.ค. – ธ.ค.)`;
  }, [applied]);

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
    const rowsToExport = filterLogsForReport(logs, draft);
    if (rowsToExport.length === 0) {
      onNotify('error', 'ไม่มีข้อมูลในช่วงรายงานที่เลือกสำหรับส่งออก CSV');
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
    exportLogsToCSV(rowsToExport, `computer-lab-report-${suffix}.csv`);
    onNotify('success', `ส่งออกไฟล์ CSV จำนวน ${rowsToExport.length} รายการเรียบร้อยแล้ว`);
  };

  const todayThai = formatThaiFullDate(getTodayISO());

  return (
    <div className="space-y-6">
      {/* Control Panel (hidden on print) */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-5">
        {/* 4 Report Type Buttons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { id: 'daily' as const, label: '1. รายวัน', icon: Calendar },
            { id: 'monthly' as const, label: '2. รายเดือน', icon: CalendarRange },
            { id: 'semester' as const, label: '3. รายภาค', icon: BookOpenCheck },
            { id: 'yearly' as const, label: '4. รายปี', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            const active = draft.type === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, type: item.id }))}
                className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'border-transparent text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                style={active ? { backgroundColor: 'var(--theme-primary)' } : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
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
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            <Printer className="h-4 w-4" />
            <span>พิมพ์ A4</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 whitespace-nowrap"
            style={{ backgroundColor: 'var(--theme-accent)' }}
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Print-Friendly A4 Document Preview */}
      <article className="print-only-container mx-auto max-w-[920px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 p-8 sm:p-10 shadow-sm">
        {/* Document Header */}
        <header className="border-b-2 border-slate-800 pb-4 text-center">
          <h2 className="text-lg font-bold text-slate-900">{settings.schoolName}</h2>
          <p className="mt-1 text-base font-semibold text-slate-800">{reportTitle}</p>
          <p className="mt-1 text-xs text-slate-500">
            ปีการศึกษา {settings.academicYear} · ผู้รับผิดชอบห้องคอมพิวเตอร์: {settings.labManager}
          </p>
        </header>

        {/* 4 Summary Stat Cards */}
        <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-center">
            <div className="text-xs font-medium text-slate-500">ครั้งการใช้</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
              {reportStats.totalUsages.toLocaleString('th-TH')}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-center">
            <div className="text-xs font-medium text-slate-500">นักเรียน</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
              {reportStats.uniqueStudents.toLocaleString('th-TH')}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-center">
            <div className="text-xs font-medium text-slate-500">ชั้นเรียน</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
              {reportStats.uniqueClasses.toLocaleString('th-TH')}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-center">
            <div className="text-xs font-medium text-slate-500">วิชา</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900">
              {reportStats.uniqueSubjects.toLocaleString('th-TH')}
            </div>
          </div>
        </section>

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
