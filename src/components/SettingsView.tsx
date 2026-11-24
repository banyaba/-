import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  RotateCcw,
  Palette,
  School,
  ListChecks,
  Trash2,
  Database,
  KeyRound,
  UserPlus,
  ShieldCheck,
  Pencil,
  Eye,
  EyeOff,
  X,
  Lock,
  Plus,
  Check,
  Star,
  UserCheck,
  GraduationCap,
  ArrowRight,
  AlertTriangle,
  Download,
  Upload,
  CheckCircle2,
  Monitor,
  Layers,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from 'lucide-react';
import {
  CLASS_LIST,
  COMPUTER_ROOMS,
  DEFAULT_THEME_COLORS,
  EXTERNAL_VISITOR_CLASS,
  getActiveClassList,
  getActiveComputerRooms,
  type AppSettings,
  type Student,
  type ThemeColors,
} from '../types';
import { api } from '../api/client';
import { UsageTypesManagerPanel } from './UsageTypesManagerModal';
import { ConfirmModal } from './ConfirmModal';
import {
  DEFAULT_ADMIN_PIN_6,
  DEFAULT_USER_PIN_6,
  hashPin6,
  isValidPin6,
  type ExtraAdminPin,
  type PinHashes,
} from '../firebase/pinAuth';
import {
  addExtraAdminPin,
  deleteExtraAdminPin,
  updateExtraAdminPin,
  updateSecurityPins,
  type FullBackupPayload,
} from '../firebase/firestoreService';
import { LIMITS } from '../firebase/validation';
import { getTodayISO } from '../utils/thaiDate';

interface SettingsViewProps {
  settings: AppSettings;
  students: Student[];
  usageTypes: string[];
  pinHashes: PinHashes | null;
  activeAdminId?: string;
  activeAdminName?: string;
  counts: {
    logs: number;
    students: number;
    subjects: number;
  };
  onSettingsUpdated: (next: AppSettings) => void;
  onStudentsChanged: (next: Student[]) => void;
  onUsageTypesChanged: (next: string[]) => void;
  onPinHashesChanged: (next: PinHashes) => void;
  onClearLogsOnly: () => void;
  onClearAllData: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const COLOR_PRESETS: { name: string; colors: ThemeColors }[] = [
  {
    name: 'น้ำเงินวิชาการ (ค่าเริ่มต้น)',
    colors: DEFAULT_THEME_COLORS,
  },
  {
    name: 'เขียวมรกตธรรมชาติ',
    colors: {
      primary: '#059669',
      surface: '#ffffff',
      text: '#0f172a',
      accent: '#0284c7',
      secondary: '#0d9488',
    },
  },
  {
    name: 'กรมท่าสุขุม',
    colors: {
      primary: '#1d4ed8',
      surface: '#ffffff',
      text: '#111827',
      accent: '#16a34a',
      secondary: '#4f46e5',
    },
  },
  {
    name: 'ส้มพลังงาน',
    colors: {
      primary: '#ea580c',
      surface: '#ffffff',
      text: '#1c1917',
      accent: '#059669',
      secondary: '#9333ea',
    },
  },
];

function suggestNextClass(cls: string, classOptions: readonly string[] = []): string {
  const m = /^ป\.([1-6])\/(\d+)$/.exec(cls.trim());
  if (m) {
    const grade = Number(m[1]);
    const room = m[2];
    const target = grade < 6 ? `ป.${grade + 1}/${room}` : `ป.5/${room}`;
    if (classOptions.length === 0 || classOptions.includes(target)) {
      return target;
    }
  }
  const idx = classOptions.indexOf(cls);
  if (idx >= 0 && idx + 1 < classOptions.length) {
    return classOptions[idx + 1];
  }
  return classOptions.find((c) => c !== cls) || 'ป.6/1';
}

export function SettingsView({
  settings,
  students,
  usageTypes,
  pinHashes,
  activeAdminId = '',
  activeAdminName = '',
  counts,
  onSettingsUpdated,
  onStudentsChanged,
  onUsageTypesChanged,
  onPinHashesChanged,
  onClearLogsOnly,
  onClearAllData,
  onNotify,
}: SettingsViewProps) {
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [labManager, setLabManager] = useState(settings.labManager);
  const [labManagers, setLabManagers] = useState<string[]>(() => {
    const list = Array.isArray(settings.labManagers) ? settings.labManagers : [];
    const seen = new Set<string>();
    const clean = list.map((m) => m.trim()).filter((m) => m && !seen.has(m) && seen.add(m));
    if (!seen.has(settings.labManager)) {
      clean.unshift(settings.labManager);
    }
    return clean;
  });
  const [newManagerName, setNewManagerName] = useState('');
  const [addingManager, setAddingManager] = useState(false);
  const [editingManagerIdx, setEditingManagerIdx] = useState<number | null>(null);
  const [editingManagerValue, setEditingManagerValue] = useState('');
  const [savingManagerEdit, setSavingManagerEdit] = useState(false);
  const [confirmDeleteManagerIdx, setConfirmDeleteManagerIdx] = useState<number | null>(null);
  const [deletingManagerIdx, setDeletingManagerIdx] = useState<number | null>(null);
  const [settingPrimaryIdx, setSettingPrimaryIdx] = useState<number | null>(null);
  const [colors, setColors] = useState<ThemeColors>(settings.colors);
  const [saving, setSaving] = useState(false);

  const activeClassList = useMemo(() => getActiveClassList(settings), [settings]);
  const activeComputerRooms = useMemo(() => getActiveComputerRooms(settings), [settings]);

  // Classrooms CRUD State
  const [newClassName, setNewClassName] = useState('');
  const [addingClass, setAddingClass] = useState(false);
  const [editingClassIdx, setEditingClassIdx] = useState<number | null>(null);
  const [editingClassValue, setEditingClassValue] = useState('');
  const [savingClassEdit, setSavingClassEdit] = useState(false);
  const [confirmDeleteClassIdx, setConfirmDeleteClassIdx] = useState<number | null>(null);
  const [deletingClassIdx, setDeletingClassIdx] = useState<number | null>(null);
  const [confirmResetClasses, setConfirmResetClasses] = useState(false);
  const [resettingClasses, setResettingClasses] = useState(false);

  // Computer Rooms CRUD State
  const [newRoomName, setNewRoomName] = useState('');
  const [addingRoom, setAddingRoom] = useState(false);
  const [editingRoomIdx, setEditingRoomIdx] = useState<number | null>(null);
  const [editingRoomValue, setEditingRoomValue] = useState('');
  const [savingRoomEdit, setSavingRoomEdit] = useState(false);
  const [confirmDeleteRoomIdx, setConfirmDeleteRoomIdx] = useState<number | null>(null);
  const [deletingRoomIdx, setDeletingRoomIdx] = useState<number | null>(null);
  const [confirmResetRooms, setConfirmResetRooms] = useState(false);
  const [resettingRooms, setResettingRooms] = useState(false);
  const [reorderingRooms, setReorderingRooms] = useState(false);
  const [draggedRoomIdx, setDraggedRoomIdx] = useState<number | null>(null);
  const [dragOverRoomIdx, setDragOverRoomIdx] = useState<number | null>(null);

  // Grade Promotion State
  const studentCountByClass = useMemo(() => {
    const map: Record<string, number> = {};
    for (const stu of students) {
      map[stu.className] = (map[stu.className] || 0) + 1;
    }
    return map;
  }, [students]);

  const allClassOptions = useMemo(() => {
    const seen = new Set<string>(activeClassList);
    const extra = Object.keys(studentCountByClass)
      .filter((cls) => cls && cls !== EXTERNAL_VISITOR_CLASS && !seen.has(cls))
      .sort((a, b) => a.localeCompare(b, 'th'));
    return [...activeClassList, ...extra];
  }, [activeClassList, studentCountByClass]);

  const [promoMode, setPromoMode] = useState<'all' | 'room'>('all');
  const [p6Action, setP6Action] = useState<'delete' | 'keep'>('delete');
  const [updateYearOnPromote, setUpdateYearOnPromote] = useState(true);
  const [targetAcademicYear, setTargetAcademicYear] = useState(() => {
    const num = Number.parseInt(settings.academicYear, 10);
    return Number.isFinite(num) && num >= 2500 ? String(num + 1) : '2570';
  });
  const [fromClass, setFromClass] = useState<string>(() => {
    return allClassOptions.find((c) => (studentCountByClass[c] || 0) > 0 && !c.startsWith('ป.6/'))
      || allClassOptions.find((c) => (studentCountByClass[c] || 0) > 0)
      || allClassOptions[0]
      || 'ป.5/1';
  });
  const [toClass, setToClass] = useState<string>(() => suggestNextClass(fromClass, allClassOptions));
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>([]);
  const [promoConfirmOpen, setPromoConfirmOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const [newAdminPin, setNewAdminPin] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showUserPin, setShowUserPin] = useState(false);
  const [savingPins, setSavingPins] = useState(false);

  // Additional Admin PIN Accounts State (Primary Admin only)
  const [adminFormModal, setAdminFormModal] = useState<{
    mode: 'add' | 'edit';
    target?: ExtraAdminPin;
  } | null>(null);
  const [extraName, setExtraName] = useState('');
  const [extraPin, setExtraPin] = useState('');
  const [showExtraPin, setShowExtraPin] = useState(false);
  const [savingExtraAdmin, setSavingExtraAdmin] = useState(false);
  const [deleteExtraTarget, setDeleteExtraTarget] = useState<ExtraAdminPin | null>(null);
  const [deletingExtra, setDeletingExtra] = useState(false);

  // Self PIN Change State (For Additional Admin viewing their own account only)
  const [ownCurrentPin, setOwnCurrentPin] = useState('');
  const [ownNewPin, setOwnNewPin] = useState('');
  const [showOwnPin, setShowOwnPin] = useState(false);
  const [savingOwnPin, setSavingOwnPin] = useState(false);

  const [clearModal, setClearModal] = useState<'logs' | 'students-all' | 'students-rooms' | 'all' | null>(null);
  const [selectedClearRooms, setSelectedClearRooms] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);

  // Cloud Backup & Restore State
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<{
    fileName: string;
    payload: Partial<FullBackupPayload>;
    summary: {
      students: number;
      subjects: number;
      logs: number;
      bookings: number;
      teachingSchedules: number;
      hasSettings: boolean;
    };
  } | null>(null);

  // Keep form synced when live Firestore settings update (e.g. after restore or multi-tab update)
  useEffect(() => {
    setSchoolName(settings.schoolName);
    setAcademicYear(settings.academicYear);
    setLabManager(settings.labManager);
    const list = Array.isArray(settings.labManagers) ? settings.labManagers : [];
    const seen = new Set<string>();
    const clean = list.map((m) => m.trim()).filter((m) => m && !seen.has(m) && seen.add(m));
    if (!seen.has(settings.labManager)) {
      clean.unshift(settings.labManager);
    }
    setLabManagers(clean);
    setColors(settings.colors);
  }, [settings]);

  // Prune selected rooms for clearing if those rooms no longer have students
  useEffect(() => {
    setSelectedClearRooms((prev) =>
      prev.filter((cls) => (studentCountByClass[cls] || 0) > 0)
    );
  }, [studentCountByClass]);

  // Keep Grade Promotion selectors synced when classList changes
  useEffect(() => {
    if (allClassOptions.length === 0) return;
    if (!allClassOptions.includes(fromClass)) {
      const nextFrom = allClassOptions[0];
      setFromClass(nextFrom);
      setExcludedStudentIds([]);
    }
    if (!allClassOptions.includes(toClass)) {
      setToClass(suggestNextClass(fromClass, allClassOptions));
    }
  }, [allClassOptions, fromClass, toClass]);

