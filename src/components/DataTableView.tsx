import { useMemo, useState } from 'react';
import { Search, Calendar, Trash2, Pencil, RotateCcw } from 'lucide-react';
import { EXTERNAL_VISITOR_CLASS, type Subject, type UsageLog, type UserRole } from '../types';
import { formatBuddhistISO, getTodayISO } from '../utils/thaiDate';
import { api } from '../api/client';
import { ConfirmModal } from './ConfirmModal';

interface DataTableViewProps {
  role: UserRole;
  logs: UsageLog[];
  subjects: Subject[];
  classList: string[];
  onEditLog: (log: UsageLog) => void;
  onLogsChanged: (next: UsageLog[]) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function DataTableView({
  role,
  logs,
  subjects,
  classList,
  onEditLog,
  onLogsChanged,
  onNotify,
}: DataTableViewProps) {
  const [searchName, setSearchName] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchClass, setSearchClass] = useState('all');
  const [searchSubject, setSearchSubject] = useState('all');

  const [deleteTarget, setDeleteTarget] = useState<UsageLog | null>(null);
  const [confirmDeleteToday, setConfirmDeleteToday] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const todayISO = getTodayISO();
  const todayCount = useMemo(
    () => logs.filter((l) => l.date === todayISO).length,
    [logs, todayISO]
  );

