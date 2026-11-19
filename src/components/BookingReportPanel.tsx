import { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  Calendar,
  CalendarRange,
  Download,
  FileBarChart2,
  Printer,
  Layers,
} from 'lucide-react';
import {
  COMPUTER_ROOMS,
  THAI_MONTHS,
  type AppSettings,
  type BookingMode,
  type BookingStatus,
  type RoomBooking,
} from '../types';
import { formatBuddhistISO, formatThaiFullDate, getTodayISO } from '../utils/thaiDate';

interface BookingReportPanelProps {
  bookings: RoomBooking[];
  settings: AppSettings;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

type BookingReportPeriodType = 'all' | 'daily' | 'monthly' | 'semester' | 'yearly';

interface BookingReportCriteria {
  type: BookingReportPeriodType;
  date: string;
  month: number;
  beYear: number;
  semester: '1' | '2';
  academicYear: number;
  yearlyMode: 'academic' | 'calendar';
  modeFilter: 'all' | BookingMode;
  roomFilter: 'all' | string;
  statusFilter: 'all' | BookingStatus;
}

function matchesPeriod(bookingDate: string, criteria: BookingReportCriteria): boolean {
  if (criteria.type === 'all') return true;
  if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) return false;

  const [gYear, gMonth] = bookingDate.split('-').map(Number);

  if (criteria.type === 'daily') {
    return bookingDate === criteria.date;
  }

  if (criteria.type === 'monthly') {
    const targetGYear = criteria.beYear - 543;
    return gYear === targetGYear && gMonth === criteria.month;
  }

  if (criteria.type === 'semester') {
    const baseGYear = criteria.academicYear - 543;
    if (criteria.semester === '1') {
      return gYear === baseGYear && gMonth >= 5 && gMonth <= 9;
    }
    return (
      (gYear === baseGYear && gMonth >= 10 && gMonth <= 12) ||
      (gYear === baseGYear + 1 && gMonth >= 1 && gMonth <= 4)
    );
  }

  const baseGYear = criteria.academicYear - 543;
  if (criteria.yearlyMode === 'calendar') {
    return gYear === baseGYear;
  }
  return (
    (gYear === baseGYear && gMonth >= 5 && gMonth <= 12) ||
    (gYear === baseGYear + 1 && gMonth >= 1 && gMonth <= 4)
  );
}

function statusLabelThai(status: BookingStatus): string {
  if (status === 'approved') return 'อนุญาตแล้ว';
  if (status === 'rejected') return 'ไม่อนุญาต';
  return 'รออนุญาต';
}

function modeLabelThai(booking: RoomBooking): string {
  if (booking.bookingMode === 'individual') {
    return `รายคน (เครื่อง ${booking.computerNumber || '-'})`;
  }
  return `เครื่องทั้งห้อง (${booking.seatCount} เครื่อง)`;
}

