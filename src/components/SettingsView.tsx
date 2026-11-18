import React, { useState } from 'react';
import { Save, RotateCcw, Palette, School, ListChecks, Trash2, Database, KeyRound } from 'lucide-react';
import { DEFAULT_THEME_COLORS, type AppSettings, type ThemeColors } from '../types';
import { api } from '../api/client';
import { UsageTypesManagerPanel } from './UsageTypesManagerModal';
import { ConfirmModal } from './ConfirmModal';
import {
  DEFAULT_ADMIN_PIN_6,
  DEFAULT_USER_PIN_6,
  isValidPin6,
  type PinHashes,
} from '../firebase/pinAuth';
import { updateSecurityPins } from '../firebase/firestoreService';

interface SettingsViewProps {
  settings: AppSettings;
  usageTypes: string[];
  pinHashes: PinHashes | null;
  counts: {
    logs: number;
    students: number;
    subjects: number;
  };
  onSettingsUpdated: (next: AppSettings) => void;
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

export function SettingsView({
  settings,
  usageTypes,
  pinHashes,
  counts,
  onSettingsUpdated,
  onUsageTypesChanged,
  onPinHashesChanged,
  onClearLogsOnly,
  onClearAllData,
  onNotify,
}: SettingsViewProps) {
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [academicYear, setAcademicYear] = useState(settings.academicYear);
  const [labManager, setLabManager] = useState(settings.labManager);
  const [colors, setColors] = useState<ThemeColors>(settings.colors);
  const [saving, setSaving] = useState(false);

  const [newAdminPin, setNewAdminPin] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [savingPins, setSavingPins] = useState(false);

  const [clearModal, setClearModal] = useState<'logs' | 'all' | null>(null);
  const [clearing, setClearing] = useState(false);

  const handleSavePins = async (e: React.FormEvent) => {
    e.preventDefault();
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
        pinHashes
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
    setSavingPins(true);
    try {
      const updated = await updateSecurityPins(
        DEFAULT_ADMIN_PIN_6,
        DEFAULT_USER_PIN_6,
        pinHashes
      );
      onPinHashesChanged(updated);
      setNewAdminPin('');
      setNewUserPin('');
      onNotify('success', 'รีเซ็ตรหัส PIN เป็นค่าเริ่มต้นเรียบร้อยแล้ว');
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'ไม่สามารถรีเซ็ตรหัส PIN ได้');
    } finally {
      setSavingPins(false);
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
      } else {
        const res = await api.clearAllData();
        onClearAllData();
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

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const nextColors = { ...colors, [key]: value };
    setColors(nextColors);
    // Live preview immediately
    onSettingsUpdated({
      schoolName,
      academicYear,
      labManager,
      colors: nextColors,
    });
  };

  const handleApplyPreset = (presetColors: ThemeColors) => {
    setColors(presetColors);
    onSettingsUpdated({
      schoolName,
      academicYear,
      labManager,
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
        colors,
      });
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
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <School className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            ข้อมูลโรงเรียนและผู้รับผิดชอบ
          </h2>
        </div>

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
              ผู้รับผิดชอบห้องคอมพิวเตอร์
            </label>
            <input
              id="set-manager"
              type="text"
              required
              value={labManager}
              onChange={(e) => setLabManager(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Recolorable Theme Settings */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              ปรับแต่งชุดสีระบบ (Recolorable)
            </h2>
          </div>

          <button
            type="button"
            onClick={() => handleApplyPreset(DEFAULT_THEME_COLORS)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รีเซ็ตสีเริ่มต้น</span>
          </button>
        </div>

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
      </section>
    </form>

    {/* Usage Types Management Section */}
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-5">
      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <ListChecks className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            จัดการรูปแบบการใช้ห้องคอมพิวเตอร์
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            เพิ่ม แก้ไข หรือลบตัวเลือกรูปแบบการใช้ที่จะแสดงในหน้าบันทึกข้อมูล
          </p>
        </div>
      </div>

      <UsageTypesManagerPanel
        usageTypes={usageTypes}
        onUsageTypesChanged={(next) => onUsageTypesChanged(next)}
        onNotify={onNotify}
      />
    </section>

    {/* 6-Digit PIN Security Configuration Section */}
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--theme-surface)] p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              ตั้งค่ารหัสผ่านเข้าสู่ระบบ 6 หลัก (PIN)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กำหนดรหัสตัวเลข 6 หลัก สำหรับเข้าสู่ระบบและปลดล็อกหน้าจอ
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={savingPins}
          onClick={() => void handleResetDefaultPins()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>รีเซ็ตเป็นค่าเริ่มต้น</span>
        </button>
      </div>

      <form onSubmit={handleSavePins} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pin-admin-6" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              รหัส PIN ผู้ดูแลระบบ (Admin) — 6 หลัก
            </label>
            <input
              id="pin-admin-6"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newAdminPin}
              onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="กรอกเลข 6 หลักใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"
              className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="pin-user-6" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              รหัส PIN ผู้ใช้งานทั่วไป (User) — 6 หลัก
            </label>
            <input
              id="pin-user-6"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newUserPin}
              onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="กรอกเลข 6 หลักใหม่ (เว้นว่างถ้าไม่เปลี่ยน)"
              className="font-mono-num w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPins || (!newAdminPin && !newUserPin)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-55"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            <Save className="h-3.5 w-3.5" />
            <span>{savingPins ? 'กำลังบันทึก...' : 'บันทึกรหัส PIN 6 หลัก'}</span>
          </button>
        </div>
      </form>
    </section>

    {/* Data Management / Clear Data Section */}
    <section className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-[var(--theme-surface)] p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              จัดการและล้างข้อมูลในระบบ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เลือกเฉพาะลบประวัติการใช้งาน หรือล้างข้อมูลทั้งหมดเพื่อเริ่มต้นปีการศึกษาใหม่
            </p>
          </div>
        </div>

        <div className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
          การใช้งาน {counts.logs.toLocaleString('th-TH')} · นักเรียน {counts.students.toLocaleString('th-TH')} · รายวิชา {counts.subjects.toLocaleString('th-TH')}
        </div>
      </div>

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

        {/* Option 2: Clear all data */}
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
    </section>

    <ConfirmModal
      open={clearModal !== null}
      title={clearModal === 'logs' ? 'ยืนยันการลบข้อมูลเฉพาะการใช้งาน' : 'ยืนยันการล้างข้อมูลทั้งหมด'}
      description={
        clearModal === 'logs'
          ? `ต้องการลบประวัติการเข้าใช้ห้องคอมพิวเตอร์ทั้งหมด ${counts.logs} รายการหรือไม่? (รายชื่อนักเรียน รายวิชา และการตั้งค่าจะไม่ถูกลบ) การดำเนินการนี้ไม่สามารถย้อนกลับได้`
          : `ต้องการล้างข้อมูลทั้งหมดในระบบ (การใช้งาน ${counts.logs} รายการ, นักเรียน ${counts.students} คน, รายวิชา ${counts.subjects} วิชา) หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`
      }
      confirmLabel={clearModal === 'logs' ? 'ยืนยันลบข้อมูลการใช้งาน' : 'ยืนยันล้างข้อมูลทั้งหมด'}
      loading={clearing}
      onConfirm={handleConfirmClear}
      onCancel={() => setClearModal(null)}
    />
    </div>
  );
}