  const subjectOptions = useMemo(() => {
    const names = new Set<string>(subjects.map((s) => s.name));
    logs.forEach((l) => names.add(l.subjectName));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'th'));
  }, [subjects, logs]);

  const classOptions = useMemo(() => {
    const seen = new Set<string>(classList);
    const extra: string[] = [];
    for (const l of logs) {
      const cls = l.className?.trim();
      if (cls && cls !== EXTERNAL_VISITOR_CLASS && !seen.has(cls)) {
        seen.add(cls);
        extra.push(cls);
      }
    }
    return [...classList, ...extra.sort((a, b) => a.localeCompare(b, 'th'))];
  }, [classList, logs]);

  const filteredLogs = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return logs.filter((log) => {
      if (q && !log.studentName.toLowerCase().includes(q)) return false;
      if (searchDate && log.date !== searchDate) return false;
      if (searchClass !== 'all' && log.className !== searchClass) return false;
      if (searchSubject !== 'all' && log.subjectName !== searchSubject) return false;
      return true;
    });
  }, [logs, searchName, searchDate, searchClass, searchSubject]);

  const hasFilters =
    searchName !== '' || searchDate !== '' || searchClass !== 'all' || searchSubject !== 'all';

  const handleDeleteOne = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteLog(deleteTarget.id);
      onLogsChanged(logs.filter((l) => l.id !== deleteTarget.id));
      onNotify('success', `ลบข้อมูลของ ${deleteTarget.studentName} เรียบร้อยแล้ว`);
      setDeleteTarget(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบข้อมูลได้');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteToday = async () => {
    setDeleting(true);
    try {
      const res = await api.deleteLogsByDate(todayISO);
      onLogsChanged(logs.filter((l) => l.date !== todayISO));
      onNotify('success', `ลบข้อมูลวันนี้ทั้งหมด (${res.deleted} รายการ) เรียบร้อยแล้ว`);
      setConfirmDeleteToday(false);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบข้อมูลวันนี้ได้');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 4 Filters Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-teal-100/80 dark:border-teal-900/50 bg-gradient-to-r from-teal-50/90 via-emerald-50/60 to-transparent dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-transparent px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-xs shrink-0">
              <Search className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                ค้นหาและกรองประวัติการใช้งาน
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                กรองตามชื่อนักเรียน วันที่ ชั้นเรียน หรือรายวิชา
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label htmlFor="filter-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                ค้นหาชื่อ
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-500 dark:text-teal-400" />
                <input
                  id="filter-name"
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="พิมพ์ชื่อนักเรียน..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="filter-date" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                ค้นหาวันที่
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-500 dark:text-teal-400" />
                <input
                  id="filter-date"
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="filter-class" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                ค้นหาชั้นเรียน
              </label>
              <select
                id="filter-class"
                value={searchClass}
                onChange={(e) => setSearchClass(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">ทุกชั้นเรียน</option>
                {classOptions.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
                <option value={EXTERNAL_VISITOR_CLASS}>{EXTERNAL_VISITOR_CLASS}</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-subject" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                ค้นหาวิชา
              </label>
              <select
                id="filter-subject"
                value={searchSubject}
                onChange={(e) => setSearchSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">ทุกรายวิชา</option>
                {subjectOptions.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono-num text-xs font-semibold text-teal-700 dark:text-teal-300">
                แสดง {filteredLogs.length.toLocaleString('th-TH')} จาก {logs.length.toLocaleString('th-TH')} รายการ
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchName('');
                    setSearchDate('');
                    setSearchClass('all');
                    setSearchSubject('all');
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-teal-50 dark:bg-teal-950/50 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}
            </div>

            {role === 'admin' && (
              <button
                type="button"
                disabled={todayCount === 0}
                onClick={() => setConfirmDeleteToday(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>ลบข้อมูลวันนี้ทั้งหมด ({todayCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            ไม่พบข้อมูลการใช้ห้องคอมพิวเตอร์ที่ตรงกับเงื่อนไข
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-teal-50/90 via-emerald-50/60 to-sky-50/70 dark:from-teal-950/40 dark:via-emerald-950/30 dark:to-sky-950/30 text-xs font-semibold text-teal-900 dark:text-teal-200 border-b border-teal-100 dark:border-teal-900/50">
                <tr>
                  <th className="px-5 py-3 w-14">#</th>
                  <th className="px-4 py-3 whitespace-nowrap">วันที่</th>
                  <th className="px-4 py-3 whitespace-nowrap">เข้าใช้</th>
                  <th className="px-4 py-3 whitespace-nowrap">ห้อง / เครื่อง</th>
                  <th className="px-4 py-3 whitespace-nowrap">ชื่อ</th>
                  <th className="px-4 py-3 whitespace-nowrap">ชั้น</th>
                  <th className="px-4 py-3 whitespace-nowrap">วิชา</th>
                  <th className="px-4 py-3">รูปแบบ</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.map((log, index) => (
                  <tr key={log.id} className="hover:bg-teal-50/40 dark:hover:bg-teal-950/25 transition-colors">
                    <td className="px-5 py-2.5 font-mono-num text-xs text-slate-500 dark:text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2.5 font-mono-num text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatBuddhistISO(log.date)}
                    </td>
                    <td className="px-4 py-2.5 font-mono-num text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {log.timeIn || '-'}
                    </td>
                    <td className="px-4 py-2.5 font-mono-num text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {log.computerRoom || log.computerNumber
                        ? `${log.computerRoom || '-'}${
                            log.computerNumber ? ` · เครื่อง ${log.computerNumber}` : ''
                          }`
                        : '-'}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {log.studentName}
                    </td>
                    <td
                      className={`px-4 py-2.5 font-medium whitespace-nowrap ${
                        log.className === EXTERNAL_VISITOR_CLASS
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-teal-700 dark:text-teal-300'
                      }`}
                    >
                      {log.className}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {log.subjectName}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {log.usageTypes.length > 0 ? log.usageTypes.join(', ') : '-'}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEditLog(log)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-teal-50 hover:text-teal-700 dark:text-slate-400 dark:hover:bg-teal-950/60 dark:hover:text-teal-300 transition-colors"
                        title="แก้ไข"
                        aria-label={`แก้ไขรายการของ ${log.studentName}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(log)}
                          className="ml-1 inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                          title="ลบ"
                          aria-label={`ลบรายการของ ${log.studentName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบข้อมูล"
        description={`ต้องการลบรายการของ "${deleteTarget?.studentName || ''}" วันที่ ${
          deleteTarget ? formatBuddhistISO(deleteTarget.date) : ''
        } หรือไม่?`}
        loading={deleting}
        onConfirm={handleDeleteOne}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={confirmDeleteToday}
        title="ยืนยันการลบข้อมูลวันนี้ทั้งหมด"
        description={`ต้องการลบข้อมูลการใช้งานของวันนี้ (${formatBuddhistISO(
          todayISO
        )}) ทั้งหมดจำนวน ${todayCount} รายการหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`}
        confirmLabel="ลบข้อมูลวันนี้ทั้งหมด"
        loading={deleting}
        onConfirm={handleDeleteToday}
        onCancel={() => setConfirmDeleteToday(false)}
      />
    </div>
  );
}
