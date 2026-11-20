import { useMemo, useState } from 'react';
import {
  Activity,
  Users,
  School,
  BookOpen,
  PlusCircle,
  Table2,
  FileBarChart2,
  ArrowRight,
} from 'lucide-react';
import {
  THAI_MONTHS,
  type PageId,
  type Student,
  type Subject,
  type UsageLog,
  type UserRole,
} from '../types';
import { formatBuddhistISO } from '../utils/thaiDate';

interface DashboardViewProps {
  role: UserRole;
  logs: UsageLog[];
  students: Student[];
  subjects: Subject[];
  classList: string[];
  academicYear: string;
  onNavigate: (page: PageId) => void;
}

export function DashboardView({
  role,
  logs,
  students,
  subjects,
  classList,
  academicYear,
  onNavigate,
}: DashboardViewProps) {
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const defaultGYear = Number(academicYear) - 543 || new Date().getFullYear();
    years.add(defaultGYear);
    years.add(new Date().getFullYear());
    for (const log of logs) {
      if (log.date && /^\d{4}/.test(log.date)) {
        years.add(Number(log.date.slice(0, 4)));
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [logs, academicYear]);

  const [selectedYear, setSelectedYear] = useState<string>(() =>
    String(availableYears[0] || new Date().getFullYear())
  );
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const uniqueStudentsCount = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      set.add(`${log.className}::${log.studentName}`);
    }
    return set.size;
  }, [logs]);

  const activeClassesCount = useMemo(() => {
    const set = new Set(logs.map((l) => l.className));
    return set.size;
  }, [logs]);

  const monthlyData = useMemo(() => {
    const counts = new Array<number>(12).fill(0);
    for (const log of logs) {
      if (!log.date || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) continue;
      const [y, m] = log.date.split('-').map(Number);
      if (selectedYear === 'all' || String(y) === selectedYear) {
        if (m >= 1 && m <= 12) {
          counts[m - 1] += 1;
        }
      }
    }
    return counts;
  }, [logs, selectedYear]);

  const totalYearUsage = useMemo(
    () => monthlyData.reduce((acc, v) => acc + v, 0),
    [monthlyData]
  );
  const averagePerMonth = useMemo(() => totalYearUsage / 12, [totalYearUsage]);
  const maxMonthValue = useMemo(() => Math.max(1, ...monthlyData), [monthlyData]);

  const peakMonth = useMemo(() => {
    let bestIdx = 0;
    for (let i = 1; i < monthlyData.length; i++) {
      if (monthlyData[i] > monthlyData[bestIdx]) bestIdx = i;
    }
    return {
      month: THAI_MONTHS[bestIdx],
      count: monthlyData[bestIdx],
    };
  }, [monthlyData]);

  const recentLogs = useMemo(() => logs.slice(0, 6), [logs]);

  return (
    <div className="space-y-6">
      {/* 4 Quick Stat Cards */}
      <section aria-label="สถิติด่วน" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-200/70 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/80 via-[var(--theme-surface)] to-[var(--theme-surface)] dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              ครั้งการใช้ทั้งหมด
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xs">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 font-mono-num text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {logs.length.toLocaleString('th-TH')}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            บันทึกการใช้งานสะสมในระบบ
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/80 via-[var(--theme-surface)] to-[var(--theme-surface)] dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              จำนวนนักเรียนที่เข้าใช้
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 font-mono-num text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {uniqueStudentsCount.toLocaleString('th-TH')}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            จากรายชื่อในระบบทั้งหมด <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-300">{students.length}</span> คน
          </p>
        </div>

        <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/80 via-[var(--theme-surface)] to-[var(--theme-surface)] dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              ชั้นเรียนทั้งหมด
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
              <School className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 font-mono-num text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {classList.length}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            เข้าใช้งานแล้ว <span className="font-mono-num font-semibold text-amber-700 dark:text-amber-300">{activeClassesCount}</span> จาก {classList.length} ชั้นเรียน
          </p>
        </div>

        <div className="rounded-xl border border-violet-200/70 dark:border-violet-900/60 bg-gradient-to-br from-violet-50/80 via-[var(--theme-surface)] to-[var(--theme-surface)] dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
              วิชาทั้งหมด
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xs">
              <BookOpen className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 font-mono-num text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {subjects.length.toLocaleString('th-TH')}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            รายวิชาที่ลงทะเบียนในห้องคอมพิวเตอร์
          </p>
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="ปุ่มลัด" className="rounded-xl border border-indigo-200/70 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/60 via-[var(--theme-surface)] to-teal-50/60 dark:from-indigo-950/25 dark:via-slate-900 dark:to-teal-950/20 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ทางลัดการทำงาน (Quick Actions)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              เลือกเมนูที่ต้องการใช้งานได้ทันที
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('add-data')}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))' }}
            >
              <PlusCircle className="h-4 w-4" />
              <span>บันทึกใช้งาน</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('data-table')}
              className="inline-flex items-center gap-2 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 px-4 py-2.5 text-sm font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 transition-colors whitespace-nowrap shrink-0"
            >
              <Table2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>ประวัติการใช้</span>
            </button>

            {role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
                style={{ background: 'linear-gradient(135deg, #e11d48, #db2777)' }}
              >
                <FileBarChart2 className="h-4 w-4" />
                <span>รายงาน</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 12-Month Vertical Gradient Bar Chart */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              สถิติการใช้ห้องคอมพิวเตอร์รายเดือน (12 เดือน)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              แสดงจำนวนครั้งการเข้าใช้งานแยกตามเดือน มกราคม – ธันวาคม
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="dashboard-year-filter" className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              ช่วงข้อมูล:
            </label>
            <select
              id="dashboard-year-filter"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  พ.ศ. {y + 543}
                </option>
              ))}
              <option value="all">ทุกปีรวมกัน</option>
            </select>
          </div>
        </div>

        {/* Vertical Bars Grid */}
        <div className="mt-6 overflow-x-auto pb-2">
          <div className="min-w-[640px]">
            <div className="relative h-64 flex items-end gap-3 px-2 pt-8 border-b border-slate-200 dark:border-slate-800">
              {/* Subtle horizontal guide lines */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 top-8 flex flex-col justify-between">
                {[0, 1, 2, 3].map((line) => (
                  <div
                    key={line}
                    className="w-full border-t border-dashed border-slate-100 dark:border-slate-800/80"
                  />
                ))}
              </div>

              {THAI_MONTHS.map((month, idx) => {
                const count = monthlyData[idx];
                const pctHeight = count === 0 ? 4 : Math.max(10, Math.round((count / maxMonthValue) * 100));
                const isHovered = hoveredMonth === idx;

                return (
                  <div
                    key={month.short}
                    onMouseEnter={() => setHoveredMonth(idx)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    className="relative z-10 flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                  >
                    {/* Value Label / Hover Tooltip */}
                    <div
                      className={`mb-2 font-mono-num text-xs font-semibold transition-all duration-150 ${
                        isHovered
                          ? 'scale-110 text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {count}
                    </div>

                    {/* Floating Hover Card */}
                    {isHovered && (
                      <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-white shadow-lg">
                        <div className="font-medium">{month.full}</div>
                        <div className="font-mono-num text-slate-300">
                          {count} ครั้ง ({totalYearUsage > 0 ? Math.round((count / totalYearUsage) * 100) : 0}%)
                        </div>
                      </div>
                    )}

                    {/* Gradient Bar rising from bottom */}
                    <div
                      className="w-full max-w-[38px] rounded-t-lg transition-all duration-300 ease-out origin-bottom"
                      style={{
                        height: `${pctHeight}%`,
                        background:
                          count === 0
                            ? 'linear-gradient(to top, rgba(148,163,184,0.22), rgba(148,163,184,0.38))'
                            : `linear-gradient(to top, ${month.from}, ${month.to})`,
                        boxShadow: isHovered && count > 0 ? `0 10px 22px -4px ${month.shadow}` : 'none',
                        transform: isHovered ? 'translateY(-3px) scaleX(1.05)' : 'translateY(0) scaleX(1)',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Month Labels Row */}
            <div className="flex items-center gap-3 px-2 pt-3">
              {THAI_MONTHS.map((month, idx) => (
                <div
                  key={month.short}
                  className={`flex-1 text-center text-xs font-medium transition-colors ${
                    hoveredMonth === idx
                      ? 'text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {month.short}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Footer */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-slate-500 dark:text-slate-400">รวมทั้งหมด: </span>
              <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                {totalYearUsage.toLocaleString('th-TH')} ครั้ง
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">เฉลี่ยต่อเดือน: </span>
              <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                {averagePerMonth.toFixed(1)} ครั้ง/เดือน
              </span>
            </div>
          </div>
          {totalYearUsage > 0 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              เดือนที่เข้าใช้งานสูงสุด:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {peakMonth.month.full} ({peakMonth.count} ครั้ง)
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Recent Logs Preview */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/50 via-transparent to-blue-50/40 dark:from-indigo-950/25 dark:via-transparent dark:to-blue-950/20">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            รายการเข้าใช้ล่าสุด
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('data-table')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline whitespace-nowrap"
            style={{ color: 'var(--theme-primary)' }}
          >
            <span>ดูทั้งหมด</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มีข้อมูลการเข้าใช้ห้องคอมพิวเตอร์
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-slate-50 via-blue-50/50 to-indigo-50/40 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-800/80 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-6 py-3 whitespace-nowrap">วันที่ (พ.ศ.)</th>
                  <th className="px-4 py-3 whitespace-nowrap">เข้าใช้</th>
                  <th className="px-4 py-3 whitespace-nowrap">ชื่อนักเรียน</th>
                  <th className="px-4 py-3 whitespace-nowrap">ชั้น</th>
                  <th className="px-4 py-3 whitespace-nowrap">รายวิชา</th>
                  <th className="px-6 py-3 whitespace-nowrap">รูปแบบการใช้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3 font-mono-num text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatBuddhistISO(log.date)}
                    </td>
                    <td className="px-4 py-3 font-mono-num text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {log.timeIn || '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {log.studentName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {log.className}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {log.subjectName}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {log.usageTypes.length > 0 ? log.usageTypes.join(', ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
