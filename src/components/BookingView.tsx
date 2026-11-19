import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Monitor,
  Search,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
  XCircle,
  AlertTriangle,
  FileBarChart2,
  CalendarDays,
} from 'lucide-react';
import {
  BOOKING_GROUP_OPTIONS,
  CLASS_LIST,
  COMPUTER_ROOMS,
  COMPUTER_STATIONS,
  DEFAULT_SCHEDULE_TIMES,
  EXTERNAL_VISITOR_CLASS,
  type AppSettings,
  type BookingMode,
  type BookingStatus,
  type RoomBooking,
  type ScheduleTimeSettings,
  type Subject,
  type TeachingScheduleSlot,
  type UserRole,
} from '../types';
import { formatBuddhistISO, formatThaiFullDate, getTodayISO } from '../utils/thaiDate';
import { api } from '../api/client';
import { ConfirmModal } from './ConfirmModal';
import { BookingReportPanel } from './BookingReportPanel';
import { TeachingSchedulePanel } from './TeachingSchedulePanel';

interface BookingViewProps {
  role: UserRole;
  activeMode: BookingMode;
  onModeChange: (mode: BookingMode) => void;
  bookings: RoomBooking[];
  teachingSchedules: TeachingScheduleSlot[];
  subjects: Subject[];
  settings: AppSettings;
  defaultManager: string;
  onBookingCreated: (booking: RoomBooking) => void;
  onBookingUpdated: (booking: RoomBooking) => void;
  onBookingDeleted: (bookingId: string) => void;
  onScheduleSaved: (slot: TeachingScheduleSlot) => void;
  onScheduleDeleted: (id: string) => void;
  onSchedulesSeeded: (items: TeachingScheduleSlot[]) => void;
  onScheduleTimesUpdated: (next: ScheduleTimeSettings) => void;
  onOpenAdminLogin: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const INDIVIDUAL_GROUP_OPTIONS: readonly string[] = [
  ...CLASS_LIST,
  EXTERNAL_VISITOR_CLASS,
];

export function BookingView({
  role,
  activeMode,
  onModeChange,
  bookings,
  teachingSchedules,
  subjects,
  settings,
  defaultManager,
  onBookingCreated,
  onBookingUpdated,
  onBookingDeleted,
  onScheduleSaved,
  onScheduleDeleted,
  onSchedulesSeeded,
  onScheduleTimesUpdated,
  onOpenAdminLogin,
  onNotify,
}: BookingViewProps) {
  const [extraTab, setExtraTab] = useState<'none' | 'schedule' | 'report'>('none');
  const effectiveTab: 'individual' | 'full_room' | 'schedule' | 'report' =
    extraTab === 'report'
      ? role === 'admin'
        ? 'report'
        : activeMode
      : extraTab === 'schedule'
      ? 'schedule'
      : activeMode;

  const timePresets = useMemo(() => {
    const periods = settings.scheduleTimes?.periods || DEFAULT_SCHEDULE_TIMES.periods;
    return periods.map((p) => ({
      label: `คาบ ${p.period} (${p.startTime}–${p.endTime})`,
      start: p.startTime,
      end: p.endTime,
    }));
  }, [settings.scheduleTimes]);

  // Shared Date / Time / Room State
  const [date, setDate] = useState(getTodayISO());
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('09:30');
  const [computerRoom, setComputerRoom] = useState(COMPUTER_ROOMS[0]);

  // Sub-menu 1: จองรายคน State
  const [indStation, setIndStation] = useState('1');
  const [indRequesterName, setIndRequesterName] = useState('');
  const [indClassName, setIndClassName] = useState(CLASS_LIST[12] || CLASS_LIST[0]);
  const [indPurpose, setIndPurpose] = useState('ค้นคว้าข้อมูล / ทำรายงาน');
  const [indNote, setIndNote] = useState('');

  // Sub-menu 2: จองเครื่องทั้งห้อง State
  const [fullRequesterName, setFullRequesterName] = useState('');
  const [fullClassName, setFullClassName] = useState(CLASS_LIST[12] || CLASS_LIST[0]);
  const [fullSubjectChoice, setFullSubjectChoice] = useState(() =>
    subjects.length > 0 ? subjects[0].name : '__custom__'
  );
  const [fullCustomSubject, setFullCustomSubject] = useState('');
  const [fullSeatCount, setFullSeatCount] = useState(30);
  const [fullNote, setFullNote] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // List Filter State
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [modeFilter, setModeFilter] = useState<'all' | BookingMode>('all');
  const [roomFilter, setRoomFilter] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Decision Modal State
  const [decisionTarget, setDecisionTarget] = useState<{
    booking: RoomBooking;
    status: 'approved' | 'rejected';
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decidedBy, setDecidedBy] = useState(defaultManager || 'ผู้ดูแลระบบ');
  const [deciding, setDeciding] = useState(false);

  // Admin Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<RoomBooking | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Summary counts
  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const b of bookings) {
      if (b.status === 'pending') pending++;
      else if (b.status === 'approved') approved++;
      else rejected++;
    }
    return { total: bookings.length, pending, approved, rejected };
  }, [bookings]);

  // Overlapping bookings on chosen date + room + time range
  const overlappingSlotBookings = useMemo(() => {
    if (!date || !startTime || !endTime || endTime <= startTime) {
      return [] as RoomBooking[];
    }
    return bookings.filter(
      (b) =>
        b.date === date &&
        b.computerRoom === computerRoom &&
        startTime < b.endTime &&
        endTime > b.startTime
    );
  }, [bookings, date, computerRoom, startTime, endTime]);

  // Station status map (1-30) for จองรายคน
  const stationOccupancy = useMemo(() => {
    const approvedFullRoom = overlappingSlotBookings.find(
      (b) => b.status === 'approved' && b.bookingMode === 'full_room'
    );
    const pendingFullRoom = overlappingSlotBookings.find(
      (b) => b.status === 'pending' && b.bookingMode === 'full_room'
    );
    const stationStatus = new Map<string, { state: 'approved' | 'pending'; owner: string }>();

    for (const b of overlappingSlotBookings) {
      if (b.bookingMode === 'individual' && b.computerNumber) {
        if (b.status === 'approved') {
          stationStatus.set(b.computerNumber, { state: 'approved', owner: b.requesterName });
        } else if (b.status === 'pending' && !stationStatus.has(b.computerNumber)) {
          stationStatus.set(b.computerNumber, { state: 'pending', owner: b.requesterName });
        }
      }
    }

    return { approvedFullRoom, pendingFullRoom, stationStatus };
  }, [overlappingSlotBookings]);

  // Conflict status for whichever sub-menu is active
  const activeConflicts = useMemo(() => {
    if (!date || !startTime || !endTime || endTime <= startTime) {
      return { approved: [] as RoomBooking[], pending: [] as RoomBooking[] };
    }

    if (activeMode === 'full_room') {
      return {
        approved: overlappingSlotBookings.filter((b) => b.status === 'approved'),
        pending: overlappingSlotBookings.filter((b) => b.status === 'pending'),
      };
    }

    // Individual mode conflicts if full room is booked OR same station is booked
    const approved = overlappingSlotBookings.filter(
      (b) =>
        b.status === 'approved' &&
        (b.bookingMode === 'full_room' || (b.computerNumber || '') === indStation)
    );
    const pending = overlappingSlotBookings.filter(
      (b) =>
        b.status === 'pending' &&
        (b.bookingMode === 'full_room' || (b.computerNumber || '') === indStation)
    );
    return { approved, pending };
  }, [activeMode, date, startTime, endTime, overlappingSlotBookings, indStation]);

  // Daily schedule for selected date
  const scheduleForDate = useMemo(() => {
    return bookings
      .filter((b) => b.date === date && b.status !== 'rejected')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [bookings, date]);

  // Filtered bookings table
  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (modeFilter !== 'all' && b.bookingMode !== modeFilter) return false;
      if (roomFilter !== 'all' && b.computerRoom !== roomFilter) return false;
      if (
        q &&
        !b.requesterName.toLowerCase().includes(q) &&
        !b.subjectName.toLowerCase().includes(q) &&
        !b.className.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [bookings, statusFilter, modeFilter, roomFilter, searchQuery]);

  const resolvedFullSubject =
    fullSubjectChoice === '__custom__' ? fullCustomSubject.trim() : fullSubjectChoice.trim();

  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime || !indStation || !indRequesterName.trim() || !indPurpose.trim()) {
      onNotify('error', 'กรุณากรอกข้อมูลการจองรายคนและเลือกหมายเลขเครื่องให้ครบถ้วน');
      return;
    }
    if (endTime <= startTime) {
      onNotify('error', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
      return;
    }
    if (activeConflicts.approved.length > 0) {
      onNotify('error', 'เครื่องหรือช่วงเวลานี้ได้รับอนุญาตให้ผู้อื่นใช้งานแล้ว กรุณาเลือกเครื่องหรือเวลาอื่น');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createBooking({
        bookingMode: 'individual',
        date,
        startTime,
        endTime,
        computerRoom,
        computerNumber: indStation,
        requesterName: indRequesterName.trim(),
        className: indClassName,
        subjectName: indPurpose.trim(),
        seatCount: 1,
        note: indNote.trim(),
      });
      onBookingCreated(created);
      setIndRequesterName('');
      setIndNote('');
      onNotify('success', `ส่งคำขอจองรายคน (${computerRoom} เครื่องที่ ${indStation}) แล้ว รอผู้ดูแลอนุญาต`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถส่งคำขอจองรายคนได้');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFullRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime || !fullRequesterName.trim() || !resolvedFullSubject) {
      onNotify('error', 'กรุณากรอกข้อมูลการจองเครื่องทั้งห้องที่มีเครื่องหมาย * ให้ครบถ้วน');
      return;
    }
    if (endTime <= startTime) {
      onNotify('error', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม');
      return;
    }
    if (activeConflicts.approved.length > 0) {
      onNotify('error', 'ช่วงเวลานี้มีรายการที่ได้รับอนุญาตใช้งานแล้ว กรุณาเลือกเวลาหรือห้องอื่น');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createBooking({
        bookingMode: 'full_room',
        date,
        startTime,
        endTime,
        computerRoom,
        computerNumber: '',
        requesterName: fullRequesterName.trim(),
        className: fullClassName,
        subjectName: resolvedFullSubject,
        seatCount: fullSeatCount,
        note: fullNote.trim(),
      });
      onBookingCreated(created);
      setFullRequesterName('');
      setFullNote('');
      if (fullSubjectChoice === '__custom__') setFullCustomSubject('');
      onNotify('success', `ส่งคำขอจองเครื่องทั้งห้อง (${computerRoom}) แล้ว รอผู้ดูแลอนุญาต`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถส่งคำขอจองเครื่องทั้งห้องได้');
    } finally {
      setSubmitting(false);
    }
  };

  const openDecisionModal = (booking: RoomBooking, status: 'approved' | 'rejected') => {
    if (role !== 'admin') {
      onNotify('error', 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์อนุญาตการจอง');
      return;
    }
    setDecisionTarget({ booking, status });
    setDecisionNote(booking.decisionNote || '');
    setDecidedBy(defaultManager || 'ผู้ดูแลระบบ');
  };

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decisionTarget || role !== 'admin') return;
    setDeciding(true);
    try {
      const updated = await api.decideBooking(decisionTarget.booking.id, {
        status: decisionTarget.status,
        decisionNote: decisionNote.trim(),
        decidedBy: decidedBy.trim() || 'ผู้ดูแลระบบ',
        role,
      });
      onBookingUpdated(updated);
      onNotify(
        'success',
        decisionTarget.status === 'approved'
          ? `อนุญาตการจองของ ${updated.requesterName} เรียบร้อยแล้ว`
          : `ปฏิเสธการจองของ ${updated.requesterName} เรียบร้อยแล้ว`
      );
      setDecisionTarget(null);
      setDecisionNote('');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถอัปเดตผลการพิจารณาได้');
    } finally {
      setDeciding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || role !== 'admin') return;
    setDeleting(true);
    try {
      await api.deleteBooking(deleteTarget.id, role);
      onBookingDeleted(deleteTarget.id);
      onNotify('success', `ลบรายการจองของ ${deleteTarget.requesterName} เรียบร้อยแล้ว`);
      setDeleteTarget(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบรายการจองได้');
    } finally {
      setDeleting(false);
    }
  };

  const renderStatusLabel = (status: BookingStatus) => {
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>อนุญาตแล้ว</span>
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span>ไม่อนุญาต</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>รออนุญาต</span>
      </span>
    );
  };

  const renderModeText = (booking: RoomBooking) => {
    if (booking.bookingMode === 'individual') {
      return `จองรายคน · เครื่องที่ ${booking.computerNumber || '-'}`;
    }
    return `จองเครื่องทั้งห้อง · ${booking.seatCount} เครื่อง`;
  };

  return (
    <div className="space-y-6">
      {/* Sub-menu Segmented Bar: รายคน | เครื่องทั้งห้อง | ตารางคาบสอน | รายงานการจอง (Admin only) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-r from-sky-50/90 via-emerald-50/80 to-teal-50/90 dark:from-slate-900 dark:to-emerald-950/40 p-1.5">
          <button
            type="button"
            onClick={() => {
              setExtraTab('none');
              onModeChange('individual');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              effectiveTab === 'individual'
                ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-sky-700 dark:hover:text-sky-300'
            }`}
          >
            <User className="h-4 w-4" />
            <span>รายคน</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExtraTab('none');
              onModeChange('full_room');
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              effectiveTab === 'full_room'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-emerald-700 dark:hover:text-emerald-300'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>เครื่องทั้งห้อง</span>
          </button>

          <button
            type="button"
            onClick={() => setExtraTab('schedule')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
              effectiveTab === 'schedule'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-indigo-700 dark:hover:text-indigo-300'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>ตารางคาบสอน</span>
          </button>

          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setExtraTab('report')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                effectiveTab === 'report'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 hover:text-rose-700 dark:hover:text-rose-300'
              }`}
            >
              <FileBarChart2 className="h-4 w-4" />
              <span>รายงานการจอง</span>
            </button>
          )}
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400">
          {effectiveTab === 'report'
            ? 'สรุปรายงานและพิมพ์เอกสารการจองห้องคอมพิวเตอร์ (สำหรับผู้ดูแลระบบ)'
            : effectiveTab === 'schedule'
            ? 'ตารางคาบสอนประจำวันจันทร์ – ศุกร์ ห้องคอม 1 และ ห้องคอม 2'
            : effectiveTab === 'individual'
            ? 'เลือกจองเฉพาะเครื่องคอมพิวเตอร์รายบุคคล (1 เครื่อง)'
            : 'จองเครื่องทั้งห้องสำหรับการสอน อบรม หรือกิจกรรมกลุ่ม'}
        </span>
      </div>

      {effectiveTab === 'report' ? (
        <BookingReportPanel bookings={bookings} settings={settings} onNotify={onNotify} />
      ) : effectiveTab === 'schedule' ? (
        <TeachingSchedulePanel
          role={role}
          schedules={teachingSchedules}
          subjects={subjects}
          settings={settings}
          onScheduleSaved={onScheduleSaved}
          onScheduleDeleted={onScheduleDeleted}
          onSchedulesSeeded={onSchedulesSeeded}
          onScheduleTimesUpdated={onScheduleTimesUpdated}
          onQuickBookRoom={(room, sTime, eTime) => {
            setComputerRoom(room);
            setStartTime(sTime);
            setEndTime(eTime);
            setExtraTab('none');
            onModeChange('full_room');
          }}
          onNotify={onNotify}
        />
      ) : (
        <>
          {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/60 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">คำขอจองทั้งหมด</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs">
              <CalendarClock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {counts.total.toLocaleString('th-TH')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">รายการในระบบ</div>
        </div>

        <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/60 dark:from-amber-950/40 dark:via-slate-900 dark:to-orange-950/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">รออนุญาต</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {counts.pending.toLocaleString('th-TH')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">รอผู้ดูแลพิจารณา</div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">อนุญาตแล้ว</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xs">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {counts.approved.toLocaleString('th-TH')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">พร้อมเข้าใช้งาน</div>
        </div>

        <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/90 via-white to-pink-50/60 dark:from-rose-950/40 dark:via-slate-900 dark:to-pink-950/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">ไม่อนุญาต</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600 to-pink-600 text-white shadow-xs">
              <XCircle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-white">
            {counts.rejected.toLocaleString('th-TH')}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">ปฏิเสธคำขอ</div>
        </div>
      </div>

      {/* Form + Daily Room Schedule Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Sub-menu 1: จองรายคน (7 cols) */}
        {activeMode === 'individual' ? (
          <form
            onSubmit={handleSubmitIndividual}
            className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden flex flex-col"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100/80 dark:border-sky-900/50 bg-gradient-to-r from-sky-50/90 via-blue-50/70 to-transparent dark:from-sky-950/40 dark:via-blue-950/30 dark:to-transparent px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-xs shrink-0">
                  <User className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    จองห้องคอมแบบรายคน (เลือกเครื่องที่ 1–30)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ระบุวัน เวลา ห้องคอม และเครื่องที่ต้องการใช้งาน · ผู้ดูแลระบบเป็นผู้อนุญาต
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {/* Quick Time Presets */}
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  เลือกช่วงเวลาด่วนตามคาบเรียน
                </span>
                <div className="flex flex-wrap gap-2">
                  {timePresets.map((preset) => {
                    const active = startTime === preset.start && endTime === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setStartTime(preset.start);
                          setEndTime(preset.end);
                        }}
                        className={`font-mono-num rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-300 hover:bg-sky-50/40 dark:hover:bg-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label htmlFor="ind-book-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    วันที่จอง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ind-book-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label htmlFor="ind-book-start" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    เวลาเริ่ม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ind-book-start"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label htmlFor="ind-book-end" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    เวลาสิ้นสุด <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ind-book-end"
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label htmlFor="ind-book-room" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ห้องคอม <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="ind-book-room"
                    value={computerRoom}
                    onChange={(e) => setComputerRoom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {COMPUTER_ROOMS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 30-Station Visual Picker */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    เลือกเครื่องคอมพิวเตอร์ ({computerRoom}) <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    กำลังเลือก: <strong className="font-mono-num text-sky-700 dark:text-sky-300">เครื่องที่ {indStation}</strong>
                    {' · '}สีเทา/แดง = ถูกจองแล้ว
                  </span>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                  {COMPUTER_STATIONS.map((num) => {
                    const isFullRoomBlocked = Boolean(stationOccupancy.approvedFullRoom);
                    const info = stationOccupancy.stationStatus.get(num);
                    const isBlocked = isFullRoomBlocked || info?.state === 'approved';
                    const isPending = !isBlocked && (Boolean(stationOccupancy.pendingFullRoom) || info?.state === 'pending');
                    const isSelected = indStation === num;

                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={isBlocked}
                        onClick={() => setIndStation(num)}
                        title={
                          isFullRoomBlocked
                            ? `ห้องถูกจองทั้งห้องโดย ${stationOccupancy.approvedFullRoom?.requesterName}`
                            : info
                            ? `เครื่องที่ ${num}: ${info.state === 'approved' ? 'อนุญาตแล้ว' : 'รออนุญาต'} (${info.owner})`
                            : `เครื่องที่ ${num} (ว่าง)`
                        }
                        className={`font-mono-num rounded-lg border py-2 text-xs font-semibold transition-all ${
                          isBlocked
                            ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-400 dark:text-rose-500 cursor-not-allowed line-through'
                            : isSelected
                            ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                            : isPending
                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:border-sky-400'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ind-book-requester" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ชื่อ–สกุล ผู้ขอจอง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ind-book-requester"
                    type="text"
                    required
                    value={indRequesterName}
                    onChange={(e) => setIndRequesterName(e.target.value)}
                    placeholder="ชื่อนักเรียน / ครู / บุคคลภายนอก"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label htmlFor="ind-book-class" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ชั้นเรียน / สถานะผู้จอง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="ind-book-class"
                    value={indClassName}
                    onChange={(e) => setIndClassName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {INDIVIDUAL_GROUP_OPTIONS.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ind-book-purpose" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    วัตถุประสงค์ / รายวิชาที่ใช้ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="ind-book-purpose"
                    type="text"
                    required
                    value={indPurpose}
                    onChange={(e) => setIndPurpose(e.target.value)}
                    placeholder="เช่น ค้นคว้าข้อมูล, ฝึกพิมพ์, ทำโครงงาน"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label htmlFor="ind-book-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    หมายเหตุ (ไม่บังคับ)
                  </label>
                  <input
                    id="ind-book-note"
                    type="text"
                    value={indNote}
                    onChange={(e) => setIndNote(e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติม"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Availability Status Notice */}
              {endTime <= startTime ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม</span>
                </div>
              ) : activeConflicts.approved.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {activeConflicts.approved[0].bookingMode === 'full_room'
                      ? `ห้อง ${computerRoom} ถูกจองทั้งห้องและได้รับอนุญาตให้ "${activeConflicts.approved[0].requesterName}" แล้ว`
                      : `เครื่องที่ ${indStation} ในห้อง ${computerRoom} ได้รับอนุญาตให้ "${activeConflicts.approved[0].requesterName}" จองแล้ว กรุณาเลือกเครื่องว่างอื่น`}
                  </span>
                </div>
              ) : activeConflicts.pending.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    มีคำขอที่รอผู้ดูแลพิจารณาในช่วงเวลา/เครื่องนี้อยู่ {activeConflicts.pending.length} รายการ
                    (ยังสามารถส่งคำขอให้ผู้ดูแลพิจารณาได้)
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 dark:border-sky-900/70 bg-sky-50/70 dark:bg-sky-950/35 px-4 py-3 text-xs text-sky-900 dark:text-sky-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    ห้อง <strong>{computerRoom}</strong> เครื่องที่{' '}
                    <strong className="font-mono-num">{indStation}</strong> เวลา{' '}
                    <span className="font-mono-num font-semibold">
                      {startTime}–{endTime}
                    </span>{' '}
                    ว่าง — ส่งคำขอให้ผู้ดูแลระบบพิจารณาอนุญาตได้ทันที
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  สิทธิ์การอนุญาต/อนุมัติ: เฉพาะผู้ดูแลระบบ (Admin)
                </span>
                <button
                  type="submit"
                  disabled={submitting || endTime <= startTime || activeConflicts.approved.length > 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
                >
                  <CalendarPlus className="h-4 w-4" />
                  <span>
                    {submitting
                      ? 'กำลังส่งคำขอจอง...'
                      : `ส่งคำขอจองรายคน (เครื่องที่ ${indStation})`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Sub-menu 2: จองเครื่องทั้งห้อง (7 cols) */
          <form
            onSubmit={handleSubmitFullRoom}
            className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden flex flex-col"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100/80 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-transparent dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-transparent px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xs shrink-0">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    จองเครื่องทั้งห้อง (ทั้งชั้นเรียน / กิจกรรมกลุ่ม)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    จองใช้งานทั้งห้องคอมพิวเตอร์สำหรับการเรียนการสอนหรืออบรม · ผู้ดูแลระบบเป็นผู้อนุญาต
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {/* Quick Time Presets */}
              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  เลือกช่วงเวลาด่วนตามคาบเรียน
                </span>
                <div className="flex flex-wrap gap-2">
                  {timePresets.map((preset) => {
                    const active = startTime === preset.start && endTime === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setStartTime(preset.start);
                          setEndTime(preset.end);
                        }}
                        className={`font-mono-num rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:bg-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label htmlFor="full-book-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    วันที่จอง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="full-book-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="full-book-start" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    เวลาเริ่ม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="full-book-start"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="full-book-end" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    เวลาสิ้นสุด <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="full-book-end"
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="full-book-room" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ห้องคอม <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="full-book-room"
                    value={computerRoom}
                    onChange={(e) => setComputerRoom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {COMPUTER_ROOMS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="full-book-requester" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ครูผู้สอน / ผู้ขอจองทั้งห้อง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="full-book-requester"
                    type="text"
                    required
                    value={fullRequesterName}
                    onChange={(e) => setFullRequesterName(e.target.value)}
                    placeholder="เช่น ครูสมศรี ใจดี หรือผู้ประสานงานกิจกรรม"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label htmlFor="full-book-class" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ชั้นเรียน / กลุ่มผู้เข้าใช้ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="full-book-class"
                    value={fullClassName}
                    onChange={(e) => setFullClassName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {BOOKING_GROUP_OPTIONS.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="full-book-subject" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    รายวิชา / กิจกรรมที่ใช้ทั้งห้อง <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="full-book-subject"
                    value={fullSubjectChoice}
                    onChange={(e) => setFullSubjectChoice(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.name}>
                        {sub.code ? `[${sub.code}] ` : ''}
                        {sub.name}
                      </option>
                    ))}
                    <option value="__custom__">กิจกรรมอื่นๆ (ระบุเอง)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="full-book-seats" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    จำนวนเครื่องที่ใช้ (1–60)
                  </label>
                  <input
                    id="full-book-seats"
                    type="number"
                    min={1}
                    max={60}
                    value={fullSeatCount}
                    onChange={(e) => setFullSeatCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {fullSubjectChoice === '__custom__' && (
                <div>
                  <label htmlFor="full-book-custom-sub" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    ระบุชื่อวิชาหรือกิจกรรม <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="full-book-custom-sub"
                    type="text"
                    required
                    value={fullCustomSubject}
                    onChange={(e) => setFullCustomSubject(e.target.value)}
                    placeholder="เช่น อบรมเชิงปฏิบัติการ, สอบออนไลน์ทั้งระดับชั้น"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label htmlFor="full-book-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  หมายเหตุ / อุปกรณ์เสริมที่ต้องการ (ไม่บังคับ)
                </label>
                <input
                  id="full-book-note"
                  type="text"
                  value={fullNote}
                  onChange={(e) => setFullNote(e.target.value)}
                  placeholder="เช่น ขอใช้โปรเจคเตอร์ ไมโครโฟน หรือจัดเตรียมซอฟต์แวร์พิเศษ"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Availability Status Notice */}
              {endTime <= startTime ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม</span>
                </div>
              ) : activeConflicts.approved.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    ไม่สามารถจองทั้งห้องได้: ห้อง <strong>{computerRoom}</strong> ช่วงเวลา{' '}
                    <span className="font-mono-num font-semibold">
                      {activeConflicts.approved[0].startTime}–{activeConflicts.approved[0].endTime}
                    </span>{' '}
                    ได้รับอนุญาตให้ <strong>{activeConflicts.approved[0].requesterName}</strong> (
                    {activeConflicts.approved[0].bookingMode === 'individual'
                      ? `เครื่องที่ ${activeConflicts.approved[0].computerNumber}`
                      : 'ทั้งห้อง'}
                    ) จองไว้แล้ว
                  </span>
                </div>
              ) : activeConflicts.pending.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    มีคำขอจองที่รอผู้ดูแลพิจารณาในช่วงเวลานี้อยู่ {activeConflicts.pending.length} รายการ
                    (ยังสามารถส่งคำขอให้ผู้ดูแลพิจารณาได้)
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/35 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    ห้อง <strong>{computerRoom}</strong> ช่วงเวลา{' '}
                    <span className="font-mono-num font-semibold">
                      {startTime}–{endTime}
                    </span>{' '}
                    ว่างทั้งห้อง — ส่งคำขอให้ผู้ดูแลระบบพิจารณาอนุญาตได้ทันที
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  สิทธิ์การอนุญาต/อนุมัติ: เฉพาะผู้ดูแลระบบ (Admin)
                </span>
                <button
                  type="submit"
                  disabled={submitting || endTime <= startTime || activeConflicts.approved.length > 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
                >
                  <CalendarPlus className="h-4 w-4" />
                  <span>{submitting ? 'กำลังส่งคำขอจอง...' : 'ส่งคำขอจองเครื่องทั้งห้อง'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Daily Room Schedule Panel (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-sky-100/80 dark:border-sky-900/50 bg-gradient-to-r from-sky-50/90 via-cyan-50/70 to-transparent dark:from-sky-950/40 dark:via-cyan-950/30 dark:to-transparent px-5 py-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-600 to-cyan-600 text-white shadow-xs shrink-0">
                <Monitor className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  ตารางการจองประจำวัน
                </h2>
                <p className="text-xs text-sky-700 dark:text-sky-300 truncate">
                  {date ? formatThaiFullDate(date) : '-'}
                </p>
              </div>
            </div>
            <span className="font-mono-num text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {scheduleForDate.length} รายการ
            </span>
          </div>

          <div className="p-5 space-y-4 flex-1 overflow-y-auto max-h-[580px]">
            {COMPUTER_ROOMS.map((roomName) => {
              const roomItems = scheduleForDate.filter((b) => b.computerRoom === roomName);
              return (
                <div key={roomName} className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      ห้อง {roomName}
                    </span>
                    <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      {roomItems.length} รายการ
                    </span>
                  </div>
                  {roomItems.length === 0 ? (
                    <div className="py-3 text-xs text-slate-400 dark:text-slate-500">
                      ยังไม่มีการจองในวันนี้ (ห้องว่างตลอดวัน)
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {roomItems.map((item) => (
                        <li key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                {item.startTime}–{item.endTime} น.
                              </span>
                              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                              <span
                                className={`font-semibold whitespace-nowrap ${
                                  item.bookingMode === 'individual'
                                    ? 'text-sky-700 dark:text-sky-300'
                                    : 'text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {item.bookingMode === 'individual'
                                  ? `รายคน (เครื่อง ${item.computerNumber || '-'})`
                                  : `ทั้งห้อง (${item.seatCount} เครื่อง)`}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 truncate">
                              {item.requesterName} · {item.className} · {item.subjectName}
                            </div>
                          </div>
                          <div className="shrink-0 pt-0.5">{renderStatusLabel(item.status)}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Role Permissions Info Banner for Non-Admin */}
      {role !== 'admin' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-transparent dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-transparent px-5 py-3.5">
          <div className="flex items-center gap-3 text-xs text-indigo-900 dark:text-indigo-200">
            <ShieldCheck className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              คุณอยู่ในโหมด <strong>ผู้ใช้งานทั่วไป (User)</strong> — สามารถจองได้ทั้งแบบรายคนและเครื่องทั้งห้อง
              ส่วนการกด <strong>อนุญาต / ไม่อนุญาต</strong> สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>เข้าสู่ระบบ Admin เพื่ออนุญาต</span>
          </button>
        </div>
      )}

      {/* Bookings List & Admin Approval Queue */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xs shrink-0">
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                รายการคำขอจองห้องคอมพิวเตอร์
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                แสดง {filteredBookings.length.toLocaleString('th-TH')} จาก {bookings.length.toLocaleString('th-TH')} รายการ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Segmented Status Filter */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
              {(
                [
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'pending', label: `รออนุญาต (${counts.pending})` },
                  { id: 'approved', label: 'อนุญาตแล้ว' },
                  { id: 'rejected', label: 'ไม่อนุญาต' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label="กรองตามรูปแบบการจอง"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as 'all' | BookingMode)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">ทุกประเภทการจอง</option>
              <option value="individual">จองรายคน</option>
              <option value="full_room">จองเครื่องทั้งห้อง</option>
            </select>

            <select
              aria-label="กรองตามห้องคอม"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">ทุกห้อง</option>
              {COMPUTER_ROOMS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาผู้ขอจอง / วิชา..."
                aria-label="ค้นหารายการจอง"
                className="w-44 sm:w-52 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            ยังไม่มีรายการขอจองห้องคอมพิวเตอร์ตามเงื่อนไขที่เลือก
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 dark:bg-slate-800/70 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3 whitespace-nowrap">วันที่ / เวลา</th>
                  <th className="px-4 py-3 whitespace-nowrap">ประเภท / ห้อง / เครื่อง</th>
                  <th className="px-4 py-3 whitespace-nowrap">ผู้ขอจอง</th>
                  <th className="px-4 py-3 whitespace-nowrap">ชั้น / วิชาที่ขอใช้</th>
                  <th className="px-4 py-3 whitespace-nowrap">สถานะการอนุญาต</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">
                    {role === 'admin' ? 'พิจารณา / จัดการ' : 'สิทธิ์อนุมัติ'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="font-mono-num text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {formatBuddhistISO(booking.date)}
                      </div>
                      <div className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                        {booking.startTime}–{booking.endTime} น.
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {booking.computerRoom}
                      </div>
                      <div
                        className={`font-mono-num text-xs font-medium ${
                          booking.bookingMode === 'individual'
                            ? 'text-sky-700 dark:text-sky-300'
                            : 'text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {renderModeText(booking)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {booking.requesterName}
                      </div>
                      {booking.note && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                          {booking.note}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-teal-700 dark:text-teal-300 whitespace-nowrap">
                        {booking.className}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {booking.subjectName}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div>{renderStatusLabel(booking.status)}</div>
                      {booking.decidedBy && (
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          โดย: {booking.decidedBy}
                        </div>
                      )}
                      {booking.decisionNote && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                          หมายเหตุ: {booking.decisionNote}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {role === 'admin' ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {booking.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => openDecisionModal(booking, 'approved')}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>อนุญาต</span>
                            </button>
                          )}
                          {booking.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => openDecisionModal(booking, 'rejected')}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>ไม่อนุญาต</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(booking)}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                            title="ลบรายการจอง"
                            aria-label={`ลบรายการจองของ ${booking.requesterName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {booking.status === 'pending' ? 'รอผู้ดูแลอนุญาต' : 'พิจารณาโดยผู้ดูแลแล้ว'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Decision Modal */}
      {decisionTarget && role === 'admin' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div
              className={`flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 ${
                decisionTarget.status === 'approved'
                  ? 'bg-gradient-to-r from-emerald-50/90 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20'
                  : 'bg-gradient-to-r from-rose-50/90 to-pink-50/50 dark:from-rose-950/40 dark:to-pink-950/20'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {decisionTarget.status === 'approved' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                )}
                <h3 id="decision-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {decisionTarget.status === 'approved'
                    ? 'ยืนยันการอนุญาตจองห้องคอมพิวเตอร์'
                    : 'ยืนยันการไม่อนุญาตจองห้องคอมพิวเตอร์'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDecisionTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDecision} className="p-6 space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-3.5 text-xs space-y-1 text-slate-700 dark:text-slate-300">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">ประเภท:</span>{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {renderModeText(decisionTarget.booking)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">ผู้ขอจอง:</span>{' '}
                  <strong className="text-slate-900 dark:text-slate-100">{decisionTarget.booking.requesterName}</strong>{' '}
                  ({decisionTarget.booking.className})
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">วันเวลา:</span>{' '}
                  <span className="font-mono-num font-semibold">
                    {formatBuddhistISO(decisionTarget.booking.date)} · {decisionTarget.booking.startTime}–
                    {decisionTarget.booking.endTime} น.
                  </span>{' '}
                  · ห้อง {decisionTarget.booking.computerRoom}
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">กิจกรรม:</span>{' '}
                  {decisionTarget.booking.subjectName}
                </div>
              </div>

              <div>
                <label htmlFor="decider-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  ชื่อผู้ดูแลที่พิจารณา
                </label>
                <input
                  id="decider-name"
                  type="text"
                  required
                  value={decidedBy}
                  onChange={(e) => setDecidedBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="decision-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  หมายเหตุ / เหตุผลประกอบการพิจารณา (ไม่บังคับ)
                </label>
                <input
                  id="decision-note"
                  type="text"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder={
                    decisionTarget.status === 'approved'
                      ? 'เช่น อนุญาตให้ใช้ห้องได้ตามเวลาที่ขอ'
                      : 'เช่น ห้องไม่ว่างเนื่องจากติดสอบปฏิบัติ'
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDecisionTarget(null)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={deciding}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60 ${
                    decisionTarget.status === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {decisionTarget.status === 'approved' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {deciding
                      ? 'กำลังบันทึก...'
                      : decisionTarget.status === 'approved'
                      ? 'ยืนยันอนุญาต'
                      : 'ยืนยันไม่อนุญาต'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="ยืนยันการลบรายการจอง"
        description={`ต้องการลบรายการจองของ "${deleteTarget?.requesterName || ''}" วันที่ ${
          deleteTarget ? formatBuddhistISO(deleteTarget.date) : ''
        } เวลา ${deleteTarget?.startTime || ''}–${deleteTarget?.endTime || ''} น. หรือไม่?`}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
        </>
      )}
    </div>
  );
}