export function BookingReportPanel({
  bookings,
  settings,
  onNotify,
}: BookingReportPanelProps) {
  const now = new Date();
  const defaultBeYear = Number(settings.academicYear) || now.getFullYear() + 543;

  const [criteria, setCriteria] = useState<BookingReportCriteria>({
    type: 'all',
    date: getTodayISO(),
    month: now.getMonth() + 1,
    beYear: defaultBeYear,
    semester: '1',
    academicYear: defaultBeYear,
    yearlyMode: 'academic',
    modeFilter: 'all',
    roomFilter: 'all',
    statusFilter: 'all',
  });

  const availableBeYears = useMemo(() => {
    const set = new Set<number>([defaultBeYear, now.getFullYear() + 543, 2568, 2567]);
    bookings.forEach((b) => {
      if (b.date && /^\d{4}/.test(b.date)) {
        set.add(Number(b.date.slice(0, 4)) + 543);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [bookings, defaultBeYear]);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        if (!matchesPeriod(b.date, criteria)) return false;
        if (criteria.modeFilter !== 'all' && b.bookingMode !== criteria.modeFilter) return false;
        if (criteria.roomFilter !== 'all' && b.computerRoom !== criteria.roomFilter) return false;
        if (criteria.statusFilter !== 'all' && b.status !== criteria.statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [bookings, criteria]);

  const summary = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let individual = 0;
    let fullRoom = 0;

    for (const b of filteredBookings) {
      if (b.status === 'approved') approved++;
      else if (b.status === 'pending') pending++;
      else rejected++;

      if (b.bookingMode === 'individual') individual++;
      else fullRoom++;
    }

    const total = filteredBookings.length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, approved, pending, rejected, individual, fullRoom, approvalRate };
  }, [filteredBookings]);

  const roomBreakdown = useMemo(() => {
    const rooms = criteria.roomFilter === 'all' ? [...COMPUTER_ROOMS] : [criteria.roomFilter];
    return rooms.map((room) => {
      const items = filteredBookings.filter((b) => b.computerRoom === room);
      const individual = items.filter((b) => b.bookingMode === 'individual').length;
      const fullRoom = items.filter((b) => b.bookingMode === 'full_room').length;
      const approved = items.filter((b) => b.status === 'approved').length;
      const pending = items.filter((b) => b.status === 'pending').length;
      const rejected = items.filter((b) => b.status === 'rejected').length;
      return {
        room,
        total: items.length,
        individual,
        fullRoom,
        approved,
        pending,
        rejected,
      };
    });
  }, [filteredBookings, criteria.roomFilter]);

  const reportTitle = useMemo(() => {
    if (criteria.type === 'all') {
      return 'รายงานสรุปการจองห้องคอมพิวเตอร์ (ทั้งหมด)';
    }
    if (criteria.type === 'daily') {
      return `รายงานการจองห้องคอมพิวเตอร์ ประจำวันที่ ${formatThaiFullDate(criteria.date)}`;
    }
    if (criteria.type === 'monthly') {
      const m = THAI_MONTHS[criteria.month - 1];
      return `รายงานการจองห้องคอมพิวเตอร์ ประจำเดือน ${m ? m.full : criteria.month} พ.ศ. ${criteria.beYear}`;
    }
    if (criteria.type === 'semester') {
      const semLabel =
        criteria.semester === '1'
          ? 'ภาคเรียนที่ 1 (พ.ค. – ก.ย.)'
          : 'ภาคเรียนที่ 2 (ต.ค. – เม.ย.)';
      return `รายงานการจองห้องคอมพิวเตอร์ ${semLabel} ปีการศึกษา ${criteria.academicYear}`;
    }
    return criteria.yearlyMode === 'academic'
      ? `รายงานการจองห้องคอมพิวเตอร์ ประจำปีการศึกษา ${criteria.academicYear} (พ.ค. ${criteria.academicYear} – เม.ย. ${criteria.academicYear + 1})`
      : `รายงานการจองห้องคอมพิวเตอร์ ประจำปี พ.ศ. ${criteria.academicYear} (ม.ค. – ธ.ค.)`;
  }, [criteria]);

  const filterDescription = useMemo(() => {
    const modeText =
      criteria.modeFilter === 'all'
        ? 'ทุกประเภท'
        : criteria.modeFilter === 'individual'
        ? 'เฉพาะรายคน'
        : 'เฉพาะเครื่องทั้งห้อง';
    const roomText = criteria.roomFilter === 'all' ? 'ทุกห้อง' : `ห้อง ${criteria.roomFilter}`;
    const statusText =
      criteria.statusFilter === 'all' ? 'ทุกสถานะ' : statusLabelThai(criteria.statusFilter);
    return `ประเภท: ${modeText} · ห้อง: ${roomText} · สถานะ: ${statusText}`;
  }, [criteria]);

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const handleExportCSV = () => {
    if (filteredBookings.length === 0) {
      onNotify('error', 'ไม่มีข้อมูลการจองตามเงื่อนไขที่เลือกสำหรับส่งออก CSV');
      return;
    }

    const headers = [
      'ลำดับ',
      'วันที่ (พ.ศ.)',
      'เวลาเริ่ม',
      'เวลาสิ้นสุด',
      'ห้องคอม',
      'ประเภทการจอง',
      'หมายเลขเครื่อง',
      'จำนวนเครื่อง',
      'ผู้ขอจอง',
      'ชั้นเรียน / กลุ่ม',
      'วิชา / กิจกรรม',
      'สถานะ',
      'ผู้พิจารณา',
      'หมายเหตุผู้ขอ',
      'หมายเหตุผู้ดูแล',
    ];

    const escapeCell = (value: string) => {
      const str = String(value ?? '');
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredBookings.map((b, idx) => [
      String(idx + 1),
      formatBuddhistISO(b.date),
      b.startTime,
      b.endTime,
      b.computerRoom,
      b.bookingMode === 'individual' ? 'รายคน' : 'เครื่องทั้งห้อง',
      b.computerNumber || '-',
      String(b.seatCount),
      b.requesterName,
      b.className,
      b.subjectName,
      statusLabelThai(b.status),
      b.decidedBy || '-',
      b.note || '',
      b.decisionNote || '',
    ]);

    const csvContent =
      '\uFEFF' + [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `computer-lab-booking-report-${getTodayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('success', `ส่งออกรายงานการจอง (${filteredBookings.length} รายการ) เรียบร้อยแล้ว`);
  };

  const todayThai = formatThaiFullDate(getTodayISO());

  return (
    <div className="space-y-6">
      {/* Control Panel (hidden on print) */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100/80 dark:border-rose-900/50 bg-gradient-to-r from-rose-50/90 via-pink-50/60 to-transparent dark:from-rose-950/40 dark:via-pink-950/30 dark:to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600 to-pink-600 text-white shadow-xs shrink-0">
              <FileBarChart2 className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                รายงานการจองห้องคอมพิวเตอร์ (เฉพาะผู้ดูแลระบบ)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                สรุปสถิติและรายละเอียดการจองทั้งแบบรายคนและเครื่องทั้งห้อง พร้อมพิมพ์ A4 หรือส่งออก CSV
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/80 dark:bg-indigo-950/40 px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors whitespace-nowrap"
            >
              <Printer className="h-4 w-4" />
              <span>พิมพ์รายงาน A4</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-95 whitespace-nowrap"
              style={{ backgroundColor: 'var(--theme-accent)' }}
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Period Type Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { id: 'all' as const, label: 'ทั้งหมด', icon: Layers },
              { id: 'daily' as const, label: 'รายวัน', icon: Calendar },
              { id: 'monthly' as const, label: 'รายเดือน', icon: CalendarRange },
              { id: 'semester' as const, label: 'รายภาค', icon: BookOpenCheck },
              { id: 'yearly' as const, label: 'รายปี', icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              const active = criteria.type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCriteria((prev) => ({ ...prev, type: item.id }))}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'border-transparent bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Period & Attribute Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
            {criteria.type === 'daily' && (
              <div>
                <label
                  htmlFor="booking-rep-date"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  เลือกวันที่
                </label>
                <input
                  id="booking-rep-date"
                  type="date"
                  value={criteria.date}
                  onChange={(e) => setCriteria((p) => ({ ...p, date: e.target.value }))}
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {criteria.type === 'monthly' && (
              <>
                <div>
                  <label
                    htmlFor="booking-rep-month"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    เลือกเดือน
                  </label>
                  <select
                    id="booking-rep-month"
                    value={criteria.month}
                    onChange={(e) =>
                      setCriteria((p) => ({ ...p, month: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {THAI_MONTHS.map((m) => (
                      <option key={m.index} value={m.index + 1}>
                        {m.full}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="booking-rep-year"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ปี พ.ศ.
                  </label>
                  <select
                    id="booking-rep-year"
                    value={criteria.beYear}
                    onChange={(e) =>
                      setCriteria((p) => ({ ...p, beYear: Number(e.target.value) }))
                    }
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
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

            {criteria.type === 'semester' && (
              <>
                <div>
                  <label
                    htmlFor="booking-rep-sem"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ภาคเรียน
                  </label>
                  <select
                    id="booking-rep-sem"
                    value={criteria.semester}
                    onChange={(e) =>
                      setCriteria((p) => ({ ...p, semester: e.target.value as '1' | '2' }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="1">ภาคเรียนที่ 1 (พ.ค. – ก.ย.)</option>
                    <option value="2">ภาคเรียนที่ 2 (ต.ค. – เม.ย.)</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="booking-rep-acad"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ปีการศึกษา
                  </label>
                  <select
                    id="booking-rep-acad"
                    value={criteria.academicYear}
                    onChange={(e) =>
                      setCriteria((p) => ({ ...p, academicYear: Number(e.target.value) }))
                    }
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
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

            {criteria.type === 'yearly' && (
              <>
                <div>
                  <label
                    htmlFor="booking-rep-yearly-acad"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ปีการศึกษา
                  </label>
                  <select
                    id="booking-rep-yearly-acad"
                    value={criteria.academicYear}
                    onChange={(e) =>
                      setCriteria((p) => ({ ...p, academicYear: Number(e.target.value) }))
                    }
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {availableBeYears.map((y) => (
                      <option key={y} value={y}>
                        ปีการศึกษา {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="booking-rep-yearly-mode"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    ขอบเขตเดือน
                  </label>
                  <select
                    id="booking-rep-yearly-mode"
                    value={criteria.yearlyMode}
                    onChange={(e) =>
                      setCriteria((p) => ({
                        ...p,
                        yearlyMode: e.target.value as 'academic' | 'calendar',
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    <option value="academic">ตามปีการศึกษา (พ.ค. – เม.ย.)</option>
                    <option value="calendar">ตามปีปฏิทิน (ม.ค. – ธ.ค.)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="booking-rep-mode"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                ประเภทการจอง
              </label>
              <select
                id="booking-rep-mode"
                value={criteria.modeFilter}
                onChange={(e) =>
                  setCriteria((p) => ({ ...p, modeFilter: e.target.value as 'all' | BookingMode }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">ทุกประเภท</option>
                <option value="individual">รายคน</option>
                <option value="full_room">เครื่องทั้งห้อง</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="booking-rep-room"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                ห้องคอมพิวเตอร์
              </label>
              <select
                id="booking-rep-room"
                value={criteria.roomFilter}
                onChange={(e) => setCriteria((p) => ({ ...p, roomFilter: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">ทุกห้อง</option>
                {COMPUTER_ROOMS.map((r) => (
                  <option key={r} value={r}>
                    ห้อง {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="booking-rep-status"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                สถานะการอนุญาต
              </label>
              <select
                id="booking-rep-status"
                value={criteria.statusFilter}
                onChange={(e) =>
                  setCriteria((p) => ({
                    ...p,
                    statusFilter: e.target.value as 'all' | BookingStatus,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="approved">อนุญาตแล้ว</option>
                <option value="pending">รออนุญาต</option>
                <option value="rejected">ไม่อนุญาต</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Print-Friendly A4 Report Document */}
      <article className="print-only-container mx-auto max-w-[960px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 p-8 sm:p-10 shadow-sm">
        <header className="border-b-2 border-slate-800 pb-4 text-center">
          <h2 className="text-lg font-bold text-slate-900">{settings.schoolName}</h2>
          <p className="mt-1 text-base font-semibold text-rose-900">{reportTitle}</p>
          <p className="mt-1 text-xs text-slate-600">
            ปีการศึกษา {settings.academicYear} · ผู้รับผิดชอบห้องคอมพิวเตอร์: {settings.labManager}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{filterDescription}</p>
        </header>

        {/* 4 Summary Cards */}
        <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-blue-200/80 bg-blue-50/70 p-3.5 text-center">
            <div className="text-xs font-medium text-blue-700">คำขอจองทั้งหมด</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-blue-950">
              {summary.total.toLocaleString('th-TH')}
            </div>
            <div className="mt-0.5 text-[11px] text-blue-700/80">
              รายคน {summary.individual} · ทั้งห้อง {summary.fullRoom}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-3.5 text-center">
            <div className="text-xs font-medium text-emerald-700">อนุญาตแล้ว</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-emerald-950">
              {summary.approved.toLocaleString('th-TH')}
            </div>
            <div className="mt-0.5 font-mono-num text-[11px] text-emerald-700/80">
              คิดเป็น {summary.approvalRate}%
            </div>
          </div>

          <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3.5 text-center">
            <div className="text-xs font-medium text-amber-700">รออนุญาต</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-amber-950">
              {summary.pending.toLocaleString('th-TH')}
            </div>
            <div className="mt-0.5 text-[11px] text-amber-700/80">รอผู้ดูแลพิจารณา</div>
          </div>

          <div className="rounded-lg border border-rose-200/80 bg-rose-50/70 p-3.5 text-center">
            <div className="text-xs font-medium text-rose-700">ไม่อนุญาต</div>
            <div className="mt-1 font-mono-num text-2xl font-bold text-rose-950">
              {summary.rejected.toLocaleString('th-TH')}
            </div>
            <div className="mt-0.5 text-[11px] text-rose-700/80">ปฏิเสธคำขอ</div>
          </div>
        </section>

        {/* Room Breakdown Table */}
        <section className="mt-6">
          <h3 className="text-xs font-bold text-slate-800 mb-2">
            สรุปจำนวนคำขอจองจำแนกตามห้องคอมพิวเตอร์
          </h3>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800">
                <th className="border border-slate-300 px-3 py-2 text-left">ห้องคอมพิวเตอร์</th>
                <th className="border border-slate-300 px-3 py-2 text-center">รายคน</th>
                <th className="border border-slate-300 px-3 py-2 text-center">เครื่องทั้งห้อง</th>
                <th className="border border-slate-300 px-3 py-2 text-center">อนุญาตแล้ว</th>
                <th className="border border-slate-300 px-3 py-2 text-center">รออนุญาต</th>
                <th className="border border-slate-300 px-3 py-2 text-center">ไม่อนุญาต</th>
                <th className="border border-slate-300 px-3 py-2 text-center">รวมทั้งหมด</th>
              </tr>
            </thead>
            <tbody>
              {roomBreakdown.map((row) => (
                <tr key={row.room} className="odd:bg-white even:bg-slate-50/50">
                  <td className="border border-slate-300 px-3 py-1.5 font-semibold">
                    ห้อง {row.room}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-mono-num">
                    {row.individual.toLocaleString('th-TH')}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-mono-num">
                    {row.fullRoom.toLocaleString('th-TH')}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-mono-num text-emerald-700 font-semibold">
                    {row.approved.toLocaleString('th-TH')}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-mono-num text-amber-700 font-semibold">
                    {row.pending.toLocaleString('th-TH')}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-mono-num text-rose-700 font-semibold">
                    {row.rejected.toLocaleString('th-TH')}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-mono-num font-bold">
                    {row.total.toLocaleString('th-TH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Detailed Bookings Table */}
        <section className="mt-6">
          <h3 className="text-xs font-bold text-slate-800 mb-2">
            รายละเอียดรายการขอจองห้องคอมพิวเตอร์
          </h3>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800">
                <th className="border border-slate-300 px-2 py-2 text-center w-10">ลำดับ</th>
                <th className="border border-slate-300 px-2.5 py-2 text-left whitespace-nowrap">
                  วันที่
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-center whitespace-nowrap">
                  เวลา
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-left whitespace-nowrap">
                  ห้อง / ประเภท
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-left">ผู้ขอจอง</th>
                <th className="border border-slate-300 px-2.5 py-2 text-center whitespace-nowrap">
                  ชั้น/กลุ่ม
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-left">วิชา / กิจกรรม</th>
                <th className="border border-slate-300 px-2.5 py-2 text-center whitespace-nowrap">
                  สถานะ
                </th>
                <th className="border border-slate-300 px-2.5 py-2 text-left">ผู้พิจารณา</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="border border-slate-300 px-4 py-8 text-center text-slate-500"
                  >
                    ไม่พบข้อมูลการจองห้องคอมพิวเตอร์ตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b, i) => (
                  <tr key={b.id} className="odd:bg-white even:bg-slate-50/50">
                    <td className="border border-slate-300 px-2 py-1.5 text-center font-mono-num">
                      {i + 1}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 font-mono-num whitespace-nowrap">
                      {formatBuddhistISO(b.date)}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-center font-mono-num whitespace-nowrap">
                      {b.startTime}–{b.endTime}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 whitespace-nowrap">
                      <span className="font-semibold">{b.computerRoom}</span> · {modeLabelThai(b)}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 font-medium">
                      {b.requesterName}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-center whitespace-nowrap">
                      {b.className}
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5">{b.subjectName}</td>
                    <td className="border border-slate-300 px-2.5 py-1.5 text-center whitespace-nowrap font-semibold">
                      <span
                        className={
                          b.status === 'approved'
                            ? 'text-emerald-700'
                            : b.status === 'rejected'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }
                      >
                        {statusLabelThai(b.status)}
                      </span>
                    </td>
                    <td className="border border-slate-300 px-2.5 py-1.5">
                      {b.decidedBy || '-'}
                      {b.decisionNote ? ` (${b.decisionNote})` : ''}
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
            <p className="mt-1 font-semibold">ผู้ตรวจสอบ</p>
          </div>
          <div>
            <p className="mb-8">ลงชื่อ ............................................</p>
            <p>({settings.labManager})</p>
            <p className="mt-1 font-semibold">ผู้ดูแลห้องคอมพิวเตอร์</p>
          </div>
          <div>
            <p className="mb-8">ลงชื่อ ............................................</p>
            <p>(............................................)</p>
            <p className="mt-1 font-semibold">ผู้อำนวยการ / ผู้รับรอง</p>
          </div>
        </section>

        <footer className="mt-10 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>หน้า 1 / 1</span>
          <span>วันที่พิมพ์: {todayThai}</span>
          <span>{settings.schoolName}</span>
        </footer>
      </article>
    </div>
  );
}