  const roomsWithStudents = useMemo(
    () => allClassOptions.filter((cls) => (studentCountByClass[cls] || 0) > 0),
    [allClassOptions, studentCountByClass]
  );

  const orderedSelectedClearRooms = useMemo(
    () => allClassOptions.filter((cls) => selectedClearRooms.includes(cls)),
    [allClassOptions, selectedClearRooms]
  );

  const selectedClearStudentCount = useMemo(
    () => orderedSelectedClearRooms.reduce((sum, cls) => sum + (studentCountByClass[cls] || 0), 0),
    [orderedSelectedClearRooms, studentCountByClass]
  );

  const isPrimaryAdmin = !activeAdminId;
  const extraAdmins = pinHashes?.extraAdmins || [];
  const myExtraAdmin = activeAdminId
    ? extraAdmins.find((a) => a.id === activeAdminId) || null
    : null;

  const handleSavePins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrimaryAdmin) {
      onNotify('error', 'ผู้ดูแลระบบเพิ่มเติมไม่มีสิทธิ์แก้ไขรหัส PIN ของผู้อื่น');
      return;
    }
    const adminTrimmed = newAdminPin.trim();
    const userTrimmed = newUserPin.trim();
    if (!adminTrimmed && !userTrimmed) {
      onNotify('error', 'กรุณากรอกรหัส PIN 6 หลักอย่างน้อย 1 ช่องที่ต้องการเปลี่ยน');
      return;
    }
    if (adminTrimmed && !isValidPin6(adminTrimmed)) {
      onNotify('error', 'รหัส PIN ผู้ดูแลระบบต้องเป็นตัวเลข 6 หลัก');
      return;
    }
    if (userTrimmed && !isValidPin6(userTrimmed)) {
      onNotify('error', 'รหัส PIN ผู้ใช้งานทั่วไปต้องเป็นตัวเลข 6 หลัก');
      return;
    }

    setSavingPins(true);
    try {
      const updated = await updateSecurityPins(
        adminTrimmed || null,
        userTrimmed || null,
        pinHashes,
        activeAdminId
      );
      onPinHashesChanged(updated);
      setNewAdminPin('');
      setNewUserPin('');
      onNotify('success', 'บันทึกรหัสผ่านเข้าสู่ระบบ 6 หลัก (PIN) เรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกรหัส PIN ได้');
    } finally {
      setSavingPins(false);
    }
  };

  const handleResetDefaultPins = async () => {
    if (!isPrimaryAdmin) {
      onNotify('error', 'ผู้ดูแลระบบเพิ่มเติมไม่มีสิทธิ์รีเซ็ตรหัส PIN หลัก');
      return;
    }
    setSavingPins(true);
    try {
      const updated = await updateSecurityPins(
        DEFAULT_ADMIN_PIN_6,
        DEFAULT_USER_PIN_6,
        pinHashes,
        activeAdminId
      );
      onPinHashesChanged(updated);
      setNewAdminPin('');
      setNewUserPin('');
      onNotify('success', 'รีเซ็ตรหัส PIN หลักเป็นค่าเริ่มต้นเรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถรีเซ็ตรหัส PIN ได้');
    } finally {
      setSavingPins(false);
    }
  };

  const openAddExtraAdminModal = () => {
    if (!isPrimaryAdmin) return;
    setExtraName('');
    setExtraPin('');
    setShowExtraPin(false);
    setAdminFormModal({ mode: 'add' });
  };

  const openEditExtraAdminModal = (entry: ExtraAdminPin) => {
    if (!isPrimaryAdmin) return;
    setExtraName(entry.name);
    setExtraPin('');
    setShowExtraPin(false);
    setAdminFormModal({ mode: 'edit', target: entry });
  };

  const handleSaveExtraAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFormModal || !isPrimaryAdmin) return;
    const cleanName = extraName.trim();
    const cleanPin = extraPin.trim();

    if (!cleanName) {
      onNotify('error', 'กรุณากรอกชื่อผู้ดูแลระบบ');
      return;
    }
    if (adminFormModal.mode === 'add' && !isValidPin6(cleanPin)) {
      onNotify('error', 'กรุณากรอกรหัส PIN 6 หลักสำหรับผู้ดูแลระบบใหม่');
      return;
    }
    if (adminFormModal.mode === 'edit' && cleanPin && !isValidPin6(cleanPin)) {
      onNotify('error', 'รหัส PIN ใหม่ต้องเป็นตัวเลข 6 หลัก');
      return;
    }

    setSavingExtraAdmin(true);
    try {
      const updated =
        adminFormModal.mode === 'add'
          ? await addExtraAdminPin(cleanName, cleanPin, pinHashes, activeAdminId)
          : await updateExtraAdminPin(
              adminFormModal.target!.id,
              cleanName,
              cleanPin || null,
              pinHashes,
              activeAdminId
            );
      onPinHashesChanged(updated);
      setAdminFormModal(null);
      setExtraName('');
      setExtraPin('');
      onNotify(
        'success',
        adminFormModal.mode === 'add'
          ? `เพิ่มผู้ดูแลระบบ "${cleanName}" พร้อมรหัส PIN 6 หลักเรียบร้อยแล้ว`
          : `อัปเดตข้อมูลผู้ดูแลระบบ "${cleanName}" เรียบร้อยแล้ว`
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลผู้ดูแลระบบได้');
    } finally {
      setSavingExtraAdmin(false);
    }
  };

  const handleConfirmDeleteExtraAdmin = async () => {
    if (!deleteExtraTarget || !isPrimaryAdmin) return;
    setDeletingExtra(true);
    try {
      const updated = await deleteExtraAdminPin(deleteExtraTarget.id, pinHashes, activeAdminId);
      onPinHashesChanged(updated);
      onNotify('success', `ลบผู้ดูแลระบบ "${deleteExtraTarget.name}" เรียบร้อยแล้ว`);
      setDeleteExtraTarget(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบผู้ดูแลระบบได้');
    } finally {
      setDeletingExtra(false);
    }
  };

  const handleChangeOwnExtraPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myExtraAdmin) return;
    if (!isValidPin6(ownCurrentPin) || !isValidPin6(ownNewPin)) {
      onNotify('error', 'กรุณากรอกรหัส PIN ปัจจุบันและรหัส PIN ใหม่เป็นตัวเลข 6 หลัก');
      return;
    }

    setSavingOwnPin(true);
    try {
      const currentHash = await hashPin6(ownCurrentPin);
      if (currentHash !== myExtraAdmin.pinHash) {
        onNotify('error', 'รหัส PIN ปัจจุบันไม่ถูกต้อง');
        return;
      }
      const updated = await updateExtraAdminPin(
        myExtraAdmin.id,
        myExtraAdmin.name,
        ownNewPin,
        pinHashes,
        activeAdminId
      );
      onPinHashesChanged(updated);
      setOwnCurrentPin('');
      setOwnNewPin('');
      onNotify('success', 'เปลี่ยนรหัส PIN 6 หลักของบัญชีคุณเรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนรหัส PIN ได้');
    } finally {
      setSavingOwnPin(false);
    }
  };

  const handleConfirmClear = async () => {
    if (!clearModal) return;
    setClearing(true);
    try {
      if (clearModal === 'logs') {
        const res = await api.clearUsageLogsOnly();
        onClearLogsOnly();
        onNotify('success', `ลบข้อมูลเฉพาะการใช้งาน (${res.deletedCount} รายการ) เรียบร้อยแล้ว`);
      } else if (clearModal === 'students-all') {
        const res = await api.clearAllStudents();
        onStudentsChanged([]);
        setSelectedClearRooms([]);
        onNotify('success', `ลบรายชื่อนักเรียนทั้งหมด (${res.deletedCount} คน) เรียบร้อยแล้ว`);
      } else if (clearModal === 'students-rooms') {
        const targetRooms = [...orderedSelectedClearRooms];
        const res = await api.deleteStudentsByClasses(targetRooms);
        const targetSet = new Set(targetRooms);
        onStudentsChanged(students.filter((stu) => !targetSet.has(stu.className)));
        setSelectedClearRooms([]);
        onNotify(
          'success',
          `ลบรายชื่อนักเรียนห้อง ${targetRooms.join(', ')} (${res.deletedCount} คน) เรียบร้อยแล้ว`
        );
      } else {
        const res = await api.clearAllData();
        onClearAllData();
        setSelectedClearRooms([]);
        onNotify(
          'success',
          `ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว (การใช้งาน ${res.deletedLogs}, นักเรียน ${res.deletedStudents}, รายวิชา ${res.deletedSubjects})`
        );
      }
      setClearModal(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถล้างข้อมูลได้');
    } finally {
      setClearing(false);
    }
  };

  const handleExportFullBackup = async () => {
    setExportingBackup(true);
    try {
      const backup = await api.exportFullBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `computer-lab-backup-${getTodayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify(
        'success',
        `สำรองข้อมูลเรียบร้อยแล้ว (ประวัติ ${backup.logs.length} · นักเรียน ${backup.students.length} · วิชา ${backup.subjects.length} · จองห้อง ${backup.bookings.length} · ตารางสอน ${backup.teachingSchedules.length})`
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถส่งออกไฟล์สำรองข้อมูลได้');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<FullBackupPayload>;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('ไฟล์สำรองไม่ถูกต้อง');
      }
      const studentsLen = Array.isArray(parsed.students) ? parsed.students.length : 0;
      const subjectsLen = Array.isArray(parsed.subjects) ? parsed.subjects.length : 0;
      const logsLen = Array.isArray(parsed.logs) ? parsed.logs.length : 0;
      const bookingsLen = Array.isArray(parsed.bookings) ? parsed.bookings.length : 0;
      const schedulesLen = Array.isArray(parsed.teachingSchedules)
        ? parsed.teachingSchedules.length
        : 0;
      const hasSettings = Boolean(parsed.settings || Array.isArray(parsed.usageTypes));

      if (
        studentsLen === 0 &&
        subjectsLen === 0 &&
        logsLen === 0 &&
        bookingsLen === 0 &&
        schedulesLen === 0 &&
        !hasSettings
      ) {
        onNotify('error', 'ไม่พบข้อมูลที่กู้คืนได้ในไฟล์สำรองนี้');
        return;
      }

      setPendingBackup({
        fileName: file.name,
        payload: parsed,
        summary: {
          students: studentsLen,
          subjects: subjectsLen,
          logs: logsLen,
          bookings: bookingsLen,
          teachingSchedules: schedulesLen,
          hasSettings,
        },
      });
    } catch {
      onNotify('error', 'ไม่สามารถอ่านไฟล์สำรองได้ กรุณาเลือกไฟล์ .json ที่ส่งออกจากระบบนี้');
    }
  };

  const handleConfirmRestoreBackup = async () => {
    if (!pendingBackup) return;
    setRestoringBackup(true);
    try {
      const res = await api.restoreFullBackup(pendingBackup.payload);
      setPendingBackup(null);
      onNotify(
        'success',
        `กู้คืนข้อมูลสำเร็จ (ประวัติ ${res.logs} · นักเรียน ${res.students} · วิชา ${res.subjects} · จองห้อง ${res.bookings} · ตารางสอน ${res.teachingSchedules})`
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถกู้คืนข้อมูลจากไฟล์สำรองได้');
    } finally {
      setRestoringBackup(false);
    }
  };

  const persistManagers = async (
    nextPrimary: string,
    nextList: string[],
    successMsg: string
  ) => {
    const res = await api.updateLabManagers(nextPrimary, nextList);
    setLabManager(res.labManager);
    setLabManagers(res.labManagers);
    onSettingsUpdated({
      ...settings,
      schoolName: schoolName.trim() || settings.schoolName,
      academicYear: academicYear.trim() || settings.academicYear,
      labManager: res.labManager,
      labManagers: res.labManagers,
      colors,
    });
    onNotify('success', successMsg);
  };

  const handleAddManager = async () => {
    const trimmed = newManagerName.trim();
    if (!trimmed) {
      onNotify('error', 'กรุณากรอกชื่อผู้รับผิดชอบห้องคอมพิวเตอร์');
      return;
    }
    if (labManagers.includes(trimmed)) {
      onNotify('error', 'รายชื่อผู้รับผิดชอบนี้มีอยู่ในระบบแล้ว');
      return;
    }
    if (labManagers.length >= 20) {
      onNotify('error', 'สามารถเพิ่มรายชื่อผู้รับผิดชอบได้สูงสุด 20 คน');
      return;
    }

    setAddingManager(true);
    try {
      const nextList = [...labManagers, trimmed];
      await persistManagers(
        labManager,
        nextList,
        `เพิ่มผู้รับผิดชอบห้องคอมพิวเตอร์ "${trimmed}" เรียบร้อยแล้ว`
      );
      setNewManagerName('');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถเพิ่มผู้รับผิดชอบได้');
    } finally {
      setAddingManager(false);
    }
  };

  const handleSaveEditManager = async (idx: number) => {
    const trimmed = editingManagerValue.trim();
    const oldName = labManagers[idx];
    if (!trimmed) {
      onNotify('error', 'ชื่อผู้รับผิดชอบห้องคอมพิวเตอร์ห้ามว่าง');
      return;
    }
    if (trimmed === oldName) {
      setEditingManagerIdx(null);
      return;
    }
    if (labManagers.some((m, i) => i !== idx && m === trimmed)) {
      onNotify('error', 'รายชื่อผู้รับผิดชอบนี้มีอยู่ในระบบแล้ว');
      return;
    }

    setSavingManagerEdit(true);
    try {
      const nextList = [...labManagers];
      nextList[idx] = trimmed;
      const nextPrimary = labManager === oldName ? trimmed : labManager;
      await persistManagers(
        nextPrimary,
        nextList,
        `แก้ไขชื่อผู้รับผิดชอบเป็น "${trimmed}" เรียบร้อยแล้ว`
      );
      setEditingManagerIdx(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถแก้ไขชื่อผู้รับผิดชอบได้');
    } finally {
      setSavingManagerEdit(false);
    }
  };

  const handleSetPrimaryManager = async (idx: number) => {
    const targetName = labManagers[idx];
    if (!targetName || targetName === labManager) return;
    setSettingPrimaryIdx(idx);
    try {
      await persistManagers(
        targetName,
        labManagers,
        `ตั้ง "${targetName}" เป็นผู้รับผิดชอบหลักเรียบร้อยแล้ว`
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถตั้งผู้รับผิดชอบหลักได้');
    } finally {
      setSettingPrimaryIdx(null);
    }
  };

  const handleDeleteManager = async (idx: number) => {
    if (labManagers.length <= 1) {
      onNotify('error', 'ต้องมีผู้รับผิดชอบห้องคอมพิวเตอร์อย่างน้อย 1 คน');
      setConfirmDeleteManagerIdx(null);
      return;
    }
    const targetName = labManagers[idx];
    setDeletingManagerIdx(idx);
    try {
      const nextList = labManagers.filter((_, i) => i !== idx);
      const nextPrimary = labManager === targetName ? nextList[0] : labManager;
      await persistManagers(
        nextPrimary,
        nextList,
        `ลบรายชื่อผู้รับผิดชอบ "${targetName}" เรียบร้อยแล้ว`
      );
      setConfirmDeleteManagerIdx(null);
      if (editingManagerIdx === idx) setEditingManagerIdx(null);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบผู้รับผิดชอบได้');
    } finally {
      setDeletingManagerIdx(null);
    }
  };

  // --- Classrooms CRUD Handlers ---
  const handleAddClass = async () => {
    const trimmed = newClassName.trim();
    if (!trimmed) {
      onNotify('error', 'กรุณากรอกชื่อชั้นเรียนที่ต้องการเพิ่ม');
      return;
    }
    if (trimmed === EXTERNAL_VISITOR_CLASS) {
      onNotify('error', 'ไม่สามารถใช้ชื่อ "บุคคลภายนอก" เป็นชื่อชั้นเรียนได้');
      return;
    }
    if (trimmed.length > LIMITS.CLASS_MAX) {
      onNotify('error', `ชื่อชั้นเรียนต้องไม่เกิน ${LIMITS.CLASS_MAX} ตัวอักษร`);
      return;
    }
    if (activeClassList.includes(trimmed)) {
      onNotify('error', `ชั้นเรียน "${trimmed}" มีอยู่ในระบบแล้ว`);
      return;
    }
    if (activeClassList.length >= LIMITS.CLASS_LIST_MAX) {
      onNotify('error', `สามารถเพิ่มชั้นเรียนได้สูงสุด ${LIMITS.CLASS_LIST_MAX} ห้อง`);
      return;
    }

    setAddingClass(true);
    try {
      const nextList = [...activeClassList, trimmed];
      const res = await api.updateClassList(nextList);
      onSettingsUpdated({ ...settings, classList: res.classList });
      setNewClassName('');
      onNotify('success', `เพิ่มชั้นเรียน "${trimmed}" เรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถเพิ่มชั้นเรียนได้');
    } finally {
      setAddingClass(false);
    }
  };

  const handleSaveEditClass = async (idx: number) => {
    const trimmed = editingClassValue.trim();
    const oldName = activeClassList[idx];
    if (!trimmed) {
      onNotify('error', 'ชื่อชั้นเรียนห้ามว่าง');
      return;
    }
    if (trimmed === EXTERNAL_VISITOR_CLASS) {
      onNotify('error', 'ไม่สามารถใช้ชื่อ "บุคคลภายนอก" เป็นชื่อชั้นเรียนได้');
      return;
    }
    if (trimmed.length > LIMITS.CLASS_MAX) {
      onNotify('error', `ชื่อชั้นเรียนต้องไม่เกิน ${LIMITS.CLASS_MAX} ตัวอักษร`);
      return;
    }
    if (trimmed === oldName) {
      setEditingClassIdx(null);
      return;
    }
    if (activeClassList.some((c, i) => i !== idx && c === trimmed)) {
      onNotify('error', `ชั้นเรียน "${trimmed}" มีอยู่ในระบบแล้ว`);
      return;
    }

    setSavingClassEdit(true);
    try {
      const nextList = [...activeClassList];
      nextList[idx] = trimmed;
      const res = await api.updateClassList(nextList, { from: oldName, to: trimmed });
      onSettingsUpdated({ ...settings, classList: res.classList });
      if (res.renamedStudents > 0) {
        onStudentsChanged(
          students.map((s) => (s.className === oldName ? { ...s, className: trimmed } : s))
        );
      }
      if (fromClass === oldName) setFromClass(trimmed);
      if (toClass === oldName) setToClass(trimmed);
      setEditingClassIdx(null);

      const syncNotes: string[] = [];
      if (res.renamedStudents > 0) syncNotes.push(`นักเรียน ${res.renamedStudents} คน`);
      if (res.renamedLogs > 0) syncNotes.push(`ประวัติ ${res.renamedLogs} รายการ`);
      if (res.renamedSchedules > 0) syncNotes.push(`ตารางสอน ${res.renamedSchedules} คาบ`);
      const syncText = syncNotes.length > 0 ? ` (อัปเดตข้อมูลที่เกี่ยวข้อง: ${syncNotes.join(', ')})` : '';
      onNotify('success', `แก้ไขชื่อชั้นเรียน "${oldName}" → "${trimmed}" เรียบร้อยแล้ว${syncText}`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถแก้ไขชั้นเรียนได้');
    } finally {
      setSavingClassEdit(false);
    }
  };

  const handleDeleteClass = async (idx: number) => {
    if (activeClassList.length <= 1) {
      onNotify('error', 'ต้องมีชั้นเรียนอย่างน้อย 1 ห้องในระบบ');
      setConfirmDeleteClassIdx(null);
      return;
    }
    const targetName = activeClassList[idx];
    setDeletingClassIdx(idx);
    try {
      const nextList = activeClassList.filter((_, i) => i !== idx);
      const res = await api.updateClassList(nextList);
      onSettingsUpdated({ ...settings, classList: res.classList });
      setConfirmDeleteClassIdx(null);
      if (editingClassIdx === idx) setEditingClassIdx(null);
      onNotify('success', `ลบชั้นเรียน "${targetName}" ออกจากรายการแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบชั้นเรียนได้');
    } finally {
      setDeletingClassIdx(null);
    }
  };

  const handleResetDefaultClasses = async () => {
    setResettingClasses(true);
    try {
      const res = await api.updateClassList([...CLASS_LIST]);
      onSettingsUpdated({ ...settings, classList: res.classList });
      setConfirmResetClasses(false);
      setEditingClassIdx(null);
      setConfirmDeleteClassIdx(null);
      onNotify('success', `รีเซ็ตรายการชั้นเรียนเป็นค่าเริ่มต้น (${CLASS_LIST.length} ห้อง) เรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถรีเซ็ตชั้นเรียนได้');
    } finally {
      setResettingClasses(false);
    }
  };

  // --- Computer Rooms CRUD Handlers ---
  const handleAddRoom = async () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) {
      onNotify('error', 'กรุณากรอกชื่อห้องคอมพิวเตอร์ที่ต้องการเพิ่ม');
      return;
    }
    if (trimmed.length > LIMITS.CLASS_MAX) {
      onNotify('error', `ชื่อห้องคอมพิวเตอร์ต้องไม่เกิน ${LIMITS.CLASS_MAX} ตัวอักษร`);
      return;
    }
    if (activeComputerRooms.includes(trimmed)) {
      onNotify('error', `ห้องคอมพิวเตอร์ "${trimmed}" มีอยู่ในระบบแล้ว`);
      return;
    }
    if (activeComputerRooms.length >= LIMITS.COMPUTER_ROOMS_MAX) {
      onNotify('error', `สามารถเพิ่มห้องคอมพิวเตอร์ได้สูงสุด ${LIMITS.COMPUTER_ROOMS_MAX} ห้อง`);
      return;
    }

    setAddingRoom(true);
    try {
      const nextRooms = [...activeComputerRooms, trimmed];
      const res = await api.updateComputerRooms(nextRooms);
      onSettingsUpdated({ ...settings, computerRooms: res.computerRooms });
      setNewRoomName('');
      onNotify('success', `เพิ่มห้องคอมพิวเตอร์ "${trimmed}" เรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถเพิ่มห้องคอมพิวเตอร์ได้');
    } finally {
      setAddingRoom(false);
    }
  };

  const handleSaveEditRoom = async (idx: number) => {
    const trimmed = editingRoomValue.trim();
    const oldName = activeComputerRooms[idx];
    if (!trimmed) {
      onNotify('error', 'ชื่อห้องคอมพิวเตอร์ห้ามว่าง');
      return;
    }
    if (trimmed.length > LIMITS.CLASS_MAX) {
      onNotify('error', `ชื่อห้องคอมพิวเตอร์ต้องไม่เกิน ${LIMITS.CLASS_MAX} ตัวอักษร`);
      return;
    }
    if (trimmed === oldName) {
      setEditingRoomIdx(null);
      return;
    }
    if (activeComputerRooms.some((r, i) => i !== idx && r === trimmed)) {
      onNotify('error', `ห้องคอมพิวเตอร์ "${trimmed}" มีอยู่ในระบบแล้ว`);
      return;
    }

    setSavingRoomEdit(true);
    try {
      const nextRooms = [...activeComputerRooms];
      nextRooms[idx] = trimmed;
      const res = await api.updateComputerRooms(nextRooms, { from: oldName, to: trimmed });
      onSettingsUpdated({ ...settings, computerRooms: res.computerRooms });
      setEditingRoomIdx(null);

      const syncNotes: string[] = [];
      if (res.renamedLogs > 0) syncNotes.push(`ประวัติการใช้งาน ${res.renamedLogs} รายการ`);
      if (res.renamedSchedules > 0) syncNotes.push(`ตารางสอน ${res.renamedSchedules} คาบ`);
      const syncText = syncNotes.length > 0 ? ` (อัปเดตข้อมูลที่เกี่ยวข้อง: ${syncNotes.join(', ')})` : '';
      onNotify('success', `แก้ไขชื่อห้องคอมพิวเตอร์ "${oldName}" → "${trimmed}" เรียบร้อยแล้ว${syncText}`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถแก้ไขห้องคอมพิวเตอร์ได้');
    } finally {
      setSavingRoomEdit(false);
    }
  };

  const handleDeleteRoom = async (idx: number) => {
    if (activeComputerRooms.length <= 1) {
      onNotify('error', 'ต้องมีห้องคอมพิวเตอร์อย่างน้อย 1 ห้องในระบบ');
      setConfirmDeleteRoomIdx(null);
      return;
    }
    const targetName = activeComputerRooms[idx];
    setDeletingRoomIdx(idx);
    try {
      const nextRooms = activeComputerRooms.filter((_, i) => i !== idx);
      const res = await api.updateComputerRooms(nextRooms);
      onSettingsUpdated({ ...settings, computerRooms: res.computerRooms });
      setConfirmDeleteRoomIdx(null);
      if (editingRoomIdx === idx) setEditingRoomIdx(null);
      onNotify('success', `ลบห้องคอมพิวเตอร์ "${targetName}" ออกจากรายการแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถลบห้องคอมพิวเตอร์ได้');
    } finally {
      setDeletingRoomIdx(null);
    }
  };

  const handleResetDefaultRooms = async () => {
    setResettingRooms(true);
    try {
      const res = await api.updateComputerRooms([...COMPUTER_ROOMS]);
      onSettingsUpdated({ ...settings, computerRooms: res.computerRooms });
      setConfirmResetRooms(false);
      setEditingRoomIdx(null);
      setConfirmDeleteRoomIdx(null);
      onNotify('success', `รีเซ็ตห้องคอมพิวเตอร์เป็นค่าเริ่มต้น (${COMPUTER_ROOMS.join(', ')}) เรียบร้อยแล้ว`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถรีเซ็ตห้องคอมพิวเตอร์ได้');
    } finally {
      setResettingRooms(false);
    }
  };

  const handleMoveRoom = async (fromIndex: number, toIndex: number) => {
    if (
      reorderingRooms ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= activeComputerRooms.length ||
      toIndex >= activeComputerRooms.length
    ) {
      return;
    }

    const previousRooms = [...activeComputerRooms];
    const nextRooms = [...activeComputerRooms];
    const [moved] = nextRooms.splice(fromIndex, 1);
    nextRooms.splice(toIndex, 0, moved);

    setEditingRoomIdx(null);
    setConfirmDeleteRoomIdx(null);
    setReorderingRooms(true);
    onSettingsUpdated({ ...settings, computerRooms: nextRooms });

    try {
      const res = await api.updateComputerRooms(nextRooms);
      onSettingsUpdated({ ...settings, computerRooms: res.computerRooms });
      onNotify('success', `จัดลำดับห้องคอมพิวเตอร์ "${moved}" เรียบร้อยแล้ว`);
    } catch (err) {
      onSettingsUpdated({ ...settings, computerRooms: previousRooms });
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกลำดับห้องคอมพิวเตอร์ได้');
    } finally {
      setReorderingRooms(false);
      setDraggedRoomIdx(null);
      setDragOverRoomIdx(null);
    }
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const nextColors = { ...colors, [key]: value };
    setColors(nextColors);
    // Live preview immediately
    onSettingsUpdated({
      ...settings,
      schoolName,
      academicYear,
      labManager,
      labManagers,
      colors: nextColors,
    });
  };

  const handleApplyPreset = (presetColors: ThemeColors) => {
    setColors(presetColors);
    onSettingsUpdated({
      ...settings,
      schoolName,
      academicYear,
      labManager,
      labManagers,
      colors: presetColors,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !academicYear.trim() || !labManager.trim()) {
      onNotify('error', 'กรุณากรอกชื่อโรงเรียน ปีการศึกษา และผู้รับผิดชอบให้ครบถ้วน');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateSettings({
        schoolName: schoolName.trim(),
        academicYear: academicYear.trim(),
        labManager: labManager.trim(),
        labManagers,
        colors,
        scheduleTimes: settings.scheduleTimes,
      });
      setLabManager(updated.labManager);
      if (updated.labManagers) {
        setLabManagers(updated.labManagers);
      }
      onSettingsUpdated(updated);
      onNotify('success', 'บันทึกการตั้งค่าระบบและชุดสีเรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setSaving(false);
    }
  };

  const colorFields: { key: keyof ThemeColors; label: string; desc: string }[] = [
    { key: 'primary', label: 'สีหลัก (Primary)', desc: 'ปุ่มบันทึก เมนูที่เลือก และจุดโฟกัสหลัก' },
    { key: 'surface', label: 'สีพื้นผิว (Surface)', desc: 'พื้นหลังการ์ดและตารางข้อมูลในโหมดสว่าง' },
    { key: 'text', label: 'สีข้อความ (Text)', desc: 'สีตัวอักษรหลักในโหมดสว่าง' },
    { key: 'accent', label: 'สีเน้น (Accent)', desc: 'ปุ่ม Export และสถานะความสำเร็จ' },
    { key: 'secondary', label: 'สีปุ่มรอง (Secondary Action)', desc: 'ปุ่มอัปเดตและทางลัดรายงาน' },
  ];

  return (
    <div className="space-y-6">
    <form onSubmit={handleSave} className="space-y-6">
      {/* School Settings */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex items-center gap-3 border-b border-blue-100/80 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-transparent dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-transparent px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xs shrink-0">
            <School className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            ข้อมูลโรงเรียนและผู้รับผิดชอบ
          </h2>
        </div>
        <div className="p-6 space-y-5">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="set-school" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              ชื่อโรงเรียน
            </label>
            <input
              id="set-school"
              type="text"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="set-year" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              ปีการศึกษา (พ.ศ.)
            </label>
            <input
              id="set-year"
              type="text"
              required
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="set-manager" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              ผู้รับผิดชอบห้องคอมพิวเตอร์ (หลัก)
            </label>
            <select
              id="set-manager"
              value={labManager}
              onChange={(e) => setLabManager(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {labManagers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-Lab Manager Management Subpanel */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                รายชื่อผู้รับผิดชอบห้องคอมพิวเตอร์ ({labManagers.length}/20 คน)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              เพิ่ม แก้ไข หรือเลือกผู้รับผิดชอบหลักสำหรับแสดงในหัวรายงานและเลือกใช้ในแบบฟอร์ม
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={newManagerName}
              onChange={(e) => setNewManagerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddManager();
                }
              }}
              placeholder="เพิ่มชื่อผู้รับผิดชอบห้องคอมพิวเตอร์ เช่น ครูสมหญิง ใจดี"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={addingManager || !newManagerName.trim() || labManagers.length >= 20}
              onClick={() => void handleAddManager()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              <Plus className="h-4 w-4" />
              <span>{addingManager ? 'กำลังเพิ่ม...' : 'เพิ่มผู้รับผิดชอบ'}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            {labManagers.map((managerName, idx) => {
              const isPrimary = managerName === labManager;
              const isEditing = editingManagerIdx === idx;
              const isConfirmDelete = confirmDeleteManagerIdx === idx;

              return (
                <div
                  key={`${idx}-${managerName}`}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-mono-num text-xs text-slate-400 w-5 shrink-0">
                      {idx + 1}.
                    </span>

                    {isEditing ? (
                      <input
                        type="text"
                        value={editingManagerValue}
                        onChange={(e) => setEditingManagerValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSaveEditManager(idx);
                          } else if (e.key === 'Escape') {
                            setEditingManagerIdx(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 rounded-md border border-blue-400 bg-white dark:bg-slate-800 px-2.5 py-1 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {managerName}
                        </span>
                        {isPrimary && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                            <Star className="h-3 w-3 fill-current" />
                            <span>ผู้รับผิดชอบหลัก</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSaveEditManager(idx)}
                          disabled={savingManagerEdit}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>บันทึก</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingManagerIdx(null)}
                          disabled={savingManagerEdit}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>ยกเลิก</span>
                        </button>
                      </>
                    ) : isConfirmDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleDeleteManager(idx)}
                          disabled={deletingManagerIdx === idx}
                          className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {deletingManagerIdx === idx ? 'กำลังลบ...' : 'ยืนยันลบ'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteManagerIdx(null)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => void handleSetPrimaryManager(idx)}
                            disabled={settingPrimaryIdx === idx}
                            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
                          >
                            {settingPrimaryIdx === idx ? 'กำลังบันทึก...' : 'ตั้งเป็นหลัก'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingManagerIdx(idx);
                            setEditingManagerValue(managerName);
                            setConfirmDeleteManagerIdx(null);
                          }}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition-colors"
                          title="แก้ไขชื่อ"
                          aria-label={`แก้ไข ${managerName}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {labManagers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteManagerIdx(idx);
                              setEditingManagerIdx(null);
                            }}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                            title="ลบรายชื่อ"
                            aria-label={`ลบ ${managerName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </section>

      {/* Recolorable Theme Settings */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100/80 dark:border-purple-900/50 bg-gradient-to-r from-purple-50/90 via-fuchsia-50/60 to-transparent dark:from-purple-950/40 dark:via-fuchsia-950/30 dark:to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-xs shrink-0">
              <Palette className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              ปรับแต่งชุดสีระบบ (Recolorable)
            </h2>
          </div>

          <button
            type="button"
            onClick={() => handleApplyPreset(DEFAULT_THEME_COLORS)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800/70 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รีเซ็ตสีเริ่มต้น</span>
          </button>
        </div>

        <div className="p-6 space-y-5">
        {/* Presets */}
        <div>
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            ชุดสีแนะนำ:
          </span>
          <div className="flex flex-wrap gap-2.5">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleApplyPreset(preset.colors)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300"
                  style={{ backgroundColor: preset.colors.primary }}
                />
                <span
                  className="h-3.5 w-3.5 rounded-full border border-slate-300"
                  style={{ backgroundColor: preset.colors.accent }}
                />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 5 Individual Color Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {colorFields.map((field) => (
            <div
              key={field.key}
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5"
            >
              <div>
                <label
                  htmlFor={`color-${field.key}`}
                  className="block text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  {field.label}
                </label>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {field.desc}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`color-${field.key}`}
                  type="color"
                  value={colors[field.key]}
                  onChange={(e) => handleColorChange(field.key, e.target.value)}
                  className="h-9 w-11 cursor-pointer rounded border border-slate-200 dark:border-slate-700 bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={colors[field.key]}
                  onChange={(e) => handleColorChange(field.key, e.target.value)}
                  className="font-mono-num w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
          </button>
        </div>
        </div>
      </section>
    </form>

    {/* Classrooms & Computer Rooms Management Section */}
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100/80 dark:border-sky-900/50 bg-gradient-to-r from-sky-50/90 via-blue-50/60 to-transparent dark:from-sky-950/40 dark:via-blue-950/30 dark:to-transparent px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-xs shrink-0">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              จัดการชั้นเรียนและห้องคอมพิวเตอร์
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เพิ่ม แก้ไข หรือลบรายชื่อชั้นเรียนและห้องคอมพิวเตอร์ที่ใช้ทั่วทั้งระบบ (แก้ไขชื่อจะอัปเดตข้อมูลที่เชื่อมโยงให้อัตโนมัติ)
            </p>
          </div>
        </div>

        <div className="font-mono-num text-xs font-medium text-sky-800 dark:text-sky-300">
          ชั้นเรียน {activeClassList.length}/{LIMITS.CLASS_LIST_MAX} · ห้องคอม {activeComputerRooms.length}/{LIMITS.COMPUTER_ROOMS_MAX}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Classrooms (classList) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <School className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                รายชื่อชั้นเรียน ({activeClassList.length}/{LIMITS.CLASS_LIST_MAX})
              </h3>
            </div>

            {confirmResetClasses ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={resettingClasses}
                  onClick={() => void handleResetDefaultClasses()}
                  className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {resettingClasses ? 'กำลังรีเซ็ต...' : 'ยืนยันรีเซ็ต ป.1/1–ป.6/3'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetClasses(false)}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetClasses(true)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>รีเซ็ตค่าเริ่มต้น</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              maxLength={LIMITS.CLASS_MAX}
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddClass();
                }
              }}
              placeholder="เพิ่มชั้นเรียน เช่น ป.5/4, ม.1/1, อนุบาล 3"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="button"
              disabled={addingClass || !newClassName.trim() || activeClassList.length >= LIMITS.CLASS_LIST_MAX}
              onClick={() => void handleAddClass()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>{addingClass ? 'กำลังเพิ่ม...' : 'เพิ่มชั้นเรียน'}</span>
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {activeClassList.map((cls, idx) => {
              const stuCount = studentCountByClass[cls] || 0;
              const isEditing = editingClassIdx === idx;
              const isConfirmDelete = confirmDeleteClassIdx === idx;

              return (
                <div
                  key={`${idx}-${cls}`}
                  className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3.5 py-2"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="font-mono-num text-[11px] text-slate-400 w-6 shrink-0">
                      {idx + 1}.
                    </span>

                    {isEditing ? (
                      <input
                        type="text"
                        maxLength={LIMITS.CLASS_MAX}
                        value={editingClassValue}
                        onChange={(e) => setEditingClassValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSaveEditClass(idx);
                          } else if (e.key === 'Escape') {
                            setEditingClassIdx(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 rounded-md border border-sky-400 bg-white dark:bg-slate-800 px-2.5 py-1 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {cls}
                        </span>
                        <span className="font-mono-num text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                          ({stuCount} คน)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSaveEditClass(idx)}
                          disabled={savingClassEdit}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{savingClassEdit ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingClassIdx(null)}
                          disabled={savingClassEdit}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : isConfirmDelete ? (
                      <>
                        {stuCount > 0 && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 mr-1 whitespace-nowrap">
                            นักเรียน {stuCount} คนยังอยู่
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteClass(idx)}
                          disabled={deletingClassIdx === idx}
                          className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {deletingClassIdx === idx ? 'กำลังลบ...' : 'ยืนยันลบ'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteClassIdx(null)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClassIdx(idx);
                            setEditingClassValue(cls);
                            setConfirmDeleteClassIdx(null);
                          }}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-sky-400 transition-colors"
                          title="แก้ไขชื่อชั้นเรียน"
                          aria-label={`แก้ไข ${cls}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {activeClassList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteClassIdx(idx);
                              setEditingClassIdx(null);
                            }}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                            title="ลบชั้นเรียน"
                            aria-label={`ลบ ${cls}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Computer Rooms (computerRooms) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                รายชื่อห้องคอมพิวเตอร์ ({activeComputerRooms.length}/{LIMITS.COMPUTER_ROOMS_MAX})
              </h3>
            </div>

            {confirmResetRooms ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={resettingRooms}
                  onClick={() => void handleResetDefaultRooms()}
                  className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {resettingRooms ? 'กำลังรีเซ็ต...' : 'ยืนยันรีเซ็ต (คอม1, คอม2)'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetRooms(false)}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmResetRooms(true)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                <span>รีเซ็ตค่าเริ่มต้น</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              maxLength={LIMITS.CLASS_MAX}
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddRoom();
                }
              }}
              placeholder="เพิ่มห้องคอม เช่น คอม3, ห้อง ICT, ห้องสื่อ"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              disabled={addingRoom || !newRoomName.trim() || activeComputerRooms.length >= LIMITS.COMPUTER_ROOMS_MAX}
              onClick={() => void handleAddRoom()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>{addingRoom ? 'กำลังเพิ่ม...' : 'เพิ่มห้องคอม'}</span>
            </button>
          </div>

          {activeComputerRooms.length > 1 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ลากวางหรือกดลูกศรขึ้น–ลงเพื่อจัดลำดับห้องคอมพิวเตอร์ (ใช้เรียงลำดับในทุกเมนูของระบบ)
            </p>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {activeComputerRooms.map((roomName, idx) => {
              const isEditing = editingRoomIdx === idx;
              const isConfirmDelete = confirmDeleteRoomIdx === idx;
              const canReorder =
                activeComputerRooms.length > 1 &&
                !isEditing &&
                !isConfirmDelete &&
                !reorderingRooms &&
                !savingRoomEdit &&
                deletingRoomIdx === null &&
                !resettingRooms;
              const isDragging = draggedRoomIdx === idx;
              const isDragOver = dragOverRoomIdx === idx && draggedRoomIdx !== null && draggedRoomIdx !== idx;

              return (
                <div
                  key={`${idx}-${roomName}`}
                  draggable={canReorder}
                  onDragStart={(e) => {
                    if (!canReorder) return;
                    setDraggedRoomIdx(idx);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                  }}
                  onDragOver={(e) => {
                    if (!canReorder || draggedRoomIdx === null) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverRoomIdx !== idx) {
                      setDragOverRoomIdx(idx);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverRoomIdx === idx) {
                      setDragOverRoomIdx(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = draggedRoomIdx;
                    setDragOverRoomIdx(null);
                    setDraggedRoomIdx(null);
                    if (from !== null && from !== idx) {
                      void handleMoveRoom(from, idx);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedRoomIdx(null);
                    setDragOverRoomIdx(null);
                  }}
                  className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3.5 py-2.5 transition-colors ${
                    isDragging
                      ? 'opacity-50 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : isDragOver
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 ring-1 ring-inset ring-emerald-400'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {activeComputerRooms.length > 1 && (
                      <span
                        className={`shrink-0 text-slate-400 dark:text-slate-500 ${
                          canReorder ? 'cursor-grab active:cursor-grabbing hover:text-emerald-600 dark:hover:text-emerald-400' : 'opacity-40'
                        }`}
                        title="ลากเพื่อจัดลำดับ"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                    )}
                    <span className="font-mono-num text-[11px] text-slate-400 w-5 shrink-0">
                      {idx + 1}.
                    </span>

                    {isEditing ? (
                      <input
                        type="text"
                        maxLength={LIMITS.CLASS_MAX}
                        value={editingRoomValue}
                        onChange={(e) => setEditingRoomValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSaveEditRoom(idx);
                          } else if (e.key === 'Escape') {
                            setEditingRoomIdx(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 rounded-md border border-emerald-400 bg-white dark:bg-slate-800 px-2.5 py-1 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {roomName}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSaveEditRoom(idx)}
                          disabled={savingRoomEdit}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{savingRoomEdit ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRoomIdx(null)}
                          disabled={savingRoomEdit}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : isConfirmDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRoom(idx)}
                          disabled={deletingRoomIdx === idx}
                          className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {deletingRoomIdx === idx ? 'กำลังลบ...' : 'ยืนยันลบ'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoomIdx(null)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        {activeComputerRooms.length > 1 && (
                          <>
                            <button
                              type="button"
                              disabled={!canReorder || idx === 0}
                              onClick={() => void handleMoveRoom(idx, idx - 1)}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              title="เลื่อนขึ้น"
                              aria-label={`เลื่อน ${roomName} ขึ้น`}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!canReorder || idx === activeComputerRooms.length - 1}
                              onClick={() => void handleMoveRoom(idx, idx + 1)}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              title="เลื่อนลง"
                              aria-label={`เลื่อน ${roomName} ลง`}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRoomIdx(idx);
                            setEditingRoomValue(roomName);
                            setConfirmDeleteRoomIdx(null);
                          }}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-emerald-400 transition-colors"
                          title="แก้ไขชื่อห้องคอม"
                          aria-label={`แก้ไข ${roomName}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {activeComputerRooms.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteRoomIdx(idx);
                              setEditingRoomIdx(null);
                            }}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                            title="ลบห้องคอม"
                            aria-label={`ลบ ${roomName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>

    {/* Grade Level Promotion Section */}
    {(() => {
      const gradeSummary = [1, 2, 3, 4, 5, 6].map((g) => {
        const matched = allClassOptions
          .filter((cls) => new RegExp(`^ป\\.${g}/\\d+$`).test(cls))
          .sort((a, b) => {
            const ra = Number(a.split('/')[1] || 0);
            const rb = Number(b.split('/')[1] || 0);
            return ra - rb;
          });
        const rooms = matched.map((cls) => ({
          className: cls,
          count: studentCountByClass[cls] || 0,
        }));
        const total = rooms.reduce((acc, item) => acc + item.count, 0);
        return { grade: g, rooms, total };
      });

      const promotableCount = gradeSummary
        .filter((g) => g.grade <= 5)
        .reduce((acc, g) => acc + g.total, 0);
      const p6Count = gradeSummary.find((g) => g.grade === 6)?.total || 0;
      const p5Count = gradeSummary.find((g) => g.grade === 5)?.total || 0;
      const customClassesCount = allClassOptions
        .filter((cls) => !/^ป\.[1-6]\/\d+$/.test(cls))
        .reduce((acc, cls) => acc + (studentCountByClass[cls] || 0), 0);

      const sourceStudents = students
        .filter((s) => s.className === fromClass)
        .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'th'));
      const excludedSet = new Set(excludedStudentIds);
      const selectedRoomStudents = sourceStudents.filter((s) => !excludedSet.has(s.id));
      const destinationCount = studentCountByClass[toClass] || 0;

      const handleStartPromote = () => {
        if (updateYearOnPromote) {
          const cleanYear = targetAcademicYear.trim();
          if (cleanYear.length < 4) {
            onNotify('error', 'ปีการศึกษา (พ.ศ.) ต้องมีอย่างน้อย 4 หลัก เช่น 2570');
            return;
          }
        }
        if (promoMode === 'all') {
          if (promotableCount === 0 && !(p6Action === 'delete' && p6Count > 0)) {
            onNotify('error', 'ยังไม่มีรายชื่อนักเรียนที่จะปรับระดับชั้น');
            return;
          }
        } else {
          if (fromClass === toClass) {
            onNotify('error', 'กรุณาเลือกชั้นเรียนปลายทางที่แตกต่างจากชั้นเรียนเดิม');
            return;
          }
          if (selectedRoomStudents.length === 0) {
            onNotify('error', `กรุณาเลือกนักเรียนอย่างน้อย 1 คนในชั้น ${fromClass}`);
            return;
          }
        }
        setPromoConfirmOpen(true);
      };

      const handleConfirmPromote = async () => {
        setPromoting(true);
        try {
          const nextYearArg = updateYearOnPromote ? targetAcademicYear.trim() : undefined;
          if (promoMode === 'all') {
            const res = await api.promoteStudentsAllGrades({
              p6Action,
              nextAcademicYear: nextYearArg,
            });
            onStudentsChanged(res.updatedStudents);
            if (res.updatedAcademicYear) {
              setAcademicYear(res.updatedAcademicYear);
              const nextPlusOne = Number.parseInt(res.updatedAcademicYear, 10);
              if (Number.isFinite(nextPlusOne)) {
                setTargetAcademicYear(String(nextPlusOne + 1));
              }
              onSettingsUpdated({
                ...settings,
                schoolName: schoolName.trim() || settings.schoolName,
                academicYear: res.updatedAcademicYear,
                labManager,
                labManagers,
                colors,
              });
            }
            const parts: string[] = [];
            if (res.promotedCount > 0) parts.push(`เลื่อนชั้นนักเรียน ${res.promotedCount} คน`);
            if (res.deletedP6Count > 0) parts.push(`ลบรายชื่อ ป.6 ที่จบการศึกษา ${res.deletedP6Count} คน`);
            if (res.updatedAcademicYear) parts.push(`อัปเดตปีการศึกษาเป็น ${res.updatedAcademicYear}`);
            onNotify('success', `ปรับระดับชั้นเรียนสำเร็จ: ${parts.join(' · ')}`);
          } else {
            const res = await api.moveStudentsClass({
              fromClass,
              toClass,
              studentIds: selectedRoomStudents.map((s) => s.id),
              nextAcademicYear: nextYearArg,
            });
            onStudentsChanged(res.updatedStudents);
            setExcludedStudentIds([]);
            if (res.updatedAcademicYear) {
              setAcademicYear(res.updatedAcademicYear);
              onSettingsUpdated({
                ...settings,
                schoolName: schoolName.trim() || settings.schoolName,
                academicYear: res.updatedAcademicYear,
                labManager,
                labManagers,
                colors,
              });
            }
            onNotify(
              'success',
              `ปรับระดับชั้นนักเรียนจาก ${fromClass} เป็น ${toClass} จำนวน ${res.movedCount} คนเรียบร้อยแล้ว`
            );
          }
          setPromoConfirmOpen(false);
        } catch (err) {
          onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถปรับระดับชั้นเรียนได้');
        } finally {
          setPromoting(false);
        }
      };

      return (
        <>
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100/80 dark:border-cyan-900/50 bg-gradient-to-r from-cyan-50/90 via-sky-50/60 to-transparent dark:from-cyan-950/40 dark:via-sky-950/30 dark:to-transparent px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-xs shrink-0">
                  <GraduationCap className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    ปรับระดับชั้นเรียนประจำปีการศึกษา (เลื่อนชั้นเรียน)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ปรับระดับชั้นรายชื่อนักเรียนเมื่อขึ้นปีการศึกษาใหม่ เช่น ปี {academicYear} อยู่ ป.5/1 → ปรับเป็น ป.6/1 (ไม่กระทบประวัติการใช้งานย้อนหลัง)
                  </p>
                </div>
              </div>

              <div className="font-mono-num text-xs font-medium text-cyan-800 dark:text-cyan-300">
                ปีการศึกษาปัจจุบัน: พ.ศ. {academicYear} · นักเรียนทั้งหมด {students.length.toLocaleString('th-TH')} คน
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Mode Switcher */}
              <div className="inline-flex flex-wrap gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setPromoMode('all');
                    setUpdateYearOnPromote(true);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    promoMode === 'all'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  เลื่อนชั้นอัตโนมัติทั้งโรงเรียน (+1 ชั้น)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPromoMode('room');
                    setUpdateYearOnPromote(false);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    promoMode === 'room'
                      ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  ปรับระดับชั้นเฉพาะห้อง (เช่น ป.5/1 → ป.6/1)
                </button>
              </div>

              {promoMode === 'all' ? (
                <div className="space-y-5">
                  {/* Target Year + P6 Action */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-4 space-y-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={updateYearOnPromote}
                          onChange={(e) => setUpdateYearOnPromote(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>อัปเดตปีการศึกษาในระบบพร้อมกับการเลื่อนชั้น</span>
                      </label>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ปี {academicYear}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div className="flex items-center gap-2 flex-1">
                          <label htmlFor="promo-next-year" className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            ปีการศึกษาใหม่ (พ.ศ.):
                          </label>
                          <input
                            id="promo-next-year"
                            type="text"
                            maxLength={10}
                            disabled={!updateYearOnPromote}
                            value={targetAcademicYear}
                            onChange={(e) => setTargetAcademicYear(e.target.value)}
                            placeholder="2570"
                            className="font-mono-num w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-4 space-y-2.5">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        การจัดการนักเรียนชั้น ป.6 ปัจจุบัน ({p6Count} คน)
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="p6-action"
                            checked={p6Action === 'delete'}
                            onChange={() => setP6Action('delete')}
                            className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>
                            <strong>ลบรายชื่อนักเรียน ป.6 ออกจากระบบ (จบการศึกษา)</strong> — แนะนำเพื่อไม่ให้ปะปนกับ ป.5 ที่เลื่อนขึ้นมา
                          </span>
                        </label>
                        <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="p6-action"
                            checked={p6Action === 'keep'}
                            onChange={() => setP6Action('keep')}
                            className="mt-0.5 h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>คงรายชื่อนักเรียน ป.6 เดิมไว้ตามเดิม (ไม่ลบ)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {p6Action === 'keep' && p6Count > 0 && p5Count > 0 && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>ข้อควรระวัง:</strong> ชั้น ป.6 มีนักเรียนอยู่แล้ว {p6Count} คน หากเลือกคงรายชื่อไว้ นักเรียน ป.5 ({p5Count} คน) ที่เลื่อนขึ้นมาจะถูกรวมอยู่ในชั้น ป.6 เดียวกัน
                      </span>
                    </div>
                  )}

                  {/* Preview Mapping Grid */}
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">
                      ตัวอย่างผลลัพธ์การเลื่อนระดับชั้น ({gradeSummary.reduce((a, g) => a + g.total, 0)} คน):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {gradeSummary.map((item) => {
                        const isP6 = item.grade === 6;
                        const activeRooms = item.rooms.filter((r) => r.count > 0);
                        return (
                          <div
                            key={item.grade}
                            className={`rounded-lg border px-3.5 py-2.5 space-y-1.5 ${
                              item.total > 0
                                ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                : 'border-slate-100 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-900/40 opacity-65'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                                <span>ป.{item.grade}</span>
                                <ArrowRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                <span
                                  className={
                                    isP6 && p6Action === 'delete'
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : 'text-emerald-700 dark:text-emerald-400'
                                  }
                                >
                                  {isP6
                                    ? p6Action === 'delete'
                                      ? 'จบการศึกษา (ลบรายชื่อ)'
                                      : 'คงไว้ที่ ป.6'
                                    : `ป.${item.grade + 1}`}
                                </span>
                              </div>
                              <span className="font-mono-num text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {item.total} คน
                              </span>
                            </div>

                            {activeRooms.length > 0 ? (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                                {activeRooms
                                  .map((r) =>
                                    isP6
                                      ? `${r.className} (${r.count})`
                                      : `${r.className}→ป.${item.grade + 1}/${r.className.split('/')[1]} (${r.count})`
                                  )
                                  .join(' · ')}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                ไม่มีรายชื่อนักเรียน
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {customClassesCount > 0 && (
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        * หมายเหตุ: มีนักเรียนในชั้นเรียนชื่อกำหนดเองอีก {customClassesCount} คน ซึ่งสามารถเลือกย้ายชั้นได้ที่แท็บ &ldquo;ปรับระดับชั้นเฉพาะห้อง&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label htmlFor="promo-from-class" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        ชั้นเรียนเดิม (ปี {academicYear})
                      </label>
                      <select
                        id="promo-from-class"
                        value={fromClass}
                        onChange={(e) => {
                          const nextFrom = e.target.value;
                          setFromClass(nextFrom);
                          setExcludedStudentIds([]);
                          const suggested = suggestNextClass(nextFrom, allClassOptions);
                          if (suggested !== nextFrom) {
                            setToClass(suggested);
                          }
                        }}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {allClassOptions.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls} ({studentCountByClass[cls] || 0} คน)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="promo-to-class" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        ปรับเป็นชั้นเรียนใหม่
                      </label>
                      <select
                        id="promo-to-class"
                        value={toClass}
                        onChange={(e) => setToClass(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {allClassOptions.map((cls) => (
                          <option key={cls} value={cls} disabled={cls === fromClass}>
                            {cls} ({studentCountByClass[cls] || 0} คน)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-3.5 py-2 space-y-1.5">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={updateYearOnPromote}
                          onChange={(e) => setUpdateYearOnPromote(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                        />
                        <span>เปลี่ยนปีการศึกษาเป็น พ.ศ.</span>
                      </label>
                      {updateYearOnPromote && (
                        <input
                          type="text"
                          maxLength={10}
                          value={targetAcademicYear}
                          onChange={(e) => setTargetAcademicYear(e.target.value)}
                          placeholder="2570"
                          className="font-mono-num w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                        />
                      )}
                    </div>
                  </div>

                  {destinationCount > 0 && fromClass !== toClass && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        หมายเหตุ: ชั้นปลายทาง <strong>{toClass}</strong> มีนักเรียนอยู่แล้ว {destinationCount} คน หากดำเนินการต่อรายชื่อที่เลือกจะย้ายไปรวมกับห้อง {toClass}
                      </span>
                    </div>
                  )}

                  {/* Student Checklist for selected source class */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        รายชื่อนักเรียนในชั้น {fromClass} (เลือกย้าย {selectedRoomStudents.length}/{sourceStudents.length} คน)
                      </span>
                      {sourceStudents.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExcludedStudentIds([])}
                            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            เลือกทั้งหมด
                          </button>
                          <button
                            type="button"
                            onClick={() => setExcludedStudentIds(sourceStudents.map((s) => s.id))}
                            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            ไม่เลือกเลย
                          </button>
                        </div>
                      )}
                    </div>

                    {sourceStudents.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        ไม่มีรายชื่อนักเรียนในชั้น {fromClass}
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {sourceStudents.map((stu) => {
                          const checked = !excludedSet.has(stu.id);
                          return (
                            <label
                              key={stu.id}
                              className="flex items-center justify-between gap-3 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setExcludedStudentIds((prev) =>
                                      prev.includes(stu.id)
                                        ? prev.filter((id) => id !== stu.id)
                                        : [...prev, stu.id]
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="font-mono-num text-slate-400 w-9 shrink-0">
                                  {stu.number ? `เลขที่ ${stu.number}` : '-'}
                                </span>
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {stu.name}
                                </span>
                              </div>
                              <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                                {fromClass} → {toClass}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {promoMode === 'all'
                    ? `จะปรับระดับชั้น ป.1–ป.5 จำนวน ${promotableCount} คน${
                        p6Action === 'delete' && p6Count > 0
                          ? ` และลบ ป.6 ที่จบการศึกษา ${p6Count} คน`
                          : ''
                      }`
                    : `จะย้ายนักเรียน ${fromClass} → ${toClass} จำนวน ${selectedRoomStudents.length} คน`}
                </span>
                <button
                  type="button"
                  disabled={
                    promoting ||
                    (promoMode === 'all'
                      ? promotableCount === 0 && !(p6Action === 'delete' && p6Count > 0)
                      : selectedRoomStudents.length === 0 || fromClass === toClass)
                  }
                  onClick={handleStartPromote}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                >
                  <GraduationCap className="h-4 w-4" />
                  <span>
                    {promoMode === 'all'
                      ? 'ดำเนินการเลื่อนระดับชั้นทั้งโรงเรียน'
                      : `ยืนยันปรับชั้น ${fromClass} → ${toClass} (${selectedRoomStudents.length} คน)`}
                  </span>
                </button>
              </div>
            </div>
          </section>

          <ConfirmModal
            open={promoConfirmOpen}
            danger={promoMode === 'all' && p6Action === 'delete' && p6Count > 0}
            title={
              promoMode === 'all'
                ? 'ยืนยันการเลื่อนระดับชั้นทั้งโรงเรียน'
                : `ยืนยันปรับระดับชั้น ${fromClass} → ${toClass}`
            }
            description={
              promoMode === 'all'
                ? `ต้องการเลื่อนชั้นนักเรียน ป.1–ป.5 ขึ้น 1 ระดับชั้น จำนวน ${promotableCount} คน${
                    p6Action === 'delete' && p6Count > 0
                      ? ` พร้อมลบรายชื่อนักเรียน ป.6 ที่จบการศึกษา ${p6Count} คน`
                      : ''
                  }${
                    updateYearOnPromote
                      ? ` และอัปเดตปีการศึกษาเป็น พ.ศ. ${targetAcademicYear.trim()}`
                      : ''
                  } หรือไม่? (ประวัติการใช้งานเดิมจะไม่เปลี่ยนแปลง)`
                : `ต้องการปรับระดับชั้นนักเรียนจาก ${fromClass} เป็น ${toClass} จำนวน ${selectedRoomStudents.length} คน${
                    updateYearOnPromote
                      ? ` และอัปเดตปีการศึกษาเป็น พ.ศ. ${targetAcademicYear.trim()}`
                      : ''
                  } หรือไม่?`
            }
            confirmLabel={promoMode === 'all' ? 'ยืนยันเลื่อนชั้นเรียน' : 'ยืนยันปรับระดับชั้น'}
            loading={promoting}
            onConfirm={() => void handleConfirmPromote()}
            onCancel={() => setPromoConfirmOpen(false)}
          />
        </>
      );
    })()}

    {/* Usage Types Management Section */}
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
      <div className="flex items-center gap-3 border-b border-emerald-100/80 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-transparent dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-transparent px-6 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xs shrink-0">
          <ListChecks className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            จัดการรูปแบบการใช้ห้องคอมพิวเตอร์
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            เพิ่ม แก้ไข หรือลบตัวเลือกรูปแบบการใช้ที่จะแสดงในหน้าบันทึกข้อมูล
          </p>
        </div>
      </div>

      <div className="p-6">
        <UsageTypesManagerPanel
          usageTypes={usageTypes}
          onUsageTypesChanged={(next) => onUsageTypesChanged(next)}
          onNotify={onNotify}
        />
      </div>
    </section>

    {/* 6-Digit PIN Security & Admin Accounts Configuration Section */}
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100/80 dark:border-amber-900/50 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-transparent dark:from-amber-950/40 dark:via-orange-950/30 dark:to-transparent px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs shrink-0">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isPrimaryAdmin
                ? 'ตั้งค่ารหัสผ่านเข้าสู่ระบบ 6 หลัก (PIN) และผู้ดูแลระบบ'
                : 'จัดการรหัสผ่านเข้าสู่ระบบ 6 หลัก (PIN) ของฉัน'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPrimaryAdmin
                ? 'แก้ไขรหัส PIN หลัก และเพิ่มบัญชีผู้ดูแลระบบเพิ่มเติมพร้อมตั้งรหัสผ่านใหม่ได้ (สูงสุด 4 คน)'
                : 'ผู้ดูแลระบบเพิ่มเติมไม่สามารถดูหรือแก้ไขรหัสผ่านของผู้ดูแลระบบหลักและบุคคลอื่นได้'}
            </p>
          </div>
        </div>

        {isPrimaryAdmin && (
          <button
            type="button"
            disabled={savingPins}
            onClick={() => void handleResetDefaultPins()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รีเซ็ต PIN หลักเป็นค่าเริ่มต้น</span>
          </button>
        )}
      </div>

      {isPrimaryAdmin ? (
        <div className="p-6 space-y-6">
          {/* Part 1: Main Admin & User PIN Editor (Primary Admin Only) */}
          <form onSubmit={handleSavePins} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                แก้ไขรหัส PIN เข้าสู่ระบบหลัก
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                กรอกเฉพาะช่องที่ต้องการเปลี่ยน (ตัวเลข 6 หลัก)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pin-admin-6" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  รหัส PIN ผู้ดูแลระบบหลัก (Admin) — 6 หลัก
                </label>
                <div className="relative">
                  <input
                    id="pin-admin-6"
                    type={showAdminPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={newAdminPin}
                    onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="กรอกเลข 6 หลักใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPin((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showAdminPin ? 'ซ่อนรหัส PIN Admin' : 'แสดงรหัส PIN Admin'}
                  >
                    {showAdminPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="pin-user-6" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  รหัส PIN ผู้ใช้งานทั่วไป (User) — 6 หลัก
                </label>
                <div className="relative">
                  <input
                    id="pin-user-6"
                    type={showUserPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    value={newUserPin}
                    onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="กรอกเลข 6 หลักใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPin((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showUserPin ? 'ซ่อนรหัส PIN User' : 'แสดงรหัส PIN User'}
                  >
                    {showUserPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPins || (!newAdminPin && !newUserPin)}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-55"
                style={{ backgroundColor: 'var(--theme-primary)' }}
              >
                <Save className="h-3.5 w-3.5" />
                <span>{savingPins ? 'กำลังบันทึก...' : 'บันทึกรหัส PIN หลัก'}</span>
              </button>
            </div>
          </form>

          {/* Part 2: Additional Admin PIN Accounts (Primary Admin Only) */}
          <div className="pt-5 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>ผู้ดูแลระบบเพิ่มเติม (รหัส PIN ประจำบุคคล)</span>
                  <span className="font-mono-num text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {extraAdmins.length}/4
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  เพิ่มชื่อผู้ดูแลระบบพร้อมรหัส PIN 6 หลักใหม่ได้สูงสุด 4 คน เพื่อให้ผู้ช่วยหรือครูท่านอื่นเข้าใช้งานสิทธิ์ Admin ได้
                </p>
              </div>

              <button
                type="button"
                disabled={extraAdmins.length >= 4}
                onClick={openAddExtraAdminModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{extraAdmins.length >= 4 ? 'ครบสูงสุด 4 คนแล้ว' : 'เพิ่มผู้ดูแลระบบใหม่'}</span>
              </button>
            </div>

            {extraAdmins.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/30 p-5 text-center">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  ยังไม่มีผู้ดูแลระบบเพิ่มเติม
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  กดปุ่ม &ldquo;เพิ่มผู้ดูแลระบบใหม่&rdquo; เพื่อสร้างชื่อผู้ดูแลและตั้งรหัส PIN 6 หลักสำหรับเข้าสู่ระบบ
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {extraAdmins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        <ShieldCheck className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {admin.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span className="font-mono-num tracking-wider">PIN: ••••••</span>
                          <span aria-hidden="true">·</span>
                          <span>อัปเดต {new Date(admin.updatedAt).toLocaleDateString('th-TH')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditExtraAdminModal(admin)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="แก้ไขชื่อหรือรหัส PIN"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>แก้ไข</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteExtraTarget(admin)}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                        aria-label={`ลบผู้ดูแลระบบ ${admin.name}`}
                        title="ลบผู้ดูแลระบบ"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Restricted View for Additional Admin: Cannot view or edit other admins' PINs */
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 p-4">
            <Lock className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-semibold">
                จำกัดสิทธิ์การเข้าถึงรหัสผ่าน: บัญชี &ldquo;{myExtraAdmin?.name || activeAdminName || 'ผู้ดูแลระบบเพิ่มเติม'}&rdquo;
              </div>
              <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                คุณอยู่ในสิทธิ์ <strong>ผู้ดูแลระบบเพิ่มเติม</strong> จึงไม่สามารถดูรายชื่อ แก้ไข หรือลบรหัสผ่าน PIN ของผู้ดูแลระบบหลัก ผู้ใช้งานทั่วไป หรือผู้ดูแลระบบท่านอื่นได้ (เปลี่ยนได้เฉพาะรหัส PIN 6 หลักของตนเองเท่านั้น)
              </p>
            </div>
          </div>

          {myExtraAdmin ? (
            <form onSubmit={handleChangeOwnExtraPin} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="own-current-pin" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    รหัส PIN ปัจจุบันของคุณ (6 หลัก) *
                  </label>
                  <input
                    id="own-current-pin"
                    type={showOwnPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={ownCurrentPin}
                    onChange={(e) => setOwnCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="กรอกรหัส PIN เดิม 6 หลัก"
                    className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="own-new-pin" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    รหัส PIN ใหม่ของคุณ (6 หลัก) *
                  </label>
                  <div className="relative">
                    <input
                      id="own-new-pin"
                      type={showOwnPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={ownNewPin}
                      onChange={(e) => setOwnNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="กรอกรหัส PIN ใหม่ 6 หลัก"
                      className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnPin((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label={showOwnPin ? 'ซ่อนรหัส PIN' : 'แสดงรหัส PIN'}
                    >
                      {showOwnPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingOwnPin || ownCurrentPin.length !== 6 || ownNewPin.length !== 6}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-55"
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingOwnPin ? 'กำลังบันทึก...' : 'เปลี่ยนรหัส PIN ของฉัน'}</span>
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ไม่พบข้อมูลบัญชีผู้ดูแลระบบเพิ่มเติมนี้ในระบบ (อาจถูกลบโดยผู้ดูแลระบบหลักแล้ว)
            </p>
          )}
        </div>
      )}
    </section>

    {/* Cloud Persistence & Full Backup / Restore Section */}
    <section className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-[var(--theme-surface)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100/80 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-transparent dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-transparent px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-xs shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              ความปลอดภัยของข้อมูล · สำรองและกู้คืนข้อมูล (Backup &amp; Restore)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ข้อมูลทั้งหมดบันทึกถาวรบน Cloud Firestore พร้อมแคชออฟไลน์ในเครื่อง ไม่สูญหายเมื่ออัปเดตหรือรีเฟรชระบบ
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/25 p-4 text-xs text-emerald-950 dark:text-emerald-200 space-y-1.5 leading-relaxed">
          <div className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>ระบบป้องกันข้อมูลหายจากการอัปเดตทำงานอยู่</span>
          </div>
          <p className="text-emerald-900/90 dark:text-emerald-300/90">
            1) ข้อมูลนักเรียน รายวิชา ประวัติการใช้งาน การจอง ตารางสอน และตั้งค่า ถูกเก็บแยกไว้บนฐานข้อมูลคลาวด์ (Cloud Firestore) ไม่ได้เก็บในไฟล์ชั่วคราวของเซิร์ฟเวอร์ &nbsp;·&nbsp;
            2) เปิดใช้งานแคชออฟไลน์ (IndexedDB Persistence) ช่วยเก็บข้อมูลที่เพิ่งบันทึกไว้ในเบราว์เซอร์และซิงค์ขึ้นคลาวด์อัตโนมัติแม้รีเฟรชหน้าจอ &nbsp;·&nbsp;
            3) ระบบจะไม่เขียนข้อมูลตัวอย่างทับข้อมูลจริงที่มีอยู่แล้ว
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                สำรองข้อมูลทั้งหมด (Export .json)
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                ดาวน์โหลดข้อมูลทั้งหมดในระบบ (รายชื่อนักเรียน รายวิชา ประวัติการใช้งาน การจองห้อง ตารางคาบสอน และการตั้งค่า) เก็บไว้เป็นไฟล์สำรองในเครื่อง
              </p>
            </div>
            <div>
              <button
                type="button"
                disabled={exportingBackup}
                onClick={() => void handleExportFullBackup()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-55 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{exportingBackup ? 'กำลังส่งออกข้อมูล...' : 'ดาวน์โหลดไฟล์สำรองข้อมูล (.json)'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                กู้คืนข้อมูลจากไฟล์สำรอง (Import .json)
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                นำเข้าข้อมูลจากไฟล์สำรอง .json กลับเข้าสู่ระบบอย่างปลอดภัย (ผสานข้อมูลเดิมโดยไม่ลบข้อมูลที่มีอยู่แล้วในระบบ)
              </p>
            </div>
            <div>
              <input
                ref={backupFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleBackupFileSelected(e)}
                className="hidden"
              />
              <button
                type="button"
                disabled={restoringBackup}
                onClick={() => backupFileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-55 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{restoringBackup ? 'กำลังกู้คืนข้อมูล...' : 'เลือกไฟล์สำรองเพื่อกู้คืน (.json)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Data Management / Clear Data Section */}
    <section className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-[var(--theme-surface)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100/80 dark:border-rose-900/50 bg-gradient-to-r from-rose-50/90 via-pink-50/60 to-transparent dark:from-rose-950/40 dark:via-pink-950/30 dark:to-transparent px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-600 to-pink-600 text-white shadow-xs shrink-0">
            <Database className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              จัดการและล้างข้อมูลในระบบ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เลือกเฉพาะลบประวัติการใช้งาน หรือล้างข้อมูลทั้งหมดเพื่อเริ่มต้นปีการศึกษาใหม่
            </p>
          </div>
        </div>

        <div className="font-mono-num text-xs font-medium text-rose-700 dark:text-rose-300">
          การใช้งาน {counts.logs.toLocaleString('th-TH')} · นักเรียน {counts.students.toLocaleString('th-TH')} · รายวิชา {counts.subjects.toLocaleString('th-TH')}
        </div>
      </div>

      <div className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option 1: Delete usage logs only */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              ลบข้อมูลเฉพาะการใช้งาน
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              ลบเฉพาะประวัติบันทึกการเข้าใช้ห้องคอมพิวเตอร์ทั้งหมด (<span className="font-mono-num font-medium text-slate-700 dark:text-slate-300">{counts.logs}</span> รายการ) โดยยังคงรายชื่อนักเรียน รายวิชา รูปแบบการใช้ และการตั้งค่าโรงเรียนไว้ครบถ้วน
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled={counts.logs === 0}
              onClick={() => setClearModal('logs')}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ลบข้อมูลเฉพาะการใช้งาน ({counts.logs})</span>
            </button>
          </div>
        </div>

        {/* Option 2: Delete ALL students */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              ลบรายชื่อนักเรียนทั้งหมด
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              ลบรายชื่อนักเรียนทั้งหมดออกจากระบบ (<span className="font-mono-num font-medium text-slate-700 dark:text-slate-300">{counts.students}</span> คน) เพื่อนำเข้ารายชื่อชุดใหม่ โดยยังคงประวัติการใช้งาน รายวิชา และตารางสอนไว้ครบถ้วน
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled={counts.students === 0}
              onClick={() => setClearModal('students-all')}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ลบรายชื่อนักเรียนทั้งหมด ({counts.students})</span>
            </button>
          </div>
        </div>

        {/* Option 3: Delete students by selected classrooms */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ลบรายชื่อนักเรียน (เลือกห้อง)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  เลือกห้องเรียนที่ต้องการลบรายชื่อนักเรียนออก (เลือกได้ 1 ห้องหรือหลายห้อง)
                </p>
              </div>
              {roomsWithStudents.length > 0 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedClearRooms([...roomsWithStudents])}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    เลือกทุกห้องที่มีชื่อ
                  </button>
                  {selectedClearRooms.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedClearRooms([])}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      ล้างที่เลือก
                    </button>
                  )}
                </div>
              )}
            </div>

            {counts.students === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/30 px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                ไม่มีรายชื่อนักเรียนในระบบ
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {allClassOptions.map((cls) => {
                  const count = studentCountByClass[cls] || 0;
                  const isSelected = selectedClearRooms.includes(cls);
                  const disabled = count === 0;
                  return (
                    <button
                      key={cls}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedClearRooms((prev) =>
                          prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
                        );
                      }}
                      className={`flex items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                        disabled
                          ? 'border-slate-100 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-900/40 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                          : isSelected
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-rose-300 hover:bg-rose-50/40 dark:hover:bg-rose-950/20'
                      }`}
                    >
                      <span className="truncate">{cls}</span>
                      <span className="font-mono-num text-[11px] shrink-0 opacity-80">
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {selectedClearRooms.length > 0
                ? `เลือก ${selectedClearRooms.length} ห้อง · ${selectedClearStudentCount} คน`
                : 'คลิกเลือกห้องเรียนด้านบน'}
            </span>
            <button
              type="button"
              disabled={selectedClearRooms.length === 0 || selectedClearStudentCount === 0}
              onClick={() => setClearModal('students-rooms')}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ลบนักเรียนห้องที่เลือก ({selectedClearStudentCount})</span>
            </button>
          </div>
        </div>

        {/* Option 4: Clear all data */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/30 dark:bg-rose-950/20 p-4">
          <div>
            <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              ล้างข้อมูลทั้งหมด
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              ลบข้อมูลประวัติการใช้งาน (<span className="font-mono-num font-medium">{counts.logs}</span>) รายชื่อนักเรียน (<span className="font-mono-num font-medium">{counts.students}</span>) และรายวิชา (<span className="font-mono-num font-medium">{counts.subjects}</span>) ทั้งหมดออกจากระบบ คงไว้เฉพาะการตั้งค่าโรงเรียนและชุดสี
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled={counts.logs === 0 && counts.students === 0 && counts.subjects === 0}
              onClick={() => setClearModal('all')}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ล้างข้อมูลทั้งหมด</span>
            </button>
          </div>
        </div>
      </div>
      </div>
    </section>

    {/* Add / Edit Additional Admin Modal (Primary Admin Only) */}
    {isPrimaryAdmin && adminFormModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-admin-modal-title"
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/90 to-amber-50/50 dark:from-indigo-950/40 dark:to-amber-950/20 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 id="extra-admin-modal-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {adminFormModal.mode === 'add'
                    ? 'เพิ่มผู้ดูแลระบบและรหัสผ่านใหม่'
                    : 'แก้ไขผู้ดูแลระบบ / รหัส PIN'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ใช้ตัวเลข 6 หลักสำหรับเข้าสู่ระบบในสิทธิ์ผู้ดูแลระบบ (Admin)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAdminFormModal(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSaveExtraAdmin} className="p-6 space-y-4">
            <div>
              <label htmlFor="extra-admin-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                ชื่อผู้ดูแลระบบ *
              </label>
              <input
                id="extra-admin-name"
                type="text"
                required
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                placeholder="เช่น ครูสมชาย ใจดี หรือ ผู้ช่วยห้องคอม"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="extra-admin-pin" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {adminFormModal.mode === 'add'
                  ? 'รหัสผ่าน PIN 6 หลักใหม่ *'
                  : 'รหัสผ่าน PIN 6 หลักใหม่ (เว้นว่างหากไม่เปลี่ยนรหัส)'}
              </label>
              <div className="relative">
                <input
                  id="extra-admin-pin"
                  type={showExtraPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  required={adminFormModal.mode === 'add'}
                  value={extraPin}
                  onChange={(e) => setExtraPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="กรอกตัวเลข 6 หลัก"
                  className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowExtraPin((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showExtraPin ? 'ซ่อนรหัส PIN' : 'แสดงรหัส PIN'}
                >
                  {showExtraPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdminFormModal(null)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={savingExtraAdmin}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {savingExtraAdmin
                  ? 'กำลังบันทึก...'
                  : adminFormModal.mode === 'add'
                  ? 'เพิ่มผู้ดูแลระบบ'
                  : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    <ConfirmModal
      open={isPrimaryAdmin && Boolean(deleteExtraTarget)}
      title="ยืนยันการลบผู้ดูแลระบบ"
      description={`ต้องการลบผู้ดูแลระบบ "${deleteExtraTarget?.name || ''}" และยกเลิกรหัส PIN 6 หลักของบัญชีนี้หรือไม่?`}
      confirmLabel="ยืนยันลบผู้ดูแลระบบ"
      loading={deletingExtra}
      onConfirm={handleConfirmDeleteExtraAdmin}
      onCancel={() => setDeleteExtraTarget(null)}
    />

    <ConfirmModal
      open={Boolean(pendingBackup)}
      title="ยืนยันการกู้คืนข้อมูลจากไฟล์สำรอง"
      description={
        pendingBackup
          ? `พบข้อมูลในไฟล์ "${pendingBackup.fileName}": ประวัติการใช้งาน ${pendingBackup.summary.logs} รายการ · นักเรียน ${pendingBackup.summary.students} คน · รายวิชา ${pendingBackup.summary.subjects} วิชา · จองห้อง ${pendingBackup.summary.bookings} รายการ · ตารางสอน ${pendingBackup.summary.teachingSchedules} คาบ ต้องการนำเข้าและผสานเข้าสู่ฐานข้อมูลหรือไม่? (ข้อมูลเดิมที่ไม่ซ้ำจะไม่ถูกลบ)`
          : ''
      }
      confirmLabel="ยืนยันกู้คืนข้อมูล"
      danger={false}
      loading={restoringBackup}
      onConfirm={handleConfirmRestoreBackup}
      onCancel={() => setPendingBackup(null)}
    />

    <ConfirmModal
      open={clearModal !== null}
      title={
        clearModal === 'logs'
          ? 'ยืนยันการลบข้อมูลเฉพาะการใช้งาน'
          : clearModal === 'students-all'
          ? 'ยืนยันการลบรายชื่อนักเรียนทั้งหมด'
          : clearModal === 'students-rooms'
          ? 'ยืนยันการลบรายชื่อนักเรียนตามห้องที่เลือก'
          : 'ยืนยันการล้างข้อมูลทั้งหมด'
      }
      description={
        clearModal === 'logs'
          ? `ต้องการลบประวัติการเข้าใช้ห้องคอมพิวเตอร์ทั้งหมด ${counts.logs} รายการหรือไม่? (รายชื่อนักเรียน รายวิชา และการตั้งค่าจะไม่ถูกลบ) การดำเนินการนี้ไม่สามารถย้อนกลับได้`
          : clearModal === 'students-all'
          ? `ต้องการลบรายชื่อนักเรียนทั้งหมด ${counts.students} คน ออกจากระบบหรือไม่? (ประวัติการใช้งาน รายวิชา ตารางสอน และการตั้งค่าจะไม่ถูกลบ) การดำเนินการนี้ไม่สามารถย้อนกลับได้`
          : clearModal === 'students-rooms'
          ? `ต้องการลบรายชื่อนักเรียนในห้อง ${orderedSelectedClearRooms.join(', ')} จำนวน ${selectedClearStudentCount} คน ออกจากระบบหรือไม่? (ห้องเรียนอื่นและประวัติการใช้งานเดิมจะไม่ถูกลบ) การดำเนินการนี้ไม่สามารถย้อนกลับได้`
          : `ต้องการล้างข้อมูลทั้งหมดในระบบ (การใช้งาน ${counts.logs} รายการ, นักเรียน ${counts.students} คน, รายวิชา ${counts.subjects} วิชา) หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`
      }
      confirmLabel={
        clearModal === 'logs'
          ? 'ยืนยันลบข้อมูลการใช้งาน'
          : clearModal === 'students-all'
          ? 'ยืนยันลบนักเรียนทั้งหมด'
          : clearModal === 'students-rooms'
          ? 'ยืนยันลบนักเรียนห้องที่เลือก'
          : 'ยืนยันล้างข้อมูลทั้งหมด'
      }
      loading={clearing}
      onConfirm={handleConfirmClear}
      onCancel={() => setClearModal(null)}
    />
    </div>
  );
}
